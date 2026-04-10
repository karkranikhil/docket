# Docket — Cursor Agent Prompts

## How Many Agents Can Run in Parallel

**5 agents. All at once.**

Cursor (as of 2025) supports multiple Composer windows simultaneously.
Each agent owns a non-overlapping set of files so there are zero conflicts.

**Setup:**
1. Open Cursor
2. `Cmd+Shift+I` (or Composer button) — opens Agent 1
3. Repeat to open 5 Composer windows
4. Paste each prompt below into its window
5. Run all 5 simultaneously

**Order recommendation:**
- Agent 1 (Database) has no dependencies — run first or simultaneously
- Agents 2–5 use the schema from PRD.md as reference — don't need to wait for Agent 1
- If Agent 1 finishes first, Agents 2–5 can import the generated `types/database.ts`

---

## Pre-flight Checklist (do this before starting agents)

```bash
# 1. Create Next.js project
npx create-next-app@latest docket --typescript --tailwind --app --src-dir=false
cd docket

# 2. Install Shadcn
npx shadcn@latest init

# 3. Install core dependencies
npm install @supabase/supabase-js @supabase/ssr stripe

# 4. Init Supabase
npx supabase init

# 5. Create bot folder
mkdir bot

# 6. Copy PRD.md and .cursorrules into project root
# (already done if you cloned the repo)
```

---

## Agent 1 — Database & Schema

**Owns:** `supabase/migrations/`, `types/database.ts`, `supabase/seed.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`

```
You are Agent 1 — Database for the Docket project.

Read PRD.md in full before writing any code. Read .cursorrules.

Your job: build the complete Supabase database layer.

## Files to create

### supabase/migrations/001_tradies.sql
Create the tradies table exactly as specified in PRD.md section 5.1.
Include the table, all columns, RLS enable, both RLS policies, and the unique index on whatsapp_number.

### supabase/migrations/002_clients.sql
Create the clients table exactly as specified in PRD.md section 5.2.
Include RLS.

### supabase/migrations/003_invoices.sql
Create the invoices table exactly as specified in PRD.md section 5.3.
Include RLS and both indexes.

### supabase/migrations/004_message_log.sql
Create the message_log table exactly as specified in PRD.md section 5.4.
Include RLS (deny-all policy).

### supabase/migrations/005_cron.sql
Write the pg_cron schedule from PRD.md section 5.5.
Add a comment explaining it fires at 7am AEST = 9pm UTC.

### supabase/migrations/006_rollbacks.sql
Write rollback statements for all tables in reverse order.
Format: `-- Rollback: drop table if exists X cascade;`

### supabase/seed.sql
Create seed data for local development:
- 2 tradie records (Dave Wilson, Karen Wu) with realistic AU data
- 3 clients per tradie
- 5 invoices per tradie in mixed statuses (draft, sent, paid, overdue)
- 10 message_log entries

### types/database.ts
Write TypeScript types for all 4 tables matching the schema exactly.
Export: Database, Tradie, Client, Invoice, MessageLog
Include the line_items type: LineItem { description: string; quantity: number; unit_price: number; amount: number }

### lib/supabase/client.ts
Browser-side Supabase client using createBrowserClient from @supabase/ssr.
Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

### lib/supabase/server.ts
Server-side Supabase client using createServerClient from @supabase/ssr.
Reads cookies for session. For use in Server Components and Route Handlers.
Export createClient() and createAdminClient() (uses service_role key, server only).

### lib/supabase/middleware.ts
Export updateSession function that refreshes the Supabase auth session.
Used in root middleware.ts.

## Rules
- Every migration must be idempotent: use CREATE TABLE IF NOT EXISTS
- Every migration file has a header comment: -- Migration: [name] -- Created: [date]
- RLS on EVERY table. No exceptions.
- invoice_counter uses atomic UPDATE ... RETURNING, never read-then-write
- ABN is stored as string (not integer — leading zeros matter)
- All monetary values are numeric(10,2) — never float
- Timestamps are timestamptz — always timezone-aware

## Do not create
- Any Next.js page or component files
- Any Python files
- Any Stripe files

When done, output a summary of every file created and the command to run migrations:
npx supabase db push
```

