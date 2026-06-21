import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

const CONTACT_EMAIL = "snappy.help@gmail.com"; // TODO: 실제 문의 이메일로 교체

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "고객지원 — Snappy" }] }),
  component: SupportPage,
});

const FAQ: { q: string; a: string }[] = [
  { q: "크레딧이 뭔가요?", a: "친구를 찍어주고 그 사진이 소장되면 +1 크레딧이 쌓여요. 모은 크레딧으로 친구가 찍어준 내 사진의 원본을 풀거나 AI 보정을 쓸 수 있어요. (충전도 가능)" },
  { q: "사진이 안 와요.", a: "보낸 사람과 친구이거나 '받기 설정'이 열려 있어야 받을 수 있어요. 받은함을 새로고침해 보고, 그래도 없으면 보낸 사람에게 확인해 주세요." },
  { q: "소장이 안 돼요.", a: "크레딧이 부족하면 소장할 수 없어요. 친구를 찍어주고 크레딧을 모으거나 충전해 주세요." },
  { q: "사진을 지우거나 신고하고 싶어요.", a: "받은 사진 상세에서 삭제·신고가 가능하고, 신고 시 받은함에서 바로 숨겨집니다." },
  { q: "회원 탈퇴는 어떻게 하나요?", a: `아래 이메일로 탈퇴를 요청해 주세요. 계정과 업로드한 사진을 삭제해 드립니다.` },
];

function SupportPage() {
  return (
    <div className="relative min-h-screen">
      <header className="pt-safe mx-auto w-full max-w-md px-[18px] py-5">
        <Link to="/"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-md px-[18px] pb-20">
        <h1 className="font-display text-2xl font-extrabold">고객지원</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          궁금한 점이나 문제가 있으면 도와드릴게요.
        </p>

        <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">문의</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-display mt-1 block text-lg font-extrabold text-foreground underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>
          <p className="mt-1 text-[11px] text-muted-foreground">평일 기준 1~2일 내 답변드려요.</p>
        </div>

        <h2 className="font-display mt-8 text-base font-extrabold">자주 묻는 질문</h2>
        <ul className="mt-3 space-y-3">
          {FAQ.map((f) => (
            <li key={f.q} className="rounded-2xl border border-white/70 bg-card/90 p-4 backdrop-blur">
              <p className="text-sm font-bold">{f.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="underline-offset-2 hover:underline">개인정보 처리방침</Link> · Snappy
        </p>
      </main>
    </div>
  );
}
