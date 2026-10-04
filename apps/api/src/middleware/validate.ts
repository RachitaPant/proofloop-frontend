import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { ValidationErrors } from '@proofloop/shared';

// Formats a Zod issue path the way clients expect: steps[0].stepName
function fieldName(path: PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

// Validates req.body against a shared Zod schema and replaces it with the
// parsed (trimmed, stripped of unknown keys) value. Failures return 400 with a
// flat { field: message } object, first message per field.
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (result.success) {
      req.body = result.data;
      return next();
    }

    const errors: ValidationErrors = {};
    for (const issue of result.error.issues) {
      const key = fieldName(issue.path) || 'body';
      errors[key] ??= issue.message;
    }
    res.status(400).json(errors);
  };
}
