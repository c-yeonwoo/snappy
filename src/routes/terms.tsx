import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

const CONTACT_EMAIL = "snappy.help@gmail.com"; // TODO: 실제 문의 이메일로 교체

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "이용약관 — Snappy" }] }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-extrabold">{title}</h2>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="relative min-h-screen">
      <header className="pt-safe mx-auto w-full max-w-md px-[18px] py-5">
        <Link to="/"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-md px-[18px] pb-20">
        <h1 className="font-display text-2xl font-extrabold">이용약관</h1>
        <p className="mt-1 text-xs text-muted-foreground">시행일: 2026-06-26</p>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          본 약관은 Snappy(이하 "서비스") 이용에 관한 조건과 절차를 규정합니다. 서비스에 가입하거나
          이용함으로써 본 약관에 동의한 것으로 봅니다.
        </p>

        <Section title="1. 서비스 내용">
          <p>• Snappy는 친구가 찍어준 사진을 원본으로 주고받고, 친구 투표로 고르고, AI로 보정·소장하는 사진 서비스입니다.</p>
          <p>• 서비스는 사전 고지 후 기능을 추가·변경·중단할 수 있습니다.</p>
        </Section>

        <Section title="2. 이용자 콘텐츠(UGC)와 무관용 원칙">
          <p>이용자는 자신이 업로드·전송하는 사진과 메시지에 대한 책임을 집니다. 다음 콘텐츠·행위는 <strong className="text-foreground">엄격히 금지</strong>되며, 무관용(zero-tolerance) 원칙으로 처리됩니다:</p>
          <p>• 음란물·성착취물, 폭력·혐오·차별, 불법 촬영물 등 부적절한 콘텐츠</p>
          <p>• 타인의 초상권·저작권·사생활을 침해하는 콘텐츠</p>
          <p>• 괴롭힘·스토킹·협박 등 다른 이용자를 학대하는 행위</p>
          <p>• 본인 동의 없는 타인의 사진 무단 게시·유포</p>
        </Section>

        <Section title="3. 신고·차단·조치">
          <p>• 모든 사진은 받은 사진 상세에서 <strong className="text-foreground">신고</strong>할 수 있으며, 신고 즉시 해당 사진은 받은함/피드에서 숨겨집니다.</p>
          <p>• 부적절한 이용자는 <strong className="text-foreground">차단</strong>할 수 있으며, 차단 시 그 사용자가 보낸 콘텐츠가 더 이상 표시되지 않습니다.</p>
          <p>• 서비스는 신고를 검토하여 <strong className="text-foreground">24시간 이내</strong> 부적절한 콘텐츠를 삭제하고, 위반 이용자의 이용을 제한·차단할 수 있습니다.</p>
        </Section>

        <Section title="4. 계정과 탈퇴">
          <p>• 이용자는 정확한 정보로 계정을 등록·유지해야 합니다.</p>
          <p>• 이용자는 앱 내 [나 → 설정 → 계정 삭제]에서 언제든 계정과 업로드한 콘텐츠를 삭제(탈퇴)할 수 있습니다.</p>
        </Section>

        <Section title="5. 크레딧·결제">
          <p>• 크레딧은 서비스 내 기능 이용을 위한 수단이며, 충전·차감 내역은 앱에서 확인할 수 있습니다.</p>
          <p>• 결제·환불은 관련 법령 및 앱 마켓 정책을 따릅니다.</p>
        </Section>

        <Section title="6. 책임의 한계">
          <p>• 이용자 간 주고받은 콘텐츠로 발생한 분쟁의 1차적 책임은 해당 이용자에게 있습니다.</p>
          <p>• 서비스는 관련 법령이 허용하는 범위에서 책임을 부담합니다.</p>
        </Section>

        <Section title="7. 문의">
          <p>약관 관련 문의: <a className="font-semibold text-foreground underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </Section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="underline-offset-2 hover:underline">개인정보처리방침</Link> ·{" "}
          <Link to="/support" className="underline-offset-2 hover:underline">고객지원</Link> · Snappy
        </p>
      </main>
    </div>
  );
}
