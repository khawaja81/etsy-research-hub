/*
 * Etsy listing rules + policy checker.
 * Everything here runs locally in the browser. Nothing is sent to Etsy.
 *
 * Sources: Etsy Seller Handbook (titles/tags guidance), Etsy listing form limits,
 * Etsy Intellectual Property Policy, Prohibited Items Policy, Creativity Standards,
 * and the House Rules on fees/off-site transactions. Rules change — review
 * https://www.etsy.com/legal/policy periodically and update the lists below.
 */
const LIMITS = {
  titleMax: 140,
  titleRecommendedChars: 100, // Etsy suggests short, readable titles
  titleRecommendedWords: 15,
  titleMaxAllCapsWords: 3,
  tagsMax: 13,
  tagMaxChars: 20,
  materialsMax: 13,
  materialMaxChars: 45,
  altTextMaxChars: 250,
  descriptionMinWords: 120,
};

// Characters Etsy rejects in titles, and characters that may appear only once.
const TITLE_BANNED_CHARS = ["$", "^", "`"];
const TITLE_ONCE_CHARS = ["%", ":", "&"];

// Tags: letters (any language), numbers, spaces, hyphen, apostrophe, ™ © ®
const TAG_ALLOWED = /^[\p{L}\p{N} \-'™©®]+$/u;

/*
 * Trademarks / protected names. "block" = very likely an IP takedown → listing
 * removal and possible account suspension. "caution" = only OK in a truthful,
 * descriptive way (e.g. "case compatible with iPhone 15"), never as branding.
 */
const TRADEMARKS_BLOCK = [
  "disney", "pixar", "marvel", "avengers", "spiderman", "spider-man", "spider man", "batman", "superman",
  "star wars", "mandalorian", "baby yoda", "grogu", "harry potter", "hogwarts", "gryffindor", "slytherin",
  "pokemon", "pokémon", "pikachu", "nintendo", "super mario", "zelda", "kirby", "sonic the hedgehog",
  "hello kitty", "sanrio", "kuromi", "my melody", "barbie", "mattel", "lego", "hot wheels",
  "mickey mouse", "mickey", "minnie mouse", "frozen elsa", "lilo and stitch", "toy story", "winnie the pooh disney",
  "nike", "adidas", "gucci", "louis vuitton", "chanel", "prada", "hermes", "hermès", "versace", "dior",
  "burberry", "fendi", "balenciaga", "off-white brand", "rolex", "cartier", "tiffany & co", "tiffany and co",
  "coca cola", "coca-cola", "starbucks", "mcdonalds", "mcdonald's", "pepsi", "red bull",
  "taylor swift", "swiftie", "eras tour", "beyonce", "beyoncé", "harry styles", "bts", "blackpink",
  "nfl", "nba", "mlb", "nhl", "fifa", "olympics", "super bowl", "world cup",
  "bluey", "peppa pig", "paw patrol", "sesame street", "cocomelon", "baby shark", "pj masks",
  "minecraft", "fortnite", "roblox", "among us", "grinch", "dr seuss", "dr. seuss", "snoopy", "peanuts gang",
  "garfield", "looney tunes", "bugs bunny", "scooby doo", "care bears", "pusheen", "squishmallow",
  "squishmallows", "labubu", "stanley cup", "stanley tumbler", "yeti cup", "yeti tumbler",
  "harley davidson", "harley-davidson", "john deere", "realtree", "mossy oak", "jeep",
  "stranger things", "friends tv", "the office tv", "dunder mifflin", "greys anatomy", "grey's anatomy", "yellowstone",
  "hocus pocus", "gilmore girls", "bridgerton", "addams family", "wednesday addams", "nightmare before christmas",
  "jack skellington", "sailor moon", "dragon ball", "naruto", "one piece", "demon slayer", "jujutsu kaisen",
  "studio ghibli", "totoro", "spirited away", "lord of the rings", "game of thrones", "the simpsons",
  "spongebob", "rugrats", "teenage mutant ninja turtles", "transformers", "my little pony", "strawberry shortcake",
  "onesie", "onesies", // registered trademark – use "baby bodysuit"
];

const TRADEMARKS_CAUTION = [
  "iphone", "ipad", "airpods", "apple watch", "macbook", "samsung", "kindle", "fitbit",
  "cricut", "silhouette cameo", "canva", "amazon", "instagram", "tiktok", "pinterest", "youtube",
  "velcro", "bubble wrap", "crock pot", "crockpot", "kleenex", "post-it", "sharpie", "jacuzzi", "taser",
  "ugg", "uggs", "crocs", "jibbitz", "pandora charm", "alex and ani", "lululemon",
  "polaroid", "ray-ban", "rayban", "lv", "cc logo", "gg logo", "mod podge", "pantone", "hallmark",
  "hogwarts style", "chanel style", "boho chanel", "star trek", "dungeons and dragons",
  "d&d", "dnd", "magic the gathering", "warhammer", "pokeball", "tamagotchi",
];

// Wording that signals a copy of a protected item → prohibited regardless of brand.
const COUNTERFEIT_TERMS = [
  "replica", "knockoff", "knock off", "knock-off", "dupe", "counterfeit", "fake designer", "inspired by",
  "look alike", "lookalike", "designer inspired", "aaa quality", "mirror quality", "unauthorized",
  "fan made", "fanmade", "fan art", "bootleg", "parody of",
];

// Medical / health claims are not allowed on Etsy.
const MEDICAL_TERMS = [
  "cure", "cures", "curing", "heals", "treatment for", "prevents disease", "prevent disease",
  "fda approved", "fda-approved", "clinically proven", "medical grade", "anti-anxiety", "anxiety relief",
  "depression relief", "pain relief", "relieves pain", "detox", "weight loss", "lose weight", "fat burner",
  "antibacterial", "anti-bacterial", "antiviral", "anti-viral", "kills germs", "kills bacteria", "kills viruses",
  "covid", "coronavirus", "cures cancer", "cancer treatment", "diabetes", "arthritis cure", "boosts immunity", "immune boost",
  "hypoallergenic guaranteed", "miracle cure",
];

// Items or ingredients Etsy prohibits or heavily restricts.
const PROHIBITED_TERMS = [
  "cbd", "thc", "kratom", "delta 8", "delta-8", "psilocybin", "magic mushroom", "drug paraphernalia",
  "brass knuckles", "switchblade", "butterfly knife", "gravity knife", "stun gun", "pepper spray",
  "elephant ivory", "real ivory", "rhino horn", "real tortoiseshell", "shark fin", "tiger skin", "human remains", "human bone",
  "nicotine", "vape juice", "e-liquid", "alcoholic beverage", "liquor bottle full", "prescription", "contact lenses",
  "recalled", "nazi", "swastika", "confederate flag", "kkk",
];

// Wording that pushes buyers off Etsy (fee circumvention) — House Rules violation.
const OFFSITE_TERMS = [
  "whatsapp", "telegram", "venmo", "cash app", "cashapp", "zelle", "paypal me", "paypal.me",
  "western union", "contact me at", "email me at", "dm me on", "message me on instagram",
  "buy on my website", "my website", "order directly", "outside etsy", "off etsy", "cheaper on",
  "follow me on", "my instagram", "my facebook", "my tiktok", "call me at", "text me at",
];

// Unverifiable / misleading marketing claims.
const MISLEADING_TERMS = [
  "best seller", "bestseller", "#1", "number one", "best on etsy", "etsy's pick", "etsy pick", "star seller",
  "100% guaranteed", "guaranteed results", "lowest price", "cheapest", "officially licensed",
  "authentic designer", "certified", "limited time only", "free money",
];

const ADULT_TERMS = ["nsfw", "xxx", "porn", "explicit content", "18+"];

const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "by", "or", "at", "from", "as", "is",
  "your", "my", "her", "him", "his", "their", "our", "it", "set", "pack", "gift", "gifts",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|shop|store|co|io|me|pk|uk|us)\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/;
