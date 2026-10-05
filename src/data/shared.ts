/**
 * Schema pieces shared by every product category.
 *
 * Cameras, NVRs, PoE switches and hard drives each live in their own data file
 * against their own schema, but the rules that make a datasheet entry
 * trustworthy are the same for all of them and are defined exactly once here:
 *
 *   - every entry names the manufacturer datasheet it was read from;
 *   - every entry carries the date a human verified it against that datasheet;
 *   - anything the datasheet does not state is `null`, never a guess;
 *   - price band is editorial and is labelled as such wherever it is shown.
 */

import { z } from 'zod';

export const poeStandardSchema = z.enum([
  '802.3af',
  '802.3at',
  '802.3bt-type3',
  '802.3bt-type4',
  'none',
]);
export type PoeStandardId = z.infer<typeof poeStandardSchema>;

export const priceTierSchema = z.enum(['economy', 'standard', 'premium']);
export type PriceTier = z.infer<typeof priceTierSchema>;

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const datasheetUrlSchema = z.string().url();

/** Stable kebab-case key used in URLs, project files and bills of materials. */
export const productIdSchema = z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case');

export const nullableNumber = z.number().finite().nullable();
export const nullablePositive = z.number().finite().positive().nullable();
export const nullableNonNegativeInt = z.number().int().min(0).nullable();

/**
 * The fields every product entry must carry, whatever its category. Spread into
 * each category's object schema.
 */
export const provenanceShape = {
  id: productIdSchema,
  model: z.string().min(1),
  marketingName: z.string().min(1),
  datasheetUrl: datasheetUrlSchema,
  verifiedOn: isoDateSchema,
  priceTier: priceTierSchema,
  notes: z.string().nullable(),
} as const;

/** Envelope for a category data file. */
export function datasetSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      schemaVersion: z.literal(1),
      datasetVerifiedOn: isoDateSchema,
      source: z.string().min(1),
      items: z.array(item).min(1),
    })
    .strict()
    .superRefine((data, ctx) => {
      const seen = new Set<string>();
      data.items.forEach((entry: unknown, i: number) => {
        const id = (entry as { id?: unknown }).id;
        if (typeof id !== 'string') return;
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', i, 'id'],
            message: `Duplicate id "${id}"`,
          });
        }
        seen.add(id);
      });
    });
}

export class ProductDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductDataError';
  }
}

/** Validate a category file and fail loudly, naming the offending path. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, fileName: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ProductDataError(
      `${fileName} failed validation (${result.error.issues.length} issue(s)):\n${issues}`,
    );
  }
  return result.data;
}
