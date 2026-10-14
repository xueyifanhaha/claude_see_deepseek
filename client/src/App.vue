<script setup>
import { ref, nextTick, watch } from 'vue';
import { useChat } from './composables/useChat';
import { md } from './utils/markdown';
import deepseekLogo from './assets/deepseek-logo.svg';

const { messages, streaming, error, send, stop } = useChat();

const input = ref('');
const listEl = ref(null);
const stickToBottom = ref(true);

function onSend() {
  const text = input.value.trim();
  if (!text || streaming.value) return;
  input.value = '';
  stickToBottom.value = true;
  send(text);
}

function onEnter(e) {
  if (!e.isComposing) onSend(); // IME 组词确认的 Enter 不触发发送
}

function onScroll() {
  const el = listEl.value;
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

// 流式追加时仅当用户贴近底部才跟随滚动，不抢用户正在回看的滚动位置
watch(
  () => messages.value.reduce((n, m) => n + m.content.length, 0),
  async () => {
    if (!stickToBottom.value) return;
    await nextTick();
    const el = listEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

<template>
  <div class="app">
    <van-nav-bar safe-area-inset-top>
      <template #left>
        <div class="brand"><span class="brand-dot"></span>DeepSeek Chat</div>
      </template>
      <template #right>
        <div class="status" :class="{ live: streaming }">
          <span class="status-dot"></span>{{ streaming ? '生成中' : '就绪' }}
        </div>
      </template>
    </van-nav-bar>

    <div v-if="error" class="error-banner">
      <span>请求失败：{{ error }}</span>
      <button class="error-dismiss" aria-label="关闭错误提示" @click="error = ''">×</button>
    </div>

    <main ref="listEl" class="chat-list" @scroll="onScroll">
      <div class="chat-inner">
        <div v-if="messages.length === 0" class="empty">
          <div class="empty-bubble">
            <img class="empty-logo" :src="deepseekLogo" alt="DeepSeek" />
          </div>
          <p>向 DeepSeek 提问，开始对话</p>
        </div>
        <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
          <div
            class="bubble"
            :class="{ streaming: streaming && i === messages.length - 1 }"
          >
            <!-- assistant 走 Markdown 渲染（消毒后），用户消息保持纯文本 -->
            <div v-if="m.role === 'assistant'" class="md" v-html="md(m.content)"></div>
            <template v-else>{{ m.content }}</template>
          </div>
        </div>
      </div>
    </main>

    <footer class="composer">
      <div class="composer-inner">
        <textarea
          v-model="input"
          :disabled="streaming"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows="1"
          @keydown.enter.exact.prevent="onEnter"
        ></textarea>
        <van-button
          round
          class="send-btn"
          :type="streaming ? 'danger' : 'primary'"
          :icon="streaming ? 'stop' : 'arrow-up'"
          :disabled="!input.trim() && !streaming"
          :aria-label="streaming ? '停止生成' : '发送'"
          @click="streaming ? stop() : onSend()"
        />
      </div>
    </footer>
  </div>
</template>
