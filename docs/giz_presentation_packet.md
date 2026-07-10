# GIZ Presentation Packet (M9)

This is not a feature spec — it's the talking points and framing for
presenting the Land Use Transparency Prototype to GIZ. See
[`module_prompts.txt`](module_prompts.txt) for what was built (M0–M8).

## Opening framing statement

> "What you're about to see is a UX concept prototype. Every village,
> parcel, and dispute in it is fictional — invented for this demo,
> prefixed `DEMO-` so it's unmistakable even in a screenshot. It is not
> connected to LUIS, LaoLandReg, or any live system, and it contains no
> real citizen or government data. What it's meant to illustrate is an
> idea: a simplified, citizen-facing usability layer that could sit in
> front of a system like LUIS, aimed at villagers, ethnic-minority
> language speakers, and field officers with low digital literacy or
> connectivity. This is not a proposal to replace or integrate with any
> real system, and it's not something we're asking you to buy today."

Say this before a single screen is shown. Repeat the "fictional data"
point even though it's also visible in-app (the amber banner on every
screen) — redundancy here is a feature, not a flaw.

## The ask — framed as a discovery question

Do not close. Ask:

> "Does a usability layer like this address a real gap you see with
> citizen-facing land information in Laos? We're not asking you to
> commit to anything — we'd like to know if this direction resonates,
> and if so, what would need to be true for it to be useful in your
> context."

Follow-up prompts if the room is quiet:
- "Where does the current citizen experience (via LUIS or otherwise)
  break down for someone with limited literacy or connectivity?"
- "Who inside GIZ or your government counterparts would need to see
  something like this for it to go anywhere?"

## Word-choice check

Throughout the conversation and any follow-up materials:

| Avoid | Prefer |
|---|---|
| "demo" (when it could imply live/real data) | "prototype," "concept," "mockup" |
| "the system" / "the platform" | "this prototype" / "this concept" |
| "integration" (implies it's built) | "an idea for how this could connect" |
| "when we roll this out" | "if this direction were pursued" |

If someone else in the room uses "demo" loosely, it's fine — just don't
let your own language drift into implying this works with real data or
is scheduled to ship.

## Prepared answers to anticipated pushback

**"How does this handle data sovereignty?"**
> "It doesn't touch real data at all right now, so there's no
> sovereignty question to answer yet — that's deliberate. If this
> direction is interesting, the real data question (where it's hosted,
> who controls it, what leaves the country) would be one of the first
> things to work through with your team and LaoLandReg before any real
> integration was scoped."

**"How would this integrate with LUIS / who governs that?"**
> "It doesn't integrate with LUIS today — this prototype has its own
> throwaway database with fictional data. If there's interest, the
> integration and governance model (read-only API? Data mirroring?
> Who owns the citizen-facing layer?) is exactly the kind of thing we'd
> want your systems team's input on before writing a line of real
> integration code."

**"Doesn't this duplicate work you're already planning / other GIZ
initiatives?"**
> "Possibly — that's part of why we're asking instead of proposing. If
> there's an existing workstream this overlaps with, we'd rather find
> that out now and either fold into it or step back, than build
> something that competes with your own roadmap."

## Internal reminder (before and after this meeting)

- Never ingest, reference, or take screenshots of real LUIS/LaoLandReg
  data or exports — not even "just for inspiration" or layout
  reference. Every parcel/village/dispute in this prototype must stay
  fabricated, `DEMO-`-prefixed, and traceable to `supabase/seed.sql`.
- Treat this meeting as relationship-building and discovery, not a
  revenue pitch. There is no ask for budget, timeline, or commitment in
  this conversation.
- If GIZ asks for the prototype to be shared further (their team,
  LaoLandReg counterparts), that's a good sign — but confirm the
  fictional-data framing travels with it (the in-app banner already
  does this automatically).
