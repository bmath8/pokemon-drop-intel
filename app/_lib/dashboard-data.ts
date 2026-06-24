export type WatchItem = {
  title: string;
  channel: string;
  release: string;
  status: string;
  price: string;
  note: string;
  action: string;
  image: string;
};

export type ChannelSummary = {
  name: string;
  speed: string;
  status: string;
  edge: string;
  playbook: string;
};

export type LocalOpportunity = {
  title: string;
  detail: string;
};

export type StoreMemorySeed = {
  id: string;
  name: string;
  kind: "League Store" | "Vending Machine" | "Pickup Zone";
  location: string;
  driveTime: string;
  reliability: "High" | "Medium" | "Low";
  nextWindow: string;
  note: string;
};

export type StatBlock = {
  label: string;
  value: string;
  helper: string;
};

export type ReadinessSeed = {
  id: string;
  label: string;
  detail: string;
};

export type SourceLink = {
  label: string;
  href: string;
  note: string;
};

export type LaunchLink = {
  label: string;
  href: string;
};

export type ParsedSignal = {
  channel: string;
  signalType: string;
  urgency: "Critical" | "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  summary: string;
  actionItems: string[];
  dates: string[];
  urls: string[];
  purchaseLimit: string | null;
  matchedKeywords: string[];
};

export type ProductRecord = {
  id: string;
  title: string;
  aliases: string[];
  release: string;
  msrp: string;
  channels: string[];
  status: string;
  launchLinks: LaunchLink[];
};

export type NormalizedProductMatch = {
  productId: string;
  title: string;
  release: string;
  msrp: string;
  channels: string[];
  launchLinks: LaunchLink[];
  score: number;
  matchedTerms: string[];
  status: string;
};

export type ProductNormalizationResult = {
  primaryMatch: NormalizedProductMatch | null;
  candidates: NormalizedProductMatch[];
};

export type DashboardSeed = {
  generatedAt: string;
  channels: string[];
  watchItems: WatchItem[];
  productRegistry: ProductRecord[];
  channelData: ChannelSummary[];
  localOps: LocalOpportunity[];
  storeMemorySeed: StoreMemorySeed[];
  goMode: string[];
  statBlocks: StatBlock[];
  readinessSeed: ReadinessSeed[];
  sourceLinks: SourceLink[];
  buildQueue: Array<{ title: string; body: string }>;
};

