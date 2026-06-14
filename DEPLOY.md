# Snappy — 배포 가이드

> 웹: **Vercel** + Supabase / 도메인: Cloudflare / 네이티브: Capacitor(후속)
> 최종 갱신: 2026-06-13

---

## 0. 한눈에

```
GitHub(main) ──push──▶ Vercel(자동 빌드, nitro vercel preset) ──▶ snappy.app
                                   │
                                   ├─ 서버함수(createServerFn) = Vercel Serverless
                                   └─ Supabase(서울) = DB · Auth · Storage
```

- 빌드: `npm run build` → `.vercel/output` (Build Output API v3) → Vercel가 자동 인식
- 배포 타겟은 `vite.config.ts`의 `nitro.preset = "vercel"`로 고정 (env `NITRO_PRESET`로 변경 가능)

---

## 1. Vercel 연결 (최초 1회)

1. [vercel.com](https://vercel.com) → GitHub(`c-yeonwoo`)로 로그인
2. **Add New → Project** → `c-yeonwoo/snappy` import
3. 설정 (대부분 `vercel.json`에 이미 있음):
   - Framework Preset: **Other** (`vercel.json`의 `framework: null`)
   - Build Command: `npm run build`
   - Install Command: `npm install`
   - Output Directory: **비워둠** (Build Output API 자동 인식)
4. **Environment Variables** 입력 (아래 2번) → **Deploy**

이후 `main`에 push할 때마다 자동 배포, PR마다 프리뷰 배포.

---

## 2. 환경변수 (Vercel → Settings → Environment Variables)

`.env.example` 기준. **Production / Preview / Development 모두 체크**해서 추가.

| 변수 | 노출 범위 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | 🌐 번들 노출 | 공개 가능 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 🌐 번들 노출 | anon/publishable 키만 |
| `VITE_SUPABASE_PROJECT_ID` | 🌐 번들 노출 | 공개 가능 |
| `SUPABASE_URL` | 🔒 서버 | |
| `SUPABASE_PUBLISHABLE_KEY` | 🔒 서버 | |
| `SUPABASE_PROJECT_ID` | 🔒 서버 | |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒🔒 서버 전용 | **절대 VITE_ 안 됨 / 깃 금지** — RLS 우회 admin |
| `TOSS_CLIENT_KEY` | 🔒 서버 | mock 값이면 즉시충전. `test_ck_`/`live_ck_` 넣으면 결제창 |
| `TOSS_SECRET_KEY` | 🔒 서버 | `test_sk_`/`live_sk_` (승인 검증용) |
| `FAL_KEY` | 🔒 서버 | mock이면 클라 톤보정. 실키 넣으면 서버 fal.ai 호출 |
| `FAL_MODEL` | 🔒 서버 | 기본 `fal-ai/clarity-upscaler` |

## 2-b. 실결제(토스)·실 AI(fal) 켜기

**토스 실결제** (1크레딧 = 200원)
1. [토스페이먼츠](https://www.tosspayments.com) 가입 → 가맹점 심사(사업자 필요) → **API 키** 발급
2. Vercel/.env 에 `TOSS_CLIENT_KEY=test_ck_…`, `TOSS_SECRET_KEY=test_sk_…` (테스트키부터)
3. 동작: 충전 → 토스 결제창 → `/payments/success` 가 서버 `confirmTossPayment` 로 **토스 승인 API 검증** 후 크레딧 적립
4. 검증되면 `live_` 키로 교체
> mock 키일 땐 결제창 없이 즉시 충전(개발용).

**fal.ai 실 보정**
1. [fal.ai](https://fal.ai) 가입 → API Key 발급
2. `FAL_KEY=…` (선택 `FAL_MODEL`) 설정 → 자동 real 모드
3. ⚠️ **Vercel 함수 타임아웃 주의**: 업스케일이 10초+ 걸릴 수 있음. Hobby(기본 10s)면 실패 가능 →
   Pro로 `maxDuration` 늘리거나 더 빠른 모델 사용

> ⚠️ `VITE_` 접두사 변수는 **빌드 시 클라이언트 번들에 그대로 박힌다.** 공개 가능한 키(anon/publishable)만. service_role은 절대 `VITE_`로 두지 말 것.

---

## 3. 프로덕션 체크리스트 (출시 전)

### DB / 마이그레이션
- [ ] **신규 마이그레이션 2건 DB 반영 확인**
  - `20260613150000_wallet_point_payment_audit.sql` (지갑/세션/감사 테이블)
  - `20260613160000_atomic_point_purchase.sql` (원자적 구매 RPC + `purchases.session_id`)
  - 적용: `supabase db push` 또는 SQL 에디터 직접 실행 (모두 idempotent)
- [ ] 모든 테이블 RLS 활성 (마이그레이션에 포함됨)
- [ ] Storage 버킷 `photos-original` / `photos-watermarked` 존재 (private)

### 보안 / 키
- [ ] **채팅에 노출됐던 anon/publishable 키 로테이션** (Supabase → Settings → API → 키 재발급)
- [ ] service_role 키는 노출된 적 없음 — 그대로 유지, Vercel 서버 env에만
- [ ] `.env`가 git에 없는지 재확인 (`git ls-files | grep .env` → `.env.example`만)

### Auth (OAuth/이메일)
- [ ] Supabase → Authentication → **URL Configuration**
  - Site URL: `https://snappy.app` (실제 도메인)
  - Redirect URLs 허용목록에 `https://snappy.app/**` 추가 (OAuth `redirectTo`·이메일 인증이 `window.location.origin` 사용)
- [ ] Google OAuth: Google Cloud Console에 redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` 등록 + Supabase Provider에 client id/secret
- [ ] Kakao OAuth: 동일 (Supabase Provider 활성 + Kakao 앱 redirect)
- [ ] 네이버는 현재 stub (toast) — 정식 연동은 별도

### 인프라
- [ ] **Supabase 리전 = 서울(ap-northeast-2).** 현재 `ap-southeast-2`(시드니)라 한국 유저 지연 큼 → **출시 전 서울로 이전** (아래 3-b)
- [ ] (선택) Vercel 함수 리전 서울(icn1) — Project Settings → Functions Region (플랜에 따라 제한)
- [ ] 커스텀 도메인 연결: Vercel → Settings → Domains → `snappy.app` 추가 → Cloudflare DNS에 CNAME

## 3-b. Supabase 서울 이전 (출시 전, in-place 변경 불가 → 새 프로젝트)

마이그레이션 10개가 스키마+버킷+RPC를 멱등 재생성하므로 새 프로젝트로 깨끗이 옮길 수 있다.

```bash
# 1. 대시보드에서 새 프로젝트 생성 — Region: Northeast Asia (Seoul) / ap-northeast-2
# 2. CLI 링크 (config.toml project_id 갱신)
npx supabase login
npx supabase link --project-ref <새-project-ref>
# 3. 전체 마이그레이션 적용 (스키마 + 스토리지 버킷 + 구매 RPC)
npx supabase db push
```

그 다음:
- [ ] env(로컬 `.env` + Vercel) 전부 새 프로젝트 값으로 — URL/anon/project_id/**service_role**
- [ ] Auth Providers(Google/Kakao) 새 프로젝트에 재설정 — redirect `https://<새-ref>.supabase.co/auth/v1/callback`
- [ ] Auth URL Config: Site URL + Redirect 허용목록 = 실도메인
- [ ] 구 프로젝트(`rjsourjbjhybgrpetwgq`)는 이전 확인 후 삭제/일시정지

> `auth.users`는 이전 안 됨(새 auth). 출시 전이라 테스트 계정 재가입으로 충분.

### 앱 기본
- [x] PWA manifest + 아이콘 (`/manifest.webmanifest`, favicon/apple-touch/192/512)
- [x] 메타 태그 / `lang=ko` / theme-color

---

## 4. 도메인

- 등록: **Cloudflare Registrar**(원가) 또는 `.kr`이면 가비아
- 후보: `snappy.app` / `getsnappy.app` / `snappy.kr` (`.com`은 선점 가능성↑)
- DNS는 **Cloudflare**로 두고 Vercel 도메인 연결 (CNAME `cname.vercel-dns.com`)

---

## 5. 네이티브 앱 (후속 단계, Capacitor)

웹 검증 후 진입. 코드 재사용 + PRD D12(스크린샷 차단)는 네이티브에서만 가능하므로 Capacitor가 최적.

### 접근
TanStack Start는 SSR이라 정적 번들이 아님 → Capacitor `server.url`을 **배포된 Vercel 사이트로 지정**(라이브 앱의 네이티브 셸) + 네이티브 플러그인 추가.

### 셋업 스케치
```bash
npm i @capacitor/core @capacitor/cli
npx cap init Snappy app.snappy.mobile --web-dir=dist/client
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
```
`capacitor.config.ts`:
```ts
server: { url: "https://snappy.app", cleartext: false }
```

### 필요한 네이티브 플러그인
| 목적 | 플러그인 | PRD |
|---|---|---|
| 스크린샷 차단 | Android `FLAG_SECURE` / iOS 캡처 감지 (privacy-screen 류) | D12 |
| 푸시 알림 | `@capacitor/push-notifications` + FCM/APNs | 알림 |
| 딥링크 | `@capacitor/app` (OAuth 리다이렉트 처리) | — |

### 스토어
- Apple Developer Program $99/년 · Google Play 등록비 $25(1회)
- "단순 웹뷰"는 심사 거절 가능 → 네이티브 플러그인(스크린샷 차단·푸시)으로 네이티브 가치 확보

---

## 6. 로컬에서 배포 빌드 확인

```bash
npm run build            # .vercel/output 생성 (vercel preset)
npx vite preview         # 로컬 미리보기
```
다른 타겟 테스트: `NITRO_PRESET=cloudflare-module npm run build`
