/**
 * DeepSeek 分享解析模块（零依赖 ESM）
 * ==================================================================
 * 用途：把用户粘贴的 DeepSeek 网页版分享链接抓取下来，转成 markdown
 * 转录，并拼成可直接作为新任务首条用户消息的种子 Prompt。
 * （本文件顶部即简短 README，供 host/index.js 集成参考。）
 *
 * 导出接口（与 task-2 约定一致）：
 *
 *   parseShareInput(text)
 *     识别输入，返回其一：
 *       { kind:'share', shareId, url }
 *       { kind:'text', text }
 *       { kind:'invalid', reason }
 *     支持：完整 URL（https://chat.deepseek.com/share/<id>，可带 query/hash）、
 *     仅 share/<id>、裸 share id（[A-Za-z0-9_-]+）；非链接但 >= 40 字符视为文本。
 *
 *   fetchShare(shareId, options?)
 *     options = { fetchImpl?, timeoutMs? = 15000 }
 *     GET https://chat.deepseek.com/api/v0/share/content?share_id=<id>
 *     （含 Accept: application/json 与常见浏览器 UA；Node 18+ 全局 fetch）
 *     成功返回：
 *       { shareId, url, title, modelType, messages:[{role,text}],
 *         markdown, stats:{ total, user, assistant, chars } }
 *     失败抛出带 code 的 Error（见 SHARE_ERROR_CODES），可能附带
 *     status（HTTP 状态码）、bizCode（业务错误码）、cause（原始错误）。
 *
 *   buildSeedPrompt(share, options?)
 *     options = { instruction?, sourceLabel?, maxChars? = 200000 }
 *     返回可直接作为新任务首条用户消息的中文纯文本（标题 + 原始链接 +
 *     对话转录 + 任务要求）。超过 maxChars 时保留头尾，中间插入
 *     “…（已截断 N 字符）…”。
 *
 * 转录规则（依据真实响应）：
 *   data.biz_data.messages[].fragments[]，只取 REQUEST / RESPONSE /
 *   TEMPLATE_RESPONSE 的 content；跳过 THINK / TOOL_SEARCH / TOOL_OPEN /
 *   TOOL_FIND / TIP / FILE 等。兼容老形状 message.content（字符串或
 *   内容数组）。markdown 分节为 "## 用户" / "## DeepSeek"。
 *
 * 本模块零第三方依赖、不读写环境变量/文件；测试可通过 options.fetchImpl
 * 注入假 fetch，从而完全离线运行。
 */

/** DeepSeek 站点源。 */
export const SHARE_ORIGIN = 'https://chat.deepseek.com';
/** 分享内容 API 地址（GET，无需登录）。 */
export const SHARE_CONTENT_API_URL = 'https://chat.deepseek.com/api/v0/share/content';
/** title 缺失时使用的标题。 */
export const DEFAULT_SHARE_TITLE = 'DeepSeek 分享对话';
/** buildSeedPrompt 默认来源标签。 */
export const DEFAULT_SOURCE_LABEL = 'DeepSeek 网页版';
/** fetchShare 默认超时（毫秒）。 */
export const DEFAULT_TIMEOUT_MS = 15000;
/** buildSeedPrompt 默认最大字符数。 */
export const DEFAULT_MAX_PROMPT_CHARS = 200000;
/** 非链接文本被判定为有效文本的最小长度。 */
export const MIN_TEXT_LENGTH = 40;

/** fetchShare 抛出的错误码，host 可据此分类提示。 */
export const SHARE_ERROR_CODES = Object.freeze({
  /** fetchShare 入参不是合法 share id。 */
  INVALID_INPUT: 'ERR_SHARE_INVALID_INPUT',
  /** 运行环境没有 fetch，且未注入 fetchImpl。 */
  NO_FETCH: 'ERR_SHARE_NO_FETCH',
  /** 网络层错误（DNS/连接/TLS 等）。 */
  NETWORK: 'ERR_SHARE_NETWORK',
  /** 超时。 */
  TIMEOUT: 'ERR_SHARE_TIMEOUT',
  /** HTTP 状态码非 2xx。 */
  HTTP: 'ERR_SHARE_HTTP',
  /** 响应不是合法 JSON。 */
  NOT_JSON: 'ERR_SHARE_NOT_JSON',
  /** 信封 code / data.biz_code 非 0（如分享不存在）。 */
  BUSINESS: 'ERR_SHARE_BUSINESS',
});

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 完整分享 URL 或省略协议的站点链接；要求开头有边界，避免误匹配 xxxdeepseek.com。
const SHARE_URL_RE =
  /(?:^|[^A-Za-z0-9.-])((?:https?:\/\/)?(?:www\.)?(?:chat\.)?deepseek\.com\/share\/([A-Za-z0-9_-]+))/i;
