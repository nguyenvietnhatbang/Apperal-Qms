import { z } from "zod";

export type PaginationInput = {
  page: number;
  limit: number;
  offset: number;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePagination(searchParams: URLSearchParams): PaginationInput {
  const parsed = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  return {
    ...parsed,
    offset: (parsed.page - 1) * parsed.limit,
  };
}

export function parseSort(
  searchParams: URLSearchParams,
  allowed: Record<string, string>,
  defaultSort: string,
) {
  const requested = searchParams.get("sort") ?? defaultSort;
  const direction = requested.startsWith("-") ? "DESC" : "ASC";
  const key = requested.replace(/^-/, "");
  const column = allowed[key] ?? allowed[defaultSort.replace(/^-/, "")];

  return { key, column, direction };
}
