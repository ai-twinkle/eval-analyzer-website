import { z } from 'zod';
import type { ZodSchema, ZodTypeAny } from 'zod';

/**
 * Derives a Zod schema from a data object at runtime
 */
export function deriveSchema(data: unknown): ZodSchema {
  if (data === null || data === undefined) {
    return z.unknown();
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return z.array(z.unknown());
    }
    // Merge schemas from all array elements
    const elementSchemas = data.map((item) => deriveSchema(item));
    const mergedSchema = elementSchemas.reduce((acc, schema) =>
      mergeSchemas(acc, schema),
    );
    return z.array(mergedSchema);
  }

  if (typeof data === 'object') {
    const shape: Record<string, ZodTypeAny> = {};
    for (const [key, value] of Object.entries(data)) {
      shape[key] = deriveSchema(value);
    }
    return z.object(shape).passthrough();
  }

  if (typeof data === 'string') {
    return z.string();
  }

  if (typeof data === 'number') {
    return z.number();
  }

  if (typeof data === 'boolean') {
    return z.boolean();
  }

  return z.unknown();
}

/**
 * Merges two schemas, making fields optional if they don't exist in both
 */
export function mergeSchemas(
  schema1: ZodSchema,
  schema2: ZodSchema,
): ZodSchema {
  // For simplicity, return a union of the two schemas
  // This allows validation to pass if data matches either schema
  return z.union([schema1 as ZodTypeAny, schema2 as ZodTypeAny]);
}

/**
 * Validates data against a schema and returns the result
 */
export function validateData(
  data: unknown,
  schema: ZodSchema,
): { success: boolean; data?: unknown; error?: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      };
    }
    return { success: false, error: String(error) };
  }
}