const HANDLE_RE = /(?:^|\s)@[a-z0-9_.]{3,}/i;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word / whole-phrase match, case-insensitive.
function findTerms(text, terms) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits = [];
  for (const term of terms) {
    const re = new RegExp("(?:^|[^\\p{L}\\p{N}])" + escapeRe(term) + "(?=$|[^\\p{L}\\p{N}])", "iu");
    if (re.test(lower)) hits.push(term);
  }
  return hits;
}

function words(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []);
}

function issue(level, field, message, fix) {
  return { level, field, message, fix: fix || null };
}

/* ---------- content checks shared by every field ---------- */
function contentChecks(text, field, ctx) {
  const out = [];
  if (!text) return out;

  for (const t of findTerms(text, TRADEMARKS_BLOCK))
    out.push(issue("error", field, `Trademark / protected name "${t}". Using it can get the listing removed and your account suspended.`, { type: "remove", term: t }));
  for (const t of findTerms(text, TRADEMARKS_CAUTION))
    out.push(issue("warn", field, `"${t}" is a brand name. Only use it to describe compatibility truthfully (e.g. "compatible with ..."), never as your product's brand.`));
  for (const t of findTerms(text, COUNTERFEIT_TERMS))
    out.push(issue("error", field, `"${t}" suggests a copy of someone else's product — prohibited by Etsy's IP policy.`, { type: "remove", term: t }));
  for (const t of findTerms(text, MEDICAL_TERMS))
    out.push(issue("error", field, `Medical / health claim "${t}" is not allowed on Etsy.`, { type: "remove", term: t }));
  for (const t of findTerms(text, PROHIBITED_TERMS))
    out.push(issue("error", field, `"${t}" is a prohibited or restricted item on Etsy. Check the Prohibited Items Policy.`));
  for (const t of findTerms(text, OFFSITE_TERMS))
    out.push(issue("error", field, `"${t}" directs buyers off Etsy — breaks Etsy's House Rules (fee avoidance).`, { type: "remove", term: t }));
  for (const t of findTerms(text, MISLEADING_TERMS))
    out.push(issue("warn", field, `"${t}" is an unverifiable/misleading claim. Etsy may treat it as misleading.`, { type: "remove", term: t }));
  for (const t of findTerms(text, ADULT_TERMS))
    out.push(issue("warn", field, `"${t}" — mature content must be marked "mature" and must not appear in titles/thumbnails.`));

  if (EMAIL_RE.test(text)) out.push(issue("error", field, "Contains an email address. Keep all communication inside Etsy Messages."));
  if (URL_RE.test(text)) out.push(issue("error", field, "Contains a web link/domain. Links to outside sites are not allowed in listings."));
  if (PHONE_RE.test(text) && /\d{9,}/.test(text.replace(/[\s().-]/g, "")))
    out.push(issue("error", field, "Looks like a phone number. Don't share contact details in listings."));
  if (HANDLE_RE.test(text)) out.push(issue("warn", field, "Social media @handle found. Don't send buyers to social media to buy."));

  if (ctx) {
    const isVintage = ctx.itemType === "vintage";
    if (!isVintage && findTerms(text.replace(/\b(vintage|antique)[\s-]+(style|inspired|look|feel)\b/gi, ""), ["vintage", "antique"]).length)
      out.push(issue("warn", field, `Etsy "vintage" means 20+ years old. For new items say "vintage style" or "retro".`, { type: "replace", term: "vintage", with: "vintage style" }));
    const handmadeClaim = findTerms(text, ["handmade", "hand made", "handcrafted", "hand crafted"]).length;
    if (handmadeClaim && (ctx.itemType === "pod" || ctx.itemType === "supply-resell"))
      out.push(issue("error", field, `You selected "${ctx.itemTypeLabel}" but the text says handmade. That is misleading under Etsy's Creativity Standards.`));
    if (handmadeClaim && ctx.itemType === "digital")
      out.push(issue("warn", field, `Digital files aren't "handmade" — say "designed by" or "original design" instead.`));
  }
  return out;
}

