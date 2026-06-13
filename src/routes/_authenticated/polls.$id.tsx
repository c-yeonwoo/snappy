// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPoll, votePoll, closePoll } from "@/lib/photos.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Check, Trophy, Lock, X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

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
  const [selected, setSelected] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ["poll", id], queryFn: () => pollFn({ data: { id } }) });

  // 이미 투표했으면 그 선택을 기본값으로
  useEffect(() => {
    if (data?.my_vote) setSelected(data.my_vote);
  }, [data?.my_vote]);

  async function submitVote() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await voteFn({ data: { poll_id: id, option_id: selected } });
      toast.success(data?.my_vote ? "투표를 변경했어요" : "투표 완료!");
      qc.invalidateQueries({ queryKey: ["poll", id] });
      qc.invalidateQueries({ queryKey: ["friendPolls"] });
    } catch (e: any) {
      toast.error(e?.message ?? "투표 실패");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!window.confirm("투표를 마감할까요? 마감하면 더 이상 투표할 수 없어요.")) return;
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
  const canVote = !is_owner && status === "open";
  const changed = selected && selected !== my_vote;

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
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold">
          {my_vote ? "다른 컷을 고르면 투표를 바꿀 수 있어요." : "사진을 눌러 크게 보고, 마음에 드는 컷을 골라주세요."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o: any, i: number) => {
          const isPicked = selected === o.id;
          const isMine = my_vote === o.id;
          const isWinner = revealed && (o.votes ?? 0) === maxVotes && maxVotes > 0;
          const pct = revealed && total_votes > 0 ? Math.round(((o.votes ?? 0) / total_votes) * 100) : 0;
          return (
            <div
              key={o.id}
              className={`relative overflow-hidden rounded-[1.25rem] border-2 bg-secondary transition ${isPicked ? "border-primary ring-2 ring-primary/30" : "border-white/70"}`}
            >
              <button onClick={() => setLightbox(i)} className="relative block aspect-square w-full active:scale-[0.98]">
                {o.image_url && <img src={o.image_url} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold">{i + 1}</span>
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground/55 text-background"><Maximize2 className="h-3 w-3" /></span>
                {isWinner && (
                  <span className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"><Trophy className="h-3.5 w-3.5" /></span>
                )}
                {isMine && (
                  <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"><Check className="h-4 w-4" /></span>
                )}
              </button>
              {canVote && (
                <button
                  onClick={() => setSelected(o.id)}
                  className={`w-full py-2 text-xs font-bold transition ${isPicked ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                >
                  {isPicked ? "선택됨" : "이 컷 선택"}
                </button>
              )}
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
            </div>
          );
        })}
      </div>

      {canVote && (
        <Button className="h-12 w-full rounded-full text-base" onClick={submitVote} disabled={busy || !selected || (!!my_vote && !changed)}>
          {busy ? "제출 중…" : my_vote ? (changed ? "투표 변경하기" : "투표함") : "투표하기"}
        </Button>
      )}

      {!revealed && !canVote && (
        <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-secondary py-3 text-sm font-semibold text-muted-foreground">
          <Lock className="h-4 w-4" /> 투표하면 결과를 볼 수 있어요
        </p>
      )}

      {/* 확대 라이트박스 */}
      {lightbox !== null && options[lightbox] && (
        <div className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[480px] -translate-x-1/2 flex-col bg-foreground/95" onClick={() => setLightbox(null)}>
          <div className="flex justify-end p-4">
            <button onClick={() => setLightbox(null)} className="grid h-10 w-10 place-items-center rounded-full bg-background/15 text-background"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            {options[lightbox].image_url && <img src={options[lightbox].image_url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />}
            {options.length > 1 && (
              <>
                <button onClick={() => setLightbox((lightbox - 1 + options.length) % options.length)} className="absolute left-2 grid h-10 w-10 place-items-center rounded-full bg-background/15 text-background"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => setLightbox((lightbox + 1) % options.length)} className="absolute right-2 grid h-10 w-10 place-items-center rounded-full bg-background/15 text-background"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
            <span className="absolute left-4 top-0 rounded-full bg-background/15 px-2.5 py-1 text-xs font-bold text-background">{lightbox + 1} / {options.length}</span>
          </div>
          <div className="p-5" onClick={(e) => e.stopPropagation()}>
            {canVote ? (
              <Button
                className="h-12 w-full rounded-full text-base"
                onClick={() => { setSelected(options[lightbox].id); setLightbox(null); }}
              >
                {selected === options[lightbox].id ? "선택됨" : "이 컷 선택"}
              </Button>
            ) : (
              <p className="text-center text-sm font-semibold text-background/70">{lightbox + 1}번 컷</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
