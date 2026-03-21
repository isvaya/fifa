import { defineConfig } from 'vite';

// На GitHub Pages проект живёт в подпапке /fifa/; локально — корень /
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
});
