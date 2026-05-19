import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
export async function GET() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    return NextResponse.json(res.rows.map(r => r.table_name));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