// 仅 "share/<id>" 形态（可出现在句子里，要求前面是行首/空白/常见标点，避免误匹配别的站点 URL）。
const SHARE_PATH_RE = /(?:^|[\s("'“”‘’（【《<:：])share\/([A-Za-z0-9_-]+)/i;
// 裸 share id。
const BARE_SHARE_ID_RE = /^[A-Za-z0-9_-]+$/;
// 需要抽取正文的片段类型；其余（THINK/TOOL_*/TIP/FILE 等）一律跳过。
const TEXT_FRAGMENT_TYPES = new Set(['REQUEST', 'RESPONSE', 'TEMPLATE_RESPONSE']);

/**
 * 从用户粘贴内容中识别 DeepSeek 分享链接。
 * @param {string} text
 * @returns {{kind:'share', shareId:string, url:string}
 *   | {kind:'text', text:string}
 *   | {kind:'invalid', reason:string}}
 */
export function parseShareInput(text) {
  if (typeof text !== 'string') {
    return invalidInput('输入不是字符串文本');
  }
  const value = text.trim();
  if (!value) {
    return invalidInput('输入为空');
  }

  const urlMatch = value.match(SHARE_URL_RE);
  if (urlMatch) {
    return shareInput(urlMatch[2]);
  }
  const pathMatch = value.match(SHARE_PATH_RE);
  if (pathMatch) {
    return shareInput(pathMatch[1]);
  }
  if (BARE_SHARE_ID_RE.test(value)) {
    return shareInput(value);
  }
  if (value.length >= MIN_TEXT_LENGTH) {
    return { kind: 'text', text: value };
  }
  return invalidInput(
    `无法识别的输入：既不是 DeepSeek 分享链接，也不足 ${MIN_TEXT_LENGTH} 个字符`,
  );
}

/**
 * 抓取并解析一个 DeepSeek 分享。
 * @param {string} shareId share id（也宽容地接受分享 URL / "share/<id>"）
 * @param {{fetchImpl?:Function, timeoutMs?:number}} [options]
 * @returns {Promise<{shareId:string, url:string, title:string,
 *   modelType:string|null, messages:Array<{role:'user'|'assistant', text:string}>,
 *   markdown:string, stats:{total:number,user:number,assistant:number,chars:number}}>}
 */
export async function fetchShare(shareId, options = {}) {
  const id = normalizeShareId(shareId);
  const opts = options && typeof options === 'object' ? options : {};
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw createShareError(
      SHARE_ERROR_CODES.NO_FETCH,
      '当前环境没有可用的 fetch（Node 18+ 自带全局 fetch），请通过 options.fetchImpl 注入',
    );
  }
  const timeoutMs = normalizeTimeout(opts.timeoutMs);
  const requestUrl = `${SHARE_CONTENT_API_URL}?share_id=${encodeURIComponent(id)}`;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;

  let timer = null;
  let timedOut = false;
  const timeoutError = createShareError(
    SHARE_ERROR_CODES.TIMEOUT,
    `抓取分享超时：超过 ${timeoutMs}ms 未完成`,
  );
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      try {
        if (controller) controller.abort();
      } catch {
        /* abort 失败不影响超时语义 */
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    let response;
    try {
      response = await Promise.race([
        Promise.resolve().then(() =>
          fetchImpl(requestUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': BROWSER_USER_AGENT,
            },
            signal: controller ? controller.signal : undefined,
          }),
        ),
        timeoutPromise,
      ]);
    } catch (error) {
      if (timedOut) throw timeoutError;
      throw createShareError(
        SHARE_ERROR_CODES.NETWORK,
        `网络请求失败：${describeError(error)}`,
        error,
      );
    }

    if (!response || typeof response !== 'object') {
      throw createShareError(SHARE_ERROR_CODES.NOT_JSON, '接口没有返回可解析的响应');
    }
    const ok =
      typeof response.ok === 'boolean'
        ? response.ok
        : typeof response.status === 'number'
          ? response.status >= 200 && response.status < 300
          : true;
    if (!ok) {
      const statusText =
        typeof response.statusText === 'string' && response.statusText
          ? ` ${response.statusText}`
          : '';
      const httpError = createShareError(
        SHARE_ERROR_CODES.HTTP,
        `抓取分享失败：HTTP ${response.status ?? '未知'}${statusText}`,
      );
      httpError.status = typeof response.status === 'number' ? response.status : null;
      throw httpError;
    }

    let payload;
    try {
      payload = await Promise.race([readJsonPayload(response), timeoutPromise]);
    } catch (error) {
      if (timedOut) throw timeoutError;
      throw error;
    }

    return normalizeSharePayload(payload, id);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 把 fetchShare 的结果拼成一条可直接作为新任务首条用户消息的中文文本。
 * @param {{title?:string, url?:string, shareId?:string, markdown?:string,
 *   messages?:Array}} share fetchShare 的返回值（也接受同形状对象）
 * @param {{instruction?:string, sourceLabel?:string, maxChars?:number}} [options]
 * @returns {string}
 */
export function buildSeedPrompt(share, options = {}) {
  const source = share && typeof share === 'object' ? share : {};
  const opts = options && typeof options === 'object' ? options : {};

  const title = toNonEmptyString(source.title) || DEFAULT_SHARE_TITLE;
  const url =
    toNonEmptyString(source.url) ||
    (toNonEmptyString(source.shareId) ? shareUrl(toNonEmptyString(source.shareId)) : '');
  const sourceLabel = toNonEmptyString(opts.sourceLabel) || DEFAULT_SOURCE_LABEL;
  const maxChars = normalizeMaxChars(opts.maxChars);

  let markdown = toNonEmptyString(source.markdown);
  if (!markdown) {
    const messages = normalizeMessages(
      Array.isArray(source.messages) ? source.messages : [],
    );
    markdown = renderMarkdown(title, toNonEmptyString(source.shareId), messages);
  }

  const instruction =
    toNonEmptyString(opts.instruction) || buildDefaultInstruction(sourceLabel, url);

  const assemble = (body) =>
    [
      `以下内容来自“${sourceLabel}”的分享对话，请把它作为任务背景。`,
      '',
      `标题：${title}`,
      ...(url ? [`分享链接：${url}`] : []),
      '',
      '--- 对话开始 ---',
      '',
      body,
      '',
      '--- 对话结束 ---',
      '',
      instruction,
    ].join('\n');

  const full = assemble(markdown);
  if (full.length <= maxChars) {
    return full;
  }

  // 优先只截断转录正文，保留标题/链接/任务要求完整。
  const overhead = full.length - markdown.length;
  let budget = maxChars - overhead;
  if (budget >= 200) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = assemble(truncateMiddle(markdown, budget));
      if (candidate.length <= maxChars) {
        return candidate;
      }
      budget -= candidate.length - maxChars;
      if (budget < 120) break;
    }
  }
  // 极端小的 maxChars：兜底直接对整条 prompt 做头尾截断。
  return truncateMiddle(full, maxChars);
}

