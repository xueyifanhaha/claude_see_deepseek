# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

SSE 流式 AI 对话应用：Express 后端调 DeepSeek API（`stream: true`），把上游 SSE 解析后重新封装成干净的 `data: {"type":...}` 帧推给浏览器；Vue3 + Vite 前端用 `fetch` + `ReadableStream` 逐帧解析渲染（不用 EventSource——它只支持 GET，聊天必须 POST）。多轮对话无服务端状态：客户端持有完整 messages 数组每次全量重发。

## 常用命令

```bash
# 后端（端口 3000；依赖 server/.env 中的 DEEPSEEK_API_KEY，Node ≥ 20.6 的 --env-file）
cd server && npm run dev

# 前端（端口 5173，被占时 Vite 自动回落 5174，以终端打印为准）
cd client && npm run dev

# 验证后端流式输出
curl -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

后端唯一依赖 express（HTTP 用 Node 内置 fetch，环境变量用 `--env-file`，不引入 axios/dotenv）。仓库无测试套件，改动后验证靠上述 curl + 浏览器手动确认。

## 架构

### 线协议（POST /api/chat）

- 请求体 `{"messages":[{"role","content"}]}`
- 成功：`Content-Type: text/event-stream`，帧序列 `data: {"type":"delta","content":"..."}`，结尾 `data: {"type":"done"}`
- 错误分两段：**流未开始**（参数非法、无密钥、上游非 200）返回普通 JSON（400/500/502）；**流开始后**出错发 `data: {"type":"error","message":"..."}` 再结束。前端据此只有 `res.ok` 判断 + error 事件抛错两条路径
- 上游的 `[DONE]`、心跳注释行（`:` 开头）、CRLF 全部由后端消化，前端只收干净 JSON

### 后端 server/src/

- `deepseek.js`：`openDeepSeekStream(messages, signal)` 只等响应头、失败抛异常（由路由层转 502 JSON）；`parseUpstreamStream(body)` 是 async generator，把上游 SSE 解析为 `{type:'delta'|'done'|'error'}` 事件
- `index.js`：路由 + SSE 写出。客户端断开检测在 `res.on('close')`（SSE 下请求流保持打开，断开信号在 response 侧），配合 `writableEnded`/`destroyed` 守卫防止向死 socket 写入；断开时 `AbortController` 终止上游请求

### 前端 client/src/

- `api/sse.js`：`readSSE(response, { onEvent })` 纯函数流解析器，与后端同一套帧切分算法
- `composables/useChat.js`：会话状态机——发送前先 push 空的 assistant 占位气泡；`AbortError`（用户点停止）不算错误、保留半截内容；首个 token 前失败则撤掉空气泡；常见错误映射为可行动提示（如 402 → 充值指引）
- `App.vue`：自动滚动只在用户贴近底部时跟随；IME 组词 Enter（`isComposing`）不触发发送

### 关键不变量（改动前必读）

1. **顺序**：必须先在 `openDeepSeekStream` 成功后（上游确认 200）再 `res.flushHeaders()`。顺序颠倒会导致上游错误时状态码只能是 200，错误被迫塞进流里，破坏两段式错误协议
2. **帧切分算法**：缓冲 + `\n\n` 分帧 + `\r\n→\n` 归一 + `TextDecoder(stream:true)`（跨 chunk 多字节）。前后端各一份实现，改协议格式时两侧同步
3. **DeepSeek 帧结构**：首帧只有 `delta.role`、尾帧只有 `finish_reason`，均无 content——解析时必须跳过空 content，靠 `[DONE]` 判定结束
4. **Vite 代理 target 用 `127.0.0.1`** 而非 localhost（Windows 上 localhost 可能解析为 IPv6 `::1` 导致 ECONNREFUSED）
5. assistant 消息经 `client/src/utils/markdown.js`（marked 解析 + DOMPurify 消毒）渲染 Markdown 富文本；**任何改动不得绕过消毒直接 v-html**。用户消息保持纯文本不解析
6. `server/.env` 已被 gitignore，密钥绝不入库

## 环境注意

- 本机 5173 端口长期被其他程序占用，实际开发地址常为 5174
- Git 仓库在 `D:\0328\sse` 内单独 init（上级 D:\ 的仓库状态被全盘文件污染，勿在上级目录做 git 操作）
- README.md 有面向使用者的排障表（402 余额不足、401 密钥错误等），改动协议或启动方式时同步更新
