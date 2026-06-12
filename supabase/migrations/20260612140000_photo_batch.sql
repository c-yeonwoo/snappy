-- 묶음 전송: 한 번에 보낸 사진들을 batch_id 로 묶는다 (없으면 단건=null).
ALTER TABLE public.photos ADD COLUMN batch_id UUID;
CREATE INDEX photos_batch_idx ON public.photos(subject_id, batch_id);
