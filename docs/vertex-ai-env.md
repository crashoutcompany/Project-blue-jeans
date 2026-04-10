# Vertex AI environment variables

All Gemini usage in this app goes through **Vertex AI** (not the Gemini Developer API). Configure the following for **local dev** and **production**.

## Required

| Variable | Description |
|----------|-------------|
| `GOOGLE_VERTEX_PROJECT` | GCP **project ID** (string), e.g. `my-app-prod`. |

## Region

| Variable | Description |
|----------|-------------|
| `GOOGLE_VERTEX_LOCATION` | Optional. Vertex region, default **`us-central1`**. Use `global` only if you intentionally use the [global endpoint](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#global-endpoint). |

## Authentication (pick what fits your runtime)

| Variable | Description |
|----------|-------------|
| `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` | **Recommended on Vercel**: full JSON body of a GCP **service account key** (single-line or minified). Must be valid JSON; if it is malformed, the app will still think credentials exist and Vertex will fall back to ADC and fail with “Could not load the default credentials”. |
| `GOOGLE_APPLICATION_CREDENTIALS` | **Local**: absolute path to a service account JSON key file. |
| `GOOGLE_VERTEX_USE_ADC` | Set to **`1`** to use **Application Default Credentials** only (no inline JSON). **Local:** run `gcloud auth application-default login` and set `GOOGLE_VERTEX_PROJECT` (and optional `GOOGLE_VERTEX_LOCATION`). |

On **Cloud Run** (and similar), you can omit the JSON env vars if the service runs as a service account with the right IAM roles (`K_SERVICE` is set).

Enable **Vertex AI API** on the project and ensure billing is active.

## Usage in the console

Open **[Vertex AI Studio](https://console.cloud.google.com/vertex-ai/studio)** in Google Cloud Console (pick the correct project) to explore models, try prompts, and review **usage** / activity for generative AI on that project.

## Weekly cron (`/api/cron/weekly-outfits`)

The cron handler runs **in one serverless invocation**: **seven parallel** step-1 calls (one outfit per weekday via `runStep1PlanWithRetry` with `lookCount: 1`), then **seven parallel** `runHeroImageStep` calls—same models as the outfit generator.

- Set **`export const maxDuration = 300`** on the route (works on Vercel Pro+). Parallel calls shorten wall time but increase burst quota usage on Vertex.
- No Cloud Storage bucket is required.

## What uses what

- **Lookbook step 1 / step 2, closet image analysis, weekly hero images** — Vertex via `@ai-sdk/google-vertex` / `geminiModel()` in `lib/ai/gemini-provider.ts` and `lib/ai/lookbook/step2-image.ts`.

## Local quick check

```bash
export GOOGLE_VERTEX_PROJECT=your-project-id
export GOOGLE_VERTEX_LOCATION=us-central1
export GOOGLE_APPLICATION_CREDENTIALS=$HOME/.config/gcp/sa.json
```

Then run the app and hit the flows that call Gemini.
