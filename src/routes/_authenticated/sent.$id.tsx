// @ts-nocheck
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSentBatch, cancelPhotos, hideSentBatch } from "@/lib/photos.functions";
import { toast } from "sonner";
import { ArrowLeft, X, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sent/$id")({
  head: () => ({ meta: [{ title: "보낸 묶음 — Snappy" }] }),
  component: SentBatchPage,
});

function SentBatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const batchFn = useServerFn(getSentBatch);
  const cancelFn = useServerFn(cancelPhotos);
  const hideFn = useServerFn(hideSentBatch);

  const { data, isLoading, isError } = useQuery({ queryKey: ["sentBatch", id], queryFn: () => batchFn({ data: { batch_id: id } }) });
  const photos = data?.photos ?? [];
  const subject = data?.subject;
  const available = photos.filter((p) => p.status === "available");
  const soldCount = photos.filter((p) => p.status === "sold").length;
  const allFinal = photos.length > 0 && available.length === 0; // 모두 최종 상태

  async function hideHistory() {
    if (!window.confirm("이 묶음을 내 보낸 목록에서 삭제할까요?")) return;
    setBusy(true);
    try {
      await hideFn({ data: { batch_id: id } });
      toast.success("기록을 삭제했어요");
      qc.invalidateQueries({ queryKey: ["sent"] });
      navigate({ to: "/sent" });
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    } finally {
      setBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);

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
      <div className="flex items-center justify-between">
        <button onClick={() => navigate({ to: "/sent" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> 보낸 사진
        </button>
        {allFinal && (
          <button onClick={hideHistory} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
            <Trash2 className="h-3 w-3" /> 기록 삭제
          </button>
        )}
      </div>

      <header>
        <h1 className="font-display text-2xl font-extrabold">@{subject?.handle ?? "?"} 에게 보낸 묶음</h1>
        <p className="mt-1 text-sm text-muted-foreground">{photos.length}장 · 대기 {available.length} · 소장 {soldCount}</p>
      </header>

      {/* 적립 안내 */}
      <section className="rounded-[1.5rem] border border-white/70 bg-card/90 px-5 py-4 backdrop-blur">
        <p className="text-sm">
          상대가 소장한 컷마다 <b className="text-primary">+1 크레딧</b>이 적립돼요.
          {soldCount > 0 && <> 지금까지 <b className="text-foreground">{soldCount}장</b> 소장됐어요.</>}
        </p>
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
                : p.status === "reported" ? "!bg-destructive/25 !text-destructive !border-destructive/50"
                : ""
              }`}>
                {{ available: "대기중", sold: "소장됨", removed: "반려됨", reported: "신고됨" }[p.status] ?? "대기중"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 전송 취소 */}
      {available.length > 0 && (
        <button
          onClick={cancelAll}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-border/60 py-3 text-sm font-semibold text-muted-foreground transition hover:border-destructive/30 hover:text-destructive disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" /> 대기 중 {available.length}장 전송 취소
        </button>
      )}
    </div>
  );
}
