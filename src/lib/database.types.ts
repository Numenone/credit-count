/**
 * Hand-maintained mirror of the SQL in supabase/migrations.
 * Kept small on purpose — regenerate with `supabase gen types` if the schema grows.
 */

export type CoasterType = "Steel" | "Wooden" | "Hybrid";
export type UserRole = "enthusiast" | "admin";
export type UnitSystem = "metric" | "imperial";

export interface Coaster {
  id: string;
  name: string;
  park: string;
  country: string;
  manufacturer: string;
  type: CoasterType;
  /** All measurements are stored in SI. Imperial is a display preference only. */
  height_m: number | null;
  length_m: number | null;
  speed_kmh: number | null;
  inversions: number | null;
  opened_year: number | null;
  park_city: string | null;
  park_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  role: UserRole;
  leaderboard_opt_in: boolean;
  unit_system: UnitSystem;
  created_at: string;
}

export interface Ride {
  id: string;
  user_id: string;
  coaster_id: string;
  ridden_on: string;
  note: string | null;
  created_at: string;
}

export interface LeaderboardRow {
  display_name: string;
  credits: number;
  rank: number;
}

export interface CatalogueHealth {
  total: number;
  missing_height: number;
  missing_length: number;
  missing_speed: number;
  missing_location: number;
  missing_park_url: number;
  missing_opened_year: number;
}

/** A ride joined to its catalogue entry, as returned by the nested PostgREST select. */
export type RideWithCoaster = Ride & { coaster: Coaster };

/** Columns selected wherever a full coaster record is needed. */
export const COASTER_COLUMNS =
  "id, name, park, country, manufacturer, type, height_m, length_m, speed_kmh, inversions, opened_year, park_city, park_url, latitude, longitude, created_at, updated_at";
