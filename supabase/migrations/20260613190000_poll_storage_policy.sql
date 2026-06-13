-- poll-images 버킷 storage RLS — 클라이언트(작성자)가 본인 소유로 업로드 허용.
-- 읽기는 서버(service role)가 서명 URL 발급하므로 클라 SELECT 정책은 불필요.
DROP POLICY IF EXISTS "poll-images insert owner" ON storage.objects;
CREATE POLICY "poll-images insert owner" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'poll-images'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "poll-images select owner" ON storage.objects;
CREATE POLICY "poll-images select owner" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'poll-images'
  AND owner = auth.uid()
);
