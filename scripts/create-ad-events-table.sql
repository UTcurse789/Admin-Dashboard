-- ═══════════════════════════════════════════════════════════════════
-- Ad Events Tracking Table
-- Stores impression and click events for all advertisements
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ad_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    VARCHAR(16)  NOT NULL CHECK (event_type IN ('impression', 'click')),
  ad_document_id VARCHAR(64) NOT NULL,          -- Strapi documentId
  placement     VARCHAR(64),                     -- e.g. "home_featured_partner"

  -- Click metadata
  target_url    TEXT,

  -- Client info (captured from request)
  user_agent    TEXT,
  device_type   VARCHAR(16),                     -- 'desktop', 'mobile', 'tablet'
  ip_address    INET,
  country       VARCHAR(64),
  region        VARCHAR(128),                    -- state/province
  city          VARCHAR(128),

  -- Referrer & page context
  page_url      TEXT,                            -- page where the ad was shown
  referrer      TEXT,

  -- Timestamp
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes for efficient querying ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ad_events_document_id    ON ad_events (ad_document_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_event_type     ON ad_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ad_events_created_at     ON ad_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_doc_type_date  ON ad_events (ad_document_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_device         ON ad_events (device_type) WHERE device_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_events_region         ON ad_events (country, region) WHERE country IS NOT NULL;
