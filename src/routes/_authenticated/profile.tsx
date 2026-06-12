import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getMyProfile, updateMyProfile, searchProfiles } from "@/lib/photos.functions";
import { toast } from "sonner";
import { useFriendsStore, formatRemaining } from "@/lib/friends-mock";
import { UserPlus, X, Search, Radio, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "프로필 — Snappy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const search = useServerFn(searchProfiles);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { friends, windowUntil, addFriend, removeFriend, openWindow, closeWindow } = useFriendsStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; handle: string; display_name: string }[]>([]);

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

  async function doSearch() {
    if (!q.trim()) return;
    const res = await search({ data: { q } });
    setResults(res.results);
  }

  const windowActive = !!windowUntil;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <span className="chip">나</span>
        <h1 className="font-display mt-2 text-3xl font-extrabold">내 계정</h1>
        <p className="mt-1 text-sm text-muted-foreground">프로필, 친구, 받기 설정을 한 곳에서.</p>
      </header>

      {/* Profile */}
      <form onSubmit={save} className="space-y-4 rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur">
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

      {/* Allow window (AirDrop-like) */}
      <section className="rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> 받기 설정</p>
            <h2 className="font-display mt-1 text-lg font-extrabold">모르는 사람도 10분 동안 받기</h2>
            <p className="mt-1 text-xs text-muted-foreground">기본적으로 친구만 보낼 수 있어요. 켜는 동안만 모든 사람이 보낼 수 있어요.</p>
          </div>
          <Switch checked={windowActive} onCheckedChange={(v) => (v ? openWindow(10) : closeWindow())} />
        </div>
        {windowActive && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-sky-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> 열려 있음</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{formatRemaining(windowUntil!)}</span>
          </div>
        )}
      </section>

      {/* Friends */}
      <section className="rounded-[1.75rem] border border-white/70 bg-card/90 p-6 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">친구 ({friends.length})</p>
        <h2 className="font-display mt-1 text-lg font-extrabold">서로 보내기 자유</h2>
        <p className="mt-1 text-xs text-muted-foreground">친구는 언제든 나에게 사진/영상을 보낼 수 있어요.</p>

        <div className="mt-4 flex gap-2">
          <Input placeholder="@핸들 또는 이름" className="rounded-full" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())} />
          <Button type="button" className="rounded-full" onClick={doSearch}><Search className="h-4 w-4" /></Button>
        </div>
        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {results.map((r) => {
              const already = friends.some((f) => f.id === r.id);
              return (
                <li key={r.id} className="flex items-center justify-between px-3 py-2.5">
                  <span><span className="font-medium">{r.display_name}</span> <span className="text-xs text-muted-foreground">@{r.handle}</span></span>
                  <Button size="sm" variant={already ? "ghost" : "default"} className="rounded-full" disabled={already} onClick={() => { addFriend(r); toast.success("친구 추가됨"); }}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" />{already ? "추가됨" : "추가"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {friends.length > 0 && (
          <ul className="mt-4 space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-soft font-display font-bold">{f.display_name?.[0] ?? "?"}</div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{f.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{f.handle}</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="rounded-full" onClick={() => removeFriend(f.id)}><X className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}