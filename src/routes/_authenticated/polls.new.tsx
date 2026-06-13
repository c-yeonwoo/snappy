// @ts-nocheck
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createPoll } from "@/lib/photos.functions";
import { compressOriginal } from "@/lib/watermark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/polls/new")({
  head: () => ({ meta: [{ title: "새 투표 — Snappy" }] }),
  component: NewPollPage,
});

function NewPollPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createPoll);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const next = [...files, ...picked].slice(0, 4);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }
  function removeAt(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function submit() {
    if (files.length < 2) return toast.error("후보 사진을 2장 이상 골라주세요");
    setBusy(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user!.id;
      const paths: string[] = [];
      for (const file of files) {
        const blob = await compressOriginal(file);
        const path = `${uid}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("poll-images").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        paths.push(path);
      }
      const res = await createFn({ data: { question: question.trim() || undefined, image_paths: paths } });
      toast.success("투표를 만들었어요! 친구들이 골라줄 거예요");
      navigate({ to: "/polls/$id", params: { id: res.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <button onClick={() => navigate({ to: "/polls" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 고민
      </button>

      <div>
        <span className="chip">A컷 B컷</span>
        <h1 className="font-display mt-2 text-3xl font-extrabold">뭐가 제일 잘 나왔어?</h1>
        <p className="mt-1 text-sm text-muted-foreground">후보 2~4장을 올리면 친구들이 골라줘요.</p>
      </div>

      {/* 후보 그리드 */}
      <div className="grid grid-cols-2 gap-2.5">
        {previews.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border border-white/70 bg-secondary">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button onClick={() => removeAt(i)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background">
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold">{i + 1}</span>
          </div>
        ))}
        {files.length < 4 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-card/60 text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs font-semibold">사진 추가</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
          </label>
        )}
      </div>

      <div>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={140} placeholder="질문 (선택) 예: 프로필 뭐가 나아?" className="rounded-2xl" />
      </div>

      <Button size="lg" className="w-full rounded-full text-base" onClick={submit} disabled={busy || files.length < 2}>
        {busy ? "올리는 중…" : "투표 만들기"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        친구에게만 보여요. <Link to="/friends" className="font-semibold underline-offset-2 hover:underline">친구 먼저 추가하기</Link>
      </p>
    </div>
  );
}
