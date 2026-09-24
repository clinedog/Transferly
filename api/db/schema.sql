PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'restricted', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  telegram_exchange_hash TEXT NOT NULL UNIQUE,
  current_token_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  last_refreshed_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'personal',
  currency_code TEXT NOT NULL,
  pending_balance_cents INTEGER NOT NULL DEFAULT 0,
  available_balance_cents INTEGER NOT NULL DEFAULT 0,
  frozen_balance_cents INTEGER NOT NULL DEFAULT 0,
  paid_out_balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, organization_id),
  CHECK (pending_balance_cents >= 0),
  CHECK (available_balance_cents >= 0),
  CHECK (frozen_balance_cents >= 0),
  CHECK (paid_out_balance_cents >= 0)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  entry_key TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'personal',
  type TEXT NOT NULL,
  debit_bucket TEXT,
  credit_bucket TEXT,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  external_reference TEXT,
  description TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (amount_cents > 0),
  CHECK (debit_bucket IS NULL OR debit_bucket IN ('PENDING', 'AVAILABLE', 'FROZEN', 'PAID_OUT')),
  CHECK (credit_bucket IS NULL OR credit_bucket IN ('PENDING', 'AVAILABLE', 'FROZEN', 'PAID_OUT')),
  CHECK (debit_bucket IS NOT NULL OR credit_bucket IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'personal',
  template_id TEXT,
  paypal_invoice_id TEXT NOT NULL UNIQUE,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  description TEXT,
  invoice_url TEXT NOT NULL,
  paypal_details_json TEXT NOT NULL,
  paypal_qr_details_json TEXT,
  paypal_synced_at TEXT,
  metadata_json TEXT,
  issue_date TEXT,
  due_date TEXT,
  auto_reminders_cancelled_at TEXT,
  paid_at TEXT,
  cancelled_at TEXT,
  refunded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  currency_code TEXT NOT NULL,
  default_due_days INTEGER,
  line_items_json TEXT NOT NULL,
  metadata_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  point_price INTEGER NOT NULL DEFAULT 0 CHECK (point_price >= 0),
  badge TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'sandbox', 'active', 'maintenance', 'disabled')),
  generator_key TEXT,
  generator_version TEXT,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_type TEXT,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  queue_behavior_json TEXT NOT NULL DEFAULT '{}',
  retention_days INTEGER CHECK (retention_days IS NULL OR retention_days >= 0),
  execution_mode TEXT NOT NULL DEFAULT 'production' CHECK (execution_mode IN ('production', 'sandbox', 'training')),
  version TEXT NOT NULL DEFAULT '1',
  feature_flag TEXT,
  receipt_type TEXT,
  is_payment_provider INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_templates (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  receipt_type TEXT,
  cost_points INTEGER,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  renderer_config_json TEXT NOT NULL DEFAULT '{}',
  preview_asset TEXT,
  version TEXT NOT NULL DEFAULT '1',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE (service_id, template_key)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  sender_batch_id TEXT NOT NULL UNIQUE,
  paypal_payout_batch_id TEXT UNIQUE,
  status TEXT NOT NULL,
  batch_currency_code TEXT NOT NULL,
  raw_response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  stripe_account_id TEXT NOT NULL UNIQUE,
  email TEXT,
  country_code TEXT,
  business_type TEXT,
  status TEXT NOT NULL,
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  details_submitted INTEGER NOT NULL DEFAULT 0,
  requirements_json TEXT,
  capabilities_json TEXT,
  disabled_reason TEXT,
  metadata_json TEXT,
  created_by_actor_id TEXT,
  last_onboarding_link_created_at TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'personal',
  payout_batch_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  sender_batch_id TEXT NOT NULL UNIQUE,
  paypal_payout_item_id TEXT UNIQUE,
  status TEXT NOT NULL,
  risk_decision TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  receiver TEXT NOT NULL,
  receiver_country_code TEXT,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  note TEXT,
  failure_reason TEXT,
  metadata_json TEXT,
  approved_by_actor_id TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  on_hold INTEGER NOT NULL DEFAULT 0,
  held_by_actor_id TEXT,
  held_at TEXT,
  hold_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (payout_batch_id) REFERENCES payout_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  semantic_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  job_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'dispatched', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 10 CHECK (max_attempts > 0),
  next_attempt_at TEXT NOT NULL,
  lease_token TEXT,
  lease_expires_at TEXT,
  fence_token INTEGER NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
  queue_job_id TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  correlation_id TEXT NOT NULL,
  dispatched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'leased' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status <> 'leased'
  )
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_dispatch_due
ON outbox_events (status, next_attempt_at, lease_expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate
ON outbox_events (aggregate_type, aggregate_id, created_at);

CREATE TABLE IF NOT EXISTS provider_operation_inbox (
  id TEXT PRIMARY KEY,
  semantic_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('submission', 'poll', 'webhook')),
  provider_resource_type TEXT,
  provider_resource_id TEXT,
  provider_status TEXT,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (consumed_at IS NULL AND consumed_by IS NULL)
    OR (consumed_at IS NOT NULL AND consumed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_unconsumed
ON provider_operation_inbox (consumed_at, received_at, provider);

CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_aggregate
ON provider_operation_inbox (aggregate_type, aggregate_id, received_at);

CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_resource
ON provider_operation_inbox (provider, provider_resource_type, provider_resource_id);

CREATE TABLE IF NOT EXISTS risk_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  invoice_id TEXT,
  payout_id TEXT,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  reason TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  transmission_id TEXT,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  verification_payload_json TEXT,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'USER',
  points INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_user_id TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  platform_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  support_email TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  brand_color TEXT NOT NULL,
  bank_slip_cost INTEGER NOT NULL DEFAULT 10,
  email_receipt_cost INTEGER NOT NULL DEFAULT 5,
  referral_bonus INTEGER NOT NULL DEFAULT 20,
  signup_bonus INTEGER NOT NULL DEFAULT 50,
  payout_minimum_cents INTEGER NOT NULL DEFAULT 0,
  payout_fee_fixed_cents INTEGER NOT NULL DEFAULT 0,
  payout_fee_percentage_bps INTEGER NOT NULL DEFAULT 0,
  payout_manual_review_cents INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  total_receipts INTEGER NOT NULL DEFAULT 0,
  uptime TEXT NOT NULL DEFAULT '99.9%',
  privacy_policy TEXT NOT NULL,
  terms_of_service TEXT NOT NULL,
  about_us TEXT NOT NULL,
  help_faq TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_due
ON notification_deliveries (status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  channels_json TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_ops_issues (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  summary TEXT NOT NULL,
  metadata_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (entity_type, entity_id, issue_type)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  data_json TEXT NOT NULL,
  pdf_base64 TEXT NOT NULL,
  image_data_url TEXT NOT NULL,
  email_to TEXT,
  cost_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_transactions (
  id TEXT PRIMARY KEY,
  entry_key TEXT UNIQUE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  balance_after INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS point_reservations (
  id TEXT PRIMARY KEY,
  reservation_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  available_points_before INTEGER NOT NULL,
  available_points_after INTEGER NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  metadata_json TEXT,
  reserved_at TEXT NOT NULL,
  expires_at TEXT,
  committed_at TEXT,
  released_at TEXT,
  expired_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_funding_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  min_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (min_amount_minor >= 0),
  max_amount_minor INTEGER CHECK (max_amount_minor IS NULL OR max_amount_minor >= min_amount_minor),
  bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_destinations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  instructions TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS points_funding_requests (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  requested_points INTEGER NOT NULL CHECK (requested_points > 0),
  expected_amount_minor INTEGER NOT NULL CHECK (expected_amount_minor > 0),
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_destination_id TEXT NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  destination_snapshot_json TEXT NOT NULL,
  user_transaction_reference TEXT,
  user_note TEXT,
  evidence_file_id TEXT,
  evidence_storage_key TEXT,
  evidence_metadata_json TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW',
    'APPROVED', 'POINTS_CREDITED', 'REJECTED', 'NEEDS_MORE_INFORMATION',
    'CANCELLED', 'MANUAL_REVIEW'
  )),
  risk_status TEXT NOT NULL DEFAULT 'NORMAL',
  possible_duplicate INTEGER NOT NULL DEFAULT 0 CHECK (possible_duplicate IN (0, 1)),
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  assigned_to TEXT,
  assigned_by TEXT,
  assigned_at TEXT,
  rejection_reason TEXT,
  admin_note TEXT,
  credited_at TEXT,
  ledger_entry_key TEXT UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (package_id) REFERENCES points_funding_packages(id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_destination_id) REFERENCES payment_destinations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS points_reconciliation_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  user_id TEXT,
  funding_request_id TEXT,
  expected_points INTEGER,
  actual_points INTEGER,
  details_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (funding_request_id) REFERENCES points_funding_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_provider_transactions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  provider_reference TEXT,
  event_id TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  destination_json TEXT,
  sender_json TEXT,
  transaction_time TEXT,
  verification_status TEXT NOT NULL,
  match_status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  funding_request_id TEXT,
  match_result_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (funding_request_id) REFERENCES points_funding_requests(id) ON DELETE SET NULL,
  UNIQUE(provider, provider_transaction_id),
  UNIQUE(provider, event_id)
);

CREATE TABLE IF NOT EXISTS account_risk_states (
  user_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'NORMAL',
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  last_decision_id TEXT,
  last_signal_at TEXT,
  changed_by_actor_id TEXT,
  changed_reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  user_id TEXT,
  source TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  correlation_id TEXT NOT NULL,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS risk_signals (
  id TEXT PRIMARY KEY,
  signal_key TEXT NOT NULL UNIQUE,
  risk_event_id TEXT,
  signal_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  user_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  correlation_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (risk_event_id) REFERENCES risk_events(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS risk_decisions (
  id TEXT PRIMARY KEY,
  decision_key TEXT NOT NULL UNIQUE,
  risk_event_id TEXT,
  domain TEXT NOT NULL,
  user_id TEXT,
  decision TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  account_state TEXT,
  reasons_json TEXT,
  signal_ids_json TEXT,
  resource_type TEXT,
  resource_id TEXT,
  correlation_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (risk_event_id) REFERENCES risk_events(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS account_restrictions (
  id TEXT PRIMARY KEY,
  restriction_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  reason TEXT NOT NULL,
  risk_decision_id TEXT,
  case_id TEXT,
  created_by_actor_id TEXT,
  expires_at TEXT,
  lifted_at TEXT,
  lifted_by_actor_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (risk_decision_id) REFERENCES risk_decisions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS risk_cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  user_id TEXT,
  domain TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  assigned_to TEXT,
  opened_by_decision_id TEXT,
  signal_ids_json TEXT,
  related_resources_json TEXT,
  resolution TEXT,
  resolution_reason TEXT,
  resolved_by_actor_id TEXT,
  resolved_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (opened_by_decision_id) REFERENCES risk_decisions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS risk_case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  note TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES risk_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_rule_configurations (
  id TEXT PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  threshold_value INTEGER,
  window_seconds INTEGER,
  severity TEXT NOT NULL,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  service_template_id TEXT,
  service_template_key TEXT,
  status TEXT NOT NULL,
  point_cost INTEGER NOT NULL DEFAULT 0,
  point_reservation_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  failure_code TEXT,
  failure_message TEXT,
  queue_status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  queued_at TEXT,
  processing_started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  failed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  FOREIGN KEY (service_template_id) REFERENCES service_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (point_reservation_id) REFERENCES point_reservations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_payload TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  dispatch_generation INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  job_id TEXT,
  correlation_id TEXT NOT NULL,
  lock_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  lock_expires_at TEXT NOT NULL,
  finished_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE (order_id, dispatch_generation, attempt_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_attempts_active_order
ON order_attempts (order_id)
WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_order_attempts_order_history
ON order_attempts (order_id, attempt_number, created_at);

CREATE INDEX IF NOT EXISTS idx_order_attempts_stale_scan
ON order_attempts (status, lock_expires_at);

CREATE TABLE IF NOT EXISTS dead_letter_records (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_queue TEXT NOT NULL,
  source_job_id TEXT,
  dead_letter_job_id TEXT UNIQUE,
  job_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  failure_code TEXT,
  failure_message TEXT NOT NULL,
  failure_classification TEXT NOT NULL,
  retryable INTEGER NOT NULL,
  attempts_made INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  correlation_id TEXT,
  failed_at TEXT NOT NULL,
  recovery_started_at TEXT,
  recovery_token TEXT UNIQUE,
  recovered_at TEXT,
  recovered_by_actor_id TEXT,
  recovery_note TEXT,
  recovery_job_id TEXT,
  recovery_job_name TEXT,
  last_recovery_error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_records_status_failed
ON dead_letter_records (status, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_records_source
ON dead_letter_records (source_queue, source_job_id);

CREATE TABLE IF NOT EXISTS generated_assets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  classification TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS top_up_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  points INTEGER NOT NULL,
  amount_label TEXT NOT NULL,
  method_id TEXT NOT NULL,
  method_title TEXT NOT NULL,
  service_intent TEXT,
  instructions TEXT,
  vendor_url TEXT,
  notes TEXT,
  admin_notes TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_dispatches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_reference TEXT,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_events (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  bonus_points INTEGER NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  telegram_user_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  last_authenticated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS telegram_command_logs (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  command TEXT NOT NULL,
  arguments_json TEXT,
  response_json TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_created_at
  ON ledger_entries (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference
  ON ledger_entries (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_created_at
  ON invoices (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_services_category_status
  ON services (category, status);
CREATE INDEX IF NOT EXISTS idx_services_status_order
  ON services (status, display_order);
CREATE INDEX IF NOT EXISTS idx_service_templates_service_status
  ON service_templates (service_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_user_created_at
  ON payouts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_created
  ON risk_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_type_created
  ON risk_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_correlation
  ON risk_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_risk_signals_user_created
  ON risk_signals(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_signals_type_created
  ON risk_signals(signal_type, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_signals_severity_created
  ON risk_signals(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_decisions_user_created
  ON risk_decisions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_account_restrictions_user_status
  ON account_restrictions(user_id, status, capability);
CREATE INDEX IF NOT EXISTS idx_account_restrictions_expires
  ON account_restrictions(expires_at);
CREATE INDEX IF NOT EXISTS idx_risk_cases_status_created
  ON risk_cases(status, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_cases_user_status
  ON risk_cases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_risk_cases_level_created
  ON risk_cases(risk_level, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_receiver_created_at
  ON payouts (receiver, created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_accounts_user_created_at
  ON stripe_connected_accounts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_accounts_status
  ON stripe_connected_accounts (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at
  ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON audit_logs (actor_type, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_created_at
  ON risk_flags (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags_rule_created_at
  ON risk_flags (rule_code, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_referrer
  ON profiles (referred_by_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_points
  ON profiles (points, created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_user_created_at
  ON receipts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_created_at
  ON points_transactions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_point_reservations_user_created_at
  ON point_reservations (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_point_reservations_status_updated_at
  ON point_reservations (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_point_reservations_reference
  ON point_reservations (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at
  ON orders (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_service_created_at
  ON orders (service_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_idempotency
  ON orders (user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_records_user_created_at
  ON idempotency_records (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires_at
  ON idempotency_records (expires_at);
CREATE INDEX IF NOT EXISTS idx_order_events_order_created_at
  ON order_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_assets_order_created_at
  ON generated_assets (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_assets_user_created_at
  ON generated_assets (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_assets_expires_at
  ON generated_assets (expires_at);
CREATE INDEX IF NOT EXISTS idx_top_up_orders_user_created_at
  ON top_up_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_top_up_orders_status_created_at
  ON top_up_orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_dispatches_user_created_at
  ON email_dispatches (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_created_at
  ON referral_events (referrer_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user_id
  ON telegram_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_command_logs_user_created_at
  ON telegram_command_logs (telegram_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_status
  ON auth_sessions (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_status_expires_at
  ON auth_sessions (status, expires_at);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_status
  ON organization_memberships(user_id, status);
