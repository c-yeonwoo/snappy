-- 가입 안정화: 시드 크레딧 적립 실패가 가입 자체를 막지 않도록 예외 격리.
-- (AFTER INSERT 트리거에서 예외가 나면 auth.users insert 가 통째로 롤백 → "Database error saving new user")
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  suffix INT := 0;
BEGIN
  base_handle := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1), 'user'), '[^a-z0-9_]', '', 'g'));
  IF base_handle = '' OR base_handle IS NULL THEN base_handle := 'user'; END IF;
  final_handle := base_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, handle, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_handle,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_handle),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  -- 가입 시드 크레딧 (+5) — 실패해도 가입은 진행
  BEGIN
    INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, note)
    VALUES (NEW.id, 5, 'earn', 'completed', 'signup_bonus');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'signup bonus failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
