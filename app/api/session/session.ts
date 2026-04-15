import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { buildSessionCookie, buildSessionRemovalCookie, getSession } from "@/lib/session"
import type { LiteSession } from "@/types/session"

export async function GET() {
  const session = await getSession()
  return NextResponse.json({ session: session ?? null })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string }
    const name = body?.name?.trim()

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Please provide a name with at least 2 characters." }, { status: 400 })
    }

    const session: LiteSession = {
      id: randomUUID(),
      name,
    }

    const response = NextResponse.json({ session }, { status: 201 })
    const cookie = buildSessionCookie(session)
    response.cookies.set(cookie.name, cookie.value, cookie.options)
    return response
  } catch (error) {
    console.error("Failed to create session", error)
    return NextResponse.json({ error: "Unable to create session." }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  const cookie = buildSessionRemovalCookie()
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}