/* ------------------------------------------------------------------ */
/* 内部实现                                                            */
/* ------------------------------------------------------------------ */

function shareInput(shareId) {
  return { kind: 'share', shareId, url: shareUrl(shareId) };
}

function invalidInput(reason) {
  return { kind: 'invalid', reason };
}

function shareUrl(shareId) {
  return `${SHARE_ORIGIN}/share/${shareId}`;
}

function normalizeShareId(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw createShareError(
      SHARE_ERROR_CODES.INVALID_INPUT,
      '无效的分享 ID：应为非空字符串',
    );
  }
  const value = input.trim();
  const pathMatch = value.match(/(?:share\/)([A-Za-z0-9_-]+)/i);
  const candidate = pathMatch ? pathMatch[1] : value;
  if (!BARE_SHARE_ID_RE.test(candidate)) {
    throw createShareError(
      SHARE_ERROR_CODES.INVALID_INPUT,
      `无效的分享 ID：${JSON.stringify(input)}（仅允许字母、数字、_、-）`,
    );
  }
  return candidate;
}

/**
 * 把真实响应信封解析成对外结构。
 */
function normalizeSharePayload(payload, shareId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createShareError(SHARE_ERROR_CODES.NOT_JSON, '接口返回的 JSON 不是对象');
  }
  if (payload.code !== 0) {
    const msg =
      typeof payload.msg === 'string' && payload.msg.trim()
        ? `：${payload.msg.trim()}`
        : '';
    throw createShareError(
      SHARE_ERROR_CODES.BUSINESS,
      `接口返回错误（code=${payload.code ?? '缺失'}）${msg}`,
    );
  }
  const data = payload.data;
  if (!data || typeof data !== 'object') {
    throw createShareError(SHARE_ERROR_CODES.BUSINESS, '接口返回缺少 data 字段');
  }
  if (data.biz_code !== 0) {
    const bizCode = data.biz_code;
    const bizMsg =
      typeof data.biz_msg === 'string' && data.biz_msg.trim()
        ? data.biz_msg.trim()
        : '未知业务错误';
    const bizError = createShareError(
      SHARE_ERROR_CODES.BUSINESS,
      bizCode === 1
        ? `分享不存在或已失效（biz_code=1）：${bizMsg}`
        : `获取分享失败（biz_code=${bizCode ?? '缺失'}）：${bizMsg}`,
    );
    bizError.bizCode = bizCode ?? null;
    throw bizError;
  }
  const bizData = data.biz_data;
  if (!bizData || typeof bizData !== 'object') {
    throw createShareError(
      SHARE_ERROR_CODES.BUSINESS,
      '分享内容为空或格式异常（缺少 biz_data）',
    );
  }

  const title = toNonEmptyString(bizData.title) || DEFAULT_SHARE_TITLE;
  const modelType = toNonEmptyString(bizData.model_type) || null;
  const messages = normalizeMessages(
    Array.isArray(bizData.messages) ? bizData.messages : [],
  );
  const markdown = renderMarkdown(title, shareId, messages);

  return {
    shareId,
    url: shareUrl(shareId),
    title,
    modelType,
    messages,
    markdown,
    stats: buildStats(messages),
  };
}

