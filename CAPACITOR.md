# Snappy — 네이티브 앱 (Capacitor)

> TanStack Start는 SSR이라 정적 번들이 아님 → 네이티브는 **배포된 Snappy 웹을 `server.url`로 로드하는 래퍼** + 네이티브 플러그인.
> 장점: 웹 업데이트가 **앱 재심사 없이 즉시 반영**됨. 네이티브 플러그인 추가/변경 때만 재배포.

설정: `capacitor.config.ts` (appId `app.snappy.mobile`, server.url = 배포 도메인)

---

## 1. 최초 셋업 (각자 로컬, SDK 필요)

전제: **iOS = Xcode + CocoaPods(`sudo gem install cocoapods`)**, **Android = Android Studio + SDK**

```bash
# 1) 배포 도메인 지정 (capacitor.config.ts 의 SERVER_URL 직접 수정하거나 env)
export CAP_SERVER_URL="https://<배포도메인>"

# 2) 네이티브 프로젝트 생성 (ios/ , android/ 폴더 생성됨 → 커밋)
npx cap add ios
npx cap add android

# 3) 셸+설정 동기화
npx cap sync
```

## 2. 실행

```bash
npm run cap:ios       # cap sync + Xcode 열기 → ▶︎ 시뮬레이터/기기
npm run cap:android   # cap sync + Android Studio 열기 → ▶︎
```

웹만 바뀌면 재빌드 불필요(원격 로드). `capacitor.config.ts`/플러그인 바뀌면 `npx cap sync`.

---

## 3. ⚠️ 꼭 알아야 할 함정

### OAuth가 웹뷰에서 막힘 (중요)
구글은 **임베디드 웹뷰 내 OAuth를 차단**함 (카카오도 유사). 네이티브 웹뷰에서 구글/카카오 로그인 버튼이 실패할 수 있음.
- **이메일 로그인은 정상**
- 해결(스토어 전 필수): OAuth를 **시스템 브라우저**로 띄우고 딥링크로 복귀 — `@capacitor/browser` + 커스텀 스킴/Universal Link, 또는 네이티브 OAuth 플러그인
- 베타 초기엔 이메일 우선, 소셜은 시스템 브라우저 방식으로 보강

### 스토어 "단순 웹뷰" 거절 리스크
네이티브 가치가 없으면 심사 거절 가능 → 아래 플러그인으로 가치 확보:

| 목적 | 플러그인 | 비고 |
|---|---|---|
| 스크린샷 차단 (PRD D12) | Android `FLAG_SECURE` / iOS 캡처감지 (privacy-screen 류) | 네이티브 핵심 가치 |
| 푸시 알림 | `@capacitor/push-notifications` + FCM/APNs | 리텐션 |
| 딥링크/OAuth 복귀 | `@capacitor/app` + `@capacitor/browser` | 소셜로그인 |

### 스토어 등록
- Apple Developer $99/년 · Google Play $25(1회)
- appId(`app.snappy.mobile`)는 등록 후 변경 어려움 → 제출 전 확정

---

## 4. 권장 순서
1. server.url = 배포 도메인 확인 → `cap add` → 시뮬레이터로 **이메일 로그인·핵심 플로우** 동작 확인
2. **스크린샷 차단** 플러그인 (네이티브 가치 + D12)
3. **소셜 로그인** 시스템 브라우저 방식 보강
4. **푸시** (FCM/APNs)
5. 스토어 제출
