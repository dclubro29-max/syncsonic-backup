CREATE TABLE premium_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  first_months INTEGER NOT NULL CHECK (first_months BETWEEN 1 AND 120),
  additional_months INTEGER NOT NULL CHECK (additional_months BETWEEN 1 AND 120),
  details TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details))
);

CREATE TABLE premium_codes (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES premium_campaigns(id),
  code_hash TEXT UNIQUE NOT NULL,
  code_masked TEXT NOT NULL,
  lifetime INTEGER NOT NULL DEFAULT 0 CHECK (lifetime IN (0, 1)),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1))
);

CREATE TABLE premium_entitlements (
  user_id TEXT NOT NULL REFERENCES users(id),
  campaign_id TEXT NOT NULL REFERENCES premium_campaigns(id),
  expires_on TEXT NOT NULL,
  lifetime INTEGER NOT NULL CHECK (lifetime IN (0, 1)),
  activation_count INTEGER NOT NULL CHECK (activation_count >= 0),
  last_code_masked TEXT,
  PRIMARY KEY (user_id, campaign_id)
);

CREATE TABLE premium_activations (
  code_id TEXT PRIMARY KEY NOT NULL REFERENCES premium_codes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  campaign_id TEXT NOT NULL REFERENCES premium_campaigns(id),
  code_masked TEXT NOT NULL,
  months INTEGER NOT NULL,
  lifetime INTEGER NOT NULL CHECK (lifetime IN (0, 1)),
  first_in_campaign INTEGER NOT NULL CHECK (first_in_campaign IN (0, 1)),
  granted_from TEXT NOT NULL,
  expires_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX premium_activations_history ON premium_activations(user_id, campaign_id, created_at DESC);

CREATE TABLE premium_attempts (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TRIGGER premium_grant_after_activation AFTER INSERT ON premium_activations
BEGIN
  INSERT INTO premium_entitlements(user_id, campaign_id, expires_on, lifetime, activation_count, last_code_masked)
  VALUES (new.user_id, new.campaign_id, new.expires_on, new.lifetime, 1, new.code_masked)
  ON CONFLICT(user_id, campaign_id) DO UPDATE SET
    expires_on = max(premium_entitlements.expires_on, excluded.expires_on),
    lifetime = max(premium_entitlements.lifetime, excluded.lifetime),
    activation_count = premium_entitlements.activation_count + 1,
    last_code_masked = excluded.last_code_masked;
END;
