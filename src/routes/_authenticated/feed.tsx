import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, Inbox, Send, Search, BookmarkCheck, Lock, Images } from "lucide-react";
import { getMyFeed } from "@/lib/photos.functions";
import { formatPoint, isNew } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "받은함 — Snappy" }] }),
  component: FeedPage,
});

function FeedPage() {
  const fn = useServerFn(getMyFeed);
  const { data, isLoading } = useQuery({ queryKey: ["feed"], queryFn: () => fn() });
  const [tab, setTab] = useState<"received" | "album">("received");

  const all = data?.photos ?? [];
  // 받은 사진 = 아직 결제 안 한 컷(available). 내 앨범 = 결제해서 원본 보유(sold).
  const received = all.filter((p) => p.status === "available");
  const album = all.filter((p) => p.status === "sold");
  const photos = tab === "received" ? received : album;
  const newCount = received.filter((p) => isNew(p.created_at)).length;

  // 같은 batch_id 끼리 묶음으로 그룹핑 (batch_id 없으면 단건). 최신순 유지.
  function group(items: typeof all) {
    const m = new Map<string, typeof all>();
    for (const p of items) {
      const key = p.batch_id ?? `solo:${p.id}`;
      const arr = m.get(key);
      if (arr) arr.push(p);
      else m.set(key, [p]);
    }
    return Array.from(m.values());
  }
  const groups = group(photos);

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
              : "내가 소장해서 원본으로 가지고 있는 컷."}
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
        className="mb-4 flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 p-3 shadow-[0_12px_30px_-18px_rgba(10,10,10,0.35)] backdrop-blur"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">빠르게 보내기</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Search className="h-3 w-3" />@핸들로 받는 사람 찾기</p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">→</span>
      </Link>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
            {tab === "received" ? <ImageOff className="h-6 w-6 text-foreground" /> : <BookmarkCheck className="h-6 w-6 text-foreground" />}
          </div>
          <h2 className="font-display mt-4 text-lg font-bold">{tab === "received" ? "받은 컷이 없어요" : "앨범이 비어 있어요"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "received" ? "친구를 추가하면 서로 찍어준 컷을 주고받을 수 있어요." : "받은 컷을 소장하면 원본이 여기 모여요."}</p>
          {tab === "received" ? (
            <Link to="/friends" className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">친구 추가하기</Link>
          ) : (
            <button onClick={() => setTab("received")} className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">받은 사진 보기</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {groups.map((g) => {
            const cover = g[0];
            const owned = cover.status === "sold";
            const count = g.length;
            const fresh = !owned && g.some((p) => isNew(p.created_at));
            const src = owned ? (cover.original_url ?? cover.preview_url) : cover.preview_url;
            const card = (
              <div className="relative aspect-[4/5] overflow-hidden">
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-secondary text-muted-foreground"><ImageOff className="h-6 w-6" /></div>
                )}
                {!owned && (
                  <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-20deg,transparent_0_24px,rgba(255,255,255,0.16)_24px_26px)]" />
                )}
                {fresh && (
                  <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground shadow-sm">NEW</span>
                )}
                {count > 1 && (
                  <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold text-background">
                    <Images className="h-3 w-3" />{count}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 via-black/30 to-transparent px-2.5 py-2">
                  <span className="truncate text-[11px] font-semibold text-white">@{cover.uploader?.handle ?? "?"}</span>
                  {owned ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                      <BookmarkCheck className="h-2.5 w-2.5" />{count > 1 ? `${count}장 보관` : "보관"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                      <Lock className="h-2.5 w-2.5" />{count > 1 ? `${count}장 · ${formatPoint(cover.price_won)}~` : formatPoint(cover.price_won)}
                    </span>
                  )}
                </div>
              </div>
            );
            const cls = "group relative block overflow-hidden rounded-xl bg-secondary";
            return cover.batch_id ? (
              <Link key={cover.batch_id} to="/batch/$id" params={{ id: cover.batch_id }} className={cls}>{card}</Link>
            ) : (
              <Link key={cover.id} to="/photo/$id" params={{ id: cover.id }} className={cls}>{card}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
