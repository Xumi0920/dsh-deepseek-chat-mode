# Contributing

Thanks for taking a look! This is a small DSH plugin with zero runtime
dependencies; the contribution workflow is intentionally light.

## Development

Requirements: Node.js 22+ (the plugin itself runs inside DSH, but the tests are
plain Node).

```bash
git clone https://github.com/Xumi0920/dsh-deepseek-chat-mode.git
cd dsh-deepseek-chat-mode
npm test            # offline unit tests (node:test)
npm run test:live   # optional: real network smoke test, needs a share link
```

`npm test` must stay fully offline. Node 22+ accepts glob patterns as `--test`
positional arguments; the script quotes `"test/*.test.mjs"` so the shell does
not expand it.

## Project layout

| Path | What it is |
| --- | --- |
| `index.js` | Host half: share fetch, task creation, tool, same-origin routes, client diagnostics |
| `client.js` | Client half: sidebar brand switch, full-screen chat, handoff pill, import dialog |
| `src/share.js` | Share-link parsing, fetch, Markdown transcript, seed prompt (zero dependencies) |
| `test/` | Offline unit tests and the optional live smoke script |
| `fixtures/` | Synthetic share payload used by the tests |

## Pull requests

- Keep the client half dependency-free (plain JS, no build step).
- New UI should use DSH theme tokens; brand artwork may use its own color.
- Add or update tests for parser/behavior changes; run `npm test`.
- If you touch the Host routes, keep the same-origin checks intact.
- Do not add telemetry, analytics, or remote calls other than the documented
  DeepSeek share endpoint.
- For visual changes, please include a screenshot or a short description of the
  before/after state in light and dark themes.

## Reporting issues

When reporting a rendering or handoff bug, include: DSH version, Desktop or Web
profile, the browser tab state (open/closed), and any console error text. The
plugin records lightweight mount diagnostics that can be read at
`GET /dsh-deepseek-chat-mode/client-events` on the local DSH origin; feel free
to include that output (it contains no conversation content).

