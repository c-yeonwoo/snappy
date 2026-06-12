-- 보낸 사람이 자신의 히스토리에서 숨길 수 있는 플래그
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS uploader_hidden boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS photos_uploader_hidden_idx ON public.photos(uploader_id, uploader_hidden);
