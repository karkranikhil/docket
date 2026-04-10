-- Migration: tradies
-- Created: 2026-04-11

CREATE TABLE IF NOT EXISTS tradies (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number            text UNIQUE NOT NULL,
  business_name              text NOT NULL,
  abn                        text NOT NULL,
  email                      text NOT NULL,
  logo_path                  text,
  licence_number             text,
  state                      text,
  gst_registered             boolean DEFAULT true,
  invoice_counter            integer DEFAULT 0,

  -- Stripe
  stripe_customer_id         text,
  stripe_account_id          text,
  stripe_charges_enabled     boolean DEFAULT false,
  stripe_payouts_enabled     boolean DEFAULT false,
  stripe_onboarding_complete boolean DEFAULT false,

  -- Subscription
  subscription_status        text DEFAULT 'trialing',
  subscription_tier          text DEFAULT 'starter',
  trial_ends_at              timestamptz,
  subscribed_at              timestamptz,

  -- Preferences
  weekly_summary_enabled     boolean DEFAULT true,
  reminders_enabled          boolean DEFAULT true,

  created_at                 timestamptz DEFAULT now(),
  onboarded_at               timestamptz
);

ALTER TABLE tradies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tradie reads own record"
  ON tradies FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "tradie updates own record"
  ON tradies FOR UPDATE
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS tradies_whatsapp_number ON tradies(whatsapp_number);
