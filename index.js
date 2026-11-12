/**
 * DeepSeek web chat bridge — Host half.
 *
 * Answers a question the browser cannot: chat.deepseek.com is a public but
 * cross-origin service, so the page half can never fetch a share link itself.
 * This half owns:
 *   · POST /dsh-deepseek-chat-mode/resolve      — fetch + normalize one share link
 *   · POST /dsh-deepseek-chat-mode/create-task  — create a real DSH task seeded
 *                                              with that conversation and send
 *                                              its first message
 *   · the `deepseek_share_import` tool       — the same fetch, callable by the
 *                                              model inside any session
 *
 * The whole bridge only ever reads public share links; it holds no DeepSeek
 * account credentials and stores nothing on disk.
 */

import { randomUUID } from 'node:crypto'
import { parseShareInput, fetchShare, buildSeedPrompt } from './src/share.js'

const PACKAGE_ID = '@xumi0920/dsh-deepseek-chat-mode'
const ROUTE_BASE = '/dsh-deepseek-chat-mode'
const MAX_BODY_BYTES = 4 * 1024 * 1024
const CREATE_TIMEOUT_MS = 30_000

/**
 * Bounded in-memory ledger of diagnostics the page half reports (which UI
 * pieces actually mounted). Read through GET /dsh-deepseek-chat-mode/client-events
 * while the browser cannot be inspected directly; nothing is persisted.
 */
const clientEvents = []

/** Failure with a stable machine code the page half renders verbatim. */
class BridgeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
  }
}

/** Never let a logging sink or a probe throw out of a route handler. */
function safeLog(ctx, level, message) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger(PACKAGE_ID) : ctx.logger
    if (logger && typeof logger[level] === 'function') logger[level](message)
    else console.warn(`[${PACKAGE_ID}] ${message}`)
  } catch {
    /* ignore */
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        resolve({ ok: false, reason: 'too-large' })
        try {
          req.destroy()
        } catch {
          /* ignore */
        }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve({ ok: true, text: Buffer.concat(chunks).toString('utf8') })
    })
    req.on('error', () => resolve({ ok: false, reason: 'read-error' }))
  })
}

function sendJson(res, status, value) {
  const payload = JSON.stringify(value)
  try {
    if (typeof res.writeHead === 'function') {
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(payload),
      })
      res.end(payload)
    } else if (typeof res.end === 'function') {
      res.end(payload)
    }
  } catch {
    /* the response may already be gone */
  }
}

/**
 * Same-origin gate. The page half talks to this route from the DSH Web UI;
 * a browser always attaches Origin (POST) or Sec-Fetch-Site. A non-browser
 * local caller can fake those headers, so this gate only protects against
 * cross-site pages — acceptable because the route can only *add* tasks and
 * reads a service the user already trusts (see README security notes).
 */
function isSameOriginRequest(req, origin) {
  try {
    const headers = req.headers || {}
    const requestOrigin = headers.origin
    if (requestOrigin) return requestOrigin === origin
    const site = headers['sec-fetch-site']
    if (site) return site === 'same-origin'
    const host = headers.host
    if (!host) return false
    const expectedHost = new URL(origin).host
    return host === expectedHost
  } catch {
    return false
  }
}

function safeTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/** One conversation imported as raw pasted text (no share link). */
function synthesizeTextShare(text) {
  const body = String(text || '').trim()
  const messages = [{ role: 'user', text: body }]
  return {
    shareId: '',
    url: '',
    title: '粘贴的对话',
    modelType: '',
    messages,
    markdown: body,
    stats: { total: 1, user: 1, assistant: 0, chars: body.length },
  }
}

async function resolveInput(input) {
  const parsed = parseShareInput(typeof input === 'string' ? input : '')
  if (!parsed || parsed.kind === 'invalid') {
    throw new BridgeError(
      'invalid-input',
      parsed && parsed.reason ? parsed.reason : '没有识别到 DeepSeek 分享链接，也没有足够长的对话正文。',
    )
  }
  if (parsed.kind === 'text') {
    return { kind: 'text', share: synthesizeTextShare(parsed.text) }
  }
  // A bare token is accepted as a share id by the parser; short words are far
  // more likely to be a typo than a real id, so answer with a readable hint.
  const raw = typeof input === 'string' ? input.trim() : ''
  if (/^[A-Za-z0-9_-]+$/.test(raw) && raw.length < 8) {
    throw new BridgeError(
      'invalid-input',
      '这看起来不是一个 DeepSeek 分享链接。请粘贴形如 https://chat.deepseek.com/share/xxxx 的链接，或整段对话正文。',
    )
  }
  const share = await fetchShare(parsed.shareId)
  return { kind: 'share', share }
}