/* ---------- title ---------- */
function checkTitle(title, ctx) {
  const out = [];
  const t = (title || "").trim();
  if (!t) return [issue("error", "title", "Title is empty.")];

  if (t.length > LIMITS.titleMax)
    out.push(issue("error", "title", `Title is ${t.length} characters — Etsy's limit is ${LIMITS.titleMax}.`, { type: "truncate", max: LIMITS.titleMax }));
  else if (t.length > LIMITS.titleRecommendedChars)
    out.push(issue("info", "title", `Title is ${t.length} characters. Etsy recommends short, readable titles — extra keywords can go in tags.`));

  const w = words(t);
  if (w.length > LIMITS.titleRecommendedWords)
    out.push(issue("info", "title", `${w.length} words. Etsy suggests about ${LIMITS.titleRecommendedWords} words or fewer.`));

  const caps = (t.match(/\b[A-Z]{2,}\b/g) || []).filter((x) => !/^(XS|S|M|L|XL|XXL|XXXL|UK|US|EU|USA|PDF|SVG|PNG|DXF|EPS|JPG|JPEG|DIY|LED|USB|A4|A5|A3|ABC|3D|2D|AM|PM|OZ|ML|CM|MM|KG|II|III|IV)$/.test(x));
  if (caps.length > LIMITS.titleMaxAllCapsWords)
    out.push(issue("error", "title", `${caps.length} words in ALL CAPS. Etsy allows a maximum of ${LIMITS.titleMaxAllCapsWords}.`, { type: "decap" }));
  else if (caps.length > 0)
    out.push(issue("info", "title", `ALL CAPS words: ${caps.join(", ")}. Fine in moderation, but sentence case reads better.`));

  for (const ch of TITLE_BANNED_CHARS)
    if (t.includes(ch)) out.push(issue("error", "title", `Character "${ch}" is not allowed in Etsy titles.`, { type: "stripChar", ch }));
  for (const ch of TITLE_ONCE_CHARS) {
    const n = t.split(ch).length - 1;
    if (n > 1) out.push(issue("error", "title", `"${ch}" appears ${n} times — Etsy allows it only once in a title.`, { type: "onceChar", ch }));
  }
  if (/\p{Extended_Pictographic}/u.test(t))
    out.push(issue("warn", "title", "Emoji in title — Etsy may reject it and it looks spammy in search."));

  const counts = {};
  for (const x of w) if (!STOPWORDS.has(x) && x.length > 2) counts[x] = (counts[x] || 0) + 1;
  const repeated = Object.keys(counts).filter((k) => counts[k] > 1);
  if (repeated.length)
    out.push(issue("warn", "title", `Repeated words: ${repeated.join(", ")}. Repeating keywords doesn't help ranking and looks like keyword stuffing.`));

  if (/(,\s*){0,}([^,]+,){6,}/.test(t))
    out.push(issue("warn", "title", "Title is a long comma-separated keyword list. Etsy's guidance is to describe the item clearly in the first few words."));

  return out.concat(contentChecks(t, "title", ctx));
}

