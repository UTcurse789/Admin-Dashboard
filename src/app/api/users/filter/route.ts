import { NextResponse, type NextRequest } from "next/server";
import { isDbUnavailableError, runDbQuery } from "@/lib/db";

export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function parseNumberParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const key = searchParams.get("key");
    const value = searchParams.get("value");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseNumberParam(searchParams.get("limit"), DEFAULT_LIMIT))
    );
    const offset = Math.max(0, parseNumberParam(searchParams.get("offset"), 0));

    if (!key || !value) {
      return NextResponse.json(
        { error: "Missing key or value standard parameters." },
        { status: 400 }
      );
    }

    let query = "";
    let params: Array<string | number> = [];

    const baseSelect = `
      SELECT users.id, users.email, users.first_name, users.last_name, users.organization,
             users.source, users.data_source, users.state, users.salutation,
             users.created_at, users.job_title
      FROM users
    `;

    if (key === "industry") {
      query = `
        ${baseSelect}
        JOIN user_industries ui ON users.id = ui.user_id
        JOIN industry i ON ui.industry_id = i.id
        WHERE i.name = $1
        ORDER BY users.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [value, limit, offset];
    } else if (key === "kpi") {
      if (value === "total-users" || value === "registered") {
        query = `
          ${baseSelect}
          ORDER BY users.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      } else if (value === "new-this-month") {
        query = `
          ${baseSelect}
          WHERE date_trunc('month', users.created_at) = date_trunc('month', CURRENT_DATE)
          ORDER BY users.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      } else if (value === "prev-month") {
        query = `
          ${baseSelect}
          WHERE date_trunc('month', users.created_at) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
          ORDER BY users.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      } else if (value === "active-7-days") {
        query = `
          ${baseSelect}
          WHERE COALESCE(users.updated_at, users.created_at) >= NOW() - INTERVAL '7 days'
          ORDER BY COALESCE(users.updated_at, users.created_at) DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      } else {
        return NextResponse.json({ error: "Invalid KPI value." }, { status: 400 });
      }
    } else if (
      ["source", "data_source", "state", "salutation"].includes(key)
    ) {
      // Direct column filter
      query = `
        ${baseSelect}
        WHERE users.${key} = $1
        ORDER BY users.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [value, limit, offset];
    } else {
      return NextResponse.json({ error: "Invalid filter key." }, { status: 400 });
    }

    const { rows } = await runDbQuery(query, params, "users.filter");

    return NextResponse.json({ users: rows, limit, offset });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return NextResponse.json(
        { error: "Database is temporarily unavailable." },
        { status: 503 }
      );
    }

    console.error("Filter API Error:", {
      error,
      url: req.url,
    });
    return NextResponse.json(
      { error: "Failed to fetch filtered users." },
      { status: 500 }
    );
  }
}
