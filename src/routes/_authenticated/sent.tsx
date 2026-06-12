import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMySent } from "@/lib/photos.functions";

export const Route = createFileRoute("/_authenticated/sent")({
  head: () => ({ meta: [{ title: "보낸 사진 — SnapBuddy" }] }),
  component: SentPage,
});

function SentPage() {
  const fn = useServerFn(getMySent);
  const { data, isLoading } = useQuery({ queryKey: ["sent"], queryFn: () => fn() });

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  const photos = data?.photos ?? [];
  const earnings = data?.earnings_cents ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <span className="chip">💌 보낸함</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold">내 보낸함</h1>
          <p className="mt-1 text-sm text-muted-foreground">내가 찍어서 보낸 컷과 판매 현황.</p>
        </div>
        <div className="shrink-0 rounded-[1.25rem] bg-gradient-to-br from-foreground to-[oklch(0.35_0.06_260)] px-5 py-3 text-background shadow-lg">
          <p className="text-[10px] uppercase tracking-widest opacity-70">총 적립</p>
          <p className="font-display text-2xl font-extrabold">${(earnings / 100).toFixed(2)}</p>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <p className="text-muted-foreground">아직 보낸 컷이 없어요.</p>
          <Link to="/upload" className="mt-3 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">📮 보내러 가기</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => {
            const statusMap = {
              sold: { label: "판매 ✓", cls: "!bg-primary !text-primary-foreground !border-primary/40" },
              removed: { label: "삭제", cls: "!bg-destructive !text-destructive-foreground !border-destructive/40" },
              available: { label: "대기 중", cls: "" },
            } as const;
            const s = statusMap[p.status as keyof typeof statusMap] ?? statusMap.available;
            return (
              <div key={p.id} className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card shadow-[0_15px_40px_-20px_rgba(125,160,200,0.4)]">
                <div className="relative aspect-square bg-secondary">
                  {p.preview_url && <img src={p.preview_url} alt="" className="h-full w-full object-cover" />}
                  <span className={`absolute left-2.5 top-2.5 chip ${s.cls}`}>{s.label}</span>
                  <div className="absolute right-2.5 top-2.5 rounded-full bg-foreground/85 px-2 py-0.5 text-[11px] font-bold text-background">${(p.price_cents / 100).toFixed(2)}</div>
                </div>
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-muted-foreground">to <b className="text-foreground">@{p.subject?.handle ?? "?"}</b></span>
                  {p.status === "sold" && <span className="font-semibold text-foreground">+${(p.price_cents * 0.7 / 100).toFixed(2)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}