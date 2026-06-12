import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Camera, Heart, ImagePlus, Sparkles, Play, Wand2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SnapBuddy — 친구가 찍어주는 스냅샷" },
      { name: "description", content: "친구나 동행한 사람이 찍어준 사진을 워터마크 미리보기로 받고, 마음에 드는 컷만 골라 구매하세요. 촬영자에게는 수익이 분배됩니다." },
      { property: "og:title", content: "SnapBuddy — 친구가 찍어주는 스냅샷" },
      { property: "og:description", content: "찍어준 사진을 피드로 받고, 마음에 드는 컷만 골라 구매하는 캐주얼 포토 마켓." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* floating pastel blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-peach blur-3xl opacity-70" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-accent/60 blur-3xl opacity-60" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-foreground text-background">
            <Camera className="h-4 w-4" />
          </span>
          SnapBuddy
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm" className="rounded-full">로그인</Button></Link>
          <Link to="/auth"><Button size="sm" className="rounded-full px-4">시작하기 ✨</Button></Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24">
        <section className="pt-10 sm:pt-16">
          <span className="chip">
            <Sparkles className="h-3.5 w-3.5" /> 친구가 찍어주는 스냅 마켓
          </span>
          <h1 className="font-display mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            너가 찍어준 내 사진,<br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">맘에 드는 컷만</span> 가질래.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            여행에서, 카페에서, 길 위에서. 친구가 찍어준 <b>사진·영상</b>이 내 피드로 도착해요.
            워터마크 미리보기로 골라 결제하면 원본이 바로 다운로드. 찍어준 친구는 용돈 벌이 🍑
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg" className="rounded-full px-6">무료로 시작</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="rounded-full px-6 bg-card">📸 사진 보내러 가기</Button></Link>
          </div>

          {/* hero card mock */}
          <div className="mt-10 grid grid-cols-3 gap-2.5 sm:max-w-2xl sm:gap-3">
            {[
              { tag: "@yuna", emo: "🌊", grad: "from-sky-200 to-sky-100" },
              { tag: "@minho", emo: "🎞️", grad: "from-pink-200 to-rose-100", video: true },
              { tag: "@jiwoo", emo: "🌸", grad: "from-rose-200 to-amber-100" },
            ].map((c) => (
              <div key={c.tag} className={`relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br ${c.grad} shadow-[0_20px_60px_-20px_rgba(125,160,200,0.45)]`}>
                <div className="absolute inset-0 grid place-items-center text-5xl opacity-90">{c.emo}</div>
                <div className="absolute left-3 top-3 chip !bg-white/80 !backdrop-blur">
                  {c.video ? <Play className="h-3 w-3" /> : <Camera className="h-3 w-3" />} {c.tag}
                </div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_22px,rgba(255,255,255,0.35)_22px_24px)]" />
                <div className="absolute bottom-3 right-3 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold text-background">$3</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ImagePlus, title: "찍고 톡 보내기", body: "친구 핸들 검색 → 사진·영상 업로드. 자동 워터마크 ✨", bg: "bg-sky" },
            { icon: Heart, title: "피드에서 고르기", body: "도착한 컷 미리보기 → 맘에 드는 것만 콕!", bg: "bg-peach-soft" },
            { icon: Coins, title: "결제하면 바로", body: "원본 즉시 다운로드. 친구한텐 판매가의 70% 적립", bg: "bg-accent/30" },
          ].map((f) => (
            <div key={f.title} className={`rounded-3xl border border-white/60 ${f.bg} p-6 backdrop-blur`}>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/80 shadow-sm">
                <f.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="relative mt-24 overflow-hidden rounded-[2rem] bg-gradient-to-br from-foreground to-[oklch(0.32_0.06_260)] p-8 text-background sm:p-12">
          <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/40 blur-2xl" />
          <div aria-hidden className="absolute -bottom-12 -left-6 h-56 w-56 rounded-full bg-accent/40 blur-2xl" />
          <span className="chip !bg-white/15 !text-background !border-white/20"><Wand2 className="h-3.5 w-3.5" /> 부수입 모드</span>
          <h2 className="font-display mt-4 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
            관광지에서 사진 잘 찍는 사람,<br/>이젠 <span className="text-primary">용돈 버는 사람</span>이 되는 거.
          </h2>
          <p className="mt-3 max-w-xl text-sm opacity-80 sm:text-base">
            낯선 사람이 부탁한 사진도, 친구 영상도. 잘 찍어서 빠르게 판매 → 판매가의 70%가 내 지갑으로.
          </p>
          <Link to="/auth"><Button size="lg" className="mt-6 rounded-full bg-background px-6 text-foreground hover:bg-background/90">계정 만들기 →</Button></Link>
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          made with 🍑 by SnapBuddy
        </footer>
      </main>
    </div>
  );
}
