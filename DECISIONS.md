# Snappy — 제품/기술 결정 기록 (ADR)

> 최초 작성: 2026-06-12. 초기 방향 확정 세션.

## 한 줄 정체성
친구들이 찍어준 내 사진을, 받은 피드에서 마음에 드는 컷만 골라 워터마크를 풀고(=결제) 원본을 가져가는 캐주얼 포토 마켓. 찍어준 사람(uploader)은 판매 수익을 적립한다.

---

## 확정 결정 (2026-06-12)

| # | 항목 | 결정 | 근거 |
|---|------|------|------|
| D1 | 백엔드 스택 | **Supabase 유지** (Postgres + Auth + Storage + Edge Functions) | 이미 RLS·스토리지 정책까지 wired. 프로토타입~초기 출시에 최단 경로. 코드 주석의 "Spring/AWS" 의도는 폐기. |
| D2 | 타겟층 | **2030 MZ 친구그룹** | 한강·벚꽃·여행 '친구가 찍어준 스냅' 문화의 핵심층. 소액결제·SNS 공유 친숙. mock 데이터도 이 톤. |
| D3 | PG | **국내 - 토스페이먼츠** | 국내 타겟 필수. 간편결제·소액결제 DX 우수. (단 셀러 정산은 D5에서 별도 결정) |
| D4 | 클라이언트 | **웹 우선 (PWA)** | 현 코드 그대로 빠르게 출시. 스크린샷 차단은 워터마크로만 방어. 검증 후 네이티브 확장. |
| D10 | 유통 채널 | **단독 출시** (앱인토스 미입점) | 앱인토스 콘텐츠 심사(타인 사진 C2C 거래=초상권) 통과 불확실 + 앱인토스 정산은 개발사向이라 셀러 정산(D5) 미해결. 브랜드·독립성·자체 바이럴 동선 확보가 더 중요. |
| D11 | 사진 보안 | **강화 (전용 항목, D12에서 상세)** | 타인 사진을 다루는 서비스 = 보안·프라이버시가 핵심 신뢰요소. 원본 접근통제·워터마크·메타데이터·유출추적 강화. |

---

## 확정에서 파생된 미결 결정 (다음 논의)

### D5. 셀러 정산 모델 ★최우선
uploader가 **돈을 받는** 구조 = 통신판매중개 + 개인 셀러 정산. 토스페이먼츠는 PG일 뿐, 개인 정산은 별도 설계 필요.
- **(A) 적립금/지갑 모델 (MVP 추천)**: 판매수익을 앱 내 적립금으로 쌓고 출금은 후속. 정산 규제 부담을 뒤로 미룸.
- (B) 지급대행 연동: 토스 지급대행 등으로 실제 개인 송금. 규제·정산 부담 큼.
- 관련 법무: 통신판매업 신고, 전자금융거래, 세금(개인 판매소득).

### D6. 통화 단위 정리
현재 DB/서버는 `price_cents`(USD cents 가정), UI는 "원" → `upload`에서 `/13`, `sent`에서 `×13` 하는 임시 hack 존재.
- **결정 필요**: 스키마를 `price_won`(정수 KRW)로 통일하고 hack 제거. (마이그레이션 1건)

### D7. 수익 배분율
현재 `EARNING_RATE = 0.7` (uploader 70%). 확정 여부 / 플랫폼 수수료(30%) + PG 수수료 부담 주체.

### D8. 친구·받기설정(allow window) 백엔드화
현재 전부 `localStorage`(`friends-mock.ts`). 테이블·서버함수 미존재. 백엔드 모델 설계 필요.

### D12. 사진 보안 강화 (D11 상세)
타인 사진을 다루므로 보안이 신뢰의 핵심. 현재 상태와 강화 방향:

