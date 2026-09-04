import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Allowed origins for CORS - restrict to production and preview domains
const ALLOWED_ORIGINS = [
  "https://algoarena-9nwy.onrender.com",
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

interface ContestEmailRequest {
  type: "registration" | "reminder" | "live";
  email: string;
  username: string;
  contestName: string;
  contestDate: string;
  contestTime: string;
  contestDuration: number;
  contestId?: string;
}

// Helper function to validate authenticated user
async function validateAuth(req: Request, corsHeaders: Record<string, string>): Promise<{ user: { id: string; email?: string } } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.error("Auth validation failed:", error);
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid token' }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  return { user: { id: user.id, email: user.email } };
}

const getRegistrationEmailHtml = (username: string, contestName: string, contestDate: string, contestTime: string, duration: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #22c55e; margin: 0; font-size: 28px;">🎉 Registration Confirmed!</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1d 0%, #0d0d0f 100%); border-radius: 16px; padding: 40px; border: 1px solid #27272a;">
              <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px 0;">
                Hi <strong style="color: #22c55e;">${username}</strong>,
              </p>
              
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px 0;">
                You've successfully registered for the upcoming contest. Get ready to showcase your skills!
              </p>
              
              <!-- Contest Card -->
              <table role="presentation" style="width: 100%; background: #09090b; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 22px;">${contestName}</h2>
                    
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">📅 Date:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${contestDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">⏰ Time:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${contestTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">⏱️ Duration:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${duration} minutes</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
                We'll send you a reminder before the contest starts. Make sure to be online and ready!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding-top: 30px;">
              <p style="color: #52525b; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} JC AlgoArena. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getReminderEmailHtml = (username: string, contestName: string, contestDate: string, contestTime: string, duration: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">⏰ Contest Reminder!</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1d 0%, #0d0d0f 100%); border-radius: 16px; padding: 40px; border: 1px solid #27272a;">
              <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px 0;">
                Hi <strong style="color: #f59e0b;">${username}</strong>,
              </p>
              
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px 0;">
                Your registered contest is starting soon! Don't miss out on the opportunity to compete.
              </p>
              
              <!-- Contest Card -->
              <table role="presentation" style="width: 100%; background: #09090b; border-radius: 12px; border: 1px solid #f59e0b; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 22px;">${contestName}</h2>
                    
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">📅 Date:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${contestDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">⏰ Time:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${contestTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #71717a; font-size: 14px;">⏱️ Duration:</span>
                          <span style="color: #e4e4e7; font-size: 14px; margin-left: 8px;">${duration} minutes</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #f59e0b; font-size: 16px; font-weight: bold; margin: 0 0 20px 0; text-align: center;">
                🚀 Starting in 30 minutes!
              </p>
              
              <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
                Make sure you're logged in and ready before the contest begins. Good luck!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding-top: 30px;">
              <p style="color: #52525b; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} JC AlgoArena. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getLiveEmailHtml = (username: string, contestName: string, duration: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #22c55e; margin: 0; font-size: 28px;">🔴 Contest is LIVE!</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1d 0%, #0d0d0f 100%); border-radius: 16px; padding: 40px; border: 1px solid #22c55e;">
              <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px 0;">
                Hi <strong style="color: #22c55e;">${username}</strong>,
              </p>
              
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px 0;">
                The contest you registered for has started! Jump in now and show what you've got.
              </p>
              
              <!-- Contest Card -->
              <table role="presentation" style="width: 100%; background: #09090b; border-radius: 12px; border: 1px solid #22c55e; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0 0 15px 0; font-size: 22px;">${contestName}</h2>
                    <p style="color: #22c55e; font-size: 18px; margin: 0; font-weight: bold;">
                      ⏱️ ${duration} minutes remaining
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #22c55e; font-size: 16px; font-weight: bold; margin: 0 0 20px 0; text-align: center;">
                🏃 Hurry! The clock is ticking!
              </p>
              
              <p style="color: #a1a1aa; font-size: 14px; margin: 0; text-align: center;">
                Log in to AlgoArena and start the quiz now. Good luck! 🍀
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding-top: 30px;">
              <p style="color: #52525b; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} JC AlgoArena. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user is authenticated
    const authResult = await validateAuth(req, corsHeaders);
    if (authResult instanceof Response) {
      return authResult; // Return the error response
    }
    
    const { type, email, username, contestName, contestDate, contestTime, contestDuration }: ContestEmailRequest = await req.json();

    if (!email || !type || !contestName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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

    let subject = "";
    let html = "";

    switch (type) {
      case "registration":
        subject = `✅ Registration Confirmed: ${contestName}`;
        html = getRegistrationEmailHtml(username, contestName, contestDate, contestTime, contestDuration);
        break;
      case "reminder":
        subject = `⏰ Reminder: ${contestName} starts in 30 minutes!`;
        html = getReminderEmailHtml(username, contestName, contestDate, contestTime, contestDuration);
        break;
      case "live":
        subject = `🔴 ${contestName} is LIVE NOW!`;
        html = getLiveEmailHtml(username, contestName, contestDuration);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid email type" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    const emailResponse = await resend.emails.send({
      from: "JC AlgoArena <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    });

    console.log(`Contest email (${type}) sent to ${email}:`, emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-contest-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
