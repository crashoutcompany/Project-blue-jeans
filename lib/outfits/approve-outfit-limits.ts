/** Outfit name max length when saving from generator / weekly flows. */
export const APPROVE_OUTFIT_MAX_NAME = 200;

/**
 * Max `imageUrl` length for approve payloads. Generator heroes are owned
 * `/api/media/<id>` paths, so anything longer is not a hero we issued.
 */
export const APPROVE_OUTFIT_MAX_IMAGE_URL_LEN = 2048;
