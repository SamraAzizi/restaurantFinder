#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js"

function exitWith(message) {
  console.error(message)
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseSecret) {
  exitWith("Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before running this script.")
}

const args = process.argv.slice(2)

if (args.length === 0) {
  exitWith("Usage: pnpm check:saved <display-name> | pnpm check:saved --id <user-scope> | pnpm check:saved --name <exact-display-name>")
}

const normalizeName = (value) => value.trim().toLowerCase()

let userScope = null
let displayName = null
let matchDisplayColumn = false

if (args[0] === "--id") {
  userScope = args[1]
  if (!userScope) {
    exitWith("Provide a user scope after --id")
  }
} else if (args[0] === "--name") {
  displayName = args[1]
  if (!displayName) {
    exitWith("Provide a display name after --name")
  }
  matchDisplayColumn = true
} else {
  displayName = args[0]
}

if (!userScope && displayName) {
  userScope = normalizeName(displayName)
}

const client = createClient(supabaseUrl, supabaseSecret, { auth: { persistSession: false } })

async function main() {
  const builder = client.from("saved_restaurants").select("*").order("created_at", { ascending: false })

  if (matchDisplayColumn) {
    builder.eq("user_display_name", displayName)
  } else {
    builder.eq("user_id", userScope)
  }

  const { data, error } = await builder

  if (error) {
    exitWith(`Supabase query failed: ${error.message}`)
  }

  if (!data || data.length === 0) {
    if (matchDisplayColumn) {
      console.log(`No restaurants found for nickname "${displayName}"`)
    } else {
      console.log(`No restaurants found for scope ${userScope}`)
    }
    return
  }

  if (matchDisplayColumn) {
    const uniqueSessions = new Set(data.map((row) => row.user_id)).size
    console.log(`Found ${data.length} restaurants across ${uniqueSessions} session(s) for nickname "${displayName}":`)
  } else {
    console.log(`Found ${data.length} restaurants for scope ${userScope}:`)
  }
  console.table(
    data.map((row) => ({
      id: row.id,
      name: row.name,
      cuisine: row.cuisine,
      created_at: row.created_at,
    })),
  )
}

main().catch((error) => {
  exitWith(`Unexpected error: ${error.message}`)
})