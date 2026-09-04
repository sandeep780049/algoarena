-- Fix cleanup_expired_otps function to set search_path
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.email_verification_otps 
  WHERE expires_at < now() OR verified = true;
END;
$function$;