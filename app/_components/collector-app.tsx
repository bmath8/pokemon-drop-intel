"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CollectorItem,
  CollectorKind,
  CollectorSeed,
  DashboardSeed,
  DropAlert,
  GradingOrder,
  IntegrationStatus,
  MarketplaceListing,
  ScanCandidate,
} from "@/app/_lib/dashboard-data";

type ViewId =
  | "home"
  | "binders"
  | "collection"
  | "scan"
  | "cardDetail"
  | "market"
  | "watchlist"
  | "grading"
  | "drops"
  | "profile";

type CardSearchResult = {
  id: string;
  name: string;
  setName: string;
  number: string;
  rarity?: string;
  image: string;
  confidence: number;
  marketPrice: number | null;
  variants: string[];
  source?: string;
};

type MarketAdapter = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

type VisualSpotlight = {
  id: string;
  title: string;
  detail: string;
  image: string;
  source: string;
  accent: string;
  matchName: string;
};

type ProductVisual = {
  title: string;
  image: string;
  channel: string;
  release: string;
  price: string;
  status: string;
};

type StockStatus = "Available" | "Out" | "Manual review" | "Blocked" | "Error";

type StockMonitorResult = {
  productId: string;
  title: string;
  label: string;
  href: string;
  checkedAt: string;
  status: StockStatus;
  reason: string;
  signals: string[];
  statusCode?: number;
};

type StockMonitorResponse = {
  error?: string;
  checkedAt?: string;
  minimumIntervalSeconds?: number;
  targetCount?: number;
  results?: StockMonitorResult[];
};

type StockAlertMode = "available" | "available-review";

type WebhookPreset = "custom" | "discord" | "slack";

type StockMonitorSettings = {
  enabled: boolean;
  cadenceSeconds: number;
  alertMode: StockAlertMode;
  webhookEnabled: boolean;
  webhookPreset: WebhookPreset;
  webhookUrl: string;
  monitoredProductIds: string[];
};

type StockMonitorNotification = {
  key: string;
  href: string;
  title: string;
  label: string;
  status: StockStatus;
  notifiedAt: string;
};

const collectionStorageKey = "pokemon-collector-collection-v2";
const watchlistStorageKey = "pokemon-collector-watchlist-v2";
const scansStorageKey = "pokemon-collector-scans-v2";
const stockMonitorSettingsStorageKey = "pokemon-collector-stock-monitor-settings-v1";
const stockMonitorResultsStorageKey = "pokemon-collector-stock-monitor-results-v1";
const stockMonitorNotificationsStorageKey = "pokemon-collector-stock-monitor-notifications-v1";
const defaultWatchlist = ["charizard-paldean-fates-234", "chaos-rising-booster-bundle"];

const navItems: Array<{ id: ViewId; label: string; short: string }> = [
  { id: "home", label: "Dashboard", short: "Home" },
  { id: "binders", label: "Binders", short: "Bind" },
  { id: "collection", label: "Collection", short: "Cards" },
  { id: "scan", label: "Scan", short: "Scan" },
  { id: "market", label: "Market Signals", short: "Market" },
  { id: "grading", label: "Grading Queue", short: "PSA" },
  { id: "drops", label: "Drop Command", short: "Drops" },
  { id: "watchlist", label: "Watchlist", short: "Watch" },
  { id: "profile", label: "Setup", short: "Setup" },
];

const binders = [
  {
    id: "grails",
    title: "Grail Binder",
    detail: "High-value raw cards and grade candidates",
    cover: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
    color: "from-red-500/20 to-sky-500/20",
    completion: 72,
  },
  {
    id: "sealed",
    title: "Sealed Vault",
    detail: "Bundles, ETBs, and launch-day product",
    cover: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
    color: "from-amber-400/20 to-emerald-400/20",
    completion: 58,
  },
  {
    id: "trade",
    title: "Trade Night",
    detail: "Duplicates, wishlist matches, and show-ready cards",
    cover: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
    color: "from-violet-400/20 to-pink-400/20",
    completion: 43,
  },
];

const setProgress = [
  { set: "Paldean Fates", owned: 61, total: 245, missing: "Mew ex, Gardevoir ex, Shiny Pikachu" },
  { set: "Destined Rivals", owned: 94, total: 182, missing: "Trainer SIR, Hyper Rare Energy" },
  { set: "Prismatic Evolutions", owned: 38, total: 131, missing: "Master Ball variants, Eeveelution SIRs" },
];

const binderSlots = Array.from({ length: 9 }, (_, index) => index);

const dealAlerts = [
  { title: "Charizard ex raw NM", verdict: "Good buy", price: 136, market: 146, confidence: "High" },
  { title: "Pikachu V PSA 10", verdict: "Counter", price: 96, market: 86, confidence: "Medium" },
  { title: "Chaos Rising sealed bundle", verdict: "Skip", price: 62, market: 45.9, confidence: "Setup sample" },
];

const gradingStages = ["Research", "Draft", "Submitted", "Assembly", "QA", "Reveal"];

const visualSpotlights: VisualSpotlight[] = [
  {
    id: "paldean-fates-charizard",
    title: "Charizard ex",
    detail: "High-res official card image with set, artist, rarity, and pricing metadata ready for the detail view.",
    image: "https://images.pokemontcg.io/sv4pt5/234_hires.png",
    source: "Pokemon TCG API",
    accent: "from-red-500 to-amber-300",
    matchName: "Charizard",
  },
  {
    id: "prismatic-umbreon",
    title: "Umbreon ex",
    detail: "Chase-card art gets treated as the collection hero, not a thumbnail buried in a table.",
    image: "https://images.pokemontcg.io/sv8pt5/161_hires.png",
    source: "Pokemon TCG API",
    accent: "from-indigo-500 to-sky-300",
    matchName: "Umbreon",
  },
  {
    id: "promo-pikachu",
    title: "Pikachu V",
    detail: "Promo and slab candidates stay visual from watchlist through grading reveal.",
    image: "https://images.pokemontcg.io/swshp/SWSH020_hires.png",
    source: "Pokemon TCG API",
    accent: "from-yellow-300 to-red-500",
    matchName: "Pikachu",
  },
  {
    id: "destined-rivals-mewtwo",
    title: "Mewtwo",
    detail: "Binder pages, scan results, and market comps share the same art-led identity.",
    image: "https://images.pokemontcg.io/sv10/181_hires.png",
    source: "Pokemon TCG API",
    accent: "from-violet-500 to-fuchsia-300",
    matchName: "Mewtwo",
  },
];

const productVisuals: ProductVisual[] = [
  {
    title: "Mega Evolution - Chaos Rising Booster Bundle",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me04-booster-bundle/me04-booster-bundle-169-en.png",
    channel: "Pokemon Center",
    release: "May 22, 2026",
    price: "MSRP channel",
    status: "Watch",
  },
  {
    title: "Mega Evolution - Ascended Heroes Booster Bundle",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me2pt5-booster-bundle/me2pt5-booster-bundle-169-en.png",
    channel: "Pokemon Center",
    release: "April 24, 2026",
    price: "Live",
    status: "Benchmark",
  },
  {
    title: "Mega Evolution - Phantasmal Flames Elite Trainer Box",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2025/me02-elite-trainer-box/me02-elite-trainer-box-169-en.png",
    channel: "Retailers",
    release: "Available now",
    price: "ETB",
    status: "Market",
  },
  {
    title: "Scarlet & Violet - 151 Pokemon Center Elite Trainer Box",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/sv035-pokemon-center-elite-trainer-box/sv035-pokemon-center-elite-trainer-box-169-en.png",
    channel: "Pokemon Center",
    release: "September 22, 2023",
    price: "Vault",
    status: "Collector",
  },
];

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function stockStatusTone(status: StockStatus): "green" | "red" | "yellow" | "blue" | "neutral" {
  if (status === "Available") return "green";
  if (status === "Out") return "neutral";
  if (status === "Blocked" || status === "Error") return "red";
  return "yellow";
}

function createInitialStockMonitorSettings(): StockMonitorSettings {
  return {
    enabled: false,
    cadenceSeconds: 120,
    alertMode: "available",
    webhookEnabled: false,
    webhookPreset: "discord",
    webhookUrl: "",
    monitoredProductIds: [],
  };
}

function shouldAlertForStockResult(result: StockMonitorResult, mode: StockAlertMode) {
  if (result.status === "Available") return true;
  return mode === "available-review" && result.status === "Manual review";
}

function stockNotificationKey(result: StockMonitorResult) {
  return `${result.status}:${result.href}`;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 999 ? 0 : 2,
  }).format(value);
}

function percent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function cls(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function PokeballIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={cls(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-white",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-red-600" />
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-950" />
      <span className="relative z-10 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-white" />
    </span>
  );
}

function Icon({ id }: { id: ViewId }) {
  const common = "h-5 w-5";

  if (id === "home") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11 12 4l8 7v8H5v-7" stroke="currentColor" strokeWidth="2" />
        <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "collection") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10v16H7V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M10 8h4M10 12h4M10 16h3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "binders") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 4v16M11 8h5M11 12h4" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "scan") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "market") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 18V9M12 18V5M19 18v-6" stroke="currentColor" strokeWidth="2" />
        <path d="M4 19h16" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "cardDetail") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 3h8l3 4v14H5V7l3-4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8h8v7H8V8ZM8 18h5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "grading") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10l2 4v12H5V8l2-4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 9h8M9 14h6" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "drops") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "watchlist") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m12 3 2.5 5.5 6 .7-4.5 4 1.4 5.8L12 16l-5.4 3 1.4-5.8-4.5-4 6-.7L12 3Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 12H3m18 0h-2M12 5V3m0 18v-2M6.7 6.7 5.3 5.3m13.4 13.4-1.4-1.4M17.3 6.7l1.4-1.4M5.3 18.7l1.4-1.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CardImage({
  item,
  className = "",
  priority = false,
  fit = "cover",
}: {
  item: { name: string; image: string };
  className?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
}) {
  return (
    <div className={cls("collector-image-fallback relative overflow-hidden bg-slate-950 shadow-sm", className)}>
      {item.image ? (
        <Image
          src={item.image}
          alt={item.name}
          fill
          unoptimized
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          sizes="(max-width: 640px) 38vw, (max-width: 1024px) 28vw, 240px"
          className={cls("transition duration-500", fit === "contain" ? "object-contain p-2" : "object-cover")}
        />
      ) : (
        <div className="grid h-full place-items-center px-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white/60">
          Artwork pending
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 42 - ((value - min) / Math.max(1, max - min)) * 34;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 48" className="h-16 w-full" aria-hidden="true">
      <path d="M0 44H100" stroke="rgba(15,23,42,.08)" strokeWidth="1" />
      <polyline fill="none" points={points} stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "red" | "yellow" | "blue" | "neutral" }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <span className={cls("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]", tones[tone])}>
      {children}
    </span>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cls("min-w-0 rounded-[18px] border border-slate-200/80 bg-white shadow-[0_10px_34px_rgba(9,13,27,0.07)]", className)}>
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 px-4 pb-3 pt-5 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
        {detail ? <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cls(
        "min-h-11 rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300",
        props.className,
      )}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cls(
        "min-h-11 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50",
        props.className,
      )}
    />
  );
}

