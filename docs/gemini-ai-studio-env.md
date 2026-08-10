# Google AI Studio (Gemini Developer API) environment

All Gemini usage in this app goes through the **Gemini Developer API** (Google AI Studio), not Vertex AI. Configure the following for **local dev** and **production**.

## Required

| Variable                        | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`  | API key from [Google AI Studio](https://aistudio.google.com/apikey).        |

Store the value **raw** (no surrounding quotes). The app strips accidental wrapping quotes from this key if present.

## Models

| Role                         | Model ID                           |
| ---------------------------- | ---------------------------------- |
| Structured plan / garment AI | `gemini-3.6-flash`                 |
| Hero / try-on image          | `gemini-3.1-flash-image-preview`   |

Defined in `lib/ai/gemini-models.ts`.

## Product URLs in garment notes

Closet edit / describe flows extract `http(s)` links from notes and enable Gemini’s built-in **`url_context`** tool so the model reads those public pages (up to 20 URLs). No server-side HTML scrape.

## Weekly cron (`/api/cron/weekly-outfits`)

The cron handler runs **in one serverless invocation**: **seven parallel** step-1 calls (one outfit per weekday via `runStep1PlanWithRetry` with `lookCount: 1`), then **seven parallel** `runHeroImageStep` calls—same models as the outfit generator.

- Set **`export const maxDuration = 300`** on the route (works on Vercel Pro+). Parallel calls shorten wall time but increase burst quota usage.

## What uses what

- **Lookbook step 1 / step 2, closet image analysis, weekly hero images** — AI Studio via `@ai-sdk/google` / `geminiModel()` in `lib/ai/gemini-provider.ts`.

## Local quick check

```bash
export GOOGLE_GENERATIVE_AI_API_KEY=your-ai-studio-key
```

Then run the app and hit the flows that call Gemini.
