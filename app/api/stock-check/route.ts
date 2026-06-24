import { dashboardSeed } from "@/app/_lib/dashboard-data";

export const runtime = "nodejs";

type StockStatus = "Available" | "Out" | "Manual review" | "Blocked" | "Error";

type StockCheckRequest = {
  productIds?: string[];
};

const minimumIntervalSeconds = readPositiveInteger(
  "POKEMON_STOCK_MIN_INTERVAL_SECONDS",
  60,
  900,
);

let lastCheckedAt = 0;

function readPositiveInteger(name: string, fallback: number, max: number) {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

async function readStockCheckRequest(request: Request): Promise<StockCheckRequest> {
  try {
    return (await request.json()) as StockCheckRequest;
  } catch {
    return {};
  }
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function classifyPage(
  status: number,
  statusText: string,
  body: string,
): { status: StockStatus; reason: string; signals: string[] } {
  const text = compactText(body).toLowerCase();
  const signals: string[] = [];

  if ([401, 403, 429].includes(status)) {
    return {
      status: "Blocked",
      reason: `Retailer returned ${status} ${statusText || "blocked"}. Open manually.`,
      signals,
    };
  }

  if (status >= 500) {
    return {
      status: "Manual review",
      reason: `Retailer returned ${status}. Page may be under load.`,
      signals,
    };
  }

  const blockedSignals = [
    "access denied",
    "captcha",
    "are you a human",
    "virtual queue",
    "waiting room",
  ];
  const outSignals = [
    "out of stock",
    "sold out",
    "currently unavailable",
    "unavailable online",
    "not available",
    "notify me when available",
  ];
  const availableSignals = [
    "add to cart",
    "add for shipping",
    "ship it",
    "pickup today",
    "preorder",
    "pre-order",
    "available now",
    "in stock",
  ];

  for (const signal of blockedSignals) {
    if (text.includes(signal)) signals.push(signal);
  }

  if (signals.length > 0) {
    return {
      status: "Manual review",
      reason: "Queue, CAPTCHA, or access-control wording was detected.",
      signals,
    };
  }

  for (const signal of outSignals) {
    if (text.includes(signal)) signals.push(signal);
  }

  if (signals.length > 0) {
    return {
      status: "Out",
      reason: "The page still reads as unavailable.",
      signals,
    };
  }

  for (const signal of availableSignals) {
    if (text.includes(signal)) signals.push(signal);
  }

  if (signals.length > 0) {
    return {
      status: "Available",
      reason: "Purchase or preorder wording is visible. Open the page manually.",
      signals,
    };
  }

  return {
    status: "Manual review",
    reason: "No clear stock wording was found.",
    signals,
  };
}

function selectedTargets(productIds: string[]) {
  const allowedProductIds = new Set(productIds);
  const products =
    allowedProductIds.size > 0
      ? dashboardSeed.productRegistry.filter((product) =>
          allowedProductIds.has(product.id),
        )
      : dashboardSeed.productRegistry;

  return products
    .flatMap((product) =>
      product.launchLinks.map((link) => ({
        productId: product.id,
        title: product.title,
        label: link.label,
        href: link.href,
      })),
    )
    .filter((target) => {
      try {
        const url = new URL(target.href);
        return ["http:", "https:"].includes(url.protocol);
      } catch {
        return false;
      }
    })
    .slice(0, 16);
}

export async function POST(request: Request) {
  const now = Date.now();
  const waitMs = minimumIntervalSeconds * 1000 - (now - lastCheckedAt);

  if (waitMs > 0) {
    return Response.json(
      {
        error: `Stock monitor is rate-limited. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
        minimumIntervalSeconds,
        nextAllowedAt: new Date(now + waitMs).toISOString(),
      },
      { status: 429 },
    );
  }

  const body = await readStockCheckRequest(request);
  const targets = selectedTargets(body.productIds ?? []);
  lastCheckedAt = now;

  const checkedAt = new Date(now).toISOString();
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const response = await fetch(target.href, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "PokemonDropIntel/0.1 fair-stock-monitor; manual-checkout-only",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(12000),
        });
        const bodyText = await response.text();
        const classification = classifyPage(
          response.status,
          response.statusText,
          bodyText.slice(0, 300_000),
        );

        return {
          ...target,
          checkedAt,
          statusCode: response.status,
          ...classification,
        };
      } catch (error) {
        return {
          ...target,
          checkedAt,
          status: "Error" as const,
          reason:
            error instanceof Error
              ? error.message
              : "The stock check request failed.",
          signals: [],
        };
      }
    }),
  );

  return Response.json({
    checkedAt,
    minimumIntervalSeconds,
    targetCount: targets.length,
    results,
  });
}
