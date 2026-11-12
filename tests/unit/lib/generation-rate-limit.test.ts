import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function Redis() {
    return redis;
  }),
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import {
  consumeGeneration,
  GENERATIONS_PER_WINDOW,
} from "@/lib/generation-rate-limit";

const configured = {
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "token",
  NODE_ENV: "test",
} as unknown as NodeJS.ProcessEnv;

describe("consumeGeneration", () => {
  beforeEach(() => {
    redis.incr.mockReset();
    redis.expire.mockReset();
    redis.ttl.mockReset();
  });

  it("does nothing without Upstash credentials", async () => {
    const res = await consumeGeneration("u1", {} as NodeJS.ProcessEnv);
    expect(res).toEqual({ allowed: true });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("starts the window on the first generation", async () => {
    redis.incr.mockResolvedValue(1);
    const res = await consumeGeneration("u1", configured);
    expect(res).toEqual({ allowed: true });
    expect(redis.incr).toHaveBeenCalledWith(
      "project-blue-jeans:test:generation:u1",
    );
    expect(redis.expire).toHaveBeenCalledWith(
      "project-blue-jeans:test:generation:u1",
      3600,
    );
  });

  it("allows up to the limit", async () => {
    redis.incr.mockResolvedValue(GENERATIONS_PER_WINDOW);
    expect(await consumeGeneration("u1", configured)).toEqual({
      allowed: true,
    });
  });

  it("refuses past the limit and says how long to wait", async () => {
    redis.incr.mockResolvedValue(GENERATIONS_PER_WINDOW + 1);
    redis.ttl.mockResolvedValue(600);
    const res = await consumeGeneration("u1", configured);
    expect(res).toEqual({
      allowed: false,
      message: expect.stringContaining("Try again in 10 minutes"),
    });
  });

  it("lets the request through when Redis fails", async () => {
    redis.incr.mockRejectedValue(new Error("down"));
    expect(await consumeGeneration("u1", configured)).toEqual({
      allowed: true,
    });
  });
});
