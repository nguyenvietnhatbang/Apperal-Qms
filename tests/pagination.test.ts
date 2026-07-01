import { describe, expect, it } from "vitest";
import { parsePagination, parseSort } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("normalizes page, limit and offset", () => {
    const params = new URLSearchParams("page=3&limit=25");
    expect(parsePagination(params)).toEqual({ page: 3, limit: 25, offset: 50 });
  });

  it("whitelists sort columns", () => {
    const sort = parseSort(new URLSearchParams("sort=-unsafe"), { code: "code" }, "code");
    expect(sort).toEqual({ key: "unsafe", column: "code", direction: "DESC" });
  });
});
