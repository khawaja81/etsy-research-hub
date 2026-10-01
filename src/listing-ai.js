// Optional AI listing writer for the Listing Builder.
// Providers: Google Gemini (free tier, GEMINI_API_KEY) or Anthropic Claude (paid, ANTHROPIC_API_KEY).
// The AI gets the seller's own product details plus *aggregate* live Etsy market data (tag/phrase
// frequencies, price range, competition) — never other sellers' titles or descriptions —
// so the result is original and nothing is copied.
import Anthropic from '@anthropic-ai/sdk';
// Same rules the browser uses — keeps trademarked / risky market terms out of the prompt entirely.
import { EtsyPolicy } from '../public/js/builder/policy.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Newest free-tier Flash model first; the older one is a fallback if the first is unavailable or rate-limited.
const GEMINI_MODELS = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-2.5-flash'])];

const geminiKey = () => (process.env.GEMINI_API_KEY || '').trim();
const anthropicKey = () => (process.env.ANTHROPIC_API_KEY || '').trim();

// AI_PROVIDER=gemini|anthropic forces one; otherwise the free Gemini key wins when present.
export function aiProvider() {
  const forced = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (forced === 'gemini' && geminiKey()) return 'gemini';
  if (forced === 'anthropic' && anthropicKey()) return 'anthropic';
  if (geminiKey()) return 'gemini';
  if (anthropicKey()) return 'anthropic';
  return null;
}
export const isAiConfigured = () => aiProvider() !== null;
export const aiModel = () => {
  const p = aiProvider();
  return p === 'gemini' ? `Google Gemini (${GEMINI_MODELS[0]}, free tier)` : p === 'anthropic' ? `Claude (${MODEL})` : null;
};

let client = null;
const getClient = () => (client ||= new Anthropic());

