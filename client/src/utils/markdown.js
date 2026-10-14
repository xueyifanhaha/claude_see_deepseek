import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 外链统一新窗口打开 + 防 tabnabbing
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Markdown → 安全 HTML。marked 只解析不消毒，AI 内容 v-html 前必须经 DOMPurify
export function md(text) {
  return DOMPurify.sanitize(marked.parse(text ?? ''));
}
