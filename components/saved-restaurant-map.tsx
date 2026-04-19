"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Restaurant } from "@/types/restaurant"

const Map = dynamic(async () => (await import("pigeon-maps")).Map, { ssr: false })
const Marker = dynamic(async () => (await import("pigeon-maps")).Marker, { ssr: false })

interface SavedRestaurantsMapProps {
  restaurants: Restaurant[]
}

function getCenter(restaurants: Restaurant[]) {
  const points = restaurants
    .map((restaurant) => restaurant.coordinates)
    .filter((coords): coords is { latitude: number; longitude: number } => Boolean(coords))

  if (points.length === 0) {
    return { latitude: 37.7749, longitude: -122.4194 } // default to SF as placeholder
  }

  const sums = points.reduce(
    (acc, coords) => {
      return { latitude: acc.latitude + coords.latitude, longitude: acc.longitude + coords.longitude }
    },
    { latitude: 0, longitude: 0 },
  )

  return { latitude: sums.latitude / points.length, longitude: sums.longitude / points.length }
}

export default function SavedRestaurantsMap({ restaurants }: SavedRestaurantsMapProps) {
  const restaurantsWithCoords = useMemo(
    () => restaurants.filter((restaurant) => Boolean(restaurant.coordinates)),
    [restaurants],
  )
  const [isExpanded, setIsExpanded] = useState(false)

  if (restaurantsWithCoords.length === 0) {
    return null
  }

  const center = getCenter(restaurantsWithCoords)

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 p-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Saved Restaurants Map</h3>
            <p className="text-xs text-muted-foreground">
              Drag or zoom the map to inspect where your saved restaurants are located.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setIsExpanded((prev) => !prev)}>
            {isExpanded ? "Hide map" : "Show map"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
          </Button>
        </div>
        {isExpanded ? (
          <div className="h-[360px] w-full">
            <Map defaultCenter={[center.latitude, center.longitude]} defaultZoom={12} minZoom={2} metaWheelZoom>
              {restaurantsWithCoords.map((restaurant) => (
                <Marker
                  key={restaurant.id}
                  anchor={[restaurant.coordinates!.latitude, restaurant.coordinates!.longitude]}
                  width={40}
                >
                  <div className="rounded-full bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground shadow">
                    {restaurant.name}
                  </div>
                </Marker>
              ))}
            </Map>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}