---

## Agent 2 — WhatsApp Bot (Python)

**Owns:** `bot/` — all Python files

```
You are Agent 2 — WhatsApp Bot for the Docket project.

Read PRD.md in full before writing any code. Read .cursorrules.

Your job: build the complete Python FastAPI WhatsApp bot.

## Files to create

### bot/requirements.txt
fastapi==0.115.0
uvicorn==0.32.0
python-dotenv==1.0.1
supabase==2.7.4
openai==1.51.0
twilio==9.3.3
httpx==0.27.2
stripe==10.12.0
python-multipart==0.0.12
pydantic==2.9.2

### bot/main.py
FastAPI app entry point.
- Include router from webhook.py
- CORS configured for docket.com.au
- Health check endpoint GET /health
- Startup event: validate all env vars exist, log startup
- Import and validate: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER, STRIPE_SECRET_KEY

### bot/webhook.py
POST /webhook — Twilio WhatsApp webhook handler.
- Validate Twilio signature using RequestValidator (reject if invalid)
- Parse form data: Body, From, MediaUrl0, MediaContentType0, MessageSid, NumMedia
- Call message_log to record inbound message
- Look up tradie by whatsapp_number using service_role client
- Route to: onboarding (unknown number), subscription_lapsed, command handler, or invoice flow
- Return TwiML response (empty 200 to acknowledge)
- All webhook processing done asynchronously after acknowledging Twilio

### bot/parser.py
GPT-4o invoice extraction.
- parse_text_message(text: str, tradie: dict) -> ParsedInvoice
- parse_image_message(media_url: str, tradie: dict) -> ParsedInvoice
- parse_voice_message(media_url: str, tradie: dict) -> ParsedInvoice (uses Whisper first)
- ParsedInvoice dataclass: client, items, gst_included, subtotal, gst, total, confidence
- Use the exact system prompt from PRD.md section 6.3
- If confidence < 0.7: log to message_log as 'low_confidence', return special response asking tradie to be more specific
- Retry once on JSON parse failure
- Full error handling and logging

### bot/commands.py
Handle keyword commands from PRD.md section 6.4.
- detect_command(message: str) -> str | None
- handle_command(command: str, tradie: dict, message: str) -> str
- Commands: unpaid, paid, last5, remind_client, remind_all, bas, setup_payments, dashboard, help, stop
- Format all currency as AUD: $1,234.50
- Format dates as DD/MM/YYYY
- Keep responses short and punchy for WhatsApp

### bot/invoice.py
Invoice creation and management.
- create_draft_invoice(tradie: dict, parsed: ParsedInvoice) -> dict
  - Atomically increment invoice_counter: UPDATE tradies SET invoice_counter = invoice_counter + 1 WHERE id = $1 RETURNING invoice_counter
  - Format invoice_number as INV-{counter:04d}
  - INSERT into invoices with status='draft'
- format_draft_message(invoice: dict) -> str
  - Format the confirmation message exactly as shown in PRD.md section 6.2
- confirm_invoice(invoice_id: str, tradie: dict) -> dict
  - Trigger PDF generation via Supabase Edge Function
  - Create Stripe payment link (if charges_enabled)
  - UPDATE invoice status='sent'
  - Return invoice with pdf_url and payment_link_url
- update_invoice(invoice_id: str, correction_text: str, tradie: dict) -> dict
  - Re-parse correction through GPT-4o
  - UPDATE invoice line_items, subtotal, gst, total
  - Return updated invoice for re-display

### bot/payments.py
Stripe Connect operations.
- get_or_create_connect_account(tradie: dict) -> str (account_id)
- create_onboarding_link(account_id: str) -> str (URL)
- create_payment_link(invoice: dict, tradie: dict) -> str | None
  - Check charges_enabled AND payouts_enabled
  - 0.5% application_fee_amount
  - Return None if not set up (don't block invoice)
- handle_payment_succeeded(payment_intent_id: str, invoice_id: str)
  - UPDATE invoice status='paid', paid_at=now()
  - Send WhatsApp notification to tradie

### bot/notifications.py
WhatsApp message sending.
- send_message(to: str, body: str) -> str (message SID)
- send_invoice_confirmed(tradie: dict, invoice: dict)
- send_payment_received(tradie: dict, invoice: dict, amount: float)
- send_overdue_reminder(tradie: dict, invoice: dict, days_overdue: int)
- send_weekly_summary(tradie: dict)
- send_payment_setup_nudge(tradie: dict, invoice_count: int)
- Log all outbound messages to message_log

### bot/queue.py
Offline message queue.
- Simple file-based queue using JSON (for MVP)
- queue_message(phone: str, message_data: dict)
- process_queue() — called on every webhook, processes any queued messages for this phone number
- Handles: Supabase timeouts, OpenAI timeouts, Twilio delivery failures
- Max 3 retry attempts per message, then log as failed

### bot/utils.py
- validate_abn(abn: str) -> bool  — full 11-digit checksum algorithm
- format_currency(amount: float) -> str  — "$1,234.50"
- format_date(dt: datetime) -> str  — "DD/MM/YYYY"
- format_phone_display(e164: str) -> str  — "+61412345678" -> "0412 345 678"
- get_gst_quarter(dt: datetime) -> tuple[date, date]  — returns (start, end) for AU BAS quarter
- calculate_gst(subtotal: float, included: bool) -> tuple[float, float, float]  — (subtotal, gst, total)

### bot/Dockerfile
FROM python:3.12-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

### bot/railway.toml
[build]
builder = "dockerfile"
[deploy]
healthcheckPath = "/health"
restartPolicyType = "on-failure"

### bot/.env.example
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

### bot/tests/test_parser.py
Test suite for GPT-4o parser.
Create 20 test messages covering:
- Simple text (labour + parts)
- GST included vs exclusive
- Voice-style transcription (informal, colloquial)
- Trade slang (sparky, chippy, brickie)
- Photo/docket description
- Missing client name
- Ambiguous amounts
- Multi-line jobs
- Just labour, no parts
- Just parts, no labour
Assert on: confidence >= 0.7, correct subtotal, correct GST calculation.

### bot/tests/test_utils.py
Test ABN validation with known valid/invalid ABNs.
Test GST calculation for all cases.
Test currency formatting.
Test phone number formatting.

## Rules
- All DB operations use SUPABASE_SERVICE_ROLE_KEY (service_role bypasses RLS — bot needs this)
- All async — no sync DB or HTTP calls
- Validate Twilio signature on every webhook — reject anything that fails
- Never expose service_role key in any response or log
- Log every inbound message to message_log before processing
- If parse fails, always give tradie a helpful reply — never return a 500 to Twilio

## Do not create
- Any Next.js or TypeScript files
- Any Supabase migration files
- Any Supabase Edge Function files
```

