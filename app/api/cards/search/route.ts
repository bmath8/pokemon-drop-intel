import { NextResponse } from "next/server";
import { collectorSeed } from "@/app/_lib/dashboard-data";

type PokemonTcgCard = {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set?: { name?: string };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number; low?: number }>;
  };
};

function marketPrice(card: PokemonTcgCard) {
  const prices = Object.values(card.tcgplayer?.prices ?? {});
  const firstPrice = prices.find((price) => price.market ?? price.mid ?? price.low);
  return firstPrice?.market ?? firstPrice?.mid ?? firstPrice?.low ?? null;
}

function fallbackCards(query: string) {
  const normalized = query.trim().toLowerCase();
  return collectorSeed.scanCandidates
    .filter((item) => {
      if (!normalized) return true;
      return `${item.name} ${item.setName} ${item.number}`
        .toLowerCase()
        .includes(normalized);
    })
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name,
      setName: item.setName,
      number: item.number,
      image: item.image,
      confidence: item.confidence,
      marketPrice: item.marketPrice,
      variants: item.variants,
      source: "seed-fallback",
    }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({
      status: "ready",
      source: "seed",
      results: fallbackCards(query),
    });
  }

  try {
    const params = new URLSearchParams({
      q: `name:"${query.replaceAll('"', '\\"')}*"`,
      pageSize: "8",
      select: "id,name,number,rarity,set,images,tcgplayer",
    });
    const headers: HeadersInit = {};

    if (process.env.POKEMON_TCG_API_KEY) {
      headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
    }

    const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API returned ${response.status}`);
    }

    const payload = (await response.json()) as { data?: PokemonTcgCard[] };
    const results = (payload.data ?? []).map((card, index) => ({
      id: card.id,
      name: card.name,
      setName: card.set?.name ?? "Unknown set",
      number: card.number ?? "n/a",
      rarity: card.rarity ?? "Unknown rarity",
      image: card.images?.large ?? card.images?.small ?? "",
      confidence: Math.max(76, 98 - index * 4),
      marketPrice: marketPrice(card),
      variants: ["Raw", "Near Mint", "Grade candidate"],
      source: "pokemon-tcg-api",
    }));

    return NextResponse.json({
      status: process.env.POKEMON_TCG_API_KEY ? "live" : "public-rate-limited",
      source: "pokemon-tcg-api",
      results: results.length > 0 ? results : fallbackCards(query),
    });
  } catch (error) {
    return NextResponse.json({
      status: "fallback",
      source: "seed-fallback",
      message:
        error instanceof Error
          ? error.message
          : "Card search fell back to seeded candidates.",
      results: fallbackCards(query),
    });
  }
}
