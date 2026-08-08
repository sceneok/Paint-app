import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" — GitHub Pages 프로젝트 페이지( /Paint-app/ )에서도 동작하도록 상대 경로 사용
export default defineConfig({
  base: "./",
  plugins: [react()],
});
