-- Create a table for persistent rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_time timestamptz NOT NULL,
  lockout_until timestamptz
);

-- Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service role (edge functions) to manage rate limits
-- No public access - this table is managed by edge functions using service role key

-- Create a function to check and update rate limit (atomic operation)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_count integer,
  p_window_seconds integer,
  p_lockout_seconds integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_reset_time timestamptz;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;
  
  -- Check if locked out
  IF v_record IS NOT NULL AND v_record.lockout_until IS NOT NULL AND v_now < v_record.lockout_until THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'message', 'Rate limit exceeded. Locked out until ' || v_record.lockout_until::text,
      'lockout_remaining_seconds', EXTRACT(EPOCH FROM (v_record.lockout_until - v_now))::integer
    );
  END IF;
  
  -- If no record or window expired, create/reset
  IF v_record IS NULL OR v_now > v_record.reset_time THEN
    v_reset_time := v_now + (p_window_seconds || ' seconds')::interval;
    
    INSERT INTO public.rate_limits (key, count, reset_time, lockout_until)
    VALUES (p_key, 1, v_reset_time, NULL)
    ON CONFLICT (key) DO UPDATE SET
      count = 1,
      reset_time = v_reset_time,
      lockout_until = NULL;
    
    RETURN jsonb_build_object('allowed', true, 'count', 1);
  END IF;
  
  -- Check if limit exceeded
  IF v_record.count >= p_max_count THEN
    -- Apply lockout if configured
    IF p_lockout_seconds IS NOT NULL THEN
      UPDATE public.rate_limits
      SET lockout_until = v_now + (p_lockout_seconds || ' seconds')::interval
      WHERE key = p_key;
      
      RETURN jsonb_build_object(
        'allowed', false,
        'message', 'Too many attempts. Locked out for ' || p_lockout_seconds || ' seconds.',
        'lockout_seconds', p_lockout_seconds
      );
    END IF;
    
    RETURN jsonb_build_object('allowed', false, 'message', 'Rate limit exceeded');
  END IF;
  
  -- Increment count
  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;
  
  RETURN jsonb_build_object('allowed', true, 'count', v_record.count + 1);
END;
$$;

-- Create function to clear rate limit (on successful action)
CREATE OR REPLACE FUNCTION public.clear_rate_limit(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE key = p_key;
END;
$$;

-- Create a cleanup function for expired rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE reset_time < now() - interval '1 hour'
    AND (lockout_until IS NULL OR lockout_until < now());
END;
$$;