export const dashboardSeed: DashboardSeed = {
  generatedAt: "April 29, 2026",
  channels: ["All", "Pokemon Center", "Retailers", "Local", "Community"],
  watchItems: [
    {
      title: "Mega Evolution - Chaos Rising Booster Bundle",
      channel: "Pokemon Center",
      release: "May 22, 2026",
      status: "Watch for newsletter and Early Access signals",
      price: "MSRP channel",
      note: "Official bundle page is already live, which makes it a clean anchor for alerts and queue checks.",
      action:
        "Prep account, keep newsletter email aligned, and route alerts the moment an invite lands.",
      image:
        "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
    },
    {
      title: "Perfect Order Elite Trainer Box",
      channel: "Retailers",
      release: "Live now",
      status: "Use as a benchmark SKU for retailer availability drift",
      price: "Track MSRP vs resale spread",
      note: "Good control product for testing which stores restock quietly versus only on announced drops.",
      action:
        "Compare pickup, ship-to-home, and limit wording across Target, Best Buy, Walmart, and GameStop.",
      image:
        "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/_tiles/me/me03/launch/me03-launch-169-en.png",
    },
    {
      title: "Destined Rivals ETB and booster family",
      channel: "Community",
      release: "Ongoing secondary watch",
      status: "Use community pings for speed, official pages for confirmation",
      price: "Watch for retail re-entry",
      note: "Still useful for proving which alert channels beat resale spikes and which ones are just noise.",
      action:
        "Feed Discord and Reddit sightings into a single queue, then mark only confirmed retailer links as actionable.",
      image:
        "https://images.pokemontcg.io/sv10/97_hires.png",
    },
    {
      title: "Play! Pokemon prerelease weekends",
      channel: "Local",
      release: "Up to two weeks before set release",
      status: "Low latency, low bot pressure",
      price: "Event entry plus product",
      note: "Prerelease and League channels are one of the cleanest ways to get product before the main retail crush.",
      action:
        "Track stores by drive time, event cadence, and whether they reliably post prerelease signups early.",
      image:
        "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/_tiles/me/me03/launch/me03-launch-169-en.png",
    },
  ],
  productRegistry: [
    {
      id: "me-chaos-rising-booster-bundle",
      title: "Mega Evolution - Chaos Rising Booster Bundle",
      aliases: [
        "chaos rising booster bundle",
        "mega evolution chaos rising booster bundle",
        "me04 booster bundle",
      ],
      release: "May 22, 2026",
      msrp: "MSRP channel",
      channels: ["Pokemon Center", "Retailers"],
      status: "Active watch",
      launchLinks: [
        {
          label: "Pokemon.com gallery",
          href: "https://www.pokemon.com/us/pokemon-tcg/product-gallery/mega-evolution-chaos-rising-booster-bundle",
        },
        {
          label: "Target",
          href: "https://www.target.com/p/-/A-95298172",
        },
        {
          label: "Best Buy",
          href: "https://www.bestbuy.com/product/pokemon-trading-card-game-mega-evolution-chaos-rising-booster-bundle/JJG2TL34H9",
        },
      ],
    },
    {
      id: "me-perfect-order-etb",
      title: "Perfect Order Elite Trainer Box",
      aliases: [
        "perfect order elite trainer box",
        "perfect order etb",
        "mega evolution perfect order etb",
      ],
      release: "Live now",
      msrp: "Track MSRP vs resale spread",
      channels: ["Retailers", "Community"],
      status: "Benchmark SKU",
      launchLinks: [
        {
          label: "Target",
          href: "https://www.target.com/p/-/A-95230445",
        },
        {
          label: "Best Buy",
          href: "https://www.bestbuy.com/site/searchpage.jsp?id=pcat17071&st=perfect+order+elite+trainer+box",
        },
      ],
    },
    {
      id: "sv-destined-rivals-etb",
      title: "Destined Rivals Elite Trainer Box",
      aliases: [
        "destined rivals elite trainer box",
        "destined rivals etb",
        "scarlet violet destined rivals etb",
      ],
      release: "Ongoing secondary watch",
      msrp: "Watch for retail re-entry",
      channels: ["Retailers", "Community"],
      status: "Secondary watch",
      launchLinks: [
        {
          label: "Target",
          href: "https://www.target.com/p/-/A-94300069",
        },
        {
          label: "Best Buy",
          href: "https://www.bestbuy.com/site/pokmon-trading-card-game-scarlet-violet-destined-rivals-elite-trainer-box/6624825.p?skuId=6624825",
        },
        {
          label: "Walmart",
          href: "https://www.walmart.com/ip/18672305746",
        },
      ],
    },
    {
      id: "play-prerelease-window",
      title: "Play! Pokemon Prerelease Window",
      aliases: [
        "prerelease",
        "play pokemon prerelease",
        "league prerelease",
        "prerelease registration",
      ],
      release: "Up to two weeks before set release",
      msrp: "Event entry plus product",
      channels: ["Local"],
      status: "Local opportunity",
      launchLinks: [
        {
          label: "Play! Pokemon locator",
          href: "https://play.pokemon.com/en-us/local-tournaments/",
        },
      ],
    },
  ],
  channelData: [
    {
      name: "Pokemon Center",
      speed: "High signal",
      status: "Queue + Early Access + preorder rules",
      edge:
        "Best place to route official notifications, newsletter tracking, and single-session drop readiness.",
      playbook:
        "Watch queue state, watch inbox, keep one browser path ready, and split preorder vs non-preorder decisions.",
    },
    {
      name: "Retailers",
      speed: "Medium to bursty",
      status: "Target, Walmart, Best Buy, GameStop",
      edge:
        "Best place to normalize SKU, MSRP, pickup options, and product-page changes into one board.",
      playbook:
        "Track listing health, inventory copy changes, store pickup radius, and house-limit wording.",
    },
    {
      name: "Local",
      speed: "Steady",
      status: "Vending machines, League stores, prerelease hosts",
      edge:
        "Less competition from industrial bot farms and more value from geography, timing, and persistence.",
      playbook:
        "Build a route map, save top stores, and mark who reliably gets stock first.",
    },
    {
      name: "Community",
      speed: "Fast but noisy",
      status: "Discord, Reddit, collector circles",
      edge: "Great for early smoke, bad as a final source of truth.",
      playbook:
        "Use community feeds as triggers, then auto-open the official or retailer page for confirmation.",
    },
  ],
  localOps: [
    {
      title: "Vending machine sweep",
      detail:
        "Map official machine locations near grocery routes and rank them by drive time, store hours, and recent community sightings.",
    },
    {
      title: "League store memory",
      detail:
        "Track which stores run prereleases, how early signup opens, and whether they enforce allocation cleanly.",
    },
    {
      title: "Pickup radius control",
      detail:
        "Save favored Target and Best Buy zones so manual checkout starts with the best pickup assumptions already in place.",
    },
  ],
  storeMemorySeed: [
    {
      id: "league-city",
      name: "League City Cards",
      kind: "League Store",
      location: "East side local route",
      driveTime: "24 min",
      reliability: "High",
      nextWindow: "Prerelease signup usually opens 10 days early",
      note:
        "Reliable on prerelease timing and usually posts registration in one batch instead of staggered waves.",
    },
    {
      id: "northside-vending",
      name: "Northside grocery vending machine",
      kind: "Vending Machine",
      location: "Saturday grocery loop",
      driveTime: "18 min",
      reliability: "Medium",
      nextWindow: "Best checks are early morning weekdays",
      note:
        "Worth checking after restock chatter, but machine stock disappears fast once local collectors notice.",
    },
    {
      id: "west-loop-pickup",
      name: "West loop pickup zone",
      kind: "Pickup Zone",
      location: "Target + Best Buy cluster",
      driveTime: "31 min",
      reliability: "Medium",
      nextWindow: "Useful for ship-to-store and pickup pivots",
      note:
        "Keep this zone ready when local inventory dries up near home but suburban pickup still flickers on.",
    },
  ],
  goMode: [
    "Stay signed in on the official retailer pages you actually use.",
    "Pre-validate billing, shipping, and pickup preferences before a drop window opens.",
    "Use official alerts and inbox parsing to open the correct product page immediately.",
    "Prefer one clean path per retailer instead of scrambling across duplicated pages.",
    "Log the result after every attempt so the app learns which channels convert for you.",
  ],
  statBlocks: [
    {
      label: "Tracked channels",
      value: "4",
      helper: "Official, retailer, local, community",
    },
    {
      label: "Priority watches",
      value: "12",
      helper: "Seeded for the first dashboard pass",
    },
    {
      label: "Local edge",
      value: "2 weeks",
      helper: "Prerelease lead when available",
    },
    {
      label: "Alert posture",
      value: "Live",
      helper:
        "Filtered mailbox sync, browser push, webhooks, and product rules are ready",
    },
  ],
  readinessSeed: [
    {
      id: "newsletter",
      label: "Pokemon Center newsletter aligned",
      detail:
        "Use the same email for newsletter subscription and the Pokemon Center account that will check out.",
    },
    {
      id: "account",
      label: "Retailer accounts signed in",
      detail:
        "Stay logged in only on the pages and apps you actually use so you do not burn time at drop start.",
    },
    {
      id: "payments",
      label: "Billing, shipping, and pickup validated",
      detail:
        "Confirm saved payment methods, addresses, and pickup stores before a window opens.",
    },
    {
      id: "queue",
      label: "Single-session queue discipline",
      detail:
        "For Pokemon Center, keep one browser path and avoid multi-tab improvisation that creates technical errors.",
    },
  ],
  sourceLinks: [
    {
      label: "Pokemon Center Early Access FAQ",
      href: "https://support.pokemoncenter.com/hc/en-us/articles/35134190572564-Pok%C3%A9mon-Center-Early-Access-FAQ",
      note:
        "Updated April 10, 2026. Early Access is single-use, tied to one email, and multiple subscriptions can void eligibility.",
    },
    {
      label: "Pokemon Center Virtual Queue",
      href: "https://support.pokemoncenter.com/hc/en-us/articles/37286495522452-Pok%C3%A9mon-Center-Virtual-Queue",
      note:
        "Updated October 15, 2025. Says not to refresh, not to use multiple tabs, and not to use VPNs.",
    },
    {
      label: "Pokemon Center newsletter signup",
      href: "https://support.pokemoncenter.com/hc/en-us/articles/4405458033812-How-do-I-sign-up-for-the-newsletter",
      note:
        "Official subscription path for getting into the pool for potential Early Access invites.",
    },
    {
      label: "Target Terms and Conditions",
      href: "https://www.target.com/c/terms-conditions/-/N-4sr7l",
      note:
        "Current terms distinguish approved agentic commerce from unapproved tools and automated buying agents.",
    },
    {
      label: "Walmart Terms of Use",
      href: "https://www.walmart.com/help/article/walmart-com--of-use/3b75080af40340d6bbd596f116fae5a0",
      note:
        "Current terms prohibit robots, spiders, scraping, data-mining, and circumventing site structure.",
    },
    {
      label: "Play! Pokemon local tournaments",
      href: "https://play.pokemon.com/en-us/local-tournaments/",
      note:
        "Use the Event Locator for prereleases, League stores, and local tournament discovery.",
    },
    {
      label: "What is the Prerelease program?",
      href: "https://support.pokemon.com/hc/en-us/articles/40087612558868-What-is-the-Prerelease-program",
      note:
        "Updated September 8, 2025. Confirms prerelease access can land up to two weeks before full release.",
    },
  ],
  buildQueue: [
    {
      title: "Source scoring",
      body:
        "Rank the channels, message types, and senders that actually convert into wins for you over time.",
    },
    {
      title: "Filter presets",
      body:
        "Save named mailbox filter sets for official retailers, local stores, and community alert feeds.",
    },
    {
      title: "Delivery profiles",
      body:
        "Save multiple named delivery setups for different channels, thresholds, and webhook destinations.",
    },
    {
      title: "Sync scheduling",
      body:
        "Run mailbox sync on a repeatable cadence so fresh signals keep arriving while the cockpit is open.",
    },
  ],
};

