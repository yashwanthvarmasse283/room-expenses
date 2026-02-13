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

const LOW_BALANCE_THRESHOLD = 500;

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
    const payload = await req.json();

    // Cron-triggered actions
    if (payload.action === "contribution_reminders") {
      return await handleContributionReminders(supabase, TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM);
    }
    if (payload.action === "bill_reminders") {
      return await handleBillReminders(supabase, TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM);
    }

    const { table, record } = payload as WebhookPayload;

    let adminId: string | null = null;
    let messageBody = "";

    switch (table) {
      case "room_expenses":
        adminId = record.admin_id;
        break;
      case "purse_transactions":
        adminId = record.admin_id;
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

    // Calculate purse balance
    const { data: purseData } = await supabase
      .from("purse_transactions")
      .select("type, amount")
      .eq("admin_id", adminId);

    const purseBalance = (purseData || []).reduce(
      (s: number, t: any) =>
        s + (t.type === "inflow" ? Number(t.amount) : -Number(t.amount)),
      0
    );

    // Build single clean message per event (no duplicates)
    if (table === "room_expenses") {
      // Only "Spent" alert - no "User added expense" intro
      messageBody = `💸 Spent: ₹${record.amount} on ${record.category}${record.description ? ` (${record.description})` : ""}. Purse Balance: ₹${purseBalance.toLocaleString()}.`;
    } else if (table === "purse_transactions") {
      if (record.type === "inflow") {
        // Only "Money Added" alert - no "User added money" intro
        const userName = record.description?.includes(" - ") ? record.description.split(" - ")[0] : "Someone";
        messageBody = `💰 Money Added: ₹${record.amount} by ${userName}. Total Balance: ₹${purseBalance.toLocaleString()}.`;
      } else {
        messageBody = `💳 Spent: ₹${record.amount} — ${record.description || "Expense"}. Purse Balance: ₹${purseBalance.toLocaleString()}.`;
      }
    }

    // Fetch members
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
      if (table === "chat_messages" && member.user_id === record.sender_id) continue;

      try {
        await sendWhatsApp(TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, member.mobile_number!, messageBody);
        results.push({ phone: member.mobile_number, sent: true });
      } catch (err) {
        results.push({ phone: member.mobile_number, error: String(err) });
      }
    }

    // Low balance alert (only once, same message loop)
    if (
      purseBalance < LOW_BALANCE_THRESHOLD &&
      (table === "room_expenses" || (table === "purse_transactions" && record.type === "outflow"))
    ) {
      const alertMsg = `⚠️ LOW BALANCE: Purse at ₹${purseBalance.toLocaleString()}. Please top up!`;
      for (const member of members) {
        try {
          await sendWhatsApp(TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, member.mobile_number!, alertMsg);
        } catch (_) { /* don't block */ }
      }
    }

    return new Response(JSON.stringify({ ok: true, results, purseBalance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsApp(sid: string, token: string, from: string, to: string, body: string) {
  const phone = to.startsWith("+") ? to : `+${to}`;
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    To: `whatsapp:${phone}`,
    From: `whatsapp:${from}`,
    Body: body,
  });
  await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

async function handleContributionReminders(supabase: any, sid: string, token: string, from: string) {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let term: number;
  if (day === 10) term = 1;
  else if (day === 20) term = 2;
  else if (day >= 28) term = 3;
  else {
    return new Response(JSON.stringify({ ok: true, message: "Not a reminder day" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: admins } = await supabase.from("profiles").select("id").not("admin_code", "is", null);
  const results: any[] = [];

  for (const admin of admins || []) {
    const { data: members } = await supabase
      .from("profiles")
      .select("user_id, name, mobile_number")
      .or(`id.eq.${admin.id},admin_id.eq.${admin.id}`)
      .not("mobile_number", "is", null);

    const { data: paid } = await supabase
      .from("monthly_contributions")
      .select("user_id")
      .eq("admin_id", admin.id)
      .eq("year", year)
      .eq("month", month)
      .eq("term", term)
      .eq("paid", true);

    const paidIds = new Set((paid || []).map((p: any) => p.user_id));
    const unpaid = (members || []).filter((m: any) => !paidIds.has(m.user_id));

    for (const member of unpaid) {
      if (member.mobile_number) {
        const msg = `📋 Reminder: Your Term ${term} contribution for ${now.toLocaleString("default", { month: "long" })} is still pending. Please update your status!`;
        try {
          await sendWhatsApp(sid, token, from, member.mobile_number, msg);
          results.push({ phone: member.mobile_number, sent: true });
        } catch (e) {
          results.push({ phone: member.mobile_number, error: String(e) });
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleBillReminders(supabase: any, sid: string, token: string, from: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = tomorrow.getDate();

  const { data: bills } = await supabase.from("recurring_bills").select("*").eq("due_day", dueDay).eq("active", true);
  const results: any[] = [];

  for (const bill of bills || []) {
    const { data: members } = await supabase
      .from("profiles")
      .select("mobile_number, name")
      .or(`id.eq.${bill.admin_id},admin_id.eq.${bill.admin_id}`)
      .not("mobile_number", "is", null);

    const { data: purseData } = await supabase
      .from("purse_transactions")
      .select("type, amount")
      .eq("admin_id", bill.admin_id);

    const balance = (purseData || []).reduce(
      (s: number, t: any) => s + (t.type === "inflow" ? Number(t.amount) : -Number(t.amount)),
      0
    );

    const msg = `🔔 Bill Reminder: "${bill.name}" (₹${Number(bill.amount).toLocaleString()}) is due tomorrow. Purse Balance: ₹${balance.toLocaleString()}.`;

    for (const member of members || []) {
      if (member.mobile_number) {
        try {
          await sendWhatsApp(sid, token, from, member.mobile_number, msg);
          results.push({ phone: member.mobile_number, sent: true });
        } catch (e) {
          results.push({ phone: member.mobile_number, error: String(e) });
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
}
