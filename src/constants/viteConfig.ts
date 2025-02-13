const VITE_CONFIG = `
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  ~~vite-imports~~

  // https://vitejs.dev/config/
  export default defineConfig({
    plugins: [react(), ~~vite-plugins~~],
  });
`;

export default VITE_CONFIG;
