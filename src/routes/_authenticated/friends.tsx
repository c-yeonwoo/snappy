import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchProfiles } from "@/lib/photos.functions";
import { toast } from "sonner";
import { useFriendsStore } from "@/lib/friends-mock";
import { ArrowLeft, Search, UserPlus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "친구 — Snappy" }] }),
  component: FriendsPage,
});

function FriendsPage() {
  const search = useServerFn(searchProfiles);
  const { friends, addFriend, removeFriend } = useFriendsStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; handle: string; display_name: string }[]>([]);

  async function doSearch() {
    if (!q.trim()) return;
    const res = await search({ data: { q } });
    setResults(res.results);
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 나
      </Link>
      <header>
        <h1 className="font-display text-3xl font-extrabold">친구</h1>
        <p className="mt-1 text-sm text-muted-foreground">친구끼리는 바로 사진을 보낼 수 있어요.</p>
      </header>

      <div className="flex gap-2">
        <Input placeholder="@핸들 또는 이름" className="rounded-full" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())} />
        <Button type="button" className="rounded-full" onClick={doSearch}><Search className="h-4 w-4" /></Button>
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/80">
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

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">내 친구 ({friends.length})</p>
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            아직 친구가 없어요. 위에서 검색해 추가해보세요.
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl bg-card/80 px-3 py-2.5 backdrop-blur">
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