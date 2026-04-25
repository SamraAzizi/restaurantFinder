import type { Restaurant, TasteProfile } from "@/types/restaurant"

const MAX_CUISINES = 7

/**
 * Extract cuisine categories from a restaurant's cuisine string.
 * Splits on commas and normalizes to lowercase aliases.
 */
function extractCuisines(cuisine: string | null | undefined): string[] {
  if (!cuisine) return []
  return cuisine
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0 && c.length < 30) // Filter out empty or overly long strings
}

/**
 * Count frequency of items and return top N most common.
 */
function topN<T>(items: T[], n: number): T[] {
  const counts = new Map<T, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item)
}

/**
 * Build a minimal taste profile from saved restaurants.
 * Extracts the top 5-7 most frequent cuisines to understand the user's palate.
 */
export function buildTasteProfile(restaurants: Restaurant[]): TasteProfile | null {
  if (!restaurants || restaurants.length === 0) {
    return null
  }

  // Extract all cuisines from favorites
  const allCuisines = restaurants.flatMap((r) => extractCuisines(r.cuisine))
  const topCuisines = topN(allCuisines, MAX_CUISINES)

  return {
    cuisines: topCuisines,
  }
}

/**
 * Format cuisines as a natural language list.
 * Examples: "Thai", "Thai and Italian", "Thai, Italian, and Mexican"
 */
export function formatCuisinesNaturally(cuisines: string[]): string {
  if (cuisines.length === 0) return ""
  if (cuisines.length === 1) return cuisines[0]
  if (cuisines.length === 2) return `${cuisines[0]} and ${cuisines[1]}`
  
  const last = cuisines[cuisines.length - 1]
  const rest = cuisines.slice(0, -1).join(", ")
  return `${rest}, and ${last}`
}

/**
 * Get list of saved restaurant IDs for exclusion.
 */
export function getSavedIds(restaurants: Restaurant[]): string[] {
  return restaurants.map((r) => r.id).filter((id) => id && id.length > 0)
}