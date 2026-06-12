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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">보낸 사진</h1>
          <p className="mt-1 text-sm text-muted-foreground">내가 찍어서 보낸 사진과 판매 현황이에요.</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[oklch(var(--primary-glow))] px-6 py-4 text-primary-foreground">
          <p className="text-xs uppercase opacity-80">총 적립</p>
          <p className="text-2xl font-bold">${(earnings / 100).toFixed(2)}</p>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">아직 보낸 사진이 없어요.</p>
          <Link to="/upload" className="mt-3 inline-block text-primary underline">사진 보내러 가기</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="aspect-square bg-muted">
                {p.preview_url && <img src={p.preview_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <p className="text-sm font-medium">to @{p.subject?.handle ?? "?"}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={p.status === "sold" ? "text-primary font-semibold" : p.status === "removed" ? "text-destructive" : "text-muted-foreground"}>
                    {p.status === "sold" ? "판매 완료" : p.status === "removed" ? "삭제됨" : "대기 중"}
                  </span>
                  <span className="font-semibold">${(p.price_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}