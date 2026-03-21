import { defineConfig } from 'vite';

/*
 * По умолчанию относительные пути — один и тот же dist работает и на github.io/username/repo/,
 * и в корне домена, без обязательного VITE_BASE_PATH. Явный префикс (например /fifa/) — через env.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
});
