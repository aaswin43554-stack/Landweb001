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
and Render blueprint are in place. Supabase project creation is
pending a decision on which Supabase org/project to use (see
`docs/module_prompts.txt` for what M0 covers).
