"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { Plus, Check, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingGlobal } from "@/components/loading-global"
import type { Restaurant } from "@/types/restaurant"

interface NearbyRestaurantsProps {
  latitude: number
  longitude: number
  onAddRestaurant: (restaurant: Restaurant) => Promise<void>
  savedRestaurantIds: string[]
  referenceRestaurants: Restaurant[]
  savingId?: string | null
  onLoadComplete?: () => void
}

export default function NearbyRestaurants({
  latitude,
  longitude,
  onAddRestaurant,
  savedRestaurantIds,
  referenceRestaurants,
  savingId,
  onLoadComplete,
}: NearbyRestaurantsProps) {
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [localSavingId, setLocalSavingId] = useState<string | null>(null)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const favoritesKey = referenceRestaurants
    .map((restaurant) => restaurant.id)
    .sort()
    .join(",")

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setActionError(null)
    setAiExplanation(null)

    const fetchNearby = async () => {
      if (referenceRestaurants.length === 0) {
        setError("Save at least one restaurant to get AI-powered recommendations.")
        setNearbyRestaurants([])
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/recommendations`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            restaurants: referenceRestaurants,
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || "Unable to fetch recommendations.")
        }

        const body = await response.json()
        const results = (body.restaurants || []).filter((restaurant: Restaurant) => {
          if (typeof restaurant.reason !== "string") {
            return false
          }
          const trimmed = restaurant.reason.trim()
          if (trimmed.length === 0) {
            return false
          }
          restaurant.reason = trimmed
          return true
        })
        setNearbyRestaurants(results)
        setActionError(null)
        setAiExplanation(body.explanation || null)
        if (results.length > 0) {
          onLoadComplete?.()
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setError((err as Error).message)
        setNearbyRestaurants([])
        setAiExplanation(null)
        onLoadComplete?.()
      } finally {
        setIsLoading(false)
      }
    }

    fetchNearby()

    return () => {
      controller.abort()
    }
  }, [latitude, longitude, favoritesKey])

  if (isLoading) {
    return (
      <div className="rounded-[6px] bg-card neo-border-3 neo-shadow">
        <LoadingGlobal message="Finding restaurants near you..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-6 text-center text-sm font-bold text-destructive">
        {error}
      </div>
    )
  }

  // small bug where loading doesn't show by default. need to look into it.
  if (nearbyRestaurants.length === 0) {
    return (
      <div>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3 font-bold">
        <p className="flex items-center gap-1.5">
          <span>Found</span>
          <span className="inline-flex items-center justify-center rounded-[6px] bg-foreground px-1.5 py-0.5 text-sm text-background neo-border">
            {nearbyRestaurants.length}
          </span>
          <span>restaurants near your location</span>
        </p>
      </div>
      {aiExplanation && (
        <div className="mb-4 rounded-[6px] border-2 border-dashed border-border bg-neo-yellow/40 p-4">
          <p className="text-sm font-black uppercase tracking-wide">AI Summary</p>
          <p className="text-sm font-medium text-foreground/80 whitespace-pre-line">{aiExplanation}</p>
        </div>
      )}
      {actionError && (
        <p className="mb-3 rounded-[6px] bg-destructive/10 p-3 text-sm font-bold text-destructive neo-border">
          {actionError}
        </p>
      )}
      <div className="space-y-3">
        {nearbyRestaurants.map((restaurant) => {
            const isSaved = savedRestaurantIds.includes(restaurant.id)
            const isSaving = localSavingId === restaurant.id || savingId === restaurant.id
            const miles = restaurant.distanceMeters ? restaurant.distanceMeters / 1609.34 : null
            const metaParts = [restaurant.cuisine, restaurant.price].filter(Boolean)
            if (restaurant.rating) {
              const ratingText = `${restaurant.rating.toFixed(1)}★`
              const reviews = restaurant.reviewCount ? `${restaurant.reviewCount} reviews` : null
              metaParts.push(reviews ? `${ratingText} • ${reviews}` : ratingText)
            } else if (restaurant.reviewCount) {
              metaParts.push(`${restaurant.reviewCount} reviews`)
            }
            return (
              <div key={restaurant.id} className="rounded-[6px] bg-card p-4 neo-border-3 neo-shadow-sm">
                <div className="flex gap-4">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-[6px] bg-muted neo-border">
                    {restaurant.imageUrl ? (
                      <Image
                        src={restaurant.imageUrl}
                        alt={`Photo of ${restaurant.name}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div>
                          <p className="text-lg font-bold leading-tight">{restaurant.name}</p>
                          {metaParts.length > 0 && (
                            <p className="text-sm font-medium text-foreground/70">{metaParts.join(" • ")}</p>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground/60">
                          {restaurant.address}
                          {miles !== null && ` • ${miles.toFixed(1)} mi`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {restaurant.url && (
                          <Button
                            asChild
                            size="sm"
                            className="gap-2 rounded-[6px] bg-neo-cyan font-bold uppercase text-foreground neo-border"
                          >
                            <a href={restaurant.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" /> Yelp
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (isSaved || isSaving) return
                            setActionError(null)
                            setLocalSavingId(restaurant.id)
                            try {
                              await onAddRestaurant(restaurant)
                            } catch (err) {
                              setActionError((err as Error).message)
                            } finally {
                              setLocalSavingId(null)
                            }
                          }}
                          disabled={isSaved || isSaving}
                          className={`gap-2 rounded-[6px] font-bold uppercase neo-border neo-btn-hover ${
                            isSaved ? "bg-neo-green text-foreground" : "bg-foreground text-background"
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="h-4 w-4" /> Saved
                            </>
                          ) : (
                            <>
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              {isSaving ? "Saving" : "Add"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {restaurant.reason && restaurant.reason.trim().length > 0 && (
                      <p
                        className="mt-2 text-sm text-foreground/80 bg-neo-yellow/30 px-2 py-1 rounded-[4px] border border-neo-yellow/50 line-clamp-2 cursor-help"
                        title={restaurant.reason}
                      >
                        <span className="font-semibold">Why you'll love it:</span> {restaurant.reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}