/* ---------- tags ---------- */
function checkTags(tags, ctx, title) {
  const out = [];
  const list = (tags || []).map((x) => x.trim()).filter(Boolean);
  if (list.length > LIMITS.tagsMax)
    out.push(issue("error", "tags", `${list.length} tags — Etsy allows ${LIMITS.tagsMax}.`, { type: "trimTags" }));
  else if (list.length < LIMITS.tagsMax)
    out.push(issue("info", "tags", `Using ${list.length}/${LIMITS.tagsMax} tags. Use all 13 — empty tags are wasted search chances.`));

  const seen = new Set();
  for (const tag of list) {
    if (tag.length > LIMITS.tagMaxChars)
      out.push(issue("error", "tags", `Tag "${tag}" is ${tag.length} chars (max ${LIMITS.tagMaxChars}).`, { type: "fixTag", tag }));
    if (!TAG_ALLOWED.test(tag))
      out.push(issue("error", "tags", `Tag "${tag}" has characters Etsy doesn't allow (only letters, numbers, spaces, - ' ™ © ®).`, { type: "fixTag", tag }));
    const key = tag.toLowerCase();
    if (seen.has(key)) out.push(issue("error", "tags", `Duplicate tag "${tag}".`, { type: "dedupeTags" }));
    seen.add(key);
  }
  // plural duplicates
  for (const tag of list) {
    const k = tag.toLowerCase();
    if (!k.endsWith("s") && seen.has(k + "s"))
      out.push(issue("info", "tags", `"${tag}" and "${tag}s" — Etsy already matches plurals, so one of them is a wasted tag.`));
  }
  const singles = list.filter((x) => !x.includes(" "));
  if (singles.length > 3)
    out.push(issue("info", "tags", `${singles.length} single-word tags. Multi-word phrases (long-tail) usually match buyer searches better.`));

  for (const tag of list) out.push(...contentChecks(tag, "tags", ctx));
  return dedupeIssues(out);
}

