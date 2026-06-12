import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ImageOff, Play, Inbox, Send, Search, BookmarkCheck, Lock } from "lucide-react";
import { MOCK_PHOTOS, usePurchased, isNew, relativeTime, formatWon } from "@/lib/mock-feed";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "받은함 — Snappy" }] }),
  component: FeedPage,
});

function FeedPage() {
  const purchased = usePurchased();
  const [tab, setTab] = useState<"received" | "album">("received");

  // "받은 사진" keeps every photo I haven't purchased yet (no auto-delete).
  // "내 앨범" is the collection of photos I've bought the original of.
  const received = MOCK_PHOTOS.filter((p) => !purchased.has(p.id));
  const album = MOCK_PHOTOS.filter((p) => purchased.has(p.id));
  const photos = tab === "received" ? received : album;
  const newCount = received.filter(isNew).length;

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <span className="chip"><Inbox className="h-3.5 w-3.5" /> 내 피드</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold">
            {tab === "received" ? "받은 사진" : "내 앨범"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "received"
              ? "친구들이 보내준 모든 컷. 워터마크 위에서 골라보세요."
              : "내가 결제해서 원본으로 가지고 있는 컷."}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{photos.length}개</p>
      </header>

      {/* Tabs */}
      <div className="mb-4 inline-flex w-full rounded-full border border-border bg-card/80 p-1 backdrop-blur">
        {(["received", "album"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-foreground text-background shadow" : "text-muted-foreground"}`}
          >
            {t === "received" ? `받은 사진 · ${received.length}` : `내 앨범 · ${album.length}`}
            {t === "received" && newCount > 0 && tab !== "received" && (
              <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{newCount}</span>
            )}
          </button>
        ))}
      </div>

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
            {tab === "received" ? <ImageOff className="h-6 w-6 text-foreground" /> : <BookmarkCheck className="h-6 w-6 text-foreground" />}
          </div>
          <h2 className="font-display mt-4 text-lg font-bold">{tab === "received" ? "받은 컷이 없어요" : "앨범이 비어 있어요"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "received" ? "친구가 보내면 여기로 도착해요." : "마음에 든 컷을 결제하면 모여요."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => {
            const owned = purchased.has(p.id);
            const fresh = !owned && isNew(p);
            return (
              <Link
                key={p.id}
                to="/photo/$id"
                params={{ id: p.id }}
                className="group relative block overflow-hidden rounded-xl bg-secondary"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img src={p.preview_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {!owned && (
                    <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-20deg,transparent_0_24px,rgba(255,255,255,0.16)_24px_26px)]" />
                  )}
                  {p.is_video && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background">
                      <Play className="h-3 w-3" />
                    </span>
                  )}
                  {fresh && (
                    <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground shadow-sm">
                      NEW
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 via-black/30 to-transparent px-2.5 py-2">
                    <span className="truncate text-[11px] font-semibold text-white">@{p.uploader.handle}</span>
                    {owned ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                        <BookmarkCheck className="h-2.5 w-2.5" />보관
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                        <Lock className="h-2.5 w-2.5" />{formatWon(p.price_won)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}