/**
 * DeepSeek web chat bridge — Client half (plain-JS bundle, no build step).
 *
 * User flow it implements:
 *   1. click the sidebar-footer entry (or paste a link anywhere in the dialog);
 *   2. the dialog reads the clipboard, recognizes a chat.deepseek.com share
 *      link and asks the Host half to normalize it (the page cannot fetch a
 *      cross-origin share link itself);
 *   3. one click creates a real DSH task whose first message is the imported
 *      conversation + a task instruction, then opens that task.
 *
 * The bundle registers four things:
 *   · sidebar.footer.action            — the persistent entry point
 *   · shell.overlay                    — the dialog (frame-wide overlay)
 *   · conversation.input.overlay       — a hidden probe that records the
 *                                        current session id (renders null)
 *
 * Only documented Host services are probed at click time via ctx.get(); no
 * service is named in `inject` beyond `slots`/`locale`, so the bundle stays
 * inert in profiles where a service is absent instead of stalling the boot.
 */

window.__ModuleLoader__.load({
  id: '@xumi0920/dsh-deepseek-chat-mode',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'deepseek-chat-mode'
    const PACKAGE_ID = '@xumi0920/dsh-deepseek-chat-mode'
    const HOST_BASE = '/dsh-deepseek-chat-mode'
    const CHAT_URL = 'https://chat.deepseek.com/'
    /** DeepSeek brand blue for the chat-mode nameplate (brand artwork owns its color). */
    const DEEPSEEK_BLUE = '#4d6bfe'
    const SHARE_HINT = /chat\.deepseek\.com\/share\//i
    const STORE_KEY = 'dsh-deepseek-chat-mode:instruction'
    const PLUGIN_CTX_KEY = '__DSH_DEEPSEEK_CHAT_MODE_CTX__'

    /**
     * Official DeepSeek brand artwork (MIT), copied from the installed
     * `@deepseek-ai/dsh-client-ui-primitives` package: the whale silhouette and
     * the "DeepSeek" glyph paths. A plain-JS client bundle must not import the
     * primitives package, so the geometry is embedded here and recolored with
     * `currentColor` (black in workspace mode, brand blue in chat mode).
     */
    const BRAND_ART = {"fishViewBox":{"width":23.16,"height":17.04},"fishPath":"M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z","deepSeekPaths":["M68.416 18.2447H67.0501V16.1272H68.416C69.2619 16.1272 70.1166 15.9163 70.6671 15.3304C71.2181 14.7444 71.426 13.8455 71.426 12.9471C71.426 12.0487 71.2268 11.1498 70.6671 10.5643C70.1083 9.97831 69.2619 9.76744 68.416 9.76744C67.5701 9.76744 66.7154 9.97831 66.1639 10.5643C65.6129 11.1503 65.4049 12.0487 65.4049 12.9471V21.6435H63.009V7.6582H65.4049V8.54883H65.8442C65.8918 8.49393 65.9394 8.44728 65.9875 8.40064C66.5871 7.85353 67.5049 7.6582 68.4072 7.6582C69.8212 7.6582 71.2341 8.00998 72.1607 8.98662C73.0868 9.96325 73.4143 11.4632 73.4143 12.9558C73.4143 14.4485 73.0785 15.9406 72.1607 16.925C71.2424 17.9094 69.8212 18.2457 68.416 18.2457V18.2447Z","M31.9551 8.03497H33.3204V10.1525H31.9551C31.1087 10.1525 30.2545 10.3633 29.7035 10.9493C29.1525 11.5353 28.945 12.4342 28.945 13.3326C28.945 14.231 29.1447 15.1294 29.7035 15.7154C30.2623 16.3014 31.1087 16.5122 31.9551 16.5122C32.8015 16.5122 33.6562 16.3014 34.2072 15.7154C34.7582 15.1294 34.9657 14.231 34.9657 13.3326V4.62842H37.3611V18.6219H34.9657V17.7313H34.5264C34.4783 17.7857 34.4307 17.8329 34.3826 17.8795C33.7835 18.4261 32.8652 18.6219 31.9629 18.6219C30.5494 18.6219 29.136 18.2707 28.2099 17.294C27.2838 16.3174 26.9563 14.817 26.9563 13.3248C26.9563 11.8327 27.2916 10.34 28.2099 9.35561C29.136 8.37898 30.5494 8.03497 31.9551 8.03497Z","M49.3786 13.1431V13.9948H42.9984V12.2996H47.2305C47.1348 11.6825 46.9113 11.1043 46.5119 10.682C45.9371 10.0727 45.0503 9.85409 44.1723 9.85409C43.2943 9.85409 42.4076 10.0727 41.8328 10.682C41.258 11.2913 41.05 12.2213 41.05 13.1435C41.05 14.0658 41.2575 15.003 41.8328 15.6046C42.4076 16.2061 43.2939 16.433 44.1723 16.433C45.0508 16.433 45.9371 16.2143 46.5119 15.6046C46.5916 15.5186 46.6635 15.4248 46.7354 15.331H49.0992C48.8918 16.0657 48.5643 16.7299 48.0691 17.2454C47.111 18.2531 45.6339 18.6205 44.1723 18.6205C42.7108 18.6205 41.2337 18.2609 40.2755 17.2454C39.3174 16.2299 38.9661 14.6828 38.9661 13.1435C38.9661 11.6043 39.3096 10.0494 40.2755 9.04168C41.242 8.03396 42.7108 7.66663 44.1723 7.66663C45.6339 7.66663 47.111 8.02618 48.0691 9.04168C49.0351 10.0572 49.3786 11.6043 49.3786 13.1435V13.1431Z","M61.4045 13.1431V13.9948H55.0243V12.2996H59.2564C59.1602 11.6825 58.9372 11.1043 58.5378 10.682C57.963 10.0727 57.0762 9.85409 56.1982 9.85409C55.3202 9.85409 54.4335 10.0727 53.8587 10.682C53.2839 11.2913 53.0759 12.2213 53.0759 13.1435C53.0759 14.0658 53.2834 15.003 53.8587 15.6046C54.4335 16.2061 55.3202 16.433 56.1982 16.433C57.0762 16.433 57.963 16.2143 58.5378 15.6046C58.6179 15.5186 58.6894 15.4248 58.7608 15.331H61.1251C60.9171 16.0657 60.5897 16.7299 60.0945 17.2454C59.1364 18.2531 57.6593 18.6205 56.1982 18.6205C54.7372 18.6205 53.2596 18.2609 52.3014 17.2454C51.3432 16.2299 50.9919 14.6828 50.9919 13.1435C50.9919 11.6043 51.3355 10.0494 52.3014 9.04168C53.2678 8.03396 54.7367 7.66663 56.1982 7.66663C57.6598 7.66663 59.1364 8.02618 60.0945 9.04168C61.061 10.0572 61.4045 11.6043 61.4045 13.1435V13.1431Z","M80.242 18.6214C81.7035 18.6214 83.1801 18.4105 84.1383 17.809C85.0965 17.2075 85.4482 16.2931 85.4482 15.3869C85.4482 14.4807 85.1042 13.5585 84.1383 12.9647C83.1801 12.371 81.703 12.1518 80.242 12.1518C79.6186 12.1518 79.0438 12.0658 78.6366 11.8394C78.2294 11.6047 78.0778 11.2534 78.0778 10.9017C78.0778 10.5499 78.2216 10.1908 78.6366 9.9639C79.0438 9.72921 79.6749 9.65147 80.2973 9.65147C80.9198 9.65147 81.5509 9.73747 81.9591 9.9639C82.3663 10.1986 82.5179 10.5499 82.5179 10.9017H84.9531C84.9531 9.99499 84.6421 9.07327 83.7719 8.47951C82.9017 7.88576 81.5679 7.66663 80.2424 7.66663C78.9169 7.66663 77.5837 7.8775 76.713 8.47951C75.8427 9.08104 75.5308 9.99499 75.5308 10.9017C75.5308 11.8083 75.8423 12.73 76.713 13.3238C77.5832 13.9176 78.9165 14.1367 80.2424 14.1367C80.929 14.1367 81.688 14.2227 82.1428 14.4491C82.5985 14.676 82.7579 15.0351 82.7579 15.3869C82.7579 15.7387 82.5985 16.0977 82.1428 16.3246C81.688 16.5511 80.9931 16.6371 80.3066 16.6371C79.62 16.6371 78.9169 16.5511 78.4694 16.3246C78.0224 16.0982 77.8543 15.7387 77.8543 15.3869H75.0435C75.0435 16.2935 75.3865 17.2153 76.3534 17.809C77.3194 18.4028 78.7809 18.6214 80.2424 18.6214H80.242Z","M97.4733 13.1431V13.9948H91.0932V12.2996H95.3252C95.23 11.6825 95.006 11.1043 94.6071 10.682C94.0313 10.0727 93.1456 9.85409 92.2666 9.85409C91.3876 9.85409 90.5018 10.0727 89.927 10.682C89.3522 11.2913 89.1452 12.2213 89.1452 13.1435C89.1452 14.0658 89.3522 15.003 89.927 15.6046C90.5018 16.2061 91.3886 16.433 92.2666 16.433C93.1446 16.433 94.0313 16.2143 94.6071 15.6046C94.6863 15.5186 94.7587 15.4248 94.8301 15.331H97.1935C96.9855 16.0657 96.6585 16.7299 96.1639 17.2454C95.2057 18.2531 93.7281 18.6205 92.2666 18.6205C90.805 18.6205 89.3284 18.2609 88.3703 17.2454C87.4121 16.2299 87.0613 14.6828 87.0613 13.1435C87.0613 11.6043 87.4043 10.0494 88.3703 9.04168C89.3367 8.03396 90.806 7.66663 92.2666 7.66663C93.7272 7.66663 95.2057 8.02618 96.1639 9.04168C97.1298 10.0572 97.4729 11.6043 97.4729 13.1435L97.4733 13.1431Z","M109.499 13.1431V13.9948H103.119V12.2996H107.351C107.256 11.6825 107.032 11.1043 106.632 10.682C106.057 10.0727 105.172 9.85409 104.293 9.85409C103.414 9.85409 102.528 10.0727 101.953 10.682C101.378 11.2913 101.17 12.2213 101.17 13.1435C101.17 14.0658 101.378 15.003 101.953 15.6046C102.528 16.2061 103.415 16.433 104.293 16.433C105.171 16.433 106.057 16.2143 106.632 15.6046C106.712 15.5186 106.784 15.4248 106.856 15.331H109.22C109.012 16.0657 108.685 16.7299 108.19 17.2454C107.231 18.2531 105.754 18.6205 104.293 18.6205C102.831 18.6205 101.355 18.2609 100.396 17.2454C99.4382 16.2299 99.0864 14.6828 99.0864 13.1435C99.0864 11.6043 99.4295 10.0494 100.396 9.04168C101.362 8.03396 102.832 7.66663 104.293 7.66663C105.754 7.66663 107.231 8.02618 108.19 9.04168C109.156 10.0572 109.499 11.6043 109.499 13.1435V13.1431Z","M113.5 4.62817H111.104V18.6217H113.5V4.62817Z","M117.589 12.8154L121.517 18.6208H118.554L114.625 12.8154L118.554 8.15088H121.517L117.589 12.8154Z"]}

    /* ------------------------------------------------------------------ */
    /* i18n                                                                */
    /* ------------------------------------------------------------------ */

    const MESSAGES = {
      zh: {
        'entry.label': 'DeepSeek 网页对话',
        'entry.aria': '从 DeepSeek 网页对话新建任务',
        'entry.title': '把 DeepSeek 网页版对话变成 DSH 任务',
        'dialog.title': '从网页对话新建任务',
        'dialog.subtitle': '粘贴 DeepSeek 网页版的分享链接（或整段对话），一键创建任务并开始执行。',
        'field.input': '分享链接或对话正文',
        'field.input.placeholder': 'https://chat.deepseek.com/share/…',
        'field.instruction': '任务指令（可选）',
        'field.instruction.placeholder': '默认：把这段对话作为任务背景，如果其中已经明确了任务，直接开始执行。',
        'action.clipboard': '读取剪贴板',
        'action.preview': '预览对话',
        'action.create': '创建任务并开始',
        'action.creating': '正在创建…',
        'action.openChat': '打开 DeepSeek 网页版',
        'action.openChatHint': '在右侧栏或系统浏览器打开，先聊出要交接的对话',
        'action.close': '关闭',
        'status.resolving': '正在读取分享对话…',
        'status.clipboard': '已从剪贴板读取',
        'status.created': '任务已创建，正在打开…',
        'status.openPending': '任务已创建（{sessionId}），但页面目录尚未同步；请关闭弹窗后在侧边栏打开该任务。',
        'status.error': '失败：{message}',
        'meta.messages': '共 {count} 条消息（用户 {user} / DeepSeek {assistant}）',
        'meta.workspace': '创建位置：{path}',
        'meta.kindText': '来源：粘贴的对话正文',
        'meta.kindShare': '来源：DeepSeek 分享链接',
        'preview.firstUser': '第一条提问',
        'preview.lastAssistant': '最近回答',
        'preview.empty': '（空对话）',
        'hint.needInput': '先粘贴一个分享链接，或一段对话正文。',
        'hint.noPort': '宿主接口不可用，无法创建任务。请重启 DSH 后再试。',
        'hint.noCwd': '未识别到当前工作目录，任务将创建在默认工作区。',
        'hint.creatingFallback': '宿主新建失败，正在改用页面侧创建…',
        'fallback.unavailable': '页面侧也没有可用的会话创建接口。',
        'fallback.failed': '页面侧创建失败：{message}',
        'error.http': '请求失败（HTTP {status}）。',
        'error.notJson': '宿主返回的内容不是 JSON。',
        'brand.name': 'DeepSeek Harness',
        'brand.badgeWork': 'Harness',
        'brand.badgeChat': 'Chat',
        'brand.enter': '打开 DeepSeek 网页对话（全屏切换）',
        'brand.leave': '收起 DeepSeek 网页对话，返回工作台',
        'brand.workspace': '返回工作台',
        'pill.hint': 'DeepSeek 网页对话',
        'pill.create': '用这段对话新建 DSH 任务',
        'pill.reading': '正在读取对话…',
        'pill.back': '收起',
        'pill.share': '分享链接导入',
        'pill.instruction':
          '这段对话由 DSH 从 DeepSeek 网页版页面自动抓取（可能混有少量界面文字）。请把它作为任务背景：如果其中已经明确了任务或需求，直接开始执行；如果信息不足，先用一两个问题向我确认。',
        'pill.readFailed':
          '没读到网页版对话正文：请确认页面里已经打开一段对话，或先在网页版点「分享」→「复制链接」，再用侧边栏底部的导入入口。',
        'chat.noSidebar': '当前环境没有可用的右侧栏浏览器，无法内嵌 DeepSeek 网页版。',
        'chat.openFailed': '打开内嵌网页失败：{message}',
      },
      en: {
        'entry.label': 'DeepSeek web chat',
        'entry.aria': 'Start a task from a DeepSeek web chat',
        'entry.title': 'Turn a DeepSeek web chat into a DSH task',
        'dialog.title': 'New task from a web chat',
        'dialog.subtitle':
          'Paste a DeepSeek share link (or a whole conversation), create a task, and start it in one click.',
        'field.input': 'Share link or conversation text',
        'field.input.placeholder': 'https://chat.deepseek.com/share/…',
        'field.instruction': 'Task instruction (optional)',
        'field.instruction.placeholder':
          'Default: use this conversation as context and start executing any task it already states.',
        'action.clipboard': 'Read clipboard',
        'action.preview': 'Preview conversation',
        'action.create': 'Create task and start',
        'action.creating': 'Creating…',
        'action.openChat': 'Open DeepSeek web chat',
        'action.openChatHint': 'Open it in the right sidebar or the system browser first',
        'action.close': 'Close',
        'status.resolving': 'Reading the shared conversation…',
        'status.clipboard': 'Read from clipboard',
        'status.created': 'Task created, opening…',
        'status.openPending':
          'The task was created ({sessionId}) but the page catalogue has not synced yet; close this dialog and open it from the sidebar.',
        'status.error': 'Failed: {message}',
        'meta.messages': '{count} messages ({user} user / {assistant} assistant)',
        'meta.workspace': 'Location: {path}',
        'meta.kindText': 'Source: pasted conversation text',
        'meta.kindShare': 'Source: DeepSeek share link',
        'preview.firstUser': 'First question',
        'preview.lastAssistant': 'Latest answer',
        'preview.empty': '(empty conversation)',
        'hint.needInput': 'Paste a share link or a conversation first.',
        'hint.noPort': 'The Host endpoint is unavailable, so no task can be created. Restart DSH and retry.',
        'hint.noCwd': 'No current directory detected; the task will use the default workspace.',
        'hint.creatingFallback': 'Host creation failed; creating from the page instead…',
        'fallback.unavailable': 'The page half has no usable session-creation API either.',
        'fallback.failed': 'Page-side creation failed: {message}',
        'error.http': 'Request failed (HTTP {status}).',
        'error.notJson': 'The Host returned a non-JSON response.',
        'brand.name': 'DeepSeek Harness',
        'brand.badgeWork': 'Harness',
        'brand.badgeChat': 'Chat',
        'brand.enter': 'Open DeepSeek web chat (full-screen switch)',
        'brand.leave': 'Close DeepSeek web chat and return to the workspace',
        'brand.workspace': 'Back to workspace',
        'pill.hint': 'DeepSeek web chat',
        'pill.create': 'Create a DSH task from this chat',
        'pill.reading': 'Reading the conversation…',
        'pill.back': 'Hide',
        'pill.share': 'Import a share link',
        'pill.instruction':
          'This conversation was scraped by DSH from the DeepSeek web page (a few UI labels may be mixed in). Use it as task context: start executing any task it already states; if information is missing, ask me one or two questions first.',
        'pill.readFailed':
          'Could not read the web chat transcript. Make sure a conversation is open in the page, or use Share → Copy link and the sidebar import entry.',
        'chat.noSidebar': 'The right-sidebar browser is unavailable in this environment, so the DeepSeek web page cannot be embedded.',
        'chat.openFailed': 'Could not open the embedded page: {message}',
      },
    }

    function fallbackLocale() {
      try {
        const lang = (navigator && navigator.language) || 'zh'
        return String(lang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      } catch {
        return 'zh'
      }
    }

    let translate = null

    function format(template, params) {
      if (typeof template !== 'string') return ''
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (_match, key) => {
        const value = params[key]
        return value === undefined || value === null ? '' : String(value)
      })
    }

    function tr(key, params) {
      try {
        if (typeof translate === 'function') {
          const value = translate(key, params)
          if (typeof value === 'string' && value && value !== key) return value
        }
      } catch {
        /* fall through to the local dictionary */
      }
      const locale = fallbackLocale()
      const dict = MESSAGES[locale] || MESSAGES.zh
      const template = dict[key] || MESSAGES.zh[key] || key
      return format(template, params)
    }

    /* ------------------------------------------------------------------ */
    /* Module state store                                                  */
    /* ------------------------------------------------------------------ */

    const listeners = new Set()

    const store = {
      open: false,
      input: '',
      instruction: '',
      phase: 'idle', // idle | resolving | ready | creating | error
      preview: null, // { kind, share: { title, url, stats, preview } }
      error: '',
      note: '',
      lastCreated: '',
    }

    let pluginContext = null
    let currentSessionId = null
    let autoTimer = null
    let clipboardCache = { text: '', at: 0 }
    let createInFlight = false
    let instructionLoaded = false

    function loadInstruction() {
      if (instructionLoaded) return store.instruction
      instructionLoaded = true
      try {
        const saved = window.localStorage && window.localStorage.getItem(STORE_KEY)
        if (typeof saved === 'string') return saved
      } catch {
        /* ignore */
      }
      return ''
    }

    function persistInstruction(value) {
      try {
        if (window.localStorage) window.localStorage.setItem(STORE_KEY, String(value || ''))
      } catch {
        /* ignore */
      }
    }

    function setState(patch) {
      Object.assign(store, patch)
      for (const listener of listeners) {
        try {
          listener()
        } catch {
          /* ignore */
        }
      }
    }

    function useBridgeState() {
      const [snapshot, setSnapshot] = React.useState(() => ({ ...store }))
      React.useEffect(() => {
        const listener = () => setSnapshot({ ...store })
        listeners.add(listener)
        return () => listeners.delete(listener)
      }, [])
      return snapshot
    }

    /* ------------------------------------------------------------------ */
    /* Host bridge                                                         */
    /* ------------------------------------------------------------------ */

    function describeError(error) {
      if (!error) return 'unknown'
      return String(error.message || error)
    }

    async function postJson(path, body) {
      let response
      try {
        response = await fetch(`${HOST_BASE}${path}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        })
      } catch (error) {
        throw new Error(tr('error.http', { status: '—' }))
      }
      let data = null
      try {
        data = await response.json()
      } catch {
        throw new Error(tr('error.notJson'))
      }
      if (!data || data.ok !== true) {
        const message = (data && data.error && data.error.message) || tr('error.http', { status: response.status })
        const failure = new Error(message)
        failure.code = (data && data.error && data.error.code) || 'unknown'
        throw failure
      }
      return data
    }

    /**
     * Fire-and-forget diagnostics for the Host half. While the app page cannot
     * be inspected visually, the Host can read GET /client-events to learn which
     * UI pieces actually mounted (e.g. whether the brand switch won its slot).
     */
    function reportClientEvent(event, detail) {
      try {
        fetch(`${HOST_BASE}/client-event`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, detail }),
        }).catch(() => {})
      } catch {
        /* diagnostics must never break the UI */
      }
    }

    /* ------------------------------------------------------------------ */
    /* Current session / workspace helpers                                 */
    /* ------------------------------------------------------------------ */

    function currentCwd() {
      try {
        const sessions = pluginContext && pluginContext.get('sessions')
        const state = sessions && sessions.list && sessions.list.getSnapshot ? sessions.list.getSnapshot() : null
        if (!state || !state.ids) return ''
        if (currentSessionId && state.byId && state.byId[currentSessionId]) {
          const own = state.byId[currentSessionId]
          if (own && typeof own.cwd === 'string' && own.cwd) return own.cwd
        }
        let best = null
        for (const id of state.ids) {
          const summary = state.byId && state.byId[id]
          if (!summary || typeof summary.cwd !== 'string' || !summary.cwd) continue
          if (!best || (summary.updatedAt || 0) > (best.updatedAt || 0)) best = summary
        }
        return (best && best.cwd) || ''
      } catch {
        return ''
      }
    }

    function shortPath(path) {
      const text = String(path || '')
      if (!text) return ''
      const parts = text.split(/[\\/]/).filter(Boolean)
      return parts.length ? parts[parts.length - 1] : text
    }

    /* ------------------------------------------------------------------ */
    /* Actions                                                             */
    /* ------------------------------------------------------------------ */

    function readClipboardText() {
      try {
        if (navigator && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
          return navigator.clipboard.readText()
        }
      } catch {
        /* fall through */
      }
      return Promise.reject(new Error('clipboard unavailable'))
    }

    function looksLikeShare(text) {
      return SHARE_HINT.test(String(text || ''))
    }

    function scheduleAutoResolve(text) {
      if (autoTimer) {
        clearTimeout(autoTimer)
        autoTimer = null
      }
      if (!looksLikeShare(text)) return
      autoTimer = setTimeout(() => {
        autoTimer = null
        if (store.open && store.input === text) resolveInput()
      }, 380)
    }

    function setInput(text) {
      const next = String(text == null ? '' : text)
      const patch = { input: next, error: '', note: '' }
      if (next !== store.input) patch.preview = null
      if (store.phase === 'ready' || store.phase === 'error') patch.phase = 'idle'
      setState(patch)
      scheduleAutoResolve(next)
    }

    function setInstruction(text) {
      const next = String(text == null ? '' : text)
      persistInstruction(next)
      setState({ instruction: next })
    }

    async function resolveInput() {
      const input = String(store.input || '').trim()
      if (!input) {
        setState({ phase: 'error', error: tr('hint.needInput') })
        return
      }
      if (store.phase === 'resolving' || store.phase === 'creating') return
      setState({ phase: 'resolving', error: '', note: '' })
      try {
        const data = await postJson('/resolve', { input })
        setState({ phase: 'ready', preview: { kind: data.kind, share: data.share }, error: '' })
      } catch (error) {
        setState({ phase: 'error', error: describeError(error) })
      }
    }

    async function readClipboardIntoInput() {
      try {
        const text = await readClipboardText()
        if (!text) return
        clipboardCache = { text: String(text), at: Date.now() }
        if (!String(store.input || '').trim()) {
          setInput(text)
          setState({ note: tr('status.clipboard') })
        }
      } catch {
        /* clipboard permission is best-effort */
      }
    }

    function openDialog() {
      if (store.open) return
      loadInstruction()
      setState({
        open: true,
        phase: store.phase === 'ready' ? 'ready' : 'idle',
        error: '',
        note: '',
        instruction: store.instruction || '',
      })
      readClipboardIntoInput()
    }

    function closeDialog() {
      if (autoTimer) {
        clearTimeout(autoTimer)
        autoTimer = null
      }
      setState({ open: false, phase: 'idle', error: '', note: '' })
    }

    /* ------------------------------------------------------------------ */
    /* DeepSeek Chat switch (top-left brand) + in-chat task handoff         */
    /* ------------------------------------------------------------------ */

    /**
     * Guest-side transcript scraper for the embedded chat.deepseek.com page.
     * The chat uses a virtual list, so a single innerText read only sees the
     * visible slice: walk the largest scroll container from top to bottom,
     * snapshot the text after each step, then merge unique lines in order.
     */
    const GUEST_SCRAPE_SCRIPT = [
      '(async () => {',
      '  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
      '  const scrollers = [];',
      '  for (const el of document.querySelectorAll("*")) {',
      '    if (!(el instanceof HTMLElement)) continue;',
      '    const style = getComputedStyle(el);',
      '    if (!/(auto|scroll)/.test(style.overflowY)) continue;',
      '    const span = el.scrollHeight - el.clientHeight;',
      '    if (span > 120) scrollers.push({ el, span });',
      '  }',
      '  scrollers.sort((a, b) => b.span - a.span);',
      '  const target = scrollers.length ? scrollers[0].el : null;',
      '  const snapshots = [];',
      '  const grab = () => { const text = document.body.innerText || ""; if (text) snapshots.push(text); };',
      '  if (target === null) { grab(); }',
      '  else {',
      '    const original = target.scrollTop;',
      '    target.scrollTop = 0;',
      '    await sleep(220);',
      '    grab();',
      '    const step = Math.max(240, Math.floor(target.clientHeight * 0.85));',
      '    for (let i = 0; i < 60; i += 1) {',
      '      const before = target.scrollTop;',
      '      target.scrollTop = Math.min(before + step, target.scrollHeight);',
      '      await sleep(240);',
      '      grab();',
      '      if (target.scrollTop === before) break;',
      '      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 4) { await sleep(200); grab(); break; }',
      '    }',
      '    target.scrollTop = original;',
      '  }',
      '  const lines = [];',
      '  const seen = new Set();',
      '  for (const snapshot of snapshots) {',
      '    for (const raw of snapshot.split("\\n")) {',
      '      const line = raw.trim();',
      '      if (line === "" || seen.has(line)) continue;',
      '      seen.add(line);',
      '      lines.push(line);',
      '    }',
      '  }',
      '  return { text: lines.join("\\n"), snapshots: snapshots.length };',
      '})()',
    ].join('\n')

    /**
     * Cross-module shared state. The client bundle can be applied more than once
     * in one page generation (plugin reload / HMR); each module copy would then
     * own a separate flag, so the click handler and the already-mounted brand
     * component could disagree. Keeping watchers and flags on a window singleton
     * makes every copy observe one state.
     */
    const shared = (() => {
      try {
        const host = window
        if (!host.__DSH_DEEPSEEK_CHAT_MODE_SHARED__) {
          host.__DSH_DEEPSEEK_CHAT_MODE_SHARED__ = {
            chatWatchers: new Set(),
            pillWatchers: new Set(),
            chatVisible: false,
            chatTabId: null,
            handoffBusy: false,
            painted: null,
            pillState: { busy: false, error: '' },
          }
        }
        return host.__DSH_DEEPSEEK_CHAT_MODE_SHARED__
      } catch {
        return {
          chatWatchers: new Set(),
          pillWatchers: new Set(),
          chatVisible: false,
          chatTabId: null,
          handoffBusy: false,
          painted: null,
          pillState: { busy: false, error: '' },
        }
      }
    })()

    function watchStore(watchers, read) {
      const [snapshot, setSnapshot] = React.useState(() => read())
      React.useEffect(() => {
        const listener = () => setSnapshot(read())
        watchers.add(listener)
        return () => watchers.delete(listener)
      }, [])
      return snapshot
    }

    /** Paint the switch directly on our own DOM, independent of React/CSS timing. */
    function paintChatMode(visible) {
      const mode = visible ? 'chat' : 'work'
      try {
        const brand = document.querySelector('.dsb-brand')
        if (brand) {
          brand.classList.toggle('dsb-brand--on', !!visible)
          brand.setAttribute('data-mode', mode)
          brand.style.color = visible ? DEEPSEEK_BLUE : ''
          brand.style.background = visible ? 'rgba(77,107,254,0.12)' : ''
        }
        const mark = document.querySelector('.dsb-brand-mark')
        if (mark) {
          mark.classList.toggle('dsb-brand-mark--on', !!visible)
          mark.style.color = visible ? DEEPSEEK_BLUE : ''
        }
        const label = document.querySelector('.dsb-brand-badge')
        if (label) {
          label.setAttribute('data-mode', mode)
          label.style.background = visible ? DEEPSEEK_BLUE : ''
          label.style.color = visible ? '#fff' : ''
        }
        if (brand && shared.painted !== mode) {
          shared.painted = mode
          let computed = ''
          try {
            const style = getComputedStyle(brand)
            const badge = document.querySelector('.dsb-brand-badge')
            computed = JSON.stringify({
              color: style.color,
              ink: style.getPropertyValue('--dsb-ink').trim(),
              cls: brand.className,
              badgeBg: badge ? getComputedStyle(badge).backgroundColor : '',
            })
          } catch {
            computed = ''
          }
          reportClientEvent('brand-paint', `${mode} ${computed}`)
        }
      } catch {
        /* ignore */
      }
    }

    function notifyChat() {
      for (const listener of shared.chatWatchers) {
        try {
          listener()
        } catch {
          /* ignore */
        }
      }
    }

    function setChatVisible(next) {
      const value = !!next
      if (shared.chatVisible === value) {
        paintChatMode(value)
        return
      }
      shared.chatVisible = value
      paintChatMode(value)
      notifyChat()
    }

    function useChatVisible() {
      return watchStore(shared.chatWatchers, () => shared.chatVisible)
    }

    function notifyPill() {
      for (const listener of shared.pillWatchers) {
        try {
          listener()
        } catch {
          /* ignore */
        }
      }
    }

    function setPill(patch) {
      Object.assign(shared.pillState, patch)
      notifyPill()
    }

    function usePillState() {
      return watchStore(shared.pillWatchers, () => ({ ...shared.pillState }))
    }

    function clientService(name) {
      try {
        return pluginContext && typeof pluginContext.get === 'function' ? pluginContext.get(name) : undefined
      } catch {
        return undefined
      }
    }

    function getSidebarRight() {
      return clientService('sidebarRight')
    }

    /* ------------------------------------------------------------------ */
    /* Chat tab bookkeeping: one browser tab per Session, reused on switch */
    /* ------------------------------------------------------------------ */

    function chatTabStorageKey() {
      return 'dsh-deepseek-chat-mode:chat-tab:' + (currentSessionId || 'default')
    }

    function readPersistedChatTab() {
      try {
        if (!window.localStorage) return ''
        return String(window.localStorage.getItem(chatTabStorageKey()) || '')
      } catch {
        return ''
      }
    }

    function persistChatTab(tabId) {
      try {
        if (!window.localStorage) return
        if (tabId) window.localStorage.setItem(chatTabStorageKey(), String(tabId))
        else window.localStorage.removeItem(chatTabStorageKey())
      } catch {
        /* ignore */
      }
    }

    function safeActive(sidebar) {
      try {
        return typeof sidebar.active === 'function' ? sidebar.active() : undefined
      } catch {
        return undefined
      }
    }

    function safeExpanded(sidebar) {
      try {
        return typeof sidebar.isExpanded === 'function' ? sidebar.isExpanded() === true : false
      } catch {
        return false
      }
    }

    /** The official panel exposes its presentation in the DOM; read it instead of blind-toggling. */
    function isRightbarFullscreen() {
      try {
        return !!document.querySelector('[data-sidebar-right-panel="fullscreen"]')
      } catch {
        return false
      }
    }

    function reportChatState(phase, extra) {
      const sidebar = getSidebarRight()
      const active = sidebar ? safeActive(sidebar) : undefined
      let detail
      try {
        detail = JSON.stringify({
          phase,
          tab: shared.chatTabId || '',
          active: active && active.id ? String(active.id) : '',
          kind: active && active.kind ? String(active.kind) : '',
          expanded: sidebar ? safeExpanded(sidebar) : false,
          fullscreen: isRightbarFullscreen(),
          visible: shared.chatVisible,
          ...(extra || {}),
        }).slice(0, 400)
      } catch {
        detail = phase
      }
      reportClientEvent('chat-state', detail)
    }

    /** Dialog "打开网页版" button now opens the full-screen chat switch. */
    function openWebChat() {
      toggleChat()
    }

    function toggleChat() {
      const sidebar = getSidebarRight()
      if (!sidebar || typeof sidebar.openTab !== 'function') {
        showChatUnavailable(tr('chat.noSidebar'))
        return
      }
      if (isChatSurfaceVisible(sidebar)) {
        exitChat(sidebar)
        return
      }
      enterChat(sidebar)
    }

    /** Whether the right column currently shows our embedded chat surface. */
    function isChatSurfaceVisible(sidebar) {
      if (!safeExpanded(sidebar)) return false
      const active = safeActive(sidebar)
      if (!active) return false
      if (shared.chatTabId) return active.id === shared.chatTabId
      return active.kind === 'browser'
    }

    function captureChatTab(sidebar) {
      const active = safeActive(sidebar)
      if (active && active.kind === 'browser' && typeof active.id === 'string') shared.chatTabId = active.id
    }

    function showChatUnavailable(message) {
      reportClientEvent('chat-unavailable', String(message || '').slice(0, 300))
      try {
        openDialog()
        setState({ phase: 'error', error: message })
      } catch {
        /* ignore */
      }
    }

    function enterChat(sidebar) {
      const known = shared.chatTabId || readPersistedChatTab()
      if (known) {
        // Reuse the remembered tab instead of creating another browser page.
        try {
          if (typeof sidebar.focus === 'function') sidebar.focus(known)
        } catch {
          /* ignore */
        }
        const focused = safeActive(sidebar)
        if (focused && focused.id === known) {
          shared.chatTabId = known
          reportChatState('enter-reuse')
          revealChat(sidebar)
          return
        }
        // The remembered tab was closed or belongs to another Session.
        shared.chatTabId = null
        persistChatTab(null)
      }
      try {
        sidebar.openTab('browser', { params: { url: CHAT_URL } })
      } catch (error) {
        reportClientEvent('chat-open-failed', String((error && error.message) || error))
        showChatUnavailable(
          tr('chat.openFailed', { message: String((error && error.message) || error) }),
        )
        return
      }
      captureChatTab(sidebar)
      persistChatTab(shared.chatTabId)
      reportChatState('enter-new')
      revealChat(sidebar)
    }

    function revealChat(sidebar) {
      setChatVisible(true)
      setPill({ busy: false, error: '' })
      if (!safeExpanded(sidebar)) {
        try {
          if (typeof sidebar.toggleExpanded === 'function') sidebar.toggleExpanded()
        } catch {
          /* ignore */
        }
      }
      scheduleChatFullscreen(0)
    }

    /**
     * Switch the right panel into its fullscreen presentation through the same
     * action as its chrome control. The pane target only exists after the open
     * commits, and the DOM presentation attribute prevents a blind second
     * toggle when the panel is already fullscreen.
     */
    function scheduleChatFullscreen(attempt) {
      if (attempt > 20) return
      setTimeout(() => {
        const sidebar = getSidebarRight()
        if (!sidebar) return
        if (!safeExpanded(sidebar)) {
          scheduleChatFullscreen(attempt + 1)
          return
        }
        if (isRightbarFullscreen()) return
        try {
          if (typeof sidebar.commandTarget !== 'function' || typeof sidebar.toggleFullscreen !== 'function') return
          const target = sidebar.commandTarget()
          if (target && target.host !== 'float') {
            sidebar.toggleFullscreen(target)
            reportChatState('enter-fullscreen')
            return
          }
        } catch {
          /* fall through and retry */
        }
        scheduleChatFullscreen(attempt + 1)
      }, 70)
    }

    function exitChat(sidebar) {
      try {
        if (shared.chatTabId && typeof sidebar.hide === 'function') sidebar.hide(shared.chatTabId)
        else if (typeof sidebar.toggleExpanded === 'function') sidebar.toggleExpanded()
      } catch {
        /* ignore */
      }
      reportChatState('exit')
      setChatVisible(false)
      setPill({ busy: false, error: '' })
    }

    /** Keep the brand/pill state honest when the panel is changed by hand. */
    function refreshChatVisibility() {
      const sidebar = getSidebarRight()
      if (!sidebar) {
        setChatVisible(false)
        return
      }
      try {
        if (!safeExpanded(sidebar)) {
          if (shared.chatVisible) reportChatState('refresh-collapsed')
          setChatVisible(false)
          return
        }
        const active = safeActive(sidebar)
        const activeId = active && typeof active.id === 'string' ? active.id : ''
        if (shared.chatTabId) {
          if (activeId === shared.chatTabId) {
            if (!shared.chatVisible) reportChatState('refresh-match')
            setChatVisible(true)
            return
          }
          if (active && active.kind && active.kind !== 'browser') {
            if (shared.chatVisible) reportChatState('refresh-other-tab')
            setChatVisible(false)
          }
          // A different browser tab is active: keep the state instead of
          // flickering the brand on a transient mismatch.
          return
        }
        if (active && active.kind === 'browser' && activeId) {
          shared.chatTabId = activeId
          persistChatTab(activeId)
          reportChatState('refresh-adopt')
          setChatVisible(true)
        }
      } catch {
        setChatVisible(false)
      }
    }

    function findChatWebview() {
      try {
        const nodes = Array.from(document.querySelectorAll('webview[data-sidebar-browser-frame]'))
        for (const node of nodes) {
          try {
            const url = typeof node.getURL === 'function' ? String(node.getURL()) : ''
            if (url.indexOf('chat.deepseek.com') >= 0) return node
          } catch {
            /* ignore */
          }
        }
        return nodes.length ? nodes[nodes.length - 1] : null
      } catch {
        return null
      }
    }

    async function readGuestConversation() {
      const guest = findChatWebview()
      if (!guest || typeof guest.executeJavaScript !== 'function') {
        throw new Error(tr('pill.readFailed'))
      }
      const result = await guest.executeJavaScript(GUEST_SCRAPE_SCRIPT, true)
      if (!result || typeof result.text !== 'string') throw new Error(tr('pill.readFailed'))
      return result.text.slice(0, 120000)
    }

    async function handoffChatToTask() {
      if (shared.handoffBusy) return
      shared.handoffBusy = true
      setPill({ busy: true, error: '' })
      try {
        const text = await readGuestConversation()
        if (text.trim().length < 40) throw new Error(tr('pill.readFailed'))
        const data = await postJson('/create-task', {
          input: text,
          instruction: tr('pill.instruction'),
          cwd: currentCwd() || undefined,
        })
        setPill({ busy: false, error: '' })
        const sidebar = getSidebarRight()
        const opened = await finishCreatedTask(data.sessionId)
        if (sidebar) exitChat(sidebar)
        if (!opened) setPill({ busy: false, error: tr('status.openPending', { sessionId: data.sessionId }) })
      } catch (error) {
        setPill({ busy: false, error: describeError(error) })
      } finally {
        shared.handoffBusy = false
      }
    }

    /**
     * Fallback when the Host half cannot create a session (older builds or a
     * profile without sessionController): the page half uses the Client
     * session API itself. It is the same Host controller underneath.
     */
    async function createFromPageSide(seed) {
      const sessions = pluginContext && pluginContext.get('sessions')
      if (!sessions || typeof sessions.create !== 'function') {
        throw new Error(tr('fallback.unavailable'))
      }
      const cwd = currentCwd()
      const id = await sessions.create(cwd ? { cwd } : {})
      if (!id) throw new Error(tr('fallback.unavailable'))
      if (typeof sessions.using === 'function') {
        await sessions.using(id, { source: 'gateway' }, async (reference) => {
          if (!reference) throw new Error(tr('fallback.unavailable'))
          const binding = reference.binding || (await reference.ready)
          if (!binding || !binding.session || typeof binding.session.prompt !== 'function') {
            throw new Error(tr('fallback.unavailable'))
          }
          const result = await binding.session.prompt([{ type: 'text', text: seed }], 'queue')
          if (result && result.ok === false) {
            const failure = result.error || {}
            throw new Error(failure.message || failure.code || 'prompt rejected')
          }
        })
      }
      const uiWorkspace = pluginContext && pluginContext.get('uiWorkspace')
      if (uiWorkspace && typeof uiWorkspace.openSession === 'function') uiWorkspace.openSession(id)
      return id
    }

    async function createTask() {
      const input = String(store.input || '').trim()
      if (!input) {
        setState({ phase: 'error', error: tr('hint.needInput') })
        return
      }
      if (createInFlight) return
      createInFlight = true
      setState({ phase: 'creating', error: '', note: '' })
      try {
        const data = await postJson('/create-task', {
          input,
          instruction: store.instruction || '',
          cwd: currentCwd() || undefined,
        })
        const sessionId = data.sessionId
        const opened = await finishCreatedTask(sessionId)
        if (!opened) {
          // The task exists and already received its first message; only the
          // page catalogue did not sync yet, so tell the user where it is
          // instead of pretending the whole operation failed.
          setState({ phase: 'ready', note: '', error: tr('status.openPending', { sessionId }) })
          return
        }
        setTimeout(closeDialog, 350)
      } catch (error) {
        if (error && error.code === 'unavailable') {
          setState({ note: tr('hint.creatingFallback') })
          try {
            const seedData = await postJson('/resolve', { input })
            const seed = buildSeedLocally(seedData.share, store.instruction || '')
            await createFromPageSide(seed)
            setState({ phase: 'creating', note: tr('status.created'), preview: null })
            setTimeout(closeDialog, 350)
          } catch (fallbackError) {
            setState({ phase: 'error', error: tr('fallback.failed', { message: describeError(fallbackError) }) })
          }
        } else {
          setState({ phase: 'error', error: describeError(error) })
        }
      } finally {
        createInFlight = false
      }
    }

    /** Shared tail of every create flow: show progress, then open the new task. */
    async function finishCreatedTask(sessionId) {
      setState({ phase: 'creating', note: tr('status.created'), preview: null })
      return openSessionWhenKnown(pluginContext && pluginContext.get('sessions'), sessionId)
    }

    /**
     * Wait until the client session catalogue knows a Host-created session.
     * `openSession()` retains the id, and retaining an id the local list has
     * never seen throws "sessions.retain: unknown session"; the catalogue row
     * normally arrives through the Host's `api-session/added` broadcast within
     * a frame, so give it a bounded wait instead of failing the whole flow.
     */
    function waitForSessionRow(listSource, sessionId, timeoutMs) {
      return new Promise((resolve) => {
        let settled = false
        let unsubscribe = () => {}
        const finish = (value) => {
          if (settled) return
          settled = true
          try {
            unsubscribe()
          } catch {
            /* ignore */
          }
          resolve(value)
        }
        const present = (state) => !!(state && state.byId && state.byId[sessionId])
        try {
          if (present(listSource.getSnapshot())) return finish(true)
          unsubscribe = listSource.subscribe(() => {
            try {
              if (present(listSource.getSnapshot())) finish(true)
            } catch {
              /* ignore */
            }
          })
        } catch {
          return finish(false)
        }
        setTimeout(() => finish(false), timeoutMs)
      })
    }

    function openSessionWhenKnown(sessions, sessionId) {
      return (async () => {
        try {
          if (sessions && typeof sessions.refresh === 'function') await sessions.refresh()
        } catch {
          /* ignore */
        }
        const known = sessions && sessions.list ? await waitForSessionRow(sessions.list, sessionId, 4000) : false
        if (!known) return false
        const uiWorkspace = pluginContext && pluginContext.get('uiWorkspace')
        if (!uiWorkspace || typeof uiWorkspace.openSession !== 'function') return false
        uiWorkspace.openSession(sessionId)
        return true
      })()
    }

    /** Minimal local seed builder for the page-side fallback path only. */
    function buildSeedLocally(share, instruction) {
      const title = (share && share.title) || 'DeepSeek 分享对话'
      const url = (share && share.url) || ''
      const messages = (share && share.messages) || []
      const lines = []
      if (url) lines.push(`原始分享链接：${url}`)
      lines.push('')
      lines.push('--- 对话开始 ---')
      for (const message of messages) {
        lines.push('')
        lines.push(message.role === 'user' ? '## 用户' : '## DeepSeek')
        lines.push(String(message.text || ''))
      }
      lines.push('')
      lines.push('--- 对话结束 ---')
      lines.push('')
      const ask =
        instruction && String(instruction).trim()
          ? String(instruction).trim()
          : '以上是我在 DeepSeek 网页版里的一段对话。请把它作为任务背景：如果其中已经明确了任务或需求，直接开始执行；如果信息不足，先用一两个问题向我确认，再继续。'
      lines.push(ask)
      return `我在 DeepSeek 网页版里有一段对话（标题：${title}）。\n\n${lines.join('\n')}`
    }

    /* ------------------------------------------------------------------ */
    /* Styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS = [
      '.dsb-entry{display:flex;align-items:center;justify-content:flex-start;gap:8px;box-sizing:border-box;width:100%;max-width:100%;min-width:0;height:30px;padding:0 9px 0 10px;border:1px solid transparent;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background-color .13s ease,color .13s ease}',
      '.dsb-entry:hover{background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-primary)}',
      '.dsb-entry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:1px}',
      '.dsb-entry-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary))}',
      '.dsb-entry-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsb-entry--rail{justify-content:center;width:30px;height:30px;padding:0}',
      '.dsb-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(0,0,0,.34);pointer-events:auto}',
      '.dsb-dialog{display:flex;flex-direction:column;box-sizing:border-box;width:min(600px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 48px));overflow:hidden;border:1px solid var(--dsw-alias-border-l2,transparent);border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary);box-shadow:0 18px 60px rgba(0,0,0,.28);font-family:inherit;font-size:14px;line-height:22px}',
      '.dsb-head{flex:none;display:flex;align-items:flex-start;gap:12px;padding:18px 20px 10px}',
      '.dsb-head-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.08));color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary))}',
      '.dsb-title{font-size:16px;line-height:24px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsb-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-top:2px}',
      '.dsb-close{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:16px;line-height:1}',
      '.dsb-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsb-body{flex:1 1 auto;min-height:0;overflow:auto;padding:8px 20px 16px;display:flex;flex-direction:column;gap:14px}',
      '.dsb-field{display:flex;flex-direction:column;gap:6px}',
      '.dsb-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsb-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l3,transparent));border-radius:var(--dsw-radius-sm,8px);padding:8px 12px;font-family:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent);outline:none;resize:vertical}',
      '.dsb-input::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.dsb-input:focus{border-color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary));box-shadow:0 0 0 1px var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary))}',
      '.dsb-input--area{min-height:56px;max-height:120px;white-space:pre-wrap}',
      '.dsb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsb-spacer{flex:1 1 auto}',
      '.dsb-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;padding:5px 12px;border:1px solid transparent;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.1));color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.dsb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsb-btn:disabled{opacity:.5;cursor:default}',
      '.dsb-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary));outline-offset:2px}',
      '.dsb-btn[data-primary="true"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));color:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.dsb-btn[data-primary="true"]:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4d6bfe))}',
      '.dsb-link{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:4px 0;color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary));font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.dsb-link:hover{text-decoration:underline}',
      '.dsb-note{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsb-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));overflow-wrap:anywhere}',
      '.dsb-preview{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--dsw-alias-border-l2,transparent);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.06))}',
      '.dsb-preview-title{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.dsb-preview-meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsb-snippet{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:76px;overflow:hidden}',
      '.dsb-snippet-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));margin-bottom:2px}',
      '.dsb-foot{flex:none;display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2,transparent))}',
      '.dsb-brand{display:inline-flex;align-items:center;gap:2px;min-width:0;margin:-2px 0 -2px -6px;padding:2px 6px 2px 6px;border-radius:var(--dsw-radius-sm,8px);color:var(--dsb-ink,var(--dsw-alias-label-primary));font:inherit;cursor:pointer;outline:none;-webkit-app-region:no-drag;transition:background-color .15s ease,color .15s ease}',
      '.dsb-brand:hover{background:var(--dsw-alias-interactive-bg-hover,transparent)}',
      '.dsb-brand:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:1px}',
      '.dsb-brand--on{--dsb-ink:var(--dsw-alias-brand-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 12%,transparent)}',
      '.dsb-brand--on:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 18%,transparent)}',
      '.dsb-brand-badge{display:inline-flex;align-items:center;justify-content:center;height:14px;margin-left:5px;padding:0 4px;border-radius:2px;background:var(--dsb-ink,var(--dsw-alias-label-primary));color:var(--dsw-alias-label-primary-inverted,#fff);font-size:9px;line-height:1;font-weight:600;letter-spacing:.02em;transform:translateY(1px);white-space:nowrap}',
      '.dsb-brand-badge .dsb-badge-chat{display:none}',
      '.dsb-brand-badge[data-mode="chat"] .dsb-badge-work{display:none}',
      '.dsb-brand-badge[data-mode="chat"] .dsb-badge-chat{display:inline}',
      '.dsb-brand[data-mode="chat"]{--dsb-ink:var(--dsw-alias-brand-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 12%,transparent)}',
      '.dsb-brand-mark{display:inline-flex;color:inherit}',
      '.dsb-brand-mark--on{color:var(--dsw-alias-brand-primary,#4d6bfe)}',
      '.dsb-pill-wrap{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147482900;pointer-events:auto;max-width:min(780px,calc(100vw - 48px))}',
      '.dsb-pill{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;border:1px solid var(--dsw-alias-border-l2,transparent);border-radius:999px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary);box-shadow:0 10px 34px rgba(0,0,0,.22);font-family:inherit;font-size:12px;line-height:18px;backdrop-filter:blur(12px)}',
      '.dsb-pill-hint{color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsb-pill-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));max-width:460px;overflow-wrap:anywhere}',
      '.dsb-pill-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:4px 12px;border:1px solid transparent;border-radius:999px;background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.dsb-pill-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsb-pill-btn:disabled{opacity:.55;cursor:default}',
      '.dsb-pill-btn[data-primary="true"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));color:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.dsb-pill-btn[data-primary="true"]:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4d6bfe))}',
    ].join('\n')

    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-dsh-plugin', PACKAGE_ID)
      style.textContent = CSS
      const host = document.head || document.body || document.documentElement
      host.appendChild(style)
      return () => {
        try {
          style.remove()
        } catch {
          /* ignore */
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Icons                                                               */
    /* ------------------------------------------------------------------ */

    function BridgeGlyph(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', { d: 'M4 6.5h9.5a2.5 2.5 0 0 1 0 5H6l-2 2V6.5Z' }),
        h('path', { d: 'M20 13.5h-9.5a2.5 2.5 0 0 0 0 5H18l2 2v-7Z' }),
        h('path', { d: 'M15 9.5h4.5M17.5 7.5l2 2-2 2' }),
      )
    }

    function BackGlyph(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', { d: 'M14.5 12H5M9.5 7.5 5 12l4.5 4.5' }),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Top-left brand switch + in-chat task pill                           */
    /* ------------------------------------------------------------------ */

    /**
     * Replaces the sidebar brand name with the mode switch: the official
     * "DeepSeek" lettering plus the badge that reads "Harness" in workspace mode
     * and "Chat" (blue plate) in chat mode. The parent brand element is a button
     * that opens a new session; the owner's own handler skips clicks landing
     * inside `[data-copy-version]`, so marking this span with that attribute lets
     * the click belong to us.
     */
    function BrandSwitch() {
      const visible = useChatVisible()
      React.useEffect(() => {
        reportClientEvent('brand-mounted')
        paintChatMode(shared.chatVisible)
      }, [])
      const title = visible ? tr('brand.leave') : tr('brand.enter')
      return h(
        'span',
        {
          className: 'dsb-brand' + (visible ? ' dsb-brand--on' : ''),
          'data-copy-version': '',
          'data-mode': visible ? 'chat' : 'work',
          role: 'button',
          tabIndex: 0,
          title,
          style: visible ? { color: DEEPSEEK_BLUE, background: 'rgba(77,107,254,0.12)' } : undefined,
          onClick: (event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleChat()
          },
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            event.stopPropagation()
            toggleChat()
          },
        },
        h(DeepSeekWordmark),
        h(
          'span',
          {
            className: 'dsb-brand-badge',
            'data-mode': visible ? 'chat' : 'work',
            style: visible ? { background: DEEPSEEK_BLUE, color: '#fff' } : undefined,
          },
          h('span', { className: 'dsb-badge-work' }, tr('brand.badgeWork')),
          h('span', { className: 'dsb-badge-chat' }, tr('brand.badgeChat')),
        ),
      )
    }

    /** Whale mark, recolored through CSS so the chat mode can turn it blue. */
    function BrandMark(props) {
      const visible = useChatVisible()
      const size = (props && props.size) || 24
      React.useEffect(() => {
        reportClientEvent('brand-mark-mounted')
      }, [])
      return h(
        'span',
        {
          className: 'dsb-brand-mark' + (visible ? ' dsb-brand-mark--on' : ''),
          style: visible ? { color: DEEPSEEK_BLUE } : undefined,
        },
        h(DeepSeekMark, { size }),
      )
    }

    /** The official "DeepSeek" glyph lettering (no whale, no badge). */
    function DeepSeekWordmark() {
      return h(
        'svg',
        {
          viewBox: '26 0 100 24',
          width: 100,
          height: 24,
          fill: 'none',
          'aria-hidden': true,
          focusable: 'false',
          style: { display: 'block', color: 'currentColor' },
        },
        ...BRAND_ART.deepSeekPaths.map((d, index) => h('path', { key: `deepseek-glyph-${index}`, d, fill: 'currentColor' })),
      )
    }

    /** The whale silhouette as a standalone mark. */
    function DeepSeekMark(props) {
      const size = (props && props.size) || 24
      const viewBox = BRAND_ART.fishViewBox
      return h(
        'svg',
        {
          viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
          width: size,
          height: (size * viewBox.height) / viewBox.width,
          fill: 'none',
          'aria-hidden': true,
          focusable: 'false',
          style: { display: 'block', color: 'currentColor' },
        },
        h('path', { d: BRAND_ART.fishPath, fill: 'currentColor' }),
      )
    }

    /**
     * Floating bridge strip shown above the fullscreen chat surface: one click
     * scrapes the visible conversation and creates a DSH task from it.
     */
    function ChatPill() {
      const visible = useChatVisible()
      const pill = usePillState()
      React.useEffect(() => {
        reportClientEvent('pill-mounted')
      }, [])
      if (!visible) return null
      return h(
        'div',
        { className: 'dsb-pill-wrap' },
        h(
          'div',
          { className: 'dsb-pill' },
          pill.error
            ? h('span', { className: 'dsb-pill-error' }, pill.error)
            : h('span', { className: 'dsb-pill-hint' }, tr('pill.hint')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsb-pill-btn',
              onClick: openDialog,
            },
            tr('pill.share'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsb-pill-btn',
              'data-primary': 'true',
              disabled: pill.busy,
              onClick: handoffChatToTask,
            },
            pill.busy ? tr('pill.reading') : tr('pill.create'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsb-pill-btn',
              onClick: () => {
                const sidebar = getSidebarRight()
                if (sidebar) exitChat(sidebar)
              },
            },
            tr('pill.back'),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Footer entry                                                        */
    /* ------------------------------------------------------------------ */

    function FooterAction(props) {
      const wide = !!(props && props.wide)
      return h(
        'button',
        {
          type: 'button',
          className: 'dsb-entry' + (wide ? '' : ' dsb-entry--rail'),
          title: tr('entry.title'),
          'aria-label': tr('entry.aria'),
          onClick: openDialog,
        },
        h('span', { className: 'dsb-entry-icon' }, h(BridgeGlyph, { size: 15 })),
        wide ? h('span', { className: 'dsb-entry-label' }, tr('entry.label')) : null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Dialog                                                              */
    /* ------------------------------------------------------------------ */

    function Section(props) {
      return h('div', { className: 'dsb-field' }, props.children)
    }

    function PreviewCard(props) {
      const share = props.share || {}
      const stats = share.stats || {}
      const preview = share.preview || {}
      return h(
        'div',
        { className: 'dsb-preview' },
        h('div', { className: 'dsb-preview-title' }, share.title || 'DeepSeek 分享对话'),
        h(
          'div',
          { className: 'dsb-preview-meta' },
          tr('meta.messages', {
            count: stats.total || 0,
            user: stats.user || 0,
            assistant: stats.assistant || 0,
          }),
        ),
        h(
          'div',
          { className: 'dsb-preview-meta' },
          props.kind === 'share' ? tr('meta.kindShare') : tr('meta.kindText'),
        ),
        share.url
          ? h(
              'button',
              {
                type: 'button',
                className: 'dsb-link',
                onClick: () => {
                  try {
                    window.open(share.url, '_blank', 'noopener,noreferrer')
                  } catch {
                    /* ignore */
                  }
                },
              },
              share.url,
            )
          : null,
        preview.firstUser
          ? h(
              'div',
              null,
              h('div', { className: 'dsb-snippet-label' }, tr('preview.firstUser')),
              h('div', { className: 'dsb-snippet' }, preview.firstUser),
            )
          : null,
        preview.lastAssistant
          ? h(
              'div',
              null,
              h('div', { className: 'dsb-snippet-label' }, tr('preview.lastAssistant')),
              h('div', { className: 'dsb-snippet' }, preview.lastAssistant),
            )
          : null,
      )
    }

    function DialogBody(state) {
      const busy = state.phase === 'resolving' || state.phase === 'creating'
      const inputRef = React.useRef(null)
      React.useEffect(() => {
        if (state.open && inputRef.current) {
          try {
            inputRef.current.focus()
          } catch {
            /* ignore */
          }
        }
      }, [state.open])

      return h(
        'div',
        { className: 'dsb-body' },
        h(
          Section,
          null,
          h('label', { className: 'dsb-label', htmlFor: 'dsb-input' }, tr('field.input')),
          h('textarea', {
            id: 'dsb-input',
            ref: inputRef,
            className: 'dsb-input dsb-input--area',
            rows: 2,
            value: state.input,
            placeholder: tr('field.input.placeholder'),
            spellCheck: false,
            onInput: (event) => setInput(event.target.value),
            onChange: (event) => setInput(event.target.value),
            onKeyDown: (event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                createTask()
              }
            },
          }),
          h(
            'div',
            { className: 'dsb-row' },
            h(
              'button',
              { type: 'button', className: 'dsb-link', onClick: readClipboardIntoInput, disabled: busy },
              tr('action.clipboard'),
            ),
            h('span', { className: 'dsb-spacer' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsb-btn',
                onClick: resolveInput,
                disabled: busy || !String(state.input || '').trim(),
              },
              state.phase === 'resolving' ? tr('status.resolving') : tr('action.preview'),
            ),
          ),
        ),
        state.preview
          ? h(PreviewCard, { kind: state.preview.kind, share: state.preview.share })
          : null,
        h(
          Section,
          null,
          h('label', { className: 'dsb-label', htmlFor: 'dsb-instruction' }, tr('field.instruction')),
          h('textarea', {
            id: 'dsb-instruction',
            className: 'dsb-input dsb-input--area',
            rows: 2,
            value: state.instruction,
            placeholder: tr('field.instruction.placeholder'),
            spellCheck: false,
            onInput: (event) => setInstruction(event.target.value),
            onChange: (event) => setInstruction(event.target.value),
          }),
        ),
        state.note ? h('div', { className: 'dsb-note' }, state.note) : null,
        state.error ? h('div', { className: 'dsb-error' }, tr('status.error', { message: state.error })) : null,
      )
    }

    function BridgeOverlay() {
      const state = useBridgeState()

      React.useEffect(() => {
        if (!state.open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeDialog()
          }
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
      }, [state.open])

      if (!state.open) return null

      const busy = state.phase === 'resolving' || state.phase === 'creating'
      const cwd = currentCwd()
      const canCreate = !!String(state.input || '').trim() && !busy

      return h(
        'div',
        {
          className: 'dsb-backdrop',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) closeDialog()
          },
        },
        h(
          'div',
          {
            className: 'dsb-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': tr('dialog.title'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          h(
            'div',
            { className: 'dsb-head' },
            h('span', { className: 'dsb-head-icon' }, h(BridgeGlyph, { size: 18 })),
            h(
              'div',
              { style: { minWidth: 0 } },
              h('div', { className: 'dsb-title' }, tr('dialog.title')),
              h('div', { className: 'dsb-sub' }, tr('dialog.subtitle')),
            ),
            h(
              'button',
              { type: 'button', className: 'dsb-close', 'aria-label': tr('action.close'), onClick: closeDialog },
              '×',
            ),
          ),
          h(DialogBody, state),
          h(
            'div',
            { className: 'dsb-foot' },
            h(
              'button',
              { type: 'button', className: 'dsb-link', onClick: openWebChat, title: tr('action.openChatHint') },
              tr('action.openChat'),
            ),
            cwd ? h('span', { className: 'dsb-note' }, tr('meta.workspace', { path: shortPath(cwd) })) : null,
            h('span', { className: 'dsb-spacer' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsb-btn',
                onClick: closeDialog,
                disabled: state.phase === 'creating',
              },
              tr('action.close'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsb-btn',
                'data-primary': 'true',
                onClick: createTask,
                disabled: !canCreate,
              },
              state.phase === 'creating' ? tr('action.creating') : tr('action.create'),
            ),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Session probe (renders nothing; records the current session id)      */
    /* ------------------------------------------------------------------ */

    function SessionProbe(props) {
      if (props && props.sessionId) currentSessionId = String(props.sessionId)
      return null
    }

    /* ------------------------------------------------------------------ */
    /* Plugin entry                                                        */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      pluginContext = ctx
      try {
        window[PLUGIN_CTX_KEY] = ctx
      } catch {
        /* ignore */
      }
      reportClientEvent('client-apply', 'switch-v2')

      try {
        if (ctx.get('locale')) {
          ctx.effect(() => ctx.locale.register(NS, { zh: MESSAGES.zh, en: MESSAGES.en }), 'deepseek-chat-mode: dictionaries')
          translate = ctx.locale.bind(NS)
        }
      } catch {
        translate = null
      }

      try {
        if (typeof document !== 'undefined') {
          ctx.effect(installStyles, 'deepseek-chat-mode: styles')
        }
      } catch {
        /* ignore */
      }

      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'deepseek-chat-mode-dialog', order: 60 },
            BridgeOverlay,
          ),
        )
      } catch (error) {
        console.error('[deepseek-chat-mode] dialog registration failed', error)
      }

      try {
        ctx.slots.inject('conversation.input.overlay', () =>
          ctx.slots.register(
            { name: 'conversation.input.overlay', id: 'deepseek-chat-mode-session-probe', order: 9999 },
            SessionProbe,
          ),
        )
      } catch (error) {
        console.error('[deepseek-chat-mode] session probe registration failed', error)
      }

      // Top-left brand-name occupant = the Chat ⇄ Workspace switch.
      try {
        ctx.slots.inject('sidebar.brand.name', () => {
          try {
            // The shipped brand-name occupant sits at priority 0; a single slot
            // refuses a second registration at the same priority and renders the
            // lowest priority, so -1 shadows the shipped wordmark with our switch.
            const dispose = ctx.slots.register({ name: 'sidebar.brand.name', priority: -1 }, BrandSwitch)
            reportClientEvent('brand-registered')
            return dispose
          } catch (error) {
            reportClientEvent('brand-register-failed', String((error && error.message) || error))
            return undefined
          }
        })
      } catch (error) {
        console.error('[deepseek-chat-mode] brand switch registration failed', error)
        reportClientEvent('brand-inject-failed', String((error && error.message) || error))
      }

      // Top-left brand mark occupant = the same switch, so the whale recolors
      // blue in chat mode (shipped mark sits at priority 0; -1 shadows it).
      try {
        ctx.slots.inject('sidebar.brand.mark', () => {
          try {
            const dispose = ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, BrandMark)
            reportClientEvent('brand-mark-registered')
            return dispose
          } catch (error) {
            reportClientEvent('brand-mark-register-failed', String((error && error.message) || error))
            return undefined
          }
        })
      } catch (error) {
        console.error('[deepseek-chat-mode] brand mark registration failed', error)
        reportClientEvent('brand-mark-inject-failed', String((error && error.message) || error))
      }

      // Floating handoff strip over the fullscreen chat surface.
      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'deepseek-chat-mode-chat-pill', order: 55 },
            ChatPill,
          ),
        )
      } catch (error) {
        console.error('[deepseek-chat-mode] chat pill registration failed', error)
      }

      // Keep brand/pill state honest when the panel is changed by hand.
      try {
        ctx.effect(() => {
          const timer = window.setInterval(refreshChatVisibility, 1200)
          refreshChatVisibility()
          return () => {
            try {
              window.clearInterval(timer)
            } catch {
              /* ignore */
            }
          }
        }, 'deepseek-chat-mode: chat visibility')
      } catch {
        /* timer is best-effort */
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})

