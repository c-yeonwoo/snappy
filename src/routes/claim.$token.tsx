// @ts-nocheck
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInvite, claimInvite } from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Gift, Lock, ImageDown } from "lucide-react";

const PENDING_KEY = "snappy_pending_claim";

export const Route = createFileRoute("/claim/$token")({
  // SSR loader → 카톡/SNS 링크 미리보기(OG)에 '그 사람 사진'이 뜨게 한다.
  loader: ({ params }) => getInvite({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const inv: any = loaderData;
    const ok = inv?.found && inv?.status !== "claimed";
    const who = inv?.inviter?.handle ? `@${inv.inviter.handle}` : "친구";
    const title = ok ? `${who} 님이 사진 ${inv.count}장을 보냈어요 — Snappy` : "사진 초대 — Snappy";
    const desc = ok ? "가입하면 원본을 받고 둘 다 +5 크레딧이 쌓여요." : "친구가 찍어준 내 인생샷을 원본으로.";
    const img = (inv?.previews ?? []).find((u: string | null) => !!u) ?? undefined;
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (img) {
      meta.push({ property: "og:image", content: img });
      meta.push({ name: "twitter:image", content: img });
    }
    return { meta };
  },
  component: ClaimPage,
});

function ClaimPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const claimFn = useServerFn(claimInvite);
  const data = Route.useLoaderData() as any;
  const isLoading = false;
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      const ok = !!u.user;
      setAuthed(ok);
      if (!ok) localStorage.setItem(PENDING_KEY, token); // 가입 후 자동 복귀용
    });
  }, [token]);

  async function claim() {
    setBusy(true);
    try {
      const res = await claimFn({ data: { token } });
      localStorage.removeItem(PENDING_KEY);
      toast.success("사진을 받았어요! +5 크레딧 적립");
      navigate({ to: "/batch/$id", params: { id: res.batch_id } });
    } catch (e: any) {
      toast.error(e?.message ?? "받기 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand blur-3xl opacity-60" />
      <header className="pt-safe relative mx-auto w-full max-w-md px-[18px] py-5">
        <Link to="/"><Logo /></Link>
      </header>

      <main className="relative mx-auto w-full max-w-md flex-1 px-[18px] pb-16">
        {isLoading ? (
          <p className="text-muted-foreground">불러오는 중…</p>
        ) : !data?.found ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-10 text-center">
            <h1 className="font-display text-xl font-bold">받을 수 없는 초대예요</h1>
            <p className="mt-1 text-sm text-muted-foreground">이미 받았거나 만료된 링크일 수 있어요.</p>
            <Link to="/" className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">Snappy 시작하기</Link>
          </div>
        ) : data.status === "claimed" ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card/80 p-10 text-center">
            <h1 className="font-display text-xl font-bold">이미 받은 초대예요</h1>
            <Link to="/feed" className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">받은함 보기</Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="chip mx-auto"><Gift className="h-3.5 w-3.5" /> 사진 초대</span>
              <h1 className="font-display mt-3 text-2xl font-extrabold">
                <b>@{data.inviter?.handle ?? "친구"}</b> 님이<br />사진 {data.count}장을 보냈어요
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                가입하면 원본을 받고 <b className="text-foreground">+5 크레딧</b>이 쌓여요.
              </p>
            </div>

            {/* 워터마크 미리보기 */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {(data.previews ?? []).slice(0, 4).map((src: string | null, i: number) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-[1.25rem] border border-white/70 bg-secondary">
                  {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground/60 text-background"><Lock className="h-3 w-3" /></span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              {authed ? (
                <Button size="lg" className="h-14 w-full rounded-full text-base font-bold" onClick={claim} disabled={busy}>
                  <ImageDown className="mr-1.5 h-4 w-4" /> {busy ? "받는 중…" : "사진 받고 +5 크레딧"}
                </Button>
              ) : (
                <Link to="/auth">
                  <Button size="lg" className="h-14 w-full rounded-full text-base font-bold">
                    가입하고 사진 받기 <span className="ml-1 opacity-80">+5 크레딧</span>
                  </Button>
                </Link>
              )}
              <p className="mt-3 text-center text-[11px] text-muted-foreground">친구가 찍어준 내 인생샷을 원본으로 — Snappy</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
