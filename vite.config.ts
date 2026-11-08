import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev:lan` serves over HTTPS on the local network so phones can open
// the app: browsers only allow camera access (QR scanning) on secure origins.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'lan' ? [basicSsl()] : [])],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
}))