/** Reduced shape sent to the page — never the whole raw payload. */
function summarizeShare(share) {
  const messages = Array.isArray(share.messages) ? share.messages : []
  const firstUser = messages.find((message) => message.role === 'user')
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const clip = (text, max) => {
    const value = String(text || '')
    return value.length > max ? `${value.slice(0, max)}…` : value
  }
  return {
    shareId: share.shareId || '',
    url: share.url || '',
    title: share.title || 'DeepSeek 分享对话',
    modelType: share.modelType || '',
    stats: share.stats || {
      total: messages.length,
      user: messages.filter((message) => message.role === 'user').length,
      assistant: messages.filter((message) => message.role === 'assistant').length,
      chars: messages.reduce((sum, message) => sum + String(message.text || '').length, 0),
    },
    preview: {
      firstUser: firstUser ? clip(firstUser.text, 400) : '',
      lastAssistant: lastAssistant ? clip(lastAssistant.text, 400) : '',
    },
  }
}

/** Resolve one workspace by directory, so a new task lands where the user is. */
async function resolveWorkspaceId(ctx, workspaceId, cwd) {
  if (typeof workspaceId === 'string' && workspaceId) return workspaceId
  if (!cwd) return undefined
  let registry
  try {
    registry = ctx.get('workspaceRegistry')
  } catch {
    registry = undefined
  }
  if (!registry) return undefined
  try {
    if (typeof registry.resolveByPath === 'function') {
      const workspace = await registry.resolveByPath(cwd)
      if (workspace && typeof workspace.id === 'string') return workspace.id
    }
  } catch {
    /* fall through to the list scan */
  }
  try {
    const list = typeof registry.list === 'function' ? registry.list() : []
    const wanted = String(cwd).replace(/\\+/g, '\\').toLowerCase()
    const match = (Array.isArray(list) ? list : []).find(
      (workspace) => String((workspace && workspace.path) || '').replace(/\\+/g, '\\').toLowerCase() === wanted,
    )
    if (match && typeof match.id === 'string') return match.id
  } catch {
    /* ignore */
  }
  return undefined
}

/** A last-resort directory when the page could not report a current one. */
function defaultCwd(ctx) {
  try {
    const directory = ctx.get('workingDirectory')
    if (directory && typeof directory.defaultDirectory === 'string') return directory.defaultDirectory
  } catch {
    /* ignore */
  }
  return undefined
}

/**
 * Create a durable DSH session through the same Host controller the Web UI's
 * "New Session" uses, then send the seeded first message through the same
 * prompt admission the composer uses. Both calls are the documented Remote
 * surface of `sessionController`; nothing here bypasses authorization.
 */
async function createTask(ctx, { kind, share, instruction, cwd, workspaceId, agentPreset }) {
  const seed = buildSeedPrompt(share, {
    instruction,
    sourceLabel: kind === 'share' ? undefined : '（从剪贴板粘贴的对话正文）',
  })
  const controller = ctx.get('sessionController')
  if (!controller || typeof controller.create !== 'function' || typeof controller.prompt !== 'function') {
    throw new BridgeError(
      'unavailable',
      '当前环境没有可用的 sessionController，无法新建任务。请升级/重启 DSH 后重试。',
    )
  }

  const effectiveCwd = typeof cwd === 'string' && cwd ? cwd : defaultCwd(ctx)
  const effectiveWorkspaceId = await resolveWorkspaceId(ctx, workspaceId, effectiveCwd)

  // session.create accepts a workspace id OR a directory, never both: the
  // workspace locates the session so `cwd` is redundant (and rejected).
  const createRequest = { agentPreset: typeof agentPreset === 'string' && agentPreset ? agentPreset : undefined }
  if (effectiveWorkspaceId) createRequest.workspaceId = effectiveWorkspaceId
  else if (effectiveCwd) createRequest.cwd = effectiveCwd

  let created
  try {
    created = await controller.create(createRequest)
  } catch (error) {
    throw new BridgeError('create-failed', `新建任务失败：${String((error && error.message) || error)}`)
  }

  const sessionId = created && created.sessionId
  if (!sessionId) throw new BridgeError('create-failed', '新建任务失败：宿主没有返回会话 id。')

  const request = {
    requestId: randomUUID(),
    sessionId,
    mode: 'queue',
    content: [{ type: 'text', text: seed }],
    clientTimeZone: safeTimeZone(),
  }
  try {
    await controller.prompt(request, AbortSignal.timeout(CREATE_TIMEOUT_MS))
  } catch (error) {
    throw new BridgeError(
      'prompt-failed',
      `任务已创建（${sessionId}），但首条消息注入失败：${String((error && error.message) || error)}`,
    )
  }

  return { sessionId, kind, workspaceId: effectiveWorkspaceId || '' }
}

/** Agent-facing import: fetch a share link and return its transcript. */
function registerImportTool(ctx, config) {
  let tools
  try {
    tools = ctx.get('tools')
  } catch {
    tools = undefined
  }
  if (!tools || typeof tools.register !== 'function') return

  const definition = {
    name: 'deepseek_share_import',
    description:
      'Fetch a public DeepSeek web chat share link (https://chat.deepseek.com/share/<id>) and return the conversation as Markdown, ready to use as task context.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'DeepSeek share link or bare share id.',
        },
        instruction: {
          type: 'string',
          description: 'Optional note appended after the transcript telling the agent what to do with it.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const input = args && typeof args.url === 'string' ? args.url : ''
      const resolved = await resolveInput(input)
      const seed = buildSeedPrompt(resolved.share, { instruction: args && args.instruction })
      const signal = (exec && exec.signal) || AbortSignal.timeout(CREATE_TIMEOUT_MS)
      if (signal && signal.aborted) throw new Error('aborted')
      return seed
    },
  }

  try {
    const dispose = tools.register(definition)
    if (typeof dispose === 'function') {
      ctx.effect(() => () => {
        try {
          dispose()
        } catch {
          /* ignore */
        }
      })
    }
  } catch (error) {
    safeLog(ctx, 'warn', `deepseek_share_import tool not registered: ${String((error && error.message) || error)}`)
  }
}

