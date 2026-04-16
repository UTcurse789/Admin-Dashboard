import { NextResponse } from "next/server";
import { getDbAnalytics } from "@/lib/db";
import pg from "pg";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const value = searchParams.get("value");

    if (!key || !value) {
      return NextResponse.json(
        { error: "Missing key or value standard parameters." },
        { status: 400 }
      );
    }

    // Force TLS bypass if needed just in case (as done in lib/db)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });

    let query = "";
    let params: any[] = [];

    const baseSelect = `
      SELECT id, email, first_name, last_name, organization,
             source, state, salutation, created_at, job_title
      FROM users
    `;

    if (key === "industry") {
      query = `
        ${baseSelect}
        JOIN user_industries ui ON users.id = ui.user_id
        JOIN industry i ON ui.industry_id = i.id
        WHERE i.name = $1
        ORDER BY created_at DESC
      `;
      params = [value];
    } else if (
      ["source", "data_source", "state", "salutation"].includes(key)
    ) {
      // Direct column filter
      query = `
        ${baseSelect}
        WHERE ${key} = $1
        ORDER BY created_at DESC
      `;
      params = [value];
    } else {
      return NextResponse.json({ error: "Invalid filter key." }, { status: 400 });
    }

    const { rows } = await pool.query(query, params);
    
    // Close the specific pool for this API request
    await pool.end();

    return NextResponse.json({ users: rows });
  } catch (error: any) {
    console.error("Filter API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch filtered users.", details: error.message },
      { status: 500 }
    );
  }
}
