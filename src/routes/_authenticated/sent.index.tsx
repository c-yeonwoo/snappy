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
  const [tab, setTab] = useState<"sent" | "sales">("sent");

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  const photos = data?.photos ?? [];
  const sold = photos.filter((p) => p.status === "sold");
  const sentTotal = photos.length;
  const soldTotal = sold.length;

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
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[1.25rem] bg-card border border-white/70 px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">보낸 컷</p>
          <p className="font-display mt-1 text-2xl font-extrabold">{sentTotal}<span className="text-sm font-semibold text-muted-foreground ml-0.5">장</span></p>
        </div>
        <div className="rounded-[1.25rem] bg-gradient-to-br from-foreground to-[oklch(0.35_0.06_260)] px-4 py-3 text-background shadow-lg">
          <p className="text-[10px] uppercase tracking-wide opacity-70">소장됨</p>
          <p className="font-display mt-1 text-2xl font-extrabold">
            {soldTotal}<span className="text-sm font-semibold opacity-70 ml-0.5">건</span>
            {sentTotal > 0 && <span className="ml-1.5 text-xs opacity-60">{Math.round(soldTotal / sentTotal * 100)}%</span>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex w-full rounded-full border border-border bg-card/80 p-1 backdrop-blur">
        {(["sent", "sales"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-foreground text-background shadow" : "text-muted-foreground"}`}
          >
            {t === "sent" ? `보낸 사진 · ${photos.length}` : `소장 내역 · ${sold.length}`}
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
              // 그룹 대표 상태: reported > removed > sold > available
              const groupStatus = g.some((p) => p.status === "reported")
                ? "reported"
                : g.some((p) => p.status === "removed")
                ? "removed"
                : g.every((p) => p.status === "sold")
                ? "sold"
                : "available";
              const statusLabel: Record<string, string> = {
                available: "대기중", sold: "소장됨", removed: "반려됨", reported: "신고됨",
              };
              const statusCls: Record<string, string> = {
                available: "",
                sold: "!bg-primary !text-primary-foreground !border-primary/40",
                removed: "!bg-muted !text-muted-foreground !border-border",
                reported: "!bg-destructive/15 !text-destructive !border-destructive/30",
              };
              const inner = (
                <>
                  <div className="relative aspect-square bg-secondary">
                    {cover.preview_url && <img src={cover.preview_url} alt="" className="h-full w-full object-cover" />}
                    <span className={`absolute left-2.5 top-2.5 chip text-[9px] ${statusCls[groupStatus]}`}>{statusLabel[groupStatus]}</span>
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
      ) : sold.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><Coins className="h-6 w-6 text-foreground" /></div>
          <h2 className="font-display mt-4 text-lg font-bold">아직 소장된 컷이 없어요</h2>
          <p className="mt-1 text-sm text-muted-foreground">친구가 내 컷을 소장하면 여기에 기록돼요.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sold.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 p-2.5 backdrop-blur">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {p.preview_url && <img src={p.preview_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold"><b>@{p.subject?.handle ?? "?"}</b> 님이 소장</p>
                <p className="text-[11px] text-muted-foreground">가격 {formatPoint(p.price_won)}</p>
              </div>
              <span className="shrink-0 font-display text-sm font-extrabold text-primary">+{formatPoint(Math.round(p.price_won * 0.7))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
