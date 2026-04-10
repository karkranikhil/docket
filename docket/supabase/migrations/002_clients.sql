-- Migration: clients
-- Created: 2026-04-11

CREATE TABLE IF NOT EXISTS clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tradie_id       uuid NOT NULL REFERENCES tradies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  phone           text,
  email           text,
  address         text,
  total_invoiced  numeric(10,2) DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tradie sees own clients"
  ON clients FOR ALL
  USING (tradie_id = (SELECT id FROM tradies WHERE user_id = auth.uid()));
