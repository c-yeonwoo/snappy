# Snappy — Backend Backlog (Spring Kotlin + AWS)

이 문서는 현재 프론트엔드에서 mock으로만 동작하거나, 웹에서는 완전히 구현이
불가능해 네이티브/서버 작업이 반드시 필요한 항목을 모은 백로그입니다.
프론트 UI는 이 명세에 맞춰 이미 자리잡혀 있으니, 서버는 같은 계약을 따르면
화면 변경 없이 붙일 수 있습니다.

## 1. 친구 (Friend) 시스템

현재 프론트는 `localStorage` 기반 mock(`src/lib/friends-mock.ts`)으로 동작.

- 도메인
  - `friendship(user_id, friend_id, status, created_at)` — status: `pending` / `accepted` / `blocked`
  - 단방향 요청 → 수락 시 양방향 친구 관계
- API
  - `POST /friends/request {targetUserId}` — 친구 요청
  - `POST /friends/{requestId}/accept` / `reject`
  - `DELETE /friends/{friendId}` — 친구 끊기
  - `GET /friends` — 내 친구 목록 (페이지네이션)
  - `GET /friends/pending` — 받은 요청
- 알림(추후): 친구 요청 푸시

## 2. AirDrop-식 임시 받기 창 (Allow Window)

현재 프론트는 `localStorage`에 `expiresAt` 저장만.

- 도메인: `receive_window(user_id, expires_at)`
- API
  - `POST /receive-window {minutes}` — 기본 10분, 최대 60분
  - `DELETE /receive-window`
  - `GET /receive-window` — 남은 시간
- 검증: 업로드 시 서버에서 (a) 친구인지 (b) 받기 창이 열려 있는지 확인.
  둘 다 아니면 `403 NOT_ALLOWED`.
- 보안: 다른 유저의 창 상태는 노출 X — `POST /photos`에서 401/403만 반환.

## 3. 사진 / 영상 처리 파이프라인

현재 워터마크는 클라이언트(Canvas)에서 처리 → 신뢰할 수 없음.

- S3 버킷 분리
  - `snappy-original` (private, 서명 URL만 발급, 결제 후에만)
  - `snappy-watermarked` (private, 피사체에게만 서명 URL)
- 업로드 흐름
  1. 클라이언트가 `POST /uploads/presign` 호출 → presigned PUT URL 받기
  2. 원본을 S3에 PUT
  3. `POST /photos` 호출 → 메타데이터 등록
  4. SQS 메시지 발행 → 워커가 ImageMagick/ffmpeg로 워터마크 생성
     - 텍스트: `Snappy · @senderHandle` 을 전체에 dense tile (현재 캔버스
       구현 참고: `src/lib/watermark.ts`)
     - 영상: ffmpeg `drawtext` 필터, 1프레임씩 워터마크
  5. 결과를 `snappy-watermarked`에 업로드 → 상태 `ready`
- 안전 다운로드: 결제 완료된 사용자에게만 단발성 서명 URL(15분 만료)

## 4. 결제 / 정산

- 결제: Stripe Checkout (digital goods, MOR). 웹훅 `checkout.session.completed`로
  `purchase` 레코드 생성 + 원본 다운로드 권한 부여
- 정산: `earnings(uploader_id, balance_cents)` 70% 적립
- 출금(추후): Stripe Connect Express

## 5. 캡처/녹화 방지

웹에서는 100% 차단이 불가능. 네이티브 앱에서만 안정적으로 가능.

- Android: `Window.setFlags(FLAG_SECURE)` — 스크린샷/녹화 시 검은 화면
- iOS: `UIScreen.capturedDidChangeNotification`으로 녹화 감지 후 콘텐츠 숨김
  (스크린샷은 사후 감지만 가능 → 알림 + 사진에 사용자 ID 워터마크)
- 서버에서는 모든 다운로드 URL에 (요청자 ID, IP, UA, 만료) 기록 → 유출 시 추적

## 6. 신고 / 모더레이션

- `report(photo_id, reporter_id, reason, status)` — 신고 즉시 피드 hide,
  운영자 큐로 이동
- 자동 모더레이션: AWS Rekognition `DetectModerationLabels` (성인/폭력)
- 반복 위반 업로더 차단

## 7. 푸시 알림

- FCM (Android) / APNs (iOS)
- 이벤트: 새 사진 도착, 친구 요청, 결제 완료, 신고 처리 결과

## 8. 검색 / 핸들

- `profiles.handle` unique, 대소문자 구분 X
- 핸들 검색은 Postgres trigram(`pg_trgm`) 또는 OpenSearch

## 9. 인증

- 이메일 + Google OAuth (Spring Security + Google ID token 검증)
- JWT (access 15분, refresh 30일 회전)
- 디바이스 세션 관리

## 10. 운영

- Observability: CloudWatch + OpenTelemetry
- 미디어 비용: CloudFront로 서명 URL 캐싱 금지 옵션
- DB: RDS Postgres (Multi-AZ), 미디어 메타만 저장. 바이너리는 S3.