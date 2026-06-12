-- Storage 버킷 생성 (private). 기존 프로젝트엔 Lovable이 만들어줬지만
-- 새 프로젝트에서 db push로 그대로 셋업되도록 명시한다. 멱등.
insert into storage.buckets (id, name, public)
values
  ('photos-original', 'photos-original', false),
  ('photos-watermarked', 'photos-watermarked', false)
on conflict (id) do nothing;
