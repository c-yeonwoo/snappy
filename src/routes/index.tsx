import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Camera, Heart, ImagePlus, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Camera className="h-5 w-5 text-primary" />
          SnapBuddy
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost" size="sm">로그인</Button></Link>
          <Link to="/auth"><Button size="sm">시작하기</Button></Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-12 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> 친구가 찍어주는 스냅샷 마켓
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            친구가 찍어준 내 사진,<br />
            <span className="text-primary">마음에 드는 컷만</span> 가져가세요.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            여행지에서, 카페에서, 길 위에서. 친구나 동행이 찍어준 사진이 내 피드로 도착합니다.
            워터마크 미리보기를 보고 원하는 컷만 골라 구매하면, 촬영자에게도 수익이 돌아갑니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg">무료로 시작</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline">사진 보내러 가기</Button></Link>
          </div>
        </section>

        <section className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            { icon: ImagePlus, title: "찍고 보낸다", body: "친구 핸들로 검색해 사진을 업로드. 자동으로 워터마크가 입혀집니다." },
            { icon: Heart, title: "피드에서 고른다", body: "받은 사진을 미리보기로 확인하고 마음에 드는 컷만 선택." },
            { icon: Sparkles, title: "결제하면 원본", body: "구매하면 워터마크 없는 원본이 도착. 촬영자에겐 수익이 적립." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-24 rounded-3xl bg-gradient-to-br from-primary to-[oklch(var(--primary-glow))] p-10 text-primary-foreground">
          <h2 className="text-3xl font-bold">관광지에서, 사진 잘 찍는 사람이 되어보세요</h2>
          <p className="mt-3 max-w-2xl opacity-90">
            모르는 사람이 부탁한 사진도, 친구 사진도, 잘 찍어서 빠르게 판매해보세요. 판매가의 70%가 촬영자에게 돌아갑니다.
          </p>
          <Link to="/auth"><Button size="lg" variant="secondary" className="mt-6">계정 만들기</Button></Link>
        </section>
      </main>
    </div>
  );
}
