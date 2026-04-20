import { NextResponse } from "next/server";
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

    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });

    let query = "";
    let params: string[] = [];

    const baseSelect = `
      SELECT users.id, users.email, users.first_name, users.last_name, users.organization,
             users.source, users.state, users.salutation, users.created_at, users.job_title
      FROM users
    `;

    if (key === "industry") {
      query = `
        ${baseSelect}
        JOIN user_industries ui ON users.id = ui.user_id
        JOIN industry i ON ui.industry_id = i.id
        WHERE i.name = $1
        ORDER BY users.created_at DESC
      `;
      params = [value];
    } else if (
      ["source", "data_source", "state", "salutation"].includes(key)
    ) {
      // Direct column filter
      query = `
        ${baseSelect}
        WHERE users.${key} = $1
        ORDER BY users.created_at DESC
      `;
      params = [value];
    } else {
      return NextResponse.json({ error: "Invalid filter key." }, { status: 400 });
    }

    const { rows } = await pool.query(query, params);
    
    // Close the specific pool for this API request
    await pool.end();

    return NextResponse.json({ users: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Filter API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch filtered users.", details: message },
      { status: 500 }
    );
  }
}
