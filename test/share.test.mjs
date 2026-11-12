/**
 * src/share.js 的离线单元测试（node:test + node:assert/strict）。
 *
 * 运行（Node v24 下 --test 的位置参数是 glob，不再接受目录）：
 *   node --test "test/*.test.mjs"
 * 或：
 *   node --test test/share.test.mjs
 *   node test/share.test.mjs
 *
 * 全部测试通过注入 fake fetchImpl 运行，不联网。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  parseShareInput,
  fetchShare,
  buildSeedPrompt,
  SHARE_ERROR_CODES,
  DEFAULT_SHARE_TITLE,
} from '../src/share.js';

/* ------------------------------------------------------------------ */
/* 测试辅助                                                            */
/* ------------------------------------------------------------------ */

const SHARE_ID = 'syntheticShareId01';
const SHARE_URL = `https://chat.deepseek.com/share/${SHARE_ID}`;
const API_URL = `https://chat.deepseek.com/api/v0/share/content?share_id=${SHARE_ID}`;

const fixtureRaw = readFileSync(
  new URL('../fixtures/share-sample.json', import.meta.url),
  'utf8',
);
const fixtureEnvelope = JSON.parse(fixtureRaw);

/** 构造一个最小可用的 Response 替身。 */
function makeResponse(body, { status = 200, ok = true, statusText = 'OK' } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    statusText,
    async text() {
      return raw;
    },
  };
}

/** 返回固定信封的 fake fetch，并记录调用参数。 */
function captureFetch(envelope, responseOptions) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return makeResponse(envelope, responseOptions);
  };
  return { impl, calls };
}

/** 用真实 fixture 抓取一次，供多个测试复用。 */
const fixtureShare = await fetchShare(SHARE_ID, {
  fetchImpl: async () => makeResponse(fixtureRaw),
});

/* ------------------------------------------------------------------ */
/* parseShareInput                                                     */
/* ------------------------------------------------------------------ */

test('parseShareInput: 完整 URL 各种形态都返回 share', () => {
  const expected = { kind: 'share', shareId: SHARE_ID, url: SHARE_URL };
  const inputs = [
    'https://chat.deepseek.com/share/syntheticShareId01',
    'http://chat.deepseek.com/share/syntheticShareId01',
    '  https://chat.deepseek.com/share/syntheticShareId01  ',
    'https://chat.deepseek.com/share/syntheticShareId01?from=app&foo=bar',
    'https://chat.deepseek.com/share/syntheticShareId01#bottom',
    'https://chat.deepseek.com/share/syntheticShareId01?from=app#bottom',
    'https://www.chat.deepseek.com/share/syntheticShareId01',
    'https://chat.deepseek.com/share/syntheticShareId01/',
    'chat.deepseek.com/share/syntheticShareId01',
  ];
  for (const input of inputs) {
    assert.deepEqual(parseShareInput(input), expected, `输入：${JSON.stringify(input)}`);
  }
});

test('parseShareInput: 链接出现在句子中间也能识别', () => {
  assert.deepEqual(
    parseShareInput(`帮我看看 ${SHARE_URL} 这个对话，然后总结一下`),
    { kind: 'share', shareId: SHARE_ID, url: SHARE_URL },
  );
  assert.deepEqual(
    parseShareInput(`请看${SHARE_URL}。`),
    { kind: 'share', shareId: SHARE_ID, url: SHARE_URL },
  );
});

test('parseShareInput: 仅 share/<id> 形态', () => {
  assert.deepEqual(parseShareInput(`share/${SHARE_ID}`), {
    kind: 'share',
    shareId: SHARE_ID,
    url: SHARE_URL,
  });
  assert.deepEqual(parseShareInput(`请打开 share/${SHARE_ID} 这个链接`), {
    kind: 'share',
    shareId: SHARE_ID,
    url: SHARE_URL,
  });
  assert.equal(parseShareInput('share/abc-123_X').shareId, 'abc-123_X');
});

test('parseShareInput: 裸 share id', () => {
  assert.deepEqual(parseShareInput(SHARE_ID), {
    kind: 'share',
    shareId: SHARE_ID,
    url: SHARE_URL,
  });
  assert.equal(parseShareInput('abc-123_X').shareId, 'abc-123_X');
  assert.equal(parseShareInput(`  ${SHARE_ID}  `).shareId, SHARE_ID);
});

