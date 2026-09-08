import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 프로젝트 사이트 주소가 /health/ 이므로 자원 경로 앞에 붙입니다.
  // 다른 곳에 올릴 때는 BASE_PATH 환경변수로 바꿀 수 있습니다.
  base: process.env.BASE_PATH ?? '/health/',
  plugins: [react()],
  server: { host: true, port: 5173 },
  // Firebase 청크는 필요할 때만 내려받으므로 초기 로딩에 영향이 없습니다.
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