---

## Agent 3 — Dashboard (Next.js)

**Owns:** `app/`, `components/`, `middleware.ts`, plus dashboard-related `lib/` files

```
You are Agent 3 — Dashboard for the Docket project.

Read PRD.md in full before writing any code. Read .cursorrules.

Your job: build the complete Next.js 15 dashboard.

## Shadcn components to install first
npx shadcn@latest add button card input label table badge
npx shadcn@latest add dialog sheet tabs select
npx shadcn@latest add dropdown-menu avatar separator

## Files to create

### middleware.ts (root)
Protect all /dashboard, /invoices, /clients, /reports, /settings, /billing routes.
Redirect unauthenticated users to /login.
Use updateSession from lib/supabase/middleware.ts.
Allow /admin routes only for emails ending in @docket.com.au.

### app/layout.tsx
Root layout. Supabase session provider. Sentry init.

### app/(auth)/login/page.tsx
Magic link sign-in form.
- Email input
- Submit calls supabase.auth.signInWithOtp()
- On submit: show "Check your email" confirmation state
- No password field. No "create account" link on this page.
- Link to /signup

### app/(auth)/signup/page.tsx
Registration form.
Fields: Business name, ABN (with live format validation), Email, WhatsApp number (AU format).
On submit:
1. Validate ABN format client-side (11 digits)
2. Create Supabase auth user
3. Insert into tradies table
4. Redirect to /dashboard with onboarding banner

### app/(dashboard)/layout.tsx
Sidebar navigation:
- Dashboard
- Invoices
- Clients
- Reports (Pro badge if not Pro)
- Settings
- Billing
Topbar with business name and avatar.
Mobile responsive — drawer on small screens.

### app/(dashboard)/dashboard/page.tsx
Server component.
Fetch: outstanding total, collected this month, invoice count this month.
Render: 3 metric cards + InvoiceList client component.
InvoiceList uses Supabase Realtime to live-update when bot marks invoice paid.

### app/(dashboard)/invoices/page.tsx
Server component with search params for filters.
Filters: status (all/draft/sent/paid/overdue), date range, client name.
Table: invoice number, client, amount, status badge, date, actions.
Pagination: 20 per page.

### app/(dashboard)/invoices/[id]/page.tsx
Invoice detail page.
Show: header (invoice number, date, status), line items table, subtotal/GST/total, payment link status.
Actions: Download PDF (signed Supabase Storage URL), Resend to client, Mark as paid (manual).
Status timeline showing created → sent → paid dates.

### app/(dashboard)/clients/page.tsx
Client list, auto-built from invoice history.
Show: name, total invoiced, outstanding, last invoice date.
Click through to client invoice history.

### app/(dashboard)/reports/page.tsx
Gate with Pro subscription check. Show upgrade prompt if Starter.
BAS summary for current quarter: GST collected, download PDF button.
Monthly revenue bar chart using Shadcn charts (recharts).

### app/(dashboard)/settings/profile/page.tsx
Form: business name, ABN (readonly after first invoice), logo upload, licence number, email, WhatsApp number.
Logo upload: Supabase Storage, show preview.
Save via server action.

### app/(dashboard)/settings/payments/page.tsx
Show current Stripe Connect status.
Three states:
1. Not set up → "Set up payments" button (calls /api/stripe/connect)
2. Pending (onboarding started) → "Complete setup" link to new AccountLink
3. Active (charges_enabled AND payouts_enabled) → green status, earnings to date

### app/(dashboard)/settings/payments/done/page.tsx
Return URL after Stripe Express onboarding.
Check account status, show success message.
"Your clients can now pay invoices online."

### app/billing/page.tsx
Stripe Customer Portal embed (redirect to Stripe portal URL).
Current plan display.
Upgrade button for Starter → Pro.

### app/(admin)/admin/page.tsx
Guard: only @docket.com.au emails.
Metrics: MRR, active subscribers, trialing, churn rate, new signups (today/week/month).

### app/(admin)/admin/tradies/page.tsx
Table of all tradie accounts.
Columns: name, business, phone, subscription status, last active, invoice count.
Actions: view messages, ban/unban, manually adjust subscription.

### app/(admin)/admin/messages/page.tsx
Full message_log table.
Filter by tradie, date range, processing status.
Show raw_content and parsed_json side by side.

### app/(admin)/admin/failures/page.tsx
Filter message_log where processing_status = 'failed' OR confidence < 0.7.
Show raw message, error details, tradie info.
Manual "mark resolved" action.

### components/invoices/InvoiceList.tsx
'use client'
Receives initial invoices as prop.
Subscribes to Supabase Realtime postgres_changes.
Upserts on change (paid status update from bot).
Table with status badges: Draft (gray), Sent (blue), Paid (green), Overdue (red).

### components/invoices/StatusBadge.tsx
Badge component with correct colour per status.

### components/dashboard/MetricCard.tsx
Card with: label (muted, small), value (large, bold), optional change % indicator.

### components/settings/LogoUpload.tsx
'use client'
Upload to Supabase Storage bucket 'logos'.
Show preview. Accept: image/png, image/jpeg, max 2MB.
Return storage path on success.

## Rules
- Server components by default. Only add 'use client' when genuinely needed for interactivity.
- All data fetching in server components using createServerClient.
- Never fetch from client components directly — pass data as props or use Realtime subscriptions.
- Currency always formatted as $1,234.50 AUD.
- Dates always DD/MM/YYYY.
- Never use inline styles — Tailwind only.
- Loading states on all async actions.
- Error boundaries on dashboard and invoice list.

## Do not create
- Any Python files
- Any Supabase migration files
- Any Stripe webhook handlers (that's Agent 4)
- Any PDF generation code (that's Agent 5)
```