test('parseShareInput: 非链接但足够长的文本返回 text', () => {
  const longText = '这是一段普通的长文本，'.repeat(5); // 50 字符
  assert.deepEqual(parseShareInput(longText), { kind: 'text', text: longText });
  assert.deepEqual(parseShareInput(`  ${longText}  `), {
    kind: 'text',
    text: longText,
  });
});

test('parseShareInput: 40 字符文本边界', () => {
  assert.equal(parseShareInput('字'.repeat(39)).kind, 'invalid');
  assert.equal(parseShareInput('字'.repeat(40)).kind, 'text');
});

test('parseShareInput: 非法/空输入返回 invalid 且带 reason', () => {
  const inputs = ['', '   ', '你好', 'http://example.com/share/abc', null, undefined, 123, {}];
  for (const input of inputs) {
    const result = parseShareInput(input);
    assert.equal(result.kind, 'invalid', `输入：${JSON.stringify(input)}`);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0);
  }
});

test('parseShareInput: 长文本里带分享链接时优先返回 share', () => {
  const text = `背景：${'这是一段很长的背景说明。'.repeat(10)}\n链接：${SHARE_URL}\n请分析。`;
  assert.deepEqual(parseShareInput(text), {
    kind: 'share',
    shareId: SHARE_ID,
    url: SHARE_URL,
  });
});

/* ------------------------------------------------------------------ */
/* fetchShare                                                          */
/* ------------------------------------------------------------------ */

test('fetchShare: 解析真实 fixture', async () => {
  const { impl, calls } = captureFetch(fixtureEnvelope);
  const share = await fetchShare(SHARE_ID, { fetchImpl: impl });

  // 请求参数
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, API_URL);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.match(calls[0].init.headers['User-Agent'], /Mozilla\/5\.0/);
  assert.ok(calls[0].init.signal instanceof AbortSignal);

  // 元信息与结构
  assert.equal(share.shareId, SHARE_ID);
  assert.equal(share.url, SHARE_URL);
  assert.equal(share.title, 'Shared Conversation');
  assert.equal(share.modelType, 'default');
  assert.equal(share.messages.length, 4);
  assert.deepEqual(
    share.messages.map((message) => message.role),
    ['user', 'assistant', 'user', 'assistant'],
  );
  assert.deepEqual(share.stats, {
    total: 4,
    user: 2,
    assistant: 2,
    chars: share.messages.reduce((sum, message) => sum + message.text.length, 0),
  });
  assert.ok(share.stats.chars > 800, `chars=${share.stats.chars}`);

  // markdown
  assert.ok(share.markdown.startsWith('# Shared Conversation'));
  assert.ok(share.markdown.includes(`> 原始分享：${SHARE_URL}`));
  // 只统计渲染器生成的行首分节标题（正文里也可能出现 "#### DeepSeek ..."）。
  assert.equal((share.markdown.match(/^## 用户$/gm) || []).length, 2);
  assert.equal((share.markdown.match(/^## DeepSeek$/gm) || []).length, 2);
  assert.ok(
    share.markdown.includes(
      '我想规划一次城市周末短途旅行',
    ),
  );
  assert.ok(share.messages[1].text.includes('近郊徒步'));
  assert.ok(share.messages[3].text.includes('带一个 6 岁孩子'));

  // 跳过片段（THINK / TOOL_SEARCH / TOOL_OPEN / TIP）的正文不应出现
  assert.ok(!share.markdown.includes('内部推理'), '不应包含 THINK 内容');
  assert.ok(!share.markdown.includes('内部推理第二段'), '不应包含 THINK 内容');
  assert.ok(!share.markdown.includes('Found 12 web pages'), '不应包含 TOOL_SEARCH 内容');
  assert.ok(!share.markdown.includes('This response is AI-generated'), '不应包含 TIP 内容');
});

test('fetchShare: 兼容老形状 message.content（字符串与数组）', async () => {
  const envelope = {
    code: 0,
    msg: '',
    data: {
      biz_code: 0,
      biz_msg: '',
      biz_data: {
        title: '旧版分享',
        model_type: 'chat',
        messages: [
          { role: 'USER', content: '旧版用户问题' },
          {
            role: 'ASSISTANT',
            content: [
              { type: 'text', text: '旧版助手回答 A' },
              { type: 'text', text: '旧版助手回答 B' },
            ],
          },
        ],
      },
    },
  };
  const share = await fetchShare(SHARE_ID, {
    fetchImpl: async () => makeResponse(envelope),
  });
  assert.equal(share.title, '旧版分享');
  assert.equal(share.modelType, 'chat');
  assert.deepEqual(share.messages, [
    { role: 'user', text: '旧版用户问题' },
    { role: 'assistant', text: '旧版助手回答 A\n\n旧版助手回答 B' },
  ]);
  assert.equal(share.stats.total, 2);
  assert.ok(share.markdown.includes('## 用户'));
  assert.ok(share.markdown.includes('## DeepSeek'));
});

test('fetchShare: 片段类型过滤、多 RESPONSE 空行连接、顺序保留', async () => {
  const envelope = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        title: '片段测试',
        messages: [
          {
            role: 'USER',
            fragments: [
              { type: 'FILE', content: '附件不该出现' },
              { type: 'REQUEST', content: '用户提问' },
            ],
          },
          {
            role: 'ASSISTANT',
            fragments: [
              { type: 'THINK', content: '思考不该出现' },
              { type: 'RESPONSE', content: '第一段正文' },
              { type: 'TOOL_SEARCH', content: '搜索不该出现' },
              { type: 'TOOL_OPEN', result: '打开不该出现' },
              { type: 'TEMPLATE_RESPONSE', content: '第二段正文' },
              { type: 'TIP', content: '免责声明不该出现' },
            ],
          },
        ],
      },
    },
  };
  const share = await fetchShare(SHARE_ID, {
    fetchImpl: async () => makeResponse(envelope),
  });
  assert.deepEqual(share.messages, [
    { role: 'user', text: '用户提问' },
    { role: 'assistant', text: '第一段正文\n\n第二段正文' },
  ]);
  const transcript = share.markdown;
  assert.ok(!transcript.includes('不该出现'));
  assert.ok(transcript.indexOf('第一段正文') < transcript.indexOf('第二段正文'));
});

test('fetchShare: 未知 role 跳过，小写 role 兼容', async () => {
  const envelope = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        messages: [
          { role: 'USER', fragments: [{ type: 'REQUEST', content: '用户 A' }] },
          { role: 'SYSTEM', fragments: [{ type: 'RESPONSE', content: '系统消息不应出现' }] },
          { role: 'assistant', fragments: [{ type: 'RESPONSE', content: '助手 B' }] },
          { role: 'user', fragments: [{ type: 'REQUEST', content: '用户 C' }] },
        ],
      },
    },
  };
  const share = await fetchShare(SHARE_ID, {
    fetchImpl: async () => makeResponse(envelope),
  });
  assert.deepEqual(
    share.messages.map((message) => message.role),
    ['user', 'assistant', 'user'],
  );
  assert.ok(!share.markdown.includes('系统消息不应出现'));
  assert.equal(share.stats.total, 3);
});

