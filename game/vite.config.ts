import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5174,
  },
  define: {
    // В dev-режиме проект не встроен — загружается из UI
    __GU_PROJECT__: "undefined",
  },
});
