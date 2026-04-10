-- Seed data for local development
-- Run with: npx supabase db reset (applies migrations + seed)

-- ============================================================
-- Tradies
-- ============================================================
-- Note: user_id is NULL in seed data since Supabase Auth users
-- must be created through the Auth API. Link them after signup.

INSERT INTO tradies (id, user_id, whatsapp_number, business_name, abn, email, licence_number, state, gst_registered, invoice_counter, subscription_status, subscription_tier, trial_ends_at, weekly_summary_enabled, reminders_enabled, created_at)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    NULL,
    '+61412345678',
    'Dave''s Plumbing',
    '51824753556',
    'dave@davesplumbing.com.au',
    'QBCC-1234567',
    'QLD',
    true,
    5,
    'active',
    'pro',
    NULL,
    true,
    true,
    '2026-01-15T08:00:00+10:00'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    NULL,
    '+61498765432',
    'Karen Wu Electrical',
    '33102417032',
    'karen@kwelectrical.com.au',
    'VBA-9876543',
    'VIC',
    true,
    5,
    'trialing',
    'starter',
    '2026-05-01T00:00:00+10:00',
    true,
    true,
    '2026-03-20T10:30:00+10:00'
  );

-- ============================================================
-- Clients — 3 per tradie
-- ============================================================

-- Dave's clients
INSERT INTO clients (id, tradie_id, name, phone, email, address, total_invoiced)
VALUES
  ('c1111111-0001-0001-0001-000000000001', 'a1111111-1111-1111-1111-111111111111', 'Mick Thompson', '+61400111222', 'mick@example.com', '42 Wallaby Way, Paddington QLD 4064', 1580.00),
  ('c1111111-0002-0002-0002-000000000002', 'a1111111-1111-1111-1111-111111111111', 'Sarah Chen', '+61400333444', 'sarah.chen@example.com', '7 Harbour Rd, Hamilton QLD 4007', 935.00),
  ('c1111111-0003-0003-0003-000000000003', 'a1111111-1111-1111-1111-111111111111', 'Blue Mountains Cafe', '+61400555666', 'admin@bluemountainscafe.com.au', '88 Eagle St, Brisbane QLD 4000', 2200.00);

-- Karen's clients
INSERT INTO clients (id, tradie_id, name, phone, email, address, total_invoiced)
VALUES
  ('c2222222-0001-0001-0001-000000000001', 'b2222222-2222-2222-2222-222222222222', 'Tom Jenkins', '+61411222333', 'tom.jenkins@example.com', '15 Chapel St, South Yarra VIC 3141', 1100.00),
  ('c2222222-0002-0002-0002-000000000002', 'b2222222-2222-2222-2222-222222222222', 'Priya Patel', '+61411444555', 'priya@example.com', '200 Lonsdale St, Melbourne VIC 3000', 660.00),
  ('c2222222-0003-0003-0003-000000000003', 'b2222222-2222-2222-2222-222222222222', 'Bayside Physio', '+61411666777', 'reception@baysidephysio.com.au', '9 Beach Rd, Sandringham VIC 3191', 1870.00);

-- ============================================================
-- Invoices — 5 per tradie (mixed statuses)
-- ============================================================

