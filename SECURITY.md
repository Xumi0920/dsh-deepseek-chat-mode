# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[Security Advisories](https://github.com/Xumi0920/dsh-deepseek-chat-mode/security/advisories/new)
for this repository. Do not open a public issue for an unpatched vulnerability.

This is a personal open-source project maintained on a best-effort basis.

## What this plugin does with data

- **Public share links.** The Host half calls the public DeepSeek endpoint
  `GET https://chat.deepseek.com/api/v0/share/content?share_id=<id>` to read a
  conversation someone deliberately shared. No DeepSeek account credentials are
  used for this request, and nothing is stored on disk.
- **In-chat handoff.** When you press the handoff button, the client half asks the
  embedded official browser view to read the currently rendered conversation text
  and sends that text to the local Host route, which creates a DSH task. The text
  becomes part of that task's first message (stored by your DSH profile like any
  other session message).
- **Local state.** Only two small preferences are kept in `localStorage`:
  the optional task instruction and the browser tab id of the embedded chat page
  (per Session). No analytics, no telemetry, no remote logging.
- **Local HTTP routes.** The plugin registers same-origin JSON routes on the local
  DSH web server. They reject requests that do not look like they come from the
  DSH page (Origin / Sec-Fetch-Site / Host checks). A local process able to forge
  those headers could create tasks, which is equivalent to privileges it already
  has on the machine.

## Trust boundary

This plugin runs with the same privileges as the DSH process that loads it. It
does not escalate privileges, shell out to external programs, or read files
outside its own package.

## Dependency on internal DeepSeek web interfaces

Reading a share link uses an internal (public, unauthenticated) web endpoint, and
the in-chat handoff reads the rendered page. Both may change without notice when
DeepSeek updates its website; this is a reliability risk, not a security bypass.
