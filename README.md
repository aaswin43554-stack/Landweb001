# Land Use Transparency Prototype

**This is a concept demonstrator only.** It is not connected to LUIS,
LaoLandReg, or any live government system, and it contains no real
citizen or government data. Every parcel, village, and status shown in
this app is fictional and clearly marked as such in the UI. If you're
looking at this wondering whether it touches real data: it does not.

The prototype exists to show a usability concept — a simplified,
citizen-facing layer that could sit in front of a system like LUIS —
aimed at villagers, ethnic-minority language speakers, and field
officers with low digital literacy or connectivity. It is not a
proposal to replace or integrate with any real system.

See [`docs/module_prompts.txt`](docs/module_prompts.txt) for the
module-by-module build plan (M0–M9).

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, mobile-first
- **Backend:** Supabase (sample/demo data only)
- **Hosting:** Render (see `render.yaml`)

## Local development

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key once a project exists
npm run dev
```

## Status

Module 0 (project scaffold) — frontend shell, fictional-data banner,
and Render blueprint are in place.

Module 1 (data model & seed data) — the Supabase project is live, the
schema migration and seed data are applied, and `npm run db:verify`
passes (4 villages, 28 parcels, 21 translations, 0 disputes).

## Supabase setup

The project is created and seeded. To point a local checkout at it,
fill in `.env` from `.env.example` with the project URL and anon key
(ask a maintainer — not committed to the repo). The Render service
still needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` added to its
env vars (already declared as `sync: false` in `render.yaml`).
