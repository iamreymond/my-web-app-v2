import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    // This server-only setting is not prefixed VITE_, so it is not shipped to the browser.
    const env = loadEnv(mode, process.cwd(), '')
    const proxy = {
        '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
    }
    return {
        // Enables React development tooling and production compilation.
        plugins: [react()],
        // Same-origin browser requests reach Express through Vite during local development.
        server: { port: 5173, strictPort: true, proxy },
        preview: { port: 4173, strictPort: true, proxy },
    }
})
