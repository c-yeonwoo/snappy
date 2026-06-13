import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { confirmPhotoPurchase, getBatch, purchasePhotos, removePhoto, reportPhoto } from "@/lib/photos.functions";
import { formatPoint, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Check, Plus, Download, ShieldCheck, Camera, MessageCircle, Flag, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/batch/$id")({
  head: () => ({ meta: [{ title: "묶음 — Snappy" }] }),
  component: BatchPage,
});

function BatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const batchFn = useServerFn(getBatch);
  const buyFn = useServerFn(purchasePhotos);
  const confirmBuyFn = useServerFn(confirmPhotoPurchase);
  const removeFn = useServerFn(removePhoto);
  const reportFn = useServerFn(reportPhoto);

  const { data, isLoading, isError } = useQuery({ queryKey: ["batch", id], queryFn: () => batchFn({ data: { batch_id: id } }) });
  const photos = data?.photos ?? [];
  const uploader = data?.uploader;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSel = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSel);
    return () => { api.off("select", onSel); };
  }, [api]);

  useEffect(() => {
    const onVis = () => document.body.classList.toggle("is-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); document.body.classList.remove("is-hidden"); };
  }, []);

  function toggle(pid: string) {
    setSelected((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  }
  const selectedList = photos.filter((p) => selected.has(p.id) && !p.is_owned);
  const total = selectedList.reduce((sum, p) => sum + p.price_won, 0);
  const availableCount = photos.filter((p) => !p.is_owned).length;
  const ownedPhotos = photos.filter((p) => p.is_owned);
  const cur = photos[current];

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["batch", id] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function buy() {
    if (selectedList.length === 0) return;
    setBusy(true);
    try {
      const res = await buyFn({ data: { ids: selectedList.map((p) => p.id) } });
      if (res.status === "pending") {
        await confirmBuyFn({ data: { session_id: res.session_id } });
      }
      toast.success(`${selectedList.length}장 소장 완료! 워터마크가 풀렸어요.`);
      setSelected(new Set());
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "소장에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function download(url: string | null, pid: string) {
    if (!url) return toast.error("원본을 불러올 수 없어요");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = `snappy-${pid}.jpg`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    } catch { toast.error("다운로드 실패"); }
  }
  async function downloadAll() {
    for (const p of ownedPhotos) {
      await download(p.original_url, p.id);
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  async function remove(pid: string) {
    if (!window.confirm("이 사진을 받은함에서 삭제할까요? 되돌릴 수 없어요.")) return;
    try { await removeFn({ data: { id: pid } }); toast.success("삭제했어요"); await refresh(); } catch (e: any) { toast.error(e?.message ?? "삭제 실패"); }
  }
  async function report(pid: string) {
    const reason = window.prompt("신고 사유를 입력해주세요");
    if (!reason || !reason.trim()) return;
    try { await reportFn({ data: { id: pid, reason: reason.trim() } }); toast.success("신고가 접수됐어요"); await refresh(); } catch (e: any) { toast.error(e?.message ?? "신고 실패"); }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-md"><div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-secondary" /><div className="mt-4 h-40 animate-pulse rounded-[1.5rem] bg-secondary" /></div>;
  }
  if (isError || photos.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">묶음을 찾을 수 없어요.</p>
        <Link to="/feed" className="mt-3 inline-block text-sm font-semibold underline">받은함으로</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <button onClick={() => navigate({ to: "/feed" })} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 받은함
      </button>

      {/* 이미지 캐러셀 */}
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent>
          {photos.map((p) => {
            const owned = p.is_owned;
            const picked = selected.has(p.id);
            const src = owned ? (p.original_url ?? p.preview_url) : p.preview_url;
            return (
              <CarouselItem key={p.id}>
                <div className="no-capture no-capture-hide relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-[0_25px_60px_-30px_rgba(10,10,10,0.4)]" onContextMenu={(e) => e.preventDefault()}>
                  <div className="relative aspect-[4/5] bg-secondary">
                    {src && <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />}
                    {!owned && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute inset-[-30%] grid grid-cols-3 gap-y-10 rotate-[-18deg] place-items-center">
                          {Array.from({ length: 36 }).map((_, i) => (
                            <span key={i} className="text-[12px] font-bold tracking-[0.25em] text-white/30 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
                              SNAPPY
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {owned ? (
                      <span className="absolute right-3 top-3 chip !bg-primary !text-primary-foreground !border-primary/40"><ShieldCheck className="h-3 w-3" /> 원본</span>
                    ) : (
                      <span className="absolute right-3 top-3 chip !bg-foreground/85 !text-background !border-transparent"><ShieldCheck className="h-3 w-3" /> 보호 중</span>
                    )}
                    {owned ? (
                      <button onClick={() => download(p.original_url, p.id)} className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-foreground shadow">
                        <Download className="h-4 w-4" /> 다운로드
                      </button>
                    ) : (
                      <button onClick={() => toggle(p.id)} className={`absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow transition ${picked ? "bg-primary text-primary-foreground" : "bg-white/95 text-foreground"}`}>
                        {picked ? (
                          <>
                            <Check className="h-4 w-4" /> 담음
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> 담기 · <span className="font-digit">{formatPoint(p.price_won)}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* 하단 점 인디케이터 */}
      {photos.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {photos.map((_, i) => (
            <button key={i} aria-label={`${i + 1}번째`} onClick={() => api?.scrollTo(i)} className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-foreground" : "w-1.5 bg-border"}`} />
          ))}
        </div>
      )}

      {/* 메타 / 결제 카드 (단건 UI 스타일) */}
      <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-display font-extrabold">{uploader?.display_name?.[0] ?? "?"}</div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Camera className="h-3 w-3" /> photo by</p>
            <p className="font-display truncate text-base font-extrabold">{uploader?.display_name ?? "알 수 없음"} <span className="text-muted-foreground">@{uploader?.handle ?? "?"}</span></p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{cur ? relativeTime(cur.created_at) : `${photos.length}장`}</span>
        </div>

        {cur?.note && (
          <div className="mt-4 flex gap-2 rounded-2xl bg-secondary px-3 py-2.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">{cur.note}</p>
          </div>
        )}

        <div className="mt-5">
          {selectedList.length > 0 ? (
            <>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">선택</p>
                  <p className="font-digit text-xl font-semibold">{selectedList.length}장</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">합계</p>
                  <p className="font-digit text-2xl font-semibold text-primary">{formatPoint(total)}</p>
                </div>
              </div>
              <Button className="h-12 w-full rounded-full text-base" onClick={buy} disabled={busy}>
                {busy ? "받는 중…" : <><span className="font-digit">{formatPoint(total)}</span>으로 소장하기</>}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">소장하면 선택한 컷의 워터마크가 풀려요.</p>
            </>
          ) : availableCount > 0 ? (
            <p className="rounded-full bg-secondary py-3 text-center text-sm font-semibold text-muted-foreground">넘기면서 마음에 드는 컷을 담아보세요</p>
          ) : (
            <p className="rounded-full bg-secondary py-3 text-center text-sm font-semibold text-muted-foreground">이 묶음은 모두 보관했어요</p>
          )}

          {ownedPhotos.length > 1 && (
            <Button variant="ghost" className="mt-2 w-full rounded-full text-muted-foreground" onClick={downloadAll}>
              <Download className="mr-1.5 h-4 w-4" /> 받은 {ownedPhotos.length}장 모두 다운로드
            </Button>
          )}
        </div>

        {/* 현재 컷 신고/삭제 (소장한 컷은 보관함에서 삭제) */}
        {cur && (
          <div className="mt-4 flex items-center justify-center gap-5 text-xs font-semibold text-muted-foreground">
            {!cur.is_owned && (
              <>
                <button onClick={() => report(cur.id)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline"><Flag className="h-3 w-3" /> 신고</button>
                <span className="text-border">|</span>
              </>
            )}
            <button onClick={() => remove(cur.id)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
              <Trash2 className="h-3 w-3" /> {cur.is_owned ? "보관함에서 삭제" : "삭제"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
