import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_COOKIE = "admin_session";
const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "energdive-admin-secret-key-change-me"
);

/**
 * Create a signed JWT session token.
 */
export async function createSession(email: string): Promise<string> {
  return new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

/**
 * Verify a JWT session token.
 */
export async function verifySession(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/**
 * Check if the current request has a valid admin session.
 * Works in Server Components via cookies().
 */
export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Check if the current request has a valid admin session.
 * Works in middleware via NextRequest.
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<{ email: string } | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Validate admin credentials against env vars.
 */
export function validateCredentials(
  email: string,
  password: string
): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("ADMIN_EMAIL or ADMIN_PASSWORD not set in env vars");
    return false;
  }

  return email === adminEmail && password === adminPassword;
}

export { SESSION_COOKIE };
