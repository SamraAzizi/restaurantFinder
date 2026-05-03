## Restaurant Finder
Restaurant Finder is a Next.js playground that lets you search Yelp, save favorites to Supabase, and ask Yelp's AI for nearby recommendations tailored to your taste profile.

### Local Setup

#### Requirements
- Node.js 18+ and `pnpm`
- Yelp Fusion + Yelp AI API keys
- Supabase project with SQL access

1. Configure environment variables
Copy `.env.example` to `.env.local` and fill in the secrets:

```bash
cp .env.example .env.local
# then edit the file
YELP_API_KEY=your_yelp_api_key          # required
YELP_AI_API_KEY=your_yelp_ai_key        # optional, falls back to YELP_API_KEY
SUPABASE_URL=your_supabase_url          # required
SUPABASE_SECRET_KEY=your_secret_key     # required server-side key
```
2. Apply the Supabase migration
Create the `saved_restaurants` table using the provided SQL:

```bash
psql -h <host> -U <user> -d <database> < supabase/migrations/202402140001_saved_restaurants.sql
```

3. Install dependencies & run the dev server

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`, start a nickname session, save a few restaurants, and click Find Near Me for AI-powered matches. Use `pnpm build && pnpm start` when you need a production build.

## How It Works
1. Save Your Favorites
Search for restaurants by name or location and save the ones you love. The app stores them in Supabase tied to your session nickname.

2. Build Your Taste Profile
When you click "Find Restaurants Near Me", the app analyzes your saved favorites to extract a minimal taste profile:

- Top cuisines: The 3-5 most frequent cuisine types (e.g., "thai", "mediterranean", "brunch")
- Price range: Your typical price buckets (e.g., "$", "$$")
- Rating threshold: Average rating of your favorites (e.g., 4.3+)

This compact profile replaces verbose restaurant details, reducing tokens by ~70% (from 400-600 to 80-120 tokens per request).

3. Get AI-Powered Recommendations
The taste profile is sent to `Yelp's AI Chat v2 API` along with your location. The AI:
- Finds 5 restaurants matching your taste preferences
- Ensures diversity (no more than 2 of the same cuisine)
- Excludes restaurants you've already saved
- Provides a brief explanation for each match

4. Smart Fallbacks
The app includes several sagety mechanisms:
- Weak signal detection:If you have < 2 saved restaurants, uses a generic "highly-rated-nearby" query instead
- Validation: Remove duplications, Invalid IDs, and already-saved-restaurants from results
- Timeout handling: Falls back gracefully if the AI take > 5 seconds
- Error recovery:shows helpful messages and empty states things go wrong

### Privacy and Efficiency
- No  PIIsent:only cuisine types, price ranges, and ratings are transmitted never address, phone number and personal details
- Minimal data: Taste profile uses category aliases(e.g,"italian") not verbose name or descriptions
- Deduplication: restaurant IDs are validated to prevent showing duplicates or saved items 

RequirementsL: At least one saved restaurant and `YELP_API_KEY`/`YELP_AI_API_KEY` configured in .env.local.

## Technical Architecture
Taste Profile Extraction (`lib/yelp-ai.ts`)
- `buildTasteProfile()`: Analyzes saved restaurants to extract top cuisines, price buckets, and average rating
- `formatTasteProfile()`: Formats the profile as a compact string for the LLM prompt
- `getSavedIds()`: Returns IDs to exclude from recommendations

### Prompt Management (`prompts/`)
Prompts are stored as individual text files for easy editing:

- `personalized.txt`: Used when user has ≥2 saved restaurants
- `fallback-with-location.txt`: Generic query with location
- `fallback-no-location.txt`: Generic query without location

Variables in prompts use `{{VARIABLE_NAME}}` syntax and are substituted at runtime by `lib/prompts.ts`.
### Minimal Prompt Generation (`app/api/recommendations/route.ts`)

Loads prompts from file and builds a token-efficient query:
```bash
My taste profile:
- Cuisines: thai, mediterranean, brunch
- Price range: $, $$
- Min rating: 4.3+

Craving: something spicy

(Latitude/longitude are no longer included here—they're sent via the `user_context` payload.)

Exclude these saved IDs: abc123, def456

Find me 5 restaurants that match my taste. Ensure diversity.
```


### Response Validation
- `validateAndDedupeRestaurants()`: Removes duplicates, invalid IDs, and already-saved items
- `truncateReason()`: Caps AI explanations at 100 characters
- Parses Yelp AI's `entities[].businesses[]` and `response.text` structure

### Example Flow
1. User saves "Lokma" (Mediterranean, 4.6★) and "Thai Basil" (Thai, 4.4★)
2. App extracts: `{cuisines: ["mediterranean", "thai"], priceRange: ["$", "$$"], avgRating: 4.5}`
3. Sends a ~90-token prompt plus `user_context` lat/lng directly to Yelp AI (instead of repeating coordinates in the prompt)
4. Receives 5 restaurants, validates IDs, filters duplicates/saved items
5. Displays results with AI-generated match explanations

### Default Location Override
During the hackathon we're hard-coding San Francisco coordinates in `app/api/recommendations/route.ts` via `LOCATION_OVERRIDE`. Set that constant to `null` (or comment it out) to fall back to the client-provided latitude/longitude instead.


## Editing Prompts
Prompts are stored as individual text files in the `prompts/` directory:

- `prompts/personalized.txt`: Main recommendation prompt
- `prompts/fallback-with-location.txt`: Used when user has < 2 saved restaurants
- `prompts/fallback-no-location.txt`: Used when no location available

#### How to Edit
1. Open the prompt file you want to change (e.g., `prompts/personalized.txt`)
2. Edit the text directly
3. Use `{{VARIABLE_NAME}}` for dynamic values:
    - `{{CUISINES}}`: Natural language list of user's favorite cuisines
    - `{{LATITUDE}}`, `{{LONGITUDE}}`: User location (4 decimals) — primarily for fallback prompts; personalized prompts rely on the `user_context` payload instead
    - `{{CRAVING}}`: Optional user-entered craving (e.g., "I'm craving something spicy. ")
    - `{{SAVED_IDS}}`: Comma-separated list of saved restaurant IDs
4. Restart the dev server to see changes

Example edit to `personalized.txt`:

```bash
- I love {{CUISINES}} food. {{CRAVING}}Can you find me 5 restaurants near latitude {{LATITUDE}}, longitude {{LONGITUDE}}?
+ I enjoy {{CUISINES}} cuisine. {{CRAVING}}Show me 10 restaurants near {{LATITUDE}}, {{LONGITUDE}} that match my taste.

```

Each prompt file is cached in memory after first load for performance.

### Scripts
- `pnpm dev` – Next.js dev server.
- `pnpm build` / `pnpm start` – production build + serve.
- `pnpm lint` – ESLint across the repo.
- `pnpm check:saved "Nickname"` – Supabase smoke test (accepts `--id` and `--name `overrides).