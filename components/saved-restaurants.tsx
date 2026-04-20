"use client"

import Image from "next/image"
import { useState } from "react"
import { Trash2, Loader2, ExternalLink, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import RestaurantMapPreview from "@/components/restaurant-map-preview"
import type { Restaurant } from "@/types/restaurant"

interface SavedRestaurantsProps {
  restaurants: Restaurant[]
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
  deletingId?: string | null
}

export default function SavedRestaurants({
  restaurants,
  onDelete,
  isLoading,
  error,
  deletingId,
}: SavedRestaurantsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const renderRestaurantMeta = (restaurant: Restaurant) => {
    const details = [restaurant.cuisine, restaurant.price].filter(Boolean)
    if (restaurant.rating) {
      const ratingText = `${restaurant.rating.toFixed(1)}★`
      const reviews = restaurant.reviewCount ? `${restaurant.reviewCount} reviews` : null
      details.push(reviews ? `${ratingText} • ${reviews}` : ratingText)
    } else if (restaurant.reviewCount) {
      details.push(`${restaurant.reviewCount} reviews`)
    }
    return details.join(" • ")
  }

  const Thumbnail = ({ restaurant }: { restaurant: Restaurant }) => (
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
  )

  if (isLoading) {
    return (
      <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-6 text-center font-bold text-foreground/70">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading saved restaurants...
        </div>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-6 text-center">
        <h2 className="mb-3 text-xl font-black uppercase">Saved Restaurants</h2>
        {error && <p className="mb-3 text-sm font-bold text-destructive">{error}</p>}
        <p className="font-medium text-foreground/70">No saved restaurants yet. Search and add some above!</p>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] bg-neo-pink/30 neo-border-3 neo-shadow-lg p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black uppercase">Saved Restaurants</h2>
          <span className="inline-flex items-center justify-center rounded-[6px] bg-foreground px-3 py-1 text-sm font-black text-background neo-border">
            {restaurants.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-[6px] border-2 border-border bg-card px-4 py-2 text-xs font-black uppercase tracking-wide neo-btn-hover"
        >
          {isCollapsed ? "Expand" : "Collapse"}
          <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-[6px] bg-destructive/10 p-3 text-sm font-bold text-destructive neo-border">{error}</p>
      )}
      {!isCollapsed ? (
        <div className="max-h-[520px] space-y-4 overflow-y-auto pr-2 overscroll-y-contain">
          {restaurants.map((restaurant) => {
            const meta = renderRestaurantMeta(restaurant)
            return (
              <div key={restaurant.id} className="rounded-[6px] bg-card p-4 neo-border-3 neo-shadow">
                <div className="flex min-h-[108px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div className="flex flex-1 cursor-pointer gap-4">
                      <Thumbnail restaurant={restaurant} />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold leading-tight">{restaurant.name}</p>
                        {meta && <p className="text-sm font-medium text-foreground/70">{meta}</p>}
                        {restaurant.address && <p className="text-xs font-medium text-foreground/60">{restaurant.address}</p>}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-auto p-2">
                    <RestaurantMapPreview restaurant={restaurant} />
                  </HoverCardContent>
                </HoverCard>
                <div className="flex flex-wrap gap-2 sm:justify-end">
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
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await onDelete(restaurant.id)
                      } catch (error) {
                        console.error(error)
                      }
                    }}
                    className="h-9 w-9 rounded-[6px] bg-destructive/15 text-destructive neo-border"
                    disabled={deletingId === restaurant.id}
                  >
                    {deletingId === restaurant.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">Delete {restaurant.name}</span>
                  </Button>
                </div>
              </div>
            </div>
          )
          })}
        </div>
      ) : (
        <p className="rounded-[6px] bg-card p-4 text-sm font-medium text-foreground/70 neo-border">List collapsed</p>
      )}
    </div>
  )
}