// @ts-nocheck
// AI 보정 플로우 (버튼 + 모달). 소장한(원본 접근 가능) 사진에서 사용.
// mock 모드: 클라 캔버스 보정(비용 0). real 모드(fal.ai 키): 서버 AI 보정.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEnhanceInfo, commitEnhancement, enhancePhotoAI } from "@/lib/photos.functions";
import { enhanceImage, type EnhanceStyle } from "@/lib/enhance";
import { Button } from "@/components/ui/button";
import { CreditNudge } from "@/components/credit-nudge";
import { saveImage } from "@/lib/save-image";
import { toast } from "sonner";
import { Sparkles, X, Download } from "lucide-react";

const ENHANCE_COST = 2;
const STYLES: { key: EnhanceStyle; label: string }[] = [
  { key: "natural", label: "내추럴" },
  { key: "bright", label: "화사하게" },
  { key: "film", label: "필름" },
];

export function EnhanceFlow({ photoId, originalUrl }: { photoId: string; originalUrl: string | null }) {
  const qc = useQueryClient();
  const infoFn = useServerFn(getEnhanceInfo);
  const commitFn = useServerFn(commitEnhancement);
  const aiFn = useServerFn(enhancePhotoAI);

  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<EnhanceStyle>("natural");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"mock" | "real">("mock");
  const [holding, setHolding] = useState(false); // 꾹 누르면 원본 비교
  const [lowCredit, setLowCredit] = useState(false);

  async function openModal() {
    setSavedUrl(null);
    setStyle("natural");
    setPreview(null);
    setBlob(null);
    setOpen(true);
    try {
      const info = await infoFn();
      setMode(info.mode);
    } catch {}
    await runPreview("natural");
  }

  async function runPreview(s: EnhanceStyle) {
    if (!originalUrl) return toast.error("원본을 불러올 수 없어요");
    setStyle(s);
    setBusy(true);
    try {
      const b = await enhanceImage(originalUrl, s);
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch (e: any) {
      toast.error(e?.message ?? "미리보기 실패");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      let resultUrl: string | null = null;
      if (mode === "real") {
        // 서버 AI 보정 (fal.ai)
        const res = await aiFn({ data: { source_photo_id: photoId, style } });
        resultUrl = res.enhanced_url;
      } else {
        // mock: 클라 캔버스 결과 업로드 + 크레딧 차감
        if (!blob) return;
        const { data: u } = await supabase.auth.getUser();
        const path = `${u.user!.id}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("photos-enhanced").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const res = await commitFn({ data: { source_photo_id: photoId, enhanced_path: path, style } });
        resultUrl = res.enhanced_url;
      }
      setSavedUrl(resultUrl);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`AI 보정 완료! (${ENHANCE_COST} 크레딧 사용)`);
    } catch (e: any) {
      if ((e?.message ?? "").includes("크레딧이 부족")) { setOpen(false); setLowCredit(true); }
      else toast.error(e?.message ?? "보정 실패");
    } finally {
      setBusy(false);
    }
  }

  async function downloadResult() {
    try {
      await saveImage(savedUrl ?? preview, `snappy-${photoId}-ai.jpg`);
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  return (
    <>
      <Button className="h-12 w-full rounded-full text-base" onClick={openModal}>
        <Sparkles className="mr-1.5 h-4 w-4" /> AI로 더 예쁘게 · {ENHANCE_COST} 크레딧
      </Button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] mx-auto flex max-w-[480px] items-center justify-center overflow-y-auto bg-foreground/40 px-4 py-6 backdrop-blur-md"
          onClick={() => !busy && setOpen(false)}
        >
          <div className="my-auto w-full max-w-[400px] overflow-hidden rounded-[1.75rem] border border-white/60 bg-card p-4 shadow-[0_30px_80px_-30px_rgba(10,10,10,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="chip"><Sparkles className="h-3.5 w-3.5" /> AI 보정</span>
              <button onClick={() => !busy && setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>

            {/* 원본 비율 그대로 + 꾹 누르면 원본 비교 */}
            <div className="relative mt-4 grid place-items-center overflow-hidden rounded-2xl border border-border/60 bg-secondary">
              {(holding ? originalUrl : (savedUrl ?? preview)) && (
                <img
                  src={(holding ? originalUrl : (savedUrl ?? preview)) ?? undefined}
                  alt=""
                  draggable={false}
                  style={{ touchAction: "none" }}
                  onPointerDown={() => setHolding(true)}
                  onPointerUp={() => setHolding(false)}
                  onPointerLeave={() => setHolding(false)}
                  onPointerCancel={() => setHolding(false)}
                  className="block max-h-[58vh] w-full select-none object-contain"
                />
              )}
              {busy && <div className="absolute inset-0 grid place-items-center bg-foreground/30 text-sm font-semibold text-background backdrop-blur-sm">처리 중…</div>}
              <span className="absolute left-2.5 top-2.5 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-bold text-background backdrop-blur">
                {holding ? "원본" : savedUrl ? "보정 완료" : "보정본 미리보기"}
              </span>
            </div>

            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">사진을 꾹 누르면 원본과 비교할 수 있어요</p>

            {/* 스타일 세그먼트 컨트롤 */}
            <div className="mt-3 inline-flex w-full rounded-full border border-border bg-secondary/60 p-1">
              {STYLES.map((s) => (
                <button key={s.key} disabled={busy || !!savedUrl} onClick={() => runPreview(s.key)}
                  className={`flex-1 rounded-full py-2 text-xs font-semibold transition disabled:opacity-50 ${style === s.key ? "bg-foreground text-background shadow" : "text-muted-foreground"}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {savedUrl ? (
              <Button className="mt-3 h-12 w-full rounded-full text-base font-bold" onClick={downloadResult}>
                <Download className="mr-1.5 h-4 w-4" /> 보정본 다운로드
              </Button>
            ) : (
              <Button className="mt-3 h-12 w-full rounded-full text-base font-bold" onClick={save} disabled={busy || (mode === "mock" && !blob)}>
                {busy ? "처리 중…" : `${ENHANCE_COST} 크레딧으로 보정하기`}
              </Button>
            )}
          </div>
        </div>,
        document.body,
      )}
      <CreditNudge open={lowCredit} onClose={() => setLowCredit(false)} />
    </>
  );
}
