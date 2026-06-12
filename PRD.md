# Snappy — 제품 명세 (PRD)

> 친구가 찍어준 내 사진을, 받은 피드에서 마음에 드는 컷만 골라 소장하는 캐주얼 포토 마켓.
> 최종 갱신: 2026-06-13

---

## 1. 한 줄 정체성

**친구가 찍어준 내 사진을 워터마크 미리보기로 받고, 마음에 드는 컷만 결제해 원본을 가져가는 캐주얼 포토 마켓.**
찍어준 사람(uploader)은 사진이 소장될 때마다 판매 수익을 포인트로 적립한다.

- **찍어주고** → 워터마크 자동 적용해 상대 피드로 전송
- **골라 받고** → 받은 컷 중 마음에 드는 것만 선택
- **소장하고** → 결제(포인트)로 워터마크 풀고 원본 획득
- **적립** → 촬영자에게 판매 수익의 70% 포인트 적립

---

## 2. 타겟 유저

**2030 MZ 친구그룹.**
한강·벚꽃·여행 등 "친구가 찍어준 스냅" 문화의 핵심층. 소액결제·SNS 공유에 친숙하고, 사진을 주고받는 행위 자체가 일상.

핵심 차별점: **찍어주는 행위에 보상(포인트)이 생긴다.** 다른 사진 공유 앱과 다른 유일한 이유.

---

## 3. 핵심 플로우

```text
[촬영자 / uploader]                      [피사체 / subject = 피드 주인]
사진 찍음 → @handle 검색
N장 업로드  ──── 워터마크 자동 적용 ────►  받은함에 도착 (워터마크 미리보기)
                                          마음에 드는 컷만 선택
                                          결제 (장당, 포인트)
수익 70% 포인트 적립  ◄──── 분배 ────      원본 언락 + 다운로드
                                          (또는) 무단촬영이면 신고 / 반려
```

전송 권한: 업로드 시 서버가 **(a) 친구이거나 (b) 받기 창이 열려 있는지** 검증. 둘 다 아니면 거부.

---

## 4. 화면 구성

| 라우트 | 화면 | 상태 |
|---|---|---|
| `/` | 스플래시 — 컨셉 소개, 시작하기 CTA | ✅ |
| `/auth` | 로그인 / 가입 — 이메일 + 카카오·네이버·구글 OAuth | ✅ (소셜 일부 stub) |
| `/feed` | 받은함 — 나에게 온 워터마크 컷 그리드, 보낸이별 묶음 | ✅ |
| `/batch/$id` | 받은 묶음 상세 — 컷 선택 + 소장(결제) | ✅ |
| `/photo/$id` | 사진 상세 — 소장, 신고/반려 | ✅ |
| `/upload` | 업로드 — @handle 검색 + 다중 업로드 + 희망 가격 | ✅ |
| `/sent` | 보낸 사진 — 묶음별 현황, 소장 통계, 히스토리 | ✅ |
| `/sent/$id` | 보낸 묶음 상세 — 가격 수정, 상태별 컷, 전송 취소 | ✅ |
| `/profile` | 프로필 — 포인트 잔액, 충전/출금, @handle 복사 | ✅ (충전·출금 stub) |
| `/friends` | 친구 — 요청/수락/끊기 | ✅ |
| `/settings` | 설정 — 받기 창(allow window) | ✅ |
| `/notifications` | 알림 — 새 사진·친구요청 | ✅ (배지 로컬 추적) |

---

## 5. 사진 상태 모델

`photo_status` enum: `available` | `sold` | `removed` | `reported`

| 상태 | 의미 | 보낸 사람 화면 |
|---|---|---|
| `available` | 전송됨, 상대 액션 대기 | 대기중 |
| `sold` | 상대가 소장(결제) 완료 | 소장됨 |
| `removed` | 상대가 반려(삭제) | 반려됨 |
| `reported` | 상대가 신고 | 신고됨 |

- 보낸 리스트(묶음 카드): **대기중 | 완료** 두 가지만 (`available` 하나라도 있으면 대기중)
- 묶음 상세: 4가지 상태 모두 배지로 노출
- 모든 컷이 최종 상태(`available` 0개)면 "기록 삭제"(uploader_hidden) 가능

---

## 6. 확정된 정책 / 결정

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| D1 | 백엔드 스택 | **Supabase** (Postgres + Auth + Storage + Edge Functions) | RLS·스토리지까지 wired. 최단 출시 경로. (과거 Spring/AWS 의도 폐기) |
| D2 | 타겟 | **2030 MZ 친구그룹** | 스냅 문화 핵심층 |
| D3 | PG | **토스페이먼츠** | 국내 타겟, 소액결제 DX 우수 |
| D4 | 클라이언트 | **웹 우선 PWA** | 빠른 출시. 검증 후 네이티브 확장 |
| D6 | 통화 단위 | **KRW 정수(`price_won`)** | cents hack 제거 완료 |
| D7 | 수익 배분 | **uploader 70%** (`EARNING_RATE = 0.7`) | 플랫폼 30% (PG 수수료 부담 주체 미확정) |
| D10 | 유통 채널 | **단독 출시** (앱인토스 미입점) | 초상권 C2C 심사 불확실 + 셀러 정산 미해결 |
| D11 | 사진 보안 | **강화 방침** | 타인 사진 = 신뢰가 핵심 |
| — | 포인트 | **1P = 1원** | 충전·결제·적립 단위 통일 |
| — | 영상 | **MVP 제외** | 사진만. 업로드 `image/*` 제한 |

