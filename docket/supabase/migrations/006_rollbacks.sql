-- Migration: rollbacks
-- Created: 2026-04-11
--
-- Rollback statements for all tables in reverse order.
-- Run these manually if you need to tear down the schema.
-- WARNING: This will destroy all data in these tables.

-- Rollback: drop increment_invoice_counter RPC
-- DROP FUNCTION IF EXISTS increment_invoice_counter(uuid);

-- Rollback: remove cron job
-- SELECT cron.unschedule('overdue-reminders');

-- Rollback: drop message_log
-- DROP TABLE IF EXISTS message_log CASCADE;

-- Rollback: drop invoices
-- DROP TABLE IF EXISTS invoices CASCADE;

-- Rollback: drop clients
-- DROP TABLE IF EXISTS clients CASCADE;

-- Rollback: drop tradies
-- DROP TABLE IF EXISTS tradies CASCADE;
