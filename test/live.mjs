/**
 * 手动联网冒烟脚本（默认不进入 node --test）。
 *
 * 运行：
 *   node test/live.mjs
 *   node test/live.mjs <shareId>
 *   node test/live.mjs https://chat.deepseek.com/share/<shareId>
 *
 * 注意：会真实访问 chat.deepseek.com；本文件放在 test/ 下，`node --test`
 * 默认会把 test/ 下的 .mjs 当测试文件执行，因此检测到测试运行环境时
 * 自动跳过联网，保证默认测试完全离线。
 */
import { parseShareInput, fetchShare, buildSeedPrompt } from '../src/share.js';

const DEFAULT_SHARE_URL = process.env.DEEPSEEK_SHARE_URL || '';

// node:test 子进程里有 NODE_TEST_CONTEXT / NODE_TEST_WORKER_ID；手动运行则没有。
if (process.env.NODE_TEST_CONTEXT || process.env.NODE_TEST_WORKER_ID) {
  console.log('[live] 检测到 node:test 运行环境，跳过联网冒烟测试。');
  console.log('[live] 需要联网验证请直接运行：node test/live.mjs');
  process.exit(0);
}

const input = process.argv[2] || DEFAULT_SHARE_URL;
if (!input) {
  console.error('用法：node test/live.mjs <shareId | shareUrl>，或先设置 DEEPSEEK_SHARE_URL 环境变量。');
  process.exit(2);
}
const parsed = parseShareInput(input);
if (parsed.kind !== 'share') {
  console.error(`[live] 无法从入参中解析分享 ID：${JSON.stringify(input)}（kind=${parsed.kind}）`);
  process.exit(1);
}

const startedAt = Date.now();
try {
  const share = await fetchShare(parsed.shareId, { timeoutMs: 20000 });
  const prompt = buildSeedPrompt(share);
  const elapsed = Date.now() - startedAt;

  console.log('=== DeepSeek 分享解析摘要 ===');
  console.log(`分享 ID    : ${share.shareId}`);
  console.log(`原始 URL   : ${share.url}`);
  console.log(`标题       : ${share.title}`);
  console.log(`模型       : ${share.modelType ?? '（未提供）'}`);
  console.log(
    `消息       : ${share.stats.total} 条（用户 ${share.stats.user} / DeepSeek ${share.stats.assistant}）`,
  );
  console.log(`正文字符数 : ${share.stats.chars}`);
  console.log(`markdown   : ${share.markdown.length} 字符`);
  console.log(`seed prompt: ${prompt.length} 字符（截断=${prompt.includes('已截断')}）`);
  console.log(`耗时       : ${elapsed}ms`);

  console.log('--- 各条消息预览 ---');
  share.messages.forEach((message, index) => {
    const role = message.role === 'user' ? '用户' : 'DeepSeek';
    const preview = message.text.replace(/\s+/g, ' ').slice(0, 80);
    console.log(`#${index + 1} ${role}（${message.text.length} 字）: ${preview}…`);
  });

  console.log('--- markdown 前 400 字符 ---');
  console.log(share.markdown.slice(0, 400));
} catch (error) {
  console.error(`[live] 联网冒烟失败（${error.code ?? 'NO_CODE'}）：${error.message}`);
  if (error.cause) console.error(`[live] cause: ${error.cause.message ?? error.cause}`);
  process.exitCode = 1;
}

