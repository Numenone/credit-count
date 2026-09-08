/**
 * The API surface, described once.
 *
 * The explorer at /admin/api renders this; nothing generates it from the route
 * handlers, so it is documentation that can drift. It is kept in the same commit
 * discipline as the handlers, and the explorer's whole point is that you run the
 * request rather than trusting the description.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface EndpointParam {
  name: string;
  in: "query" | "path";
  required?: boolean;
  description: string;
  placeholder?: string;
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  /** Path template; `{id}` segments are filled from the path params below. */
  path: string;
  summary: string;
  description: string;
  /** Who the database will actually let through. */
  access: "public" | "authenticated" | "admin" | "owner";
  params?: EndpointParam[];
  body?: Record<string, unknown>;
  /** What to expect when the caller is not allowed — the interesting case. */
  refusal?: string;
}

export interface EndpointGroup {
  name: string;
  description: string;
  endpoints: Endpoint[];
}

export const API_SPEC: EndpointGroup[] = [
  {
    name: "Leaderboard",
    description:
      "The only endpoint reachable without a session. Its projection is fixed by the underlying view.",
    endpoints: [
      {
        id: "leaderboard-list",
        method: "GET",
        path: "/api/v1/leaderboard",
        summary: "Public leaderboard",
        description:
          "Display name, credit count and rank for opted-in users only. There is no parameter that widens this — the view has no other columns.",
        access: "public",
        params: [
          { name: "limit", in: "query", description: "1–200, default 100", placeholder: "10" },
        ],
      },
    ],
  },
  {
    name: "Me",
    description: "The caller's own profile. Role is not writable through any endpoint.",
    endpoints: [
      {
        id: "me-get",
        method: "GET",
        path: "/api/v1/me",
        summary: "Read your profile",
        description: "Email, display name, role, leaderboard opt-in and unit preference.",
        access: "authenticated",
        refusal: "401 without a session.",
      },
      {
        id: "me-patch",
        method: "PATCH",
        path: "/api/v1/me",
        summary: "Update your profile",
        description:
          "Accepts display_name, leaderboard_opt_in and unit_system. Try adding \"role\": \"admin\" to the body — Postgres refuses it at the column grant, before any policy runs.",
        access: "owner",
        body: { display_name: "Ellie Sharpe", leaderboard_opt_in: true, unit_system: "metric" },
        refusal: "422 for an unknown field; the role column is not grantable at all.",
      },
    ],
  },
  {
    name: "Catalogue",
    description:
      "Readable by any signed-in user, writable only by admins. The write policies live in the database, so this endpoint and the admin UI are gated by the same rule.",
    endpoints: [
      {
        id: "coasters-list",
        method: "GET",
        path: "/api/v1/coasters",
        summary: "Search the catalogue",
        description: "Filter by free text, country or type. Paginated.",
        access: "authenticated",
        params: [
          { name: "q", in: "query", description: "Name, park or country", placeholder: "nemesis" },
          { name: "country", in: "query", description: "Exact match", placeholder: "United Kingdom" },
          { name: "type", in: "query", description: "Steel, Wooden or Hybrid", placeholder: "Steel" },
          { name: "limit", in: "query", description: "1–200, default 50", placeholder: "5" },
          { name: "offset", in: "query", description: "Default 0", placeholder: "0" },
        ],
        refusal: "401 without a session — visitors cannot browse the catalogue.",
      },
      {
        id: "coasters-get",
        method: "GET",
        path: "/api/v1/coasters/{id}",
        summary: "Read one coaster",
        description: "Full record including measurements and coordinates.",
        access: "authenticated",
        params: [
          { name: "id", in: "path", required: true, description: "Coaster UUID", placeholder: "" },
        ],
      },
      {
        id: "coasters-create",
        method: "POST",
        path: "/api/v1/coasters",
        summary: "Add a coaster",
        description:
          "Admin only. Run this signed in as an enthusiast and the database refuses it — the handler has no role check of its own.",
        access: "admin",
        body: {
          name: "Test Coaster",
          park: "Test Park",
          country: "Testland",
          manufacturer: "Test Works",
          type: "Steel",
          height_m: 40,
          length_m: 900,
          speed_kmh: 100,
          inversions: 2,
          opened_year: 2026,
        },
        refusal: "403 for an enthusiast, from the coasters insert policy.",
      },
      {
        id: "coasters-patch",
        method: "PATCH",
        path: "/api/v1/coasters/{id}",
        summary: "Edit a coaster",
        description: "Admin only. Any subset of the fields.",
        access: "admin",
        params: [
          { name: "id", in: "path", required: true, description: "Coaster UUID", placeholder: "" },
        ],
        body: { name: "Renamed coaster" },
        refusal: "403 for an enthusiast — the update matches zero rows.",
      },
      {
        id: "coasters-delete",
        method: "DELETE",
        path: "/api/v1/coasters/{id}",
        summary: "Remove a coaster",
        description:
          "Admin only, and refused for any coaster with rides logged against it so nobody loses a credit.",
        access: "admin",
        params: [
          { name: "id", in: "path", required: true, description: "Coaster UUID", placeholder: "" },
        ],
        refusal: "403 for an enthusiast; 409 if rides reference it.",
      },
    ],
  },
  {
    name: "Rides",
    description:
      "Private to their owner. No endpoint here accepts a user id, because RLS scopes every query to the caller regardless.",
    endpoints: [
      {
        id: "rides-list",
        method: "GET",
        path: "/api/v1/rides",
        summary: "Your ride history",
        description:
          "Returns only your own rides. There is no parameter for whose rides to fetch — the database decides.",
        access: "owner",
        params: [
          { name: "limit", in: "query", description: "1–500, default 100", placeholder: "5" },
          { name: "offset", in: "query", description: "Default 0", placeholder: "0" },
        ],
      },
      {
        id: "rides-create",
        method: "POST",
        path: "/api/v1/rides",
        summary: "Log a ride",
        description:
          "user_id is not accepted: it defaults to auth.uid() and the insert policy requires it to match you.",
        access: "owner",
        body: { coaster_id: "", ridden_on: "2026-09-08", note: "Logged from the API explorer" },
      },
      {
        id: "rides-patch",
        method: "PATCH",
        path: "/api/v1/rides/{id}",
        summary: "Edit a ride",
        description: "Yours only. Another user's ride id simply matches nothing.",
        access: "owner",
        params: [
          { name: "id", in: "path", required: true, description: "Ride UUID", placeholder: "" },
        ],
        body: { note: "Updated note" },
        refusal: "403 for a ride that is not yours.",
      },
      {
        id: "rides-delete",
        method: "DELETE",
        path: "/api/v1/rides/{id}",
        summary: "Delete a ride",
        description: "Yours only.",
        access: "owner",
        params: [
          { name: "id", in: "path", required: true, description: "Ride UUID", placeholder: "" },
        ],
        refusal: "403 for a ride that is not yours.",
      },
    ],
  },
  {
    name: "Stats",
    description: "The dashboard numbers, computed by the same function the dashboard page uses.",
    endpoints: [
      {
        id: "stats-get",
        method: "GET",
        path: "/api/v1/stats",
        summary: "Your stats",
        description:
          "Credits, rides, breakdowns, distance and vertical totals, and the milestones you have earned.",
        access: "owner",
      },
    ],
  },
];

export const ACCESS_LABEL: Record<Endpoint["access"], string> = {
  public: "No sign-in needed",
  authenticated: "Any signed-in user",
  admin: "Admins only",
  owner: "Your own data only",
};
