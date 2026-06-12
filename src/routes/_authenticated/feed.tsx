import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyFeed } from "@/lib/photos.functions";
import { ImageOff, Play, Sparkles, Send, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "내 피드 — Snappy" }] }),
  component: FeedPage,
});

function isVideo(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

function FeedPage() {
  const fetchFeed = useServerFn(getMyFeed);
  const { data, isLoading } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  const photos = data?.photos ?? [];

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <span className="chip"><Sparkles className="h-3.5 w-3.5" /> 오늘 도착한 컷</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold">내 피드</h1>
        </div>
        <p className="text-xs text-muted-foreground">{photos.length}개</p>
      </header>

      {/* Quick send shortcut */}
      <Link
        to="/upload"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 p-3 shadow-[0_12px_30px_-18px_rgba(56,189,248,0.5)] backdrop-blur"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">빠르게 보내기</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Search className="h-3 w-3" />@핸들로 받는 사람 찾기</p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">→</span>
      </Link>

      {photos.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sky-soft">
            <ImageOff className="h-6 w-6 text-foreground" />
          </div>
          <h2 className="font-display mt-4 text-lg font-bold">아직 받은 컷이 없어요</h2>
          <p className="mt-1 text-sm text-muted-foreground">친구가 보내면 여기에 톡 도착해요 📬</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => {
            const video = isVideo(p.preview_url);
            return (
              <Link
                key={p.id}
                to="/photo/$id"
                params={{ id: p.id }}
                className="group relative block overflow-hidden rounded-[1.5rem] border border-white/70 bg-card shadow-[0_15px_40px_-20px_rgba(125,160,200,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_50px_-20px_rgba(125,160,200,0.55)]"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                  {p.preview_url ? (
                    video ? (
                      <video src={p.preview_url} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={p.preview_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    )
                  ) : null}
                  <div className="absolute left-2.5 top-2.5 chip !bg-white/90 !backdrop-blur">
                    {video ? <Play className="h-3 w-3" /> : null}
                    @{p.uploader?.handle ?? "?"}
                  </div>
                  <div className="absolute right-2.5 top-2.5 rounded-full bg-foreground/85 px-2 py-0.5 text-[11px] font-bold text-background backdrop-blur">
                    ${(p.price_cents / 100).toFixed(2)}
                  </div>
                  {p.status === "sold" && (
                    <div className="absolute bottom-2.5 left-2.5 chip !bg-primary !text-primary-foreground !border-primary/40">완료 ✓</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}