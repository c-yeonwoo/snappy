# SnapBuddy — MVP 계획

친구 또는 길에서 찍어주는 사람이 워터마크 사진을 상대방 피드에 올리고, 주인이 마음에 드는 사진을 골라 결제하면 워터마크 없는 원본을 받고 촬영자에게 수익이 분배되는 하이브리드 마켓플레이스.

## MVP 범위 (이번에 만들 것)

1. **회원가입 / 로그인** (이메일+구글)
2. **상대방 찾기 + 사진 업로드** (워터마크 자동 적용)
3. **내 피드** — 다른 사람이 나에게 보낸 사진들을 워터마크 미리보기로 확인
4. **사진 구매** — 결제 후 워터마크 없는 원본 다운로드
5. **촬영자 수익 분배** — 판매 금액의 70%가 촬영자 잔액에 적립
6. **신고 / 삭제 요청** — 무단 촬영 사진은 피드 주인이 즉시 삭제 + 신고 가능

다음 단계로 미루는 것: 얼굴 인식 자동 매칭, 출금(payout) 자동화, 채팅, 별점·리뷰, 푸시 알림.

## 사용자 흐름

```text
[촬영자]                              [피사체(피드 주인)]
사진 찍음 → 상대 닉네임/QR 검색          
사진 N장 업로드  ──── 워터마크 자동 ────►  내 피드에 도착 (워터마크 미리보기)
                                         마음에 드는 컷 선택
                                         결제 (장당 또는 묶음가)
수익 70% 잔액 적립  ◄──── 분배 ────       워터마크 없는 원본 다운로드
                                         (또는) 무단촬영이면 신고/삭제
```

## 화면 구성

- `/` 랜딩 — 컨셉 소개, 로그인 CTA
- `/auth` 로그인/가입
- `/feed` 내 피드 — 나에게 들어온 사진 그리드(워터마크 적용본), 보낸이별 묶음
- `/photo/:id` 사진 상세 — 구매, 신고/삭제 버튼
- `/upload` 사진 업로드 — 받는 사람 검색 + 다중 사진 업로드 + 희망 가격
- `/sent` 내가 보낸 사진 — 판매 현황, 적립 잔액
- `/profile` 프로필 — 닉네임, 공유 가능한 핸들, 잔액

## 디자인 방향

캐주얼하면서도 사진이 주인공인 톤. 큰 이미지 카드, 부드러운 그림자, 흰 배경 + 포인트 컬러 1개(코랄 또는 따뜻한 옐로우). 피드는 인스타 스타일 그리드가 아닌, 카드 슬라이드형으로 "선물 받은 느낌"을 강조.

## 기술 구성

- **TanStack Start** (현재 스택 유지)
- **Lovable Cloud** — 인증(이메일+구글), Postgres, Storage(2개 버킷: `photos-original` 비공개 / `photos-watermarked` 비공개·서명URL)
- **워터마크 처리** — 업로드 시 server function에서 Canvas/sharp 대체로 순수 JS 이미지 라이브러리(`@napi-rs/canvas`는 워커 비호환 → `jimp` 또는 `photon-wasm`) 사용해 원본+워터마크본 2종 저장
- **결제** — Stripe(Lovable 빌트인, `enable_stripe_payments`). 디지털 상품, MOR(`managed_payments`) 기본
- **수익 분배** — MVP에선 내부 ledger 테이블(`earnings`)로 잔액만 관리. 실제 출금은 다음 단계

## 데이터 모델 (요약)

- `profiles` — id(uuid, auth.users 참조), handle(unique), display_name, avatar_url
- `photos` — id, uploader_id, subject_id, original_path, watermarked_path, price_cents, status('available'|'sold'|'removed'), created_at
- `purchases` — id, photo_id, buyer_id, amount_cents, uploader_earning_cents, stripe_session_id, status, created_at
- `reports` — id, photo_id, reporter_id, reason, created_at
- `earnings` — uploader_id, balance_cents (또는 purchases에서 집계)

RLS 핵심:
- `photos`: 피사체(subject) 또는 업로더만 SELECT, 업로더만 INSERT, 피사체는 status='removed'로 UPDATE 가능
- `purchases`: 구매자 본인 또는 업로더만 조회
- 워터마크 이미지는 피사체에게만 서명 URL 발급, 원본은 구매 완료 후에만 발급

## 구현 순서

1. Lovable Cloud 활성화 + 인증(이메일+구글) + profiles 테이블
2. DB 스키마 + RLS + 스토리지 버킷
3. 업로드 화면 (상대 검색 + 워터마크 처리 server function)
4. 피드 + 사진 상세 (워터마크 서명 URL)
5. Stripe 결제 활성화 + 체크아웃 + 웹훅으로 원본 발급 + earnings 적립
6. 신고/삭제 + 보낸 사진 대시보드
7. 랜딩 페이지 + 마무리 폴리시

---

이 범위로 진행할까요? 추가/제외하고 싶은 것이 있으면 알려주세요. (예: 신고 시스템 제외, 얼굴인식 포함 등)
