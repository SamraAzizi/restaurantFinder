import { NextResponse } from "next/server"

import { tryGetServiceRoleSupabase } from "@/lib/supabase"
import { getSession, normalizeSessionName } from "@/lib/session"
import {
  mapRestaurantToPartialRow,
  mapRestaurantToRow,
  mapRowToRestaurant,
  type SupabaseRestaurantRow,
} from "@/lib/restaurant-mapper"
import type { Restaurant } from "@/types/restaurant"
import type { LiteSession } from "@/types/session"

function supabaseUnavailableResponse(action: string) {
  return NextResponse.json(
    {
      error: `Unable to reach Supabase while ${action}. Check your SUPABASE_URL and secret key then try again.`,
    },
    { status: 502 },
  )
}

function escapeForILike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: "Supabase is not configured. Set SUPABASE_URL + SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) and restart the dev server.",
    },
    { status: 500 },
  )
}

async function requireSession(): Promise<{ session: LiteSession; scope: string; displayName: string } | { error: NextResponse }> {
  const session = await getSession()

  if (!session) {
    return { error: NextResponse.json({ error: "Please log in before managing saved restaurants." }, { status: 401 }) }
  }

  const scope = normalizeSessionName(session.name)
  return { session, scope, displayName: session.name.trim() }
}

