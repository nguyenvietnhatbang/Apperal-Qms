import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies generated scrypt hashes", async () => {
    const hash = await hashPassword("Admin@123");
    await expect(verifyPassword("Admin@123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("verifies the seeded admin hash", async () => {
    const seed =
      "scrypt:16384:8:1:3fae3ef7183265126731e214ae787763:4b1df4f6c3c88710843fa189029411fa68c4066d1132148cfc0373335422979e6500e7cf14762a630650fa3f8a2f0533ab26815181c00f425e429e7d9da8f916";
    await expect(verifyPassword("Admin@123", seed)).resolves.toBe(true);
  });
});
