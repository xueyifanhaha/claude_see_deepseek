// 调 DeepSeek 流式接口。
// openDeepSeekStream: 发起请求并校验响应（只等响应头，不读 body）；失败抛异常，由路由层转 502 JSON
// parseUpstreamStream: 把上游 SSE body 解析为统一事件流：
//   yield { type: 'delta', content }  内容增量
//   return                            收到 [DONE] 正常结束
//   抛异常                             流中途断开
export async function openDeepSeekStream(messages, signal) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: 'deepseek-chat', messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    // 401 密钥错 / 402 余额不足 / 429 / 5xx
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `上游返回 ${res.status}`);
  }
  return res.body;
}

export async function* parseUpstreamStream(body) {
  let buf = '';
  const dec = new TextDecoder();
  for await (const chunk of body) {
    // CRLF 归一 + 流式解码（处理跨 chunk 的多字节字符），按 \n\n 切帧
    buf += dec.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue; // 跳过 ': keep-alive' 等注释行
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          // 首帧只有 role、尾帧只有 finish_reason，content 为空时跳过
          if (delta) yield { type: 'delta', content: delta };
        } catch {
          // 半截 JSON 或坏帧：忽略，靠后续帧 / [DONE] / 断连兜底
        }
      }
    }
  }
}