---

## Agent 4 — Payments & Stripe

**Owns:** `lib/stripe/`, `app/api/stripe/`, `supabase/functions/stripe-webhook/`, `app/(dashboard)/settings/payments/`

```
You are Agent 4 — Payments & Stripe for the Docket project.

Read PRD.md in full before writing any code. Read .cursorrules.
Pay special attention to PRD.md section 7 (Stripe Connect Flow).

Your job: build everything Stripe-related.

## Files to create

### lib/stripe/client.ts
Initialize Stripe server-side client.
Export: stripe (Stripe instance).
Throw if STRIPE_SECRET_KEY is missing.

### lib/stripe/connect.ts
All Stripe Connect Express operations.

createConnectAccount(tradie: { id, email, business_name }): Promise<string>
- stripe.Account.create() with type='express', country='AU'
- MCC 1711 (plumbing/heating — generic trade)
- Store account.id in tradies table immediately
- Return account.id

createOnboardingLink(accountId: string): Promise<string>
- stripe.AccountLink.create()
- refresh_url: process.env.NEXT_PUBLIC_URL + '/settings/payments/refresh'
- return_url: process.env.NEXT_PUBLIC_URL + '/settings/payments/done'
- type: 'account_onboarding'
- Return link.url

createPaymentLink(invoice: Invoice, tradie: Tradie): Promise<string | null>
- Check tradie.stripe_charges_enabled AND tradie.stripe_payouts_enabled
- If either false: return null (send invoice without link)
- stripe.paymentLinks.create() with:
  - line_items: invoice total as single line item in AUD cents
  - application_fee_amount: Math.round(invoice.total * 100 * 0.005) — 0.5%
  - transfer_data.destination: tradie.stripe_account_id
  - metadata: { invoice_id, tradie_id }
- Store payment_link_id and payment_link_url in invoices table
- Return payment link URL

getAccountStatus(accountId: string): Promise<{ charges_enabled, payouts_enabled }>

### lib/stripe/subscriptions.ts
createCheckoutSession(tradie: Tradie, tier: 'starter' | 'pro'): Promise<string>
- Create Stripe Checkout session for subscription
- success_url, cancel_url
- Return session URL

createCustomerPortalSession(customerId: string): Promise<string>
- Return Stripe Customer Portal URL

### app/api/stripe/connect/route.ts
POST /api/stripe/connect
Auth required (Supabase session).
1. Get tradie from DB
2. If no stripe_account_id: call createConnectAccount
3. Call createOnboardingLink
4. Return { url }

GET /api/stripe/connect/status
Return tradie's stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_complete.

### app/api/stripe/connect/refresh/route.ts
GET — tradie returned to refresh URL (onboarding expired)
Generate new AccountLink and redirect.

### supabase/functions/stripe-webhook/index.ts
Deno Edge Function. Handles ALL Stripe webhook events.

Handle these events from PRD.md section 7.4:
1. account.updated
   - Get stripe_account_id from event
   - Find tradie by stripe_account_id
   - Update: stripe_charges_enabled, stripe_payouts_enabled
   - If both true: stripe_onboarding_complete = true
   - If charges just became enabled: send WhatsApp "Payments activated!" via bot API

2. payment_intent.succeeded
   - Get invoice_id from metadata
   - UPDATE invoices SET status='paid', paid_at=now() WHERE stripe_payment_intent_id = $1
   - Call bot notification API: POST /internal/notify-payment with tradie_id, invoice_id, amount

3. customer.subscription.created
   - Set subscription_status='active', subscribed_at=now()
   - Set subscription_tier based on price ID

4. customer.subscription.deleted
   - Set subscription_status='canceled'
   - WhatsApp: "Your Docket subscription has ended. Renew at docket.com.au/billing"

5. customer.subscription.updated
   - Sync subscription_status and subscription_tier

6. invoice.payment_failed
   - Set subscription_status='past_due'
   - WhatsApp warning to tradie

Verify Stripe signature on every request using STRIPE_WEBHOOK_SECRET.
Return 200 immediately, process async.

## Rules
- ALWAYS validate Stripe webhook signature — reject without processing if invalid
- ALWAYS check charges_enabled AND payouts_enabled (both required) before creating payment links
- NEVER block invoice sending if Stripe not set up — send without link, nudge tradie
- Store stripe_account_id in DB immediately when account is created (before onboarding completes)
- application_fee_amount is in cents: Math.round(total_cents * 0.005)
- AU currency only: 'aud'
- Idempotency: Stripe can send duplicate webhooks — handle gracefully

## Do not create
- Any Python bot files
- Any dashboard pages (except /settings/payments — that's yours)
- Any database migration files
- Any PDF generation code
```

