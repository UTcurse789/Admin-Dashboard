CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128),
  clerk_id VARCHAR(128),
  event_name VARCHAR(64) NOT NULL,
  page_url TEXT,
  referrer TEXT,
  source VARCHAR(128),
  device VARCHAR(16),
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor
  ON analytics_events (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON analytics_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_clerk_id
  ON analytics_events (clerk_id, created_at DESC)
  WHERE clerk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_source
  ON analytics_events (source, created_at DESC)
  WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_device
  ON analytics_events (device, created_at DESC)
  WHERE device IS NOT NULL;
