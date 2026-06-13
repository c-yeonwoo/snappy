import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Download, ShieldCheck, MessageCircle, Camera, BookmarkCheck, Flag, Trash2, Sparkles, X } from "lucide-react";
import { getPhotoDetail, purchasePhoto, reportPhoto, removePhoto, commitEnhancement } from "@/lib/photos.functions";
import { enhanceImage, type EnhanceStyle } from "@/lib/enhance";
import { relativeTime, formatCredit } from "@/lib/format";

const ENHANCE_COST = 2;
const STYLES: { key: EnhanceStyle; label: string }[] = [
  { key: "natural", label: "내추럴" },
  { key: "bright", label: "화사하게" },
  { key: "film", label: "필름" },
];

export const Route = createFileRoute("/_authenticated/photo/$id")({
  head: () => ({ meta: [{ title: "사진 — Snappy" }] }),
  component: PhotoDetailPage,
});

function PhotoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detailFn = useServerFn(getPhotoDetail);
  const buyFn = useServerFn(purchasePhoto);
  const reportFn = useServerFn(reportPhoto);
  const removeFn = useServerFn(removePhoto);
  const commitEnhanceFn = useServerFn(commitEnhancement);

  const { data, isLoading } = useQuery({ queryKey: ["photo", id], queryFn: () => detailFn({ data: { id } }) });
  const p = data?.photo;

  const [busy, setBusy] = useState(false);
  const [boughtUrl, setBoughtUrl] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");

  // AI 보정
  const [enhOpen, setEnhOpen] = useState(false);
  const [enhStyle, setEnhStyle] = useState<EnhanceStyle>("natural");
  const [enhBusy, setEnhBusy] = useState(false);
  const [enhPreview, setEnhPreview] = useState<string | null>(null);
  const [enhBlob, setEnhBlob] = useState<Blob | null>(null);
  const [enhSavedUrl, setEnhSavedUrl] = useState<string | null>(null);

  // Best-effort screenshot deterrent: blur preview while the tab is in the
  // background. Real screenshot blocking lives in the native shell.
  useEffect(() => {
    const onVis = () => document.body.classList.toggle("is-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.body.classList.remove("is-hidden");
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md">
        <div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-secondary" />
        <div className="mt-4 h-40 animate-pulse rounded-[1.5rem] bg-secondary" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">사진을 찾을 수 없어요.</p>
        <Link to="/feed" className="mt-3 inline-block text-sm font-semibold underline">받은함으로</Link>
      </div>
    );
  }

    const originalUrl = boughtUrl ?? p.original_url;
  const unlocked = (p.status === "sold" && p.is_subject) || !!boughtUrl;
  const canBuy = p.is_subject && p.status === "available";

  async function handleBuy() {
    setBusy(true);
    try {
      const res = await buyFn({ data: { id } });
      setBoughtUrl(res.original_url);
      qc.invalidateQueries({ queryKey: ["photo", id] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("소장 완료! 워터마크가 풀렸어요.");
    } catch (e: any) {
      toast.error(e?.message ?? "소장에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!originalUrl) return toast.error("원본을 불러올 수 없어요");
    try {
      const res = await fetch(originalUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snappy-${id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("다운로드 실패");
    }
  }

  async function openEnhance() {
    setEnhSavedUrl(null);
    setEnhStyle("natural");
    setEnhOpen(true);
    await runPreview("natural");
  }

  async function runPreview(style: EnhanceStyle) {
    if (!originalUrl) return toast.error("원본을 불러올 수 없어요");
    setEnhStyle(style);
    setEnhBusy(true);
    try {
      const blob = await enhanceImage(originalUrl, style);
      setEnhBlob(blob);
      setEnhPreview(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error(e?.message ?? "보정 미리보기 실패");
    } finally {
      setEnhBusy(false);
    }
  }

  async function saveEnhance() {
    if (!enhBlob) return;
    setEnhBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("photos-enhanced").upload(path, enhBlob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const res = await commitEnhanceFn({ data: { source_photo_id: id, enhanced_path: path, style: enhStyle } });
      setEnhSavedUrl(res.enhanced_url);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`AI 보정 완료! (${ENHANCE_COST} 크레딧 사용)`);
    } catch (e: any) {
      toast.error(e?.message ?? "보정 저장 실패");
    } finally {
      setEnhBusy(false);
    }
  }

  async function downloadEnhanced() {
    const url = enhSavedUrl ?? enhPreview;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = `snappy-${id}-ai.jpg`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    } catch { toast.error("다운로드 실패"); }
  }

  async function handleReport() {
    if (reason.trim().length < 1) return toast.error("신고 사유를 입력해주세요");
    setBusy(true);
    try {
      await reportFn({ data: { id, reason: reason.trim() } });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("신고가 접수됐어요. 이 컷은 피드에서 숨겨집니다.");
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e?.message ?? "신고 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await removeFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("받은함에서 삭제했어요.");
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <button onClick={() => navigate({ to: "/feed" })} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 받은함
      </button>

      {/* Expanded image */}
      <div className="no-capture no-capture-hide relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-[0_25px_60px_-30px_rgba(10,10,10,0.4)]" onContextMenu={(e) => e.preventDefault()}>
        <div className="relative aspect-[4/5] bg-secondary">
          <img src={unlocked && originalUrl ? originalUrl : (p.preview_url ?? "")} alt="" draggable={false} className="h-full w-full object-cover" />

          {/* dense diagonal watermark — disappears immediately on purchase */}
          {!unlocked && (
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

          {unlocked ? (
            <span className="absolute right-3 top-3 chip !bg-primary !text-primary-foreground !border-primary/40"><ShieldCheck className="h-3 w-3" /> 원본</span>
          ) : (
            <span className="absolute right-3 top-3 chip !bg-foreground/85 !text-background !border-transparent"><ShieldCheck className="h-3 w-3" /> 보호 중</span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-display font-extrabold">
            {p.uploader?.display_name?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" /> photo by
            </p>
            <p className="font-display truncate text-base font-extrabold">
              {p.uploader?.display_name ?? "알 수 없음"} <span className="text-muted-foreground">@{p.uploader?.handle ?? "?"}</span>
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">{relativeTime(p.created_at)}</span>
        </div>

        {p.note && (
          <div className="mt-4 flex gap-2 rounded-2xl bg-secondary px-3 py-2.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">{p.note}</p>
          </div>
        )}

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">소장 비용</p>
            <p className="font-display text-2xl font-extrabold text-primary">{formatCredit(1)}</p>
          </div>
          {unlocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              <BookmarkCheck className="h-3.5 w-3.5" /> 보관함 저장됨
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5">
          {unlocked ? (
            <div className="space-y-2">
              <Button className="h-12 w-full rounded-full text-base" onClick={openEnhance}>
                <Sparkles className="mr-1.5 h-4 w-4" /> AI로 더 예쁘게 · {ENHANCE_COST} 크레딧
              </Button>
              <button onClick={handleDownload} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-border py-3 text-sm font-semibold text-muted-foreground transition active:scale-[0.99]">
                <Download className="h-4 w-4" /> 원본 다운로드
              </button>
            </div>
          ) : canBuy ? (
            <Button className="h-12 w-full rounded-full text-base" onClick={handleBuy} disabled={busy}>
              {busy ? "받는 중…" : "1 크레딧으로 소장하고 원본 받기"}
            </Button>
          ) : (
            <p className="rounded-full bg-secondary py-3 text-center text-sm font-semibold text-muted-foreground">
              {p.is_uploader ? "내가 보낸 컷이에요" : "받는 사람만 소장할 수 있어요"}
            </p>
          )}
          {canBuy && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">소장하면 워터마크가 풀리고 다운로드할 수 있어요.</p>
          )}
        </div>
      </div>

      {/* 받은 사진(미구매) 정리 — 삭제(받은함에서 지우기) / 신고(부적절 컷) */}
      {p.is_subject && p.status === "available" && (
        <div className="mt-4">
          {reporting ? (
            <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-left">
              <p className="text-sm font-bold">사진 신고</p>
              <p className="mt-0.5 text-xs text-muted-foreground">사유를 알려주시면 검토 후 처리해요. 접수 즉시 내 피드에서 숨겨집니다.</p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className="mt-3 rounded-2xl px-4 py-3" placeholder="예: 원치 않는 사진이에요" />
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="flex-1 rounded-full" onClick={() => { setReporting(false); setReason(""); }}>취소</Button>
                <Button variant="destructive" className="flex-1 rounded-full" onClick={handleReport} disabled={busy}>신고하기</Button>
              </div>
            </div>
          ) : confirmDelete ? (
            <div className="rounded-[1.5rem] border border-border bg-card/80 p-4 text-left">
              <p className="text-sm font-bold">받은 사진 삭제</p>
              <p className="mt-0.5 text-xs text-muted-foreground">받은함에서 사라지고 되돌릴 수 없어요.</p>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setConfirmDelete(false)}>취소</Button>
                <Button variant="destructive" className="flex-1 rounded-full" onClick={handleRemove} disabled={busy}>삭제</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5 text-xs font-semibold text-muted-foreground">
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <Trash2 className="h-3 w-3" /> 삭제
              </button>
              <span className="text-border">|</span>
              <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <Flag className="h-3 w-3" /> 신고
              </button>
            </div>
          )}
        </div>
      )}

      {/* 소장한 컷 — 보관함에서 삭제 */}
      {p.is_subject && p.status === "sold" && (
        <div className="mt-4">
          {confirmDelete ? (
            <div className="rounded-[1.5rem] border border-border bg-card/80 p-4 text-left">
              <p className="text-sm font-bold">보관함에서 삭제</p>
              <p className="mt-0.5 text-xs text-muted-foreground">보관함에서 사라져요. (이미 받은 원본 파일은 기기에 남아요)</p>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setConfirmDelete(false)}>취소</Button>
                <Button variant="destructive" className="flex-1 rounded-full" onClick={handleRemove} disabled={busy}>삭제</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <Trash2 className="h-3 w-3" /> 보관함에서 삭제
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI 보정 모달 */}
      {enhOpen && (
        <div className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[480px] -translate-x-1/2 items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center" onClick={() => !enhBusy && setEnhOpen(false)}>
          <div className="w-full max-w-md rounded-t-[1.75rem] border border-white/60 bg-card p-5 shadow-2xl sm:rounded-[1.75rem]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> AI 보정</h2>
              <button onClick={() => !enhBusy && setEnhOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>

            <div className="relative mt-4 aspect-square overflow-hidden rounded-2xl bg-secondary">
              {enhPreview && <img src={enhPreview} alt="" className="h-full w-full object-cover" />}
              {enhBusy && <div className="absolute inset-0 grid place-items-center bg-foreground/20 text-sm font-semibold text-background">보정 중…</div>}
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">AI 보정본</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  disabled={enhBusy || !!enhSavedUrl}
                  onClick={() => runPreview(s.key)}
                  className={`rounded-full border py-2 text-xs font-semibold transition ${enhStyle === s.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"} disabled:opacity-50`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {enhSavedUrl ? (
              <Button className="mt-4 h-12 w-full rounded-full text-base" onClick={downloadEnhanced}>
                <Download className="mr-1.5 h-4 w-4" /> 보정본 다운로드
              </Button>
            ) : (
              <Button className="mt-4 h-12 w-full rounded-full text-base" onClick={saveEnhance} disabled={enhBusy || !enhBlob}>
                {enhBusy ? "처리 중…" : `${ENHANCE_COST} 크레딧으로 저장하기`}
              </Button>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {enhSavedUrl ? "내 보정본이 저장됐어요." : "스타일을 골라 미리보고, 저장할 때 크레딧이 차감돼요."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
