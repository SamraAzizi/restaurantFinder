import { createClient, type SupabaseClient } from "@supabase/supabase-js"

interface SupabaseConfig {
  url: string
  secretKey: string
}

function getConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secretKey) {
    throw new Error(
      "Supabase environment variables SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) must be defined",
    )
  }

  return { url, secretKey }
}

let cachedSupabase: SupabaseClient | null = null

export function getServiceRoleSupabase(): SupabaseClient {
  if (cachedSupabase) {
    return cachedSupabase
  }

  const { url, secretKey } = getConfig()
  cachedSupabase = createClient(url, secretKey, {
    auth: {
      persistSession: false,
    },
  })

  return cachedSupabase
}

export function tryGetServiceRoleSupabase(): SupabaseClient | null {
  try {
    return getServiceRoleSupabase()
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Unable to initialize Supabase client", error)
    }
    return null
  }
}