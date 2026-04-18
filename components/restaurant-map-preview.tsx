"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import RestaurantSearch from "@/components/restaurant-search"
import SavedRestaurants from "@/components/saved-restaurants"
import SavedRestaurantsMap from "@/components/saved-restaurants-map"
import NearbyRestaurants from "@/components/nearby-restaurants"
import RetroDinerHeader from "@/components/retro-diner-header"
import { LoadingGlobal } from "@/components/loading-global"
import type { Restaurant } from "@/types/restaurant"
import type { LiteSession } from "@/types/session"

export default function RestaurantFinder() {
  const [session, setSession] = useState<LiteSession | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [sessionInput, setSessionInput] = useState("")
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isSubmittingSession, setIsSubmittingSession] = useState(false)
  const refreshSession = useCallback(async () => {
    setIsSessionLoading(true)
    setSessionError(null)
    try {
      const response = await fetch("/api/session")
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load session.")
      }

      setSession(data?.session ?? null)
    } catch (error) {
      setSession(null)
      if ((error as Error).name !== "AbortError") {
        setSessionError((error as Error).message)
      }
    } finally {
      setIsSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const [savedRestaurants, setSavedRestaurants] = useState<Restaurant[]>([])
  const [showNearby, setShowNearby] = useState(false)
  const [hasRequestedNearby, setHasRequestedNearby] = useState(false)
  const [hasNearbyContent, setHasNearbyContent] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [isLoadingSaved, setIsLoadingSaved] = useState(true)
  const [addingRestaurantId, setAddingRestaurantId] = useState<string | null>(null)
  const [deletingRestaurantId, setDeletingRestaurantId] = useState<string | null>(null)

  useEffect(() => {
    if (isSessionLoading) {
      return
    }

    if (!session) {
      setSavedRestaurants([])
      setSavedError(null)
      setIsLoadingSaved(false)
      return
    }

    const controller = new AbortController()
    let isMounted = true

    const loadSavedRestaurants = async () => {
      try {
        setIsLoadingSaved(true)
        setSavedError(null)
        const response = await fetch("/api/saved-restaurants", {
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load saved restaurants.")
        }
        if (isMounted) {
          setSavedRestaurants(data.restaurants || [])
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        if (isMounted) {
          setSavedError((error as Error).message)
        }
      } finally {
        if (isMounted) {
          setIsLoadingSaved(false)
        }
      }
    }

    loadSavedRestaurants()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [session?.name, isSessionLoading])

  const upsertRestaurantInState = (restaurant: Restaurant) => {
    setSavedRestaurants((prev) => {
      const index = prev.findIndex((r) => r.id === restaurant.id)
      if (index === -1) {
        return [restaurant, ...prev]
      }
      const clone = [...prev]
      clone[index] = restaurant
      return clone
    })
  }

  const ensureSession = (): asserts session is LiteSession => {
    if (!session) {
      const message = "Log in to manage your saved restaurants."
      setSavedError(message)
      throw new Error(message)
    }
  }

  const handleSessionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmittingSession) return

    const trimmed = sessionInput.trim()
    if (trimmed.length < 2) {
      setSessionError("Please enter at least 2 characters.")
      return
    }

    setIsSubmittingSession(true)
    setSessionError(null)
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "Unable to start session.")
      }

      setSessionInput("")
      await refreshSession()
    } catch (error) {
      setSessionError((error as Error).message)
    } finally {
      setIsSubmittingSession(false)
    }
  }

  const handleLogout = async () => {
    setIsSubmittingSession(true)
    setSessionError(null)
    try {
      const response = await fetch("/api/session", { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || "Unable to end session.")
      }

      await refreshSession()
      setSavedRestaurants([])
      setSavedError(null)
    } catch (error) {
      setSessionError((error as Error).message)
    } finally {
      setIsSubmittingSession(false)
    }
  }

  const handleAddRestaurant = async (restaurant: Restaurant) => {
    if (!restaurant?.id) return
    ensureSession()
    setAddingRestaurantId(restaurant.id)
    setSavedError(null)
    try {
      const response = await fetch("/api/saved-restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurant),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "Unable to save restaurant.")
      }

      if (data?.restaurant) {
        upsertRestaurantInState(data.restaurant)
      }
    } catch (error) {
      setSavedError((error as Error).message)
      throw error
    } finally {
      setAddingRestaurantId(null)
    }
  }

  const handleDeleteRestaurant = async (id: string) => {
    ensureSession()
    setDeletingRestaurantId(id)
    setSavedError(null)
    try {
      const response = await fetch("/api/saved-restaurants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || "Unable to delete restaurant.")
      }

      setSavedRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== id))
    } catch (error) {
      setSavedError((error as Error).message)
      throw error
    } finally {
      setDeletingRestaurantId(null)
    }
  }

  const handleFindNearby = () => {
    if (!session) {
      setLocationError("Log in to request personalized recommendations.")
      return
    }

    if (savedRestaurants.length === 0) {
      setLocationError("Save at least one restaurant before requesting AI-powered recommendations.")
      setHasRequestedNearby(false)
      setHasNearbyContent(false)
      return
    }

    setIsLoadingLocation(true)
    setHasRequestedNearby(true)
    setHasNearbyContent(false)
    setLocationError(null)
    setShowNearby(false)
    setUserLocation(null)

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationError("Location access requires HTTPS or localhost. Please reload over https:// or use the manual search above.")
      setIsLoadingLocation(false)
      setHasRequestedNearby(false)
      setHasNearbyContent(false)
      return
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      setIsLoadingLocation(false)
      setHasRequestedNearby(false)
      setHasNearbyContent(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setShowNearby(true)
        setIsLoadingLocation(false)
        setHasNearbyContent(false)
      },
      (error) => {
        let message = "Unable to retrieve your location. Please enable location access."
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Update your browser/site settings to allow access and try again."
            break
          case error.POSITION_UNAVAILABLE:
            message = "We couldn't determine your location. Try again with better reception or enter a city manually."
            break
          case error.TIMEOUT:
            message = "Location request timed out. Please try again."
            break
          default:
            if (error.message) {
              message = error.message
            }
        }

        setLocationError(message)
        setIsLoadingLocation(false)
        setHasRequestedNearby(false)
        setShowNearby(false)
        setHasNearbyContent(false)
      },
      { timeout: 15000 },
    )
  }

  return (
    <div className="min-h-screen bg-neo-yellow/30 py-10 px-4">
      <div className="mx-auto max-w-4xl">
        <RetroDinerHeader />

        <section className="mb-8">
          <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-6">
            <div className="mb-4">
              <p className="text-xl font-black uppercase">Quick Session</p>
              <p className="text-sm font-medium text-foreground/70">
                Start a lightweight session so we can keep your Supabase favorites tied to this browser.
              </p>
            </div>
            {isSessionLoading ? (
              <div className="flex items-center gap-3 font-bold text-foreground/70">
                <div className="neo-border bg-neo-yellow p-2 rounded-[6px]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                Checking session...
              </div>
            ) : session ? (
              <div className="flex flex-col gap-4 rounded-[6px] bg-neo-yellow/40 neo-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-black">Signed in as {session.name}</p>
                  <p className="text-sm text-foreground/70">Saved restaurants stay associated with this session until you log out.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  disabled={isSubmittingSession}
                  className="neo-border neo-btn-hover font-bold uppercase rounded-[6px] bg-foreground text-background"
                >
                  {isSubmittingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmittingSession ? "Ending" : "Log Out"}
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSessionSubmit}>
                <div>
                  <label htmlFor="session-name" className="mb-2 block text-sm font-black uppercase tracking-wide">
                    Display name
                  </label>
                  <Input
                    id="session-name"
                    placeholder="e.g. CJ's picks"
                    value={sessionInput}
                    onChange={(event) => setSessionInput(event.target.value)}
                    disabled={isSubmittingSession}
                    autoComplete="off"
                    className="neo-border-3 neo-shadow rounded-[6px] h-12 font-medium"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-foreground/70">
                    Use any nickname; it's only stored locally for this hackathon session.
                  </p>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto gap-2 bg-foreground text-background font-bold uppercase neo-border-3 neo-btn-hover rounded-[6px]"
                    disabled={isSubmittingSession}
                  >
                    {isSubmittingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSubmittingSession ? "Starting" : "Start Session"}
                  </Button>
                </div>
              </form>
            )}
          </div>
          {sessionError && (
            <p className="mt-3 rounded-[6px] bg-destructive/10 p-3 text-sm font-bold text-destructive neo-border">
              {sessionError}
            </p>
          )}
        </section>

        <section className="mb-8">
          <RestaurantSearch onAddRestaurant={handleAddRestaurant} />
        </section>

        <section className="mb-8">
          {session ? (
            <SavedRestaurants
              restaurants={savedRestaurants}
              onDelete={handleDeleteRestaurant}
              isLoading={isLoadingSaved}
              error={savedError}
              deletingId={deletingRestaurantId}
            />
          ) : isSessionLoading ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading session info...
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-[6px] bg-card neo-border-3 neo-shadow p-6 text-center">
              <h2 className="text-xl font-black uppercase mb-2">Saved Restaurants</h2>
              <p className="text-sm font-medium text-foreground/70">Log in with a nickname above to start saving your picks.</p>
            </div>
          )}
        </section>

        {session && !isLoadingSaved && savedRestaurants.some((restaurant) => restaurant.coordinates) ? (
          <section className="mb-8">
            <SavedRestaurantsMap restaurants={savedRestaurants} />
          </section>
        ) : null}

        <section className="rounded-[6px] bg-neo-cyan neo-border-3 neo-shadow-lg p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase">Discover Nearby</h2>
              <p className="text-sm font-medium text-foreground/70">Find restaurants close to your current location.</p>
            </div>
            <Button
              onClick={handleFindNearby}
              disabled={isLoadingLocation}
              className="gap-2 rounded-[6px] bg-foreground px-6 py-5 font-bold uppercase text-background neo-border-3 neo-btn-hover"
            >
              <MapPin className="h-5 w-5" />
              {isLoadingLocation ? "Getting Location..." : "Find Near Me"}
            </Button>
          </div>

          {locationError && (
            <p className="mb-4 rounded-[6px] bg-destructive/10 p-3 text-sm font-bold text-destructive neo-border">
              {locationError}
            </p>
          )}

          {hasRequestedNearby && !hasNearbyContent && (
            <div className="rounded-[6px] bg-card neo-border-3 neo-shadow">
              <LoadingGlobal message={isLoadingLocation ? "Getting your location..." : "Finding restaurants near you..."} />
            </div>
          )}

          {showNearby && userLocation && (
            <NearbyRestaurants
              latitude={userLocation.lat}
              longitude={userLocation.lng}
              onAddRestaurant={handleAddRestaurant}
              savedRestaurantIds={savedRestaurants.map((r) => r.id)}
              referenceRestaurants={savedRestaurants}
              savingId={addingRestaurantId}
              onLoadComplete={() => setHasNearbyContent(true)}
            />
          )}
        </section>
      </div>
    </div>
  )
}