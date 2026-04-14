import { NextResponse } from "next/server"

const YELP_API_URL = "https://api.yelp.com/v3/businesses/search"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const term = searchParams.get("term")?.trim()
  const location = searchParams.get("location")?.trim()
  const latitudeParam = searchParams.get("latitude")?.trim()
  const longitudeParam = searchParams.get("longitude")?.trim()

  if (!term || term.length < 2) {
    return NextResponse.json({ error: "A search term with at least 2 characters is required." }, { status: 400 })
  }

  const hasLatLng = latitudeParam && longitudeParam
  if (!location && !hasLatLng) {
    return NextResponse.json(
      { error: "Provide a location (city/ZIP) or both latitude and longitude." },
      { status: 400 },
    )
  }

  let latitude: number | undefined
  let longitude: number | undefined
  if (hasLatLng) {
    latitude = Number(latitudeParam)
    longitude = Number(longitudeParam)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json({ error: "Latitude and longitude must be numeric." }, { status: 400 })
    }
  }

  const apiKey = process.env.YELP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "YELP_API_KEY is not configured on the server." }, { status: 500 })
  }

  const params = new URLSearchParams({ term, limit: "20" })
  if (location) {
    params.set("location", location)
  } else if (latitude !== undefined && longitude !== undefined) {
    params.set("latitude", latitude.toString())
    params.set("longitude", longitude.toString())
  }

  try {
    const response = await fetch(`${YELP_API_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    })

    const payload = await response.json()

    if (!response.ok) {
      const message = payload?.error?.description || "Failed to fetch restaurants from Yelp."
      return NextResponse.json({ error: message }, { status: response.status })
    }

    const restaurants = (payload.businesses || []).map((business: any) => ({
      id: business.id,
      name: business.name,
      cuisine: business.categories?.map((category: any) => category.title).filter(Boolean).join(", "),
      address: business.location?.display_address?.join(", "),
      rating: business.rating,
      reviewCount: business.review_count,
      price: business.price,
      url: business.url,
      imageUrl: business.image_url,
      distanceMeters: business.distance,
      coordinates: business.coordinates,
    }))

    return NextResponse.json({ restaurants })
  } catch (error) {
    console.error("Yelp search failed", error)
    return NextResponse.json({ error: "Unable to reach Yelp at the moment." }, { status: 502 })
  }
}