---

## Agent 5 — PDF & Edge Functions

**Owns:** `supabase/functions/generate-pdf/`, `supabase/functions/send-reminders/`

```
You are Agent 5 — PDF & Edge Functions for the Docket project.

Read PRD.md in full before writing any code. Read .cursorrules.

Your job: build the Supabase Edge Functions for PDF generation and reminder dispatch.

## Files to create

### supabase/functions/generate-pdf/index.ts
Deno Edge Function using pdf-lib.
Import: import { PDFDocument, rgb, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib@1.17.1'

POST body:
{
  invoice_id: string,
  tradie_id: string
}

Fetch invoice + tradie from Supabase using service_role key.
Generate ATO-compliant PDF with pdf-lib.

ATO requirements (all mandatory):
- Supplier ABN prominently displayed
- Words "Tax Invoice" at top
- Invoice number (INV-XXXX)
- Date of issue
- Tradie business name and address (state at minimum)
- Description of each item/service
- GST amount shown as a SEPARATE line
- Total amount payable

PDF layout:
- A4 portrait (595 x 842 pts)
- Header: business name (large), "Tax Invoice" label
- Business details: ABN, licence number (if set), state
- Invoice details: number, date, due date
- Bill To: client name and address
- Line items table: description | qty | unit price | amount
- Subtotal, GST (10%), Total
- Payment section: if payment link exists, show URL + "Pay online:"
- Footer: "ABN {abn} | {business_name} | Generated by Docket"

After generating:
1. Upload PDF to Supabase Storage bucket 'invoices' at path: `{tradie_id}/{invoice_number}.pdf`
2. UPDATE invoices SET pdf_storage_path = $1 WHERE id = $2
3. Return { pdf_path, signed_url } — signed URL valid for 7 days

Handle: tradie logo in header if logo_path exists in Storage (fetch and embed as image).

### supabase/functions/send-reminders/index.ts
Deno Edge Function. Called by pg_cron daily at 9pm UTC (7am AEST).

No body required — processes all due reminders.

Query: all invoices where:
- status = 'sent'
- due_date < now() - interval '7 days'
- reminders_sent < 3
- tradie subscription_status IN ('active', 'trialing')
- tradie reminders_enabled = true

For each invoice:
1. Determine days overdue
2. Select reminder message based on reminders_sent count:
   - 0 reminders: friendly nudge (D+7 tone)
   - 1 reminder: firmer (D+14 tone)
   - 2 reminders: final notice (D+30 tone)
3. POST to Twilio to send WhatsApp message to tradie
4. UPDATE invoices SET reminders_sent = reminders_sent + 1
5. If reminders_sent was already 2: also UPDATE status='overdue'
6. Log to message_log

Reminder message templates:
D+7: "Hi {first_name}, just a reminder that Invoice #{number} to {client} for ${amount} is now {days} days overdue. Pay link: {url}"
D+14: "Hi {first_name}, Invoice #{number} (${amount} from {client}) is now {days} days overdue. Please action this: {url}"
D+30: "Final notice: Invoice #{number} for ${amount} is {days} days overdue. If payment isn't received this week, you may need to pursue this through AFCA or a debt collector. Pay link: {url}"

Process in batches of 20 to avoid Twilio rate limits.
Return { processed: number, errors: number }

### supabase/functions/_shared/supabase-admin.ts
Shared utility — create Supabase admin client (service_role) for use across functions.

### supabase/functions/_shared/twilio.ts
Shared utility — send WhatsApp message via Twilio REST API.
Use fetch() (Deno native) — no npm SDK.
sendWhatsApp(to: string, body: string): Promise<string> — returns message SID.

## PDF Design Requirements

The PDF is the main thing a tradie's client sees. It must look professional.

Layout specifics:
- Font: Helvetica (StandardFonts.Helvetica, Helvetica-Bold)
- Header background: #1B4F8A (brand blue) with white text
- "Tax Invoice" label: top right, large
- Business name: top left, bold, 20pt
- ABN: 11pt, muted
- Line items table: alternating row shading (#EBF2FA / white)
- Table headers: bold, #1B4F8A text
- Subtotal/GST/Total: right-aligned, GST line highlighted
- Total: large, bold, #1B4F8A
- Payment link box: amber (#F5A623) border, "Pay online" label
- Footer: light gray, 9pt

Currency format: $1,234.50 (always 2 decimal places)
Date format: DD/MM/YYYY

## Rules
- Validate invoice_id and tradie_id before processing
- Use service_role key — Edge Functions run server-side
- Never expose signed URLs for longer than 7 days
- Signed URL for download, public URL only if invoice status='sent' and payment link exists
- Handle missing logo gracefully (just skip the image)
- All amounts from DB are numeric(10,2) — display with toFixed(2)
- If PDF generation fails, log error and return 500 — don't update pdf_storage_path

## Do not create
- Any Next.js files
- Any Python bot files
- Any database migration files
- Any Stripe files
```

