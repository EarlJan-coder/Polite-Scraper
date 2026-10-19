// The schema is the recipe: which fields a finished record must have, what
// type each one is, and how the raw text becomes a real number.
import { z } from 'zod';

export const BookRecordSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.enum(['One', 'Two', 'Three', 'Four', 'Five']),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime(),
});

/**
 * Validate one raw record and add the cleaned price.
 * Returns { ok: true, record } or { ok: false, reasons: string[] }.
 * The raw price_text is always kept beside the clean price_gbp.
 */
export function normalizeRecord(raw) {
  const price_gbp = Number(String(raw?.price_text ?? '').replace(/[^\d.]/g, ''));
  const result = BookRecordSchema.safeParse({ ...raw, price_gbp });
  if (result.success) return { ok: true, record: result.data };
  return {
    ok: false,
    reasons: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
