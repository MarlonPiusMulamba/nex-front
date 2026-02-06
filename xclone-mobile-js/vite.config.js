import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: '/',
    define: {
      'process.env': { ...env }
    },
    plugins: [
      vue(),
      wasm(),
      topLevelAwait({
        // The export name of top-level await promise for each chunk module
        promiseExportName: "__tla",
        // The function to generate import names of top-level await promise in each chunk module
        promiseImportName: i => `__tla_${i}`
      }),
      basicSsl()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // DEVELOPMENT SERVER
    server: {
      host: '0.0.0.0',
      port: 5173,
      open: true,
      strictPort: true,
      https: true,
      proxy: {
        '/api': {
          target: 'https://localhost:5000',
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: 'https://localhost:5000',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },
    // PREVIEW (after build)
    preview: {
      port: 5173,
      open: true,
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    }
  };
});