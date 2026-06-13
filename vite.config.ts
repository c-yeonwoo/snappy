// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // 배포 타겟: Vercel. nitro 를 명시적으로 켜고 vercel 프리셋으로 고정.
  // (lovable 설정 기본값은 cloudflare-module 이라 override 필요)
  // 다른 타겟으로 바꾸려면 NITRO_PRESET 환경변수 사용 (예: cloudflare-module).
  nitro: {
    preset: process.env.NITRO_PRESET ?? "vercel",
  },
});
