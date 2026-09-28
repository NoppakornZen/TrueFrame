import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Optional dev proxy: keeps the AI gateway key server-side (never in the
// browser bundle) and sidesteps CORS during development. Enable by setting
// AI_PROXY_TARGET (and optionally AI_PROXY_KEY) in the shell before `npm run dev`,
// then point VITE_AI_BASE_URL=/__ai in .env.local.
const proxyTarget = process.env.AI_PROXY_TARGET
const proxy = proxyTarget
  ? {
      '/__ai': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/__ai/, ''),
        ...(process.env.AI_PROXY_KEY
          ? { headers: { Authorization: `Bearer ${process.env.AI_PROXY_KEY}` } }
          : {}),
      },
    }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    open: true,
    proxy,
  },
})
