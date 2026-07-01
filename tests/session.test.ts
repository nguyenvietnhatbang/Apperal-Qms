import { describe, expect, it } from "vitest";
import { hashSessionToken } from "@/lib/auth-session";

describe("session hashing", () => {
  it("hashes tokens deterministically without returning the plain token", () => {
    const token = "sample-token";
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toHaveLength(64);
  });
});
