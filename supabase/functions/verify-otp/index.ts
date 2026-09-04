import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Allowed origins for CORS - restrict to production and preview domains
const ALLOWED_ORIGINS = [
  "https://algoarenaquest.onrender.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface VerifyOTPRequest {
  email: string;
  otp: string;
}

// Rate limit constants for brute force protection
const RATE_LIMIT_MAX = 5; // Max 5 attempts per email
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60; // 10 minutes
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minute lockout after max attempts

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: VerifyOTPRequest = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate OTP format (6 digits only)
    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check persistent rate limit using database function
    const rateLimitKey = `verify_otp:${email.toLowerCase()}`;
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_key: rateLimitKey,
        p_max_count: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_lockout_seconds: LOCKOUT_DURATION_SECONDS
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue without rate limiting if there's a DB error
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit/lockout for:", email);
      const message = rateLimitResult.message || "Too many failed attempts. Please try again later.";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("email_verification_otps")
      .select("*")
      .eq("email", email)
      .eq("otp_code", otp)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP verification failed:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid or expired OTP. Please request a new one." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("email_verification_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Clean up old OTPs for this email
    await supabase
      .from("email_verification_otps")
      .delete()
      .eq("email", email)
      .neq("id", otpRecord.id);

    // Clear rate limit on successful verification
    const { error: clearError } = await supabase.rpc('clear_rate_limit', {
      p_key: rateLimitKey
    });
    
    if (clearError) {
      console.log("Failed to clear rate limit (non-critical):", clearError);
    }
    
    console.log("OTP verified successfully for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Email verified successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);