/**
 * Register the two same-origin JSON routes the page half calls.
 * One operation per function above keeps the UI path and the tool path on the
 * same core (`resolveInput`), so failures read the same everywhere.
 */
function registerRoutes(ctx) {
  let web
  try {
    web = ctx.get('webServer')
  } catch {
    web = undefined
  }
  if (!web || typeof web.register !== 'function') {
    safeLog(ctx, 'warn', 'webServer unavailable; the page half will fall back to client-side creation')
    return
  }

  let origin = ''
  try {
    origin = web.getOrigin()
  } catch {
    origin = ''
  }

  const disposers = []

  const jsonRoute = (path, handle) => {
    const dispose = web.register({
      kind: 'exact',
      path,
      handler: async (req, res) => {
        try {
          if ((req.method || 'GET').toUpperCase() !== 'POST') {
            sendJson(res, 405, { ok: false, error: { code: 'method', message: '只接受 POST。' } })
            return
          }
          if (origin && !isSameOriginRequest(req, origin)) {
            sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: '只接受来自 DSH 页面的同源请求。' } })
            return
          }
          const body = await readBody(req)
          if (!body.ok) {
            sendJson(res, 413, { ok: false, error: { code: body.reason, message: '请求体过大或读取失败。' } })
            return
          }
          let payload = null
          try {
            payload = body.text ? JSON.parse(body.text) : {}
          } catch {
            sendJson(res, 400, { ok: false, error: { code: 'bad-json', message: '请求体不是合法 JSON。' } })
            return
          }
          const result = await handle(payload || {})
          sendJson(res, 200, { ok: true, ...result })
        } catch (error) {
          const rawCode = typeof (error && error.code) === 'string' ? error.code : ''
          const code = error instanceof BridgeError ? error.code : rawCode.startsWith('ERR_SHARE_') ? 'share-error' : 'internal'
          const message = String((error && error.message) || error)
          safeLog(ctx, 'warn', `route ${path} failed: ${message}`)
          sendJson(res, 200, { ok: false, error: { code, message } })
        }
      },
    })
    disposers.push(dispose)
  }

  jsonRoute(`${ROUTE_BASE}/resolve`, async (payload) => {
    const resolved = await resolveInput(payload && payload.input)
    return { kind: resolved.kind, share: summarizeShare(resolved.share) }
  })

  jsonRoute(`${ROUTE_BASE}/create-task`, async (payload) => {
    const resolved = await resolveInput(payload && payload.input)
    const created = await createTask(ctx, {
      kind: resolved.kind,
      share: resolved.share,
      instruction: payload && typeof payload.instruction === 'string' ? payload.instruction : undefined,
      cwd: payload && typeof payload.cwd === 'string' ? payload.cwd : undefined,
      workspaceId: payload && typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined,
      agentPreset: payload && typeof payload.agentPreset === 'string' ? payload.agentPreset : undefined,
    })
    return { ...created, share: summarizeShare(resolved.share) }
  })

  jsonRoute(`${ROUTE_BASE}/client-event`, async (payload) => {
    const event = payload && typeof payload.event === 'string' ? payload.event.slice(0, 120) : 'unknown'
    const detail = payload && typeof payload.detail === 'string' ? payload.detail.slice(0, 400) : undefined
    clientEvents.push({ event, detail, at: Date.now() })
    if (clientEvents.length > 100) clientEvents.splice(0, clientEvents.length - 100)
    return { recorded: true }
  })

  const disposeEvents = web.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/client-events`,
    handler: async (req, res) => {
      try {
        if ((req.method || 'GET').toUpperCase() !== 'GET') {
          sendJson(res, 405, { ok: false, error: { code: 'method', message: '只接受 GET。' } })
          return
        }
        if (origin && !isSameOriginRequest(req, origin)) {
          sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: '只接受同源请求。' } })
          return
        }
        sendJson(res, 200, { ok: true, events: clientEvents.slice(-40) })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: { code: 'internal', message: String((error && error.message) || error) } })
      }
    },
  })
  disposers.push(disposeEvents)

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
  })
}

export function apply(ctx, config) {
  const settings = config && typeof config === 'object' ? config : {}
  try {
    registerRoutes(ctx)
  } catch (error) {
    safeLog(ctx, 'warn', `routes not registered: ${String((error && error.message) || error)}`)
  }
  try {
    registerImportTool(ctx, settings)
  } catch (error) {
    safeLog(ctx, 'warn', `import tool not registered: ${String((error && error.message) || error)}`)
  }
}

export const inject = []
