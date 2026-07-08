/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  // testTimeout: plnosezónní simulace legitimně běží jednotky sekund; 5s default kolísá se zátěží stroje
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 },
})
