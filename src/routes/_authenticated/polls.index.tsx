// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPolls, getFriendPolls } from "@/lib/photos.functions";
import { relativeTime } from "@/lib/format";
import { Plus, Vote, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/polls/")({
  head: () => ({ meta: [{ title: "고민 — Snappy" }] }),
  component: PollsPage,
});

function PollsPage() {
  const myFn = useServerFn(getMyPolls);
  const friendFn = useServerFn(getFriendPolls);
  const { data: mine } = useQuery({ queryKey: ["myPolls"], queryFn: () => myFn() });
  const { data: friends } = useQuery({ queryKey: ["friendPolls"], queryFn: () => friendFn() });

  const myPolls = mine?.polls ?? [];
  const friendPolls = friends?.polls ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="chip"><Vote className="h-3.5 w-3.5" /> 고민</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold">A컷 B컷, 골라줘</h1>
        </div>
        <Link to="/polls/new" className="inline-flex h-10 items-center gap-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background active:scale-95">
          <Plus className="h-4 w-4" /> 새 투표
        </Link>
      </div>

      {/* 친구가 올린 투표 — 골라줄 차례 */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">친구 투표 · {friendPolls.length}</p>
        {friendPolls.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            친구가 올린 투표가 아직 없어요.
          </div>
        ) : (
          <div className="space-y-2.5">
            {friendPolls.map((p: any) => (
              <Link key={p.id} to="/polls/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 p-2.5 backdrop-blur active:scale-[0.99]">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.question || "어떤 컷이 제일 잘 나왔어?"}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">@{p.owner?.handle ?? "?"} · 후보 {p.option_count}장</p>
                </div>
                {p.voted ? (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">투표함</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">투표하기</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 내 투표 */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">내 투표 · {myPolls.length}</p>
        {myPolls.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><Users className="h-6 w-6 text-foreground" /></div>
            <h2 className="font-display mt-4 text-lg font-bold">고민되는 컷, 친구에게 물어봐요</h2>
            <p className="mt-1 text-sm text-muted-foreground">후보를 올리면 친구들이 골라줘요.</p>
            <Link to="/polls/new" className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">새 투표 만들기</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {myPolls.map((p: any) => (
              <Link key={p.id} to="/polls/$id" params={{ id: p.id }} className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-card shadow-sm active:scale-[0.99]">
                <div className="relative aspect-square bg-secondary">
                  {p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}
                  <span className={`absolute left-2 top-2 chip text-[9px] ${p.status === "closed" ? "!bg-muted !text-muted-foreground !border-border" : "!bg-primary !text-primary-foreground !border-primary/40"}`}>
                    {p.status === "closed" ? "마감" : "진행중"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold">{p.question || `후보 ${p.option_count}장`}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">투표 {p.vote_count} · {relativeTime(p.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