/* ---------- description ---------- */
function checkDescription(desc, ctx) {
  const out = [];
  const d = (desc || "").trim();
  if (!d) return [issue("error", "description", "Description is empty.")];
  const n = words(d).length;
  if (n < LIMITS.descriptionMinWords)
    out.push(issue("info", "description", `${n} words. A fuller description (size, materials, how to order, care) answers buyer questions and reduces returns.`));
  const firstLine = d.split(/\n/)[0];
  if (firstLine.length < 40)
    out.push(issue("info", "description", "The first sentence shows in Google results — make it a clear sentence describing the item."));
  if (ctx && ctx.aiDesign && !/\bAI\b|artificial intelligence/i.test(d))
    out.push(issue("error", "description", "You marked the design as AI-assisted. Etsy's Creativity Standards require disclosing AI use in the description.", { type: "addAiDisclosure" }));
  return out.concat(contentChecks(d, "description", ctx));
}

function checkMaterials(materials, ctx) {
  const out = [];
  const list = (materials || []).map((x) => x.trim()).filter(Boolean);
  if (list.length > LIMITS.materialsMax)
    out.push(issue("error", "materials", `${list.length} materials — Etsy allows ${LIMITS.materialsMax}.`));
  for (const m of list) {
    if (m.length > LIMITS.materialMaxChars)
      out.push(issue("error", "materials", `Material "${m}" is longer than ${LIMITS.materialMaxChars} characters.`));
    out.push(...contentChecks(m, "materials", ctx));
  }
  return out;
}

function checkAltTexts(alts, ctx) {
  const out = [];
  (alts || []).forEach((a, i) => {
    if (a.length > LIMITS.altTextMaxChars)
      out.push(issue("warn", "alt", `Photo ${i + 1} alt text is ${a.length} chars (keep under ${LIMITS.altTextMaxChars}).`));
    out.push(...contentChecks(a, "alt", ctx));
  });
  return out;
}

function dedupeIssues(list) {
  const seen = new Set();
  return list.filter((i) => {
    const k = i.level + i.field + i.message;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function checkListing(listing, ctx) {
  const issues = dedupeIssues([
    ...checkTitle(listing.title, ctx),
    ...checkTags(listing.tags, ctx, listing.title),
    ...checkDescription(listing.description, ctx),
    ...checkMaterials(listing.materials, ctx),
    ...checkAltTexts(listing.altTexts, ctx),
  ]);
  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.filter((i) => i.level === "warn").length;
  const infos = issues.filter((i) => i.level === "info").length;
  const score = Math.max(0, 100 - errors * 20 - warns * 7 - infos * 2);
  return { issues, errors, warns, infos, score };
}

/* ---------- auto-fixers ---------- */
// Cleans a tag; if it is too long, drops leading modifier words but keeps the
// final noun ("personalized coffee mug gift" → "coffee mug gift"). Returns ""
// when no meaningful version fits in 20 characters.
const TAG_LEAD_STOP = new Set(["for", "of", "and", "to", "with", "in", "on", "the", "a", "an", "by"]);
function cleanTag(tag) {
  const t = tag
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} \-'™©®]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (t.length <= LIMITS.tagMaxChars) return t;
  const w = t.split(" ");
  for (let start = 1; start < w.length; start++) {
    if (TAG_LEAD_STOP.has(w[start])) continue;
    const c = w.slice(start).join(" ");
    if (c.length <= LIMITS.tagMaxChars) return w.length - start >= 2 || start === w.length - 1 ? c : "";
  }
  return "";
}

function removeTerm(text, term) {
  const re = new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(term) + "(?=$|[^\\p{L}\\p{N}])", "giu");
  return text
    .replace(re, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!])/g, "$1")
    .replace(/,[ \t]*,/g, ",")
    .replace(/^[ \t,]+|[ \t,]+$/gm, "")
    .trim();
}

function sentenceCaseWord(w) {
  return w.charAt(0) + w.slice(1).toLowerCase();
}

