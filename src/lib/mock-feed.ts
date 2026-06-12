// Frontend-only mock feed data. Replaces server calls while the Spring/AWS
// backend is not connected yet. Purchase state persists in localStorage so the
// UI flow (구매 → 워터마크 풀림 → 다운로드) feels real during design review.
import { useSyncExternalStore } from "react";

const PURCHASED_KEY = "snappy.purchased.v1";

export type MockPhoto = {
  id: string;
  uploader: { handle: string; display_name: string };
  preview_url: string;
  original_url: string; // unwatermarked preview used after "purchase"
  is_video: boolean;
  price_cents: number;
  note?: string;
  received_at: string; // ISO
  tone: string; // gradient classes for placeholder
};

// Using picsum + a stable seed gives us pleasant, free, on-theme sample images.
const img = (seed: string, w = 600, h = 750) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const MOCK_PHOTOS: MockPhoto[] = [
  { id: "p01", uploader: { handle: "yuna",   display_name: "유나" }, preview_url: img("snappy-yuna"),   original_url: img("snappy-yuna",1200,1500),   is_video: false, price_cents: 300, note: "한강에서 한 컷!",            received_at: "2026-06-12T09:10:00Z", tone: "from-sky-soft to-sky" },
  { id: "p02", uploader: { handle: "minho",  display_name: "민호" }, preview_url: img("snappy-minho"),  original_url: img("snappy-minho",1200,1500),  is_video: true,  price_cents: 500, note: "점프샷 영상이야",            received_at: "2026-06-12T08:42:00Z", tone: "from-sky to-accent" },
  { id: "p03", uploader: { handle: "jiwoo",  display_name: "지우" }, preview_url: img("snappy-jiwoo"),  original_url: img("snappy-jiwoo",1200,1500),  is_video: false, price_cents: 400,                                    received_at: "2026-06-12T07:21:00Z", tone: "from-accent/70 to-sky-deep/40" },
  { id: "p04", uploader: { handle: "sora",   display_name: "소라" }, preview_url: img("snappy-sora"),   original_url: img("snappy-sora",1200,1500),   is_video: false, price_cents: 300, note: "이거 진짜 잘나왔다 ㅎㅎ",     received_at: "2026-06-11T22:05:00Z", tone: "from-accent/60 to-sky" },
  { id: "p05", uploader: { handle: "dan",    display_name: "단" },   preview_url: img("snappy-dan"),    original_url: img("snappy-dan",1200,1500),    is_video: true,  price_cents: 600,                                    received_at: "2026-06-11T19:34:00Z", tone: "from-sky-deep/40 to-sky" },
  { id: "p06", uploader: { handle: "hye",    display_name: "혜진" }, preview_url: img("snappy-hye"),    original_url: img("snappy-hye",1200,1500),    is_video: false, price_cents: 400,                                    received_at: "2026-06-11T13:10:00Z", tone: "from-sky-soft to-sky-deep/30" },
  { id: "p07", uploader: { handle: "junho",  display_name: "준호" }, preview_url: img("snappy-junho"),  original_url: img("snappy-junho",1200,1500),  is_video: false, price_cents: 300, note: "노을 진짜 미쳤지",            received_at: "2026-06-10T18:55:00Z", tone: "from-sky to-sky-deep/40" },
  { id: "p08", uploader: { handle: "mira",   display_name: "미라" }, preview_url: img("snappy-mira"),   original_url: img("snappy-mira",1200,1500),   is_video: false, price_cents: 500,                                    received_at: "2026-06-10T15:01:00Z", tone: "from-sky-soft to-accent/60" },
  { id: "p09", uploader: { handle: "rae",    display_name: "래" },   preview_url: img("snappy-rae"),    original_url: img("snappy-rae",1200,1500),    is_video: true,  price_cents: 700, note: "걸어가는 거 찍어봤어",        received_at: "2026-06-10T11:20:00Z", tone: "from-accent to-sky" },
  { id: "p10", uploader: { handle: "siwon",  display_name: "시원" }, preview_url: img("snappy-siwon"),  original_url: img("snappy-siwon",1200,1500),  is_video: false, price_cents: 300,                                    received_at: "2026-06-09T20:00:00Z", tone: "from-sky to-sky-soft" },
  { id: "p11", uploader: { handle: "bom",    display_name: "봄" },   preview_url: img("snappy-bom"),    original_url: img("snappy-bom",1200,1500),    is_video: false, price_cents: 400, note: "벚꽃 마지막 컷",              received_at: "2026-06-09T14:42:00Z", tone: "from-sky-soft to-accent" },
  { id: "p12", uploader: { handle: "tae",    display_name: "태" },   preview_url: img("snappy-tae"),    original_url: img("snappy-tae",1200,1500),    is_video: false, price_cents: 500,                                    received_at: "2026-06-08T09:18:00Z", tone: "from-sky-deep/50 to-accent/60" },
];

// ----------------- purchased store (localStorage) -----------------
const listeners = new Set<() => void>();
function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(PURCHASED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
let cached = readSet();
function emit() {
  cached = readSet();
  listeners.forEach((l) => l());
}

export function purchase(id: string) {
  const s = readSet();
  s.add(id);
  localStorage.setItem(PURCHASED_KEY, JSON.stringify(Array.from(s)));
  emit();
}
export function isPurchased(id: string) {
  return cached.has(id);
}

export function usePurchased() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cached,
    () => cached,
  );
}

export function getMockPhoto(id: string) {
  return MOCK_PHOTOS.find((p) => p.id === id);
}

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

// "New" = received within the last 24h AND not purchased yet.
export function isNew(p: MockPhoto, purchased: Set<string>) {
  if (purchased.has(p.id)) return false;
  return Date.now() - new Date(p.received_at).getTime() < 24 * 60 * 60 * 1000;
}