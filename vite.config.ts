import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { repositorySnapshot } from './tooling/repositorySnapshot.ts'

export default defineConfig({
  base: './',
  plugins: [repositorySnapshot(), react()],
  server: { port: 5174, strictPort: true },
  test: { include: ['src/**/*.test.ts', 'tooling/**/*.test.ts'], environment: 'node' },
})
