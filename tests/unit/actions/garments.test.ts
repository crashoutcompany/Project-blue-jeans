import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedForServerAction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { revalidateTag } from "next/cache";

import {
  admitted,
  NOT_ADMITTED_MESSAGE,
  notAdmitted,
} from "@/tests/helpers/admission";
import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { requireSql } from "@/lib/db";
import { closetGarmentsTag } from "@/lib/garments/closet-garments-cache-tag";
import {
  setGarmentRetired,
  toggleGarmentFavorite,
} from "@/app/actions/garments";

const gate = vi.mocked(assertAdmittedForServerAction);
const requireSqlMock = vi.mocked(requireSql);
const revalidateTagMock = vi.mocked(revalidateTag);

const GARMENT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function sqlReturning(rows: unknown) {
  const sql = vi.fn().mockResolvedValue(rows);
  requireSqlMock.mockReturnValue(sql as never);
  return sql;
}

describe("toggleGarmentFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gate.mockResolvedValue(admitted("u1"));
  });

  it("returns the admission error without querying", async () => {
    gate.mockResolvedValue(notAdmitted);
    const sql = sqlReturning([{ id: GARMENT_ID }]);

    await expect(toggleGarmentFavorite(GARMENT_ID)).resolves.toEqual({
      ok: false,
      message: NOT_ADMITTED_MESSAGE,
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id before querying", async () => {
    const sql = sqlReturning([]);

    await expect(toggleGarmentFavorite("not-a-uuid")).resolves.toEqual({
      ok: false,
      message: "Invalid garment id.",
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it("toggles the Wearer's garment and refreshes the closet cache", async () => {
    const sql = sqlReturning([{ id: GARMENT_ID }]);

    await expect(toggleGarmentFavorite(GARMENT_ID)).resolves.toEqual({ ok: true });
    expect(sql.mock.calls[0]?.slice(1)).toEqual([GARMENT_ID, "u1"]);
    expect(revalidateTagMock).toHaveBeenCalledWith(closetGarmentsTag("u1"), "max");
  });

  /**
   * The UPDATE is scoped by user_id, so another account's id simply matches no
   * rows. Reporting ok left the optimistic UI showing a favorite that was
   * never stored.
   */
  it("reports not found when no row was updated", async () => {
    sqlReturning([]);

    await expect(toggleGarmentFavorite(GARMENT_ID)).resolves.toEqual({
      ok: false,
      message: "That piece was not found.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("password authentication failed")) as never,
    );

    await expect(toggleGarmentFavorite(GARMENT_ID)).resolves.toEqual({
      ok: false,
      message: "Could not update that favorite. Try again in a moment.",
    });
  });
});

describe("setGarmentRetired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gate.mockResolvedValue(admitted("u1"));
  });

  it("returns the admission error without querying", async () => {
    gate.mockResolvedValue(notAdmitted);
    const sql = sqlReturning([{ id: GARMENT_ID }]);

    await expect(setGarmentRetired(GARMENT_ID, true)).resolves.toEqual({
      ok: false,
      message: NOT_ADMITTED_MESSAGE,
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id before querying", async () => {
    const sql = sqlReturning([]);

    await expect(setGarmentRetired("nope", true)).resolves.toEqual({
      ok: false,
      message: "Invalid garment id.",
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean flag before querying", async () => {
    const sql = sqlReturning([]);

    await expect(
      setGarmentRetired(GARMENT_ID, "yes" as unknown as boolean),
    ).resolves.toEqual({ ok: false, message: "Invalid request." });
    expect(sql).not.toHaveBeenCalled();
  });

  /** Retire hides the piece: an UPDATE of retired_at, never a DELETE. */
  it("retires the Wearer's piece without deleting it", async () => {
    const sql = sqlReturning([{ id: GARMENT_ID }]);

    await expect(setGarmentRetired(GARMENT_ID, true)).resolves.toEqual({
      ok: true,
    });
    const [strings, ...values] = sql.mock.calls[0]!;
    const text = (strings as string[]).join(" ");
    expect(text).toMatch(/UPDATE garments/);
    expect(text).toMatch(/retired_at/);
    expect(text).not.toMatch(/DELETE/i);
    expect(values).toEqual([true, GARMENT_ID, "u1"]);
    expect(revalidateTagMock).toHaveBeenCalledWith(
      closetGarmentsTag("u1"),
      "max",
    );
  });

  it("unhides a retired piece", async () => {
    const sql = sqlReturning([{ id: GARMENT_ID }]);

    await expect(setGarmentRetired(GARMENT_ID, false)).resolves.toEqual({
      ok: true,
    });
    expect(sql.mock.calls[0]?.slice(1)).toEqual([false, GARMENT_ID, "u1"]);
  });

  it("reports not found when no row was updated", async () => {
    sqlReturning([]);

    await expect(setGarmentRetired(GARMENT_ID, true)).resolves.toEqual({
      ok: false,
      message: "That piece was not found.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("password authentication failed")) as never,
    );

    await expect(setGarmentRetired(GARMENT_ID, false)).resolves.toEqual({
      ok: false,
      message: "Could not unhide that piece. Try again in a moment.",
    });
  });
});