export class AiError extends Error {
  constructor(message, status = 500, code = 'AI_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const safeTerm = (term) => !EtsyPolicy.contentChecks(term, 'tags', null).some((i) => i.level === 'error');

const SYSTEM_PROMPT = `You write Etsy listings for a small Etsy seller. The seller pastes your output into Etsy themselves, so it must follow Etsy's rules exactly, rank well in Etsy search, and be genuinely useful to buyers.

You receive the seller's product details and live, aggregated Etsy market data for their keyword: how many listings compete, which tags and title phrases competing listings use most (with the share of listings using them and the average favorites of those listings), and the price range. Use the data to choose keywords buyers actually search — prefer phrases that are common among well-favorited listings AND truly describe the seller's product. Ignore market keywords that don't describe this exact product (a different material, color, style or product variant).

Etsy rules you must follow:
- Title: max 140 characters; Etsy recommends short, readable titles (about 15 words or fewer, ideally under 100 characters). Start with what the item is. No more than 3 words in ALL CAPS. Never use $ ^ or backticks. Use % : & at most once each. No emoji. Don't repeat the same word. Don't write a comma-separated pile of keywords.
- Tags: exactly 13 tags, each 20 characters or fewer, lowercase, only letters, numbers, spaces, hyphens and apostrophes. Prefer multi-word phrases buyers search. No duplicates or plural/singular near-duplicates. Use tags for keyword variety the title doesn't cover.
- Never use trademarks, brand names, celebrity names, sports leagues, or characters (Disney, Marvel, Nike, Taylor Swift, NFL, Pokemon, Stanley, "onesie" etc.) and never "inspired by", "dupe", "replica", "look alike". A brand name is allowed only as truthful compatibility (e.g. "compatible with iPhone 15") and only if the seller gave it.
- No medical or health claims (cures, heals, anxiety relief, detox, antibacterial, FDA approved...).
- No links, emails, phone numbers, social handles, or anything that sends buyers off Etsy. Invite questions via Etsy Messages.
- No unverifiable claims ("best seller", "#1", "cheapest", "guaranteed").
- Call an item "vintage" only if the seller says it is 20+ years old; otherwise "vintage style" or "retro". Call it handmade only if the seller says it is handmade. Production-partner / print-on-demand items must say they are made with a production partner.
- If the seller used AI tools in the design, the description must disclose it plainly.
- Never invent facts (sizes, materials, certifications, shipping times) the seller didn't give.

Description: open with one or two clear sentences describing the item (shown in Google results). Then short sections with simple headings and bullet points: details (materials, colors, size), how to order/personalize if applicable, what's included and "no physical item will be shipped" for digital items, gift ideas, care instructions where relevant, processing/shipping, and a closing line inviting questions via Etsy Messages. Natural, original sentences — no keyword stuffing.

Alt text: 5 short, literal descriptions of likely product photos (under 250 characters each).

keyword_notes: 1–3 short sentences for the seller explaining which market keywords you used and why.

Every listing must be original. If the seller lists titles from their earlier listings, write a clearly different title and description.`;

const SCHEMA = {
  type: 'object',
  properties: {
    titles: { type: 'array', items: { type: 'string' }, description: '3 different title options, best first' },
    tags: { type: 'array', items: { type: 'string' }, description: 'exactly 13 tags' },
    description: { type: 'string' },
    materials: { type: 'array', items: { type: 'string' } },
    alt_texts: { type: 'array', items: { type: 'string' } },
    keyword_notes: { type: 'string' },
  },
  required: ['titles', 'tags', 'description', 'materials', 'alt_texts', 'keyword_notes'],
  additionalProperties: false,
};

const clip = (v, n) => String(v ?? '').slice(0, n);

function productText(input) {
  const rows = [
    ['Product type', input.productType],
    ['Main keywords (most important first)', input.keywords],
    ['Item type', input.itemTypeLabel],
    ['Category', input.categoryLabel],
    ['Materials', input.materials],
    ['Colors', input.colors],
    ['Size / dimensions / file format', input.size],
    ['Style', input.styles],
    ['Occasions', input.occasions],
    ['Recipients', input.recipients],
    ['Personalized', input.personalized ? `yes — ${input.personalizationDetails || 'buyer adds personalization'}` : 'no'],
    ['Extra features', input.features],
    ['Processing time', input.processing],
    ['Uses a production partner', input.productionPartner ? 'yes' : 'no'],
    ['AI tools used in the design', input.aiDesign ? 'yes' : 'no'],
    ['Shop name', input.shopName],
    ['Tone of voice', input.tone],
    ['Title length preference', input.titleLength === 'detailed' ? 'detailed (up to ~130 characters)' : 'short (under ~90 characters)'],
    ['Seller notes', input.extraNotes],
  ];
  return rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${clip(v, 600)}`)
    .join('\n');
}

// market = { query, total_count, summary, scores } from the same analysis Keyword Research uses
function marketText(m) {
  const s = m?.summary;
  if (!s || !s.sample_size) return 'No live market data available — rely on the product details.';
  const fmtList = (list, n) =>
    (list || [])
      .filter((t) => safeTerm(t.term))
      .slice(0, n)
      .map((t) => `${t.term} (${t.pct}%${t.avg_favorites != null ? `, avg ${t.avg_favorites} favs` : ''})`)
      .join('; ');
  const p = s.price || {};
  return [
    `Search keyword: "${clip(m.query, 100)}"`,
    `Active Etsy listings: ${m.total_count} (competition: ${m.scores?.competition_label}); analyzed top ${s.sample_size} by relevancy`,
    p.median != null ? `Price (${s.price_currency || 'USD'}): median ${p.median}, middle 50% ${p.p25}–${p.p75}` : '',
    `Share personalizable: ${s.mix?.personalizable}% · digital: ${s.mix?.digital}% · handmade: ${s.mix?.handmade}%`,
    `Most used tags: ${fmtList(s.tags, 40)}`,
    `Common 2-word title phrases: ${fmtList(s.phrases2, 20)}`,
    `Common 3-word title phrases: ${fmtList(s.phrases3, 12)}`,
    `Common materials: ${fmtList(s.materials, 10)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function writeListing(input, market, avoidTitles = []) {
  const provider = aiProvider();
  if (!provider) throw new AiError('AI is not set up. Add a free GEMINI_API_KEY (or ANTHROPIC_API_KEY) to the environment.', 503, 'AI_NOT_CONFIGURED');
  const avoid = avoidTitles.slice(0, 25).map((t) => `- ${clip(t, 160)}`).join('\n');
  const content = `Write an Etsy listing for this product.

PRODUCT
${productText(input)}

LIVE ETSY MARKET DATA (aggregated)
${marketText(market)}
${avoid ? `\nTitles from the seller's earlier listings (do NOT reuse or closely copy):\n${avoid}` : ''}`;

  return provider === 'gemini' ? writeWithGemini(content) : writeWithClaude(content);
}

// ---------- Google Gemini (free tier) — REST generateContent, no extra package ----------

const GEMINI_SCHEMA = (() => {
  const { additionalProperties, ...rest } = SCHEMA; // Gemini's schema subset doesn't need it
  return rest;
})();

async function geminiOnce(model, content) {
  let res;
  try {
    const base = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
    res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: content }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: GEMINI_SCHEMA, maxOutputTokens: 16000 },
      }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    throw new AiError(`Could not reach Google Gemini (${err.message}).`, 503, 'AI_NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const reason = JSON.stringify(body?.error?.details || '');
    if (res.status === 429) throw new AiError('Gemini free-tier limit reached — wait a minute (or until tomorrow for the daily limit) and try again.', 429, 'AI_RATE_LIMIT');
    if (res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(msg + reason)) throw new AiError('The GEMINI_API_KEY is invalid.', 502, 'AI_AUTH');
    if (res.status === 404) throw new AiError(`Gemini model "${model}" is not available.`, 502, 'AI_MODEL');
    throw new AiError(`Gemini error (${res.status}): ${msg}`, 502, 'AI_ERROR');
  }
  if (body.promptFeedback?.blockReason) throw new AiError('Gemini declined this request. Try rewording the product details.', 422, 'AI_REFUSAL');
  const cand = body.candidates?.[0];
  if (cand?.finishReason === 'MAX_TOKENS') throw new AiError('The AI response was cut off. Please try again.', 502, 'AI_ERROR');
  if (cand?.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(cand.finishReason)) {
    throw new AiError(`Gemini stopped early (${cand.finishReason}). Try rewording the product details.`, 422, 'AI_REFUSAL');
  }
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  if (!text) throw new AiError('Empty response from Gemini.', 502, 'AI_ERROR');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('Could not read the AI response. Please try again.', 502, 'AI_ERROR');
  }
}

async function writeWithGemini(content) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      return await geminiOnce(model, content);
    } catch (err) {
      lastErr = err;
      // try the fallback model only when this one is missing or rate-limited
      if (!['AI_MODEL', 'AI_RATE_LIMIT'].includes(err.code)) throw err;
    }
  }
  throw lastErr;
}

// ---------- Anthropic Claude (paid) ----------

async function writeWithClaude(content) {
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    // 502, not 401: the browser treats 401 as "your login expired"
    if (err instanceof Anthropic.AuthenticationError) throw new AiError('The ANTHROPIC_API_KEY is invalid.', 502, 'AI_AUTH');
    if (err instanceof Anthropic.RateLimitError) throw new AiError('AI rate limit reached — wait a minute and try again.', 429, 'AI_RATE_LIMIT');
    if (err instanceof Anthropic.APIConnectionError) throw new AiError('Could not reach the AI service.', 503, 'AI_NETWORK');
    if (err instanceof Anthropic.APIError) throw new AiError(`AI service error (${err.status}): ${err.message}`, 502, 'AI_ERROR');
    throw err;
  }

  if (response.stop_reason === 'refusal') throw new AiError('The AI declined this request. Try rewording the product details.', 422, 'AI_REFUSAL');
  if (response.stop_reason === 'max_tokens') throw new AiError('The AI response was cut off. Please try again.', 502, 'AI_ERROR');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new AiError('Empty response from AI.', 502, 'AI_ERROR');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('Could not read the AI response. Please try again.', 502, 'AI_ERROR');
  }
}
