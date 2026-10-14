// 消费 fetch 响应的 SSE 流，按帧回调 onEvent
// 协议：data: {"type":"delta"|"done"|"error", ...}，\n\n 分帧
// 遇到 {"type":"error"} 直接抛错，由调用方统一 catch
export async function readSSE(response, { onEvent }) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  const emit = (frame) => {
    for (const line of frame.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return onEvent({ type: 'done' }); // 防御性兼容
      const ev = JSON.parse(payload);
      if (ev.type === 'error') throw new Error(ev.message);
      onEvent(ev);
    }
  };

  while (true) {
    const { done, value } = await reader.read(); // fetch 被 abort 时这里抛 AbortError
    if (done) break;
    // CRLF 归一 + 流式解码（处理跨 chunk 的多字节字符），按 \n\n 切帧
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      emit(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
    }
  }
}
