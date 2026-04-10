-- Migration: cron
-- Created: 2026-04-11
--
-- Overdue reminder cron job.
-- Fires daily at 9pm UTC = 7am AEST (UTC+10).
-- Enable the pg_cron and pg_net extensions in the Supabase dashboard first.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'overdue-reminders',
  '0 21 * * *',
  $$
    SELECT net.http_post(
      url := 'https://[project-ref].supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
    );
  $$
);