function fixTitle(title) {
  let t = title.trim();
  for (const ch of TITLE_BANNED_CHARS) t = t.split(ch).join("");
  for (const ch of TITLE_ONCE_CHARS) {
    const idx = t.indexOf(ch);
    if (idx !== -1) {
      const replacement = ch === "&" ? "and" : ch === ":" ? "-" : " percent";
      t = t.slice(0, idx + 1) + t.slice(idx + 1).split(ch).join(replacement);
    }
  }
  let capsSeen = 0;
  t = t.replace(/\b[A-Z]{2,}\b/g, (m) => {
    if (/^(XS|S|M|L|XL|XXL|XXXL|UK|US|EU|USA|PDF|SVG|PNG|DXF|EPS|JPG|DIY|LED|USB|A4|A5|A3|3D|2D)$/.test(m)) return m;
    capsSeen++;
    return capsSeen > LIMITS.titleMaxAllCapsWords ? sentenceCaseWord(m) : m;
  });
  t = t.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s{2,}/g, " ").trim();
  if (t.length > LIMITS.titleMax) {
    t = t.slice(0, LIMITS.titleMax);
    const cut = Math.max(t.lastIndexOf(","), t.lastIndexOf(" "));
    if (cut > 80) t = t.slice(0, cut);
    t = t.replace(/[,\-|\s]+$/, "");
  }
  return t;
}

function fixTags(tags, ctx) {
  const out = [];
  const seen = new Set();
  for (const raw of tags) {
    let t = cleanTag(raw);
    for (const list of [TRADEMARKS_BLOCK, COUNTERFEIT_TERMS, MEDICAL_TERMS, OFFSITE_TERMS, MISLEADING_TERMS])
      if (findTerms(t, list).length) t = "";
    // plural/singular twins ("personalized mug" / "personalized mugs") waste a slot — Etsy matches both
    const key = t.split(" ").map((w) => (w.length > 3 ? w.replace(/s$/, "") : w)).join(" ");
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length === LIMITS.tagsMax) break;
  }
  return out;
}

const SCRUB_LISTS = [TRADEMARKS_BLOCK, COUNTERFEIT_TERMS, MEDICAL_TERMS, OFFSITE_TERMS, MISLEADING_TERMS];

function sentenceIsUnsafe(s) {
  if (EMAIL_RE.test(s) || URL_RE.test(s) || HANDLE_RE.test(s)) return true;
  if (PHONE_RE.test(s) && /\d{9,}/.test(s.replace(/[\s().-]/g, ""))) return true;
  return SCRUB_LISTS.some((list) => findTerms(s, list).length > 0);
}

// Remove problem wording. For titles/tags the single term is removed; for
// descriptions ({ sentences: true }) the whole sentence is dropped so no
// half-broken sentences are left behind.
function scrubText(text, ctx, opts) {
  let t = text || "";
  if (opts && opts.sentences) {
    t = t
      .split("\n")
      .map((line) => {
        const parts = line.split(/(?<=[.!?])\s+/);
        const kept = parts.filter((p) => !sentenceIsUnsafe(p));
        return kept.length === parts.length ? line : kept.join(" ").trim();
      })
      .filter((line, i, arr) => line.trim() || (i > 0 && arr[i - 1].trim()))
      .join("\n");
  }
  for (const list of SCRUB_LISTS)
    for (const term of findTerms(t, list)) t = removeTerm(t, term);
  t = t.replace(EMAIL_RE, "").replace(/\b(?:https?:\/\/|www\.)\S+/gi, "");
  if (ctx && ctx.itemType !== "vintage")
    t = t.replace(/\bvintage(?!\s+style|\s+inspired)/gi, (m) => (m[0] === "V" ? "Vintage style" : "vintage style"));
  if (ctx && (ctx.itemType === "pod" || ctx.itemType === "supply-resell"))
    t = t.replace(/\bhand\s?(made|crafted)\b/gi, "designed");
  return t;
}

/* ---------- uniqueness ---------- */
function jaccard(a, b) {
  const A = new Set(words(a).filter((w) => !STOPWORDS.has(w)));
  const B = new Set(words(b).filter((w) => !STOPWORDS.has(w)));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function similarityToHistory(listing, history) {
  let best = { score: 0, item: null };
  for (const h of history || []) {
    if (h.id === listing.id) continue;
    const s = 0.5 * jaccard(listing.title, h.title) + 0.5 * jaccard(listing.description, h.description);
    if (s > best.score) best = { score: s, item: h };
  }
  return best;
}

export const EtsyPolicy = {
  LIMITS,
  TRADEMARKS_BLOCK,
  findTerms,
  checkTitle,
  checkTags,
  checkDescription,
  checkMaterials,
  checkListing,
  contentChecks,
  fixTitle,
  fixTags,
  cleanTag,
  scrubText,
  removeTerm,
  similarityToHistory,
  jaccard,
  words,
};
