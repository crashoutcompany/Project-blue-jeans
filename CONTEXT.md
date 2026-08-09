# Project Blue Jeans

An AI-assisted wardrobe product whose primary job is helping someone decide what to wear today from clothes they already own.

## Language

**Project Blue Jeans**:
The product’s customer-facing name (landing, auth, formal copy).
_Avoid_: The Digital Atelier, Curated Canvas, “Curated” as the product name (theme/voice only if used at all)

**Blue Jeans**:
Short chrome label for sidebar / app header.
_Avoid_: PBJ (unless as a private monogram later), “Project” in daily nav

**Primary job**:
Decide what to wear today from the wearer's own clothes.
_Avoid_: "digital closet app" as the top-level purpose (that is supporting infrastructure)

**Digital Closet**:
The wearer's catalog of owned **Garments**, plus archived **Outfits** (two modes: Pieces · Outfits).
_Avoid_: Dashboard (URL leftover; not the product concept); stuffing **Fits** into Closet

**Garment**:
A single owned clothing item in the **Digital Closet** (may be archived/hidden without destroying history).
_Avoid_: Piece (ok in casual UI copy), “item” as the domain noun; hard-deleting pieces that still appear in past **Outfits**

**Fit**:
An AI-suggested combination for a day that is not yet committed.
_Avoid_: Draft Look, calling a Fit an Outfit

**Outfit**:
A committed, wear-ready combination of **Garments**, unique by garment set; can be worn on many days (Today/Calendar assign a date to that one **Outfit**).
_Avoid_: Lookbook (marketing); don’t call a Fit an Outfit; duplicate Closet cards for the same set

**Weekly Fits**:
The AI-produced set of **Fits** for the remaining days of the current calendar week (Sunday-start; today through Saturday — never days before today).
_Avoid_: Week Plan (generic), “lookbook” for this object; regenerating past days in the week; Monday-start weeks

**Today**:
The post-login home surface that presents (or helps create) the **Outfit** for the current day.
_Avoid_: Dashboard, home-as-closet

**Outfit Generator**:
A today-scoped re-roll surface: short prompt + optional constraint chips (**Include** / **Avoid**) → up to three options → approve as today’s **Outfit** (not a freeform planner chat).
_Avoid_: Treating Generator as the home or as a dateless mood board; week planning in Generator; calling Include “must-wear”

**Wearer account**:
A signed-in user whose **Digital Closet**, **Fits**, **Outfits**, and **Today** are private to them.
_Avoid_: Shared household closet as the default; multi-profile under one login (deferred)

**Calendar**:
The week/month map of **Fits** and **Outfits** — browse and open days; not the primary commit surface and not the default home.
_Avoid_: Treating Calendar as the planner-first product; making it the place you “decide today”

**Wearer photo**:
A single saved body/reference image for a **Wearer account**, used to composite try-on heroes for **Fits** / **Outfits**.
_Avoid_: Re-uploading a body shot every generate; treating AI editorial as the default hero when a **Wearer photo** exists; hard-gating Today on missing photo

**Settings**:
Account-level controls reached from the account menu (not primary nav); includes **Wearer photo** and archived **Garments**.
_Avoid_: Fourth primary nav item; burying Wearer photo only inside Closet; putting archived pieces in the main Closet grid

## Relationships

