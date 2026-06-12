import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getSentBatch, updateBatchPrice, cancelPhotos } from "@/lib/photos.functions";
import { formatWon } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sent/$id")({
  head: () => ({ meta: [{ title: "보낸 묶음 — Snappy" }] }),
  component: SentBatchPage,
});

function SentBatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const batchFn = useServerFn(getSentBatch);
  const priceFn = useServerFn(updateBatchPrice);
  const cancelFn = useServerFn(cancelPhotos);

  const { data, isLoading, isError } = useQuery({ queryKey: ["sentBatch", id], queryFn: () => batchFn({ data: { batch_id: id } }) });
  const photos = data?.photos ?? [];
  const subject = data?.subject;
  const available = photos.filter((p) => p.status === "available");
  const soldCount = photos.filter((p) => p.status === "sold").length;
  const basePrice = available[0]?.price_won ?? photos[0]?.price_won ?? 3000;

  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPrice(basePrice); }, [basePrice]);
  const dirty = price !== basePrice;

  async function savePrice() {
    setBusy(true);
    try {
      await priceFn({ data: { batch_id: id, price_won: price } });
      toast.success("가격을 변경했어요");
      qc.invalidateQueries({ queryKey: ["sentBatch", id] });
      qc.invalidateQueries({ queryKey: ["sent"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) {
      toast.error(e?.message ?? "변경 실패");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAll() {
    const ids = available.map((p) => p.id);
    if (ids.length === 0) return;
    if (!window.confirm(`대기 중 ${ids.length}장을 취소할까요? 상대 받은함에서도 사라져요.`)) return;
    setBusy(true);
    try {
      await cancelFn({ data: { ids } });
      toast.success("전송을 취소했어요");
      qc.invalidateQueries({ queryKey: ["sent"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/sent" });
    } catch (e: any) {
      toast.error(e?.message ?? "취소 실패");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-md"><div className="h-24 animate-pulse rounded-[1.5rem] bg-secondary" /><div className="mt-4 grid grid-cols-2 gap-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />)}</div></div>;
  }
  if (isError || photos.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">묶음을 찾을 수 없어요.</p>
        <Link to="/sent" className="mt-3 inline-block text-sm font-semibold underline">보낸 사진으로</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <button onClick={() => navigate({ to: "/sent" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 보낸 사진
      </button>

      <header>
        <h1 className="font-display text-2xl font-extrabold">@{subject?.handle ?? "?"} 에게 보낸 묶음</h1>
        <p className="mt-1 text-sm text-muted-foreground">{photos.length}장 · 대기 {available.length} · 소장 {soldCount}</p>
      </header>

      {/* 가격 조정 (대기 중 컷에만 적용) */}
      <section className="rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">한 컷 가격</p>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">모두 소장돼서 가격을 바꿀 수 없어요.</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center rounded-full bg-secondary px-1">
                <Button type="button" variant="ghost" size="sm" className="rounded-full px-2" onClick={() => setPrice(Math.max(1000, price - 500))}>−</Button>
                <span className="font-display w-24 text-center text-base font-extrabold">{formatWon(price)}</span>
                <Button type="button" variant="ghost" size="sm" className="rounded-full px-2" onClick={() => setPrice(Math.min(50000, price + 500))}>+</Button>
              </div>
              <Button type="button" disabled={!dirty || busy} className="rounded-full" onClick={savePrice}>
                <Check className="mr-1 h-4 w-4" />변경
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">대기 중 {available.length}장에 적용돼요. (소장된 컷 가격은 유지)</p>
          </>
        )}
      </section>

      {/* 사진들 */}
      <div className="grid grid-cols-2 gap-2.5">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-card">
            <div className="relative aspect-square bg-secondary">
              {p.preview_url && <img src={p.preview_url} alt="" className="h-full w-full object-cover" />}
              <span className={`absolute left-2 top-2 chip text-[9px] ${
                p.status === "sold" ? "!bg-primary !text-primary-foreground !border-primary/40"
                : p.status === "removed" ? "!bg-muted !text-muted-foreground !border-border"
                : p.status === "reported" ? "!bg-destructive/15 !text-destructive !border-destructive/30"
                : ""
              }`}>
                {{ available: "대기중", sold: "소장됨", removed: "반려됨", reported: "신고됨" }[p.status] ?? "대기중"}
              </span>
            </div>
            <p className="p-2.5 text-center text-xs font-semibold">{formatWon(p.price_won)}</p>
          </div>
        ))}
      </div>

      {/* 전송 취소 */}
      {available.length > 0 && (
        <Button variant="destructive" className="w-full rounded-full" onClick={cancelAll} disabled={busy}>
          <X className="mr-1.5 h-4 w-4" /> 대기 중 {available.length}장 전송 취소
        </Button>
      )}
    </div>
  );
}
