import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchProfiles, getFriends, sendFriendRequest, respondFriendRequest, removeFriend } from "@/lib/photos.functions";
import { toast } from "sonner";
import { ArrowLeft, Search, UserPlus, X, Check, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "친구 — Snappy" }] }),
  component: FriendsPage,
});

type Mini = { id: string; handle: string; display_name: string };

function FriendsPage() {
  const qc = useQueryClient();
  const search = useServerFn(searchProfiles);
  const listFn = useServerFn(getFriends);
  const sendReq = useServerFn(sendFriendRequest);
  const respond = useServerFn(respondFriendRequest);
  const remove = useServerFn(removeFriend);

  const { data } = useQuery({ queryKey: ["friends"], queryFn: () => listFn() });
  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Mini[]>([]);

  const friendIds = new Set(friends.map((f) => f.id));
  const outgoingIds = new Set(outgoing.map((f) => f.id));
  const incomingIds = new Set(incoming.map((f) => f.id));

  const refresh = () => qc.invalidateQueries({ queryKey: ["friends"] });

  async function doSearch() {
    if (!q.trim()) return;
    const res = await search({ data: { q } });
    setResults(res.results);
  }
  async function request(id: string) {
    const r = await sendReq({ data: { to_id: id } });
    toast.success(r.status === "accepted" ? "친구가 됐어요!" : "친구 요청을 보냈어요");
    refresh();
  }
  async function accept(id: string) {
    await respond({ data: { from_id: id, accept: true } });
    toast.success("친구가 됐어요!");
    refresh();
  }
  async function reject(id: string) {
    await respond({ data: { from_id: id, accept: false } });
    refresh();
  }
  async function unfriend(id: string) {
    await remove({ data: { other_id: id } });
    refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 나
      </Link>
      <header>
        <h1 className="font-display text-3xl font-extrabold">친구</h1>
        <p className="mt-1 text-sm text-muted-foreground">친구는 서로 수락해야 맺어져요. 친구끼리는 바로 사진을 보낼 수 있어요.</p>
      </header>

      <div className="flex gap-2">
        <Input placeholder="@핸들 또는 이름" className="rounded-full" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())} />
        <Button type="button" className="rounded-full" onClick={doSearch}><Search className="h-4 w-4" /></Button>
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/80">
          {results.map((r) => {
            const isFriend = friendIds.has(r.id);
            const isOutgoing = outgoingIds.has(r.id);
            const isIncoming = incomingIds.has(r.id);
            return (
              <li key={r.id} className="flex items-center justify-between px-3 py-2.5">
                <span><span className="font-medium">{r.display_name}</span> <span className="text-xs text-muted-foreground">@{r.handle}</span></span>
                {isFriend ? (
                  <span className="text-xs font-semibold text-primary">친구</span>
                ) : isIncoming ? (
                  <Button size="sm" className="rounded-full" onClick={() => accept(r.id)}><Check className="mr-1 h-3.5 w-3.5" />수락</Button>
                ) : isOutgoing ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />요청됨</span>
                ) : (
                  <Button size="sm" className="rounded-full" onClick={() => request(r.id)}><UserPlus className="mr-1 h-3.5 w-3.5" />친구 요청</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {incoming.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">받은 요청 ({incoming.length})</p>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl bg-card/80 px-3 py-2.5 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-display font-bold">{f.display_name?.[0] ?? "?"}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{f.display_name}</p><p className="truncate text-xs text-muted-foreground">@{f.handle}</p></div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" className="rounded-full" onClick={() => accept(f.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => reject(f.id)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">내 친구 ({friends.length})</p>
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            아직 친구가 없어요. 위에서 검색해 요청을 보내보세요.
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl bg-card/80 px-3 py-2.5 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-display font-bold">{f.display_name?.[0] ?? "?"}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{f.display_name}</p><p className="truncate text-xs text-muted-foreground">@{f.handle}</p></div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 rounded-full text-muted-foreground" onClick={() => unfriend(f.id)}><X className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">보낸 요청 ({outgoing.length})</p>
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl bg-card/60 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-display font-bold">{f.display_name?.[0] ?? "?"}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{f.display_name}</p><p className="truncate text-xs text-muted-foreground">@{f.handle}</p></div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />수락 대기</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
