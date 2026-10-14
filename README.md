# SSE 流式 AI 对话应用

基于 SSE（Server-Sent Events）的流式 AI 聊天应用：Express 后端调用 DeepSeek API，把上游流转换为干净的 SSE 事件推给浏览器；Vue3 + Vite 前端用 `fetch` + `ReadableStream` 逐帧解析，实现 token 级流式渲染。

## 环境要求

- Node.js ≥ 20.6（使用内置 `fetch` 与 `--env-file`，实测 20.18 可用）

## 启动

1. 配置密钥：复制 `server/.env.example` 为 `server/.env`，填入 `DEEPSEEK_API_KEY`（在 https://platform.deepseek.com 获取）
2. 启动后端（端口 3000）：

   ```bash
   cd server
   npm install
   npm run dev
   ```

3. 另开终端启动前端：

   ```bash
   cd client
   npm install
   npm run dev
   ```

4. 浏览器打开 http://localhost:5173

## 架构

- **线协议**：`POST /api/chat` 请求体 `{"messages":[{"role","content"}]}`；成功响应 `Content-Type: text/event-stream`，帧序列为 `data: {"type":"delta","content":"..."}`，结束发 `data: {"type":"done"}`。错误分两段：流未开始（无密钥、上游非 200）返回普通 JSON；流开始后出错发 `data: {"type":"error","message":"..."}`
- **后端** `server/src/`：`deepseek.js` 调上游并解析上游 SSE 为 async generator；`index.js` 负责路由、SSE 写出、客户端断开时 abort 上游
- **前端** `client/src/`：`api/sse.js` 纯函数流解析器；`composables/useChat.js` 会话状态机（多轮历史全量重发、停止、错误回滚）；`utils/markdown.js` AI 回复的 Markdown 渲染（marked + DOMPurify 消毒）；`App.vue` 界面
- 多轮对话：客户端持有完整 messages 数组，每次全量重发，服务端无状态

## 排障

| 现象 | 原因 / 处理 |
|---|---|
| 提示"余额不足" | DeepSeek 账户余额用尽，前往 platform.deepseek.com 充值 |
| 提示"API 密钥无效" | 检查 `server/.env` 中的 `DEEPSEEK_API_KEY` |
| 浏览器请求 `/api` 失败 | 后端没启动，或 3000 端口被占（可用 `PORT` 环境变量改端口，同步改 `client/vite.config.js` 代理 target） |
| 5173 端口被占 | Vite 会自动改用 5174 并在终端打印实际地址；也可改 `client/vite.config.js` 的 `server.port` |

## 扩展方向

- 代码高亮（highlight.js）
- 历史过长时截断上下文
- 会话保存 / 多会话切换
