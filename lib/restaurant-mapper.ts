import type { Restaurant } from "@/types/restaurant"

export interface SupabaseRestaurantRow {
  id: string
  user_id: string
  user_display_name: string | null
  name: string
  cuisine: string | null
  address: string | null
  rating: number | null
  review_count: number | null
  price: string | null
  url: string | null
  image_url: string | null
  distance_meters: number | null
  latitude: number | null
  longitude: number | null
  created_at?: string
}

export type SupabaseRestaurantInsertRow = Omit<SupabaseRestaurantRow, "created_at">

export function mapRowToRestaurant(row: SupabaseRestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    address: row.address,
    rating: row.rating,
    reviewCount: row.review_count,
    price: row.price,
    url: row.url,
    imageUrl: row.image_url,
    distanceMeters: row.distance_meters,
    coordinates:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
  }
}

export function mapRestaurantToRow(
  restaurant: Restaurant,
  userId: string,
  userDisplayName: string,
): SupabaseRestaurantInsertRow {
  return {
    id: restaurant.id,
    user_id: userId,
    user_display_name: userDisplayName || null,
    name: restaurant.name,
    cuisine: restaurant.cuisine ?? null,
    address: restaurant.address ?? null,
    rating: restaurant.rating ?? null,
    review_count: restaurant.reviewCount ?? null,
    price: restaurant.price ?? null,
    url: restaurant.url ?? null,
    image_url: restaurant.imageUrl ?? null,
    distance_meters: restaurant.distanceMeters ?? null,
    latitude: restaurant.coordinates?.latitude ?? null,
    longitude: restaurant.coordinates?.longitude ?? null,
  }
}

export function mapRestaurantToPartialRow(restaurant: Partial<Restaurant>): Partial<SupabaseRestaurantRow> {
  const partial: Partial<SupabaseRestaurantRow> = {}
  if (restaurant.name !== undefined) {
    partial.name = restaurant.name
  }
  if (restaurant.cuisine !== undefined) {
    partial.cuisine = restaurant.cuisine ?? null
  }
  if (restaurant.address !== undefined) {
    partial.address = restaurant.address ?? null
  }
  if (restaurant.rating !== undefined) {
    partial.rating = restaurant.rating ?? null
  }
  if (restaurant.reviewCount !== undefined) {
    partial.review_count = restaurant.reviewCount ?? null
  }
  if (restaurant.price !== undefined) {
    partial.price = restaurant.price ?? null
  }
  if (restaurant.url !== undefined) {
    partial.url = restaurant.url ?? null
  }
  if (restaurant.imageUrl !== undefined) {
    partial.image_url = restaurant.imageUrl ?? null
  }
  if (restaurant.distanceMeters !== undefined) {
    partial.distance_meters = restaurant.distanceMeters ?? null
  }

  if (restaurant.coordinates !== undefined) {
    partial.latitude = restaurant.coordinates?.latitude ?? null
    partial.longitude = restaurant.coordinates?.longitude ?? null
  }

  return partial
}