---

## After All Agents Complete

Run these in order:

```bash
# 1. Push database schema
npx supabase db push

# 2. Generate TypeScript types from actual schema
npx supabase gen types typescript --local > types/database.ts

# 3. Deploy Edge Functions
npx supabase functions deploy generate-pdf
npx supabase functions deploy stripe-webhook
npx supabase functions deploy send-reminders

# 4. Test the bot locally
cd bot
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 5. Run bot tests
python -m pytest tests/ -v

# 6. Start Next.js
cd ..
npm run dev

# 7. Expose bot for Twilio (local testing)
npx ngrok http 8000
# Copy ngrok URL to Twilio sandbox webhook setting
```

---

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| RLS blocking bot queries | Bot must use service_role key, not anon key |
| Invoice counter race condition | Use `UPDATE ... RETURNING` not `SELECT then UPDATE` |
| Twilio not delivering | Check WhatsApp sandbox join code. Check E.164 format. |
| GPT-4o returning invalid JSON | Check system prompt has "Return ONLY valid JSON" |
| Stripe webhook signature fail | Verify STRIPE_WEBHOOK_SECRET matches your endpoint |
| PDF not loading in dashboard | Check Storage bucket is set to authenticated access, use signed URL |
| Supabase session not persisting | Use `@supabase/ssr` correctly with cookies, not `@supabase/supabase-js` directly |
