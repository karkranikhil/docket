-- Migration: invoices
-- Created: 2026-04-11

CREATE TABLE IF NOT EXISTS invoices (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tradie_id                  uuid NOT NULL REFERENCES tradies(id) ON DELETE CASCADE,
  client_id                  uuid REFERENCES clients(id),
  invoice_number             text NOT NULL,
  line_items                 jsonb NOT NULL,
  subtotal                   numeric(10,2) NOT NULL,
  gst                        numeric(10,2) NOT NULL,
  total                      numeric(10,2) NOT NULL,
  status                     text DEFAULT 'draft',
  due_date                   date,

  -- Stripe
  stripe_payment_link_id     text,
  stripe_payment_link_url    text,
  stripe_payment_intent_id   text,

  -- Storage
  pdf_storage_path           text,

  -- Audit
  raw_message                text,
  parsed_json                text,
  whatsapp_message_sid       text,
  reminders_sent             integer DEFAULT 0,
  paid_at                    timestamptz,
  created_at                 timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tradie sees own invoices"
  ON invoices FOR ALL
  USING (tradie_id = (SELECT id FROM tradies WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS invoices_tradie_status ON invoices(tradie_id, status);
CREATE INDEX IF NOT EXISTS invoices_due_date ON invoices(due_date) WHERE status = 'sent';
