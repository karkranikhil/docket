-- Migration: message_log
-- Created: 2026-04-11

CREATE TABLE IF NOT EXISTS message_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tradie_id           uuid REFERENCES tradies(id),
  whatsapp_number     text NOT NULL,
  direction           text NOT NULL,
  message_type        text NOT NULL,
  raw_content         text,
  twilio_sid          text,
  processing_status   text,
  error_details       text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access via service_role; deny all direct access
CREATE POLICY "no direct access" ON message_log USING (false);
