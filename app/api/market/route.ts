import { NextResponse } from "next/server";
import { collectorSeed } from "@/app/_lib/dashboard-data";

export async function GET() {
  const ebayReady = Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
  const tcgplayerReady = Boolean(
    process.env.TCGPLAYER_PUBLIC_KEY &&
      process.env.TCGPLAYER_PRIVATE_KEY &&
      process.env.TCGPLAYER_ACCESS_TOKEN,
  );

  return NextResponse.json({
    adapters: [
      {
        id: "ebay",
        label: "eBay active and sold comps",
        status: ebayReady ? "configured" : "setup-required",
        detail: ebayReady
          ? "Credentials detected. Wire Browse and Marketplace Insights requests next."
          : "Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. Sold history may require Marketplace Insights approval.",
      },
      {
        id: "tcgplayer",
        label: "TCGplayer pricing",
        status: tcgplayerReady ? "configured" : "restricted",
        detail: tcgplayerReady
          ? "Credentials detected. Pricing endpoints can be connected."
          : "Existing TCGplayer API credentials are required; new access is restricted.",
      },
      {
        id: "pokemon-tcg",
        label: "Pokemon TCG public pricing",
        status: "available",
        detail: process.env.POKEMON_TCG_API_KEY
          ? "API key detected for higher public catalog limits."
          : "Public API fallback is active with lower rate limits.",
      },
    ],
    comps: collectorSeed.marketComps,
    listings: collectorSeed.marketplaceListings,
  });
}
