import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Download, Play, ShieldCheck, MessageCircle, Camera, BookmarkCheck } from "lucide-react";
import { getMockPhoto, isPurchased, purchase, usePurchased, relativeTime } from "@/lib/mock-feed";

export const Route = createFileRoute("/_authenticated/photo/$id")({
  head: () => ({ meta: [{ title: "사진 — Snappy" }] }),
  component: PhotoDetailPage,
});

function PhotoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  usePurchased(); // re-render when purchase state changes
  const p = getMockPhoto(id);
  const owned = p ? isPurchased(p.id) : false;
  const [busy, setBusy] = useState(false);
  const [justBought, setJustBought] = useState(false);

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

  if (!p) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">사진을 찾을 수 없어요.</p>
        <Link to="/feed" className="mt-3 inline-block text-sm font-semibold underline">받은함으로</Link>
      </div>
    );
  }

  async function handleBuy() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    purchase(p!.id);
    setJustBought(true);
    setBusy(false);
    toast.success("결제 완료! 워터마크가 풀렸어요.");
  }

  async function handleDownload() {
    try {
      const res = await fetch(p!.original_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snappy-${p!.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("다운로드 실패");
    }
  }

  const unlocked = owned || justBought;

  return (
    <div className="mx-auto max-w-md">
      <button onClick={() => navigate({ to: "/feed" })} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 받은함
      </button>

      {/* Expanded image */}
      <div className="no-capture no-capture-hide relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-[0_25px_60px_-30px_rgba(125,160,200,0.5)]" onContextMenu={(e) => e.preventDefault()}>
        <div className="relative aspect-[4/5] bg-secondary">
          <img src={p.preview_url} alt="" draggable={false} className="h-full w-full object-cover" />

          {/* dense diagonal watermark — disappears immediately on purchase */}
          {!unlocked && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-[-30%] grid grid-cols-3 gap-y-10 rotate-[-18deg] place-items-center">
                {Array.from({ length: 36 }).map((_, i) => (
                  <span key={i} className="text-[13px] font-extrabold tracking-[0.25em] text-white/60 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                    SNAPPY · @me
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.is_video && (
            <span className="absolute left-3 top-3 chip !bg-white/90"><Play className="h-3 w-3" /> 영상</span>
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
          <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-soft font-display font-extrabold">
            {p.uploader.display_name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" /> photo by
            </p>
            <p className="font-display truncate text-base font-extrabold">
              {p.uploader.display_name} <span className="text-muted-foreground">@{p.uploader.handle}</span>
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">{relativeTime(p.received_at)}</span>
        </div>

        {p.note && (
          <div className="mt-4 flex gap-2 rounded-2xl bg-secondary px-3 py-2.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">{p.note}</p>
          </div>
        )}

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">가격</p>
            <p className="font-display text-3xl font-extrabold text-primary">${(p.price_cents / 100).toFixed(2)}</p>
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
            <Button className="h-12 w-full rounded-full text-base" onClick={handleDownload}>
              <Download className="mr-1.5 h-4 w-4" /> 원본 다운로드
            </Button>
          ) : (
            <Button className="h-12 w-full rounded-full text-base" onClick={handleBuy} disabled={busy}>
              {busy ? "결제 중…" : `${(p.price_cents / 100).toFixed(2)}$ 결제하고 원본 받기`}
            </Button>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">결제 즉시 워터마크가 풀리고 다운로드할 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}