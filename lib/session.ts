import { cookies } from "next/headers"

import type { LiteSession } from "@/types/session"

export const SESSION_COOKIE_NAME = "rf-lite-session"
const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

export function normalizeSessionName(name: string) {
  return name.trim().toLowerCase()
}

export function parseSessionCookie(value?: string | null): LiteSession | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as LiteSession
    if (parsed?.id && parsed?.name) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

export async function getSession(): Promise<LiteSession | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE_NAME)?.value
  return parseSessionCookie(raw)
}

export function buildSessionCookie(session: LiteSession) {
  return {
    name: SESSION_COOKIE_NAME,
    value: JSON.stringify(session),
    options: {
      ...BASE_COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30,
    },
  }
}

export function buildSessionRemovalCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    options: {
      ...BASE_COOKIE_OPTIONS,
      maxAge: 0,
    },
  }
}