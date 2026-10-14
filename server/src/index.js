import express from 'express';
import { openDeepSeekStream, parseUpstreamStream } from './deepseek.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });
  }

  const ac = new AbortController();
  // 客户端断开（fetch abort / 关标签页）→ 终止上游
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });

  // 先建上游流（只等响应头）。此时响应头还没发，失败仍可返回普通 JSON，HTTP 语义正确
  let upstream;
  try {
    upstream = await openDeepSeekStream(messages, ac.signal);
  } catch (err) {
    if (err.name === 'AbortError') return; // 客户端已断开，socket 已死，写不出去
    return res.status(502).json({ error: err.message });
  }

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // 防未来挂 nginx 被缓冲
  });
  res.flushHeaders(); // 上游已确认 OK，立刻发头，浏览器即刻进入流模式

  const alive = () => !res.writableEnded && !res.destroyed;
  const sse = (obj) => alive() && res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    for await (const ev of parseUpstreamStream(upstream)) {
      sse(ev);
    }
    sse({ type: 'done' });
  } catch (err) {
    // AbortError = 客户端断开主动 abort，socket 已死，无需也写不出去
    if (err.name !== 'AbortError') {
      sse({ type: 'error', message: err.message });
    }
  } finally {
    if (alive()) res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SSE server: http://localhost:${PORT}`));