-- Dave's invoices
INSERT INTO invoices (id, tradie_id, client_id, invoice_number, line_items, subtotal, gst, total, status, due_date, reminders_sent, paid_at, created_at)
VALUES
  (
    'd1111111-0001-0001-0001-000000000001',
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-0001-0001-0001-000000000001',
    'INV-0001',
    '[{"description": "Replace kitchen mixer tap", "quantity": 1, "unit_price": 95.00, "amount": 95.00}, {"description": "Labour (2hrs)", "quantity": 2, "unit_price": 80.00, "amount": 160.00}]'::jsonb,
    255.00, 25.50, 280.50,
    'paid',
    '2026-02-12',
    0,
    '2026-02-10T14:22:00+10:00',
    '2026-01-29T09:15:00+10:00'
  ),
  (
    'd1111111-0002-0002-0002-000000000002',
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-0002-0002-0002-000000000002',
    'INV-0002',
    '[{"description": "Fix leaking shower head", "quantity": 1, "unit_price": 180.00, "amount": 180.00}, {"description": "Shower head replacement", "quantity": 1, "unit_price": 65.00, "amount": 65.00}]'::jsonb,
    245.00, 24.50, 269.50,
    'sent',
    '2026-04-01',
    2,
    NULL,
    '2026-03-18T11:00:00+10:00'
  ),
  (
    'd1111111-0003-0003-0003-000000000003',
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-0003-0003-0003-000000000003',
    'INV-0003',
    '[{"description": "Commercial dishwasher install", "quantity": 1, "unit_price": 1500.00, "amount": 1500.00}, {"description": "Plumbing supplies", "quantity": 1, "unit_price": 350.00, "amount": 350.00}, {"description": "Labour (4hrs)", "quantity": 4, "unit_price": 80.00, "amount": 320.00}]'::jsonb,
    2170.00, 217.00, 2387.00,
    'overdue',
    '2026-03-15',
    3,
    NULL,
    '2026-03-01T08:45:00+10:00'
  ),
  (
    'd1111111-0004-0004-0004-000000000004',
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-0001-0001-0001-000000000001',
    'INV-0004',
    '[{"description": "Blocked drain clearing", "quantity": 1, "unit_price": 220.00, "amount": 220.00}]'::jsonb,
    220.00, 22.00, 242.00,
    'sent',
    '2026-04-20',
    0,
    NULL,
    '2026-04-06T16:30:00+10:00'
  ),
  (
    'd1111111-0005-0005-0005-000000000005',
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-0002-0002-0002-000000000002',
    'INV-0005',
    '[{"description": "Hot water system inspection", "quantity": 1, "unit_price": 150.00, "amount": 150.00}]'::jsonb,
    150.00, 15.00, 165.00,
    'draft',
    NULL,
    0,
    NULL,
    '2026-04-11T07:00:00+10:00'
  );

-- Karen's invoices
INSERT INTO invoices (id, tradie_id, client_id, invoice_number, line_items, subtotal, gst, total, status, due_date, reminders_sent, paid_at, created_at)
VALUES
  (
    'd2222222-0001-0001-0001-000000000001',
    'b2222222-2222-2222-2222-222222222222',
    'c2222222-0001-0001-0001-000000000001',
    'INV-0001',
    '[{"description": "Switchboard upgrade", "quantity": 1, "unit_price": 800.00, "amount": 800.00}, {"description": "Safety switch install", "quantity": 2, "unit_price": 150.00, "amount": 300.00}]'::jsonb,
    1100.00, 110.00, 1210.00,
    'paid',
    '2026-04-03',
    0,
    '2026-04-01T09:12:00+10:00',
    '2026-03-20T14:00:00+10:00'
  ),
  (
    'd2222222-0002-0002-0002-000000000002',
    'b2222222-2222-2222-2222-222222222222',
    'c2222222-0002-0002-0002-000000000002',
    'INV-0002',
    '[{"description": "Ceiling fan install", "quantity": 3, "unit_price": 120.00, "amount": 360.00}, {"description": "Labour (3hrs)", "quantity": 3, "unit_price": 100.00, "amount": 300.00}]'::jsonb,
    660.00, 66.00, 726.00,
    'sent',
    '2026-04-18',
    0,
    NULL,
    '2026-04-04T10:20:00+10:00'
  ),
  (
    'd2222222-0003-0003-0003-000000000003',
    'b2222222-2222-2222-2222-222222222222',
    'c2222222-0003-0003-0003-000000000003',
    'INV-0003',
    '[{"description": "Emergency lighting compliance check", "quantity": 1, "unit_price": 450.00, "amount": 450.00}, {"description": "Exit sign replacement", "quantity": 4, "unit_price": 85.00, "amount": 340.00}, {"description": "Labour (5hrs)", "quantity": 5, "unit_price": 100.00, "amount": 500.00}]'::jsonb,
    1290.00, 129.00, 1419.00,
    'overdue',
    '2026-03-22',
    2,
    NULL,
    '2026-03-08T08:30:00+10:00'
  ),
  (
    'd2222222-0004-0004-0004-000000000004',
    'b2222222-2222-2222-2222-222222222222',
    'c2222222-0001-0001-0001-000000000001',
    'INV-0004',
    '[{"description": "Power point install (double)", "quantity": 4, "unit_price": 95.00, "amount": 380.00}]'::jsonb,
    380.00, 38.00, 418.00,
    'paid',
    '2026-04-10',
    0,
    '2026-04-08T11:05:00+10:00',
    '2026-03-27T13:15:00+10:00'
  ),
  (
    'd2222222-0005-0005-0005-000000000005',
    'b2222222-2222-2222-2222-222222222222',
    'c2222222-0003-0003-0003-000000000003',
    'INV-0005',
    '[{"description": "Smoke alarm replacement (hardwired)", "quantity": 6, "unit_price": 75.00, "amount": 450.00}]'::jsonb,
    450.00, 45.00, 495.00,
    'draft',
    NULL,
    0,
    NULL,
    '2026-04-11T09:00:00+10:00'
  );