| 영역 | 현재 | 강화 방향 |
|------|------|-----------|
| 원본 접근통제 | `photos-original` RLS = uploader만 read. feed/photo는 mock이라 picsum 원본을 그냥 다운 | **구매(purchases) 검증 후 서버가 짧은 만료 signed URL 발급**. buyer만 원본 접근. 클라가 원본 경로 직접 모르게. |
| 미리보기 | 워터마크본 signed URL | 짧은 만료(예: 수분) signed URL, 캐시 최소화 |
| 워터마크 | 클라이언트 Canvas 타일링 (sender 핸들) | (옵션) 서버사이드 워터마킹으로 원본이 클라 안 거치게. 최소한 **구매자 식별정보 삽입(forensic)** 로 유출 추적 |
| 메타데이터 | 압축만(EXIF 유지 가능성) | **업로드 시 EXIF/GPS 등 위치·기기정보 제거** (프라이버시) |
| 초상권/동의 | subject가 remove 가능(`photos subject can remove`), `reports` 신고 있음 | 동의·삭제권 UX 강화, 신고→비공개 동선, 차단 |
| 스크린샷 | best-effort(blur·contextmenu·no-capture) | 웹은 완전차단 불가 → 워터마크가 실질 방어. 접근 **감사 로그** 추가 검토 |

### D9. feed/photo 실데이터 연결
`/feed`, `/photo/$id`는 아직 mock(`mock-feed.ts`) + localStorage 구매상태. 실제 `getMyFeed` 서버함수·`purchases` 구매 플로우와 연결 필요.

---

## 현재 구현 상태 스냅샷
- ✅ 실연결: `/upload`(searchProfiles, createPhoto + Storage 업로드), `/sent`(getMySent)
- ✅ **D6 통화 KRW 통일 완료** (2026-06-12): `price_won`/`amount_won`/`uploader_earning_won`로 rename, 프론트 cents/13·×13 hack 제거, 마이그레이션 `20260612120000_krw_currency.sql`
- ✅ **브랜드/UI 1차 점검 완료** (2026-06-12): 루트 메타 Lovable→Snappy + `lang=ko`, 공용 `<Logo>` 컴포넌트로 로고 통일(Snappy/foreground 뱃지), 히어로 헤드라인 죽은 그라데이션→라임 하이라이트, 워터마크 `@me`→업로더 핸들, 받은함 빈 상태 CTA 추가
- ✅ **D9 feed/photo/profile 실DB 연결 완료** (2026-06-12): `getMyFeed`/`getPhotoDetail`/`purchasePhoto` 연결, 받은함=`available`·앨범=`sold`, mock-feed.ts 삭제, **신고 UI** 추가(reportPhoto), 프로필 **@handle 복사** 추가
- ✅ **UI 토큰 정리 완료** (2026-06-12): `sky-*`→`brand-*` 리네임(값 동일), 블루 테마 그림자 잔재 전부 중성 다크로 교체
- ✅ **D8 친구 백엔드 완료 — 양방향 친구** (2026-06-12): `friendships`(요청/수락) + `profiles.allow_until`(받기창) 마이그레이션 `20260612130000_friends.sql`, 서버함수 `getFriends/sendFriendRequest/respondFriendRequest/removeFriend/setAllowWindow`, **createPhoto에 전송권한 서버 강제**(친구 or 받기창), friends/settings/upload/profile 전부 서버 연동, `friends-mock.ts` 삭제
- ✅ **영상 = MVP 제외** (2026-06-12): "사진·영상" 문구→"사진", 업로드 input `image/*`로 제한
- ❌ 미구현: 결제 PG(토스), 정산/출금(D5), 알림
- ✅ 검증: `tsc --noEmit` 0 에러 + `vite build` 성공 (2026-06-12). 남은 건 DB 반영 → `supabase db push`(마이그레이션 2건: KRW, friends)
- ⚠️ 잔여(소소): 용어 혼재(앨범/보관/보관함), `font-extrabold`→700 전역 override, upload 드롭존 Film 아이콘(영상 제외 후 잔재)