test('fetchShare: 空 messages 与缺失 title/model_type 的边界', async () => {
  const envelope = { code: 0, data: { biz_code: 0, biz_data: { messages: [] } } };
  const share = await fetchShare(SHARE_ID, {
    fetchImpl: async () => makeResponse(envelope),
  });
  assert.equal(share.title, DEFAULT_SHARE_TITLE);
  assert.equal(share.modelType, null);
  assert.deepEqual(share.messages, []);
  assert.deepEqual(share.stats, { total: 0, user: 0, assistant: 0, chars: 0 });
  assert.ok(share.markdown.includes(DEFAULT_SHARE_TITLE));
  assert.ok(share.markdown.includes('（该分享没有可导出的对话内容）'));
});

test('fetchShare: biz_code=1（分享不存在）抛 BUSINESS 并带上 biz_msg', async () => {
  const envelope = {
    code: 0,
    msg: '',
    data: { biz_code: 1, biz_msg: 'share does not exist', biz_data: null },
  };
  await assert.rejects(
    fetchShare(SHARE_ID, { fetchImpl: async () => makeResponse(envelope) }),
    (error) => {
      assert.equal(error.code, SHARE_ERROR_CODES.BUSINESS);
      assert.match(error.message, /share does not exist/);
      assert.equal(error.bizCode, 1);
      return true;
    },
  );
});

test('fetchShare: 顶层 code != 0 抛 BUSINESS', async () => {
  const envelope = { code: 3, msg: '接口异常', data: null };
  await assert.rejects(
    fetchShare(SHARE_ID, { fetchImpl: async () => makeResponse(envelope) }),
    (error) => {
      assert.equal(error.code, SHARE_ERROR_CODES.BUSINESS);
      assert.match(error.message, /code=3/);
      return true;
    },
  );
});

