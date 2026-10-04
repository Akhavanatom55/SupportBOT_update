import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

const encoder = new TextEncoder();
const secretKey = encoder.encode(env.sessionSecret);

export const SESSION_COOKIE_NAME = "sb_admin_session";

export type SessionPayload = {
  sub: string;
  username: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.sub === "string" && typeof payload.username === "string") {
      return { sub: payload.sub, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}
