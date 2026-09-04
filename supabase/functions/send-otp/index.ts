import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const Resend = (await import("https://esm.sh/resend@2.0.0")).Resend;

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

interface SendOTPRequest {
  email: string;
  username: string;
}

function generateOTP(): string {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Rate limit constants
const RATE_LIMIT_MAX = 3; // Max 3 requests per email
const RATE_LIMIT_WINDOW_SECONDS = 5 * 60; // 5 minutes

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, username }: SendOTPRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check persistent rate limit using database function
    const rateLimitKey = `send_otp:${email.toLowerCase()}`;
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_key: rateLimitKey,
        p_max_count: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_lockout_seconds: null // No lockout for OTP requests, just rate limit
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue without rate limiting if there's a DB error
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit exceeded for:", email);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again in a few minutes." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing OTPs for this email
    await supabase
      .from("email_verification_otps")
      .delete()
      .eq("email", email);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("email_verification_otps")
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send OTP email
    const emailResponse = await resend.emails.send({
      from: "JC AlgoArena <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your email - JC AlgoArena",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #2a2a4a;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
                <span style="color: #3b82f6;">JC</span> AlgoArena
              </h1>
            </div>
            
            <h2 style="color: #ffffff; text-align: center; margin-bottom: 16px; font-size: 20px;">
              Welcome${username ? `, ${username}` : ''}! 🎉
            </h2>
            
            <p style="color: #a0aec0; text-align: center; margin-bottom: 32px; font-size: 16px;">
              Your verification code is:
            </p>
            
            <div style="background: #0f172a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; border: 2px dashed #3b82f6;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; font-family: monospace;">
                ${otpCode}
              </span>
            </div>
            
            <p style="color: #a0aec0; text-align: center; font-size: 14px; margin-bottom: 8px;">
              This code will expire in <strong style="color: #ffffff;">10 minutes</strong>.
            </p>
            
            <p style="color: #6b7280; text-align: center; font-size: 12px; margin-top: 32px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("OTP email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);