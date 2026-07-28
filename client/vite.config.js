import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createHtmlPlugin } from 'vite-plugin-html';
import checker from 'vite-plugin-checker';
import path from 'path';

import { dependencies } from './package.json';
function renderChunks(deps) {
  let chunks = {};
  Object.keys(deps).forEach(key => {
    if (['react', 'react-router-dom', 'react-dom'].includes(key)) return;
    chunks[key] = [key];
  });
  return chunks;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, 'env');

  return {
    server: { hmr: true },
    plugins: [
      react({
        include: ['**/*.tsx', '**/*.ts'],
        // Fast Refresh вставляет в модуль преамбулу, которую в браузере ставит
        // index.html. Под vitest никакого index.html нет, и рендер компонента
        // падает на «can't detect preamble» ещё до первого теста.
        fastRefresh: !process.env.VITEST,
      }),
      tsconfigPaths(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            ...env,
            MODE: mode,
          },
        },
      }),
      checker({ typescript: { tsconfigPath: './tsconfig.json' } }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/'),
        '@root': path.resolve(__dirname, '..'),
      },
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      postcss: ctx => ({
        parser: ctx.parser ? 'sugarss' : false,
        map: ctx.env === 'development' ? ctx.map : false,
        plugins: {
          'postcss-import': {},
          'postcss-nested': {},
          cssnano: ctx.env === 'production' ? {} : false,
          autoprefixer: { overrideBrowserslist: ['defaults'] },
        },
      }),
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-router-dom', 'react-dom'],
            ...renderChunks(dependencies),
          },
        },
      },
    },
    test: {
      globals: true,
      // Полифилл localStorage: сторы персистятся по пер-проектным ключам, и
      // подменить хранилище из тела теста уже поздно — см. vitest.setup.ts.
      setupFiles: ['./vitest.setup.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  };
});
