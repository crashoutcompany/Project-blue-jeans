/** Outfit name max length when saving from generator / weekly flows. */
export const APPROVE_OUTFIT_MAX_NAME = 200;

/**
 * Max `image_url` length for approve payloads. Generator heroes are
 * `data:image/...;base64,...` and are often 0.5–3M+ characters; the previous
 * 120k cap caused `image_url` to be stored as null.
 */
export const APPROVE_OUTFIT_MAX_IMAGE_URL_LEN = 12_000_000;
