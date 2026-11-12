# Changelog

## 0.7.0 — first public release

Initial open-source release of the DeepSeek Chat mode for DeepSeek Harness.

- **Chat ⇄ Work switch in the sidebar brand area**: clicking the brand (official
  whale mark + `DeepSeek` lettering + `Harness` badge) opens the DeepSeek web chat
  full-screen; in chat mode the mark, lettering and badge turn DeepSeek blue and
  the badge reads `Chat`.
- **Full-screen embedded chat** through the official right-sidebar browser tab;
  the browser tab is remembered per Session and reused instead of opening a new
  page on every click.
- **One-click handoff**: a floating bar over the chat reads the current
  conversation and creates a new DSH task whose first message is that
  conversation, then opens the task.
- **Share-link import**: paste a public `chat.deepseek.com/share/...` link (or a
  whole conversation) and create a task seeded with it.
- **`deepseek_share_import` agent tool**: returns a normalized Markdown transcript
  for any public DeepSeek share link.
- Official brand artwork is embedded with attribution (see
  `THIRD_PARTY_NOTICES.md`); the bundled fixture is synthetic test data.
- 34 offline unit tests; diagnostics endpoint for UI mount verification.
