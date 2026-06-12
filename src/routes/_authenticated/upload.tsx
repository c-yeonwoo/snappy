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
import { Search, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "사진 보내기 — SnapBuddy" }] }),
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
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold">사진 보내기</h1>
        <p className="mt-1 text-sm text-muted-foreground">받는 사람을 찾고, 사진을 올리세요. 자동으로 워터마크가 입혀집니다.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        <Label>1. 받는 사람</Label>
        {selected ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted p-3">
            <div>
              <p className="font-medium">{selected.display_name}</p>
              <p className="text-xs text-muted-foreground">@{selected.handle}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <Input placeholder="핸들 또는 이름" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())} />
              <Button type="button" onClick={doSearch}><Search className="h-4 w-4" /></Button>
            </div>
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted" onClick={() => { setSelected(r); setResults([]); setQ(""); }}>
                      <span><span className="font-medium">{r.display_name}</span> <span className="text-xs text-muted-foreground">@{r.handle}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <Label htmlFor="files">2. 사진 (여러 장 가능)</Label>
        <Input id="files" type="file" multiple accept="image/*" className="mt-3" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        {files.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{files.length}장 선택됨</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label htmlFor="price">3. 장당 가격 (USD)</Label>
          <Input id="price" type="number" min={1} max={100} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-2" />
          <p className="mt-1 text-xs text-muted-foreground">판매 시 70%가 적립됩니다.</p>
        </div>
        <div>
          <Label htmlFor="note">메시지 (선택)</Label>
          <Textarea id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" placeholder="짧은 메시지를 함께 보내보세요" />
        </div>
      </section>

      <Button size="lg" className="w-full" onClick={doUpload} disabled={busy}>
        <Upload className="mr-2 h-4 w-4" />
        {busy ? "보내는 중…" : "사진 보내기"}
      </Button>
    </div>
  );
}