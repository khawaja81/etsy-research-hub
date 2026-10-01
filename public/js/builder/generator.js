import { EtsyPolicy as P } from "./policy.js";
/*
 * Offline listing generator. Builds titles, 13 tags, a structured description,
 * materials and photo alt text from the product details — no internet needed.
 * Each run uses fresh randomness so every listing comes out different.
 */


/* ---------- helpers ---------- */
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = makeRng(Date.now());
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const list = (s) => (s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const uniq = (arr) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = x.toLowerCase();
    if (!x || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const SMALL = new Set(["a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "by", "or", "at", "as"]);
function titleCase(s) {
  return s
    .split(/(\s+|-)/)
    .map((w, i) => {
      if (!w.trim() || w === "-") return w;
      if (/^[A-Z0-9]{2,}$/.test(w)) return w; // keep acronyms like SVG, 3D
      const lw = w.toLowerCase();
      if (i > 0 && SMALL.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join("");
}
const lc = (s) => (s || "").toLowerCase();
function joinNatural(arr) {
  if (arr.length <= 1) return arr.join("");
  return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
}
// last 1–2 words of the product type, e.g. "Personalized Ceramic Coffee Mug" → "coffee mug"
function headNoun(type, n) {
  const w = lc(type).split(/\s+/).filter(Boolean);
  return w.slice(-n).join(" ");
}

/* ---------- category knowledge ---------- */
const CATEGORY = {
  jewelry: {
    label: "Jewelry",
    tags: ["dainty jewelry", "everyday jewelry", "minimalist jewelry", "gift for her", "layering jewelry", "bridesmaid gift", "anniversary gift"],
    care: ["Store in a dry place, away from moisture and perfume.", "Remove before swimming, showering or exercising.", "Polish gently with a soft cloth to keep the shine."],
    features: ["Nickel-free and lead-free components", "Arrives in a gift box, ready to give"],
  },
  "home-decor": {
    label: "Home decor",
    tags: ["home decor", "housewarming gift", "living room decor", "shelf decor", "modern home decor", "new home gift", "wall decor"],
    care: ["Dust gently with a soft dry cloth.", "Keep out of prolonged direct sunlight to protect the colors."],
    features: ["Ready to display straight out of the box"],
  },
  kitchen: {
    label: "Kitchen & dining",
    tags: ["kitchen decor", "coffee lover gift", "housewarming gift", "tea lover gift", "kitchen gift", "foodie gift"],
    care: ["Hand washing is recommended to keep it looking new.", "Avoid harsh scrubbers and sudden temperature changes."],
    features: [],
  },
  clothing: {
    label: "Clothing",
    tags: ["graphic tee", "unisex shirt", "gift for him", "gift for her", "comfy shirt", "casual outfit", "statement shirt"],
    care: ["Machine wash cold, inside out, with similar colors.", "Tumble dry low or hang dry.", "Do not iron directly on the design."],
    features: ["Unisex fit — check the size chart in the photos"],
  },
  "art-print": {
    label: "Art print / wall art",
    tags: ["wall art", "art print", "gallery wall", "wall decor", "bedroom wall art", "modern wall art", "poster print"],
    care: ["Frame behind glass to protect from dust and fading.", "Avoid hanging in direct sunlight or humid rooms."],
    features: ["Frame not included unless stated"],
  },
  printable: {
    label: "Digital printable",
    tags: ["instant download", "digital download", "printable", "printable wall art", "digital print", "print at home"],
    care: [],
    features: [],
  },
  planner: {
    label: "Digital planner / template",
    tags: ["digital planner", "printable planner", "instant download", "editable template", "planner pages", "goodnotes planner"],
    care: [],
    features: [],
  },
  svg: {
    label: "SVG / cut files",
    tags: ["svg file", "cut file", "svg bundle", "instant download", "digital download", "png file", "craft file"],
    care: [],
    features: [],
  },
  candles: {
    label: "Candles",
    tags: ["soy candle", "scented candle", "candle gift", "home fragrance", "self care gift", "hand poured candle", "cozy candle"],
    care: ["Trim the wick to about 1/4 inch before each burn.", "Burn for 2–3 hours on the first use so the wax melts evenly.", "Never leave a burning candle unattended; keep away from children and pets."],
    features: [],
  },
  bags: {
    label: "Bags & purses",
    tags: ["tote bag", "everyday bag", "gift for her", "shoulder bag", "canvas bag", "reusable bag", "market bag"],
    care: ["Spot clean with a damp cloth and mild soap.", "Air dry away from direct heat."],
    features: [],
  },
  stickers: {
    label: "Stickers",
    tags: ["sticker", "vinyl sticker", "laptop sticker", "water bottle sticker", "die cut sticker", "planner stickers", "cute sticker"],
    care: ["Apply to a clean, dry, smooth surface.", "Hand wash items with stickers applied; not dishwasher safe."],
    features: [],
  },
  pets: {
    label: "Pet supplies",
    tags: ["pet gift", "dog lover gift", "cat lover gift", "pet accessories", "dog mom gift", "pet owner gift"],
    care: ["Check regularly for wear and replace if damaged.", "Always supervise your pet when using new items."],
    features: [],
  },
  wedding: {
    label: "Wedding & party",
    tags: ["wedding gift", "bridal shower", "wedding decor", "bridesmaid gift", "engagement gift", "party decor", "bride to be"],
    care: ["Store flat in a cool, dry place until your event."],
    features: [],
  },
  toys: {
    label: "Toys & baby",
    tags: ["baby gift", "baby shower gift", "kids gift", "nursery decor", "toddler gift", "new baby gift"],
    care: ["Spot clean only.", "Check before each use; not suitable for children under 3 unless stated."],
    features: [],
  },
  other: { label: "Other", tags: ["unique gift", "gift idea", "birthday gift"], care: [], features: [] },
};

const MATERIAL_CARE = [
  [/sterling|silver|925/i, "Sterling silver naturally tarnishes over time — a silver polishing cloth brings back the shine."],
  [/gold.?fill|gold filled|14k|18k/i, "Gold-filled pieces are tarnish resistant; wipe with a soft cloth after wearing."],
  [/wood|walnut|oak|maple|bamboo/i, "Wood is a natural material — wipe clean and oil occasionally with food-safe mineral oil."],
  [/ceramic|porcelain|stoneware|clay/i, "Each ceramic piece is unique; small variations in glaze are part of its character."],
  [/cotton|linen/i, "Natural fibers may soften and shrink slightly after the first wash."],
  [/leather/i, "Condition the leather now and then and keep it away from water."],
  [/resin|epoxy/i, "Resin can yellow in strong sunlight — keep indoors and away from heat."],
  [/soy|beeswax|coconut wax/i, "Natural wax may frost slightly; this is normal and does not affect the burn."],
  [/brass|copper/i, "Brass and copper develop a natural patina; clean with lemon juice and a soft cloth if desired."],
];

const TONES = {
  friendly: {
    openers: [
      "Meet your new favorite {type}!",
      "Say hello to this {adj} {type} — made to make everyday moments a little brighter.",
      "Looking for something special? This {adj} {type} is it.",
      "This {adj} {type} was made with you in mind.",
      "Add a little joy to your day with this {adj} {type}.",
    ],
    seconds: [
      "It's the kind of piece people notice and ask about.",
      "Thoughtfully made, easy to love, and perfect for gifting.",
      "Simple, useful and full of personality.",
      "A small detail that makes a big difference.",
    ],
    closers: [
      "Have a question? Send us a message on Etsy — we're happy to help!",
      "Questions or special requests? Just message us through Etsy.",
      "Need help choosing? Message us on Etsy anytime.",
    ],
  },
  elegant: {
    openers: [
      "Discover the quiet beauty of this {adj} {type}.",
      "Thoughtfully designed and carefully finished, this {adj} {type} brings timeless style to every day.",
      "Understated, refined and made to be treasured — introducing our {adj} {type}.",
      "Elevate the everyday with this {adj} {type}.",
    ],
    seconds: [
      "Every detail has been considered, from the materials to the finishing touches.",
      "A piece designed to be kept and cherished for years.",
      "Refined enough for special occasions, effortless enough for every day.",
    ],
    closers: [
      "Should you have any questions, please reach out through Etsy Messages.",
      "We would be delighted to help — simply send us a message on Etsy.",
    ],
  },
  playful: {
    openers: [
      "Warning: this {adj} {type} may cause extreme happiness.",
      "Okay, this {adj} {type} is seriously cute.",
      "Your day just got better — meet the {adj} {type}!",
      "Fun, bright and totally you: the {adj} {type}.",
    ],
    seconds: [
      "Treat yourself or surprise someone you love.",
      "Guaranteed smiles? We can't promise — but it's very likely.",
      "Because ordinary is boring.",
    ],
    closers: [
      "Got questions? Slide into our Etsy messages — we don't bite!",
      "Questions? Ping us on Etsy and we'll get back to you fast.",
    ],
  },
  professional: {
    openers: [
      "This {adj} {type} is designed for quality, durability and everyday use.",
      "A reliable, well-made {type} with a {adj} finish.",
      "Our {adj} {type} combines practical design with quality materials.",
    ],
    seconds: [
      "Please review the details and photos below before ordering.",
      "Made to a consistent standard so you know exactly what you're getting.",
    ],
    closers: [
      "For questions about this item, please contact us through Etsy Messages.",
      "We respond to all Etsy messages within 1–2 business days.",
    ],
  },
};

const ADJ_BY_STYLE = {
  default: ["beautiful", "unique", "thoughtful", "lovely", "charming", "stylish", "one-of-a-kind look", "eye-catching"],
  minimalist: ["minimalist", "clean", "simple", "modern", "understated"],
  boho: ["boho", "earthy", "free-spirited", "bohemian"],
  rustic: ["rustic", "farmhouse", "cozy", "warm"],
  vintage: ["retro", "vintage style", "nostalgic", "classic"],
  modern: ["modern", "sleek", "contemporary"],
  cute: ["cute", "adorable", "sweet", "playful"],
  luxury: ["elegant", "refined", "timeless", "sophisticated"],
};

const ALT_CONTEXTS_PHYSICAL = [
  "photographed on a plain white background",
  "styled on a wooden table with natural light",
  "close-up showing the texture and finish",
  "held in a hand to show the size",
  "wrapped and ready to give as a gift",
  "displayed in a cozy home setting",
  "shown from the side to show its depth",
];
const ALT_CONTEXTS_DIGITAL = [
  "preview image of the design on a white background",
  "mockup showing the printed design in a frame on a wall",
  "preview of the file pages displayed on a tablet screen",
  "close-up preview of the design details",
  "overview of all files included in the download",
];

function isDigital(ctx) {
  return ctx.itemType === "digital" || ["printable", "planner", "svg"].includes(ctx.category);
}

/* ---------- live market data ---------- */
// Market tags/phrases come from aggregate Etsy search data. Only terms that describe *this*
// product are used: they must share a product word and must not add a color, material,
// personalization or digital claim the seller didn't give.
const stem = (w) => {
  const s = lc(w).replace(/['’]/g, "");
  return s.length > 3 ? s.replace(/(ies)$/, "y").replace(/s$/, "") : s;
};
const stemSet = (s) => new Set(s.split(" ").map(stem));
const COLOR_WORDS = stemSet("red blue green pink purple black white gold silver yellow orange brown beige navy teal grey gray cream ivory sage rose burgundy lavender mint coral turquoise tan");
const MATERIAL_WORDS = stemSet("wood wooden ceramic porcelain stoneware glass sterling leather cotton linen wool silk resin acrylic metal steel brass copper paper vinyl canvas bamboo clay marble concrete crystal pearl plastic felt velvet denim jute macrame soy beeswax enamel titanium platinum diamond moissanite");
const PERSONAL_RE = /\b(personali[sz]ed|custom|name|names|monogram|initials?|engraved)\b/;
const DIGITAL_RE = /\b(digital|download|printable|svg|png|pdf|template|editable|instant|canva)\b/;
const GENERIC = new Set("gift gifts for day set idea ideas the and with her him new unique cute best".split(" "));
const ALWAYS_OK = stemSet("gift gifts present for idea ideas unique the and with of a to");

function marketFit(ctx, market) {
  if (!market || !market.sample_size) return { tags: [], autoTags: [], phrases: [] };
  const productWords = new Set(P.words([ctx.productType, ...ctx.keywords].join(" ")).map(stem).filter((w) => w.length > 2 && !GENERIC.has(w)));
  const contextWords = new Set(P.words([...ctx.occasions, ...ctx.recipients, ...ctx.styles].join(" ")).map(stem).filter((w) => w.length > 2 && !GENERIC.has(w)));
  const own = new Set(P.words([ctx.productType, ...ctx.keywords, ...ctx.materials, ...ctx.colors, ...ctx.styles, ...ctx.occasions, ...ctx.recipients].join(" ")).map(stem));
  // a word the seller's own details cover (so the tag can't describe a different product)
  const known = (w) =>
    own.has(w) || ALWAYS_OK.has(w) || (ctx.personalized && /^(custom|personali[sz]ed|name)$/.test(w)) || (ctx.digital && DIGITAL_RE.test(w));
  const fits = (term) => {
    const ws = P.words(term).map(stem);
    const aboutProduct = ws.some((w) => productWords.has(w));
    const aboutContext = ws.some((w) => contextWords.has(w));
    if (!aboutProduct && !aboutContext) return false;
    if (ws.some((w) => (COLOR_WORDS.has(w) || MATERIAL_WORDS.has(w)) && !own.has(w))) return false;
    if (!ctx.personalized && PERSONAL_RE.test(term)) return false;
    if (!ctx.digital && DIGITAL_RE.test(term)) return false;
    // drop anything the policy checker would flag (trademarks, claims…)
    return !P.contentChecks(term, "tags", ctx).some((i) => i.level === "error" || i.level === "warn");
  };
  const strict = (term) => P.words(term).map(stem).every(known);
  // loose list = suggestions the seller can pick; strict list = used automatically
  const tags = (market.tags || [])
    .filter((t) => t.term.length <= P.LIMITS.tagMaxChars && fits(t.term))
    .map((t) => ({ ...t, score: t.pct * (1 + Math.log10((t.avg_favorites || 0) + 1) / 2) + (t.in_top10 || 0) * 1.5, strict: strict(t.term) }))
    .sort((a, b) => b.score - a.score);
  const phrases = [...(market.phrases3 || []), ...(market.phrases2 || [])]
    .filter((p) => p.pct >= 3 && fits(p.term) && strict(p.term))
    .sort((a, b) => b.pct - a.pct);
  // single words ("mug") are weak tags on Etsy — only multi-word phrases are used or suggested
  const multi = tags.filter((t) => t.term.includes(" "));
  return { tags: multi, autoTags: multi.filter((t) => t.strict), phrases };
}

// Light, score-weighted shuffle so repeated runs don't produce identical tag sets.
function weightedOrder(list, key = "score") {
  return list
    .map((x) => ({ x, k: (x[key] || 1) * (0.7 + rng() * 0.6) }))
    .sort((a, b) => b.k - a.k)
    .map((o) => o.x);
}

/* ---------- context ---------- */
function buildContext(input, market) {
  const ctx = {
    productType: (input.productType || "").trim(),
    keywords: uniq(list(input.keywords)),
    itemType: input.itemType || "handmade",
    itemTypeLabel: input.itemTypeLabel || input.itemType,
    category: input.category || "other",
    materials: uniq(list(input.materials)),
    colors: uniq(list(input.colors)),
    size: (input.size || "").trim(),
    styles: uniq(list(input.styles)),
    occasions: uniq(list(input.occasions)),
    recipients: uniq(list(input.recipients)),
    personalized: !!input.personalized,
    personalizationDetails: (input.personalizationDetails || "").trim(),
    processing: (input.processing || "").trim(),
    features: uniq(list(input.features)),
    shopName: (input.shopName || "").trim(),
    aiDesign: !!input.aiDesign,
    tone: TONES[input.tone] ? input.tone : "friendly",
    titleLength: input.titleLength || "short",
    productionPartner: !!input.productionPartner,
  };
  ctx.cat = CATEGORY[ctx.category] || CATEGORY.other;
  ctx.digital = isDigital(ctx);
  ctx.noun = headNoun(ctx.productType, 1) || "item";
  ctx.noun2 = headNoun(ctx.productType, 2) || ctx.noun;
  const fit = marketFit(ctx, market);
  ctx.marketTags = fit.autoTags;
  ctx.marketPhrases = fit.phrases;
  return ctx;
}

function adjectives(ctx) {
  let pool = [];
  for (const s of ctx.styles) {
    const k = lc(s);
    if (ADJ_BY_STYLE[k]) pool = pool.concat(ADJ_BY_STYLE[k]);
    else pool.push(k);
  }
  if (!pool.length) pool = ADJ_BY_STYLE.default;
  return pool;
}

/* ---------- titles ---------- */
function titleCandidates(ctx) {
  const type = titleCase(ctx.productType);
  const kws = ctx.keywords.filter((k) => lc(k) !== lc(ctx.productType));
  const material = ctx.materials[0] ? titleCase(ctx.materials[0]) : "";
  const style = ctx.styles[0] ? titleCase(ctx.styles[0]) : "";
  const recipient = ctx.recipients.length ? titleCase(pick(ctx.recipients)) : "";
  const occasion = ctx.occasions.length ? titleCase(pick(ctx.occasions)) : "";
  const pers = ctx.personalized ? pick(["Personalized", "Custom", "Custom Name"]) : "";
  const color = ctx.colors[0] ? titleCase(ctx.colors[0]) : "";
  const lowerType = lc(type);
  const typeWords = P.words(type);

  // "Personalized Wooden Sign" → lead "Personalized", base "Wooden Sign", so modifiers go in the middle
  const leadMatch = type.match(/^(Personalized|Personalised|Custom Name|Custom)\s+(.+)$/i);
  const lead = leadMatch ? leadMatch[1] : "";
  const base = leadMatch ? leadMatch[2] : type;

  // skip a modifier when the product type already says it (e.g. "birch wood" + "Wooden Sign")
  const overlaps = (word) => P.words(word).some((w) => w.length > 2 && typeWords.some((t) => t.startsWith(w) || w.startsWith(t)));
  const prefix = (word) => (word && !lowerType.includes(lc(word)) && !overlaps(word) ? word + " " : "");
  const build = (...mods) => ((lead ? lead + " " : prefix(pers)) + mods.map(prefix).join("") + base).replace(/\s+/g, " ").trim();
  // at most two modifiers in front of the product type, so the title stays readable
  const core1 = build(style || material);
  const core2 = build(material);
  const core3 = (lead ? lead + " " : "") + (prefix(style) + prefix(material) + base).trim();

  // the seller's own keywords first, then the strongest matching phrases from live Etsy data
  const marketKw = weightedOrder(ctx.marketPhrases.slice(0, 8), "pct").slice(0, 4).map((p) => p.term);
  const kw = uniq([...kws, ...marketKw]).map(titleCase);
  const pronoun = /^(her|him|them|me|you|us)$/i.test(recipient);
  const giftPhrase = recipient ? (pronoun ? `Gift for ${recipient}` : pick([`Gift for ${recipient}`, `${recipient} Gift`])) : "";
  const occasionPhrase = occasion ? pick([`${occasion} Gift`, `Perfect for ${occasion}`, `${occasion} Present`]) : "";
  const digitalPhrase = ctx.digital ? pick(["Instant Download", "Digital Download", "Printable"]) : "";

  const patterns = [
    () => [core1, kw[0], giftPhrase || occasionPhrase],
    () => [core2, giftPhrase, occasionPhrase],
    () => [core1, digitalPhrase || color, kw[0], giftPhrase],
    () => [core3, kw[0], kw[1], occasionPhrase],
    () => [pers || lead ? build() : core3, kw[1] || kw[0], digitalPhrase, giftPhrase],
    () => [core2, style, kw[0], giftPhrase || occasionPhrase],
  ];
  const extras = [kw[0], kw[1], kw[2], kw[3], giftPhrase, occasionPhrase, digitalPhrase, color, style].filter(Boolean);

  const significant = (part) => P.words(part).filter((w) => w.length > 2 && !["gift", "for", "perfect", "the", "and"].includes(w));
  const out = [];
  for (const p of shuffle(patterns)) {
    // keep only parts that add new words — repeating keywords doesn't help on Etsy
    const used = new Set();
    const parts = [];
    const tryAdd = (part, maxLen) => {
      if (!part) return;
      const ws = significant(part);
      if (parts.length && ws.some((w) => used.has(w))) return;
      if (parts.length && parts.concat(part).join(", ").length > maxLen) return;
      ws.forEach((w) => used.add(w));
      parts.push(part.replace(/\s+/g, " ").trim());
    };
    const detailed = ctx.titleLength === "detailed";
    const maxLen = detailed ? 125 : 90;
    p().forEach((part) => tryAdd(part, maxLen));
    // short titles still need enough words to be found; detailed ones get more
    const minLen = detailed ? 95 : 45;
    for (const part of shuffle(extras)) {
      if (parts.length >= 5 || parts.join(", ").length >= minLen) break;
      tryAdd(part, maxLen);
    }
    out.push(P.fixTitle(parts.join(", ")));
  }
  // best first: closest to a comfortable length for the chosen style
  const target = ctx.titleLength === "detailed" ? 110 : 70;
  return uniq(out).sort((a, b) => Math.abs(a.length - target) - Math.abs(b.length - target));
}

/* ---------- tags ---------- */
const shortenTag = (t) => P.cleanTag(t);

function tagCandidates(ctx) {
  const n1 = ctx.noun, n2 = ctx.noun2;
  const tier1 = [...ctx.keywords, ctx.productType];
  const tier2 = [];
  for (const m of ctx.materials) tier2.push(`${m} ${n1}`, `${m} ${n2}`);
  for (const s of ctx.styles) tier2.push(`${s} ${n1}`, `${s} ${n2}`, `${s} decor`);
  for (const c of ctx.colors) tier2.push(`${c} ${n1}`);
  for (const o of ctx.occasions) tier2.push(`${o} gift`, `${o} ${n1}`);
  for (const r of ctx.recipients) tier2.push(/^(her|him|them|me|you|us)$/i.test(r) ? `gift for ${lc(r)}` : pick([`gift for ${r}`, `${r} gift`]));
  if (ctx.personalized) tier2.push(`personalized ${n1}`, `custom ${n1}`, `personalized gift`, `name ${n1}`, `custom ${n2}`);
  if (ctx.digital) tier2.push("instant download", "digital download");
  const tier3 = [...ctx.cat.tags, `unique ${n1}`, `${n1} gift`, `${n2} gift`, "gift idea", "birthday gift"];

  // live Etsy data: the most-used, best-favorited tags that fit this product (about half the tags)
  const market = weightedOrder(ctx.marketTags.slice(0, 16)).map((t) => t.term);
  const ordered = [
    ...shuffle(tier1).sort((a, b) => ctx.keywords.indexOf(a) - ctx.keywords.indexOf(b)),
    ...market.slice(0, 7),
    ...shuffle(tier2),
    ...market.slice(7),
    ...shuffle(tier3),
  ];
  const cleaned = [];
  for (const t of ordered) {
    const s = shortenTag(t);
    if (s && s.length >= 3) cleaned.push(s);
  }
  // physical items must not get digital-only tags and vice versa
  const filtered = cleaned.filter((t) => ctx.digital || !/download|printable|svg|digital/.test(t));
  return P.fixTags(uniq(filtered), ctx);
}

/* ---------- description ---------- */
function description(ctx) {
  const tone = TONES[ctx.tone];
  const typeLc = lc(ctx.productType);
  const adjPool = adjectives(ctx).filter((a) => !typeLc.includes(a));
  const adj = pick(adjPool.length ? adjPool : ADJ_BY_STYLE.default);
  const L = [];
  const headingStyle = pick(["✦ {t}", "— {t} —", "❖ {t}", "{t}:"]);
  const H = (t) => "\n" + headingStyle.replace("{t}", t);

  L.push(pick(tone.openers).replace("{adj}", adj).replace("{type}", typeLc));
  let intro = pick(tone.seconds);
  if (ctx.keywords.length) {
    const kw = ctx.keywords.slice(0, 2).map(lc);
    intro += " " + pick([
      `Whether you're shopping for ${kw[0]} or ${kw[1] || "a meaningful gift"}, this one checks every box.`,
      `If you love ${kw[0]}, you'll love the details on this piece.`,
      `It's a great pick for anyone searching for ${kw[0]}.`,
    ]);
  }
  L.push(intro);

  // details
  const details = [];
  if (ctx.materials.length) details.push(`Material: ${joinNatural(ctx.materials.map(lc))}`);
  if (ctx.colors.length) details.push(`${ctx.colors.length > 1 ? "Color options" : "Color"}: ${ctx.colors.map(titleCase).join(", ")}`);
  if (ctx.size) details.push(`${ctx.digital ? "File size / format" : "Size"}: ${ctx.size}`);
  if (ctx.styles.length) details.push(`Style: ${ctx.styles.map(lc).join(", ")}`);
  for (const f of ctx.features) details.push(f.charAt(0).toUpperCase() + f.slice(1));
  for (const f of ctx.cat.features) if (chance(0.7)) details.push(f);
  if (details.length) {
    L.push(H(pick(["DETAILS", "PRODUCT DETAILS", "ITEM DETAILS", "WHAT MAKES IT SPECIAL"])));
    details.forEach((d) => L.push("• " + d));
  }

  if (ctx.digital) {
    L.push(H(pick(["WHAT YOU WILL RECEIVE", "WHAT'S INCLUDED", "YOUR DOWNLOAD"])));
    L.push(`• Digital file(s)${ctx.size ? " — " + ctx.size : ""}, available right after purchase from your Etsy account (Purchases and reviews).`);
    L.push("• This is a digital product — no physical item will be shipped.");
    L.push("• Colors may look slightly different depending on your screen and printer.");
    L.push(H("USAGE"));
    L.push("• For personal use only. Please don't resell, share or redistribute the files.");
  }

  if (ctx.personalized) {
    L.push(H(pick(["HOW TO ORDER", "HOW TO PERSONALIZE", "ORDERING STEPS"])));
    const steps = [
      "Choose your options from the drop-down menus.",
      `Add your personalization in the box provided${ctx.personalizationDetails ? " — " + ctx.personalizationDetails : ""}.`,
      "Double-check spelling; we'll make it exactly as written.",
      "Add to cart and check out.",
    ];
    steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));
  }

  if (ctx.occasions.length || ctx.recipients.length) {
    L.push(H(pick(["PERFECT GIFT", "GIFT IDEAS", "GREAT FOR GIFTING"])));
    const occ = ctx.occasions.map(lc);
    const rec = ctx.recipients.map(lc);
    let s = pick(["A thoughtful gift", "A lovely present", "A memorable gift"]);
    if (occ.length) s += ` for ${joinNatural(occ)}`;
    if (rec.length) s += `${occ.length ? "," : ""} perfect for ${joinNatural(rec)}`;
    L.push(s + ".");
  }

  const care = [...ctx.cat.care];
  for (const [re, txt] of MATERIAL_CARE) if (ctx.materials.some((m) => re.test(m))) care.push(txt);
  if (!ctx.digital && care.length) {
    L.push(H(pick(["CARE", "CARE INSTRUCTIONS", "HOW TO CARE FOR IT"])));
    shuffle(care).slice(0, 4).forEach((c) => L.push("• " + c));
  }

  if (!ctx.digital) {
    L.push(H(pick(["PRODUCTION & SHIPPING", "PROCESSING & SHIPPING", "SHIPPING"])));
    if (ctx.itemType === "handmade") L.push(pick(["Each item is made by hand, so small variations make every piece one of a kind.", "Because every piece is handmade, yours will be unique."]));
    if (ctx.itemType === "pod" || ctx.productionPartner) L.push("This item is made to order with the help of our production partner, then shipped directly to you.");
    if (ctx.itemType === "vintage") L.push("This is a genuine vintage item (20+ years old). Please view all photos — signs of age and wear are part of its history.");
    if (ctx.processing) L.push(`Processing time: ${ctx.processing}. Shipping times are shown at checkout.`);
    else L.push("Processing and shipping times are shown at checkout.");
  }

  if (ctx.aiDesign) {
    L.push(H("ABOUT THIS DESIGN"));
    L.push(`This design was created by ${ctx.shopName || "our shop"} with the help of AI tools, then edited and finished by us.`);
  }

  L.push("");
  L.push(pick(tone.closers));
  if (ctx.shopName) L.push(`Thank you for supporting ${ctx.shopName}!`);

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function altTexts(ctx) {
  const pool = ctx.digital ? ALT_CONTEXTS_DIGITAL : ALT_CONTEXTS_PHYSICAL;
  const base = [ctx.colors[0], ctx.materials[0], ctx.productType].filter(Boolean).map(lc);
  const subject = uniq(base).join(" ");
  return shuffle(pool).slice(0, 5).map((c) => {
    const s = `${subject} ${c}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}

function materials(ctx) {
  return ctx.materials.map((m) => m.slice(0, P.LIMITS.materialMaxChars)).slice(0, P.LIMITS.materialsMax);
}

// Guess the category from the product type (used by bulk mode and to pre-select the form).
const CATEGORY_HINTS = [
  [/\bsvg|cut file|dxf\b/i, "svg"],
  [/planner|template|worksheet|tracker|journal pages|goodnotes/i, "planner"],
  [/printable|digital (download|print)/i, "printable"],
  [/necklace|bracelet|earring|ring\b|rings\b|pendant|anklet|brooch|charm|jewelry|jewellery/i, "jewelry"],
  [/mug|cup|tumbler|coaster|cutting board|apron|plate|bowl|spoon|kitchen|tea towel/i, "kitchen"],
  [/shirt|tee\b|t-shirt|hoodie|sweatshirt|sweater|dress|hat|cap\b|socks|onesie|bodysuit|jacket/i, "clothing"],
  [/print|poster|wall art|painting|canvas|illustration/i, "art-print"],
  [/candle|wax melt/i, "candles"],
  [/sticker|decal/i, "stickers"],
  [/bag|tote|purse|pouch|wallet|backpack|clutch/i, "bags"],
  [/\bdog\b|\bcat\b|pet\b|collar|leash/i, "pets"],
  [/wedding|bridal|bride|bridesmaid|groom|invitation/i, "wedding"],
  [/baby|toy|plush|nursery|toddler|kids/i, "toys"],
  [/sign|decor|pillow|cushion|vase|ornament|wreath|frame|blanket|clock|lamp|planter|shelf/i, "home-decor"],
];
function detectCategory(productType, itemType) {
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(productType || "")) {
      if (cat === "art-print" && itemType === "digital") return "printable";
      return cat;
    }
  }
  return null;
}

/* ---------- public API ---------- */
function generate(input, history, market) {
  rng = makeRng(Date.now() ^ Math.floor(Math.random() * 1e9));
  const ctx = buildContext(input, market);
  if (!ctx.productType) throw new Error("Product type is required.");

  // try a few times and keep the result least similar to past listings
  let best = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const titles = titleCandidates(ctx).map((t) => P.scrubText(t, ctx)).map(P.fixTitle).filter(Boolean);
    const listing = {
      titles: titles.slice(0, 3),
      title: titles[0] || titleCase(ctx.productType),
      tags: tagCandidates(ctx),
      description: P.scrubText(description(ctx), ctx, { sentences: true }),
      materials: materials(ctx),
      altTexts: altTexts(ctx),
    };
    const sim = P.similarityToHistory(listing, history).score;
    if (!best || sim < best.sim) best = { listing, sim };
    if (sim < 0.45) break;
  }
  return { listing: best.listing, ctx };
}

// Market tags that fit a product (for the "suggested from live data" chips in the UI).
function fitMarket(input, market) {
  return marketFit(buildContext(input), market);
}

export const ListingGenerator = { generate, buildContext, detectCategory, fitMarket, CATEGORY, titleCase };
