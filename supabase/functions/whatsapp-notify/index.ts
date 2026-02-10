import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: Record<string, any>;
  schema: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const payload: WebhookPayload = await req.json();
    const { table, record } = payload;

    // Determine admin_id based on table
    let adminId: string | null = null;
    let messageBody = "";

    switch (table) {
      case "room_expenses":
        adminId = record.admin_id;
        messageBody = `💸 New expense added: ₹${record.amount} for "${record.description || record.category}" (${record.category}) on ${record.date}`;
        break;
      case "purse_transactions":
        adminId = record.admin_id;
        messageBody =
          record.type === "inflow"
            ? `💰 ₹${record.amount} added to purse: "${record.description || "Money Added"}"`
            : `💳 ₹${record.amount} spent from purse: "${record.description || "Expense"}"`;
        break;
      case "notices":
        adminId = record.admin_id;
        messageBody = `📢 New Notice: "${record.title}"\n${record.content}`;
        break;
      case "chat_messages":
        adminId = record.admin_id;
        messageBody = `💬 ${record.sender_name}: ${record.content}`;
        break;
      default:
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!adminId) {
      return new Response(JSON.stringify({ error: "No admin_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all room members (admin + approved users)
    const { data: members } = await supabase
      .from("profiles")
      .select("mobile_number, name, user_id")
      .or(`id.eq.${adminId},admin_id.eq.${adminId}`)
      .not("mobile_number", "is", null);

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No members with phone numbers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const member of members) {
      // Skip sending to the person who triggered the action (for chat)
      if (table === "chat_messages" && member.user_id === record.sender_id) {
        continue;
      }

      const phone = member.mobile_number!.startsWith("+")
        ? member.mobile_number!
        : `+${member.mobile_number}`;

      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
        const body = new URLSearchParams({
          To: `whatsapp:${phone}`,
          From: `whatsapp:${TWILIO_FROM}`,
          Body: messageBody,
        });

        const resp = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization:
              "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        const result = await resp.json();
        results.push({ phone, status: resp.status, sid: result.sid });
      } catch (err) {
        results.push({ phone, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
