import { z } from 'zod';

/**
 * Domain schemas. These are the contract between the vision provider, the
 * pipeline, the database and both clients — validated at every boundary so a
 * malformed model response can never reach a render.
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Normalised bounding box, [x0, y0, x1, y1] in 0–1 image space.
 *
 * Normalised rather than pixel coordinates because the same box has to work
 * against the original upload, the downscaled analysis raster, the web card and
 * three different share-card sizes.
 */
export const bboxSchema = z
  .tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ])
  .refine(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0, {
    message: 'bbox must have positive width and height',
  });

export type BBox = z.infer<typeof bboxSchema>;

export const rectSchema = z.object({
  x0: z.number().min(0).max(1),
  y0: z.number().min(0).max(1),
  x1: z.number().min(0).max(1),
  y1: z.number().min(0).max(1),
});

export type Rect = z.infer<typeof rectSchema>;

// ---------------------------------------------------------------------------
// Garment taxonomy
// ---------------------------------------------------------------------------

export const GARMENT_CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'footwear',
  'bag',
  'accessory',
  'jewellery',
  'headwear',
  'eyewear',
  'watch',
] as const;

export const garmentCategorySchema = z.enum(GARMENT_CATEGORIES);
export type GarmentCategory = z.infer<typeof garmentCategorySchema>;

/** Categories we lead with on a card when we have to choose. */
export const PRIMARY_CATEGORIES: readonly GarmentCategory[] = [
  'outerwear',
  'dress',
  'top',
  'bottom',
  'footwear',
  'bag',
] as const;

export const patternSchema = z.enum([
  'solid',
  'striped',
  'plaid',
  'floral',
  'geometric',
  'animal',
  'graphic',
  'colorblock',
  'other',
]);

// ---------------------------------------------------------------------------
// Vision output
// ---------------------------------------------------------------------------

export const visionItemSchema = z.object({
  category: garmentCategorySchema,
  /** e.g. "cropped hoodie", "wide-leg jeans" */
  subtype: z.string().min(1).max(80),
  /**
   * Only ever set when a logo or wordmark is genuinely visible. Hallucinated
   * brands are the fastest way to destroy trust in this product, so the prompt
   * demands null over a guess and the pipeline never invents one downstream.
   */
  brand: z.string().min(1).max(80).nullable(),
  colors: z.array(z.string().min(1).max(40)).min(1).max(4),
  pattern: patternSchema,
  material: z.string().max(60).nullable(),
  styleTags: z.array(z.string().min(1).max(40)).max(12),
  /** One sentence, shown under the item on the look page. */
  description: z.string().min(1).max(240),
  /** What we hand to the product search provider. */
  searchQuery: z.string().min(2).max(160),
  bbox: bboxSchema,
  confidence: z.number().min(0).max(1),
  isPrimary: z.boolean(),
});

export type VisionItem = z.infer<typeof visionItemSchema>;

export const visionScoreSchema = z.object({
  fit: z.number().min(0).max(100),
  colorStory: z.number().min(0).max(100),
  texture: z.number().min(0).max(100),
  statement: z.number().min(0).max(100),
  cohesion: z.number().min(0).max(100),
});

/**
 * Safety verdict. Required for App Store guideline 1.2 — a flagged upload is
 * quarantined before it can reach the public feed.
 */
export const visionSafetySchema = z.object({
  flagged: z.boolean(),
  reasons: z.array(z.string().max(80)).max(8),
});

export const visionResultSchema = z.object({
  items: z.array(visionItemSchema).max(12),
  styleTags: z.array(z.string().min(1).max(40)).max(16),
  score: visionScoreSchema,
  captionSuggestions: z.array(z.string().min(1).max(120)).max(4),
  safety: visionSafetySchema,
});

export type VisionResult = z.infer<typeof visionResultSchema>;

// ---------------------------------------------------------------------------
// Product resolution
// ---------------------------------------------------------------------------

export const productCandidateSchema = z.object({
  title: z.string().min(1).max(240),
  brand: z.string().max(80).nullable(),
  /** Retailer name as reported by the search provider. */
  source: z.string().min(1).max(80),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default('USD'),
  merchantUrl: z.string().url(),
  imageUrl: z.string().url().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  /** Set when the listing is explicitly resale/secondhand. */
  isSecondhand: z.boolean().default(false),
});

export type ProductCandidate = z.infer<typeof productCandidateSchema>;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const layoutSlotSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  side: z.enum(['left', 'right']),
  rect: rectSchema,
  /** Where the leader line lands — the centroid of the garment bbox. */
  anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
});

export const lookLayoutSchema = z.object({
  /** Horizontal span the person occupies, so nothing lands on top of her. */
  subject: z.object({ x0: z.number().min(0).max(1), x1: z.number().min(0).max(1) }),
  slots: z.array(layoutSlotSchema),
  /** Items we could not place without collision. Rendered in the rail only. */
  unplaced: z.array(z.number().int().nonnegative()),
});

export type LookLayout = z.infer<typeof lookLayoutSchema>;
export type LayoutSlot = z.infer<typeof layoutSlotSchema>;

// ---------------------------------------------------------------------------
// Look lifecycle
// ---------------------------------------------------------------------------

export const LOOK_STATUSES = ['draft', 'processing', 'ready', 'failed', 'quarantined'] as const;

export const lookStatusSchema = z.enum(LOOK_STATUSES);
export type LookStatus = z.infer<typeof lookStatusSchema>;

export const PIPELINE_STAGES = [
  'ingest',
  'vision',
  'resolve',
  'imagery',
  'affiliate',
  'layout',
  'render',
  'publish',
] as const;

export const pipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const visibilitySchema = z.enum(['public', 'unlisted', 'private']);
export type Visibility = z.infer<typeof visibilitySchema>;

// ---------------------------------------------------------------------------
// API inputs
// ---------------------------------------------------------------------------

export const handleSchema = z
  .string()
  .min(2)
  .max(24)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers and underscores only');

export const createLookSchema = z.object({
  photoPath: z.string().min(1),
  caption: z.string().max(280).optional(),
  visibility: visibilitySchema.default('public'),
});

export const updateLookItemSchema = z.object({
  /** Users can correct a wrong match. Trust depends on this being possible. */
  brand: z.string().max(80).nullable().optional(),
  title: z.string().max(240).optional(),
  productId: z.string().uuid().nullable().optional(),
});

export const createVaultSchema = z.object({
  name: z.string().min(1).max(48),
  isPublic: z.boolean().default(false),
});

export const reportSchema = z.object({
  targetType: z.enum(['look', 'user', 'comment']),
  targetId: z.string().uuid(),
  reason: z.enum(['nudity', 'harassment', 'spam', 'impersonation', 'violence', 'other']),
  detail: z.string().max(500).optional(),
});

export const feedQuerySchema = z.object({
  tab: z.enum(['for-you', 'fresh', 'top']).default('for-you'),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
