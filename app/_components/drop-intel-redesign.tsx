"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  DashboardSeed,
  ParsedSignal,
  ProductNormalizationResult,
  StoreMemorySeed,
  WatchItem,
} from "@/app/_lib/dashboard-data";

type ViewId =
  | "command"
  | "signals"
  | "watch"
  | "stores"
  | "delivery"
  | "journal"
  | "analytics"
  | "registry";

type ReadinessState = Record<string, boolean>;

type SessionEntry = {
  id: string;
  outcome: "Win" | "Miss" | "False Alarm";
  channel: string;
  target: string;
  note: string;
  createdAt: string;
};

type EmailDraft = {
  subject: string;
  body: string;
};

type UploadedEmailMeta = {
  fileName: string;
  from: string | null;
  subject: string;
};

type ParsedAlertHistoryEntry = {
  id: string;
  source: "Manual" | "Upload" | "Mailbox";
  parsedAt: string;
  draft: EmailDraft;
  parsed: ParsedSignal;
  normalized: ProductNormalizationResult | null;
  uploadMeta: UploadedEmailMeta | null;
};

type MailboxFilters = {
  senderFilters: string;
  subjectFilters: string;
};

type DeliverySettings = {
  browserEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  threshold: ParsedSignal["urgency"];
};

type StoreMemoryDraft = Omit<StoreMemorySeed, "id">;

type ParseResponse = {
  error?: string;
  parsedAt?: string;
  parsed?: ParsedSignal;
  normalized?: ProductNormalizationResult;
};

type UploadParseResponse = ParseResponse & {
  fileName?: string;
  parsedEmail?: { from: string | null; subject: string; body: string };
};

type MailboxUploadResponse = {
  error?: string;
  parsedAt?: string;
  fileName?: string;
  mailbox?: string;
  scannedCount?: number;
  sinceHours?: number;
  entries?: Array<{
    index: number;
    uid?: number;
    parsedEmail: { from: string | null; subject: string; body: string };
    parsed: ParsedSignal;
    normalized?: ProductNormalizationResult;
  }>;
};

const readinessStorageKey = "pokemon-drop-readiness";
const sessionStorageKey = "pokemon-drop-session-log";
const emailDraftStorageKey = "pokemon-drop-email-draft";
const parsedAlertHistoryStorageKey = "pokemon-drop-parsed-alert-history";
const storeMemoryStorageKey = "pokemon-drop-store-memory";
const deliverySettingsStorageKey = "pokemon-drop-delivery-settings";
const mailboxFiltersStorageKey = "pokemon-drop-mailbox-filters";
const pinnedProductsStorageKey = "pokemon-drop-pinned-products";

const navigation: Array<{ id: ViewId; label: string }> = [
  { id: "command", label: "Command" },
  { id: "signals", label: "Signals" },
  { id: "watch", label: "Watch" },
  { id: "stores", label: "Stores" },
  { id: "delivery", label: "Delivery" },
  { id: "journal", label: "Journal" },
  { id: "analytics", label: "Analytics" },
  { id: "registry", label: "Registry" },
];

const urgencyRank: Record<ParsedSignal["urgency"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;
}

function createInitialReadiness(seed: DashboardSeed): ReadinessState {
  return seed.readinessSeed.reduce<ReadinessState>((acc, item) => {
    acc[item.id] = false;
    return acc;
  }, {});
}

function createInitialDeliverySettings(): DeliverySettings {
  return {
    browserEnabled: false,
    webhookEnabled: false,
    webhookUrl: "",
    threshold: "Critical",
  };
}

function createInitialMailboxFilters(): MailboxFilters {
  return {
    senderFilters: "",
    subjectFilters: "pokemon, tcg, early access, restock, preorder, prerelease",
  };
}

function createStoreDraft(): StoreMemoryDraft {
  return {
    name: "",
    kind: "League Store",
    location: "",
    driveTime: "",
    reliability: "Medium",
    nextWindow: "",
    note: "",
  };
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);

  if (!saved) {
    return fallback;
  }

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function statusTone(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("critical") || normalized.includes("miss")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized.includes("high") || normalized.includes("win")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("medium") || normalized.includes("watch")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

function channelTone(channel: string): "red" | "blue" | "green" | "yellow" {
  if (channel === "Pokemon Center") {
    return "red";
  }

  if (channel === "Retailers") {
    return "blue";
  }

  if (channel === "Local") {
    return "green";
  }

  return "yellow";
}

function collectorCue(item: WatchItem) {
  if (item.channel === "Pokemon Center") {
    return "Official queue";
  }

  if (item.channel === "Retailers") {
    return "SKU drift";
  }

  if (item.channel === "Local") {
    return "Route edge";
  }

  return "Confirm source";
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "blue" | "green" | "yellow" }) {
  const tones = {
    neutral: "border-slate-200 bg-white text-slate-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CueGrid({ item }: { item: WatchItem }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
      <div className="border-r border-slate-200 p-3">
        <p className="font-mono uppercase tracking-[0.14em] text-slate-400">
          Window
        </p>
        <p className="mt-1 font-semibold text-slate-950">{item.release}</p>
      </div>
      <div className="border-r border-slate-200 p-3">
        <p className="font-mono uppercase tracking-[0.14em] text-slate-400">
          Mode
        </p>
        <p className="mt-1 font-semibold text-slate-950">{collectorCue(item)}</p>
      </div>
      <div className="p-3">
        <p className="font-mono uppercase tracking-[0.14em] text-slate-400">
          Price
        </p>
        <p className="mt-1 font-semibold text-slate-950">{item.price}</p>
      </div>
    </div>
  );
}

function PokeballMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-7 w-7",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <span
      className={`relative inline-grid place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-white shadow-sm ${sizes[size]}`}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-red-600" />
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-950" />
      <span className="relative z-10 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-slate-950 bg-white">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
      </span>
    </span>
  );
}

function NavGlyph({ id }: { id: ViewId }) {
  const common = "h-4 w-4";

  if (id === "command") {
    return <PokeballMark size="sm" />;
  }

  if (id === "signals") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="M4 7h16v11H4V7Z" stroke="currentColor" strokeWidth="2" />
        <path d="m4 8 8 6 8-6" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "watch") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="m12 3 2.4 5.4 5.8.6-4.4 3.8 1.3 5.7L12 15.5l-5.1 3 1.3-5.7L3.8 9l5.8-.6L12 3Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "stores") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="M5 10h14l-1 10H6L5 10Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "delivery") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "journal") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="M7 4h10v16H7V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M10 8h4M10 12h4M10 16h3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (id === "analytics") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
        <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden="true">
      <path d="M6 4h12v16H6V4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EnergyDots() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function ProductImage({
  item,
  priority = false,
  className = "",
}: {
  item: Pick<WatchItem, "image" | "title">;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <Image
        src={item.image}
        alt={item.title}
        fill
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        sizes="(max-width: 900px) 100vw, 440px"
        className="object-cover"
      />
    </div>
  );
}

