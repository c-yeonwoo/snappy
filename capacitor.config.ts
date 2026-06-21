import type { CapacitorConfig } from "@capacitor/cli";

// Snappy 네이티브 셸 — TanStack Start는 SSR이라 정적번들이 아님.
// 네이티브 앱은 "배포된 Snappy 웹"을 server.url 로 로드하는 래퍼 + 네이티브 플러그인.
// 실제 배포 도메인으로 CAP_SERVER_URL 을 설정하거나 아래 기본값을 바꿔줘.
const SERVER_URL = process.env.CAP_SERVER_URL ?? "https://snap-buddy.vercel.app";

const config: CapacitorConfig = {
  appId: "app.snappy.mobile", // 스토어 등록 전 확정 (변경 어려움)
  appName: "Snappy",
  webDir: "capacitor-shell", // server.url 사용 시 오프라인 폴백용 최소 셸
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  ios: {
    // 안전영역은 CSS env()로만 처리 (contentInset과 이중 적용 방지)
    contentInset: "never",
    // WKWebView 자체 스크롤/바운스 끔 → 내부 CSS 컨테이너만 스크롤 (네이티브 느낌)
    scrollEnabled: false,
  },
};

export default config;
