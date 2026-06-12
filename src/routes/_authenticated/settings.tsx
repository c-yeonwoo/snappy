import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getMyProfile, updateMyProfile, setAllowWindow } from "@/lib/photos.functions";
import { toast } from "sonner";
import { formatRemaining, isWindowOpen } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { ArrowLeft, Radio, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "설정 — Snappy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const setWindow = useServerFn(setAllowWindow);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");

  const allowUntil = data?.profile?.allow_until ?? null;
  const windowActive = isWindowOpen(allowUntil);
  useNow(windowActive); // 카운트다운 갱신

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

  async function toggleWindow(on: boolean) {
    try {
      await setWindow({ data: { minutes: on ? 10 : 0 } });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "변경 실패");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 나
      </Link>
      <h1 className="font-display text-3xl font-extrabold">설정</h1>

      <form onSubmit={save} className="space-y-4 rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">프로필</p>
        <div>
          <Label htmlFor="handle">핸들 (영문/숫자/_)</Label>
          <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} pattern="[a-z0-9_]+" minLength={2} maxLength={32} required className="mt-2 rounded-full" />
        </div>
        <div>
          <Label htmlFor="dn">표시 이름</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={64} className="mt-2 rounded-full" />
        </div>
        <Button type="submit" className="w-full rounded-full">저장</Button>
      </form>

      <section className="rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> 받기 설정</p>
            <h2 className="font-display mt-1 text-base font-extrabold">친구가 아닌 사람도 10분 동안 받기</h2>
            <p className="mt-1 text-xs text-muted-foreground">기본은 친구만. 켜는 동안만 누구나 보낼 수 있어요.</p>
          </div>
          <Switch checked={windowActive} onCheckedChange={toggleWindow} />
        </div>
        {windowActive && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> 열려 있음</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{formatRemaining(allowUntil!)}</span>
          </div>
        )}
      </section>
    </div>
  );
}