-- ============================================================
-- Message log — 10 entries
-- ============================================================

INSERT INTO message_log (tradie_id, whatsapp_number, direction, message_type, raw_content, twilio_sid, processing_status, created_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'inbound', 'text', 'Replaced mixer tap for Mick Thompson, 2hrs labour at 80/hr plus $95 tap', 'SM0001abc', 'parsed', '2026-01-29T09:15:00+10:00'),
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'outbound', 'text', 'Dave''s Plumbing — Draft Invoice #0001\nLabour 2hrs $160.00\nMixer tap $95.00\nSubtotal $255.00\nGST $25.50\nTOTAL $280.50\nReply YES to send', 'SM0002abc', 'replied', '2026-01-29T09:16:00+10:00'),
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'inbound', 'text', 'YES', 'SM0003abc', 'parsed', '2026-01-29T09:17:00+10:00'),
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'outbound', 'text', 'Invoice #0001 sent to Mick Thompson. Pay link: https://pay.stripe.com/xxx', 'SM0004abc', 'replied', '2026-01-29T09:17:30+10:00'),
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'inbound', 'text', 'unpaid', 'SM0005abc', 'parsed', '2026-04-06T08:00:00+10:00'),
  ('a1111111-1111-1111-1111-111111111111', '+61412345678', 'outbound', 'text', 'Unpaid invoices:\nINV-0002 Sarah Chen $269.50 (24 days)\nINV-0003 Blue Mountains Cafe $2,387.00 (41 days)', 'SM0006abc', 'replied', '2026-04-06T08:00:05+10:00'),
  ('b2222222-2222-2222-2222-222222222222', '+61498765432', 'inbound', 'text', 'Did a switchboard upgrade for Tom Jenkins, 800 for the board plus 2 safety switches at 150 each', 'SM0007abc', 'parsed', '2026-03-20T14:00:00+10:00'),
  ('b2222222-2222-2222-2222-222222222222', '+61498765432', 'outbound', 'text', 'Karen Wu Electrical — Draft Invoice #0001\nSwitchboard upgrade $800.00\nSafety switch install x2 $300.00\nSubtotal $1,100.00\nGST $110.00\nTOTAL $1,210.00\nReply YES to send', 'SM0008abc', 'replied', '2026-03-20T14:00:10+10:00'),
  ('b2222222-2222-2222-2222-222222222222', '+61498765432', 'inbound', 'image', NULL, 'SM0009abc', 'failed', '2026-04-05T15:30:00+10:00'),
  ('b2222222-2222-2222-2222-222222222222', '+61498765432', 'inbound', 'text', 'help', 'SM0010abc', 'parsed', '2026-04-10T10:00:00+10:00');
