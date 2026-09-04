-- Create table for storing email verification OTPs
CREATE TABLE public.email_verification_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_email_verification_email ON public.email_verification_otps (email);
CREATE INDEX idx_email_verification_expires ON public.email_verification_otps (expires_at);

-- Enable RLS
ALTER TABLE public.email_verification_otps ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated and anonymous users (for signup flow)
CREATE POLICY "Anyone can insert OTP records" 
ON public.email_verification_otps 
FOR INSERT 
WITH CHECK (true);

-- Allow reading OTP records (needed for verification)
CREATE POLICY "Anyone can read OTP records" 
ON public.email_verification_otps 
FOR SELECT 
USING (true);

-- Allow updates (for marking as verified)
CREATE POLICY "Anyone can update OTP records" 
ON public.email_verification_otps 
FOR UPDATE 
USING (true);

-- Allow deleting expired OTPs
CREATE POLICY "Anyone can delete OTP records" 
ON public.email_verification_otps 
FOR DELETE 
USING (true);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification_otps 
  WHERE expires_at < now() OR verified = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;