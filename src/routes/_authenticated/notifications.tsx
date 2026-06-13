import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFriends, getMyFeed, getMySent, respondFriendRequest } from "@/lib/photos.functions";
import { formatPoint, relativeTime, isNew } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus, ImageDown, Coins, Check, X, BellOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "알림 — Snappy" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const friendsFn = useServerFn(getFriends);
  const feedFn = useServerFn(getMyFeed);
  const sentFn = useServerFn(getMySent);
  const respond = useServerFn(respondFriendRequest);

  const { data: friendsData } = useQuery({ queryKey: ["friends"], queryFn: () => friendsFn() });
  const { data: feedData } = useQuery({ queryKey: ["feed"], queryFn: () => feedFn() });
  const { data: sentData } = useQuery({ queryKey: ["sent"], queryFn: () => sentFn() });

  const incoming = friendsData?.incoming ?? [];
  const newReceived = (feedData?.photos ?? []).filter((p) => p.status === "available" && isNew(p.created_at));
  const sold = (sentData?.photos ?? []).filter((p) => p.status === "sold");
  const empty = incoming.length === 0 && newReceived.length === 0 && sold.length === 0;

  async function accept(id: string) {
    await respond({ data: { from_id: id, accept: true } });
    toast.success("친구가 됐어요!");
    qc.invalidateQueries({ queryKey: ["friends"] });
  }
  async function reject(id: string) {
    await respond({ data: { from_id: id, accept: false } });
    qc.invalidateQueries({ queryKey: ["friends"] });
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <button onClick={() => router.history.back()} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 뒤로
      </button>
      <header>
        <h1 className="font-display text-3xl font-extrabold">알림</h1>
      </header>

      {empty ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><BellOff className="h-6 w-6 text-foreground" /></div>
          <h2 className="font-display mt-4 text-lg font-bold">새 알림이 없어요</h2>
          <p className="mt-1 text-sm text-muted-foreground">친구 요청·새 사진·소장 소식이 여기로 모여요.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 친구 요청 */}
          {incoming.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">친구 요청</p>
              <ul className="space-y-2">
                {incoming.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 px-3 py-2.5 backdrop-blur">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft"><UserPlus className="h-4 w-4" /></span>
                    <p className="min-w-0 flex-1 text-sm"><b>{f.display_name}</b><span className="text-muted-foreground"> @{f.handle}</span> 님이 친구 요청을 보냈어요</p>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" className="rounded-full" onClick={() => accept(f.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => reject(f.id)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 새로 받은 사진 */}
          {newReceived.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">새로 받은 사진</p>
              <ul className="space-y-2">
                {newReceived.map((p) => (
                  <li key={p.id}>
                    <Link to="/photo/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 px-3 py-2.5 backdrop-blur transition active:bg-secondary">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft"><ImageDown className="h-4 w-4" /></span>
                      <p className="min-w-0 flex-1 text-sm"><b>@{p.uploader?.handle ?? "?"}</b> 님이 사진을 보냈어요</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(p.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 소장 소식 */}
          {sold.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">소장 소식</p>
              <ul className="space-y-2">
                {sold.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-card/90 px-3 py-2.5 backdrop-blur">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Coins className="h-4 w-4" /></span>
                    <p className="min-w-0 flex-1 text-sm"><b>@{p.subject?.handle ?? "?"}</b> 님이 내 사진을 소장했어요</p>
                    <span className="shrink-0 text-xs font-semibold font-digit text-foreground">+{formatPoint(Math.round(p.price_won * 0.7))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