---

## 7. 데이터 모델 (요약)

- `profiles` — id(uuid, auth.users), handle(unique), display_name, avatar_url, allow_until
- `photos` — id, uploader_id, subject_id, batch_id, original_path, watermarked_path, price_won, status, uploader_hidden, created_at
- `purchases` — id, photo_id, buyer_id, amount_won, uploader_earning_won, status, created_at
- `friendships` — user_id, friend_id, status(`pending`|`accepted`|`blocked`), created_at
- `reports` — id, photo_id, reporter_id, reason, created_at

**RLS 핵심**
- `photos`: subject 또는 uploader만 SELECT, uploader만 INSERT, subject는 status 변경(removed/reported) 가능
- `purchases`: 구매자 본인 또는 uploader만 조회
- 워터마크본은 subject에게만 signed URL, **원본은 구매 완료 후에만** 발급
- 보낸 사진 썸네일은 uploader에게 원본(`photos-original`) 노출

**스토리지 버킷**
- `photos-original` (private) — 결제 후 short-lived signed URL
- `photos-watermarked` (private) — subject에게만 signed URL

---

## 8. 디자인 시스템

| 항목 | 값 |
|---|---|
| 컬러 | near-black `#0a0a0a` / off-white `#fafafa` / lime `#d9f99d`·`#a3e635` |
| 디스플레이/로고 폰트 | **Clash Display** (Fontshare) |
| 본문 폰트 (KR+EN) | **Pretendard Variable** (jsdelivr) |
| 로고 | 검정 카메라 뱃지 + "Snappy" 워드마크 |
| 앱 아이콘 | 라임 배경 + 검정 "S" 레터마크 |
| 레이아웃 | 모바일 전용 프레임(max-w-480), 하단 탭바, 좌우 패딩 18px |
| 톤 | 캐주얼·사진 중심. 큰 이미지 카드, 부드러운 그림자, 라임 포인트 1색 |

---

## 9. 구현 상태

### ✅ 완료
- 인증: 이메일 가입/로그인 + OAuth 버튼(카카오·구글 연결, 네이버 stub)
- 업로드: `searchProfiles` + `createPhoto` + Storage 업로드, **전송 권한 서버 강제**(친구/받기창)
- 받은함/사진상세/프로필: 실 DB 연결 (`getMyFeed`/`getPhotoDetail`/`purchasePhoto`)
- 보낸 사진: `getMySent`/`getSentBatch`, 묶음 그룹화, 소장 통계, 히스토리, 가격 수정, 전송 취소, 기록 삭제
- 친구: 양방향(`friendships` + `allow_until`), 요청/수락/끊기/받기창
- 신고/반려 UI (`reportPhoto`), @handle 복사
- 통화 KRW 통일, 포인트(1P=1원) 표기
- 브랜드/UI: Clash Display + Pretendard, 스플래시 실사 사진, 카피 개편

### ❌ 미구현 (우선순위 순)
1. **결제 PG(토스페이먼츠) 연동** — 현재 `purchasePhoto`가 즉시 completed 처리하는 MVP stub
2. **셀러 정산 / 출금 (D5)** — 적립금 지갑 모델 추천. 통신판매중개·전자금융·세금 검토 필요
3. **사진 보안 강화 (D12)** — EXIF/GPS 제거, forensic 워터마크(구매자 식별), 접근 감사 로그, 서버사이드 워터마킹
4. **알림** — 새 사진·친구요청·결제·신고 결과 (현재 로컬 배지 추적만)

---

## 10. 미결 과제 상세

### D5. 셀러 정산 모델 ★최우선
uploader가 돈을 받는 구조 = 통신판매중개 + 개인 셀러 정산.
- **(A) 적립금/지갑 모델 (MVP 추천)** — 수익을 앱 내 포인트로 적립, 출금은 후속. 규제 부담 뒤로 미룸
- (B) 지급대행 연동 — 실제 개인 송금. 규제·정산 부담 큼

### D12. 사진 보안 강화
| 영역 | 현재 | 강화 방향 |
|---|---|---|
| 원본 접근통제 | RLS = uploader/buyer | 구매 검증 후 짧은 만료 signed URL, 클라가 원본 경로 모르게 |
| 워터마크 | 클라이언트 Canvas | 서버사이드 + 구매자 식별정보(forensic) 삽입 |
| 메타데이터 | 압축만 | 업로드 시 EXIF/GPS 제거 |
| 스크린샷 | best-effort(blur·no-capture) | 웹 완전차단 불가 → 워터마크가 실질 방어 + 접근 감사 로그 |

### 잔여(소소)
- 용어 혼재 정리 (앨범/보관/보관함)
- 결제 PG 붙이면 `purchases.status` 실제 흐름 연결
