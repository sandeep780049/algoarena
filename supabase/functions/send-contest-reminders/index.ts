import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">⏰ Contest Reminder!</h1>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1d 0%, #0d0d0f 100%); border-radius: 16px; padding: 40px; border: 1px solid #27272a;">
              <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px 0;">
                Hi <strong style="color: #f59e0b;">${username}</strong>,
              </p>
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px 0;">
                Your registered contest is starting soon! Don't miss out on the opportunity to compete.
              </p>
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
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #22c55e; margin: 0; font-size: 28px;">🔴 Contest is LIVE!</h1>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1d 0%, #0d0d0f 100%); border-radius: 16px; padding: 40px; border: 1px solid #22c55e;">
              <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px 0;">
                Hi <strong style="color: #22c55e;">${username}</strong>,
              </p>
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px 0;">
                The contest you registered for has started! Jump in now and show what you've got.
              </p>
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

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const thirtyOneMinutesFromNow = new Date(now.getTime() + 31 * 60 * 1000);
    
    // Find contests starting in ~30 minutes (1 minute window)
    const { data: upcomingContests, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('is_published', true)
      .gte('start_time', thirtyMinutesFromNow.toISOString())
      .lt('start_time', thirtyOneMinutesFromNow.toISOString());

    if (contestError) {
      console.error('Error fetching contests:', contestError);
      throw contestError;
    }

    // Also find contests that just went live (within last minute)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const { data: liveContests, error: liveError } = await supabase
      .from('contests')
      .select('*')
      .eq('is_published', true)
      .gte('start_time', oneMinuteAgo.toISOString())
      .lt('start_time', now.toISOString());

    if (liveError) {
      console.error('Error fetching live contests:', liveError);
    }

    let emailsSent = 0;
    const errors: string[] = [];

    // Send reminder emails for upcoming contests
    for (const contest of upcomingContests || []) {
      const { data: registrations, error: regError } = await supabase
        .from('contest_registrations')
        .select('user_id')
        .eq('contest_id', contest.id);

      if (regError) {
        console.error(`Error fetching registrations for contest ${contest.id}:`, regError);
        continue;
      }

      for (const reg of registrations || []) {
        // Get user email and profile
        const { data: userData } = await supabase.auth.admin.getUserById(reg.user_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', reg.user_id)
          .single();

        if (userData?.user?.email) {
          const startTime = new Date(contest.start_time);
          const html = getReminderEmailHtml(
            profileData?.username || 'Participant',
            contest.name,
            formatDate(startTime),
            formatTime(startTime),
            contest.duration_minutes
          );

          try {
            await resend.emails.send({
              from: "JC AlgoArena <onboarding@resend.dev>",
              to: [userData.user.email],
              subject: `⏰ Reminder: ${contest.name} starts in 30 minutes!`,
              html,
            });
            emailsSent++;
            console.log(`Reminder sent to ${userData.user.email} for ${contest.name}`);
          } catch (emailError) {
            console.error(`Failed to send reminder to ${userData.user.email}:`, emailError);
            errors.push(`Failed to send to ${userData.user.email}`);
          }
        }
      }
    }

    // Send live notification emails
    for (const contest of liveContests || []) {
      const { data: registrations } = await supabase
        .from('contest_registrations')
        .select('user_id')
        .eq('contest_id', contest.id);

      for (const reg of registrations || []) {
        const { data: userData } = await supabase.auth.admin.getUserById(reg.user_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', reg.user_id)
          .single();

        if (userData?.user?.email) {
          const html = getLiveEmailHtml(
            profileData?.username || 'Participant',
            contest.name,
            contest.duration_minutes
          );

          try {
            await resend.emails.send({
              from: "JC AlgoArena <onboarding@resend.dev>",
              to: [userData.user.email],
              subject: `🔴 ${contest.name} is LIVE NOW!`,
              html,
            });
            emailsSent++;
            console.log(`Live notification sent to ${userData.user.email} for ${contest.name}`);
          } catch (emailError) {
            console.error(`Failed to send live notification to ${userData.user.email}:`, emailError);
            errors.push(`Failed to send to ${userData.user.email}`);
          }
        }
      }
    }

    console.log(`Contest reminders job completed. Sent ${emailsSent} emails.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        upcomingContestsProcessed: upcomingContests?.length || 0,
        liveContestsProcessed: liveContests?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-contest-reminders function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