function ArtRail({
  items,
  onSelect,
}: {
  items: WatchItem[];
  onSelect?: (item: WatchItem) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.slice(0, 3).map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onSelect?.(item)}
          className="group overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
          aria-label={`Open ${item.title}`}
        >
          <ProductImage item={item} className="h-20 rounded-md border-0 shadow-none" />
          <span className="mt-2 block truncate px-1 pb-1 text-xs font-semibold text-slate-700">
            {item.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          <span className="inline-flex items-center gap-3">
            {title}
            <EnergyDots />
          </span>
        </h2>
        {detail ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {detail}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${props.className ?? ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${props.className ?? ""}`}
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 ${props.className ?? ""}`}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${props.className ?? ""}`}
    />
  );
}

export function DropIntelRedesign({ seed }: { seed: DashboardSeed }) {
  const [activeView, setActiveView] = useState<ViewId>("command");
  const [selectedChannel, setSelectedChannel] = useState("All");
  const [readiness, setReadiness] = useState<ReadinessState>(() =>
    createInitialReadiness(seed),
  );
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [target, setTarget] = useState(seed.productRegistry[0]?.title ?? "");
  const [channel, setChannel] = useState(seed.channels[1] ?? "Pokemon Center");
  const [outcome, setOutcome] = useState<SessionEntry["outcome"]>("Miss");
  const [note, setNote] = useState("");
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({ subject: "", body: "" });
  const [parsedSignal, setParsedSignal] = useState<ParsedSignal | null>(null);
  const [normalizedProduct, setNormalizedProduct] = useState<ProductNormalizationResult | null>(null);
  const [parsedAlertHistory, setParsedAlertHistory] = useState<ParsedAlertHistoryEntry[]>([]);
  const [uploadMeta, setUploadMeta] = useState<UploadedEmailMeta | null>(null);
  const [parseError, setParseError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [mailboxStatus, setMailboxStatus] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMailboxSyncing, setIsMailboxSyncing] = useState(false);
  const [mailboxFilters, setMailboxFilters] = useState<MailboxFilters>(() =>
    createInitialMailboxFilters(),
  );
  const [storeMemory, setStoreMemory] = useState<StoreMemorySeed[]>(seed.storeMemorySeed);
  const [storeDraft, setStoreDraft] = useState<StoreMemoryDraft>(() => createStoreDraft());
  const [storeError, setStoreError] = useState("");
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() =>
    createInitialDeliverySettings(),
  );
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [pinnedProducts, setPinnedProducts] = useState<string[]>([]);
  const [expandedWatchTitle, setExpandedWatchTitle] = useState(
    seed.watchItems[0]?.title ?? "",
  );
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setReadiness({
        ...createInitialReadiness(seed),
        ...safeLoad<ReadinessState>(readinessStorageKey, {}),
      });
      setSessionLog(safeLoad<SessionEntry[]>(sessionStorageKey, []));
      setParsedAlertHistory(
        safeLoad<ParsedAlertHistoryEntry[]>(parsedAlertHistoryStorageKey, []),
      );
      setStoreMemory(
        safeLoad<StoreMemorySeed[]>(storeMemoryStorageKey, seed.storeMemorySeed),
      );
      setDeliverySettings({
        ...createInitialDeliverySettings(),
        ...safeLoad<Partial<DeliverySettings>>(deliverySettingsStorageKey, {}),
      });
      setMailboxFilters({
        ...createInitialMailboxFilters(),
        ...safeLoad<Partial<MailboxFilters>>(mailboxFiltersStorageKey, {}),
      });
      setEmailDraft(
        safeLoad<EmailDraft>(emailDraftStorageKey, { subject: "", body: "" }),
      );
      setPinnedProducts(safeLoad<string[]>(pinnedProductsStorageKey, []));
      setIsStorageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [seed]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(readinessStorageKey, JSON.stringify(readiness));
  }, [isStorageReady, readiness]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(sessionLog));
  }, [isStorageReady, sessionLog]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(emailDraftStorageKey, JSON.stringify(emailDraft));
  }, [emailDraft, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(
      parsedAlertHistoryStorageKey,
      JSON.stringify(parsedAlertHistory),
    );
  }, [isStorageReady, parsedAlertHistory]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(storeMemoryStorageKey, JSON.stringify(storeMemory));
  }, [isStorageReady, storeMemory]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(
      deliverySettingsStorageKey,
      JSON.stringify(deliverySettings),
    );
  }, [deliverySettings, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(mailboxFiltersStorageKey, JSON.stringify(mailboxFilters));
  }, [isStorageReady, mailboxFilters]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(
      pinnedProductsStorageKey,
      JSON.stringify(pinnedProducts),
    );
  }, [isStorageReady, pinnedProducts]);

  const featuredItem = seed.watchItems[0];
  const visibleWatchItems = useMemo(
    () =>
      selectedChannel === "All"
        ? seed.watchItems
        : seed.watchItems.filter((item) => item.channel === selectedChannel),
    [seed.watchItems, selectedChannel],
  );
  const readinessCompleted = useMemo(
    () => Object.values(readiness).filter(Boolean).length,
    [readiness],
  );
  const readinessTotal = seed.readinessSeed.length;
  const readinessPercent =
    readinessTotal > 0 ? Math.round((readinessCompleted / readinessTotal) * 100) : 0;
  const recentEntries = useMemo(
    () =>
      [...sessionLog]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [sessionLog],
  );
  const recentParsedAlerts = useMemo(
    () =>
      [...parsedAlertHistory]
        .sort((a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime())
        .slice(0, 5),
    [parsedAlertHistory],
  );
  const channelAnalytics = useMemo(
    () =>
      seed.channels
        .filter((item) => item !== "All")
        .map((channelName) => {
          const entries = sessionLog.filter((entry) => entry.channel === channelName);
          const wins = entries.filter((entry) => entry.outcome === "Win").length;
          const attempts = entries.length;

          return {
            channel: channelName,
            attempts,
            wins,
            winRate: attempts ? Math.round((wins / attempts) * 100) : 0,
          };
        })
        .sort((a, b) => b.winRate - a.winRate || b.attempts - a.attempts),
    [seed.channels, sessionLog],
  );
  const bestChannel = channelAnalytics.find((entry) => entry.attempts > 0);
  const alertPosture = deliverySettings.browserEnabled || deliverySettings.webhookEnabled ? "Live" : "Manual";
  const routeLabel = [
    deliverySettings.browserEnabled ? "Browser" : null,
    deliverySettings.webhookEnabled ? "Webhook" : null,
  ]
    .filter(Boolean)
    .join(" + ");
  const selectedTargetArtwork =
    seed.watchItems.find((item) => item.title === target) ??
    seed.watchItems.find((item) => target.includes(item.title.split(" ")[0])) ??
    featuredItem;
  const pinnedWatchItems = seed.watchItems.filter((item) =>
    pinnedProducts.includes(item.title),
  );

  function togglePinnedProduct(title: string) {
    setPinnedProducts((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [title, ...current],
    );
  }

  function applyParsedResult({
    source,
    draft,
    parsed,
    normalized,
    uploadMeta: nextUploadMeta,
    parsedAt,
  }: {
    source: ParsedAlertHistoryEntry["source"];
    draft: EmailDraft;
    parsed: ParsedSignal;
    normalized?: ProductNormalizationResult;
    uploadMeta: UploadedEmailMeta | null;
    parsedAt?: string;
  }) {
    const normalizedResult = normalized ?? null;
    const timestamp = parsedAt ?? new Date().toISOString();

    setParsedSignal(parsed);
    setNormalizedProduct(normalizedResult);
    setUploadMeta(nextUploadMeta);
    setEmailDraft(draft);

    if (normalizedResult?.primaryMatch?.title) {
      setTarget(normalizedResult.primaryMatch.title);
    }

    setParsedAlertHistory((current) => [
      {
        id: createClientId(),
        source,
        parsedAt: timestamp,
        draft,
        parsed,
        normalized: normalizedResult,
        uploadMeta: nextUploadMeta,
      },
      ...current,
    ].slice(0, 12));

    if (urgencyRank[parsed.urgency] >= urgencyRank[deliverySettings.threshold]) {
      setDeliveryStatus(
        `${parsed.urgency} ${parsed.signalType} ready for ${routeLabel || "manual review"}.`,
      );
    }
  }

  async function handleParseEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsParsing(true);
    setParseError("");
    setUploadStatus("");
    setUploadMeta(null);

    try {
      const response = await fetch("/api/parse-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailDraft),
      });
      const data = (await response.json()) as ParseResponse;

      if (!response.ok || !data.parsed) {
        throw new Error(data.error ?? "Parser could not classify this message.");
      }

      applyParsedResult({
        source: "Manual",
        draft: emailDraft,
        parsed: data.parsed,
        normalized: data.normalized,
        uploadMeta: null,
        parsedAt: data.parsedAt,
      });
      setActiveView("signals");
    } catch (error) {
      setParsedSignal(null);
      setNormalizedProduct(null);
      setParseError(error instanceof Error ? error.message : "Parser request failed.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleUploadEmail(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setParseError("");
    setUploadStatus(`Processing ${file.name}`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-email-upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as UploadParseResponse;

      if (!response.ok || !data.parsed || !data.parsedEmail || !data.fileName) {
        throw new Error(data.error ?? "Upload parser could not read this file.");
      }

      applyParsedResult({
        source: "Upload",
        draft: {
          subject: data.parsedEmail.subject,
          body: data.parsedEmail.body,
        },
        parsed: data.parsed,
        normalized: data.normalized,
        uploadMeta: {
          fileName: data.fileName,
          from: data.parsedEmail.from,
          subject: data.parsedEmail.subject,
        },
        parsedAt: data.parsedAt,
      });
      setUploadStatus(`Parsed ${data.fileName}`);
      setActiveView("signals");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Upload request failed.");
      setUploadStatus("");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSyncMailbox() {
    setIsMailboxSyncing(true);
    setParseError("");
    setMailboxStatus("Syncing the configured mailbox...");

    try {
      const response = await fetch("/api/sync-mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailboxFilters),
      });
      const data = (await response.json()) as MailboxUploadResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Mailbox sync failed.");
      }

      if (!data.entries?.length) {
        setMailboxStatus(
          `Mailbox checked ${data.mailbox ?? "INBOX"}. No usable signals found.`,
        );
        return;
      }

      for (const entry of data.entries) {
        applyParsedResult({
          source: "Mailbox",
          draft: {
            subject: entry.parsedEmail.subject,
            body: entry.parsedEmail.body,
          },
          parsed: entry.parsed,
          normalized: entry.normalized,
          uploadMeta: {
            fileName: `IMAP ${data.mailbox ?? "INBOX"} · ${
              entry.uid ? `UID ${entry.uid}` : `message ${entry.index}`
            }`,
            from: entry.parsedEmail.from,
            subject: entry.parsedEmail.subject,
          },
          parsedAt: data.parsedAt,
        });
      }

      setMailboxStatus(`Synced ${data.entries.length} signal-ready messages.`);
      setActiveView("signals");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Mailbox sync failed.");
      setMailboxStatus("");
    } finally {
      setIsMailboxSyncing(false);
    }
  }

  function handleSessionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSessionLog((current) => [
      {
        id: createClientId(),
        outcome,
        channel,
        target,
        note: note.trim() || "No note recorded.",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setNote("");
  }

  function saveStoreMemoryEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!storeDraft.name.trim() || !storeDraft.location.trim()) {
      setStoreError("Add at least a store name and location.");
      return;
    }

    setStoreError("");
    setStoreMemory((current) => [
      {
        id: createClientId(),
        ...storeDraft,
        name: storeDraft.name.trim(),
        location: storeDraft.location.trim(),
        driveTime: storeDraft.driveTime.trim() || "Not set",
        nextWindow: storeDraft.nextWindow.trim() || "No timing note yet",
        note: storeDraft.note.trim() || "No local note yet.",
      },
      ...current,
    ]);
    setStoreDraft(createStoreDraft());
  }

  function loadSample(kind: "early-access" | "restock") {
    if (kind === "early-access") {
      setEmailDraft({
        subject: "Pokemon Center Early Access: Mega Evolution - Chaos Rising",
        body:
          "You have Early Access to purchase Mega Evolution - Chaos Rising products on May 22, 2026. This single-use invite link is tied to your account. Limit one per customer. Shop now: https://www.pokemoncenter.com/early-access",
      });
      setActiveView("signals");
      return;
    }

    setEmailDraft({
      subject: "Target: Pokemon TCG product available now",
      body:
        "Your saved item is available now for pickup or shipping. Store availability may vary. Limit 3 per customer. View item: https://www.target.com/p/pokemon-tcg",
    });
    setActiveView("signals");
  }

  function renderCommandCenter() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="grid gap-5">
          <Panel className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="red">Next Critical Drop</Pill>
                  <Pill tone="blue">{featuredItem.channel}</Pill>
                  <Pill tone="yellow">{featuredItem.release}</Pill>
                </div>
                <ProductImage
                  item={featuredItem}
                  priority
                  className="mt-4 h-56 lg:hidden"
                />
                <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 2xl:text-5xl">
                  {featuredItem.title}
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  {featuredItem.note}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <PrimaryButton onClick={() => setActiveView("signals")}>
                    Parse signal
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setActiveView("watch")}>
                    Review watch queue
                  </SecondaryButton>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Readiness
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {readinessCompleted}/{readinessTotal}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Alert Posture
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {alertPosture}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Local Edge
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      2 weeks
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative hidden min-h-[360px] border-t border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e0f2fe_55%,#fff7ed_100%)] p-5 lg:block lg:border-l lg:border-t-0">
                <div className="absolute inset-5 rounded-lg border border-white/80 bg-white/45" />
                <ProductImage
                  item={featuredItem}
                  priority
                  className="relative z-10 h-full min-h-[320px]"
                />
                <div className="absolute bottom-8 left-8 right-8 z-20 hidden grid-cols-3 gap-2 lg:grid">
                  {seed.watchItems.slice(1, 4).map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => setActiveView("watch")}
                      className="group overflow-hidden rounded-md border border-white/80 bg-white/75 p-1 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <ProductImage
                        item={item}
                        className="h-16 rounded border-0 shadow-none"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle
              title="Priority watch"
              detail="Product visuals stay close to the decisions, so the queue feels like a collector desk instead of a spreadsheet."
              action={
                <div className="flex flex-wrap gap-2">
                  {seed.channels.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSelectedChannel(item)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        selectedChannel === item
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              }
            />
            {pinnedWatchItems.length > 0 ? (
              <div className="border-b border-slate-200 bg-amber-50/50 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Pinned opportunities
                    </p>
                    <p className="text-sm text-slate-500">
                      Saved for fast comparison during a drop window.
                    </p>
                  </div>
                  <Pill tone="yellow">{pinnedWatchItems.length} saved</Pill>
                </div>
                <ArtRail
                  items={pinnedWatchItems}
                  onSelect={(item) => setExpandedWatchTitle(item.title)}
                />
              </div>
            ) : null}
            <div className="grid gap-3 p-5">
              {visibleWatchItems.slice(0, 4).map((item) => (
                <article
                  key={item.title}
                  className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[140px_minmax(0,1fr)] 2xl:grid-cols-[140px_minmax(0,1fr)_auto]"
                >
                  <ProductImage item={item} className="h-32 sm:h-full" />
                  <div className="min-w-0 py-1">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={channelTone(item.channel)}>{item.channel}</Pill>
                      <Pill tone="yellow">{item.release}</Pill>
                      <Pill tone="neutral">{collectorCue(item)}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.action}
                    </p>
                    {expandedWatchTitle === item.title ? (
                    <div className="mt-3 hidden sm:block">
                      <CueGrid item={item} />
                    </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:col-span-2 2xl:col-span-1 2xl:justify-end">
                    <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusTone(item.status)}`}>
                      {item.status}
                    </span>
                    <SecondaryButton
                      type="button"
                      onClick={() => togglePinnedProduct(item.title)}
                      className="min-h-9 px-3 py-1.5 text-xs"
                    >
                      {pinnedProducts.includes(item.title) ? "Pinned" : "Pin"}
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        setExpandedWatchTitle((current) =>
                          current === item.title ? "" : item.title,
                        )
                      }
                      className="min-h-9 px-3 py-1.5 text-xs"
                    >
                      {expandedWatchTitle === item.title ? "Less" : "Details"}
                    </SecondaryButton>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="grid content-start gap-5">
          <Panel>
            <SectionTitle title="Readiness" detail={`Ready ${readinessCompleted}/${readinessTotal}`} />
            <div className="p-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3">
                {seed.readinessSeed.map((item) => (
                  <label
                    key={item.id}
                    className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(readiness[item.id])}
                      onChange={() =>
                        setReadiness((current) => ({
                          ...current,
                          [item.id]: !current[item.id],
                        }))
                      }
                      className="mt-1 h-4 w-4 accent-emerald-600"
                    />
                    <span>
                      <span className="font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="mt-1 block leading-5 text-slate-500">
                        {item.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Signal inbox" detail={mailboxStatus || "Mailbox synced status appears here."} />
            <div className="grid gap-3 p-5">
              {recentParsedAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  Parse a sample signal or sync the mailbox to start the feed.
                </div>
              ) : (
                recentParsedAlerts.slice(0, 3).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setParsedSignal(entry.parsed);
                      setNormalizedProduct(entry.normalized);
                      setEmailDraft(entry.draft);
                      setUploadMeta(entry.uploadMeta);
                      setActiveView("signals");
                    }}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Pill tone={entry.parsed.urgency === "Critical" ? "red" : "blue"}>
                        {entry.parsed.urgency}
                      </Pill>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(entry.parsedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {entry.normalized?.primaryMatch?.title ?? entry.parsed.signalType}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {entry.parsed.summary}
                    </p>
                  </button>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Delivery route" detail={routeLabel || "Manual review only"} />
            <div className="p-5 text-sm leading-6 text-slate-600">
              <p>{deliveryStatus || `Threshold: ${deliverySettings.threshold}`}</p>
              <div className="mt-4 flex gap-2">
                <SecondaryButton onClick={() => setActiveView("delivery")}>
                  Edit rules
                </SecondaryButton>
                <SecondaryButton onClick={handleSyncMailbox} disabled={isMailboxSyncing}>
                  {isMailboxSyncing ? "Syncing..." : "Sync mailbox"}
                </SecondaryButton>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    );
  }

  function renderSignals() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel>
          <SectionTitle
            title="Signals inbox"
            detail="Parse official emails, upload raw messages, or sync a filtered mailbox without burying the result."
            action={
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => loadSample("early-access")}>
                  Early access sample
                </SecondaryButton>
                <SecondaryButton onClick={() => loadSample("restock")}>
                  Restock sample
                </SecondaryButton>
              </div>
            }
          />
          <form className="grid gap-4 p-5" onSubmit={handleParseEmail}>
            <ArtRail
              items={seed.watchItems}
              onSelect={(item) => {
                setEmailDraft({
                  subject: `${item.channel}: ${item.title}`,
                  body: `${item.status}. ${item.note} ${item.action}`,
                });
              }}
            />
            <FieldLabel label="Subject">
              <TextInput
                value={emailDraft.subject}
                onChange={(event) =>
                  setEmailDraft((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
                placeholder="Pokemon Center Early Access..."
              />
            </FieldLabel>
            <FieldLabel label="Email body">
              <TextArea
                value={emailDraft.body}
                onChange={(event) =>
                  setEmailDraft((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                rows={8}
                placeholder="Paste the alert, retailer copy, or community signal here."
              />
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton type="submit" disabled={isParsing}>
                {isParsing ? "Parsing..." : "Parse signal"}
              </PrimaryButton>
              <label className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Upload email
                <input
                  type="file"
                  accept=".eml,.txt,.msg"
                  className="sr-only"
                  onChange={handleUploadEmail}
                  disabled={isUploading}
                />
              </label>
              <SecondaryButton type="button" onClick={handleSyncMailbox} disabled={isMailboxSyncing}>
                {isMailboxSyncing ? "Syncing..." : "Sync mailbox"}
              </SecondaryButton>
            </div>
            {parseError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </p>
            ) : null}
            {uploadStatus || mailboxStatus ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                {uploadStatus || mailboxStatus}
              </p>
            ) : null}
          </form>
        </Panel>

        <Panel>
          <SectionTitle title="Parsed result" detail={uploadMeta?.fileName ?? "Current signal preview"} />
          <div className="grid gap-4 p-5">
            {parsedSignal ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={parsedSignal.urgency === "Critical" ? "red" : "yellow"}>
                    {parsedSignal.urgency}
                  </Pill>
                  <Pill tone="blue">{parsedSignal.channel}</Pill>
                  <Pill tone="green">{parsedSignal.confidence} confidence</Pill>
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {normalizedProduct?.primaryMatch?.title ?? parsedSignal.signalType}
                </h3>
                <p className="text-sm leading-6 text-slate-600">
                  {parsedSignal.summary}
                </p>
                <div className="grid gap-2">
                  {parsedSignal.actionItems.map((item) => (
                    <div
                      key={item}
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    if (normalizedProduct?.primaryMatch?.title) {
                      setTarget(normalizedProduct.primaryMatch.title);
                    }
                    setChannel(
                      seed.channels.includes(parsedSignal.channel)
                        ? parsedSignal.channel
                        : "Community",
                    );
                    setNote(parsedSignal.summary);
                    setActiveView("journal");
                  }}
                >
                  Log this attempt
                </PrimaryButton>
              </>
            ) : (
              <>
                <ProductImage item={featuredItem} className="h-52" />
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                  Parsed output lands here with mapped product, urgency, dates, and next actions.
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  function renderWatch() {
    return (
      <Panel>
        <SectionTitle
          title="Priority watch"
          detail="A calmer product queue with art first, action second, and channel filtering close at hand."
        />
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {seed.watchItems.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <ProductImage item={item} className="h-64 rounded-none border-0 shadow-none" />
              <div className="grid gap-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Pill tone={channelTone(item.channel)}>{item.channel}</Pill>
                  <Pill tone="yellow">{item.release}</Pill>
                  <Pill tone="neutral">{collectorCue(item)}</Pill>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-950">
                    {item.title}
                  </h3>
                  <SecondaryButton
                    type="button"
                    onClick={() => togglePinnedProduct(item.title)}
                    className="min-h-9 shrink-0 px-3 py-1.5 text-xs"
                  >
                    {pinnedProducts.includes(item.title) ? "Pinned" : "Pin"}
                  </SecondaryButton>
                </div>
                <p className="text-sm font-semibold text-slate-700">{item.status}</p>
                <p className="text-sm leading-6 text-slate-600">{item.note}</p>
                <CueGrid item={item} />
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-800">
                  {item.action}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    );
  }

  function renderStores() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel>
          <SectionTitle title="Local store memory" detail="Local edge stays visible without making the whole app feel like a form." />
          <div className="grid gap-3 p-5">
            {storeMemory.map((store) => (
              <article key={store.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Pill tone={store.reliability === "High" ? "green" : store.reliability === "Medium" ? "yellow" : "red"}>
                      {store.reliability}
                    </Pill>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">
                      {store.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {store.kind} · {store.location} · {store.driveTime}
                    </p>
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      setStoreMemory((current) =>
                        current.filter((entry) => entry.id !== store.id),
                      )
                    }
                  >
                    Remove
                  </SecondaryButton>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {store.nextWindow}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {store.note}
                </p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Add local lead" detail="Keep the entry small so it actually gets used mid-drop." />
          <form className="grid gap-4 p-5" onSubmit={saveStoreMemoryEntry}>
            <ArtRail items={seed.watchItems.slice(1)} onSelect={() => undefined} />
            <FieldLabel label="Name">
              <TextInput
                value={storeDraft.name}
                onChange={(event) =>
                  setStoreDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="League City Cards"
              />
            </FieldLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Kind">
                <SelectInput
                  value={storeDraft.kind}
                  onChange={(event) =>
                    setStoreDraft((current) => ({
                      ...current,
                      kind: event.target.value as StoreMemorySeed["kind"],
                    }))
                  }
                >
                  <option>League Store</option>
                  <option>Vending Machine</option>
                  <option>Pickup Zone</option>
                </SelectInput>
              </FieldLabel>
              <FieldLabel label="Reliability">
                <SelectInput
                  value={storeDraft.reliability}
                  onChange={(event) =>
                    setStoreDraft((current) => ({
                      ...current,
                      reliability: event.target.value as StoreMemorySeed["reliability"],
                    }))
                  }
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </SelectInput>
              </FieldLabel>
            </div>
            <FieldLabel label="Location">
              <TextInput
                value={storeDraft.location}
                onChange={(event) =>
                  setStoreDraft((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="East side local route"
              />
            </FieldLabel>
            <FieldLabel label="Drive time">
              <TextInput
                value={storeDraft.driveTime}
                onChange={(event) =>
                  setStoreDraft((current) => ({ ...current, driveTime: event.target.value }))
                }
                placeholder="24 min"
              />
            </FieldLabel>
            <FieldLabel label="Next window">
              <TextInput
                value={storeDraft.nextWindow}
                onChange={(event) =>
                  setStoreDraft((current) => ({ ...current, nextWindow: event.target.value }))
                }
                placeholder="Prerelease signup usually opens 10 days early"
              />
            </FieldLabel>
            <FieldLabel label="Note">
              <TextArea
                value={storeDraft.note}
                onChange={(event) =>
                  setStoreDraft((current) => ({ ...current, note: event.target.value }))
                }
                rows={4}
              />
            </FieldLabel>
            {storeError ? <p className="text-sm text-red-600">{storeError}</p> : null}
            <PrimaryButton type="submit">Save local lead</PrimaryButton>
          </form>
        </Panel>
      </div>
    );
  }

  function renderDelivery() {
    return (
      <Panel>
        <SectionTitle
          title="Delivery rules"
          detail="A compact rule board for whether high-signal Pokemon alerts should stay manual or route outward."
        />
        <div className="grid gap-5 p-5 xl:grid-cols-[420px_1fr]">
          <form className="grid content-start gap-4">
            <ArtRail items={seed.watchItems} onSelect={() => undefined} />
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
              Browser alerts
              <input
                type="checkbox"
                checked={deliverySettings.browserEnabled}
                onChange={(event) =>
                  setDeliverySettings((current) => ({
                    ...current,
                    browserEnabled: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-sky-600"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
              Webhook relay
              <input
                type="checkbox"
                checked={deliverySettings.webhookEnabled}
                onChange={(event) =>
                  setDeliverySettings((current) => ({
                    ...current,
                    webhookEnabled: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-sky-600"
              />
            </label>
            <FieldLabel label="Urgency threshold">
              <SelectInput
                value={deliverySettings.threshold}
                onChange={(event) =>
                  setDeliverySettings((current) => ({
                    ...current,
                    threshold: event.target.value as ParsedSignal["urgency"],
                  }))
                }
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Webhook URL">
              <TextInput
                value={deliverySettings.webhookUrl}
                onChange={(event) =>
                  setDeliverySettings((current) => ({
                    ...current,
                    webhookUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </FieldLabel>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800">
              {deliveryStatus || `Route: ${routeLabel || "Manual review"} · Threshold: ${deliverySettings.threshold}`}
            </div>
          </form>

          <div className="grid gap-3">
            {seed.productRegistry.map((product) => (
              <article key={product.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">{product.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {product.release} · {product.msrp}
                    </p>
                  </div>
                  <Pill tone="blue">{product.status}</Pill>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  function renderJournal() {
    return (
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Panel>
          <SectionTitle title="Session journal" detail="Fast logging after a drop attempt, with the latest signal able to prefill the target." />
          <form className="grid gap-4 p-5" onSubmit={handleSessionSubmit}>
            <ProductImage item={selectedTargetArtwork} className="h-48" />
            <FieldLabel label="Target">
              <SelectInput value={target} onChange={(event) => setTarget(event.target.value)}>
                {seed.productRegistry.map((product) => (
                  <option key={product.id} value={product.title}>
                    {product.title}
                  </option>
                ))}
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Channel">
              <SelectInput value={channel} onChange={(event) => setChannel(event.target.value)}>
                {seed.channels
                  .filter((item) => item !== "All")
                  .map((item) => (
                    <option key={item}>{item}</option>
                  ))}
              </SelectInput>
            </FieldLabel>
            <div className="grid gap-2 text-sm font-medium text-slate-700">
              Outcome
              <div className="flex flex-wrap gap-2">
                {(["Win", "Miss", "False Alarm"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setOutcome(item)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      outcome === item
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <FieldLabel label="Note">
              <TextArea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="Queue moved, pickup vanished, local store had boxes..."
              />
            </FieldLabel>
            <PrimaryButton type="submit">Save session</PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <SectionTitle
            title="Recent outcomes"
            action={
              <SecondaryButton type="button" onClick={() => setSessionLog([])}>
                Clear history
              </SecondaryButton>
            }
          />
          <div className="grid gap-3 p-5">
            {recentEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                No session outcomes logged yet.
              </div>
            ) : (
              recentEntries.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-950">{entry.target}</h3>
                      <p className="mt-1 text-sm text-slate-500">{entry.channel}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(entry.outcome)}`}>
                      {entry.outcome}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{entry.note}</p>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </Panel>
      </div>
    );
  }

  function renderAnalytics() {
    return (
      <Panel>
        <SectionTitle
          title="Signal analytics"
          detail={
            bestChannel
              ? `${bestChannel.channel} is currently the strongest logged path at ${bestChannel.winRate}% win rate.`
              : "Start logging outcomes and this area will rank the channels earning your attention."
          }
        />
        <div className="grid gap-5 p-5">
          <ArtRail items={seed.watchItems} onSelect={(item) => setSelectedChannel(item.channel)} />
          <div className="grid gap-4 lg:grid-cols-4">
            {channelAnalytics.map((entry) => (
              <article key={entry.channel} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Pill tone="blue">{entry.channel}</Pill>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {entry.winRate}%
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {entry.wins} wins from {entry.attempts} attempts
                </p>
              </article>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  function renderRegistry() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <SectionTitle title="Product registry" detail="Canonical targets, aliases, and official launch links." />
          <div className="grid gap-3 p-5">
            {seed.productRegistry.map((product) => (
              <article key={product.id} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[132px_1fr]">
                <ProductImage
                  item={
                    seed.watchItems.find((item) =>
                      product.title.includes(item.title.split(" ")[0]),
                    ) ?? featuredItem
                  }
                  className="h-28"
                />
                <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">{product.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {product.release} · {product.msrp}
                    </p>
                  </div>
                  <Pill tone="yellow">{product.status}</Pill>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {product.aliases.join(", ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.launchLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Official sources" />
          <div className="grid gap-3 p-5">
            {seed.sourceLinks.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <h3 className="font-semibold text-slate-950">{source.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{source.note}</p>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const viewContent: Record<ViewId, React.ReactNode> = {
    command: renderCommandCenter(),
    signals: renderSignals(),
    watch: renderWatch(),
    stores: renderStores(),
    delivery: renderDelivery(),
    journal: renderJournal(),
    analytics: renderAnalytics(),
    registry: renderRegistry(),
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl lg:left-24">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveView("command")}
            className="flex items-center gap-3 rounded-md text-left"
          >
            <PokeballMark />
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                Pokemon Drop Intel
              </span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Seed {seed.generatedAt}
              </span>
            </span>
          </button>
          <div className="ml-auto hidden min-w-0 flex-1 justify-center md:flex">
            <div className="flex w-full max-w-md items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Search drops, stores, signals
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Pill tone="green">Mailbox ready</Pill>
            <Pill tone={alertPosture === "Live" ? "red" : "yellow"}>
              Alert posture {alertPosture}
            </Pill>
            <button
              type="button"
              onClick={() => setActiveView("watch")}
              className="min-h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50"
            >
              Pinned {pinnedProducts.length}
            </button>
          </div>
          <PrimaryButton onClick={() => setActiveView("signals")}>
            Parse signal
          </PrimaryButton>
        </div>
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-24 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col items-center gap-2 py-4">
          <button
            type="button"
            onClick={() => setActiveView("command")}
            className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-slate-950"
          >
            <PokeballMark size="sm" />
          </button>
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`group grid w-20 place-items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-semibold transition ${
                activeView === item.id
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              }`}
              title={item.label}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md border text-[11px] ${
                activeView === item.id
                  ? "border-sky-200 bg-white"
                  : "border-slate-200 bg-white"
              }`}>
                <NavGlyph id={item.id} />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="lg:pl-24">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 pb-10 pt-24 sm:px-6">
          <div className="grid grid-cols-4 gap-2 lg:hidden">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`rounded-md px-2 py-2 text-sm font-semibold ${
                  activeView === item.id
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {viewContent[activeView]}
        </div>
      </div>
    </main>
  );
}
