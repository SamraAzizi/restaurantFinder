-- Create saved_restaurants table scoped by lite session id
create table if not exists public.saved_restaurants (
  id text not null,
  user_id text not null,
  user_display_name text,
  name text not null,
  cuisine text,
  address text,
  rating numeric,
  review_count integer,
  price text,
  url text,
  image_url text,
  distance_meters numeric,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  constraint saved_restaurants_pkey primary key (id, user_id)
);

-- Index to fetch a user's restaurants ordered by recency
create index if not exists saved_restaurants_user_created_idx
  on public.saved_restaurants (user_id, created_at desc);
