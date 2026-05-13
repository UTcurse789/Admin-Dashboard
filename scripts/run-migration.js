process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const pg = require("pg");

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Check if table exists
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ad_events'
      ) as exists
    `);
    
    if (check.rows[0].exists) {
      console.log("Table ad_events already exists. Dropping and recreating...");
      await pool.query("DROP TABLE ad_events");
    }

    // Create fresh table
    await pool.query(`
      CREATE TABLE ad_events (
        id            BIGSERIAL PRIMARY KEY,
        event_type    VARCHAR(16)  NOT NULL CHECK (event_type IN ('impression', 'click')),
        ad_document_id VARCHAR(64) NOT NULL,
        placement     VARCHAR(64),
        target_url    TEXT,
        user_agent    TEXT,
        device_type   VARCHAR(16),
        ip_address    INET,
        country       VARCHAR(64),
        region        VARCHAR(128),
        city          VARCHAR(128),
        page_url      TEXT,
        referrer      TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Table created!");

    // Create indexes
    await pool.query(`CREATE INDEX idx_ad_events_document_id ON ad_events (ad_document_id)`);
    await pool.query(`CREATE INDEX idx_ad_events_event_type ON ad_events (event_type)`);
    await pool.query(`CREATE INDEX idx_ad_events_created_at ON ad_events (created_at DESC)`);
    await pool.query(`CREATE INDEX idx_ad_events_doc_type_date ON ad_events (ad_document_id, event_type, created_at DESC)`);
    console.log("✅ Indexes created!");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
