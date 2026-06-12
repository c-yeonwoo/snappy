import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, updateMyProfile } from "@/lib/photos.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "프로필 — SnapBuddy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setHandle(data.profile.handle);
      setDisplayName(data.profile.display_name);
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update({ data: { handle, display_name: displayName } });
      toast.success("저장됐어요");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">프로필</h1>
      <p className="mt-1 text-sm text-muted-foreground">친구가 나를 찾을 때 쓰는 핸들을 정하세요.</p>
      <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="handle">핸들 (영문/숫자/_)</Label>
          <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} pattern="[a-z0-9_]+" minLength={2} maxLength={32} required className="mt-2" />
        </div>
        <div>
          <Label htmlFor="dn">표시 이름</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={64} className="mt-2" />
        </div>
        <Button type="submit" className="w-full">저장</Button>
      </form>
    </div>
  );
}