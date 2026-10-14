import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';

export default defineConfig({
  plugins: [
    vue(),
    Components({ resolvers: [VantResolver()] }), // Vant 按需自动引入 + 样式按需加载
  ],
  server: {
    proxy: {
      // 用 127.0.0.1 强制 IPv4，避开 Windows 上 localhost 解析到 ::1 的坑
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
});
