import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, "/");
}

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = normalizeModuleId(id);

          if (!normalizedId.includes("node_modules")) {
            return undefined;
          }

          if (normalizedId.includes("node_modules/react-dom")) {
            return "react-dom";
          }

          if (
            normalizedId.includes("node_modules/react-router-dom") ||
            normalizedId.includes("node_modules/react-router") ||
            normalizedId.includes("node_modules/@remix-run")
          ) {
            return "router";
          }

          if (normalizedId.includes("node_modules/react") || normalizedId.includes("node_modules/scheduler")) {
            return "react-core";
          }

          if (normalizedId.includes("node_modules/@tauri-apps")) {
            return "tauri";
          }

          if (normalizedId.includes("node_modules/lucide-react")) {
            return "icons";
          }

          if (
            normalizedId.includes("node_modules/antd/") ||
            normalizedId.includes("node_modules/@ant-design/") ||
            normalizedId.includes("node_modules/rc-")
          ) {
            return "ui";
          }

          return "ui";
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "antd/es/alert",
      "antd/es/app",
      "antd/es/button",
      "antd/es/card",
      "antd/es/checkbox",
      "antd/es/col",
      "antd/es/config-provider",
      "antd/es/dropdown",
      "antd/es/empty",
      "antd/es/form",
      "antd/es/input",
      "antd/es/list",
      "antd/es/message",
      "antd/es/modal",
      "antd/es/popconfirm",
      "antd/es/progress",
      "antd/es/radio",
      "antd/es/row",
      "antd/es/segmented",
      "antd/es/select",
      "antd/es/space",
      "antd/es/spin",
      "antd/es/statistic",
      "antd/es/switch",
      "antd/es/table",
      "antd/es/tabs",
      "antd/es/tag",
      "antd/es/tooltip",
      "antd/es/typography",
      "antd/locale/zh_CN",
    ],
  },
  test: {
    environment: "jsdom",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/**",
      "**/.worktrees/**",
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
