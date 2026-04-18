"use client"

import Image from "next/image"
import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Search, Plus, Loader2, MapPin, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Restaurant } from "@/types/restaurant"

interface RestaurantSearchProps {
  onAddRestaurant: (restaurant: Restaurant) => Promise<void>
}

export default function RestaurantSearch({ onAddRestaurant }: RestaurantSearchProps) {
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [suggestions, setSuggestions] = useState<Restaurant[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAwaitingResults, setIsAwaitingResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const hasSearchableInput = (nextQuery: string, nextLocation: string) =>
    nextQuery.trim().length >= 2 && nextLocation.trim().length >= 2

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      setError(null)
      setIsLoading(false)
      setIsAwaitingResults(false)
      return
    }

    if (location.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      setError("Enter a city, neighborhood, or ZIP.")
      setIsLoading(false)
      setIsAwaitingResults(false)
      return
    }

    setIsLoading(true)
    setIsAwaitingResults(true)
    setError(null)
    requestIdRef.current += 1
    const currentRequestId = requestIdRef.current
    const handler = setTimeout(async () => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const params = new URLSearchParams({ term: query.trim(), location: location.trim() })
        const response = await fetch(`/api/restaurants?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || "Unable to fetch restaurants.")
        }

        const body = await response.json()
        setSuggestions(body.restaurants || [])
        setIsOpen((body.restaurants || []).length > 0)
        setHighlightedIndex(-1)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setSuggestions([])
        setIsOpen(false)
        setError((err as Error).message)
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false)
          setIsAwaitingResults(false)
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    }, 350)

    return () => {
      clearTimeout(handler)
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [query, location])

  const handleSelect = async (restaurant: Restaurant) => {
    setAddingId(restaurant.id)
    try {
      await onAddRestaurant(restaurant)
      setQuery("")
      setSuggestions([])
      setIsOpen(false)
      setError(null)
      setIsAwaitingResults(false)
      inputRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        break
    }
  }

  return (
    <div className="relative rounded-[6px] bg-card neo-border-3 neo-shadow p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black uppercase">Search &amp; Save</h2>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/60">Yelp Fusion</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
      <div>
          <label htmlFor="restaurant-search" className="mb-2 block text-sm font-black uppercase tracking-wide">
            Search Restaurants
          </label>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 flex items-center rounded-l-[6px] bg-neo-yellow neo-border-3 border-r-0 px-3">
              <Search className="h-4 w-4 text-foreground" />
            </div>
            <Input
              ref={inputRef}
              id="restaurant-search"
              type="text"
              placeholder="Pizza, sushi, coffee..."
              value={query}
              onChange={(e) => {
                const nextValue = e.target.value
                setQuery(nextValue)
                setIsAwaitingResults(hasSearchableInput(nextValue, location))
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setIsOpen(true)}
              onBlur={() => setTimeout(() => setIsOpen(false), 150)}
              className="h-12 rounded-[6px] border-0 pl-14 pr-12 text-base font-medium neo-border-3"
              autoComplete="off"
            />
            {isLoading && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-foreground" />
            )}
          </div>
        </div>
        <div>
          <label htmlFor="restaurant-location" className="mb-2 block text-sm font-black uppercase tracking-wide">
            Location
          </label>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 flex items-center rounded-l-[6px] bg-neo-green neo-border-3 border-r-0 px-3">
              <MapPin className="h-4 w-4" />
            </div>
            <Input
              id="restaurant-location"
              type="text"
              placeholder="City, neighborhood, or ZIP"
              value={location}
              onChange={(e) => {
                const nextValue = e.target.value
                setLocation(nextValue)
                setIsAwaitingResults(hasSearchableInput(query, nextValue))
              }}
              className="h-12 rounded-[6px] border-0 pl-14 text-base font-medium neo-border-3"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-[6px] bg-destructive/10 p-3 text-sm font-bold text-destructive neo-border" role="alert">
          {error}
        </p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-2 w-full max-h-64 overflow-auto rounded-[6px] bg-card neo-border-3 neo-shadow-lg"
          role="listbox"
        >
          {suggestions.map((restaurant, index) => {
            const metaParts = [restaurant.cuisine, restaurant.price].filter(Boolean)
            if (restaurant.rating) {
              const ratingText = `${restaurant.rating.toFixed(1)}★`
              const reviews = restaurant.reviewCount ? `${restaurant.reviewCount} reviews` : null
              metaParts.push(reviews ? `${ratingText} • ${reviews}` : ratingText)
            } else if (restaurant.reviewCount) {
              metaParts.push(`${restaurant.reviewCount} reviews`)
            }

            return (
              <li
                key={restaurant.id}
                role="option"
                aria-selected={highlightedIndex === index}
                className={`flex cursor-pointer items-center gap-3 border-b-2 border-border px-4 py-3 transition-colors last:border-b-0 ${
                  highlightedIndex === index ? "bg-neo-yellow" : "hover:bg-neo-yellow/60"
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  void handleSelect(restaurant)
                }}
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  {restaurant.imageUrl ? (
                    <Image
                      src={restaurant.imageUrl}
                      alt={`Photo of ${restaurant.name}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{restaurant.name}</p>
                  {metaParts.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate">{metaParts.join(" • ")}</p>
                  )}
                  {restaurant.address && (
                    <p className="text-xs text-muted-foreground truncate">{restaurant.address}</p>
                  )}
                  {restaurant.url && (
                    <a
                      href={restaurant.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary"
                    >
                      <ExternalLink className="h-3 w-3" /> Yelp listing
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 rounded-[6px] bg-neo-green neo-border"
                  disabled={addingId === restaurant.id}
                >
                  {addingId === restaurant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="sr-only">Add {restaurant.name}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {(hasSearchableInput(query, location) && (isLoading || isAwaitingResults) && suggestions.length === 0 && !error) && (
        <div className="absolute z-10 mt-2 w-full rounded-[6px] bg-card neo-border-3 neo-shadow-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching restaurants...
          </div>
        </div>
      )}

      {hasSearchableInput(query, location) && !isLoading && !isAwaitingResults && suggestions.length === 0 && !error && (
        <p className="absolute z-10 mt-2 w-full rounded-[6px] bg-card px-4 py-3 text-sm font-medium text-foreground/70 neo-border-3 neo-shadow">
          No restaurants found for "{query}" in {location || "your location"}
        </p>
      )}
    </div>
  )
}