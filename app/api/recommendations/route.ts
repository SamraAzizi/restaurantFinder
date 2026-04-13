import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { buildTasteProfile, getSavedIds } from "@/lib/yelp-ai"
import { getPersonalizedPrompt, getFallbackPrompt } from "@/lib/prompts"
import type { Restaurant, TasteProfile } from "@/types/restaurant"

const YELP_AI_ENDPOINT = "https://api.yelp.com/ai/chat/v2"
const YELP_BUSINESS_ENDPOINT = "https://api.yelp.com/v3/businesses"

const MIN_FAVORITES_FOR_PERSONALIZATION = 2

const LOCATION_OVERRIDE: { latitude: number; longitude: number } | null = {
  latitude: 47.6092,
  longitude: -122.3316,
}


interface RecommendationRequest {
  restaurants: Restaurant[]
  latitude?: number
  longitude?: number
  craving?: string
}

function ensureRestaurantPayload(restaurants?: Restaurant[]): restaurants is Restaurant[] {
  return Array.isArray(restaurants) && restaurants.length > 0
}

/**
 * Sanitize user input for craving field.
 */
function sanitizeCraving(craving: string | undefined): string | undefined {
  if (!craving || craving.trim().length === 0) {
    return undefined
  }
  return craving.trim().slice(0, 50).replace(/[^\w\s,.-]/g, "")
}

/**
 * Validate and deduplicate restaurants from Yelp AI response.
 * - Removes duplicates by ID
 * - Removes restaurants without valid IDs
 * - Filters out already-saved restaurants
 */
function validateAndDedupeRestaurants(
  restaurants: Restaurant[],
  savedIds: string[]
): Restaurant[] {
  const seen = new Set<string>()
  const savedSet = new Set(savedIds)

  return restaurants.filter((r) => {
    if (!r.id || r.id.length === 0) {
      console.warn("Dropping restaurant without valid ID:", r.name)
      return false
    }

    if (seen.has(r.id)) {
      console.warn("Dropping duplicate restaurant:", r.id)
      return false
    }
    seen.add(r.id)

    if (savedSet.has(r.id)) {
      console.warn("Dropping already-saved restaurant:", r.id)
      return false
    }

    return true
  })
}

/**
 * Truncate reason/explanation text to max length at sentence boundary.
 */
function truncateReason(reason: string | null | undefined, maxLength: number = 100): string | null {
  if (!reason) return null
  if (reason.length <= maxLength) return reason

  const truncated = reason.slice(0, maxLength)
  const lastPeriod = truncated.lastIndexOf(".")
  const lastExclaim = truncated.lastIndexOf("!")
  const lastQuestion = truncated.lastIndexOf("?")
  const lastSentence = Math.max(lastPeriod, lastExclaim, lastQuestion)

  if (lastSentence > maxLength * 0.5) {
    return truncated.slice(0, lastSentence + 1)
  }

  return truncated.slice(0, maxLength - 3) + "..."
}

/**
 * Extract per-business reasons from AI text response.
 * The response.text from Yelp AI often contains our custom JSON with "why" fields.
 */
function extractReasonsFromText(text: string): Map<string, string> {
  const reasons = new Map<string, string>()
  if (!text) return reasons

  try {
    let payload = text.trim()
    const firstBracket = payload.indexOf("[")
    const lastBracket = payload.lastIndexOf("]")
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      payload = payload.slice(firstBracket, lastBracket + 1)
    }

    const parsed = JSON.parse(payload)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.id && item?.why) {
          reasons.set(String(item.id), String(item.why))
        }
      }
    }
  } catch {
    console.log("Could not parse response.text as JSON for reasons extraction")
  }

  return reasons
}

function pickContent(data: any) {
  if (typeof data?.output_text === "string") {
    return data.output_text
  }
  const firstMessage = data?.output?.message?.content ?? data?.choices?.[0]?.message?.content
  if (typeof firstMessage === "string") {
    return firstMessage
  }
  if (Array.isArray(firstMessage)) {
    return firstMessage.map((chunk: any) => chunk?.text ?? chunk?.content ?? "").join("\n")
  }
  return ""
}

