import { z } from "zod";
import { badRequest } from "./errors.js";

/** Parses untrusted input and turns zod failures into a consistent 400 response. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw badRequest("Validation failed", details);
  }
  return result.data;
}

export const uuidSchema = z.string().uuid("Must be a valid id");

/** A calendar date in YYYY-MM-DD form; rejects values like 2025-02-30. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Must be a real calendar date");

export const trimmedString = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`);

/** Escapes LIKE wildcards so user search text is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
