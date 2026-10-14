import { ref } from 'vue';
import { readSSE } from '../api/sse';

// 常见错误映射为可行动的提示，其余原样透传
const ERROR_HINTS = [
  [/insufficient balance/i, '余额不足，请前往 platform.deepseek.com 充值'],
  [/invalid api key|authentication/i, 'API 密钥无效，请检查 server/.env 中的 DEEPSEEK_API_KEY'],
];

function friendlyError(msg) {
  for (const [re, hint] of ERROR_HINTS) {
    if (re.test(msg)) return hint;
  }
  return msg;
}

export function useChat() {
  const messages = ref([]); // [{ role, content }]
  const streaming = ref(false);
  const error = ref('');
  let controller = null;

  async function send(text) {
    if (streaming.value || !text.trim()) return;
    error.value = '';
    controller = new AbortController();

    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '' };
    // 请求体只含历史 + 新用户消息，不含空的 assistant 占位
    const payload = [...messages.value, userMsg].map(({ role, content }) => ({ role, content }));
    messages.value.push(userMsg, assistantMsg); // 占位先入列，UI 立即出现空助手气泡
    streaming.value = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // 流未开始的 JSON 错误（400/500/502）
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await readSSE(res, {
        onEvent: (ev) => {
          if (ev.type === 'delta') assistantMsg.content += ev.content;
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        // 用户点停止不算错误，保留半截内容
        error.value = friendlyError(err.message);
        if (!assistantMsg.content) {
          // 首个 token 都没到就失败：撤掉空气泡
          messages.value = messages.value.filter((m) => m !== assistantMsg);
        }
      }
    } finally {
      streaming.value = false;
      controller = null;
    }
  }

  function stop() {
    controller?.abort();
  }

  return { messages, streaming, error, send, stop };
}