export async function GET() {
  const sessionResult = await requireSession()
  if ("error" in sessionResult) {
    return sessionResult.error
  }

  const supabase = tryGetServiceRoleSupabase()
  if (!supabase) {
    return supabaseNotConfiguredResponse()
  }

  try {
    const displayNamePattern = escapeForILike(sessionResult.displayName)
    const { data: scopedData, error: scopedError, status } = await supabase
      .from<SupabaseRestaurantRow>("saved_restaurants")
      .select("*")
      .eq("user_id", sessionResult.scope)
      .order("created_at", { ascending: false })

    if (scopedError) {
      return NextResponse.json(
        { error: scopedError.message || "Unable to fetch saved restaurants." },
        { status: status || 500 },
      )
    }

    const rows = [...(scopedData || [])]
    const seenIds = new Set(rows.map((row) => row.id))
    const legacyToMigrate = new Set<string>()
    const legacyToDelete = new Set<string>()

    const { data: legacyData, error: legacyError } = await supabase
      .from<SupabaseRestaurantRow>("saved_restaurants")
      .select("*")
      .ilike("user_display_name", displayNamePattern)
      .neq("user_id", sessionResult.scope)
      .order("created_at", { ascending: false })

    if (!legacyError && legacyData?.length) {
      for (const row of legacyData) {
        if (!row.id) continue
        if (seenIds.has(row.id)) {
          legacyToDelete.add(row.id)
          continue
        }
        rows.push(row)
        seenIds.add(row.id)
        legacyToMigrate.add(row.id)
      }
    } else if (legacyError && legacyError.code !== "PGRST116") {
      console.warn("Failed to load legacy saved restaurants", legacyError)
    }

    const sortByCreatedAt = (a: SupabaseRestaurantRow, b: SupabaseRestaurantRow) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0
      const bTime = b.created_at ? Date.parse(b.created_at) : 0
      return bTime - aTime
    }

    rows.sort(sortByCreatedAt)

    const migrateIds = Array.from(legacyToMigrate)
    if (migrateIds.length > 0) {
      const { error: migrateError } = await supabase
        .from("saved_restaurants")
        .update({ user_id: sessionResult.scope })
        .in("id", migrateIds)
        .ilike("user_display_name", displayNamePattern)
        .neq("user_id", sessionResult.scope)

      if (migrateError) {
        console.warn("Failed to migrate legacy saved restaurants", migrateError)
      }
    }

    const cleanupIds = Array.from(legacyToDelete)
    if (cleanupIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from("saved_restaurants")
        .delete()
        .in("id", cleanupIds)
        .ilike("user_display_name", displayNamePattern)
        .neq("user_id", sessionResult.scope)

      if (cleanupError) {
        console.warn("Failed to clean up duplicate legacy restaurants", cleanupError)
      }
    }

    const restaurants = rows.map(mapRowToRestaurant)
    return NextResponse.json({ restaurants })
  } catch (error) {
    console.error("Failed to load saved restaurants", error)
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      return supabaseUnavailableResponse("loading saved restaurants")
    }
    return NextResponse.json({ error: "Unexpected error loading saved restaurants." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const sessionResult = await requireSession()
  if ("error" in sessionResult) {
    return sessionResult.error
  }

  const supabase = tryGetServiceRoleSupabase()
  if (!supabase) {
    return supabaseNotConfiguredResponse()
  }

  try {
    const body = (await request.json()) as Restaurant

    if (!body?.id || !body?.name) {
      return NextResponse.json({ error: "Restaurant id and name are required." }, { status: 400 })
    }

    const row = mapRestaurantToRow(body, sessionResult.scope, sessionResult.session.name)
    const { data, error, status } = await supabase
      .from<SupabaseRestaurantRow>("saved_restaurants")
      .upsert(row, { onConflict: "id,user_id" })
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to save restaurant." }, { status: status || 500 })
    }

    return NextResponse.json({ restaurant: mapRowToRestaurant(data) }, { status: 201 })
  } catch (error) {
    console.error("Failed to save restaurant", error)
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      return supabaseUnavailableResponse("saving restaurants")
    }
    return NextResponse.json({ error: "Unexpected error saving restaurant." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const sessionResult = await requireSession()
  if ("error" in sessionResult) {
    return sessionResult.error
  }

  const supabase = tryGetServiceRoleSupabase()
  if (!supabase) {
    return supabaseNotConfiguredResponse()
  }

  try {
    const displayNamePattern = escapeForILike(sessionResult.displayName)
    const body = (await request.json()) as Partial<Restaurant>

    if (!body?.id) {
      return NextResponse.json({ error: "Restaurant id is required." }, { status: 400 })
    }

    const payload = mapRestaurantToPartialRow(body)

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 })
    }

    const { data, error, status } = await supabase
      .from<SupabaseRestaurantRow>("saved_restaurants")
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", sessionResult.scope)
      .select()
      .single()

    if (error || !data) {
      const isMissing = error?.code === "PGRST116"
      if (isMissing) {
        const { data: legacyData, error: legacyError, status: legacyStatus } = await supabase
          .from<SupabaseRestaurantRow>("saved_restaurants")
          .update(payload)
          .eq("id", body.id)
          .ilike("user_display_name", displayNamePattern)
          .neq("user_id", sessionResult.scope)
          .select()
          .single()

        if (!legacyError && legacyData) {
          return NextResponse.json({ restaurant: mapRowToRestaurant(legacyData) })
        }

        const legacyMissing = legacyError?.code === "PGRST116"
        return NextResponse.json(
          { error: legacyError?.message || "Unable to update restaurant." },
          { status: legacyMissing ? 404 : legacyStatus || 500 },
        )
      }

      return NextResponse.json(
        { error: error?.message || "Unable to update restaurant." },
        { status: status || 500 },
      )
    }

    return NextResponse.json({ restaurant: mapRowToRestaurant(data) })
  } catch (error) {
    console.error("Failed to update restaurant", error)
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      return supabaseUnavailableResponse("updating restaurants")
    }
    return NextResponse.json({ error: "Unexpected error updating restaurant." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const sessionResult = await requireSession()
  if ("error" in sessionResult) {
    return sessionResult.error
  }

  const supabase = tryGetServiceRoleSupabase()
  if (!supabase) {
    return supabaseNotConfiguredResponse()
  }

  try {
    const displayNamePattern = escapeForILike(sessionResult.displayName)
    const body = (await request.json().catch(() => null)) as { id?: string } | null

    if (!body?.id) {
      return NextResponse.json({ error: "Restaurant id is required." }, { status: 400 })
    }

    const { data: removedRows, error, status } = await supabase
      .from("saved_restaurants")
      .delete()
      .eq("id", body.id)
      .eq("user_id", sessionResult.scope)
      .select("id")

    if (error) {
      return NextResponse.json({ error: error.message || "Unable to delete restaurant." }, { status: status || 500 })
    }

    const { data: legacyRows, error: legacyError, status: legacyStatus } = await supabase
      .from("saved_restaurants")
      .delete()
      .eq("id", body.id)
      .ilike("user_display_name", displayNamePattern)
      .neq("user_id", sessionResult.scope)
      .select("id")

    if (legacyError) {
      return NextResponse.json(
        { error: legacyError.message || "Unable to delete restaurant." },
        { status: legacyStatus || 500 },
      )
    }

    if ((!removedRows || removedRows.length === 0) && (!legacyRows || legacyRows.length === 0)) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete restaurant", error)
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      return supabaseUnavailableResponse("deleting restaurants")
    }
    return NextResponse.json({ error: "Unexpected error deleting restaurant." }, { status: 500 })
  }
}