import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

const CONTACT_EMAIL = "snappy.help@gmail.com"; // TODO: 실제 문의 이메일로 교체

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "개인정보 처리방침 — Snappy" }] }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-extrabold">{title}</h2>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="relative min-h-screen">
      <header className="pt-safe mx-auto w-full max-w-md px-[18px] py-5">
        <Link to="/"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-md px-[18px] pb-20">
        <h1 className="font-display text-2xl font-extrabold">개인정보 처리방침</h1>
        <p className="mt-1 text-xs text-muted-foreground">시행일: 2026-06-14</p>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Snappy(이하 "서비스")는 이용자의 개인정보를 중요하게 생각하며, 아래와 같이 수집·이용·보관합니다.
        </p>

        <Section title="1. 수집하는 항목">
          <p>• 계정: 이메일, 비밀번호(암호화 저장), 이름·핸들, (소셜 로그인 시) 제공받은 프로필 정보</p>
          <p>• 사진: 이용자가 업로드한 사진(원본·워터마크본·AI 보정본)과 메시지</p>
          <p>• 이용 정보: 친구 관계, 크레딧·거래 내역, 사진 접근 로그(IP, 기기·브라우저 정보)</p>
          <p>• 결제: 충전 시 결제 처리에 필요한 정보(카드 정보는 PG사가 처리하며 서비스는 저장하지 않음)</p>
        </Section>

        <Section title="2. 이용 목적">
          <p>• 사진 전달·소장·보정·투표 등 핵심 기능 제공</p>
          <p>• 크레딧 적립·차감 및 결제 처리</p>
          <p>• 부정 이용·악용 방지 및 신고 처리</p>
          <p>• 문의 응대 및 서비스 개선</p>
        </Section>

        <Section title="3. 보관 및 처리 위탁">
          <p>• Supabase: 데이터베이스·인증·이미지 저장 (서버 리전: 대한민국 서울)</p>
          <p>• 토스페이먼츠: 결제 처리 (실결제 활성화 시)</p>
          <p>• fal.ai: AI 보정 활성화 시, 보정을 위해 해당 사진이 해외 서버에서 처리될 수 있습니다</p>
        </Section>

        <Section title="4. 보유 기간">
          <p>• 회원 탈퇴 시 개인정보 및 업로드 사진을 지체 없이 삭제합니다.</p>
          <p>• 단, 관련 법령이 정한 경우 해당 기간 동안 보관합니다.</p>
        </Section>

        <Section title="5. 이용자의 권리">
          <p>• 언제든 본인 정보의 열람·정정·삭제 및 회원 탈퇴를 요청할 수 있습니다.</p>
          <p>• 받은 사진은 직접 삭제·신고할 수 있으며, 보낸 사진은 전송 취소가 가능합니다.</p>
        </Section>

        <Section title="6. 아동의 개인정보">
          <p>• 만 14세 미만 아동은 법정대리인의 동의 없이 가입할 수 없습니다.</p>
        </Section>

        <Section title="7. 문의처">
          <p>개인정보 관련 문의: <a className="font-semibold text-foreground underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </Section>

        <Section title="8. 변경 고지">
          <p>본 방침이 변경되는 경우 서비스 내 공지 또는 본 페이지를 통해 안내합니다.</p>
        </Section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/support" className="underline-offset-2 hover:underline">고객지원</Link> · Snappy
        </p>
      </main>
    </div>
  );
}
