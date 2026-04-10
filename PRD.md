# Docket — Product Requirements Document v2.0

> **"Send a WhatsApp. Get paid."**
> WhatsApp-to-Invoice SaaS for Australian Tradies

---

## Table of Contents

1. [Overview](#1-overview)
2. [Target User](#2-target-user)
3. [System Architecture](#3-system-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [WhatsApp Bot Specification](#6-whatsapp-bot-specification)
7. [Stripe Connect Flow](#7-stripe-connect-flow)
8. [Web Dashboard Specification](#8-web-dashboard-specification)
9. [MVP Scope](#9-mvp-scope)
10. [API & Integration References](#10-api--integration-references)
11. [Environment Variables](#11-environment-variables)
12. [File Structure](#12-file-structure)

---

## 1. Overview

**Product:** Docket  
**Domain:** docket.com.au  
**Type:** B2C SaaS — WhatsApp-native invoicing for sole-trader tradies  
**Market:** Australia (AU/NZ expansion in v2)  

### The Problem

2.1 million Australian sole-trader tradies:
- Are owed an average of $8,400 in outstanding invoices at any time (MYOB 2023)
- Hate admin. Do it badly. Do it late. Often don't do it at all.
- Already live in WhatsApp — 40+ opens per day

### The Solution

A tradie messages a single WhatsApp number describing what they did on a job. Docket returns a draft invoice for confirmation. On approval: ATO-compliant PDF generated, Stripe payment link attached, invoice sent to client — all from WhatsApp. No app. No login. No behaviour change.

### Revenue Model

| Tier | Price | Limit | Feature |
|------|-------|-------|---------|
| Free Trial | $0 / 30 days | Unlimited | Full access |
| Starter | $19/month | 30 invoices | Bot + dashboard |
| Pro | $49/month | Unlimited | + Stripe payments + BAS export |
| Payment processing | 0.5% per payment | Per transaction | On top of Stripe's 1.7% + $0.30 AUD |

---

## 2. Target User

**Primary ICP:** Australian sole-trader tradie  
- Plumber, electrician, builder, painter, tiler, HVAC, landscaper, cleaner  
- Age 28–58, suburban AU  
- Comfortable with WhatsApp, not with accounting software  
- Annual revenue: $80k–$400k AUD  
- Currently invoicing: paper dockets, SMS, Excel, or nothing  

---

## 3. System Architecture

Two loosely coupled systems sharing a single Supabase Postgres database.

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (single source of truth)        │
│  Postgres DB  |  Auth  |  Realtime  |  Storage  |  pg_cron │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────────┐   ┌──────────▼──────────────┐
│   System 1 — Bot   │   │  System 2 — Dashboard   │
│  Python FastAPI    │   │  Next.js 15 App Router  │
│  Railway           │   │  Vercel                 │
│  service_role key  │   │  anon key + JWT (RLS)   │
│  (bypasses RLS)    │   │  (enforced per tradie)  │
└────────────────────┘   └─────────────────────────┘
         │                          │
         │ Twilio WhatsApp API      │ Supabase Auth (magic link)
         │ OpenAI GPT-4o + Whisper  │ Stripe Connect Express
         │ pdf-lib (Edge Function)  │ Supabase Realtime
         └──────────────────────────┘
```

### Key Design Rules

1. **Bot uses `service_role` key** — needs to look up any tradie by phone number, bypasses RLS
2. **Dashboard uses `anon` key + JWT** — RLS enforced, tradie sees only their own rows
3. **`service_role` key NEVER touches the browser or Next.js client** — Railway env vars only
4. **Every mutation goes through Supabase** — bot and dashboard never talk directly to each other

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 App Router | Server components, RSC-first |
| UI | Shadcn/UI + Tailwind | `components.json` configured |
| Database | Supabase Postgres | RLS on every table |
| Auth | Supabase Auth | Magic link (email OTP). No passwords. |
| Realtime | Supabase Realtime | `postgres_changes` for live dashboard |
| File Storage | Supabase Storage | PDFs + logos. Signed URLs. |
| Cron | pg_cron (inside Supabase) | Overdue reminders scheduled in Postgres |
| Edge Functions | Supabase Edge Functions (Deno) | PDF generation, Stripe webhook handler |
| Bot runtime | Python FastAPI | Railway deployment |
| WhatsApp API | Twilio (sandbox → 360dialog prod) | |
| AI parsing | OpenAI GPT-4o | Invoice extraction from text/photo/voice |
| Transcription | OpenAI Whisper | Voice note to text |
| PDF | pdf-lib in Edge Function | ATO-compliant output |
| Payments | Stripe Connect Express | Marketplace model, 0.5% platform fee |
| Monitoring | Sentry | Both systems |
| Bot hosting | Railway | |
| Dashboard hosting | Vercel | |

---

## 5. Database Schema

All migrations in `supabase/migrations/`. Run with `npx supabase db push`.

### 5.1 tradies

```sql
create table tradies (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade,
  whatsapp_number           text unique not null,       -- E.164 e.g. +61412345678
  business_name             text not null,
  abn                       text not null,              -- 11 digits, validated
  email                     text not null,
  logo_path                 text,                       -- Supabase Storage path
  licence_number            text,                       -- QBCC/VBA/state-specific
  state                     text,                       -- NSW|VIC|QLD|WA|SA|TAS|ACT|NT
  gst_registered            boolean default true,
  invoice_counter           integer default 0,          -- NEVER resets. ATO requirement.

  -- Stripe
  stripe_customer_id        text,                       -- cus_xxx (Docket subscription)
  stripe_account_id         text,                       -- acct_xxx (tradie's Connect account)
  stripe_charges_enabled    boolean default false,
  stripe_payouts_enabled    boolean default false,
  stripe_onboarding_complete boolean default false,

  -- Subscription
  subscription_status       text default 'trialing',   -- trialing|active|past_due|canceled
  subscription_tier         text default 'starter',    -- starter|pro
  trial_ends_at             timestamptz,
  subscribed_at             timestamptz,

  -- Preferences
  weekly_summary_enabled    boolean default true,
  reminders_enabled         boolean default true,

  created_at                timestamptz default now(),
  onboarded_at              timestamptz                 -- set after first successful invoice
);

alter table tradies enable row level security;

create policy "tradie reads own record"
  on tradies for select using (user_id = auth.uid());

create policy "tradie updates own record"
  on tradies for update using (user_id = auth.uid());

-- Bot lookup index (most critical query)
create unique index tradies_whatsapp_number on tradies(whatsapp_number);
```

### 5.2 clients

```sql
create table clients (
  id              uuid primary key default gen_random_uuid(),
  tradie_id       uuid not null references tradies(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  address         text,
  total_invoiced  numeric(10,2) default 0,
  created_at      timestamptz default now()
);

alter table clients enable row level security;

create policy "tradie sees own clients"
  on clients for all
  using (tradie_id = (select id from tradies where user_id = auth.uid()));
```

### 5.3 invoices

```sql
create table invoices (
  id                        uuid primary key default gen_random_uuid(),
  tradie_id                 uuid not null references tradies(id) on delete cascade,
  client_id                 uuid references clients(id),
  invoice_number            text not null,              -- INV-0001. Sequential, no gaps.
  line_items                jsonb not null,
  -- line_items format: [{"description": string, "quantity": number, "unit_price": number, "amount": number}]
  subtotal                  numeric(10,2) not null,
  gst                       numeric(10,2) not null,
  total                     numeric(10,2) not null,
  status                    text default 'draft',       -- draft|confirmed|sent|paid|overdue|void
  due_date                  date,                       -- default: 14 days from created_at

  -- Stripe
  stripe_payment_link_id    text,
  stripe_payment_link_url   text,
  stripe_payment_intent_id  text,

  -- Storage
  pdf_storage_path          text,                       -- Supabase Storage path

  -- Audit
  raw_message               text,                       -- original WhatsApp message
  parsed_json               text,                       -- GPT-4o output for debugging
  whatsapp_message_sid      text,                       -- Twilio message SID
  reminders_sent            integer default 0,
  paid_at                   timestamptz,
  created_at                timestamptz default now()
);

alter table invoices enable row level security;

create policy "tradie sees own invoices"
  on invoices for all
  using (tradie_id = (select id from tradies where user_id = auth.uid()));

create index invoices_tradie_status on invoices(tradie_id, status);
create index invoices_due_date on invoices(due_date) where status = 'sent';
```

### 5.4 message_log

```sql
create table message_log (
  id                  uuid primary key default gen_random_uuid(),
  tradie_id           uuid references tradies(id),      -- null if unregistered
  whatsapp_number     text not null,
  direction           text not null,                    -- inbound|outbound
  message_type        text not null,                    -- text|image|audio|document
  raw_content         text,
  twilio_sid          text,
  processing_status   text,                             -- received|parsed|replied|failed
  error_details       text,
  created_at          timestamptz default now()
);

alter table message_log enable row level security;
-- Admin only via service_role
create policy "no direct access" on message_log using (false);
```

### 5.5 Overdue Reminder Cron

```sql
-- Enable pg_cron extension in Supabase dashboard first
-- Runs daily at 7am AEST = 9pm UTC
select cron.schedule(
  'overdue-reminders',
  '0 21 * * *',
  $$
    select net.http_post(
      url := 'https://[project-ref].supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
    );
  $$
);
```

---

## 6. WhatsApp Bot Specification

### 6.1 Onboarding Flow

First message from unregistered number:
```
Bot: "G'day! I'm Docket — I turn your job description into
     a legal GST invoice in under 30 seconds.

     To get started, reply with:
     Name, business name, and ABN

     Example:
     Dave Wilson, Dave's Plumbing, ABN 12 345 678 901

     Or sign up at docket.com.au to start your
     free 30-day trial first."
```

On receiving registration:
1. Parse with GPT-4o
2. Validate ABN (11-digit checksum)
3. `INSERT INTO tradies` via service_role
4. Trigger Supabase Auth magic link to email
5. Reply confirming activation

### 6.2 Invoice Creation Flow

```
1. Receive Twilio webhook (text | image | audio)
2. SELECT * FROM tradies WHERE whatsapp_number = $1
3. Not registered → onboarding prompt
4. subscription_status = 'canceled' → renewal link
5. image → GPT-4o Vision extraction
6. audio → Whisper transcription → GPT-4o extraction
7. text → GPT-4o extraction
8. Calculate: subtotal, GST (10%), total
9. Atomically: UPDATE tradies SET invoice_counter = invoice_counter + 1
10. INSERT INTO invoices (status='draft')
11. Send draft to tradie:
    ─────────────────────
    Dave's Plumbing — Draft Invoice #0042
    ─────────────────────
    Labour 2hrs           $160.00
    Mixer tap             $95.00
    ─────────────────────
    Subtotal              $255.00
    GST (10%)             $25.50
    TOTAL                 $280.50
    ─────────────────────
    Reply YES to send
    Or tell me what to fix
12. YES → generate PDF → Supabase Storage → create Stripe link → UPDATE status='sent' → send
13. Correction → UPDATE invoice → re-display draft
```

### 6.3 GPT-4o System Prompt

```
You are an invoice extraction assistant for Australian tradies.
Extract invoice details from the message below.
Return ONLY valid JSON. No explanation. No markdown backticks.

Schema:
{
  "client": string | null,
  "items": [{"description": string, "quantity": number, "unit_price": number, "amount": number}],
  "gst_included": boolean,
  "subtotal": number,
  "gst": number,
  "total": number,
  "confidence": number
}

Rules:
- GST in Australia is always 10%
- If "inc gst" or "incl gst": gst_included=true, back-calculate (subtotal = total/1.1)
- Default gst_included=false (add 10% on top)
- Labour is typically $/hr
- AU trade brands: Reece, Bunnings, Rexel, Blackwoods, Total Tools
- Slang: sparky=electrician, chippy=carpenter, brickie=bricklayer
- If confidence < 0.7, reflect that in the score — do not guess on amounts
```

### 6.4 Command Keywords

| Keyword | Response |
|---------|----------|
| `unpaid` / `what's owed` | List unpaid invoices: client, amount, age in days |
| `paid` | Invoices paid in last 30 days + total |
| `last 5` / `show invoices` | Last 5 invoices with status |
| `remind [name]` | Send overdue reminder to named client |
| `remind all` | Remind all clients with invoices > 7 days unpaid |
| `bas` | BAS summary current quarter + PDF link |
| `setup payments` | Link to Stripe Express onboarding |
| `dashboard` | Magic link to web dashboard |
| `help` | Full command list |
| `stop` | Opt out of all automated messages |

### 6.5 Automated Push Messages

| Trigger | Timing | Content |
|---------|--------|---------|
| Invoice overdue D+7 | 7am AEST (pg_cron) | Friendly reminder + payment link |
| Invoice overdue D+14 | 7am AEST (pg_cron) | Firm reminder + payment link |
| Invoice overdue D+30 | 7am AEST (pg_cron) | Final notice |
| Payment received | Instant (Stripe webhook) | "Mick paid $280 ✓" |
| Weekly summary | Monday 7am AEST | Collected, sent, outstanding |
| Trial ending | 3 days before trial_ends_at | Renewal link |
| Subscription lapsed | On cancellation | Bot deactivated + renewal link |
| Payment setup nudge | After invoice 1 and 3 (no Stripe) | Link to setup-payments |

---

## 7. Stripe Connect Flow

### 7.1 Tradie Experience

Tradies never see "Stripe". They see:

> **💳 Get paid faster**
> Add a bank account so clients can pay your invoices online.
> Takes 2 minutes. Money lands in your account within 2 business days.
> **[ Set up payments → ]**

### 7.2 Backend Flow

```python
# 1. Create Express account
account = stripe.Account.create(
    type="express",
    country="AU",
    email=tradie.email,
    capabilities={
        "card_payments": {"requested": True},
        "transfers": {"requested": True},
    },
    business_type="individual",
    business_profile={"mcc": "1711", "url": "https://docket.com.au"}
)

# 2. Save account.id immediately
supabase.table("tradies").update(
    {"stripe_account_id": account.id}
).eq("id", tradie.id).execute()

# 3. Generate onboarding link
link = stripe.AccountLink.create(
    account=account.id,
    refresh_url="https://docket.com.au/settings/payments/refresh",
    return_url="https://docket.com.au/settings/payments/done",
    type="account_onboarding"
)

# 4. Redirect tradie to link.url
```

### 7.3 Payment Link Creation

```python
def create_payment_link(invoice, tradie):
    # CRITICAL: check both flags
    if not tradie.stripe_charges_enabled or not tradie.stripe_payouts_enabled:
        return None  # send invoice without link + nudge

    return stripe.PaymentLink.create(
        line_items=[{
            "price_data": {
                "currency": "aud",
                "unit_amount": int(invoice.total * 100),
                "product_data": {
                    "name": f"Invoice {invoice.invoice_number}",
                    "description": tradie.business_name,
                },
            },
            "quantity": 1,
        }],
        application_fee_amount=int(invoice.total * 100 * 0.005),  # 0.5%
        transfer_data={"destination": tradie.stripe_account_id},
        metadata={"invoice_id": invoice.id, "tradie_id": tradie.id}
    )
```

### 7.4 Stripe Webhooks

| Event | Action |
|-------|--------|
| `account.updated` | Update `stripe_charges_enabled`, `stripe_payouts_enabled` in tradies table |
| `payment_intent.succeeded` | Update invoice `status=paid`, set `paid_at`, send WhatsApp to tradie |
| `customer.subscription.created` | Set `subscription_status=active` |
| `customer.subscription.deleted` | Set `subscription_status=canceled` |
| `customer.subscription.updated` | Sync tier and status |
| `invoice.payment_failed` | Set `subscription_status=past_due`, warn tradie via WhatsApp |

---

## 8. Web Dashboard Specification

### 8.1 Auth — Supabase Magic Link

```typescript
// Sign in
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: "https://docket.com.au/dashboard" }
})

// Middleware — protect /dashboard routes
// supabase/middleware.ts
```

### 8.2 Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/login` | Email OTP form |
| `/signup` | Registration: business name, ABN, email, WhatsApp number + Stripe trial |
| `/dashboard` | 3 metric cards + real-time invoice list |
| `/invoices` | Full list. Filter by status/date/client. |
| `/invoices/[id]` | Line items, status, PDF download (signed URL), resend, mark paid |
| `/clients` | Auto-built from invoice history |
| `/reports` | BAS quarterly summary. Pro only. |
| `/settings/profile` | Business name, ABN, logo, licence number |
| `/settings/payments` | Stripe Connect Express setup + status |
| `/billing` | Stripe Customer Portal embed |
| `/admin` | MRR, subscribers, churn. Internal only. |
| `/admin/tradies` | All accounts. Ban/whitelist. |
| `/admin/messages` | Full message_log with raw + parsed JSON |
| `/admin/failures` | GPT-4o parse failures (confidence < 0.7) |

### 8.3 Realtime Subscription

```typescript
// Invoice list — live updates
const channel = supabase
  .channel("invoice-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "invoices",
    filter: `tradie_id=eq.${tradieId}`,
  }, (payload) => {
    setInvoices(prev => upsertInvoice(prev, payload.new))
  })
  .subscribe()
```

---

## 9. MVP Scope

### In Scope (Ship these, nothing else)

1. WhatsApp text-to-invoice via GPT-4o
2. Photo-to-invoice (GPT-4o Vision)
3. Voice note-to-invoice via Whisper
4. Confirm flow (YES / correction)
5. ATO-compliant PDF generation
6. GST auto-calculation (10%)
7. Sequential invoice numbering (atomic Postgres counter)
8. Stripe Connect Express onboarding (abstracted — tradie never sees "Stripe")
9. Stripe payment link on invoice
10. Payment received WhatsApp notification (Stripe webhook)
11. Overdue reminders D+7 and D+14 (pg_cron)
12. Payment setup nudge (invoice 1 and 3 without Stripe)
13. Offline message queue (bot queues when no signal)
14. Dashboard: signup, invoice list, PDF download
15. Supabase RLS on all tables
16. Admin panel: message_log + parse failures

### Out of Scope

- Materials price database
- BAS export (V1.5)
- Xero/MYOB sync (V2)
- Subcontractor/RCTI billing (V2)
- Staff accounts (V2)
- Bank reconciliation (V3)
- Native iOS/Android app (V2)

---

## 10. API & Integration References

### Supabase
- Dashboard: https://supabase.com/dashboard
- JS SDK: `@supabase/supabase-js`, `@supabase/ssr`
- Python SDK: `supabase-py`
- RLS docs: https://supabase.com/docs/guides/auth/row-level-security
- Realtime: https://supabase.com/docs/guides/realtime

### Twilio WhatsApp
- Sandbox: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
- Webhook payload key fields: `Body`, `From`, `MediaUrl0`, `MediaContentType0`, `MessageSid`
- Send message: `client.messages.create(from_='whatsapp:+14155238886', to='whatsapp:+61...', body='...')`

### OpenAI
- GPT-4o: `model="gpt-4o"`, max_tokens=1000
- Whisper: `client.audio.transcriptions.create(model="whisper-1", file=audio_file)`
- GPT-4o Vision: include image_url in messages content

### Stripe Connect Express
- Docs: https://stripe.com/docs/connect/express-accounts
- AU MCC codes: 1711 (plumbing), 1731 (electrical), 1521 (building)
- Webhook events: `account.updated`, `payment_intent.succeeded`

### pdf-lib
- Docs: https://pdf-lib.js.org/
- Run inside Supabase Edge Function (Deno)
- ATO invoice requirements: ABN, invoice number, date, itemised description, GST line, total

---

## 11. Environment Variables

### Next.js Dashboard (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe for browser
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...                  # server only
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Python Bot (Railway env vars)
```bash
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # NEVER in browser or git
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Supabase Edge Functions
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 12. File Structure

```
docket/
├── PRD.md                          # This file
├── .cursorrules                    # Cursor agent rules
├── AGENTS.md                       # Agent prompts
│
├── app/                            # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── clients/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       ├── payments/page.tsx
│   │       └── payments/done/page.tsx
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── tradies/page.tsx
│   │       ├── messages/page.tsx
│   │       └── failures/page.tsx
│   ├── api/
│   │   ├── stripe/webhook/route.ts
│   │   └── stripe/connect/route.ts
│   └── layout.tsx
│
├── components/
│   ├── ui/                         # Shadcn components
│   ├── invoices/
│   ├── dashboard/
│   └── settings/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # browser client
│   │   ├── server.ts               # server client
│   │   └── middleware.ts
│   ├── stripe/
│   │   ├── client.ts
│   │   └── connect.ts
│   └── utils.ts
│
├── types/
│   └── database.ts                 # Generated from Supabase
│
├── middleware.ts                   # Auth protection
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_tradies.sql
│   │   ├── 002_clients.sql
│   │   ├── 003_invoices.sql
│   │   ├── 004_message_log.sql
│   │   └── 005_cron.sql
│   ├── functions/
│   │   ├── generate-pdf/
│   │   │   └── index.ts
│   │   ├── stripe-webhook/
│   │   │   └── index.ts
│   │   └── send-reminders/
│   │       └── index.ts
│   └── seed.sql
│
└── bot/                            # Python FastAPI
    ├── main.py
    ├── webhook.py
    ├── parser.py
    ├── commands.py
    ├── invoice.py
    ├── payments.py
    ├── notifications.py
    ├── queue.py                    # offline message queue
    ├── utils.py
    ├── requirements.txt
    ├── Dockerfile
    └── railway.toml
```
