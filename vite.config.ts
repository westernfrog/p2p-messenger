import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:lan` serves over HTTPS on the local network so phones can open
// the app: browsers only allow camera access (QR scanning) on secure origins.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'lan' ? [basicSsl()] : [],
}))
