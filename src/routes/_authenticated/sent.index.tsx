import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMySent, cancelPhotos } from "@/lib/photos.functions";
import { formatPoint } from "@/lib/format";
import { useState } from "react";
import { Coins, Images } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sent/")({
  head: () => ({ meta: [{ title: "보낸 사진 — Snappy" }] }),
  component: SentPage,
});

function SentPage() {
  const fn = useServerFn(getMySent);
  const cancelFn = useServerFn(cancelPhotos);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sent"], queryFn: () => fn() });
  const [tab, setTab] = useState<"sent" | "history">("sent");

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  const photos = data?.photos ?? [];
  // 히스토리: 소장됨 / 반려됨 / 신고됨 — 최신순
  const history = photos.filter((p) => p.status !== "available");
  const sentTotal = photos.length;
  const soldTotal = photos.filter((p) => p.status === "sold").length;

  function group(items: typeof photos) {
    const m = new Map<string, typeof photos>();
    for (const p of items) {
      const key = p.batch_id ?? `solo:${p.id}`;
      const arr = m.get(key);
      if (arr) arr.push(p);
      else m.set(key, [p]);
    }
    return Array.from(m.values());
  }
  const groups = group(photos);

  async function cancel(g: typeof photos) {
    const ids = g.filter((p) => p.status === "available").map((p) => p.id);
    if (ids.length === 0) return;
    if (!window.confirm(`대기 중 ${ids.length}장을 취소할까요? 상대 받은함에서도 사라져요.`)) return;
    try {
      await cancelFn({ data: { ids } });
      toast.success("전송을 취소했어요");
      qc.invalidateQueries({ queryKey: ["sent"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) {
      toast.error(e?.message ?? "취소 실패");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="chip">보낸 사진</span>
        <h1 className="font-display mt-2 text-3xl font-extrabold">내가 보낸 컷</h1>
      </div>
      {/* 통계 */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/60 bg-gradient-to-br from-brand-soft via-card to-accent/30 px-5 py-3.5 shadow-sm backdrop-blur">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <div className="pr-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">보낸 컷</p>
            <p className="font-display mt-1 text-2xl font-extrabold leading-none">
              {sentTotal}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">장</span>
            </p>
          </div>
          <div className="pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">소장됨</p>
            <p className="font-display mt-1 flex items-baseline gap-2 text-2xl font-extrabold leading-none">
              {soldTotal}
              <span className="text-sm font-semibold text-muted-foreground">건</span>
              {sentTotal > 0 && (
                <span className="text-sm font-semibold text-primary">
                  {Math.round(soldTotal / sentTotal * 100)}%
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex w-full rounded-full border border-border bg-card/80 p-1 backdrop-blur">
        {(["sent", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-foreground text-background shadow" : "text-muted-foreground"}`}
          >
            {t === "sent" ? `보낸 사진 · ${photos.length}` : `히스토리 · ${history.length}`}
          </button>
        ))}
      </div>

      {tab === "sent" ? (
        groups.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
            <p className="text-muted-foreground">아직 보낸 컷이 없어요.</p>
            <Link to="/upload" className="mt-3 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">보내러 가기</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {groups.map((g) => {
              const cover = g[0];
              const count = g.length;
              // 리스트에서는 대기중 | 완료 두 가지만
              const isDone = g.every((p) => p.status !== "available");
              const statusLabel = isDone ? "완료" : "대기중";
              const statusCls = isDone ? "!bg-primary !text-primary-foreground !border-primary/40" : "";
              const inner = (
                <>
                  <div className="relative aspect-square bg-secondary">
                    {cover.preview_url && <img src={cover.preview_url} alt="" className="h-full w-full object-cover" />}
                    <span className={`absolute left-2.5 top-2.5 chip text-[9px] ${statusCls}`}>{statusLabel}</span>
                    {count > 1 && (
                      <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold text-background">
                        <Images className="h-3 w-3" />{count}
                      </span>
                    )}
                  </div>
                  <div className="p-3 text-xs">
                    <span className="truncate text-muted-foreground">to <b className="text-foreground">@{cover.subject?.handle ?? "?"}</b></span>
                  </div>
                </>
              );
              const cls = "block overflow-hidden rounded-[1.5rem] border border-white/70 bg-card shadow-[0_15px_40px_-20px_rgba(10,10,10,0.15)]";
              const linkId = cover.batch_id ?? cover.id;
              return (
                <Link key={linkId} to="/sent/$id" params={{ id: linkId }} className={`${cls} transition active:scale-[0.99]`}>{inner}</Link>
              );
            })}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><Coins className="h-6 w-6 text-foreground" /></div>
          <h2 className="font-display mt-4 text-lg font-bold">아직 기록이 없어요</h2>
          <p className="mt-1 text-sm text-muted-foreground">소장, 반려, 신고 내역이 여기에 쌓여요.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((p) => {
            const isSold = p.status === "sold";
            const isRemoved = p.status === "removed";
            const statusMap: Record<string, { label: string; cls: string }> = {
              sold:     { label: "소장됨", cls: "!bg-primary/15 !text-primary !border-primary/30" },
              removed:  { label: "반려됨", cls: "!bg-muted !text-muted-foreground !border-border" },
              reported: { label: "신고됨", cls: "!bg-destructive/25 !text-destructive !border-destructive/50" },
            };
            const statusConfig = statusMap[p.status] ?? { label: p.status, cls: "" };
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 p-2.5 backdrop-blur">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {p.preview_url && <img src={p.preview_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`chip !text-[9px] !px-1.5 !py-0.5 ${statusConfig.cls}`}>{statusConfig.label}</span>
                    <p className="truncate text-sm font-semibold">@{p.subject?.handle ?? "?"}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <span className="font-digit">{formatPoint(p.price_won)}</span>
                  </p>
                </div>
                {isSold && (
                  <span className="shrink-0 font-digit text-sm font-semibold text-primary">+{formatPoint(Math.round(p.price_won * 0.7))}</span>
                )}
                {isRemoved && (
                  <span className="shrink-0 text-xs text-muted-foreground">반려</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