export type CollectorKind = "Raw" | "Graded" | "Sealed";

export type CollectorItem = {
  id: string;
  kind: CollectorKind;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  image: string;
  quantity: number;
  condition: string;
  grade?: string;
  certNumber?: string;
  purchasePrice: number;
  marketPrice: number;
  changePct: number;
  source: string;
  acquiredAt: string;
  tags: string[];
};

export type ScanCandidate = {
  id: string;
  name: string;
  setName: string;
  number: string;
  image: string;
  confidence: number;
  marketPrice: number;
  variants: string[];
};

export type MarketComp = {
  id: string;
  title: string;
  source: "TCGplayer" | "eBay" | "PSA" | "Cardmarket";
  price: number;
  type: "Sold" | "Active" | "Estimate";
  date: string;
  confidence: "High" | "Medium" | "Setup required";
};

export type MarketplaceListing = {
  id: string;
  title: string;
  image: string;
  askPrice: number;
  marketDelta: number;
  status: "Watch" | "Offer ready" | "Overpriced" | "Setup required";
  source: string;
  shipping: string;
};

export type GradingOrder = {
  id: string;
  title: string;
  certNumber?: string;
  grade?: string;
  image: string;
  stage: "Draft" | "Submitted" | "Research" | "Assembly" | "QA" | "Reveal";
  population: string;
  declaredValue: number;
  updatedAt: string;
};

