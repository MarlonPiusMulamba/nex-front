import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    define: {
      'process.env': { ...env }
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // DEVELOPMENT SERVER
    server: {
      host: 'localhost',
      port: 5173,
      open: true,
      strictPort: true,
    },
    // PREVIEW (after build)
    preview: {
      port: 4173,
      open: true,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  };
});