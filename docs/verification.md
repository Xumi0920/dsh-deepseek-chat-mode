# Verification

This page records how the plugin is verified without relying on screenshots.
For UI changes, please also check the manual checklist at the bottom.

## Automated checks

```bash
npm test
```

- 34 offline unit tests (`node:test`), no network and no DSH required:
  - share-link parsing (URL / `share/<id>` / bare id / long text / invalid input);
  - share fetch against a synthetic fixture, including the API envelope
    (`code` / `data.biz_code`), fragment filtering (`THINK`, `TOOL_*`, `TIP`,
    `FILE`), message ordering, legacy `message.content` shapes and empty shares;
  - error classification: `INVALID_INPUT`, `NO_FETCH`, `NETWORK`, `TIMEOUT`,
    `HTTP`, `NOT_JSON`, `BUSINESS`;
  - seed-prompt assembly, truncation and fallbacks;
  - a client-half smoke test: bundle loader id, `apply()` slot registrations and
    locale registration.

CI runs the suite on Node 22 and 24 (`.github/workflows/test.yml`).

## Live smoke (optional, network)

```bash
node test/live.mjs https://chat.deepseek.com/share/<id>
# or
DEEPSEEK_SHARE_URL=https://chat.deepseek.com/share/<id> node test/live.mjs
```

Prints the normalized transcript stats and the seed prompt length. The real share
link is provided by the user; no link is committed to the repository.

## Client mount diagnostics

The client half reports lightweight mount events to the Host (in-memory, bounded,
no conversation content). Read them from the local DSH origin:

```bash
curl http://127.0.0.1:<dsh-port>/dsh-deepseek-chat-mode/client-events
```

Expected events after a page load: `client-apply`, `brand-registered`,
`brand-mark-registered`, `brand-mounted`, `brand-mark-mounted`, `pill-mounted`.
Mode changes add `chat-state` and `brand-paint` events with
`expanded`/`fullscreen`/class/color details.

## Manual checklist (UI)

Requires DSH Desktop profile.

- [ ] Left sidebar brand shows whale mark + `DeepSeek` + black `Harness` badge.
- [ ] Clicking it opens `chat.deepseek.com` full-screen; brand turns DeepSeek blue
      with a blue `Chat` badge.
- [ ] Clicking it again collapses the chat and restores the black `Harness` state.
- [ ] Clicking several times reuses the same chat tab (no duplicate pages).
- [ ] Floating bar over the chat shows three actions
      (`用这段对话新建 DSH 任务` / `分享链接导入` / `收起`).
- [ ] Handoff creates a new DSH task whose first message contains the conversation,
      then opens that task.
- [ ] `分享链接导入` reads the clipboard share link, previews it and creates a task.
- [ ] Light and dark themes render the brand switch correctly.
- [ ] No slot-entry crash appears in the browser console.

## Known verification limits

- The in-chat handoff reads rendered page text (virtual list), so a very long
  conversation may be partially captured. Prefer the share-link path when the
  transcript must be complete and reproducible.
- The embedded browser follows the official right-sidebar browser's lease and
  login-state rules; after an app restart the web chat may need a fresh sign-in.
