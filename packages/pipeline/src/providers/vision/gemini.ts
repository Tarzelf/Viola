import { GARMENT_CATEGORIES, visionResultSchema, type VisionResult } from '@viola/core';
import type { VisionProvider, VisionRequest } from '../types.js';

/**
 * Gemini vision provider.
 *
 * Flash-class models are the consensus choice for fashion attribute extraction:
 * native JSON-schema structured output, normalised bounding boxes, and roughly
 * $1.60 per 1000 images in reported production pipelines. That price is what
 * makes per-look economics work at all.
 *
 * Called over plain fetch rather than the SDK so this package stays dependency
 * light and trivially mockable at the network layer.
 */

const DEFAULT_MODEL = 'gemini-flash-latest';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * The prompt.
 *
 * Two instructions here are load-bearing and should not be softened:
 *
 *  - **Never guess a brand.** A hallucinated brand is the single fastest way to
 *    destroy trust in the product. "That's not my shirt" is unrecoverable in a
 *    way that "we couldn't identify this" is not.
 *  - **Score generously.** The published scale is already compressed downstream,
 *    but the model should be evaluating what works rather than hunting for
 *    faults. This app exists to make someone feel good about what they wore.
 */
const SYSTEM_PROMPT = `You are a fashion analyst for Viola, an app that identifies the pieces in an outfit photo and helps people find where to buy them.

Analyse the outfit in the photo and return JSON matching the provided schema.

Rules:
1. Identify each distinct garment or accessory that is clearly visible and worn by the main subject. Ignore background people, mannequins and clothing that is not being worn.
2. BRAND: set "brand" only when a logo, wordmark or unmistakable signature design is actually visible in the image. If you are inferring the brand from style alone, set it to null. Never guess. A null brand is always better than a wrong one.
3. bbox is [x0, y0, x1, y1] normalised to 0-1 of the image dimensions, tightly around the garment as worn.
4. searchQuery must be a short shopping query someone would type to find this exact item: include the brand only if you set one, plus the product type, key colour and any distinguishing detail. No punctuation.
5. isPrimary is true for the main pieces of the outfit (top, bottom, dress, outerwear, footwear, standout bag). Small accessories are false.
6. description is one natural sentence describing the piece, written for a shopper. No marketing language.
7. SCORING: rate the outfit 0-100 on each dimension. Be generous and constructive — evaluate what is working. fit = proportion and tailoring; colorStory = how the palette holds together; texture = material interest and contrast; statement = boldness and point of view; cohesion = how deliberate the whole reads.
8. styleTags: 3-8 lowercase aesthetic descriptors for the overall look (e.g. minimalist, y2k, streetwear, coquette, tailored, grunge).
9. safety: set flagged true only for nudity, sexual content, minors in unsafe contexts, violence or hate symbols.

Return only the JSON.`;

/** Mirrors the zod schema; Gemini enforces it server-side. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...GARMENT_CATEGORIES] },
          subtype: { type: 'string' },
          brand: { type: 'string', nullable: true },
          colors: { type: 'array', items: { type: 'string' } },
          pattern: {
            type: 'string',
            enum: [
              'solid',
              'striped',
              'plaid',
              'floral',
              'geometric',
              'animal',
              'graphic',
              'colorblock',
              'other',
            ],
          },
          material: { type: 'string', nullable: true },
          styleTags: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          searchQuery: { type: 'string' },
          bbox: { type: 'array', items: { type: 'number' } },
          confidence: { type: 'number' },
          isPrimary: { type: 'boolean' },
        },
        required: [
          'category',
          'subtype',
          'brand',
          'colors',
          'pattern',
          'styleTags',
          'description',
          'searchQuery',
          'bbox',
          'confidence',
          'isPrimary',
        ],
      },
    },
    styleTags: { type: 'array', items: { type: 'string' } },
    score: {
      type: 'object',
      properties: {
        fit: { type: 'number' },
        colorStory: { type: 'number' },
        texture: { type: 'number' },
        statement: { type: 'number' },
        cohesion: { type: 'number' },
      },
      required: ['fit', 'colorStory', 'texture', 'statement', 'cohesion'],
    },
    captionSuggestions: { type: 'array', items: { type: 'string' } },
    safety: {
      type: 'object',
      properties: {
        flagged: { type: 'boolean' },
        reasons: { type: 'array', items: { type: 'string' } },
      },
      required: ['flagged', 'reasons'],
    },
  },
  required: ['items', 'styleTags', 'score', 'captionSuggestions', 'safety'],
} as const;

export interface GeminiVisionOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';
  /** Roughly $0.0016 per image at Flash pricing. */
  readonly costCents = 0.16;

  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: GeminiVisionOptions) {
    this.model = options.model ?? process.env.GEMINI_VISION_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async analyse(request: VisionRequest): Promise<VisionResult> {
    const url = `${ENDPOINT}/${this.model}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: request.mimeType, data: request.image.toString('base64') } },
            { text: request.hint ? `Context: ${request.hint}` : 'Analyse this outfit.' },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // Low but not zero: deterministic enough to feel consistent, without
        // collapsing descriptions into identical phrasing across looks.
        temperature: 0.2,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.options.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`gemini ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini returned no content');

    const parsed = visionResultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`gemini response failed validation: ${parsed.error.message.slice(0, 300)}`);
    }

    return normalise(parsed.data);
  }
}

/**
 * Defensive tidy-up of model output. Models occasionally return a slightly
 * out-of-range box or an empty-string brand; neither should reach a render.
 */
function normalise(result: VisionResult): VisionResult {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return {
    ...result,
    items: result.items
      .map((item) => ({
        ...item,
        brand: item.brand?.trim() ? item.brand.trim() : null,
        bbox: [
          clamp(item.bbox[0]),
          clamp(item.bbox[1]),
          clamp(item.bbox[2]),
          clamp(item.bbox[3]),
        ] as VisionResult['items'][number]['bbox'],
      }))
      .filter((item) => item.bbox[2] > item.bbox[0] && item.bbox[3] > item.bbox[1]),
  };
}
