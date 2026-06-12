-- D6: 통화 단위를 USD cents → KRW(원)로 통일.
-- 프론트의 price_cents/13, earnings*13 임시 변환(hack)을 제거하기 위한 스키마 정리.
-- 출시 전(prod 데이터 없음) 단계라 기존 값 변환 없이 컬럼명만 교체한다.

-- photos.price_cents → price_won
ALTER TABLE public.photos RENAME COLUMN price_cents TO price_won;
ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_price_cents_check;
ALTER TABLE public.photos ALTER COLUMN price_won SET DEFAULT 3000;
ALTER TABLE public.photos
  ADD CONSTRAINT photos_price_won_check CHECK (price_won >= 1000 AND price_won <= 1000000);

-- purchases.amount_cents → amount_won, uploader_earning_cents → uploader_earning_won
ALTER TABLE public.purchases RENAME COLUMN amount_cents TO amount_won;
ALTER TABLE public.purchases RENAME COLUMN uploader_earning_cents TO uploader_earning_won;
