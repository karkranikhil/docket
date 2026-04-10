import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  tradie_id: string;
  invoice_number: string;
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  due_date: string | null;
  stripe_payment_link_url: string | null;
  client_id: string | null;
  created_at: string;
}

interface Tradie {
  id: string;
  business_name: string;
  abn: string;
  licence_number: string | null;
  state: string | null;
  logo_path: string | null;
}

interface Client {
  name: string;
  address: string | null;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BRAND_BLUE = rgb(27 / 255, 79 / 255, 138 / 255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.45, 0.45, 0.45);
const ROW_SHADE = rgb(235 / 255, 242 / 255, 250 / 255);
const AMBER = rgb(245 / 255, 166 / 255, 35 / 255);
const LIGHT_GRAY = rgb(0.7, 0.7, 0.7);

function formatCurrency(amount: number): string {
  return `$${Number(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatABN(abn: string): string {
  const digits = abn.replace(/\s/g, "");
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { invoice_id: string; tradie_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { invoice_id, tradie_id } = body;
  if (!invoice_id || !tradie_id) {
    return new Response(
      JSON.stringify({ error: "invoice_id and tradie_id are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("tradie_id", tradie_id)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found", details: invErr?.message }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: tradie, error: tradieErr } = await supabaseAdmin
      .from("tradies")
      .select("id, business_name, abn, licence_number, state, logo_path")
      .eq("id", tradie_id)
      .single();

    if (tradieErr || !tradie) {
      return new Response(
        JSON.stringify({ error: "Tradie not found", details: tradieErr?.message }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let client: Client | null = null;
    if (invoice.client_id) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name, address")
        .eq("id", invoice.client_id)
        .single();
      client = c;
    }

    let logoBytes: Uint8Array | null = null;
    let logoIsJpeg = false;
    if (tradie.logo_path) {
      try {
        const { data: logoData } = await supabaseAdmin.storage
          .from("logos")
          .download(tradie.logo_path);
        if (logoData) {
          logoBytes = new Uint8Array(await logoData.arrayBuffer());
          logoIsJpeg = tradie.logo_path.toLowerCase().endsWith(".jpg") ||
            tradie.logo_path.toLowerCase().endsWith(".jpeg");
        }
      } catch {
        // Missing logo is non-fatal — skip
      }
    }

    const inv = invoice as Invoice;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Header background ---
    const headerHeight = 80;
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: BRAND_BLUE,
    });

    // Logo (if available)
    let logoEndX = MARGIN;
    if (logoBytes) {
      try {
        const logoImage = logoIsJpeg
          ? await pdfDoc.embedJpg(logoBytes)
          : await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scaleToFit(50, 50);
        page.drawImage(logoImage, {
          x: MARGIN,
          y: PAGE_HEIGHT - headerHeight + (headerHeight - logoDims.height) / 2,
          width: logoDims.width,
          height: logoDims.height,
        });
        logoEndX = MARGIN + logoDims.width + 12;
      } catch {
        // Corrupt image — skip
      }
    }

    // Business name in header
    page.drawText(tradie.business_name, {
      x: logoEndX,
      y: PAGE_HEIGHT - 45,
      size: 20,
      font: helveticaBold,
      color: WHITE,
    });

    // "Tax Invoice" label top-right
    const taxInvoiceText = "Tax Invoice";
    const tiWidth = helveticaBold.widthOfTextAtSize(taxInvoiceText, 18);
    page.drawText(taxInvoiceText, {
      x: PAGE_WIDTH - MARGIN - tiWidth,
      y: PAGE_HEIGHT - 45,
      size: 18,
      font: helveticaBold,
      color: WHITE,
    });

    // --- Business details ---
    let y = PAGE_HEIGHT - headerHeight - 30;

    page.drawText(`ABN ${formatABN(tradie.abn)}`, {
      x: MARGIN,
      y,
      size: 11,
      font: helvetica,
      color: MUTED,
    });
    y -= 16;

    if (tradie.licence_number) {
      page.drawText(`Licence: ${tradie.licence_number}`, {
        x: MARGIN,
        y,
        size: 10,
        font: helvetica,
        color: MUTED,
      });
      y -= 14;
    }

    if (tradie.state) {
      page.drawText(tradie.state, {
        x: MARGIN,
        y,
        size: 10,
        font: helvetica,
        color: MUTED,
      });
      y -= 14;
    }

    // --- Invoice details (right column) ---
    const detailsX = PAGE_WIDTH - MARGIN - 180;
    let detY = PAGE_HEIGHT - headerHeight - 30;

    const drawDetail = (label: string, value: string) => {
      page.drawText(label, {
        x: detailsX,
        y: detY,
        size: 10,
        font: helveticaBold,
        color: BLACK,
      });
      page.drawText(value, {
        x: detailsX + 80,
        y: detY,
        size: 10,
        font: helvetica,
        color: BLACK,
      });
      detY -= 16;
    };

    drawDetail("Invoice #", inv.invoice_number);
    drawDetail("Date", formatDate(inv.created_at));
    drawDetail("Due Date", formatDate(inv.due_date));

    // --- Bill To ---
    y = Math.min(y, detY) - 20;
    page.drawText("Bill To", {
      x: MARGIN,
      y,
      size: 12,
      font: helveticaBold,
      color: BRAND_BLUE,
    });
    y -= 18;

    if (client) {
      page.drawText(client.name, {
        x: MARGIN,
        y,
        size: 11,
        font: helvetica,
        color: BLACK,
      });
      y -= 15;
      if (client.address) {
        page.drawText(client.address, {
          x: MARGIN,
          y,
          size: 10,
          font: helvetica,
          color: MUTED,
        });
        y -= 15;
      }
    } else {
      page.drawText("—", {
        x: MARGIN,
        y,
        size: 11,
        font: helvetica,
        color: MUTED,
      });
      y -= 15;
    }

    // --- Line items table ---
    y -= 20;
    const colX = {
      desc: MARGIN,
      qty: MARGIN + CONTENT_WIDTH * 0.5,
      price: MARGIN + CONTENT_WIDTH * 0.65,
      amount: MARGIN + CONTENT_WIDTH * 0.82,
    };
    const tableRight = MARGIN + CONTENT_WIDTH;
    const rowHeight = 22;

    // Table header
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: rgb(0.95, 0.95, 0.97),
    });

    const headers = ["Description", "Qty", "Unit Price", "Amount"];
    const headerXs = [colX.desc, colX.qty, colX.price, colX.amount];
    headers.forEach((h, i) => {
      page.drawText(h, {
        x: headerXs[i],
        y: y,
        size: 10,
        font: helveticaBold,
        color: BRAND_BLUE,
      });
    });
    y -= rowHeight;

    // Table rows
    const lineItems: LineItem[] = typeof inv.line_items === "string"
      ? JSON.parse(inv.line_items)
      : inv.line_items;

    lineItems.forEach((item, idx) => {
      if (idx % 2 === 0) {
        page.drawRectangle({
          x: MARGIN,
          y: y - 4,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: ROW_SHADE,
        });
      }

      const desc =
        item.description.length > 40
          ? item.description.substring(0, 37) + "..."
          : item.description;

      page.drawText(desc, {
        x: colX.desc,
        y,
        size: 10,
        font: helvetica,
        color: BLACK,
      });
      page.drawText(String(item.quantity), {
        x: colX.qty,
        y,
        size: 10,
        font: helvetica,
        color: BLACK,
      });
      page.drawText(formatCurrency(item.unit_price), {
        x: colX.price,
        y,
        size: 10,
        font: helvetica,
        color: BLACK,
      });

      const amtStr = formatCurrency(item.amount);
      const amtWidth = helvetica.widthOfTextAtSize(amtStr, 10);
      page.drawText(amtStr, {
        x: tableRight - amtWidth,
        y,
        size: 10,
        font: helvetica,
        color: BLACK,
      });

      y -= rowHeight;
    });

    // Separator
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: tableRight, y },
      thickness: 0.5,
      color: LIGHT_GRAY,
    });

    // --- Totals ---
    y -= 20;
    const totalsX = colX.price;

    const drawTotal = (
      label: string,
      value: string,
      bold = false,
      highlight = false
    ) => {
      if (highlight) {
        page.drawRectangle({
          x: totalsX - 6,
          y: y - 4,
          width: tableRight - totalsX + 6,
          height: 20,
          color: ROW_SHADE,
        });
      }

      page.drawText(label, {
        x: totalsX,
        y,
        size: bold ? 12 : 10,
        font: bold ? helveticaBold : helvetica,
        color: bold ? BRAND_BLUE : BLACK,
      });

      const font = bold ? helveticaBold : helvetica;
      const size = bold ? 12 : 10;
      const valWidth = font.widthOfTextAtSize(value, size);
      page.drawText(value, {
        x: tableRight - valWidth,
        y,
        size,
        font,
        color: bold ? BRAND_BLUE : BLACK,
      });

      y -= bold ? 24 : 18;
    };

    drawTotal("Subtotal", formatCurrency(inv.subtotal));
    drawTotal("GST (10%)", formatCurrency(inv.gst), false, true);
    drawTotal("Total AUD", formatCurrency(inv.total), true);

    // --- Payment link box ---
    if (inv.stripe_payment_link_url) {
      y -= 10;
      const boxHeight = 40;
      const boxY = y - boxHeight + 14;

      page.drawRectangle({
        x: MARGIN,
        y: boxY,
        width: CONTENT_WIDTH,
        height: boxHeight,
        borderColor: AMBER,
        borderWidth: 1.5,
        color: rgb(1, 0.98, 0.94),
      });

      page.drawText("Pay online:", {
        x: MARGIN + 12,
        y: boxY + boxHeight - 16,
        size: 10,
        font: helveticaBold,
        color: BLACK,
      });
      page.drawText(inv.stripe_payment_link_url, {
        x: MARGIN + 12,
        y: boxY + boxHeight - 30,
        size: 9,
        font: helvetica,
        color: BRAND_BLUE,
      });

      y = boxY - 10;
    }

    // --- Footer ---
    const footerY = 30;
    const footerText = `ABN ${formatABN(tradie.abn)}  |  ${tradie.business_name}  |  Generated by Docket`;
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: footerY,
      size: 9,
      font: helvetica,
      color: LIGHT_GRAY,
    });

    // --- Serialize PDF ---
    const pdfBytes = await pdfDoc.save();
    const storagePath = `${tradie_id}/${inv.invoice_number}.pdf`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("invoices")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
      return new Response(
        JSON.stringify({ error: "PDF upload failed", details: uploadErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("invoices")
      .update({ pdf_storage_path: storagePath })
      .eq("id", invoice_id);

    if (updateErr) {
      console.error("Invoice update failed:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice record", details: updateErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    return new Response(
      JSON.stringify({
        pdf_path: storagePath,
        signed_url: signedUrlData?.signedUrl ?? null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("PDF generation failed:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