function IntegrationCard({ integration }: { integration: IntegrationStatus | MarketAdapter }) {
  const tone =
    integration.status === "Live" || integration.status === "available" || integration.status === "configured"
      ? "green"
      : integration.status === "Restricted" || integration.status === "restricted"
        ? "yellow"
        : "blue";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-black text-slate-950">{integration.label}</p>
        <StatusPill tone={tone}>{integration.status}</StatusPill>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-500">{integration.detail}</p>
    </div>
  );
}

function HoldingCard({
  item,
  selected,
  onSelect,
  onRemove,
  priority = false,
}: {
  item: CollectorItem;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  priority?: boolean;
}) {
  const total = item.marketPrice * item.quantity;

  return (
    <article
      className={cls(
        "group overflow-hidden rounded-[24px] border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
        selected ? "border-slate-950 ring-4 ring-slate-950/10" : "border-slate-200",
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <CardImage item={item} priority={priority} className="aspect-[4/5] rounded-b-[22px]" />
      </button>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950">{item.name}</p>
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              {item.setName} · {item.number}
            </p>
          </div>
          <StatusPill tone={item.changePct >= 0 ? "green" : "red"}>{percent(item.changePct)}</StatusPill>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Market</p>
            <p className="text-xl font-black text-slate-950">{currency(total)}</p>
          </div>
          <p className="text-right text-sm font-bold text-slate-500">
            {item.kind}
            <br />
            x{item.quantity}
          </p>
        </div>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-red-50 hover:text-red-700">
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CollectionDetail({
  item,
  watched,
  onMarket,
  onWatch,
  onIncrease,
  onDecrease,
}: {
  item?: CollectorItem;
  watched: boolean;
  onMarket: () => void;
  onWatch: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  if (!item) return null;

  const gain = item.marketPrice * item.quantity - item.purchasePrice * item.quantity;

  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[180px_1fr] xl:block">
        <div className="bg-slate-950 p-4">
          <CardImage item={item} priority className="aspect-[4/5] rounded-[24px]" />
        </div>
        <div className="grid gap-4 p-4">
          <div>
            <StatusPill tone={item.kind === "Graded" ? "blue" : item.kind === "Sealed" ? "yellow" : "green"}>
              {item.kind}
            </StatusPill>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{item.name}</h2>
            <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-slate-400">
              {item.setName} · {item.number}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Position</p>
              <p className="mt-1 text-xl font-black text-slate-950">{currency(item.marketPrice * item.quantity)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">P/L</p>
              <p className={cls("mt-1 text-xl font-black", gain >= 0 ? "text-emerald-600" : "text-red-600")}>
                {currency(gain)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SecondaryButton onClick={onDecrease} aria-label="Decrease quantity">-</SecondaryButton>
            <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700">
              x{item.quantity}
            </div>
            <SecondaryButton onClick={onIncrease} aria-label="Increase quantity">+</SecondaryButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <StatusPill key={tag}>{tag}</StatusPill>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton onClick={onMarket}>Market</PrimaryButton>
            <SecondaryButton onClick={onWatch}>{watched ? "Watching" : "Watch"}</SecondaryButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PortfolioHero({
  totalValue,
  costBasis,
  change,
  values,
  range,
  featuredItems,
  onRange,
  onScan,
  onExport,
}: {
  totalValue: number;
  costBasis: number;
  change: number;
  values: number[];
  range: "1D" | "1W" | "1M" | "ALL";
  featuredItems: CollectorItem[];
  onRange: (range: "1D" | "1W" | "1M" | "ALL") => void;
  onScan: () => void;
  onExport: () => void;
}) {
  const spotlight = featuredItems[0];
  const secondary = featuredItems[1];
  const tertiary = featuredItems[2];
  const artItems = featuredItems.filter((item) => item.kind !== "Sealed");
  const seenHeroImages = new Set<string>();
  const artGallery = [
    ...visualSpotlights.map((item) => ({ name: item.title, image: item.image })),
    ...artItems.map((item) => ({ name: item.name, image: item.image })),
  ].filter((item) => {
    if (seenHeroImages.has(item.image)) return false;
    seenHeroImages.add(item.image);
    return true;
  });
  const artSpotlight = artGallery[0] ?? (spotlight ? { name: spotlight.name, image: spotlight.image } : undefined);
  const artSecondary = artGallery[1] ?? (secondary ? { name: secondary.name, image: secondary.image } : undefined);
  const artTertiary = artGallery[2] ?? (tertiary ? { name: tertiary.name, image: tertiary.image } : undefined);

  return (
    <Panel className="collector-vault-hero collector-command-surface relative overflow-hidden border-0 bg-white">
      <div className="relative z-10 grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                Today in your vault
              </p>
              <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-5xl xl:text-[48px]">
                Collector command.
              </h1>
              <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-slate-600">
                Scan, price, grade, and catch drops from one workspace.
              </p>
            </div>
            <PokeballIcon className="h-12 w-12 border-slate-950 shadow-lg" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_0.82fr]">
            <div className="rounded-[18px] bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/15">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Vault value</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <p className="text-4xl font-black tracking-tight sm:text-5xl">{currency(totalValue)}</p>
                <StatusPill tone={change >= 0 ? "green" : "red"}>{percent(change)}</StatusPill>
              </div>
              <p className="mt-3 text-sm font-bold text-emerald-300">
                {currency(totalValue - costBasis)} profit against cost basis
              </p>
            </div>

            <button
              type="button"
              onClick={onScan}
              className="group grid min-w-0 grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg"
            >
              {spotlight ? (
                <CardImage
                  item={spotlight}
                  priority
                  fit={spotlight.kind === "Sealed" ? "contain" : "cover"}
                  className="h-16 rounded-[14px] bg-slate-50"
                />
              ) : (
                <PokeballIcon className="h-14 w-14" />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Next action</span>
                <span className="mt-1 block truncate text-lg font-black text-slate-950">Scan next card</span>
                <span className="mt-1 block truncate text-sm font-semibold text-slate-500">{spotlight?.name ?? "Ready for the next add"}</span>
              </span>
              <span className="hidden rounded-full bg-red-600 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white sm:inline-flex">
                Start
              </span>
            </button>
          </div>

          <div className="hidden gap-3 sm:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="rounded-[18px] border border-slate-200 bg-white p-3">
              <MiniSparkline values={values} />
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-[14px] bg-slate-100 p-1">
                {(["1D", "1W", "1M", "ALL"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onRange(item)}
                    className={cls(
                      "min-h-9 rounded-[11px] text-xs font-black",
                      range === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex lg:grid-cols-none">
              <PrimaryButton onClick={onScan} className="bg-red-600 shadow-red-600/20 hover:bg-slate-950">
                Scan card
              </PrimaryButton>
              <SecondaryButton onClick={onExport}>
                Export CSV
              </SecondaryButton>
            </div>
          </div>
        </div>

        <div className="relative hidden min-h-[300px] overflow-hidden rounded-[24px] bg-slate-950 p-5 text-white xl:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,35,60,0.24),transparent_36%),linear-gradient(315deg,rgba(255,212,59,0.26),transparent_38%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">Binder spotlight</p>
            <StatusPill tone="yellow">Live stack</StatusPill>
          </div>
          <div className="relative z-10 mt-5 h-56">
            {artTertiary ? <CardImage item={artTertiary} className="absolute left-1 top-9 aspect-[4/5] w-24 rotate-[-12deg] rounded-[16px] ring-4 ring-white/10 2xl:w-28" /> : null}
            {artSecondary ? <CardImage item={artSecondary} className="absolute right-1 top-12 aspect-[4/5] w-24 rotate-[10deg] rounded-[16px] ring-4 ring-white/10 2xl:w-28" /> : null}
            {artSpotlight ? <CardImage item={artSpotlight} priority className="absolute left-1/2 top-0 aspect-[4/5] w-32 -translate-x-1/2 rounded-[20px] shadow-2xl shadow-black/40 ring-4 ring-white/20 2xl:w-36" /> : null}
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-2">
            {["Binders", "Comps", "PSA"].map((item) => (
              <div key={item} className="rounded-[14px] border border-white/10 bg-white/10 p-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white/80">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function VisualVaultSection({
  spotlights,
  onOpen,
}: {
  spotlights: VisualSpotlight[];
  onOpen: (spotlight: VisualSpotlight) => void;
}) {
  const lead = spotlights[0];
  const supporting = spotlights.slice(1, 4);

  return (
    <section className="collector-art-wall relative overflow-hidden rounded-[18px] border-0 bg-slate-950 text-white shadow-[0_10px_34px_rgba(9,13,27,0.18)]">
      <div className="relative z-10 grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-stretch">
        <button
          type="button"
          onClick={() => onOpen(lead)}
          className="group grid min-h-[260px] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.06] p-4 text-left transition hover:bg-white/[0.10] sm:grid-cols-[minmax(0,1fr)_180px] sm:gap-5 sm:p-5"
        >
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Visual vault</p>
              <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-tight sm:text-4xl">
                Official art, real prices, faster decisions.
              </h2>
            </div>
            <div>
              <StatusPill tone="yellow">{lead.source}</StatusPill>
              <p className="mt-4 text-lg font-black">{lead.title}</p>
              <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-white/65">{lead.detail}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[0.78fr_1fr] items-end gap-3 sm:mt-0">
            {supporting[0] ? (
              <CardImage
                item={{ name: supporting[0].title, image: supporting[0].image }}
                className="aspect-[4/5] rounded-[16px] opacity-75 ring-4 ring-white/10"
              />
            ) : null}
            <CardImage
              item={{ name: lead.title, image: lead.image }}
              priority
              className="aspect-[4/5] rounded-[20px] shadow-2xl shadow-black/40 ring-4 ring-white/15 transition duration-500 group-hover:-translate-y-1 group-hover:rotate-[2deg]"
            />
          </div>
        </button>

        <div className="grid gap-3 sm:grid-cols-2">
          {supporting.map((spotlight) => (
            <button
              key={spotlight.id}
              type="button"
              onClick={() => onOpen(spotlight)}
              className="group grid min-w-0 grid-cols-[76px_1fr] gap-3 rounded-[18px] border border-white/10 bg-white/[0.06] p-3 text-left transition hover:bg-white/[0.10]"
            >
              <div className={cls("rounded-[15px] bg-gradient-to-br p-1", spotlight.accent)}>
                <CardImage item={{ name: spotlight.title, image: spotlight.image }} className="aspect-[4/5] rounded-[12px]" />
              </div>
              <div className="min-w-0 self-center">
                <p className="truncate text-base font-black">{spotlight.title}</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">{spotlight.source}</p>
                <p className="mt-2 hidden text-sm font-semibold leading-5 text-white/60 sm:line-clamp-2 sm:block">{spotlight.detail}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductShowcaseRail({ products }: { products: ProductVisual[] }) {
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        title="Product shelf"
        detail="Sealed product images, launch windows, and drop context stay visible beside card art."
      />
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4 sm:grid sm:grid-cols-2 xl:grid-cols-4 xl:overflow-visible">
        {products.slice(0, 4).map((product) => (
          <article
            key={product.title}
            className="min-w-[235px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
          >
            <div className="bg-[radial-gradient(circle_at_35%_20%,rgba(250,204,21,0.18),transparent_36%),linear-gradient(135deg,#f8fafc,#ffffff)] p-3">
              <CardImage
                item={{ name: product.title, image: product.image }}
                fit="contain"
                className="aspect-[16/11] rounded-[18px] bg-white"
              />
            </div>
            <div className="grid gap-3 p-4">
              <div>
                <p className="line-clamp-2 min-h-10 font-black leading-5 text-slate-950">{product.title}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{product.channel}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusPill tone={product.status === "Watch" ? "yellow" : "blue"}>{product.release}</StatusPill>
                <p className="text-sm font-black text-slate-950">{product.price}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function CollectorApp({
  seed,
  dropSeed,
}: {
  seed: CollectorSeed;
  dropSeed: DashboardSeed;
}) {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [moreOpen, setMoreOpen] = useState(false);
  const [portfolioRange, setPortfolioRange] = useState<"1D" | "1W" | "1M" | "ALL">("1M");
  const [marketMode, setMarketMode] = useState<"comps" | "listings" | "research">("comps");
  const [scanMode, setScanMode] = useState<"single" | "batch" | "binder">("single");
  const [selectedBinderId, setSelectedBinderId] = useState("grails");
  const [detailPriceMode, setDetailPriceMode] = useState<"raw" | "psa9" | "psa10" | "sealed">("raw");
  const [draftListingId, setDraftListingId] = useState("listing-1");
  const [dropDecision, setDropDecision] = useState<"collect" | "flip" | "skip">("collect");
  const [collection, setCollection] = useState<CollectorItem[]>(seed.collection);
  const [watchlist, setWatchlist] = useState<string[]>(defaultWatchlist);
  const [scanQueue, setScanQueue] = useState<ScanCandidate[]>(seed.scanCandidates);
  const [selectedKind, setSelectedKind] = useState<CollectorKind | "All">("All");
  const [selectedItemId, setSelectedItemId] = useState(collection[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("Charizard");
  const [searchResults, setSearchResults] = useState<CardSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState("Ready");
  const [marketAdapters, setMarketAdapters] = useState<MarketAdapter[]>([]);
  const [certInput, setCertInput] = useState("78245109");
  const [certStatus, setCertStatus] = useState("Manual cert lookup ready.");
  const [tradeGiveId, setTradeGiveId] = useState(seed.collection[0]?.id ?? "");
  const [tradeGetId, setTradeGetId] = useState(seed.collection[1]?.id ?? "");
  const [dropDraft, setDropDraft] = useState({
    subject: "Pokemon Center Early Access: Chaos Rising Booster Bundle",
    body: "You have Early Access to purchase Mega Evolution - Chaos Rising products on May 22, 2026. Limit one per customer.",
  });
  const [parsedDrop, setParsedDrop] = useState("");
  const [stockMonitorSettings, setStockMonitorSettings] = useState<StockMonitorSettings>(() =>
    createInitialStockMonitorSettings(),
  );
  const [stockMonitorResults, setStockMonitorResults] = useState<StockMonitorResult[]>([]);
  const [stockMonitorNotifications, setStockMonitorNotifications] = useState<StockMonitorNotification[]>([]);
  const [stockMonitorStatus, setStockMonitorStatus] = useState("Monitor idle.");
  const [isStockChecking, setIsStockChecking] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setCollection(loadStored(collectionStorageKey, seed.collection));
      setWatchlist(loadStored(watchlistStorageKey, defaultWatchlist));
      setScanQueue(loadStored(scansStorageKey, seed.scanCandidates));
      const storedStockSettings = loadStored<Partial<StockMonitorSettings>>(
        stockMonitorSettingsStorageKey,
        {},
      );
      setStockMonitorSettings({
        ...createInitialStockMonitorSettings(),
        ...storedStockSettings,
        monitoredProductIds:
          storedStockSettings.monitoredProductIds?.filter((id) =>
            dropSeed.productRegistry.some((product) => product.id === id),
          ) ?? dropSeed.productRegistry.map((product) => product.id),
      });
      setStockMonitorResults(
        loadStored<StockMonitorResult[]>(stockMonitorResultsStorageKey, []),
      );
      setStockMonitorNotifications(
        loadStored<StockMonitorNotification[]>(stockMonitorNotificationsStorageKey, []),
      );
      setIsStorageReady(true);
    });
  }, [dropSeed.productRegistry, seed.collection, seed.scanCandidates]);

  useEffect(() => {
    if (!isStorageReady) return;
    saveStored(stockMonitorSettingsStorageKey, stockMonitorSettings);
  }, [isStorageReady, stockMonitorSettings]);

  useEffect(() => {
    if (!isStorageReady) return;
    saveStored(stockMonitorResultsStorageKey, stockMonitorResults.slice(0, 24));
  }, [isStorageReady, stockMonitorResults]);

  useEffect(() => {
    if (!isStorageReady) return;
    saveStored(stockMonitorNotificationsStorageKey, stockMonitorNotifications.slice(0, 40));
  }, [isStorageReady, stockMonitorNotifications]);

  const monitoredProductIds = useMemo(
    () =>
      stockMonitorSettings.monitoredProductIds.length > 0
        ? stockMonitorSettings.monitoredProductIds
        : dropSeed.productRegistry.map((product) => product.id),
    [dropSeed.productRegistry, stockMonitorSettings.monitoredProductIds],
  );

  const stockStatusCounts = useMemo(
    () =>
      stockMonitorResults.reduce<Record<StockStatus, number>>(
        (counts, result) => ({
          ...counts,
          [result.status]: counts[result.status] + 1,
        }),
        { Available: 0, Out: 0, "Manual review": 0, Blocked: 0, Error: 0 },
      ),
    [stockMonitorResults],
  );

  const runStockMonitor = useCallback(async (mode: "manual" | "scheduled" = "manual") => {
    if (isStockChecking) return;

    setIsStockChecking(true);
    setStockMonitorStatus(
      mode === "scheduled" ? "Scheduled monitor sweep running..." : "Checking curated launch links...",
    );

    try {
      const response = await fetch("/api/stock-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: monitoredProductIds,
        }),
      });
      const data = (await response.json()) as StockMonitorResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Stock monitor check failed.");
      }

      const results = data.results ?? [];
      const available = results.filter((result) => result.status === "Available");
      const manualReview = results.filter((result) => result.status === "Manual review");
      setStockMonitorResults(results);

      const existingKeys = new Set(stockMonitorNotifications.map((item) => item.key));
      const freshSignals = results
        .filter((result) => shouldAlertForStockResult(result, stockMonitorSettings.alertMode))
        .filter((result) => !existingKeys.has(stockNotificationKey(result)))
        .slice(0, 3);
      const notifiedAt = new Date().toISOString();

      if (freshSignals.length > 0) {
        setStockMonitorNotifications((current) => [
          ...freshSignals.map((result) => ({
            key: stockNotificationKey(result),
            href: result.href,
            title: result.title,
            label: result.label,
            status: result.status,
            notifiedAt,
          })),
          ...current,
        ].slice(0, 40));
      }

      setStockMonitorStatus(
        available.length > 0
          ? `${available.length} possible live link${available.length === 1 ? "" : "s"}. ${freshSignals.length} new signal${freshSignals.length === 1 ? "" : "s"}.`
          : `${results.length} links checked. ${manualReview.length} need manual review. ${freshSignals.length} new signal${freshSignals.length === 1 ? "" : "s"}.`,
      );

      if (
        freshSignals.length > 0 &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Pokemon stock signal", {
          body: `${freshSignals[0].title} may need action at ${freshSignals[0].label}.`,
        });
      }

      if (
        freshSignals.length > 0 &&
        stockMonitorSettings.webhookEnabled &&
        stockMonitorSettings.webhookUrl.trim()
      ) {
        const firstSignal = freshSignals[0];
        const relayResponse = await fetch("/api/relay-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: stockMonitorSettings.webhookUrl.trim(),
            preset: stockMonitorSettings.webhookPreset,
            payload: {
              deliveredAt: notifiedAt,
              launchHref: firstSignal.href,
              productTitle: firstSignal.title,
              source: "fair-stock-monitor",
              parsed: {
                channel: firstSignal.label,
                signalType: "Stock Monitor",
                urgency: firstSignal.status === "Available" ? "Critical" : "High",
                confidence: "Medium",
                summary: firstSignal.reason,
                purchaseLimit: "Open manually and follow retailer limits.",
              },
            },
          }),
        });

        if (!relayResponse.ok) {
          const relayBody = (await relayResponse.json().catch(() => null)) as { error?: string } | null;
          setStockMonitorStatus(
            relayBody?.error ?? "Stock signal found, but webhook relay failed.",
          );
        }
      }
    } catch (error) {
      setStockMonitorStatus(
        error instanceof Error ? error.message : "Stock monitor check failed.",
      );
    } finally {
      setIsStockChecking(false);
    }
  }, [isStockChecking, monitoredProductIds, stockMonitorNotifications, stockMonitorSettings]);

  useEffect(() => {
    if (!stockMonitorSettings.enabled) return;

    const cadenceMs = Math.max(60, stockMonitorSettings.cadenceSeconds) * 1000;
    const timer = window.setInterval(() => {
      void runStockMonitor("scheduled");
    }, cadenceMs);

    return () => window.clearInterval(timer);
  }, [runStockMonitor, stockMonitorSettings.enabled, stockMonitorSettings.cadenceSeconds]);

  const totalValue = useMemo(
    () => collection.reduce((sum, item) => sum + item.marketPrice * item.quantity, 0),
    [collection],
  );
  const costBasis = useMemo(
    () => collection.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0),
    [collection],
  );
  const weightedChange = useMemo(() => {
    if (collection.length === 0) return 0;
    return collection.reduce((sum, item) => sum + item.changePct, 0) / collection.length;
  }, [collection]);
  const selectedItem = collection.find((item) => item.id === selectedItemId) ?? collection[0];
  const filteredCollection =
    selectedKind === "All"
      ? collection
      : collection.filter((item) => item.kind === selectedKind);
  const watchedItems = collection.filter((item) => watchlist.includes(item.id));
  const kindBreakdown = (["Raw", "Graded", "Sealed"] as CollectorKind[]).map((kind) => ({
    kind,
    value: collection
      .filter((item) => item.kind === kind)
      .reduce((sum, item) => sum + item.marketPrice * item.quantity, 0),
  }));
  const rangeValues = useMemo(() => {
    const values = seed.portfolioSparkline;
    if (portfolioRange === "1D") return values.slice(-6);
    if (portfolioRange === "1W") return values.slice(-8);
    if (portfolioRange === "1M") return values.slice(-10);
    return values;
  }, [portfolioRange, seed.portfolioSparkline]);
  const tradeGive = collection.find((item) => item.id === tradeGiveId) ?? collection[0];
  const tradeGet = collection.find((item) => item.id === tradeGetId) ?? collection[1] ?? collection[0];
  const tradeGiveValue = tradeGive ? tradeGive.marketPrice * tradeGive.quantity : 0;
  const tradeGetValue = tradeGet ? tradeGet.marketPrice * tradeGet.quantity : 0;
  const tradeDelta = tradeGetValue - tradeGiveValue;
  const selectedBinder = binders.find((binder) => binder.id === selectedBinderId) ?? binders[0];
  const duplicateItems = collection.filter((item) => item.quantity > 1);
  const selectedListing =
    seed.marketplaceListings.find((listing) => listing.id === draftListingId) ?? seed.marketplaceListings[0];
  const detailPrices = selectedItem
    ? {
        raw: selectedItem.marketPrice,
        psa9: Math.round(selectedItem.marketPrice * 1.8),
        psa10: Math.round(selectedItem.marketPrice * 3.4),
        sealed: selectedItem.kind === "Sealed" ? selectedItem.marketPrice : Math.round(selectedItem.marketPrice * 0.75),
      }
    : { raw: 0, psa9: 0, psa10: 0, sealed: 0 };

  function commitCollection(next: CollectorItem[]) {
    setCollection(next);
    saveStored(collectionStorageKey, next);
  }

  function commitWatchlist(next: string[]) {
    setWatchlist(next);
    saveStored(watchlistStorageKey, next);
  }

  function commitScans(next: ScanCandidate[]) {
    setScanQueue(next);
    saveStored(scansStorageKey, next);
  }

  function addCandidate(candidate: ScanCandidate | CardSearchResult) {
    const nextItem: CollectorItem = {
      id: `${candidate.id}-${collection.length + scanQueue.length + 1}`,
      kind: "Raw",
      name: candidate.name,
      setName: candidate.setName,
      number: candidate.number,
      rarity: "Scan match",
      image: candidate.image,
      quantity: 1,
      condition: "Near Mint",
      purchasePrice: Number(candidate.marketPrice ?? 0),
      marketPrice: Number(candidate.marketPrice ?? 0),
      changePct: 0,
      source: "source" in candidate ? candidate.source ?? "Scan" : "Scan",
      acquiredAt: new Date().toISOString().slice(0, 10),
      tags: ["Scan add", "Review"],
    };
    commitCollection([nextItem, ...collection]);
    commitScans(scanQueue.filter((item) => item.id !== candidate.id));
    setSelectedItemId(nextItem.id);
    setActiveView("collection");
  }

  function removeItem(id: string) {
    commitCollection(collection.filter((item) => item.id !== id));
    commitWatchlist(watchlist.filter((itemId) => itemId !== id));
  }

  function toggleWatch(id: string) {
    commitWatchlist(
      watchlist.includes(id)
        ? watchlist.filter((itemId) => itemId !== id)
        : [id, ...watchlist],
    );
  }

  function adjustQuantity(id: string, direction: 1 | -1) {
    commitCollection(
      collection.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + direction) }
          : item,
      ),
    );
  }

  function bulkRepriceVisible(multiplier: number) {
    const visibleIds = new Set(filteredCollection.map((item) => item.id));
    commitCollection(
      collection.map((item) =>
        visibleIds.has(item.id)
          ? {
              ...item,
              marketPrice: Number((item.marketPrice * multiplier).toFixed(2)),
              changePct: Number((item.changePct + (multiplier > 1 ? 2.4 : -2.4)).toFixed(1)),
              source: "Bulk Easy Price",
            }
          : item,
      ),
    );
  }

  function openView(view: ViewId) {
    setActiveView(view);
    setMoreOpen(false);
  }

  function openCardDetail(item: CollectorItem) {
    setSelectedItemId(item.id);
    setActiveView("cardDetail");
    setMoreOpen(false);
  }

  async function runCardSearch() {
    setSearchStatus("Searching live catalog...");
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`);
      const data = (await response.json()) as {
        status: string;
        results: CardSearchResult[];
      };
      setSearchResults(data.results);
      setSearchStatus(
        data.status === "live"
          ? "Live Pokemon TCG match"
          : data.status === "fallback"
            ? "Showing fallback matches"
            : "Public catalog match",
      );
    } catch {
      setSearchResults(seed.scanCandidates);
      setSearchStatus("Search unavailable; seeded scan matches shown.");
    }
  }

  async function loadMarketAdapters() {
    try {
      const response = await fetch("/api/market");
      const data = (await response.json()) as { adapters: MarketAdapter[] };
      setMarketAdapters(data.adapters);
    } catch {
      setMarketAdapters([]);
    }
  }

  async function lookupCert() {
    setCertStatus("Checking cert adapter...");
    try {
      const response = await fetch(`/api/psa-cert?cert=${encodeURIComponent(certInput)}`);
      const data = (await response.json()) as { status: string; message: string };
      setCertStatus(`${data.status}: ${data.message}`);
    } catch {
      setCertStatus("PSA lookup route unavailable. Manual tracking remains active.");
    }
  }

  async function parseDropSignal() {
    setParsedDrop("Parsing drop signal...");
    try {
      const response = await fetch("/api/parse-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dropDraft),
      });
      const data = (await response.json()) as {
        parsed?: { summary: string; urgency: string; actionItems: string[] };
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setParsedDrop(
        data.parsed
          ? `${data.parsed.urgency}: ${data.parsed.summary}`
          : "Signal parsed.",
      );
    } catch (error) {
      setParsedDrop(error instanceof Error ? error.message : "Drop parser failed.");
    }
  }

  async function requestStockNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStockMonitorStatus("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    setStockMonitorStatus(
      permission === "granted"
        ? "Browser notifications ready for possible stock signals."
        : "Notification permission was not granted.",
    );
  }

  function setAllStockMonitorProducts() {
    setStockMonitorSettings((current) => ({
      ...current,
      monitoredProductIds: dropSeed.productRegistry.map((product) => product.id),
    }));
  }

  function toggleStockMonitorProduct(productId: string) {
    setStockMonitorSettings((current) => {
      const currentIds = current.monitoredProductIds.length > 0
        ? current.monitoredProductIds
        : dropSeed.productRegistry.map((product) => product.id);

      if (currentIds.includes(productId)) {
        if (currentIds.length === 1) {
          setStockMonitorStatus("Keep at least one product in the monitor.");
          return current;
        }

        return {
          ...current,
          monitoredProductIds: currentIds.filter((id) => id !== productId),
        };
      }

      return {
        ...current,
        monitoredProductIds: [...currentIds, productId],
      };
    });
  }

  function exportCsv() {
    const header = [
      "Name",
      "Kind",
      "Set",
      "Number",
      "Quantity",
      "Condition",
      "Grade",
      "Purchase Price",
      "Market Price",
      "Change",
    ];
    const rows = collection.map((item) =>
      [
        item.name,
        item.kind,
        item.setName,
        item.number,
        item.quantity,
        item.condition,
        item.grade ?? "",
        item.purchasePrice,
        item.marketPrice,
        item.changePct,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "pokemon-collector-export.csv";
    link.click();
    URL.revokeObjectURL(href);
  }

  function renderHome() {
    const movers = [...collection].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 3);
    const openVisualSpotlight = (spotlight: VisualSpotlight) => {
      const match = collection.find((item) => item.name.toLowerCase().includes(spotlight.matchName.toLowerCase()));
      if (match) {
        openCardDetail(match);
      } else {
        setActiveView("collection");
      }
    };

    return (
      <div className="grid w-full gap-5 2xl:grid-cols-[minmax(0,1280px)_360px] 2xl:items-start 2xl:justify-center">
        <div className="grid min-w-0 gap-5">
          <PortfolioHero
            totalValue={totalValue}
            costBasis={costBasis}
            change={weightedChange}
            values={rangeValues}
            range={portfolioRange}
            featuredItems={movers}
            onRange={setPortfolioRange}
            onScan={() => setActiveView("scan")}
            onExport={exportCsv}
          />

          <Panel className="xl:hidden">
            <SectionHeader title="Needs attention" detail="High-signal watches, grading, and drop risk." />
            <div className="grid grid-cols-3 gap-2 p-4">
              <button
                type="button"
                onClick={() => setActiveView("watchlist")}
                className="min-h-20 rounded-[18px] border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 sm:min-h-28"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Watching</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{watchedItems.length}</p>
                <p className="mt-1 hidden truncate text-sm font-semibold text-slate-500 sm:block">{watchedItems[0]?.name ?? "No active watch"}</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("grading")}
                className="min-h-20 rounded-[18px] border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 sm:min-h-28"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Grading</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{seed.gradingOrders.length}</p>
                <p className="mt-1 hidden truncate text-sm font-semibold text-slate-500 sm:block">{seed.gradingOrders[0]?.stage ?? "Queue clear"}</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("drops")}
                className="min-h-20 rounded-[18px] border border-slate-200 bg-slate-950 p-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-600 sm:min-h-28"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Drops</p>
                <p className="mt-2 text-2xl font-black">{seed.dropAlerts.filter((alert) => alert.urgency === "Critical").length}</p>
                <p className="mt-1 hidden truncate text-sm font-semibold text-white/60 sm:block">{seed.dropAlerts[0]?.title ?? "No drop alerts"}</p>
              </button>
            </div>
          </Panel>

          <VisualVaultSection spotlights={visualSpotlights} onOpen={openVisualSpotlight} />

          <div className="grid gap-3 sm:grid-cols-3">
            {kindBreakdown.map((entry) => (
              <Panel key={entry.kind} className="collector-metric-tile p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {entry.kind}
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">{currency(entry.value)}</p>
              </Panel>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Panel className="collector-action-tile p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Gem rate queue</p>
              <p className="mt-2 text-2xl font-black text-slate-950">2 review</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Grade candidates with centering and value upside.</p>
            </Panel>
            <Panel className="collector-action-tile p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Sold comps</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{seed.marketComps.filter((comp) => comp.type === "Sold").length}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Recent-sale research is separated from active asks.</p>
            </Panel>
            <Panel className="collector-action-tile p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Drop risk</p>
              <p className="mt-2 text-2xl font-black text-red-600">{seed.dropAlerts.filter((alert) => alert.urgency === "Critical").length} critical</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Launch windows surfaced beside portfolio watches.</p>
            </Panel>
          </div>

          <ProductShowcaseRail products={productVisuals} />

          <Panel>
            <SectionHeader
              title="Top movers"
              detail="Fast collector context: value movement, source freshness, and the next decision."
              action={<SecondaryButton onClick={() => setActiveView("market")}>Market</SecondaryButton>}
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {movers.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setActiveView("market");
                  }}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-1 hover:border-slate-300"
                >
                  <CardImage item={item} priority={index === 0} className="aspect-[4/5] rounded-[18px]" />
                  <p className="mt-3 truncate font-black text-slate-950">{item.name}</p>
                  <p className="text-sm font-bold text-slate-500">{currency(item.marketPrice)}</p>
                  <StatusPill tone={item.changePct >= 0 ? "green" : "red"}>{percent(item.changePct)}</StatusPill>
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              title="Next best actions"
              detail="Three useful moves based on your current collection state."
            />
            <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <button type="button" onClick={() => setActiveView("binders")} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Binder work</p>
                <p className="mt-2 text-lg font-black text-slate-950">Fill {setProgress[0].set}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{setProgress[0].total - setProgress[0].owned} cards left in the set checklist.</p>
              </button>
              <button type="button" onClick={() => setActiveView("cardDetail")} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Grade candidate</p>
                <p className="mt-2 text-lg font-black text-slate-950">{collection[0]?.name ?? "Review card"}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Compare raw vs PSA 9/10 before submitting.</p>
              </button>
              <button type="button" onClick={() => setActiveView("market")} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Deal finder</p>
                <p className="mt-2 text-lg font-black text-emerald-600">{dealAlerts[0].verdict}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{dealAlerts[0].title} is below market.</p>
              </button>
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-5 2xl:sticky 2xl:top-24">
          <Panel>
            <SectionHeader title="Active watches" detail={`${watchedItems.length} items watched`} />
            <div className="grid gap-3 p-4">
              {watchedItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setActiveView("market");
                  }}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left"
                >
                  <CardImage item={item} priority={index === 0} className="h-16 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-black text-slate-950">{item.name}</span>
                    <span className="block text-sm font-semibold text-slate-500">{item.source}</span>
                  </span>
                  <StatusPill tone={item.changePct >= 0 ? "green" : "red"}>{percent(item.changePct)}</StatusPill>
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Grading queue" detail="Certs, slabs, and submission stages" />
            <div className="grid gap-3 p-4">
              {seed.gradingOrders.slice(0, 2).map((order) => (
                <GradingMini key={order.id} order={order} priority />
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Setup health" detail="Live where possible, honest where credentials are missing." />
            <div className="grid gap-3 p-4">
              {seed.integrations.slice(0, 3).map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderBinders() {
    const binderItems = selectedBinder.id === "sealed"
      ? collection.filter((item) => item.kind === "Sealed")
      : selectedBinder.id === "trade"
        ? collection.filter((item) => item.quantity > 1 || watchlist.includes(item.id))
        : collection.filter((item) => item.kind !== "Sealed");

    return (
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {binders.map((binder) => (
            <button
              key={binder.id}
              type="button"
              onClick={() => setSelectedBinderId(binder.id)}
              className={cls(
                "overflow-hidden rounded-[26px] border bg-white text-left shadow-sm transition hover:-translate-y-1",
                selectedBinderId === binder.id ? "border-slate-950 ring-4 ring-slate-950/10" : "border-slate-200",
              )}
            >
              <div className={cls("grid grid-cols-[104px_1fr] gap-4 bg-gradient-to-br p-4", binder.color)}>
                <CardImage item={{ name: binder.title, image: binder.cover }} className="aspect-[4/5] rounded-2xl" />
                <span>
                  <span className="block text-xl font-black text-slate-950">{binder.title}</span>
                  <span className="mt-1 block text-sm font-semibold leading-5 text-slate-600">{binder.detail}</span>
                  <span className="mt-4 block h-2 overflow-hidden rounded-full bg-white/70">
                    <span className="block h-full rounded-full bg-slate-950" style={{ width: `${binder.completion}%` }} />
                  </span>
                  <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {binder.completion}% complete
                  </span>
                </span>
              </div>
            </button>
          ))}

          <Panel>
            <SectionHeader title="Duplicate radar" detail={`${duplicateItems.length} trade-ready stacks`} />
            <div className="grid gap-3 p-4">
              {duplicateItems.length > 0 ? duplicateItems.map((item) => (
                <button key={item.id} type="button" onClick={() => openCardDetail(item)} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left">
                  <CardImage item={item} className="h-14 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-black text-slate-950">{item.name}</span>
                    <span className="block text-sm font-semibold text-slate-500">{item.setName}</span>
                  </span>
                  <StatusPill tone="blue">x{item.quantity}</StatusPill>
                </button>
              )) : <p className="text-sm font-semibold text-slate-500">No duplicate stacks yet.</p>}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel>
            <SectionHeader
              title={`${selectedBinder.title} page`}
              detail="A binder-first view makes the app feel like a collection, not just a spreadsheet."
              action={<SecondaryButton onClick={() => setActiveView("scan")}>Scan page</SecondaryButton>}
            />
            <div className="grid grid-cols-3 gap-3 p-4">
              {binderSlots.map((slot) => {
                const item = binderItems[slot % Math.max(1, binderItems.length)];
                return item ? (
                  <button key={slot} type="button" onClick={() => openCardDetail(item)} className="rounded-[18px] border border-slate-200 bg-slate-50 p-2 transition hover:-translate-y-1">
                    <CardImage item={item} className="aspect-[4/5] rounded-[14px]" />
                    <p className="mt-2 truncate text-xs font-black text-slate-700">P{Math.floor(slot / 3) + 1} · {slot + 1}</p>
                  </button>
                ) : (
                  <div key={slot} className="grid aspect-[4/5] place-items-center rounded-[18px] border border-dashed border-slate-300 bg-white text-xs font-black text-slate-400">
                    Empty
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Set completion" detail="Borrowing the strongest checklist patterns from Pokémon-specific apps." />
            <div className="grid gap-3 p-4">
              {setProgress.map((entry) => (
                <div key={entry.set} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{entry.set}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{entry.missing}</p>
                    </div>
                    <p className="font-black text-slate-950">{entry.owned}/{entry.total}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(entry.owned / entry.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderCardDetail() {
    const item = selectedItem;
    if (!item) return null;

    const currentDetailPrice = detailPrices[detailPriceMode];
    const gradeUpside = detailPrices.psa10 - item.marketPrice;

    return (
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <div className="bg-slate-950 p-5">
            <CardImage item={item} priority className="aspect-[4/5] rounded-[28px]" />
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <StatusPill tone={item.kind === "Graded" ? "blue" : item.kind === "Sealed" ? "yellow" : "green"}>{item.kind}</StatusPill>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{item.name}</h1>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-slate-400">{item.setName} · {item.number}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PrimaryButton onClick={() => toggleWatch(item.id)}>{watchlist.includes(item.id) ? "Watching" : "Watch"}</PrimaryButton>
              <SecondaryButton onClick={() => setActiveView("grading")}>Grade</SecondaryButton>
              <SecondaryButton onClick={() => setActiveView("market")}>Comps</SecondaryButton>
              <SecondaryButton onClick={() => setActiveView("profile")}>List draft</SecondaryButton>
            </div>
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel>
            <SectionHeader title="Price ladder" detail="Raw, PSA 9, PSA 10, and sealed comparisons on one screen." />
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
              {(["raw", "psa9", "psa10", "sealed"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDetailPriceMode(mode)}
                  className={cls(
                    "rounded-2xl border p-4 text-left",
                    detailPriceMode === mode ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950",
                  )}
                >
                  <p className="text-xs font-black uppercase tracking-[0.12em] opacity-60">{mode}</p>
                  <p className="mt-2 text-2xl font-black">{currency(detailPrices[mode])}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Ownership" detail="Everything useful before buying, selling, grading, or trading." />
            <div className="grid gap-3 p-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Condition</p>
                <p className="mt-2 text-xl font-black text-slate-950">{item.condition}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Location</p>
                <p className="mt-2 text-xl font-black text-slate-950">{selectedBinder.title}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Upside</p>
                <p className="mt-2 text-xl font-black text-emerald-600">{currency(gradeUpside)}</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Recent comps" detail="Source freshness and confidence are visible before decisions." />
            <div className="grid gap-3 p-4">
              {seed.marketComps.slice(0, 3).map((comp) => (
                <div key={comp.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-black text-slate-950">{comp.title}</p>
                    <p className="text-sm font-semibold text-slate-500">{comp.source} · {comp.date}</p>
                  </div>
                  <p className="text-lg font-black text-slate-950">{currency(comp.price)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel>
            <SectionHeader title="Grade recommendation" detail="Expected value thinking before submission." />
            <div className="grid gap-3 p-4">
              <div className="rounded-[22px] bg-slate-950 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Verdict</p>
                <p className="mt-2 text-2xl font-black text-emerald-300">{gradeUpside > 100 ? "Grade candidate" : "Hold raw"}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/60">
                  Current {detailPriceMode.toUpperCase()} model: {currency(currentDetailPrice)}. Review centering, corners, and recent PSA 10 spread.
                </p>
              </div>
              {gradingStages.map((stage, index) => (
                <div key={stage} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <span className={cls("grid h-8 w-8 place-items-center rounded-full text-xs font-black", index < 2 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                    {index + 1}
                  </span>
                  <p className="font-black text-slate-700">{stage}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderCollection() {
    return (
      <div className="grid gap-5">
        <Panel>
          <SectionHeader
            title="Collection"
            detail={`${collection.length} holdings · ${currency(totalValue)} market value`}
            action={<SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>}
          />
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <div className="flex max-w-full gap-2 overflow-x-auto">
              {(["All", "Raw", "Graded", "Sealed"] as Array<CollectorKind | "All">).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setSelectedKind(kind)}
                  className={cls(
                    "min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black",
                    selectedKind === kind
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <SecondaryButton onClick={() => bulkRepriceVisible(1.05)}>Bulk +5%</SecondaryButton>
              <SecondaryButton onClick={() => bulkRepriceVisible(0.95)}>Bulk -5%</SecondaryButton>
            </div>
          </div>
        </Panel>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
            {filteredCollection.map((item, index) => (
              <HoldingCard
              key={item.id}
              item={item}
              priority={index === 0}
              selected={item.id === selectedItemId}
              onSelect={() => openCardDetail(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          </div>
          <CollectionDetail
            item={selectedItem}
            watched={selectedItem ? watchlist.includes(selectedItem.id) : false}
            onMarket={() => setActiveView("cardDetail")}
            onWatch={() => selectedItem ? toggleWatch(selectedItem.id) : undefined}
            onIncrease={() => selectedItem ? adjustQuantity(selectedItem.id, 1) : undefined}
            onDecrease={() => selectedItem ? adjustQuantity(selectedItem.id, -1) : undefined}
          />
        </div>
      </div>
    );
  }

  function renderScan() {
    const results = searchResults.length > 0 ? searchResults : scanQueue;

    return (
      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Panel className="overflow-hidden !bg-slate-950 text-white">
          <div className="relative grid min-h-[520px] content-between p-5">
            <div className="absolute inset-5 rounded-[28px] border border-white/15" />
            <div className="absolute left-9 right-9 top-1/2 h-px bg-white/20" />
            <div className="absolute bottom-10 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border-8 border-white/20" />
            <div className="relative z-10">
              <StatusPill tone="green">Scan ready</StatusPill>
              <h1 className="mt-4 text-4xl font-black tracking-tight">
                {scanMode === "binder" ? "Scan the page." : scanMode === "batch" ? "Batch, match, sort." : "Point, match, add."}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {scanMode === "binder"
                  ? "Capture a 3x3 binder page, detect duplicates, and route cards into the right binder pockets."
                  : scanMode === "batch"
                    ? "Use scanner-app patterns for quick bulk review, quantity, variants, and unresolved matches."
                    : "A camera-style scan surface modeled after card scanner workflows, with confidence and variants before adding to portfolio."}
              </p>
            </div>
            <div className="relative z-10 grid gap-3 rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
                {(["single", "batch", "binder"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScanMode(mode)}
                    className={cls(
                      "min-h-9 rounded-xl text-xs font-black capitalize",
                      scanMode === mode ? "bg-white text-slate-950" : "text-white/60",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-h-12 rounded-2xl border border-white/10 bg-white px-4 text-base font-bold text-slate-950 outline-none"
                placeholder="Search by card name"
              />
              <PrimaryButton onClick={runCardSearch} className="!bg-white !text-slate-950 hover:!bg-slate-100">
                Search catalog
              </PrimaryButton>
              {scanMode === "batch" ? (
                <SecondaryButton
                  onClick={() => results.slice(0, 3).forEach((candidate) => addCandidate(candidate))}
                  className="border-white/20 bg-white/10 text-white hover:border-white/40"
                >
                  Add top 3
                </SecondaryButton>
              ) : null}
              <p className="text-sm font-semibold text-white/60">{searchStatus}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Scan results" detail="Choose the best match, then add it to the portfolio." />
          {scanMode === "binder" ? (
            <div className="mx-4 mb-2 grid grid-cols-3 gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-3">
              {binderSlots.map((slot) => (
                <div key={slot} className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-black text-slate-400">
                  Pocket {slot + 1}
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((candidate) => (
              <article key={candidate.id} className="rounded-[24px] border border-slate-200 bg-white p-3">
                <CardImage item={candidate} className="aspect-[4/5] rounded-[20px]" />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{candidate.name}</p>
                    <p className="truncate text-sm font-semibold text-slate-500">
                      {candidate.setName} · {candidate.number}
                    </p>
                  </div>
                  <StatusPill tone="green">{candidate.confidence}%</StatusPill>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.variants.slice(0, 3).map((variant) => (
                    <StatusPill key={variant}>{variant}</StatusPill>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PrimaryButton onClick={() => addCandidate(candidate)}>Add</PrimaryButton>
                  <SecondaryButton onClick={() => setActiveView("watchlist")}>Queue</SecondaryButton>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderMarket() {
    const item = selectedItem;

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Panel className="overflow-hidden">
          <div className="grid lg:grid-cols-[340px_1fr]">
            <div className="bg-slate-950 p-6">
              {item ? <CardImage item={item} priority className="aspect-[4/5] rounded-[28px]" /> : null}
            </div>
            <div className="grid content-between gap-6 p-6">
              <div>
                <StatusPill tone="blue">{item?.kind ?? "Market"}</StatusPill>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
                  {item?.name ?? "Market intelligence"}
                </h1>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
                  {item?.setName} · {item?.number}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Market</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{currency(item?.marketPrice ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Basis</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{currency(item?.purchasePrice ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Move</p>
                    <p className={cls("mt-2 text-2xl font-black", (item?.changePct ?? 0) >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {percent(item?.changePct ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {item ? (
                  <PrimaryButton onClick={() => toggleWatch(item.id)}>
                    {watchlist.includes(item.id) ? "Watching" : "Add to watch"}
                  </PrimaryButton>
                ) : null}
                <SecondaryButton onClick={loadMarketAdapters}>Check adapters</SecondaryButton>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel>
            <SectionHeader title="Deal finder" detail="Market Movers-style quick verdicts before buying." />
            <div className="grid gap-3 p-4">
              {dealAlerts.map((deal) => {
                const delta = deal.market - deal.price;
                return (
                  <div key={deal.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{deal.title}</p>
                        <p className="text-sm font-semibold text-slate-500">
                          Ask {currency(deal.price)} · Market {currency(deal.market)}
                        </p>
                      </div>
                      <StatusPill tone={deal.verdict === "Good buy" ? "green" : deal.verdict === "Skip" ? "red" : "yellow"}>
                        {deal.verdict}
                      </StatusPill>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-black">
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-600">Spread<br />{currency(delta)}</div>
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-600">After fees<br />{currency(deal.market * 0.865)}</div>
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-600">Confidence<br />{deal.confidence}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Market desk" detail="Recent sales, active asks, and collector research in one card view." />
            <div className="flex gap-2 px-4 pb-2">
              {(["comps", "listings", "research"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMarketMode(mode)}
                  className={cls(
                    "min-h-10 rounded-2xl px-3 text-xs font-black capitalize",
                    marketMode === mode ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="grid gap-3 p-4">
              {marketMode === "comps"
                ? seed.marketComps.map((comp) => (
                    <div key={comp.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex justify-between gap-3">
                        <p className="font-black text-slate-950">{comp.title}</p>
                        <p className="font-black text-slate-950">{currency(comp.price)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="blue">{comp.source}</StatusPill>
                        <StatusPill tone={comp.confidence === "Setup required" ? "yellow" : "green"}>{comp.confidence}</StatusPill>
                        <StatusPill>{comp.type}</StatusPill>
                      </div>
                    </div>
                  ))
                : null}
              {marketMode === "listings"
                ? seed.marketplaceListings.map((listing) => (
                    <MarketplaceMini key={listing.id} listing={listing} />
                  ))
                : null}
              {marketMode === "research" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-black text-slate-950">Research checklist</p>
                  <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
                    <p>Check sold comps before active asks.</p>
                    <p>Compare raw, PSA 9, PSA 10, and sealed spreads separately.</p>
                    <p>Flag missing credentials instead of labeling fallback data as live.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          {marketAdapters.length > 0 ? (
            <Panel>
              <SectionHeader title="Adapter status" />
              <div className="grid gap-3 p-4">
                {marketAdapters.map((adapter) => (
                  <IntegrationCard key={adapter.id} integration={adapter} />
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    );
  }

  function renderWatchlist() {
    return (
      <div className="grid gap-5">
        <Panel>
          <SectionHeader title="Watchlist" detail="Cards, slabs, sealed product, and live drop opportunities in one queue." />
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {watchedItems.map((item, index) => (
            <HoldingCard key={item.id} item={item} priority={index === 0} onSelect={() => setSelectedItemId(item.id)} />
          ))}
          {seed.dropAlerts.map((alert) => (
            <DropCard key={alert.id} alert={alert} onOpen={() => setActiveView("drops")} />
          ))}
        </div>
      </div>
    );
  }

  function renderGrading() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <SectionHeader title="Grading desk" detail="PSA-style slab view, cert lookup, population notes, and submission stages." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {seed.gradingOrders.map((order) => (
              <GradingCard key={order.id} order={order} />
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionHeader title="Cert lookup" detail="Honest setup state until an approved PSA source is configured." />
          <div className="grid gap-3 p-4">
            <input
              value={certInput}
              onChange={(event) => setCertInput(event.target.value)}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-sky-400"
              placeholder="PSA cert number"
            />
            <PrimaryButton onClick={lookupCert}>Verify cert</PrimaryButton>
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
              {certStatus}
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  function renderMarketplace() {
    return (
      <Panel>
        <SectionHeader
          title="Marketplace intelligence"
          detail="Offer/watch signals only. No external purchase, listing, or message is submitted from this prototype."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {seed.marketplaceListings.map((listing) => (
            <MarketplaceCard key={listing.id} listing={listing} />
          ))}
        </div>
      </Panel>
    );
  }

  function renderListingDraft() {
    if (!selectedListing) return null;
    const net = selectedListing.askPrice * 0.865 - 4.25;

    return (
      <Panel>
        <SectionHeader
          title="Listing draft"
          detail="Ludex-style scan-to-list helper with no external posting in this pass."
        />
        <div className="grid gap-4 p-4">
          <div className="flex gap-2 overflow-x-auto">
            {seed.marketplaceListings.map((listing) => (
              <button
                key={listing.id}
                type="button"
                onClick={() => setDraftListingId(listing.id)}
                className={cls(
                  "min-h-10 shrink-0 rounded-2xl px-3 text-xs font-black",
                  draftListingId === listing.id ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600",
                )}
              >
                {listing.title}
              </button>
            ))}
          </div>
          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Draft title</p>
            <p className="text-lg font-black text-slate-950">{selectedListing.title} · {selectedListing.shipping} · Photos ready</p>
            <textarea
              readOnly
              value={`${selectedListing.title}. Condition reviewed, packed securely, and priced against recent comps. No external listing is submitted from this app yet.`}
              className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 outline-none"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ask</p>
                <p className="font-black text-slate-950">{currency(selectedListing.askPrice)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Net</p>
                <p className="font-black text-emerald-600">{currency(net)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Delta</p>
                <p className="font-black text-slate-950">{percent(selectedListing.marketDelta)}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function renderTradeAnalyzer() {
    return (
      <Panel>
        <SectionHeader
          title="Trade analyzer"
          detail="Quick fair-value verdict before you accept, counter, or walk away."
        />
        <div className="grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              You give
              <select
                value={tradeGive?.id ?? ""}
                onChange={(event) => setTradeGiveId(event.target.value)}
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
              >
                {collection.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {currency(item.marketPrice * item.quantity)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              You get
              <select
                value={tradeGet?.id ?? ""}
                onChange={(event) => setTradeGetId(event.target.value)}
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
              >
                {collection.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {currency(item.marketPrice * item.quantity)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-[24px] bg-slate-950 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Verdict</p>
            <p className={cls("mt-2 text-3xl font-black", tradeDelta >= 0 ? "text-emerald-300" : "text-red-300")}>
              {tradeDelta >= 0 ? "In your favor" : "Ask for more"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/65">
              Net difference: {currency(Math.abs(tradeDelta))} {tradeDelta >= 0 ? "above" : "below"} your side.
              Confirm condition, language, and sold comps before treating this as final.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  function renderDrops() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid content-start gap-5">
          <Panel>
            <SectionHeader title="Drop command" detail="Parse official alerts, choose a buying posture, and keep the final checkout step manual." />
            <div className="grid gap-4 p-4">
              <div className="grid grid-cols-3 gap-2">
                {(["collect", "flip", "skip"] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    onClick={() => setDropDecision(decision)}
                    className={cls(
                      "min-h-11 rounded-2xl text-sm font-black capitalize",
                      dropDecision === decision ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    {decision}
                  </button>
                ))}
              </div>
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
                Decision mode: <span className="font-black text-slate-950">{dropDecision}</span>. {dropDecision === "collect" ? "Prioritize one sealed copy and avoid overpaying." : dropDecision === "flip" ? "Watch fees, shipping, and sell-through before buying." : "Keep the product in alerts but do not allocate budget."}
              </p>
              <input
                value={dropDraft.subject}
                onChange={(event) => setDropDraft({ ...dropDraft, subject: event.target.value })}
                className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none"
              />
              <textarea
                value={dropDraft.body}
                onChange={(event) => setDropDraft({ ...dropDraft, body: event.target.value })}
                className="min-h-40 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold leading-6 outline-none"
              />
              <PrimaryButton onClick={parseDropSignal}>Parse signal</PrimaryButton>
              {parsedDrop ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
                  {parsedDrop}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              title="Fair stock monitor"
              detail="Respectful page checks for curated launch links only. No carting, checkout automation, proxies, queue bypassing, or CAPTCHA handling."
              action={
                <StatusPill tone={stockMonitorSettings.enabled ? "green" : "neutral"}>
                  {stockMonitorSettings.enabled ? "Running" : "Manual"}
                </StatusPill>
              }
            />
            <div className="grid gap-4 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800">
                  Monitor while this app is open
                  <input
                    type="checkbox"
                    checked={stockMonitorSettings.enabled}
                    onChange={(event) =>
                      setStockMonitorSettings((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-red-600"
                  />
                </label>
                <select
                  value={stockMonitorSettings.cadenceSeconds}
                  onChange={(event) =>
                    setStockMonitorSettings((current) => ({
                      ...current,
                      cadenceSeconds: Number(event.target.value),
                    }))
                  }
                  className="min-h-14 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none"
                >
                  <option value={60}>Every 1 min</option>
                  <option value={120}>Every 2 min</option>
                  <option value={300}>Every 5 min</option>
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Alert mode
                  <select
                    value={stockMonitorSettings.alertMode}
                    onChange={(event) =>
                      setStockMonitorSettings((current) => ({
                        ...current,
                        alertMode: event.target.value as StockAlertMode,
                      }))
                    }
                    className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
                  >
                    <option value="available">Available only</option>
                    <option value="available-review">Available + manual review</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Webhook preset
                  <select
                    value={stockMonitorSettings.webhookPreset}
                    onChange={(event) =>
                      setStockMonitorSettings((current) => ({
                        ...current,
                        webhookPreset: event.target.value as WebhookPreset,
                      }))
                    }
                    className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
                  >
                    <option value="discord">Discord</option>
                    <option value="slack">Slack</option>
                    <option value="custom">Custom JSON</option>
                  </select>
                </label>
                <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 md:mt-7">
                  Webhook relay
                  <input
                    type="checkbox"
                    checked={stockMonitorSettings.webhookEnabled}
                    onChange={(event) =>
                      setStockMonitorSettings((current) => ({
                        ...current,
                        webhookEnabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-red-600"
                  />
                </label>
              </div>
              <input
                value={stockMonitorSettings.webhookUrl}
                onChange={(event) =>
                  setStockMonitorSettings((current) => ({
                    ...current,
                    webhookUrl: event.target.value,
                  }))
                }
                placeholder="Webhook URL for stock signals"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none"
              />
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Monitored products · {monitoredProductIds.length}/{dropSeed.productRegistry.length}
                  </p>
                  <SecondaryButton className="min-h-9 px-3 py-1.5 text-xs" onClick={setAllStockMonitorProducts}>
                    Watch all
                  </SecondaryButton>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {dropSeed.productRegistry.map((product) => (
                    <label key={product.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={monitoredProductIds.includes(product.id)}
                        onChange={() => toggleStockMonitorProduct(product.id)}
                        className="mt-1 h-4 w-4 accent-red-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-black text-slate-950">{product.title}</span>
                        <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          {product.launchLinks.length} links · {product.status}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {(["Available", "Manual review", "Out", "Blocked", "Error"] as StockStatus[]).map((status) => (
                  <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <StatusPill tone={stockStatusTone(status)}>{status}</StatusPill>
                    <p className="mt-3 text-2xl font-black text-slate-950">{stockStatusCounts[status]}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => runStockMonitor()} disabled={isStockChecking}>
                  {isStockChecking ? "Checking..." : "Check now"}
                </PrimaryButton>
                <SecondaryButton onClick={requestStockNotifications}>
                  Browser alerts
                </SecondaryButton>
                <SecondaryButton onClick={() => setStockMonitorNotifications([])}>
                  Reset dedupe
                </SecondaryButton>
              </div>
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
                {stockMonitorStatus}
              </p>
              <div className="grid gap-2">
                {stockMonitorResults.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                    Run a check to see official and retailer link status here.
                  </p>
                ) : (
                  stockMonitorResults.slice(0, 8).map((result) => (
                    <article key={`${result.productId}-${result.href}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={stockStatusTone(result.status)}>{result.status}</StatusPill>
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            {result.label}
                          </span>
                        </div>
                        <p className="mt-2 truncate font-black text-slate-950">{result.title}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                          {result.reason}
                        </p>
                      </div>
                      <a
                        href={result.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300"
                      >
                        Open manually
                      </a>
                    </article>
                  ))
                )}
              </div>
              {stockMonitorNotifications.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Alert history
                  </p>
                  <div className="mt-3 grid gap-2">
                    {stockMonitorNotifications.slice(0, 4).map((entry) => (
                      <div key={`${entry.key}-${entry.notifiedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-slate-600">
                        <span className="min-w-0 truncate">
                          {entry.title} · {entry.label}
                        </span>
                        <StatusPill tone={stockStatusTone(entry.status)}>{entry.status}</StatusPill>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          {seed.dropAlerts.map((alert) => (
            <DropCard key={alert.id} alert={alert} />
          ))}
          <Panel>
            <SectionHeader title="Existing sources" detail={`${dropSeed.sourceLinks.length} official references preserved`} />
            <div className="grid gap-2 p-4">
              {dropSeed.sourceLinks.slice(0, 4).map((source) => (
                <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:border-sky-300">
                  {source.label}
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderProfile() {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Integration setup" detail="Credential-dependent features stay transparent and usable with fallback data." />
          <div className="grid gap-3 p-4">
            {seed.integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </Panel>
        {renderListingDraft()}
        {renderTradeAnalyzer()}
        {renderMarketplace()}
      </div>
    );
  }

  const content: Record<ViewId, React.ReactNode> = {
    home: renderHome(),
    binders: renderBinders(),
    collection: renderCollection(),
    scan: renderScan(),
    cardDetail: renderCardDetail(),
    market: renderMarket(),
    watchlist: renderWatchlist(),
    grading: renderGrading(),
    drops: renderDrops(),
    profile: renderProfile(),
  };

  return (
    <main className="collector-shell min-h-screen w-full bg-[#f4f6f1] text-slate-950">
      <div className="collector-topbar fixed inset-x-0 top-0 z-30 border-b border-slate-200/70 bg-white/[0.88] backdrop-blur-2xl lg:left-24">
        <div className="collector-topbar-inner flex min-h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => openView("home")} className="flex min-w-0 items-center gap-3 rounded-2xl text-left">
            <PokeballIcon />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-950">PokéVault Pro</span>
              <span className="block truncate font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
                {currency(totalValue)} tracked
              </span>
            </span>
          </button>
          <div className="ml-auto hidden min-w-0 flex-1 justify-center md:flex">
            <button
              type="button"
              onClick={() => openView("scan")}
              className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-400"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Search, scan, price, grade, or track a drop
            </button>
          </div>
          <PrimaryButton onClick={() => openView("scan")} className="ml-auto">Scan</PrimaryButton>
        </div>
      </div>

      <aside className="collector-desktop-sidebar collector-nav-rail fixed inset-y-0 left-0 z-40 hidden w-24 border-r border-slate-900 text-white lg:block">
        <div className="flex h-full flex-col items-center gap-2 py-4">
          <button type="button" onClick={() => openView("home")} className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950">
            <PokeballIcon className="h-8 w-8 border-white" />
          </button>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openView(item.id)}
              className={cls(
                "grid w-20 place-items-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-black transition",
                activeView === item.id
                  ? "bg-red-600 text-white shadow-lg shadow-red-950/30"
                  : "text-slate-400 hover:bg-white/10 hover:text-white",
              )}
              title={item.label}
            >
              <Icon id={item.id} />
              {item.short}
            </button>
          ))}
        </div>
      </aside>

      <div className="collector-content mx-auto w-full max-w-[1880px] pl-4 pr-8 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-24 sm:px-6 lg:px-8 lg:pl-32">
        {content[activeView]}
      </div>

      {moreOpen ? (
        <div className="collector-mobile-more fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 rounded-[20px] border border-slate-200 bg-white/95 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.22)] backdrop-blur-2xl lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {navItems.slice(4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openView(item.id)}
                className={cls(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black",
                  activeView === item.id ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600",
                )}
              >
                <Icon id={item.id} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <nav className="collector-mobile-nav fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-[22px] border border-slate-950 bg-slate-950 p-1.5 shadow-[0_18px_60px_rgba(15,23,42,0.25)] lg:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-5 gap-1">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openView(item.id)}
              className={cls(
                "grid min-h-14 place-items-center rounded-2xl text-[11px] font-black",
                activeView === item.id ? "bg-red-600 text-white" : "text-slate-300",
              )}
            >
              <Icon id={item.id} />
              {item.short}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={cls(
              "grid min-h-12 place-items-center rounded-[18px] text-[11px] font-black",
              moreOpen || ["cardDetail", "market", "grading", "drops", "watchlist", "profile"].includes(activeView)
                ? "bg-red-600 text-white"
                : "text-slate-300",
            )}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h.01M12 12h.01M19 12h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
            </svg>
            More
          </button>
        </div>
      </nav>
    </main>
  );
}

function GradingMini({ order, priority = false }: { order: GradingOrder; priority?: boolean }) {
  return (
    <div className="grid grid-cols-[60px_1fr] gap-3 rounded-2xl border border-slate-200 bg-white p-2">
      <CardImage item={{ name: order.title, image: order.image }} priority={priority} className="h-16 rounded-xl" />
      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">{order.title}</p>
        <p className="text-sm font-semibold text-slate-500">{order.stage}</p>
        <p className="text-xs font-bold text-slate-400">{order.grade ?? order.updatedAt}</p>
      </div>
    </div>
  );
}

function GradingCard({ order }: { order: GradingOrder }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="rounded-[22px] bg-slate-950 p-3">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-2">
          <CardImage item={{ name: order.title, image: order.image }} className="aspect-[4/5] rounded-xl" />
        </div>
        <div className="mt-3 rounded-xl bg-white p-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">PSA</p>
          <p className="text-2xl font-black text-slate-950">{order.grade ?? order.stage}</p>
        </div>
      </div>
      <p className="mt-3 font-black text-slate-950">{order.title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{order.population}</p>
      <div className="mt-3 flex items-center justify-between">
        <StatusPill tone={order.stage === "Reveal" ? "green" : "blue"}>{order.stage}</StatusPill>
        <p className="font-black text-slate-950">{currency(order.declaredValue)}</p>
      </div>
    </article>
  );
}

function MarketplaceCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <CardImage item={{ name: listing.title, image: listing.image }} className="aspect-[4/5] rounded-b-[22px]" />
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-black text-slate-950">{listing.title}</p>
            <p className="text-sm font-semibold text-slate-500">{listing.source}</p>
          </div>
          <StatusPill tone={listing.marketDelta < 0 ? "green" : listing.status === "Overpriced" ? "red" : "yellow"}>
            {percent(listing.marketDelta)}
          </StatusPill>
        </div>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-black text-slate-950">{currency(listing.askPrice)}</p>
          <p className="text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            {listing.shipping}
          </p>
        </div>
        <SecondaryButton>{listing.status}</SecondaryButton>
      </div>
    </article>
  );
}

function MarketplaceMini({ listing }: { listing: MarketplaceListing }) {
  return (
    <div className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2">
      <CardImage item={{ name: listing.title, image: listing.image }} className="h-20 rounded-xl" />
      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">{listing.title}</p>
        <p className="text-sm font-semibold text-slate-500">{listing.status} · {listing.shipping}</p>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{listing.source}</p>
      </div>
      <div className="text-right">
        <p className="font-black text-slate-950">{currency(listing.askPrice)}</p>
        <StatusPill tone={listing.marketDelta < 0 ? "green" : listing.status === "Overpriced" ? "red" : "yellow"}>
          {percent(listing.marketDelta)}
        </StatusPill>
      </div>
    </div>
  );
}

function DropCard({ alert, onOpen }: { alert: DropAlert; onOpen?: () => void }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
      <CardImage item={{ name: alert.title, image: alert.image }} className="aspect-[16/10] rounded-[20px]" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-slate-950">{alert.title}</p>
          <p className="text-sm font-semibold text-slate-500">{alert.channel} · {alert.window}</p>
        </div>
        <StatusPill tone={alert.urgency === "Critical" ? "red" : alert.urgency === "High" ? "yellow" : "blue"}>
          {alert.urgency}
        </StatusPill>
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">{alert.action}</p>
      {onOpen ? (
        <PrimaryButton className="mt-3 w-full" onClick={onOpen}>
          Open drop
        </PrimaryButton>
      ) : null}
    </article>
  );
}
