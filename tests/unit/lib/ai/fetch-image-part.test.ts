import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_IMAGE_FETCH_TIMEOUT_MS,
  fetchUrlAsImagePart,
  ImageTooLargeError,
  MAX_AI_IMAGE_BYTES,
} from "@/lib/ai/fetch-image-part";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function imageResponse(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
): Response {
  return new Response(streamOf(chunks), {
    status: 200,
    headers: { "content-type": "image/png", ...headers },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchUrlAsImagePart", () => {
  it("returns the body and media type for a normal image", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      imageResponse([new Uint8Array([1, 2]), new Uint8Array([3])]),
    );

    const part = await fetchUrlAsImagePart("https://example.test/a.png");

    expect(part.mediaType).toBe("image/png");
    expect([...part.image]).toEqual([1, 2, 3]);
  });

  it("falls back to jpeg for a non-image content type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      imageResponse([new Uint8Array([1])], {
        "content-type": "application/octet-stream",
      }),
    );

    await expect(
      fetchUrlAsImagePart("https://example.test/a.bin"),
    ).resolves.toMatchObject({ mediaType: "image/jpeg" });
  });

  it("rejects immediately when content-length exceeds the cap", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      imageResponse([new Uint8Array([1])], {
        "content-length": String(MAX_AI_IMAGE_BYTES + 1),
      }),
    );

    await expect(
      fetchUrlAsImagePart("https://example.test/big.png"),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  /** A body that lies about (or omits) its length must still be bounded. */
  it("stops reading once the streamed body passes the cap", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let produced = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(endless, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    await expect(
      fetchUrlAsImagePart("https://example.test/endless.png"),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
    // Reading stops near the cap instead of running until memory is gone.
    // The exact figure depends on stream queuing, so allow generous slack.
    expect(produced).toBeLessThan(MAX_AI_IMAGE_BYTES * 2);
  });

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expect(
      fetchUrlAsImagePart("https://example.test/missing.png"),
    ).rejects.toThrow(/404/);
  });

  it("always passes an abort signal, even with no caller signal", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(imageResponse([new Uint8Array([1])])),
      );

    await fetchUrlAsImagePart("https://example.test/a.png");

    const signal = fetchSpy.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    expect(AI_IMAGE_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("composes the caller signal into the fetch signal", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(imageResponse([new Uint8Array([1])])),
      );

    await fetchUrlAsImagePart("https://example.test/a.png", {
      abortSignal: AbortSignal.abort(),
    });

    // The caller aborted, so the signal handed to fetch is already aborted.
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("times out rather than hanging on a stalled response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });
    });

    await expect(
      fetchUrlAsImagePart("https://example.test/stalled.png", {
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/aborted/);
  });
});
