import type {
  NormalizedProductMatch,
  ProductNormalizationResult,
  ProductRecord,
} from "@/app/_lib/dashboard-data";

const genericTokens = new Set([
  "box",
  "bundle",
  "card",
  "elite",
  "evolution",
  "game",
  "mega",
  "play",
  "pokemon",
  "tcg",
  "trainer",
  "trading",
]);

function normalizeForSearch(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function scoreProduct(text: string, product: ProductRecord): NormalizedProductMatch | null {
  const searchable = normalizeForSearch(text);
  const matchedTerms: string[] = [];
  let score = 0;

  const variants = unique([product.title, ...product.aliases].map(normalizeForSearch));

  for (const variant of variants) {
    if (!variant) {
      continue;
    }

    if (searchable.includes(variant)) {
      matchedTerms.push(variant);
      score += variant === normalizeForSearch(product.title) ? 100 : 72;
      continue;
    }

    const tokenHits = unique(
      variant
        .split(" ")
        .filter(
          (token) =>
            token.length > 2 &&
            !genericTokens.has(token) &&
            searchable.includes(token),
        ),
    );

    if (tokenHits.length > 0) {
      matchedTerms.push(...tokenHits);
      score += tokenHits.length * 14;

      if (tokenHits.length >= 2) {
        score += 14;
      }
    }
  }

  const releaseHint = normalizeForSearch(product.release);
  if (releaseHint && searchable.includes(releaseHint)) {
    score += 12;
  }

  if (score === 0) {
    return null;
  }

  return {
    productId: product.id,
    title: product.title,
    release: product.release,
    msrp: product.msrp,
    channels: product.channels,
    launchLinks: product.launchLinks,
    score,
    matchedTerms: unique(matchedTerms),
    status: product.status,
  };
}

export function normalizeProductSignal(
  text: string,
  products: ProductRecord[],
): ProductNormalizationResult {
  const candidates = products
    .map((product) => scoreProduct(text, product))
    .filter((match): match is NormalizedProductMatch => match !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return {
    primaryMatch: candidates.length > 0 && candidates[0].score >= 22 ? candidates[0] : null,
    candidates,
  };
}
