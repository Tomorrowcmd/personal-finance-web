import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 本地后端默认地址（Java 21 + Spring Boot 4）
const DEFAULT_PROXY_TARGET = 'http://localhost:9081'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 第三个参数传 '' 表示连带加载非 VITE_ 前缀的变量，
  // 这样代理地址这类「只在 Node 侧生效」的配置不会被打包进前端产物
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget = env.API_PROXY_TARGET?.trim() || DEFAULT_PROXY_TARGET

  // 前后端统一约定：接口都挂在 /api 下，后端 context-path 也是 /api，
  // 所以不做 rewrite；dev 与生产（Nginx 反代 /api）的路径行为保持一致
  const proxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
    },
  }

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // dev server 代理，解决浏览器同源限制
    server: {
      proxy,
    },
    // vite preview 同样走代理，方便本地验证生产构建
    preview: {
      proxy,
    },
    build: {
      // ECharts 单独成 chunk（约 535 KB）且已改为异步加载，
      // 默认 500 KB 的告警会一直出现，这里放宽到 600 KB
      chunkSizeWarningLimit: 600,
    },
  }
})