/**
 * 将原始 messages 归一化为 [{role,text}]；未知 role / 无正文的消息跳过。
 */
function normalizeMessages(rawMessages) {
  const messages = [];
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== 'object') continue;
    const role = normalizeRole(raw.role);
    if (!role) continue;
    const text = extractMessageText(raw);
    if (!text) continue;
    messages.push({ role, text });
  }
  return messages;
}

function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const value = role.trim().toLowerCase();
  if (value === 'user') return 'user';
  if (value === 'assistant') return 'assistant';
  return null;
}

/**
 * 抽取单条消息正文：优先 fragments 中允许的片段，取不到时回退到
 * message.text / message.content（老形状）。
 */
function extractMessageText(message) {
  const parts = [];
  if (Array.isArray(message.fragments)) {
    for (const fragment of message.fragments) {
      if (!fragment || typeof fragment !== 'object') continue;
      const type = typeof fragment.type === 'string' ? fragment.type.toUpperCase() : '';
      if (!TEXT_FRAGMENT_TYPES.has(type)) continue;
      const text = contentToText(fragment.content);
      if (text) parts.push(text);
    }
  }
  if (parts.length === 0) {
    const fallback = contentToText(message.text) || contentToText(message.content);
    if (fallback) parts.push(fallback);
  }
  return parts.join('\n\n');
}

/**
 * 把字符串 / 内容数组 / {text} 对象统一成正文文本。
 */
function contentToText(value, depth = 0) {
  if (depth > 3) return '';
  if (typeof value === 'string') {
    return value.replace(/\r\n?/g, '\n').trim();
  }
  if (Array.isArray(value)) {
    const parts = [];
    for (const item of value) {
      const text = contentToText(item, depth + 1);
      if (text) parts.push(text);
    }
    return parts.join('\n\n');
  }
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return contentToText(value.text, depth + 1);
    if (typeof value.content === 'string' || Array.isArray(value.content)) {
      return contentToText(value.content, depth + 1);
    }
  }
  return '';
}

