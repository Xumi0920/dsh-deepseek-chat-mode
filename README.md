# dsh-deepseek-chat-mode

> **DeepSeek Chat ⇄ Work mode for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**
> 点 DSH 左上角品牌区，全屏打开 DeepSeek 网页版；聊完一键把对话交接成新的 DSH 任务。

[![tests](https://github.com/Xumi0920/dsh-deepseek-chat-mode/actions/workflows/test.yml/badge.svg)](https://github.com/Xumi0920/dsh-deepseek-chat-mode/actions/workflows/test.yml)

[中文使用说明](#使用) · [English summary](#english-summary) · [路线图](ROADMAP.md) · [变更记录](CHANGELOG.md)

> **不是 DeepSeek 官方项目。** 它读取公开分享链接与内嵌网页的当前对话；DeepSeek
> 网页改版可能导致失效，详见[已知限制](#已知限制)。

## 为什么做这个

ChatGPT / Codex 这类产品里，"聊天"和"干活"是同一个工作台的两种模式：聊清楚之后，一句话
就能让 agent 接着做。DSH 很强，但它的聊天伙伴（DeepSeek 网页版）和 DSH 任务是两个世界，
中间要手动复制粘贴。

这个插件把两者接起来：

- **同一个门面即模式开关**：DSH 左上角品牌区在「工作态（黑色 DeepSeek Harness）」与
  「聊天态（蓝色 DeepSeek Chat）」之间切换；
- **聊天真的在 DSH 里**：用官方右侧栏浏览器全屏打开 chat.deepseek.com（登录态、联网搜索、
  分享都在）；
- **一键交接**：聊天页悬浮条「用这段对话新建 DSH 任务」自动读取当前对话，创建任务、把整段
  对话作为首条消息发送，并自动跳过去；
- **分享链接也支持**：粘贴公开分享链接（或整段正文）→ 预览 → 一键建任务；Agent 也可以直接
  调用 `deepseek_share_import` 工具。

## 功能

| 功能 | 入口 |
| --- | --- |
| Chat ⇄ Work 模式切换（蓝色铭牌、页签复用） | 左上角品牌区 |
| 全屏 DeepSeek 网页对话 | 点品牌区 |
| 用当前对话新建 DSH 任务（自动抓取 + 自动跳转） | 聊天页底部悬浮条 |
| 分享链接 / 粘贴正文导入任务 | 悬浮条「分享链接导入」 |
| Agent 工具 `deepseek_share_import` | 任意 DSH 会话中让 Agent 调用 |

## 安装

> 预览发布。需要 **DSH Desktop profile**（全屏内嵌网页依赖官方右侧栏浏览器包）。
> 安装后如界面未出现，重新加载页面一次。

### 方式 A：让 DSH 智能体安装（推荐）

1. 克隆仓库到本机：

   ```bash
   git clone https://github.com/Xumi0920/dsh-deepseek-chat-mode.git
   ```

2. 在 DSH 里对智能体说：

   > 用 plugin_manager install_bundle 安装 `<仓库绝对路径>`

   或在你的 DSH 会话中直接调用等价安装操作。安装成功后插件会出现在插件列表中，
   并自动启用 `deepseek-chat-mode` 这一行。

3. 重新加载 DSH 页面，左侧栏左上角品牌区即出现模式开关。

### 方式 B：手动加入 profile 依赖（进阶）

编辑 `~/.dsh/profiles/<profile>/package.json`：

```json
{
  "dependencies": {
    "@xumi0920/dsh-deepseek-chat-mode": "github:Xumi0920/dsh-deepseek-chat-mode"
  },
  "dsh": {
    "profile": {
      "bundles": ["@xumi0920/dsh-deepseek-chat-mode"]
    }
  }
}
```

然后重启 DSH（或用插件管理启用该 bundle）。

### 方式 C：npm（规划中）

计划发布到 npm（`@xumi0920/dsh-deepseek-chat-mode`）并提交到 DSH 插件索引，
见[路线图](ROADMAP.md) v1.0。

## 使用

### Chat ⇄ Work 切换

- **工作态**：左上角显示官方鲸鱼 logo + `DeepSeek` 字样 + 黑底倒色铭牌 **Harness**。
- **点一下**：右侧栏全屏打开 DeepSeek 网页版；鲸鱼、`DeepSeek` 字样和铭牌一起变成
  DeepSeek 蓝，铭牌显示 **Chat**。
- **再点一下**：收起聊天，回到 DSH 工作台（品牌恢复黑色 Harness）。
- 聊天页签按 Session 记忆并**复用**：不会每点一次就多开一个网页；被关掉后才重新创建。
- 聊天页底部悬浮条：
  - **用这段对话新建 DSH 任务**：读取当前对话 → 创建任务 → 自动跳转；
  - **分享链接导入**：打开导入弹窗；
  - **收起**：回到工作台。

### 分享链接导入

1. 在 DeepSeek 网页版点「分享」→「创建分享链接」→ 复制；
2. 在聊天态点悬浮条「分享链接导入」，弹窗会自动读取剪贴板并预览；
3. 「创建任务并开始」：新建任务、把导入内容作为首条消息发送、自动切过去。

### Agent 工具

在任意会话中让 Agent 读取某个公开分享链接：

> 用 deepseek_share_import 读一下 https://chat.deepseek.com/share/xxxx

工具会返回整理好的 Markdown 转录（不创建任务）。

## 工作原理

- **Host 半**（`index.js`）
  - 解析并抓取公开分享链接（`GET https://chat.deepseek.com/api/v0/share/content`，无需登录）；
  - 提供同源 JSON 路由：解析预览、创建任务、客户端挂载诊断；
  - 通过宿主 `sessionController.create` + `prompt` 创建任务并发送首条消息（与 Web UI
    「新建会话」同一条路径），不绕过 DSH 的授权与工具策略；
  - 注册 `deepseek_share_import` 工具。
- **Client 半**（`client.js`）
  - 以官方单槽位 `priority: -1` 覆盖 `sidebar.brand.mark` / `sidebar.brand.name`，实现品牌区
    模式开关（内嵌官方 MIT 授权的鲸鱼与字形路径，见 `THIRD_PARTY_NOTICES.md`）；
  - 用官方 `ctx.sidebarRight` 打开/聚焦/收起全屏浏览器页签（自建 webview 被官方 guest
    lease 管控，因此走官方页签）；
  - 聊天页悬浮条通过官方内嵌浏览器 `executeJavaScript` 分段读取当前对话；
  - 所有状态有跨模块副本的共享单例，避免插件重载后点击与已挂载组件不同步。

## 隐私与安全

- 不保存任何 DeepSeek 账号凭据；分享链接请求使用公开接口、无需登录态；
- 交接时只读取**当前正在看的对话**，内容成为 DSH 任务的对话记录（由你的 DSH 配置掌管）；
- 仅在 `localStorage` 保存两个小偏好（可选任务指令、聊天页签 id）；
- 无遥测、无第三方上报；本地路由只接受同源请求。

完整威胁模型见 [SECURITY.md](SECURITY.md)。

## 已知限制

- **Desktop profile 才支持全屏内嵌网页**；Web profile 会降级提示（右侧栏在 Web 是 iframe，
  而 chat.deepseek.com 禁止被 iframe 嵌入）。
- 内嵌网页的登录态遵循官方右侧栏浏览器的限制：**应用重启后不保留**，需要重新登录一次；
  想用持久登录态可改用系统浏览器 + 分享链接导入。
- 聊天内抓取采用"滚动读取页面文本"，可能混入少量界面文字；超长对话可能不完整。
  需要更完整/可复现的导入时，优先用分享链接。
- 依赖 DeepSeek 网页内部接口与页面结构，网页改版可能失效；失败会如实报错。

## 开发与测试

```bash
npm test            # 34 个离线单测（node:test，无依赖）
npm run test:live   # 可选：真实联网冒烟，需传入分享链接
```

- Node 22+；Node 24 起 `--test` 的位置参数是 glob（`"test/*.test.mjs"`）。
- 目录说明与贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 验证清单见 [docs/verification.md](docs/verification.md)。

## English summary

A DSH plugin that turns the DeepSeek web chat into a **Chat ⇄ Work mode switch**:

- click the sidebar brand (official whale mark + `DeepSeek` + `Harness` badge) to open
  `chat.deepseek.com` full-screen in the official right-sidebar browser; in chat mode the
  brand turns DeepSeek blue and the badge reads `Chat`;
- a floating bar over the chat hands the current conversation off as a new DSH task
  (first message = the conversation + a task instruction), then opens it;
- a share-link import dialog and a `deepseek_share_import` agent tool cover the
  reproducible path;
- the chat browser tab is remembered per Session and reused.

**Not an official DeepSeek product.** It depends on DeepSeek web internals (public share
endpoint + rendered page) and on the DSH Desktop profile for the embedded browser.

## License

[MIT](LICENSE) © 2026 Xumi0920.

The embedded DeepSeek brand artwork is MIT-licensed by DeepSeek; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
