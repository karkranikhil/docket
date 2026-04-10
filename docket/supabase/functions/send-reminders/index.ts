import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { sendWhatsApp } from "../_shared/twilio.ts";

const BATCH_SIZE = 20;

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string;
  reminders_sent: number;
  stripe_payment_link_url: string | null;
  tradie_id: string;
  client_id: string | null;
}

interface Tradie {
  id: string;
  business_name: string;
  whatsapp_number: string;
}

interface Client {
  name: string;
}

function formatCurrency(amount: number): string {
  return `$${Number(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function buildReminderMessage(
  businessName: string,
  invoiceNumber: string,
  clientName: string,
  amount: number,
  days: number,
  paymentUrl: string | null,
  remindersSent: number
): string {
  const firstName = businessName.split(" ")[0];
  const amtStr = formatCurrency(amount);
  const linkSuffix = paymentUrl ? ` Pay link: ${paymentUrl}` : "";

  if (remindersSent === 0) {
    return (
      `Hi ${firstName}, just a reminder that Invoice #${invoiceNumber} to ${clientName} ` +
      `for ${amtStr} is now ${days} days overdue.${linkSuffix}`
    );
  }

  if (remindersSent === 1) {
    return (
      `Hi ${firstName}, Invoice #${invoiceNumber} (${amtStr} from ${clientName}) ` +
      `is now ${days} days overdue. Please action this.${linkSuffix}`
    );
  }

  return (
    `Final notice: Invoice #${invoiceNumber} for ${amtStr} is ${days} days overdue. ` +
    `If payment isn't received this week, you may need to pursue this through AFCA or a debt collector.${linkSuffix}`
  );
}

serve(async (_req) => {
  let processed = 0;
  let errors = 0;

  try {
    const { data: invoices, error: queryErr } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, invoice_number, total, due_date, reminders_sent, stripe_payment_link_url, tradie_id, client_id"
      )
      .eq("status", "sent")
      .lt("due_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .lt("reminders_sent", 3);

    if (queryErr) {
      console.error("Query error:", queryErr);
      return new Response(
        JSON.stringify({ error: "Failed to query overdue invoices", details: queryErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, errors: 0, message: "No overdue invoices to process" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter by tradie subscription status and reminders_enabled
    const tradieIds = [...new Set(invoices.map((i: OverdueInvoice) => i.tradie_id))];
    const { data: tradies } = await supabaseAdmin
      .from("tradies")
      .select("id, business_name, whatsapp_number, subscription_status, reminders_enabled")
      .in("id", tradieIds);

    const eligibleTradies = new Map<string, Tradie>();
    for (const t of tradies ?? []) {
      const statusOk = t.subscription_status === "active" || t.subscription_status === "trialing";
      if (statusOk && t.reminders_enabled) {
        eligibleTradies.set(t.id, {
          id: t.id,
          business_name: t.business_name,
          whatsapp_number: t.whatsapp_number,
        });
      }
    }

    const eligibleInvoices = (invoices as OverdueInvoice[]).filter((inv) =>
      eligibleTradies.has(inv.tradie_id)
    );

    // Resolve client names in one batch
    const clientIds = [
      ...new Set(eligibleInvoices.map((i) => i.client_id).filter(Boolean)),
    ] as string[];
    const clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      for (const c of clients ?? []) {
        clientMap.set(c.id, c.name);
      }
    }

    // Process in batches to respect Twilio rate limits
    for (let i = 0; i < eligibleInvoices.length; i += BATCH_SIZE) {
      const batch = eligibleInvoices.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (inv) => {
          const tradie = eligibleTradies.get(inv.tradie_id)!;
          const clientName = inv.client_id
            ? clientMap.get(inv.client_id) ?? "your client"
            : "your client";
          const days = daysOverdue(inv.due_date);

          const message = buildReminderMessage(
            tradie.business_name,
            inv.invoice_number,
            clientName,
            inv.total,
            days,
            inv.stripe_payment_link_url,
            inv.reminders_sent
          );

          const messageSid = await sendWhatsApp(tradie.whatsapp_number, message);

          // Mark as overdue if this is the third (final) reminder
          const updates: Record<string, unknown> = {
            reminders_sent: inv.reminders_sent + 1,
          };
          if (inv.reminders_sent >= 2) {
            updates.status = "overdue";
          }

          await supabaseAdmin
            .from("invoices")
            .update(updates)
            .eq("id", inv.id);

          await supabaseAdmin.from("message_log").insert({
            tradie_id: tradie.id,
            whatsapp_number: tradie.whatsapp_number,
            direction: "outbound",
            message_type: "text",
            raw_content: message,
            twilio_sid: messageSid,
            processing_status: "replied",
          });
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          processed++;
        } else {
          errors++;
          console.error("Reminder send failed:", r.reason);
        }
      }

      // Brief pause between batches to avoid rate limits
      if (i + BATCH_SIZE < eligibleInvoices.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({ processed, errors }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-reminders fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err), processed, errors }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
