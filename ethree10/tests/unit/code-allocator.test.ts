import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { allocateWithCode, isCodeCollision } from "@/server/services/code-allocator";

const p2002 = (target: string[] | string | undefined) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: target === undefined ? {} : { target },
  });

describe("collision detection", () => {
  it("recognises a unique violation on the code column", () => {
    expect(isCodeCollision(p2002(["code"]))).toBe(true);
    expect(isCodeCollision(p2002("Task_code_key"))).toBe(true);
  });

  it("ignores a unique violation on a different column", () => {
    // Retrying a slug or email collision would loop pointlessly and bury the
    // real cause behind a different code each time.
    expect(isCodeCollision(p2002(["slug"]))).toBe(false);
    expect(isCodeCollision(p2002(["email"]))).toBe(false);
  });

  it("ignores other Prisma errors and plain errors", () => {
    const notFound = new Prisma.PrismaClientKnownRequestError("nope", {
      code: "P2025",
      clientVersion: "6.19.3",
    });
    expect(isCodeCollision(notFound)).toBe(false);
    expect(isCodeCollision(new Error("boom"))).toBe(false);
    expect(isCodeCollision(null)).toBe(false);
  });
});

describe("code allocation", () => {
  const format = (seq: number) => `TSK-2026-${String(seq).padStart(5, "0")}`;

  it("returns the created row on the first try", async () => {
    const create = vi.fn(async (code: string) => ({ code }));
    const result = await allocateWithCode({ nextSeq: async () => 7, format, create });

    expect(result).toEqual({ code: "TSK-2026-00007" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries after a collision and re-reads the sequence", async () => {
    // The whole point: someone else took the number, so the next read must see
    // their row. Re-using the stale number would collide forever.
    let current = 4;
    const nextSeq = vi.fn(async () => current);
    const create = vi.fn(async (code: string) => {
      if (code === format(4)) {
        current = 5;
        throw p2002(["code"]);
      }
      return { code };
    });

    const result = await allocateWithCode({ nextSeq, format, create });

    expect(result).toEqual({ code: "TSK-2026-00005" });
    expect(nextSeq).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt limit and rethrows the collision", async () => {
    const create = vi.fn(async () => {
      throw p2002(["code"]);
    });

    await expect(
      allocateWithCode({ nextSeq: async () => 1, format, create, attempts: 3 }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("does not retry an unrelated failure", async () => {
    const create = vi.fn(async () => {
      throw new Error("database on fire");
    });

    await expect(allocateWithCode({ nextSeq: async () => 1, format, create })).rejects.toThrow(
      "database on fire",
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not retry a unique violation on another column", async () => {
    const create = vi.fn(async () => {
      throw p2002(["slug"]);
    });

    await expect(
      allocateWithCode({ nextSeq: async () => 1, format, create }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