function parseRestaurantsFromText(text: string): Restaurant[] {
  if (!text) return []
  let payload = text.trim()
  const firstBracket = payload.indexOf("[")
  const lastBracket = payload.lastIndexOf("]")
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    payload = payload.slice(firstBracket, lastBracket + 1)
  }

  try {
    const parsed = JSON.parse(payload)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((item) => mapAiItemToRestaurant(item)).filter((item): item is Restaurant => Boolean(item))
  } catch (error) {
    console.warn("Unable to parse Yelp AI response", error, payload)
    return []
  }
}

function mapAiItemToRestaurant(item: any): Restaurant | null {
  if (!item) return null

  const coordinates = item.coordinates || item.location?.coordinate || null
  const categories = Array.isArray(item.categories) 
    ? item.categories.map((c: any) => c?.title || c?.alias || c).filter(Boolean).join(", ")
    : null

  let address = item.address || item.address1 || null
  if (!address && item.location) {
    if (Array.isArray(item.location.display_address)) {
      address = item.location.display_address.join(", ")
    } else if (item.location.address1) {
      const parts = [item.location.address1, item.location.city, item.location.state, item.location.zip_code].filter(Boolean)
      address = parts.join(", ")
    }
  }
  
  return {
    id: String(item.id || item.alias || item.name || randomUUID()),
    name: item.name || "Unknown restaurant",
    cuisine: item.cuisine || categories || null,
    address,
    rating: typeof item.rating === "number" ? item.rating : null,
    reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : typeof item.review_count === "number" ? item.review_count : null,
    price: item.price ?? null,
    url: item.url ?? item.link ?? null,
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    distanceMeters: item.distanceMeters ?? item.distance ?? null,
    coordinates:
      coordinates && typeof coordinates.latitude === "number" && typeof coordinates.longitude === "number"
        ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
        : null,
    reason: item.why ?? null,
  }
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? ""
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }
  const last = items[items.length - 1]
  return `${items.slice(0, -1).join(", ")}, and ${last}`
}