test('fetchShare: 缺失 data / biz_data 抛 BUSINESS', async () => {
  await assert.rejects(
    fetchShare(SHARE_ID, {
      fetchImpl: async () => makeResponse({ code: 0 }),
    }),
    { code: SHARE_ERROR_CODES.BUSINESS },
  );
  await assert.rejects(
    fetchShare(SHARE_ID, {
      fetchImpl: async () =>
        makeResponse({ code: 0, data: { biz_code: 0, biz_msg: '', biz_data: null } }),
    }),
    { code: SHARE_ERROR_CODES.BUSINESS },
  );
});

test('fetchShare: HTTP 非 2xx 抛 HTTP 并带 status', async () => {
  const fake = async () =>
    makeResponse('', { ok: false, status: 500, statusText: 'Internal Server Error' });
  await assert.rejects(fetchShare(SHARE_ID, { fetchImpl: fake }), (error) => {
    assert.equal(error.code, SHARE_ERROR_CODES.HTTP);
    assert.equal(error.status, 500);
    assert.match(error.message, /HTTP 500/);
    return true;
  });
});

test('fetchShare: 非 JSON 响应抛 NOT_JSON', async () => {
  const fake = async () => makeResponse('<!doctype html><html>not json</html>');
  await assert.rejects(fetchShare(SHARE_ID, { fetchImpl: fake }), {
    code: SHARE_ERROR_CODES.NOT_JSON,
  });
});

test('fetchShare: 网络错误抛 NETWORK 并保留 cause', async () => {
  const fake = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(fetchShare(SHARE_ID, { fetchImpl: fake }), (error) => {
    assert.equal(error.code, SHARE_ERROR_CODES.NETWORK);
    assert.match(error.message, /fetch failed/);
    assert.ok(error.cause instanceof TypeError);
    return true;
  });
});

test('fetchShare: 超时抛 TIMEOUT（fake fetch 永不 resolve）', async () => {
  const fake = () => new Promise(() => {});
  const startedAt = Date.now();
  await assert.rejects(
    fetchShare(SHARE_ID, { fetchImpl: fake, timeoutMs: 30 }),
    { code: SHARE_ERROR_CODES.TIMEOUT },
  );
  assert.ok(Date.now() - startedAt < 2000);
});

test('fetchShare: 响应体读取超时同样抛 TIMEOUT', async () => {
  const fake = async () => ({
    ok: true,
    status: 200,
    async text() {
      return new Promise(() => {});
    },
  });
  await assert.rejects(
    fetchShare(SHARE_ID, { fetchImpl: fake, timeoutMs: 30 }),
    { code: SHARE_ERROR_CODES.TIMEOUT },
  );
});

test('fetchShare: 非法 share id / 非函数 fetchImpl 被拒绝', async () => {
  for (const badId of ['not a valid id', '', '   ', null, undefined, 42]) {
    await assert.rejects(
      fetchShare(badId, { fetchImpl: async () => makeResponse(fixtureEnvelope) }),
      { code: SHARE_ERROR_CODES.INVALID_INPUT },
      `输入：${JSON.stringify(badId)}`,
    );
  }
  await assert.rejects(fetchShare(SHARE_ID, { fetchImpl: 'not-a-function' }), {
    code: SHARE_ERROR_CODES.NO_FETCH,
  });
});

test('fetchShare: 宽容接受分享 URL 作为入参', async () => {
  const { impl } = captureFetch(fixtureEnvelope);
  const share = await fetchShare(SHARE_URL, { fetchImpl: impl });
  assert.equal(share.shareId, SHARE_ID);
  assert.equal(share.url, SHARE_URL);
});

test('fetchShare: 支持只有 json() 的 Response 替身', async () => {
  const fake = async () => ({
    ok: true,
    status: 200,
    async json() {
      return fixtureEnvelope;
    },
  });
  const share = await fetchShare(SHARE_ID, { fetchImpl: fake });
  assert.equal(share.title, 'Shared Conversation');
  assert.equal(share.messages.length, 4);
});

/* ------------------------------------------------------------------ */
/* buildSeedPrompt                                                     */
/* ------------------------------------------------------------------ */

