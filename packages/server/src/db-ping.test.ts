import { describe, it, expect } from "vitest";
import { pingPostgres } from "./db-ping.js";

describe("PostgreSQL 16 Docker Infrastructure", () => {
  it("should successfully ping PostgreSQL over port 5432 and exchange protocol packets", async () => {
    const isAlive = await pingPostgres("127.0.0.1", 5432);
    expect(isAlive).toBe(true);
  });
});
