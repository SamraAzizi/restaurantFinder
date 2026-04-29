export interface Restaurant {
  id: string
  name: string
  cuisine?: string | null
  address?: string | null
  rating?: number | null
  reviewCount?: number | null
  price?: string | null
  url?: string | null
  imageUrl?: string | null
  distanceMeters?: number | null
  coordinates?: {
    latitude: number
    longitude: number
  } | null
  reason?: string | null
}

export interface TasteProfile {
  cuisines: string[]  // Top 5-7 cuisine types (most frequent)
}