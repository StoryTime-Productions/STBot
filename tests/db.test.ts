import { describe, expect, it } from "vitest";
import { db } from "../src/lib/db.js";

describe("db", () => {
  it("constructs a Prisma client without connecting", () => {
    expect(db).toBeDefined();
    expect(typeof db.$connect).toBe("function");
  });
});
