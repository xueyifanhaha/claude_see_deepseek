# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- DeepSeek logo 空状态：无消息时气泡内显示 DeepSeek 鲸鱼 logo，SVG 资产落盘 `client/src/assets/`（2026-10-15，`fbef7c1`）
- AI 回复 Markdown 富文本渲染：marked 解析 + DOMPurify 消毒，支持标题/列表/代码块/表格（宽表格移动端可横向滚动）；用户消息保持纯文本（2026-10-14，`393c8a4`）
- Vant 4 移动端 UI 框架：van-nav-bar（安全区适配）、圆形图标发送/停止按钮、主题色映射、≤768px 移动端适配（输入框 16px 防 iOS 聚焦缩放、按压反馈）（2026-10-14，`1bc33d2`）
- SSE 流式 AI 对话应用初始版本：Express 后端调 DeepSeek 流式接口并转 SSE 推流；Vue3 + Vite 前端 fetch + ReadableStream 逐帧渲染；两段式错误协议（流开始前 JSON 状态码、流开始后 error 事件）（2026-10-14，`f4520c4`）

### Fixed

- 流式回复一次性渲染：assistant 消息对象改为 `reactive`，每个 delta 触发一次渲染，恢复打字机流式效果（2026-10-14，`ebd14ad`）

### Changed

- 样式迁移至 SCSS 并拆分模块：`src/styles/` 统一管理（index.scss 入口，@use 引入 _reset/_markdown partial），main.js 单一引入（2026-10-14，`79c623b`）
