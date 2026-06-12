import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPhotoDetail, purchasePhoto, reportPhoto, removePhoto } from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Flag, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/photo/$id")({
  head: () => ({ meta: [{ title: "사진 — SnapBuddy" }] }),
  component: PhotoDetailPage,
});

function PhotoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getPhotoDetail);
  const buy = useServerFn(purchasePhoto);
  const report = useServerFn(reportPhoto);
  const remove = useServerFn(removePhoto);
  const { data, isLoading } = useQuery({ queryKey: ["photo", id], queryFn: () => fetchDetail({ data: { id } }) });
  const [reason, setReason] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <p className="text-muted-foreground">불러오는 중…</p>;
  const p = data.photo;
  const me = supabase.auth.getUser; // not used directly; we infer from data
  const isSubject = p.subject_id === (supabase.auth as any)?.currentUser?.id || true; // server already gated; show all controls

  async function handleBuy() {
    setBusy(true);
    try {
      const res = await buy({ data: { id } });
      setOriginalUrl(res.original_url);
      toast.success("구매 완료! 원본을 받았어요.");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["photo", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "구매 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!reason.trim()) return;
    try {
      await report({ data: { id, reason } });
      toast.success("신고가 접수되었고 사진은 피드에서 삭제됐어요.");
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e?.message ?? "신고 실패");
    }
  }

  async function handleRemove() {
    if (!confirm("이 사진을 내 피드에서 삭제할까요?")) return;
    try {
      await remove({ data: { id } });
      toast.success("삭제됐어요");
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  const finalOriginalUrl = originalUrl ?? p.original_url;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="bg-muted">
          {p.preview_url && <img src={p.preview_url} alt="" className="mx-auto max-h-[70vh] w-full object-contain" />}
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">촬영</p>
              <p className="font-semibold">@{p.uploader?.handle} · {p.uploader?.display_name}</p>
              {p.note && <p className="mt-2 text-sm">{p.note}</p>}
            </div>
            <p className="text-2xl font-bold text-primary">${(p.price_cents / 100).toFixed(2)}</p>
          </div>

          {p.status === "available" ? (
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={handleBuy} disabled={busy}>
                {busy ? "처리 중…" : "구매하고 원본 받기"}
              </Button>
              <Button variant="outline" size="icon" onClick={handleRemove} title="삭제"><Trash2 className="h-4 w-4" /></Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" title="신고"><Flag className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>이 사진 신고하기</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground">합의 없이 찍힌 사진이면 신고해주세요. 신고와 동시에 피드에서 삭제됩니다.</p>
                  <Textarea placeholder="신고 사유" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                  <Button variant="destructive" onClick={handleReport}>신고하기</Button>
                </DialogContent>
              </Dialog>
            </div>
          ) : p.status === "sold" ? (
            <div className="mt-6">
              {finalOriginalUrl ? (
                <a href={finalOriginalUrl} download className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground">
                  <Download className="h-4 w-4" /> 원본 다운로드
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">구매 완료된 사진이에요.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}