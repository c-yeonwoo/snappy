import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { searchProfiles, createPhoto } from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { watermarkImage, compressOriginal } from "@/lib/watermark";
import { toast } from "sonner";
import { Search, Upload, X, Film, Image as ImageIcon, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "사진 보내기 — Snappy" }] }),
  component: UploadPage,
});

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

function UploadPage() {
  const navigate = useNavigate();
  const search = useServerFn(searchProfiles);
  const create = useServerFn(createPhoto);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [price, setPrice] = useState(5);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function doSearch() {
    if (!q.trim()) return;
    const { results } = await search({ data: { q } });
    setResults(results);
  }

  async function doUpload() {
    if (!selected || files.length === 0) {
      toast.error("받는 사람과 사진을 선택해주세요");
      return;
    }
    setBusy(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uploaderId = userResp.user!.id;
      let succeeded = 0;
      for (const file of files) {
        const [originalBlob, watermarkedBlob] = await Promise.all([
          compressOriginal(file),
          watermarkImage(file),
        ]);
        const photoId = crypto.randomUUID();
        const originalPath = `${uploaderId}/${photoId}.jpg`;
        const watermarkedPath = `${selected.id}/${photoId}.jpg`;

        const up1 = await supabase.storage
          .from("photos-original")
          .upload(originalPath, originalBlob, { contentType: "image/jpeg" });
        if (up1.error) throw up1.error;
        const up2 = await supabase.storage
          .from("photos-watermarked")
          .upload(watermarkedPath, watermarkedBlob, { contentType: "image/jpeg" });
        if (up2.error) throw up2.error;

        await create({
          data: {
            subject_id: selected.id,
            original_path: originalPath,
            watermarked_path: watermarkedPath,
            price_cents: Math.round(price * 100),
            note: note || undefined,
          },
        });
        succeeded++;
      }
      toast.success(`${succeeded}장 보냈어요!`);
      navigate({ to: "/sent" });
    } catch (e: any) {
      toast.error(e?.message ?? "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <span className="chip">보내기</span>
        <h1 className="font-display mt-2 text-3xl font-extrabold">사진·영상 보내기</h1>
        <p className="mt-1 text-sm text-muted-foreground">받는 사람을 찾고 올려요. 자동 워터마크 적용.</p>
      </header>

      <section className="rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur">
        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">1 · 받는 사람</Label>
        {selected ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-soft font-display font-bold">{selected.display_name?.[0] ?? "?"}</div>
              <div>
                <p className="font-semibold">{selected.display_name}</p>
              <p className="text-xs text-muted-foreground">@{selected.handle}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <Input placeholder="@핸들 또는 이름" className="rounded-full" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())} />
              <Button type="button" className="rounded-full" onClick={doSearch}><Search className="h-4 w-4" /></Button>
            </div>
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-secondary" onClick={() => { setSelected(r); setResults([]); setQ(""); }}>
                      <span><span className="font-medium">{r.display_name}</span> <span className="text-xs text-muted-foreground">@{r.handle}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur">
        <Label htmlFor="files" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">2 · 사진 / 영상</Label>
        <label htmlFor="files" className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent/50 bg-sky/60 px-6 py-10 text-center transition hover:bg-sky">
          <div className="flex gap-1.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white shadow-sm"><ImageIcon className="h-4 w-4" /></span>
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white shadow-sm"><Film className="h-4 w-4" /></span>
          </div>
          <p className="mt-3 font-display font-bold">탭해서 골라요</p>
          <p className="mt-1 text-xs text-muted-foreground">사진·동영상 여러 개 OK · 자동 워터마크</p>
        </label>
        <Input id="files" type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((f, i) => {
              const url = URL.createObjectURL(f);
              const isVid = f.type.startsWith("video/");
              return (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  {isVid ? <video src={url} muted className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />}
                  {isVid && <span className="absolute left-1 top-1 chip !px-1.5 !py-0 !bg-foreground/80 !text-background !border-transparent"><Play className="h-2.5 w-2.5" />영상</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur space-y-5">
        <div>
          <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">3 · 한 컷 가격 (USD)</Label>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center rounded-full bg-secondary px-1">
              <Button type="button" variant="ghost" size="sm" className="rounded-full px-2" onClick={() => setPrice(Math.max(1, price - 1))}>−</Button>
              <span className="font-display w-14 text-center text-lg font-extrabold">${price}</span>
              <Button type="button" variant="ghost" size="sm" className="rounded-full px-2" onClick={() => setPrice(Math.min(100, price + 1))}>+</Button>
            </div>
            <p className="text-xs text-muted-foreground">팔리면 <b className="text-foreground">${(price * 0.7).toFixed(2)}</b> 내 적립</p>
          </div>
        </div>
        <div>
          <Label htmlFor="note" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">메시지 (선택)</Label>
          <Textarea id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2 rounded-2xl" placeholder="짧은 메시지" />
        </div>
      </section>

      <Button size="lg" className="w-full rounded-full text-base" onClick={doUpload} disabled={busy}>
        <Upload className="mr-2 h-4 w-4" />
        {busy ? "보내는 중…" : "톡 보내기"}
      </Button>
    </div>
  );
}