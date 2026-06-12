-- 신고 상태를 삭제(removed)와 분리
ALTER TYPE public.photo_status ADD VALUE IF NOT EXISTS 'reported';
