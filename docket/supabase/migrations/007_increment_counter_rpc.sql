-- Migration: increment_invoice_counter RPC function
-- Created: 2026-04-11
-- Required by bot/invoice.py for atomic invoice counter increments

CREATE OR REPLACE FUNCTION increment_invoice_counter(tradie_row_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_counter integer;
BEGIN
  UPDATE tradies
  SET invoice_counter = invoice_counter + 1
  WHERE id = tradie_row_id
  RETURNING invoice_counter INTO new_counter;

  RETURN new_counter;
END;
$$;