function mostCommon<T>(items: T[]): T | null {
  if (!items.length) return null
  const counts = new Map<T, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

function buildSummaryFromRecommendations(
  restaurants: Restaurant[],
  tasteProfile: TasteProfile | null,
  savedRestaurants: Restaurant[],
): string | null {
  if (!restaurants.length) return null

  const cuisineSummary = tasteProfile?.cuisines?.length
    ? tasteProfile.cuisines.slice(0, 3).map((cuisine) => cuisine.charAt(0).toUpperCase() + cuisine.slice(1))
    : []

  const savedNames = savedRestaurants
    .map((restaurant) => restaurant.name?.trim())
    .filter((name): name is string => Boolean(name))

  const savedReasons = savedRestaurants
    .map((restaurant) => (restaurant.reason ? truncateReason(restaurant.reason, 80) : null))
    .filter((reason): reason is string => Boolean(reason))

  const pricePreferences = savedRestaurants
    .map((restaurant) => restaurant.price)
    .filter((price): price is string => Boolean(price))

  const ratingPreferences = savedRestaurants
    .map((restaurant) => (typeof restaurant.rating === "number" ? restaurant.rating : null))
    .filter((rating): rating is number => rating !== null)

  const summaryParts: string[] = []

  if (savedNames.length && cuisineSummary.length) {
    summaryParts.push(
      `Since you've saved ${formatList(savedNames.slice(0, 2))}, we stuck with the ${formatList(cuisineSummary)} flavors you already love.`,
    )
  } else if (savedNames.length) {
    summaryParts.push(`Because you've saved ${formatList(savedNames.slice(0, 2))}, we searched for spots with similar vibes.`)
  } else if (cuisineSummary.length) {
    summaryParts.push(`We leaned into ${formatList(cuisineSummary)}-leaning spots from your favorites.`)
  } else {
    summaryParts.push(`These picks build on the flavor profile of your saved restaurants.`)
  }

  const priceSummary = mostCommon(pricePreferences)
  if (priceSummary) {
    summaryParts.push(`Most recommendations stay around the ${priceSummary} price range to match your go-tos.`)
  }

  if (ratingPreferences.length) {
    const avgRating = ratingPreferences.reduce((sum, rating) => sum + rating, 0) / ratingPreferences.length
    summaryParts.push(`Expect roughly ${avgRating.toFixed(1)}★ experiences similar to your saved picks.`)
  }

  if (savedReasons.length) {
    summaryParts.push(`We also kept in mind that you noted "${savedReasons[0]}" when choosing these.`)
  }

  return summaryParts.join(" ")
}

async function enrichRestaurantsWithBusinessData(
  restaurants: Restaurant[],
  apiKey?: string,
): Promise<Restaurant[]> {
  if (!apiKey || restaurants.length === 0) {
    return restaurants
  }

  const enriched = await Promise.all(
    restaurants.map(async (restaurant) => {
      if (!restaurant.id) return restaurant
      try {
        const response = await fetch(`${YELP_BUSINESS_ENDPOINT}/${restaurant.id}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        })

        if (!response.ok) {
          return restaurant
        }

        const data = await response.json()
        const addressFromLocation = Array.isArray(data?.location?.display_address)
          ? data.location.display_address.join(", ")
          : data?.location?.address1
            ? [
                data.location.address1,
                data.location.city,
                data.location.state,
                data.location.zip_code,
              ].filter(Boolean).join(", ")
            : null

        const categories = Array.isArray(data?.categories)
          ? data.categories.map((category: any) => category?.title).filter(Boolean).join(", ")
          : null

        return {
          ...restaurant,
          name: restaurant.name || data?.name || restaurant.name,
          cuisine: restaurant.cuisine || categories || null,
          address: restaurant.address || addressFromLocation || null,
          rating: restaurant.rating ?? (typeof data?.rating === "number" ? data.rating : null),
          reviewCount: restaurant.reviewCount ?? (typeof data?.review_count === "number" ? data.review_count : null),
          price: restaurant.price ?? data?.price ?? null,
          url: restaurant.url ?? data?.url ?? null,
          imageUrl:
            restaurant.imageUrl ?? data?.image_url ?? (Array.isArray(data?.photos) ? data.photos[0] : null) ?? null,
          coordinates:
            restaurant.coordinates ||
            (data?.coordinates?.latitude && data?.coordinates?.longitude
              ? {
                  latitude: data.coordinates.latitude,
                  longitude: data.coordinates.longitude,
                }
              : null),
        }
      } catch (error) {
        console.warn(`Failed to enrich Yelp business ${restaurant.id}`, error)
        return restaurant
      }
    }),
  )

  return enriched
}

export async function POST(request: Request) {
  const aiApiKey = process.env.YELP_AI_API_KEY ?? process.env.YELP_API_KEY
  const businessApiKey = process.env.YELP_API_KEY
  if (!aiApiKey) {
    return NextResponse.json({ error: "Yelp AI API key is not configured." }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as RecommendationRequest | null

  if (!body || !ensureRestaurantPayload(body.restaurants)) {
    return NextResponse.json(
      { error: "Provide at least one saved restaurant before requesting AI recommendations." },
      { status: 400 },
    )
  }

  const tasteProfile = buildTasteProfile(body.restaurants)
  const savedIds = getSavedIds(body.restaurants)
  const savedNames = body.restaurants.map((r) => r.name).filter(Boolean)

  const resolvedLatitude = LOCATION_OVERRIDE?.latitude ?? body.latitude
  const resolvedLongitude = LOCATION_OVERRIDE?.longitude ?? body.longitude

  const usePersonalization = tasteProfile && body.restaurants.length >= MIN_FAVORITES_FOR_PERSONALIZATION

  let query: string
  if (usePersonalization) {
    const sanitizedCraving = sanitizeCraving(body.craving)
    query = getPersonalizedPrompt(tasteProfile.cuisines, savedNames, sanitizedCraving)
  } else {
    query = getFallbackPrompt(resolvedLatitude, resolvedLongitude)
  }

  const payload: Record<string, unknown> = { query }

  if (typeof resolvedLatitude === "number" && typeof resolvedLongitude === "number") {
    payload.user_context = {
      latitude: Number(resolvedLatitude.toFixed(4)),
      longitude: Number(resolvedLongitude.toFixed(4)),
    }
  }

  console.log("=== Yelp AI Request ===")
  console.log("Saved restaurants count:", body.restaurants.length)
  console.log("Personalized:", usePersonalization)
  console.log("Taste profile:", tasteProfile)
  console.log("Query:", payload.query)
  if (payload.user_context) {
    console.log("User context:", payload.user_context)
  }

  try {
    const response = await fetch(YELP_AI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    console.log("=== Yelp AI Response ===")
    console.log("Status:", response.status)
    console.log("Data:", JSON.stringify(data, null, 2))

    if (!response.ok) {
      const message = data?.error?.description || data?.error || "Yelp AI request failed."
      return NextResponse.json({ error: message }, { status: response.status })
    }

    let rawRestaurants: Restaurant[] = []
    let explanation = ""

    if (Array.isArray(data?.entities)) {
      const businessEntity = data.entities.find((e: any) => Array.isArray(e?.businesses))
      if (businessEntity?.businesses) {
        rawRestaurants = businessEntity.businesses
          .map((item: any) => mapAiItemToRestaurant(item))
          .filter((item: Restaurant | null): item is Restaurant => Boolean(item))
      }
    }

    if (rawRestaurants.length === 0 && Array.isArray(data?.businesses)) {
      rawRestaurants = data.businesses
        .map((item: any) => mapAiItemToRestaurant(item))
        .filter((item: Restaurant | null): item is Restaurant => Boolean(item))
    }

    if (typeof data?.response?.text === "string") {
      explanation = data.response.text
    } else if (typeof data?.text === "string") {
      explanation = data.text
    } else if (typeof data?.message === "string") {
      explanation = data.message
    } else {
      const outputText = pickContent(data)
      if (!rawRestaurants.length) {
        rawRestaurants = parseRestaurantsFromText(outputText)
      }
      explanation = outputText
    }

    const parsedReasons = extractReasonsFromText(explanation)
    console.log("=== Parsed Reasons ===")
    console.log("Extracted reasons:", Object.fromEntries(parsedReasons))

    let restaurants: Restaurant[] = validateAndDedupeRestaurants(rawRestaurants, savedIds).map((r) => ({
      ...r,
      reason: r.reason || parsedReasons.get(r.id) || null,
    }))

    if (businessApiKey) {
      restaurants = await enrichRestaurantsWithBusinessData(restaurants, businessApiKey)
    }

    console.log("=== Validation ===")
    console.log("Raw count:", rawRestaurants.length)
    console.log("After validation:", restaurants.length)

    const debugData = process.env.NODE_ENV === "development" ? { rawResponse: data } : {}

    if (restaurants.length === 0) {
      return NextResponse.json({ restaurants: [], explanation, ...debugData })
    }

    const naturalSummary = buildSummaryFromRecommendations(restaurants, tasteProfile ?? null, body.restaurants)
    return NextResponse.json({ restaurants, explanation: naturalSummary || explanation, ...debugData })
  } catch (error) {
    console.error("Failed to fetch Yelp AI recommendations", error)
    return NextResponse.json(
      { 
        error: "Unable to reach Yelp AI at the moment.",
        restaurants: [],
        explanation: "We're having trouble connecting to our recommendation service. Please try again later."
      },
      { status: 502 }
    )
  }
}