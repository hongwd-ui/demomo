import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'chrome64',
    ...(mode === 'sketchup' ? { outDir: 'dist-sketchup', rolldownOptions: { output: { format: 'iife' as const, codeSplitting: false } } } : {}),
  },
  plugins: [react()],
}))
