-- Add settings JSONB column to users table
-- Stores user preferences for notifications and integrations

ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "email_enabled": true,
  "digest_frequency": "instant",
  "slack_webhook_url": null
}'::jsonb;

-- Add index for querying settings
CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING gin(settings);

-- Comment for documentation
COMMENT ON COLUMN users.settings IS 'User notification preferences: email_enabled, digest_frequency, slack_webhook_url';