/**
 * 生成 markdown 转录："# 标题" + 原始链接 + 若干 "## 用户"/"## DeepSeek" 分节。
 */
function renderMarkdown(title, shareId, messages) {
  const lines = [`# ${title}`, ''];
  const id = toNonEmptyString(shareId);
  if (id) lines.push(`> 原始分享：${shareUrl(id)}`, '');
  if (messages.length === 0) {
    lines.push('（该分享没有可导出的对话内容）');
  } else {
    for (const message of messages) {
      lines.push(message.role === 'user' ? '## 用户' : '## DeepSeek', '', message.text, '');
    }
  }
  return lines.join('\n').trim();
}

function buildStats(messages) {
  let user = 0;
  let assistant = 0;
  let chars = 0;
  for (const message of messages) {
    if (message.role === 'user') user += 1;
    else assistant += 1;
    chars += message.text.length;
  }
  return { total: messages.length, user, assistant, chars };
}

function buildDefaultInstruction(sourceLabel, url) {
  const link = url ? `（原始分享链接：${url}）` : '';
  // 拉丁字母开头的来源标签前留空格，读起来更自然（"在 DeepSeek 网页版里"）。
  const label = /^[A-Za-z]/.test(sourceLabel) ? ` ${sourceLabel}` : sourceLabel;
  return (
    `以上是我在${label}里的一段对话${link}。` +
    '请把这段对话作为任务背景：如果其中已经明确了任务或需求，直接开始执行；' +
    '如果信息不足，先用一两个问题向我确认，再继续。'
  );
}

/**
 * 保留头尾、截断中间的字符串（含 "…（已截断 N 字符）…" 标记）。
 * 返回长度保证 <= maxChars（极端小 maxChars 时可能牺牲标记完整性）。
 */
function truncateMiddle(text, maxChars) {
  const limit = Math.max(1, Math.floor(maxChars));
  if (text.length <= limit) return text;
  const markerFor = (removed) => `\n\n…（已截断 ${removed} 字符）…\n\n`;
  let removed = text.length - 2;
  let marker = markerFor(removed);
  let headLen = 1;
  let tailLen = 1;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const keep = Math.max(2, limit - marker.length);
    headLen = Math.max(1, Math.ceil(keep * 0.6));
    tailLen = Math.max(1, keep - headLen);
    removed = text.length - headLen - tailLen;
    if (removed <= 0) return text;
    const nextMarker = markerFor(removed);
    if (nextMarker.length === marker.length) {
      marker = nextMarker;
      break;
    }
    marker = nextMarker;
  }

  removed = text.length - headLen - tailLen;
  marker = markerFor(removed);
  let overflow = headLen + marker.length + tailLen - limit;
  let guard = 0;
  while (overflow > 0 && (tailLen > 1 || headLen > 1) && guard < 20) {
    guard += 1;
    if (tailLen > 1) {
      tailLen -= Math.min(tailLen - 1, overflow);
    } else {
      headLen -= Math.min(headLen - 1, overflow);
    }
    removed = text.length - headLen - tailLen;
    marker = markerFor(removed);
    overflow = headLen + marker.length + tailLen - limit;
  }

  const result = `${text.slice(0, headLen)}${marker}${text.slice(text.length - tailLen)}`;
  return result.length <= limit ? result : result.slice(0, limit);
}

async function readJsonPayload(response) {
  let raw;
  try {
    if (typeof response.text === 'function') {
      raw = await response.text();
    } else if (typeof response.json === 'function') {
      return await response.json();
    } else {
      throw new Error('响应对象既没有 text() 也没有 json()');
    }
  } catch (error) {
    throw createShareError(
      SHARE_ERROR_CODES.NOT_JSON,
      `读取接口响应失败：${describeError(error)}`,
      error,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createShareError(
      SHARE_ERROR_CODES.NOT_JSON,
      `接口返回不是合法 JSON（前 80 字符：${String(raw).slice(0, 80)}）`,
      error,
    );
  }
}

function createShareError(code, message, cause) {
  const error = new Error(message);
  error.name = 'ShareError';
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function describeError(error) {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message) return error.message;
  return String(error);
}

function toNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeTimeout(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_TIMEOUT_MS;
}

function normalizeMaxChars(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_MAX_PROMPT_CHARS;
}