test('buildSeedPrompt: 默认结构（标题/链接/对话分隔/任务要求）', () => {
  const prompt = buildSeedPrompt(fixtureShare);
  assert.ok(prompt.startsWith('以下内容来自“DeepSeek 网页版”的分享对话'));
  assert.ok(prompt.includes('标题：Shared Conversation'));
  assert.ok(prompt.includes(`分享链接：${SHARE_URL}`));
  assert.ok(prompt.includes('--- 对话开始 ---'));
  assert.ok(prompt.includes('--- 对话结束 ---'));
  assert.ok(prompt.includes('# Shared Conversation'));
  assert.ok(prompt.includes('## 用户'));
  assert.ok(prompt.includes('## DeepSeek'));
  assert.ok(
    prompt.includes(
      `以上是我在 DeepSeek 网页版里的一段对话（原始分享链接：${SHARE_URL}）。`,
    ),
  );
  assert.ok(prompt.includes('请把这段对话作为任务背景'));
  assert.ok(prompt.includes('如果信息不足，先用一两个问题向我确认，再继续。'));
  assert.ok(!prompt.includes('已截断'));
  assert.ok(prompt.length > fixtureShare.markdown.length);
  assert.ok(prompt.endsWith('再继续。'));
});

test('buildSeedPrompt: 自定义 instruction 覆盖默认任务要求', () => {
  const instruction = '请只总结三条关键结论。';
  const prompt = buildSeedPrompt(fixtureShare, { instruction });
  assert.ok(prompt.endsWith(instruction));
  assert.ok(!prompt.includes('请把这段对话作为任务背景'));
});

test('buildSeedPrompt: 自定义 sourceLabel 出现在开头说明中', () => {
  const prompt = buildSeedPrompt(fixtureShare, { sourceLabel: '微信收藏' });
  assert.ok(prompt.includes('“微信收藏”'));
  assert.ok(prompt.includes('以上是我在微信收藏里的一段对话'));
});

test('buildSeedPrompt: 超长截断保留头尾并带截断标记', () => {
  const maxChars = 600;
  const prompt = buildSeedPrompt(fixtureShare, { maxChars });
  assert.ok(prompt.length <= maxChars, `prompt.length=${prompt.length}`);
  assert.match(prompt, /…（已截断 \d+ 字符）…/);
  // 头部（标题/链接/正文开头）与尾部（正文结尾/任务要求）都保留
  assert.ok(prompt.includes('标题：Shared Conversation'));
  assert.ok(prompt.includes(`分享链接：${SHARE_URL}`));
  assert.ok(prompt.includes('--- 对话开始 ---'));
  assert.ok(prompt.includes('--- 对话结束 ---'));
  assert.ok(prompt.includes('请把这段对话作为任务背景'));
  assert.ok(prompt.includes('# Shared Conversation'));
  assert.ok(prompt.includes(fixtureShare.markdown.slice(0, 60)));
  assert.ok(prompt.includes(fixtureShare.markdown.slice(-40)));
});

test('buildSeedPrompt: 默认 maxChars 很大时不截断', () => {
  const prompt = buildSeedPrompt(fixtureShare);
  assert.ok(prompt.includes(fixtureShare.markdown));
  assert.ok(!prompt.includes('已截断'));
});

test('buildSeedPrompt: 极端小的 maxChars 也保证长度上限', () => {
  const prompt = buildSeedPrompt(fixtureShare, { maxChars: 120 });
  assert.ok(prompt.length <= 120, `prompt.length=${prompt.length}`);
  assert.ok(prompt.length > 0);
});

test('buildSeedPrompt: 缺少 url 时用 shareId 补全', () => {
  const prompt = buildSeedPrompt({
    title: '无链接对象',
    shareId: SHARE_ID,
    markdown: '# 正文\n\n内容',
  });
  assert.ok(prompt.includes(`分享链接：${SHARE_URL}`));
  assert.ok(prompt.includes('无链接对象'));
});

test('buildSeedPrompt: share 只有 messages 时回退生成 markdown', () => {
  const prompt = buildSeedPrompt({
    title: '回退测试',
    shareId: SHARE_ID,
    messages: [
      { role: 'user', text: '你好，帮我写点东西' },
      { role: 'assistant', text: '好的，请告诉我主题' },
    ],
  });
  assert.ok(prompt.includes('# 回退测试'));
  assert.ok(prompt.includes('## 用户'));
  assert.ok(prompt.includes('你好，帮我写点东西'));
  assert.ok(prompt.includes('## DeepSeek'));
  assert.ok(prompt.includes('好的，请告诉我主题'));
});

test('buildSeedPrompt: 空 share 也能生成带默认标题的 prompt', () => {
  const prompt = buildSeedPrompt({});
  assert.ok(prompt.includes(`标题：${DEFAULT_SHARE_TITLE}`));
  assert.ok(prompt.includes('（该分享没有可导出的对话内容）'));
  assert.ok(!prompt.includes('分享链接：'));
  assert.ok(prompt.includes('请把这段对话作为任务背景'));
});
