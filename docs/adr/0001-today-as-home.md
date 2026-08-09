# Today is home after sign-in

The product’s primary job is deciding what to wear _today_ from owned clothes. We make **Today** the signed-in home (`/`), not the Digital Closet or Calendar: Closet is inventory, Calendar is a week/month map, and Outfit Generator is a re-roll reached from Today (“Change look”). Commit happens on Today (Wear this / Generator approve → Outfit), so the home surface answers the job instead of browsing infrastructure.

## Considered options

- **Closet as home** (current `/dashboard` shape) — strong for inventory, weak for “what do I wear now?”
- **Calendar as home** — centers planning the week over today’s answer
- **Generator as home** — treats re-roll/chat as the default instead of an exception

## Consequences

- Routing: signed-out `/` stays marketing; signed-in `/` is Today; Closet moves to `/closet`; drop `/dashboard` as the product concept
- Primary nav is **Today · Closet · Calendar**; Settings stays in the account menu
- First implementation slice is routing + Today shell on existing Fit/Outfit data (see `CONTEXT.md`)
