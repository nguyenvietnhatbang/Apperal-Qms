import { type ZodType } from "zod";
import { validationError } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throw validationError("JSON không hợp lệ");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw validationError("Dữ liệu không hợp lệ", parsed.error.flatten());
  }

  return parsed.data;
}

export function parseSearch<T>(searchParams: URLSearchParams, schema: ZodType<T>): T {
  const values = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(values);

  if (!parsed.success) {
    throw validationError("Tham số truy vấn không hợp lệ", parsed.error.flatten());
  }

  return parsed.data;
}

export function nullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
