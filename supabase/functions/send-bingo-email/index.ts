import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SMTP2GO_API_KEY = Deno.env.get("SMTP2GO_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_EMAIL = "channelmarketing@nextiva.com";
const FROM_EMAIL = "reporting@zing-work.com"; // Must be verified in SMTP2GO

const TASKS = [
  "Revive one closed lost opportunity",
  "Close a deal over $500 MRR",
  "Send XBert email campaign through NexConnect",
  "Quote 5 new deals with XBert attached",
  "Close a deal with XBert included",
  "Complete XBert Sales Certification course",
  "Generate $2,500+ MRR Pipeline 3 months in a row",
  "Close a deal over $1,000 MRR",
  "Hold a demo meeting with a prospect 30 days after the event",
  "Generate $2,500+ MRR Pipeline 2 months in a row",
  "Quote an NCC deal over $1,000 MRR",
  "Post photo of you and your channel manager to LinkedIn",
  "FREE SPACE",
  "Complete NCC Sales Certification course",
  "Schedule a partner or customer testimonial video session",
  "Post about a Nextiva event on LinkedIn with photo/video",
  "Add Nextiva to your email signature or website",
  "Schedule a planning meeting with Channel Marketing",
  "Send a verticalized email campaign for XBert",
  "Post about XBert on LinkedIn",
  "Quote a new deal three days in a row",
  "Create 10 demo bots for prospects",
  "Co-brand a XBert asset in NexConnect with your logo",
  "Launch an XBert webinar with your prospects and customers",
  "Quote an XBert deal over $1,000 MRR",
];

serve(async (req) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { playerEmail, playerName, winType, winningCells } = await req.json();

    if (!playerEmail || !playerName || !winType || !winningCells) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers }
      );
    }

    // Build proof file links — use the same sanitized email as the upload path
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const proofLinks: string[] = [];
    const safeEmail = playerEmail.replace("@", "_at_").replace(/\./g, "_");

    for (const cellIndex of winningCells) {
      if (cellIndex === 12) continue; // Skip free space

      const { data: files } = await supabase.storage
        .from("proof-files")
        .list(`${safeEmail}/${cellIndex}`);

      if (files && files.length > 0) {
        for (const file of files) {
          // Use signed URLs (7 day expiry) so links work regardless of bucket visibility
          const { data: urlData } = await supabase.storage
            .from("proof-files")
            .createSignedUrl(`${safeEmail}/${cellIndex}/${file.name}`, 60 * 60 * 24 * 7);
          if (urlData?.signedUrl) {
            proofLinks.push(`• Cell ${cellIndex + 1} (${TASKS[cellIndex]}): ${urlData.signedUrl}`);
          }
        }
      }
    }

    // Build the email body
    const completedTasks = winningCells
      .filter((i: number) => i !== 12)
      .map((i: number) => `• ${TASKS[i]}`)
      .join("\n");

    const emailBody = `
Hi Channel Marketing,

${playerName} (${playerEmail}) has achieved a BINGO in the XBERT Sales Challenge!

Win type: ${winType}
Date/Time: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}

Winning tasks:
${completedTasks}

Proof files for verification:
${proofLinks.length > 0 ? proofLinks.join("\n") : "(No files uploaded)"}

—
Nextiva XBERT Bingo Game (automated)
    `.trim();

    // Send via SMTP2GO API
    const smtpRes = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: SMTP2GO_API_KEY,
        to: [NOTIFY_EMAIL],
        sender: FROM_EMAIL,
        subject: `XBERT Bingo: ${playerName} got a ${winType}!`,
        text_body: emailBody,
      }),
    });

    const smtpData = await smtpRes.json();

    if (!smtpRes.ok) {
      console.error("SMTP2GO error:", smtpData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: smtpData }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Bingo email sent" }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers }
    );
  }
});
