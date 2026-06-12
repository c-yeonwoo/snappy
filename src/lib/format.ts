// 순수 포맷 유틸. (구 mock-feed.ts에서 분리 — 실DB 연결 후 mock 데이터는 제거)

/** 포인트 표시. 1원 = 1P */
export function formatPoint(p: number) {
  return `${p.toLocaleString("ko-KR")}P`;
}

/** @deprecated formatPoint 사용 */
export const formatWon = formatPoint;

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

// "NEW" 배지 — 최근 24시간 이내 수신
export function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

// 받기 설정(allow window) 남은 시간 "M:SS"
export function formatRemaining(untilIso: string) {
  const ms = Math.max(0, new Date(untilIso).getTime() - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function isWindowOpen(untilIso: string | null | undefined): untilIso is string {
  return !!untilIso && new Date(untilIso).getTime() > Date.now();
}