- **Project Blue Jeans** is the formal name; **Blue Jeans** is the in-app chrome label
- Each **Wearer account** owns one **Digital Closet** and one **Today**
- Each **Wearer account** has at most one **Wearer photo** used for try-on heroes
- The **Primary job** is answered by an **Outfit** for today
- **Today** is the first screen after sign-in; it surfaces that answer
- A **Digital Closet** of **Garments** supplies what forms a **Fit** or **Outfit**
- **Calendar** and **Outfit Generator** are supporting surfaces, not the default home
- **Calendar** is overview (browse/open days); day commitment stays **Wear this** / Generator approve — not a Calendar-first planner workflow
- Opening a **Calendar** day: if it’s **today** → go to **Today** (`/`); otherwise stay in Calendar with an in-Calendar day detail (not a full Today-clone for arbitrary dates)
- Precedence on a given day: committed **Outfit** > **Fit** > empty state with CTA
- Empty **Today** (no **Outfit**, no **Fit**): primary CTA generates **Weekly Fits** and returns the user to **Today** with today featured
- Re-running **Weekly Fits** **replaces Fits** but never overwrites committed **Outfits**
- Re-run / refresh **Weekly Fits** lives on **Calendar** (week overview action), not as a mid-week control on **Today** (empty **Today** still has the primary generate CTA)
- On **Today**, “Wear this” promotes a **Fit** to today’s **Outfit** (no Calendar required)
- **Outfit Generator** revises the *current day’s* answer; **Weekly Fits** fills the week when nothing exists yet
- **Outfit Generator** UI: short prompt + optional chips (**Include** / **Avoid**) → **up to three** options (fewer OK if the closet can’t support three) → approve (hybrid, not free chat or one-tap-only)
- **Outfit Generator** opens as a **sheet/modal** over **Today** (not a full-page default); approve dismisses back to the updated hero
- Approving in **Outfit Generator** writes today’s **Outfit** immediately (same end-state as **Wear this**)
- **Change look** → approve **replaces** today’s **Outfit** in place (stays committed; no demote-to-Fit step)
- **Unwear** on Today clears today’s **Outfit** and restores the prior **Fit** if one exists, otherwise the empty CTA
- **Unwear** detaches the day from the **Outfit**; if that was the only wear, remove the **Outfit** from Closet archive — otherwise keep it (update last-worn as needed)
- Zero **Garments**: **Today** hard-gates with the same minimal pattern — one line + **Add clothes** only (no tour, no auto-redirect to Closet)
- Primary nav: **Today** · **Closet** · **Calendar**; **Settings** under account menu; **Outfit Generator** from **Today** (“Change look”)
- Routing: `/` is marketing when signed out and **Today** when signed in; **Digital Closet** at `/closet`; no `/dashboard`
- **Today** with a **Fit** or **Outfit**: **hero look** first — one dominant image, optional name, primary CTA under it (not flatlay-first, not week-strip-first)
- **Today** CTAs: **Fit** → **Wear this** (primary) + **Change look**; **Outfit** → **Change look** (primary path to replace) + quiet **Unwear**
- Under the **Today** hero: **garments used** first (compact strip), then a thin **week peek** of other days (secondary; **Calendar** remains the week/month map)
- **Week peek** is display-only (no day taps); planning navigation goes through **Calendar**
- Tapping a piece in **garments used** opens that **Garment** in the **Digital Closet**
- **Digital Closet** modes: **Pieces** (**Garments**) and **Outfits** (archived committed looks) — not **Fits**
- An **Outfit** appears under Closet → **Outfits** on commit
- Closet **Outfits** uniqueness = **garment set only**; re-committing the same set reuses the archive entry and records wear (e.g. last worn) instead of duplicating
- One **Outfit** identity spans Closet + days: Today/Calendar wear a date against that **Outfit**, they do not mint a new Closet card
- **Occasion** is out for v1; optional **name** on the shared **Outfit** is **user-only** (blank until they name it — not AI-assigned)
- Closet / Today / Calendar / Generator data are **per Wearer account**, not a shared household closet
- Closet → **Pieces**: one grid with **category filter chips** (not department sections, not tag-only)
- Closet chrome: **Pieces | Outfits** mode tabs first; category chips (`All` · `Tops` · `Bottoms` · `Shoes`) only under **Pieces** — **Outfits** is not a garment-category chip; chip ids match `garment_category` (`tops` | `bottoms` | `shoes`)
- **Today** hero primary path is **wearer photo / try-on** (not AI editorial as the default hero)
- Try-on uses one saved **Wearer photo** per account; AI composites the day’s garments onto it for the hero
- Missing **Wearer photo**: soft prompt + **AI editorial** hero fallback (not a hard gate); try-on when the photo exists
- Add/replace **Wearer photo** via **Today** soft CTA when missing, and anytime in **Settings**
- First implementation slice: routing + **Today** shell (nav, `/` / `/closet`, hero/CTAs on existing data; editorial heroes OK) **and** a **full signed-out landing rewrite** (promise + purge Style DNA/weather/old names)
- Signed-out marketing promise: decide what to wear today from clothes you already own (closet / try-on are support, not the headline)
- Removing a **Garment** is **archive/hide** (soft): leave historical **Outfits** intact; hide from active Closet / future Fits
- Archived **Garments** are managed in **Settings** only; Closet **Pieces** shows active inventory
- If today’s **Outfit** still includes an archived **Garment**, leave the commitment as-is (optional soft note); don’t auto-Unwear or strip pieces
- Closet → **Outfits** cards: hero + optional name + **last worn** (date) — not wear-count or garment-thumbnail grids for v1; unnamed Outfits show without a title (or a quiet fallback like “Outfit”)
- Empty **Today** (has **Garments**, no Fit/Outfit): minimal copy (“No look for today yet”) + one primary button **Plan my week** (generates **Weekly Fits**)
- Tap Closet → **Outfits** card → **detail** (not instant wear); detail offers **Wear today** to assign that **Outfit** to today
- **Wear today** from Closet when today already has an **Outfit**: **confirm** before replace (unlike Generator approve, which replaces silently)
- Calendar day detail (non-today): **past = view only**; **future = can Wear this** on a Fit for that date — not full Today parity (no Change look / Unwear clone)
- Future day that already has an **Outfit**: **view only** in Calendar — change it when that day becomes **Today**
- **Add clothes** lives on **Closet** (FAB / add flow); **Today** zero-garment CTA only navigates to Closet — no second upload surface
- **Plan my week**: stay on **Today** with loading on the button; success → today’s **Fit**; failure → empty state + error + retry (no full-screen block, no Calendar hop, no optimistic fake hero)
- If the **Fit**/**Outfit** is ready but the hero image is not: show **Today** immediately with a garment collage / skeleton in the hero; swap in try-on or editorial when ready (don’t block CTAs or the whole screen)
- Name / rename an **Outfit** only in Closet → **Outfits** detail (not on Today)
- **Weekly Fits** covers the **calendar week** containing today, but **only today and later** in that week (never days before today)
- Calendar week starts **Sunday** (fixed product convention)
- “Today” and week boundaries use a **fixed product timezone**: **America/New_York** (not wearer-local, not UTC day)
- **Garment** favorites: Closet browsing pin only — no AI preference bias when generating Fits/Outfits
- Closet → **Pieces** filters: category chips + **color facets** + search (keep current Closet filter set)
- Signed-out landing first viewport: **full-bleed** wardrobe/atmosphere photo, **Project Blue Jeans** as hero brand, one promise line, one CTA group — not a Today UI mock or typographic-only hero
- Landing below the fold (locked for rewrite): **(1)** How it works — three steps: add clothes → **Plan my week** → **Wear this**; **(2)** From clothes you own — one imagery strip/proof; **(3)** closing CTA. No Style DNA, weather, sanctuary collage, or feature-card grids. Motion: subtle hero/image presence only (2–3 intentional beats)
- Dismissing **Outfit Generator** after options were generated: **confirm discard**; if confirmed, Today unchanged (no silent Fit save). No confirm if they only edited prompt/chips or the sheet is empty.

## Example dialogue

> **Dev:** "Should the home screen be the closet grid?"
> **Domain expert:** "No — **Today** answers the **Primary job**. The **Digital Closet** is inventory."

> **Dev:** "Wednesday has a saved outfit and a weekly suggestion — which does **Today** show?"
> **Domain expert:** "The **Outfit**. A **Fit** only shows when nothing is committed."

> **Dev:** "Nothing for today — Generator or Weekly Fits?"
> **Domain expert:** "Generate **Weekly Fits**, but land back on **Today** with today’s **Fit** featured."

> **Dev:** "Approve the Fit in Calendar?"
> **Domain expert:** "No. **Wear this** on **Today** makes the **Outfit**."

> **Dev:** "What’s Generator for?"
> **Domain expert:** "Re-roll *today* when the **Fit** or **Outfit** is wrong. It doesn’t plan the week."

> **Dev:** "Empty closet?"
> **Domain expert:** "**Add clothes** only. No Weekly Fits until there are **Garments**."

> **Dev:** "Generator in the sidebar?"
> **Domain expert:** "No — **Today**, **Closet**, **Calendar**. Generator from **Today**."

> **Dev:** "URL for Today?"
> **Domain expert:** "`/` — marketing signed out, **Today** signed in. Closet is `/closet`."

> **Dev:** "Generator approve — Fit or Outfit?"
> **Domain expert:** "**Outfit** for today. Same commitment as **Wear this**."

> **Dev:** "Today layout — hero or garment stack?"
> **Domain expert:** "**Hero look**. One image, one answer. Week strip and flatlay stay secondary."

> **Dev:** "CTAs under the hero?"
> **Domain expert:** "**Fit**: **Wear this** + **Change look**. **Outfit**: **Change look** + quiet **Unwear**."

> **Dev:** "Under the hero — garments, week, both, or neither?"
> **Domain expert:** "Both: **garments used**, then a thin **week peek**. Calendar stays the map."

> **Dev:** "Tap a day in the week peek?"
> **Domain expert:** "No — peek is display-only. Use **Calendar** to plan."

> **Dev:** "Tap a garment under the hero?"
> **Domain expert:** "Open that **Garment** in the **Digital Closet**."

> **Dev:** "What’s in Closet — garments only?"
> **Domain expert:** "**Pieces** and **Outfits** tabs. **Fits** stay out."

> **Dev:** "When does an Outfit hit Closet → Outfits?"
> **Domain expert:** "On commit. Same garment combo doesn’t create a duplicate archive entry."

> **Dev:** "Same blazer+tee+jeans Friday after Monday — new Closet card?"
> **Domain expert:** "No. Same garment set = same archived look; bump last worn. Occasion doesn’t fork a new card."

> **Dev:** "Is ‘Outfit’ the day row or the Closet recipe?"
> **Domain expert:** "One **Outfit**. Closet lists it once; days wear that same identity."

> **Dev:** "Occasion on the Outfit or the day?"
> **Domain expert:** "Neither for v1. Optional user **name** on the **Outfit** — blank until they set it."

> **Dev:** "Shared closet or per user?"
> **Domain expert:** "**One closet per Wearer account.** Not household-shared."

> **Dev:** "Pieces — sections or filters?"
> **Domain expert:** "One grid, **category chips** as filters."

> **Dev:** "Outfits in the same chip row as Tops?"
> **Domain expert:** "No. **Pieces | Outfits** tabs; chips only under Pieces."

> **Dev:** "Is Calendar the planner?"
> **Domain expert:** "No — overview map. Commit on **Today** (or Generator). Calendar isn’t home."

> **Dev:** "Tap a Calendar day?"
> **Domain expert:** "If it’s today → **Today**. Otherwise in-Calendar detail — no Today-clone per date."

> **Dev:** "Today hero — AI editorial or wearer photo?"
> **Domain expert:** "**Wearer photo / try-on** as the primary hero path."

> **Dev:** "New body shot every generate?"
> **Domain expert:** "No — one saved **Wearer photo** per account; composite onto that."

> **Dev:** "No Wearer photo yet?"
> **Domain expert:** "Soft prompt. **AI editorial** fallback — don’t hard-gate Today."

> **Dev:** "Where do they add the Wearer photo?"
> **Domain expert:** "**Today** soft CTA when missing; **Settings / Profile** to replace anytime."

> **Dev:** "Settings in the sidebar?"
> **Domain expert:** "No — account menu. Primary nav stays **Today · Closet · Calendar**."

> **Dev:** "Marketing headline?"
> **Domain expert:** "Decide what to wear today from clothes you own — not closet-first or try-on-first."

> **Dev:** "What do we build first?"
> **Domain expert:** "Routing + **Today** shell — home that matches the glossary; try-on and per-account isolation follow."

> **Dev:** "Change look when today is already an Outfit?"
> **Domain expert:** "Approve **replaces** it in place — still an **Outfit**, no demote step."

> **Dev:** "Clear today’s Outfit without a new pick?"
> **Domain expert:** "**Unwear** — back to the prior **Fit**, or empty CTA if none."

> **Dev:** "Unwear — delete from Closet Outfits?"
> **Domain expert:** "Only if it was never worn any other day. Otherwise keep the recipe; just detach today."

> **Dev:** "Re-run Weekly Fits mid-week?"
> **Domain expert:** "Refresh **Fits**. Never overwrite **Outfits**."

> **Dev:** "Where’s the refresh control?"
> **Domain expert:** "**Calendar** — week overview. Empty **Today** still generates; Today doesn’t host mid-week refresh."

> **Dev:** "Delete a shirt that’s in past Outfits?"
> **Domain expert:** "**Archive/hide** it. History stays; it’s gone from the active Closet."

> **Dev:** "Where do archived pieces live?"
> **Domain expert:** "**Settings** only. Closet stays active inventory."

> **Dev:** "Archive a piece in today’s Outfit?"
> **Domain expert:** "Leave the **Outfit**. Soft note is fine — no auto-Unwear."

> **Dev:** "Generator — chat or form?"
> **Domain expert:** "Hybrid: short prompt + chips → options → approve. Not free chat."

> **Dev:** "Must-wear? How many options?"
> **Domain expert:** "Call it **Include** — optional. **Up to three** options; fewer if the closet is thin."

> **Dev:** "Generator — page or sheet?"
> **Domain expert:** "**Sheet** over **Today**. Approve returns to the hero."

> **Dev:** "Empty Today — big illustration?"
> **Domain expert:** "Minimal: one line + **Plan my week**. One job."

> **Dev:** "Exact button label?"
> **Domain expert:** "**Plan my week**."

> **Dev:** "Empty closet on Today?"
> **Domain expert:** "Same minimal pattern — **Add clothes** only. Stay on Today."

> **Dev:** "Closet Outfits card?"
> **Domain expert:** "Hero, optional name, **last worn**. That’s enough."

> **Dev:** "Tap an Outfits card?"
> **Domain expert:** "Detail first. **Wear today** from there — not on the grid tap."

> **Dev:** "Wear today but today is already committed?"
> **Domain expert:** "**Confirm** before replace. Generator approve stays silent."

> **Dev:** "Calendar day that isn’t today?"
> **Domain expert:** "Past: view only. Future: can **Wear this** on a Fit. Not a Today clone."

> **Dev:** "Future day already has an Outfit?"
> **Domain expert:** "View only until that day is **Today**."

> **Dev:** "Add clothes from Today?"
> **Domain expert:** "CTA goes to **Closet**. Upload lives there."

> **Dev:** "Plan my week loading / fail?"
> **Domain expert:** "Stay on **Today**. Loading on the button; error + retry if it fails."

> **Dev:** "Fit ready, hero still cooking?"
> **Domain expert:** "Show **Today** now — collage/skeleton in the hero; upgrade when the image lands."

> **Dev:** "Who sets the Outfit name?"
> **Domain expert:** "The wearer. Blank until they name it — not AI."

> **Dev:** "Rename on Today?"
> **Domain expert:** "No — Closet → **Outfits** detail only."

> **Dev:** "What days does Weekly Fits fill?"
> **Domain expert:** "This **calendar week**, from **today** forward — not yesterday."

> **Dev:** "Week starts when?"
> **Domain expert:** "**Sunday**."

> **Dev:** "Whose midnight is today?"
> **Domain expert:** "Product timezone **America/New_York** — fixed for v1."

> **Dev:** "Favorites bias the AI?"
> **Domain expert:** "No — Closet pin for browsing only."

> **Dev:** "Color filters in Closet?"
> **Domain expert:** "Keep them — category chips, color facets, and search."

> **Dev:** "Marketing with Today work?"
> **Domain expert:** "**Full landing rewrite** alongside Today routing — match the promise, purge old claims."

> **Dev:** "Landing first viewport?"
> **Domain expert:** "Full-bleed photo, brand as hero, one promise, one CTA. No UI mock."

> **Dev:** "Rest of the landing?"
> **Domain expert:** "How it works → owned-clothes proof → closing CTA. Agent owns the visual craft within that."

> **Dev:** "Close Generator without approving?"
> **Domain expert:** "Confirm discard if options exist. Don’t silently save a Fit."

> **Dev:** "Confirm if they only typed a prompt?"
> **Domain expert:** "No — only after options were generated."

## Flagged ambiguities

- Generator UI is still a chat lookbook — hybrid **Include**/**Avoid** chips ahead of code; **sheet over Today**, today-scoped approve → **Outfit**, and discard-confirm are shipped.
- Admin-gated invite list remains; Closet / Today / Calendar / Generator / Wearer photo data are scoped by Neon Auth `user.id` (cache tags per account). Existing DBs need `db/migrate-per-account.sql` (+ optional claim `UPDATE` for pre-isolation rows).
- Closet **Pieces | Outfits** mode tabs, garment-set uniqueness (`outfit_wears` + `garment_set_key`), detail **Wear today** (+ replace confirm), and user rename are shipped. Existing DBs need `db/migrate-outfit-wears.sql`.
- **Wearer photo** + try-on hero path shipped (Settings + Today soft CTA; Generator / Weekly Fits use try-on when a photo exists, editorial fallback otherwise). Existing DBs need `db/migrate-wearer-profile.sql`. Soft-delete garment archive still ahead.
- Slice E shipped: per **Wearer account** isolation (`user_id` on garments / outfits / wears / weekly plans; `wearer_profile` keyed by user).

## Deferred

- **Style DNA** and **weather-aware** dressing: cut from marketing for now; revisit later (occasion → weather → Style DNA).
- **Occasion** (and per-wear labels): deferred with Style DNA / weather; optional Outfit **name** only for now.
- Multi-wearer profiles under one login (partner / kid): deferred.
- Soft-delete garment archive; hybrid Generator Include/Avoid chips; Style DNA / weather later.
- Former marketing names (**The Digital Atelier**, **Curated Canvas**) retired; purge in a rename pass (included in landing rewrite).
- Former term **Draft Look** retired in favor of **Fit**.
- Landing visual craft (exact photography, type, motion) owned at implementation time within the locked structure in Relationships.
