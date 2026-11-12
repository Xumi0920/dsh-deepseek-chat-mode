/**
 * Client-half smoke test: loads client.js with a stubbed module loader and a
 * stubbed Cordis context, then asserts the three slot registrations and the
 * plugin contract. It does not render React (rendering is verified live in DSH).
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const MODULE_ID = '@xumi0920/dsh-deepseek-chat-mode'

function fakeReact() {
  return {
    createElement: (...args) => ({ type: 'element', args }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
  }
}

async function loadClientModule() {
  let definition = null
  globalThis.window = {
    __ModuleLoader__: {
      load: (def) => {
        definition = def
      },
    },
    open: () => null,
    localStorage: null,
  }
  // Node 24 defines `navigator` as a getter on globalThis; replace the
  // property instead of assigning to it.
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-CN' },
    configurable: true,
    writable: true,
  })
  globalThis.document = {
    head: { appendChild: () => {} },
    body: null,
    documentElement: null,
    createElement: () => ({ setAttribute: () => {}, remove: () => {}, textContent: '' }),
    addEventListener: () => {},
    removeEventListener: () => {},
  }

  await import(`./../client.js?smoke=${Date.now()}`)
  assert.ok(definition, 'client.js must call window.__ModuleLoader__.load')
  assert.equal(definition.id, MODULE_ID)
  const exportsObject = definition.factory((name) => {
    assert.equal(name, 'react')
    return fakeReact()
  })
  return exportsObject
}

test('client bundle registers the expected slots and exposes apply', async () => {
  const clientModule = await loadClientModule()
  assert.equal(typeof clientModule.apply, 'function')
  assert.deepEqual([...clientModule.inject].sort(), ['locale', 'slots'])

  const registrations = []
  const injections = []
  const disposers = []
  const fakeCtx = {
    get(name) {
      if (name === 'locale') {
        return {
          register: (ns, dicts) => {
            assert.equal(ns, 'deepseek-chat-mode')
            assert.ok(dicts.zh && dicts.en, 'both locales must be registered')
            return () => {}
          },
          bind: () => (key) => key,
        }
      }
      return undefined
    },
    effect(fn) {
      try {
        const dispose = fn()
        if (typeof dispose === 'function') disposers.push(dispose)
        return dispose
      } catch {
        return () => {}
      }
    },
    slots: {
      inject(slot, callback) {
        injections.push(slot)
        callback()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  clientModule.apply(fakeCtx)
  for (const dispose of disposers) {
    try {
      dispose()
    } catch {
      /* ignore */
    }
  }
  assert.deepEqual(injections, [
    'shell.overlay',
    'conversation.input.overlay',
    'sidebar.brand.name',
    'sidebar.brand.mark',
    'shell.overlay',
  ])
  assert.equal(registrations.length, 5)
  const ids = registrations.map((row) => row.options.id || row.options.name)
  assert.deepEqual(ids, [
    'deepseek-chat-mode-dialog',
    'deepseek-chat-mode-session-probe',
    'sidebar.brand.name',
    'sidebar.brand.mark',
    'deepseek-chat-mode-chat-pill',
  ])
  for (const row of registrations) {
    assert.equal(typeof row.component, 'function')
  }
})
