
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage RLS for photos-watermarked: path format = <subject_id>/<photo_id>.jpg
CREATE POLICY "watermarked select subject or uploader" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos-watermarked'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.photos p
      WHERE p.watermarked_path = storage.objects.name AND p.uploader_id = auth.uid()
    )
  )
);

CREATE POLICY "watermarked insert uploader" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos-watermarked'
  AND owner = auth.uid()
);

-- Storage RLS for photos-original: only uploader can write; reads via server (service role)
CREATE POLICY "original insert uploader" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos-original'
  AND owner = auth.uid()
);

CREATE POLICY "original select uploader" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos-original'
  AND owner = auth.uid()
);
