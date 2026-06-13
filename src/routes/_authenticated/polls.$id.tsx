// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPoll, votePoll, closePoll } from "@/lib/photos.functions";
import { toast } from "sonner";
import { ArrowLeft, Check, Trophy, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/polls/$id")({
  head: () => ({ meta: [{ title: "투표 — Snappy" }] }),
  component: PollDetailPage,
});

function PollDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pollFn = useServerFn(getPoll);
  const voteFn = useServerFn(votePoll);
  const closeFn = useServerFn(closePoll);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ["poll", id], queryFn: () => pollFn({ data: { id } }) });

  async function vote(optionId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await voteFn({ data: { poll_id: id, option_id: optionId } });
      toast.success("투표 완료!");
      qc.invalidateQueries({ queryKey: ["poll", id] });
      qc.invalidateQueries({ queryKey: ["friendPolls"] });
    } catch (e: any) {
      toast.error(e?.message ?? "투표 실패");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!window.confirm("투표를 마감할까요?")) return;
    setBusy(true);
    try {
      await closeFn({ data: { id } });
      toast.success("마감했어요");
      qc.invalidateQueries({ queryKey: ["poll", id] });
      qc.invalidateQueries({ queryKey: ["myPolls"] });
    } catch (e: any) {
      toast.error(e?.message ?? "마감 실패");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted-foreground">투표를 찾을 수 없어요.</p>
        <button onClick={() => navigate({ to: "/polls" })} className="mt-3 text-sm font-semibold underline">고민으로</button>
      </div>
    );
  }

  const { question, status, is_owner, my_vote, revealed, total_votes, owner, options } = data;
  const maxVotes = Math.max(0, ...options.map((o: any) => o.votes ?? 0));
  const canVote = !is_owner && !my_vote && status === "open";

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate({ to: "/polls" })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> 고민
        </button>
        {is_owner && status === "open" && (
          <button onClick={close} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/40">
            투표 마감
          </button>
        )}
      </div>

      <header>
        <h1 className="font-display text-2xl font-extrabold">{question || "어떤 컷이 제일 잘 나왔어?"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {is_owner ? "내 투표" : `@${owner?.handle ?? "?"} 의 투표`} · 투표 {total_votes}
          {status === "closed" && " · 마감됨"}
        </p>
      </header>

      {canVote && (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold">마음에 드는 컷을 골라주세요 👇</p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o: any, i: number) => {
          const isMine = my_vote === o.id;
          const isWinner = revealed && (o.votes ?? 0) === maxVotes && maxVotes > 0;
          const pct = revealed && total_votes > 0 ? Math.round(((o.votes ?? 0) / total_votes) * 100) : 0;
          return (
            <button
              key={o.id}
              disabled={!canVote || busy}
              onClick={() => canVote && vote(o.id)}
              className={`relative overflow-hidden rounded-[1.25rem] border-2 bg-secondary text-left transition ${
                isMine ? "border-primary" : "border-white/70"
              } ${canVote ? "active:scale-[0.98]" : "cursor-default"}`}
            >
              <div className="relative aspect-square">
                {o.image_url && <img src={o.image_url} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold">{i + 1}</span>
                {isWinner && (
                  <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <Trophy className="h-3.5 w-3.5" />
                  </span>
                )}
                {isMine && (
                  <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
              {revealed && (
                <div className="p-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={isWinner ? "text-primary" : "text-foreground"}>{pct}%</span>
                    <span className="text-muted-foreground">{o.votes ?? 0}표</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className={`h-full rounded-full ${isWinner ? "bg-primary" : "bg-foreground/40"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!revealed && !canVote && (
        <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-secondary py-3 text-sm font-semibold text-muted-foreground">
          <Lock className="h-4 w-4" /> 투표하면 결과를 볼 수 있어요
        </p>
      )}
    </div>
  );
}
