/**
 * Hand-maintained mirror of the SQL in supabase/migrations.
 * Kept small on purpose — regenerate with `supabase gen types` if the schema grows.
 */

export type CoasterType = "Steel" | "Wooden" | "Hybrid";
export type UserRole = "enthusiast" | "admin";

export interface Coaster {
  id: string;
  name: string;
  park: string;
  country: string;
  manufacturer: string;
  type: CoasterType;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  role: UserRole;
  leaderboard_opt_in: boolean;
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

/** A ride joined to its catalogue entry, as returned by the nested PostgREST select. */
export type RideWithCoaster = Ride & { coaster: Coaster };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Pick<Profile, "display_name" | "leaderboard_opt_in">>;
      };
      coasters: {
        Row: Coaster;
        Insert: Omit<Coaster, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Coaster, "id" | "created_at" | "updated_at">>;
      };
      rides: {
        Row: Ride;
        Insert: Omit<Ride, "id" | "created_at" | "user_id"> & { user_id?: string };
        Update: Partial<Pick<Ride, "coaster_id" | "ridden_on" | "note">>;
      };
    };
    Views: {
      leaderboard: { Row: LeaderboardRow };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
  };
}