export type DropAlert = {
  id: string;
  title: string;
  channel: string;
  urgency: "Critical" | "High" | "Medium";
  image: string;
  window: string;
  action: string;
};

export type IntegrationStatus = {
  id: "pokemon-tcg" | "ebay" | "tcgplayer" | "psa";
  label: string;
  status: "Live" | "Needs key" | "Restricted";
  detail: string;
};

export type CollectorSeed = {
  generatedAt: string;
  portfolioSparkline: number[];
  collection: CollectorItem[];
  scanCandidates: ScanCandidate[];
  marketComps: MarketComp[];
  marketplaceListings: MarketplaceListing[];
  gradingOrders: GradingOrder[];
  dropAlerts: DropAlert[];
  integrations: IntegrationStatus[];
};

export const collectorSeed: CollectorSeed = {
  generatedAt: "May 5, 2026",
  portfolioSparkline: [62, 64, 63, 67, 71, 69, 73, 76, 75, 81, 84, 88],
  collection: [
    {
      id: "pikachu-promos-swsh020",
      kind: "Graded",
      name: "Pikachu V",
      setName: "SWSH Black Star Promos",
      number: "SWSH020",
      rarity: "Promo",
      image: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
      quantity: 1,
      condition: "Slabbed",
      grade: "PSA 10",
      certNumber: "78245109",
      purchasePrice: 42,
      marketPrice: 86,
      changePct: 12.4,
      source: "PSA estimate",
      acquiredAt: "2025-12-14",
      tags: ["Slab", "Pikachu", "Display"],
    },
    {
      id: "charizard-paldean-fates-234",
      kind: "Raw",
      name: "Charizard ex",
      setName: "Paldean Fates",
      number: "234/091",
      rarity: "Special Illustration Rare",
      image: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
      quantity: 1,
      condition: "Near Mint",
      purchasePrice: 118,
      marketPrice: 146,
      changePct: 8.1,
      source: "TCG market",
      acquiredAt: "2026-01-20",
      tags: ["Raw", "Fire", "Grade candidate"],
    },
    {
      id: "umbreon-prismatic-161",
      kind: "Raw",
      name: "Umbreon ex",
      setName: "Prismatic Evolutions",
      number: "161/131",
      rarity: "Special Illustration Rare",
      image: "https://images.pokemontcg.io/sv8pt5/161_hires.png",
      quantity: 1,
      condition: "Near Mint",
      purchasePrice: 690,
      marketPrice: 742,
      changePct: -2.8,
      source: "Market blend",
      acquiredAt: "2026-02-04",
      tags: ["Grail", "Eeveelution", "Watch comps"],
    },
    {
      id: "mewtwo-destined-rivals-181",
      kind: "Raw",
      name: "Mewtwo",
      setName: "Destined Rivals",
      number: "181/182",
      rarity: "Illustration Rare",
      image: "https://images.pokemontcg.io/sv10/181_hires.png",
      quantity: 2,
      condition: "Near Mint",
      purchasePrice: 38,
      marketPrice: 51,
      changePct: 18.6,
      source: "Recent sales",
      acquiredAt: "2026-03-18",
      tags: ["Twin copies", "Momentum"],
    },
    {
      id: "chaos-rising-booster-bundle",
      kind: "Sealed",
      name: "Chaos Rising Booster Bundle",
      setName: "Mega Evolution",
      number: "ME04",
      rarity: "Sealed",
      image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
      quantity: 3,
      condition: "Factory sealed",
      purchasePrice: 89.97,
      marketPrice: 137.7,
      changePct: 21.2,
      source: "Launch watch",
      acquiredAt: "2026-05-02",
      tags: ["Sealed", "Drop target", "Pokemon Center"],
    },
    {
      id: "perfect-order-etb",
      kind: "Sealed",
      name: "Perfect Order Elite Trainer Box",
      setName: "Mega Evolution",
      number: "ME03",
      rarity: "Sealed",
      image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/_tiles/me/me03/launch/me03-launch-169-en.png",
      quantity: 2,
      condition: "Factory sealed",
      purchasePrice: 99.98,
      marketPrice: 124,
      changePct: 5.7,
      source: "Retailer blend",
      acquiredAt: "2026-04-11",
      tags: ["Sealed", "Retail"],
    },
  ],
  scanCandidates: [
    {
      id: "scan-charizard-234",
      name: "Charizard ex",
      setName: "Paldean Fates",
      number: "234/091",
      image: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
      confidence: 96,
      marketPrice: 146,
      variants: ["Raw NM", "PSA 9", "PSA 10"],
    },
    {
      id: "scan-mewtwo-181",
      name: "Mewtwo",
      setName: "Destined Rivals",
      number: "181/182",
      image: "https://images.pokemontcg.io/sv10/181_hires.png",
      confidence: 91,
      marketPrice: 51,
      variants: ["Raw NM", "Raw LP", "Grade candidate"],
    },
    {
      id: "scan-pikachu-promo",
      name: "Pikachu V",
      setName: "SWSH Black Star Promos",
      number: "SWSH020",
      image: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
      confidence: 88,
      marketPrice: 86,
      variants: ["Raw", "PSA 9", "PSA 10"],
    },
  ],
  marketComps: [
    {
      id: "comp-1",
      title: "Charizard ex 234/091 Near Mint",
      source: "TCGplayer",
      price: 146,
      type: "Estimate",
      date: "Today",
      confidence: "High",
    },
    {
      id: "comp-2",
      title: "Umbreon ex 161/131 PSA 10",
      source: "PSA",
      price: 1180,
      type: "Estimate",
      date: "Today",
      confidence: "Medium",
    },
    {
      id: "comp-3",
      title: "Chaos Rising Booster Bundle preorder",
      source: "eBay",
      price: 45.9,
      type: "Active",
      date: "Setup sample",
      confidence: "Setup required",
    },
    {
      id: "comp-4",
      title: "Mewtwo 181/182 recent sale",
      source: "Cardmarket",
      price: 49.25,
      type: "Sold",
      date: "3 days",
      confidence: "Medium",
    },
  ],
  marketplaceListings: [
    {
      id: "listing-1",
      title: "Charizard ex raw NM",
      image: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
      askPrice: 136,
      marketDelta: -6.8,
      status: "Offer ready",
      source: "Marketplace intelligence",
      shipping: "Free shipping",
    },
    {
      id: "listing-2",
      title: "Pikachu V PSA 10",
      image: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
      askPrice: 96,
      marketDelta: 11.6,
      status: "Watch",
      source: "PSA/eBay setup",
      shipping: "Ships tracked",
    },
    {
      id: "listing-3",
      title: "Chaos Rising sealed bundle",
      image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
      askPrice: 62,
      marketDelta: 35.1,
      status: "Overpriced",
      source: "Retail comp",
      shipping: "Buyer paid",
    },
  ],
  gradingOrders: [
    {
      id: "grade-1",
      title: "Charizard ex 234/091",
      image: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
      stage: "Draft",
      population: "Pop data requires PSA connection",
      declaredValue: 150,
      updatedAt: "Ready for review",
    },
    {
      id: "grade-2",
      title: "Pikachu V SWSH020",
      certNumber: "78245109",
      grade: "PSA 10",
      image: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
      stage: "Reveal",
      population: "PSA 10 pop: 1,240 sample",
      declaredValue: 90,
      updatedAt: "Verified sample",
    },
    {
      id: "grade-3",
      title: "Umbreon ex 161/131",
      image: "https://images.pokemontcg.io/sv8pt5/161_hires.png",
      stage: "Research",
      population: "Review centering and recent PSA 10 spread",
      declaredValue: 740,
      updatedAt: "Needs comp check",
    },
  ],
  dropAlerts: [
    {
      id: "drop-1",
      title: "Chaos Rising Booster Bundle",
      channel: "Pokemon Center",
      urgency: "Critical",
      image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
      window: "May 22, 2026",
      action: "Keep official queue path ready and monitor Early Access email.",
    },
    {
      id: "drop-2",
      title: "Perfect Order ETB restock",
      channel: "Retailers",
      urgency: "High",
      image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/_tiles/me/me03/launch/me03-launch-169-en.png",
      window: "Live now",
      action: "Compare pickup radius and purchase limits before acting.",
    },
    {
      id: "drop-3",
      title: "Prerelease local route",
      channel: "Local",
      urgency: "Medium",
      image: "https://images.pokemontcg.io/sv10/97_hires.png",
      window: "Two weeks pre-release",
      action: "Call saved League stores and log signup reliability.",
    },
  ],
  integrations: [
    {
      id: "pokemon-tcg",
      label: "Pokemon TCG catalog",
      status: "Live",
      detail: "Public search adapter with optional API key headroom.",
    },
    {
      id: "ebay",
      label: "eBay sold comps",
      status: "Needs key",
      detail: "Browse and Marketplace Insights credentials required for live active/sold data.",
    },
    {
      id: "tcgplayer",
      label: "TCGplayer pricing",
      status: "Restricted",
      detail: "Existing developer credentials required; new API access is restricted.",
    },
    {
      id: "psa",
      label: "PSA cert and population",
      status: "Needs key",
      detail: "Manual cert entry and sample slab views stay available until an approved source is connected.",
    },
  ],
};
