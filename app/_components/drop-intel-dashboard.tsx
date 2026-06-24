"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  DashboardSeed,
  LaunchLink,
  ParsedSignal,
  ProductNormalizationResult,
  ReadinessSeed,
  SourceLink,
  StoreMemorySeed,
  WatchItem,
} from "@/app/_lib/dashboard-data";

type ReadinessState = Record<string, boolean>;

type SessionEntry = {
  id: string;
  outcome: "Win" | "Miss" | "False Alarm";
  channel: string;
  target: string;
  note: string;
  createdAt: string;
};

const readinessStorageKey = "pokemon-drop-readiness";
const sessionStorageKey = "pokemon-drop-session-log";
const emailDraftStorageKey = "pokemon-drop-email-draft";
const parsedAlertHistoryStorageKey = "pokemon-drop-parsed-alert-history";
const storeMemoryStorageKey = "pokemon-drop-store-memory";
const deliverySettingsStorageKey = "pokemon-drop-delivery-settings";
const deliveryLogStorageKey = "pokemon-drop-delivery-log";
const productRulesStorageKey = "pokemon-drop-product-rules";
const mailboxFiltersStorageKey = "pokemon-drop-mailbox-filters";

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

type StoreMemoryEntry = StoreMemorySeed;

type StoreMemoryDraft = Omit<StoreMemoryEntry, "id">;

type ParseResponse = {
  parsedAt?: string;
  parsed?: ParsedSignal;
  normalized?: ProductNormalizationResult;
};

type UploadParseResponse = ParseResponse & {
  error?: string;
  fileName?: string;
  parsedEmail?: { from: string | null; subject: string; body: string };
};

type MailboxUploadResponse = {
  error?: string;
  parsedAt?: string;
  fileName?: string;
  messageCount?: number;
  entries?: Array<{
    index: number;
    uid?: number;
    parsedEmail: { from: string | null; subject: string; body: string };
    parsed: ParsedSignal;
    normalized?: ProductNormalizationResult;
  }>;
};

type MailboxSyncResponse = MailboxUploadResponse & {
  missing?: string[];
  requiredEnv?: string[];
  mailbox?: string;
  sinceHours?: number;
  filters?: {
    sender: string[];
    subject: string[];
  };
  scannedCount?: number;
  matchedCount?: number;
};

type MailboxFilters = {
  senderFilters: string;
  subjectFilters: string;
};

type DeliverySettings = {
  browserEnabled: boolean;
  webhookEnabled: boolean;
  webhookPreset: "custom" | "discord" | "slack" | "ntfy";
  webhookUrl: string;
  webhookAuthToken: string;
  ntfyTopic: string;
  threshold: ParsedSignal["urgency"];
};

type ProductRuleThreshold = ParsedSignal["urgency"] | "Default";

type ProductNotificationRules = Record<string, ProductRuleThreshold>;

type DeliveryLogEntry = {
  id: string;
  createdAt: string;
  route: "Browser" | "Webhook";
  status:
    | "Delivered"
    | "Failed"
    | "Suppressed"
    | "Permission Needed"
    | "Not Supported";
  urgency: ParsedSignal["urgency"];
  headline: string;
  product: string;
  detail: string;
};

type WebhookRelayResponse = {
  error?: string;
  ok?: boolean;
  relayedAt?: string;
  responsePreview?: string;
  status?: number;
  statusText?: string;
};

const urgencyRank: Record<ParsedSignal["urgency"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

function createInitialDeliverySettings(): DeliverySettings {
  return {
    browserEnabled: false,
    webhookEnabled: false,
    webhookPreset: "custom",
    webhookUrl: "",
    webhookAuthToken: "",
    ntfyTopic: "",
    threshold: "Critical",
  };
}

function createInitialReadiness(items: ReadinessSeed[]): ReadinessState {
  return items.reduce<ReadinessState>((acc, item) => {
    acc[item.id] = false;
    return acc;
  }, {});
}

function loadReadiness(items: ReadinessSeed[]) {
  if (typeof window === "undefined") {
    return createInitialReadiness(items);
  }

  const initial = createInitialReadiness(items);
  const saved = window.localStorage.getItem(readinessStorageKey);

  if (!saved) {
    return initial;
  }

  try {
    return { ...initial, ...JSON.parse(saved) };
  } catch {
    return initial;
  }
}

function loadSessionLog() {
  if (typeof window === "undefined") {
    return [] as SessionEntry[];
  }

  const saved = window.localStorage.getItem(sessionStorageKey);

  if (!saved) {
    return [] as SessionEntry[];
  }

  try {
    return JSON.parse(saved) as SessionEntry[];
  } catch {
    return [] as SessionEntry[];
  }
}

function loadParsedAlertHistory() {
  if (typeof window === "undefined") {
    return [] as ParsedAlertHistoryEntry[];
  }

  const saved = window.localStorage.getItem(parsedAlertHistoryStorageKey);

  if (!saved) {
    return [] as ParsedAlertHistoryEntry[];
  }

  try {
    return JSON.parse(saved) as ParsedAlertHistoryEntry[];
  } catch {
    return [] as ParsedAlertHistoryEntry[];
  }
}

function loadStoreMemory(seedEntries: StoreMemorySeed[]) {
  if (typeof window === "undefined") {
    return seedEntries;
  }

  const saved = window.localStorage.getItem(storeMemoryStorageKey);

  if (!saved) {
    return seedEntries;
  }

  try {
    return JSON.parse(saved) as StoreMemoryEntry[];
  } catch {
    return seedEntries;
  }
}

function loadDeliverySettings() {
  if (typeof window === "undefined") {
    return createInitialDeliverySettings();
  }

  const saved = window.localStorage.getItem(deliverySettingsStorageKey);

  if (!saved) {
    return createInitialDeliverySettings();
  }

  try {
    return {
      ...createInitialDeliverySettings(),
      ...(JSON.parse(saved) as Partial<DeliverySettings>),
    };
  } catch {
    return createInitialDeliverySettings();
  }
}

function loadDeliveryLog() {
  if (typeof window === "undefined") {
    return [] as DeliveryLogEntry[];
  }

  const saved = window.localStorage.getItem(deliveryLogStorageKey);

  if (!saved) {
    return [] as DeliveryLogEntry[];
  }

  try {
    return JSON.parse(saved) as DeliveryLogEntry[];
  } catch {
    return [] as DeliveryLogEntry[];
  }
}

function loadProductNotificationRules() {
  if (typeof window === "undefined") {
    return {} as ProductNotificationRules;
  }

  const saved = window.localStorage.getItem(productRulesStorageKey);

  if (!saved) {
    return {} as ProductNotificationRules;
  }

  try {
    return JSON.parse(saved) as ProductNotificationRules;
  } catch {
    return {} as ProductNotificationRules;
  }
}

function createInitialMailboxFilters(): MailboxFilters {
  return {
    senderFilters: "",
    subjectFilters: "pokemon, tcg, early access, restock, preorder, prerelease",
  };
}

function loadMailboxFilters() {
  if (typeof window === "undefined") {
    return createInitialMailboxFilters();
  }

  const saved = window.localStorage.getItem(mailboxFiltersStorageKey);

  if (!saved) {
    return createInitialMailboxFilters();
  }

  try {
    return {
      ...createInitialMailboxFilters(),
      ...(JSON.parse(saved) as Partial<MailboxFilters>),
    };
  } catch {
    return createInitialMailboxFilters();
  }
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

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;
}

function completionLabel(completed: number, total: number) {
  if (completed === total) {
    return "Ready";
  }

  if (completed === 0) {
    return "Cold";
  }

  return "In Progress";
}

function reliabilityBadgeClass(reliability: StoreMemoryEntry["reliability"]) {
  switch (reliability) {
    case "High":
      return "border-emerald-400/25 bg-emerald-400/15 text-emerald-100";
    case "Medium":
      return "border-amber-300/25 bg-amber-300/15 text-amber-100";
    default:
      return "border-rose-400/25 bg-rose-400/15 text-rose-100";
  }
}

function normalizeJournalChannel(
  incomingChannel: string,
  availableChannels: string[],
) {
  if (availableChannels.includes(incomingChannel) && incomingChannel !== "All") {
    return incomingChannel;
  }

  if (["Target", "Walmart", "Best Buy", "GameStop"].includes(incomingChannel)) {
    return "Retailers";
  }

  if (incomingChannel === "Pokemon Center") {
    return "Pokemon Center";
  }

  if (incomingChannel === "Local") {
    return "Local";
  }

  return "Community";
}

function urgencyMeetsThreshold(
  urgency: ParsedSignal["urgency"],
  threshold: ParsedSignal["urgency"],
) {
  return urgencyRank[urgency] >= urgencyRank[threshold];
}

function resolveProductThreshold(
  productId: string | undefined,
  rules: ProductNotificationRules,
  fallback: ParsedSignal["urgency"],
) {
  if (!productId) {
    return fallback;
  }

  const rule = rules[productId];
  return rule && rule !== "Default" ? rule : fallback;
}

function deliveryStatusClass(status: DeliveryLogEntry["status"]) {
  switch (status) {
    case "Delivered":
      return "border-emerald-400/25 bg-emerald-400/15 text-emerald-100";
    case "Failed":
      return "border-rose-400/25 bg-rose-400/15 text-rose-100";
    case "Suppressed":
      return "border-amber-300/25 bg-amber-300/15 text-amber-100";
    case "Permission Needed":
      return "border-cyan-300/25 bg-cyan-300/15 text-cyan-100";
    default:
      return "border-slate-400/25 bg-slate-400/15 text-slate-200";
  }
}

function EntryBadge({ outcome }: { outcome: SessionEntry["outcome"] }) {
  const styles = {
    Win: "border-emerald-400/25 bg-emerald-400/15 text-emerald-100",
    Miss: "border-rose-400/25 bg-rose-400/15 text-rose-100",
    "False Alarm": "border-amber-300/25 bg-amber-300/15 text-amber-100",
  };

  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs uppercase tracking-[0.18em] ${styles[outcome]}`}
    >
      {outcome}
    </span>
  );
}

function WatchCard({ item }: { item: WatchItem }) {
  return (
    <article className="grid gap-4 rounded-lg border border-white/10 bg-slate-950/45 p-4 lg:grid-cols-[190px_1fr]">
      <div className="relative min-h-40 overflow-hidden rounded-md border border-white/10">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 1024px) 100vw, 190px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-300/80">
              {item.channel}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {item.title}
            </h3>
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
            <div>{item.release}</div>
            <div className="mt-1 text-slate-400">{item.price}</div>
          </div>
        </div>

        <p className="text-sm font-medium text-amber-200/90">{item.status}</p>
        <p className="text-sm leading-6 text-slate-300">{item.note}</p>

        <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-sm leading-6 text-emerald-100">
          {item.action}
        </div>
      </div>
    </article>
  );
}

function SourceCard({ source }: { source: SourceLink }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <a
        href={source.href}
        target="_blank"
        rel="noreferrer"
        className="text-base font-semibold text-white transition hover:text-amber-200"
      >
        {source.label}
      </a>
      <p className="mt-3 text-sm leading-6 text-slate-300">{source.note}</p>
    </article>
  );
}

function LaunchLinkList({
  links,
  heading,
}: {
  links: LaunchLink[];
  heading: string;
}) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {heading}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/14"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function DropIntelDashboard({ seed }: { seed: DashboardSeed }) {
  const [selectedChannel, setSelectedChannel] = useState("All");
  const [readiness, setReadiness] = useState<ReadinessState>(() =>
    createInitialReadiness(seed.readinessSeed),
  );
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [target, setTarget] = useState(seed.productRegistry[0]?.title ?? "");
  const [channel, setChannel] = useState(seed.channels[1] ?? "Pokemon Center");
  const [outcome, setOutcome] = useState<SessionEntry["outcome"]>("Miss");
  const [note, setNote] = useState("");
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    subject: "",
    body: "",
  });
  const [parsedSignal, setParsedSignal] = useState<ParsedSignal | null>(null);
  const [normalizedProduct, setNormalizedProduct] =
    useState<ProductNormalizationResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isMailboxUploading, setIsMailboxUploading] = useState(false);
  const [isMailboxSyncing, setIsMailboxSyncing] = useState(false);
  const [mailboxStatus, setMailboxStatus] = useState("");
  const [mailboxFilters, setMailboxFilters] = useState<MailboxFilters>(() =>
    createInitialMailboxFilters(),
  );
  const [uploadMeta, setUploadMeta] = useState<UploadedEmailMeta | null>(null);
  const [parsedAlertHistory, setParsedAlertHistory] = useState<
    ParsedAlertHistoryEntry[]
  >([]);
  const [storeMemory, setStoreMemory] = useState<StoreMemoryEntry[]>([]);
  const [storeDraft, setStoreDraft] = useState<StoreMemoryDraft>(
    createStoreDraft(),
  );
  const [storeError, setStoreError] = useState("");
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(
    createInitialDeliverySettings(),
  );
  const [deliveryLog, setDeliveryLog] = useState<DeliveryLogEntry[]>([]);
  const [productNotificationRules, setProductNotificationRules] =
    useState<ProductNotificationRules>({});
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setReadiness(loadReadiness(seed.readinessSeed));
      setSessionLog(loadSessionLog());
      setParsedAlertHistory(loadParsedAlertHistory());
      setStoreMemory(loadStoreMemory(seed.storeMemorySeed));
      setDeliverySettings(loadDeliverySettings());
      setDeliveryLog(loadDeliveryLog());
      setProductNotificationRules(loadProductNotificationRules());
      setMailboxFilters(loadMailboxFilters());
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
      const savedDraft = window.localStorage.getItem(emailDraftStorageKey);

      if (savedDraft) {
        try {
          setEmailDraft(JSON.parse(savedDraft) as EmailDraft);
        } catch {
          setEmailDraft({ subject: "", body: "" });
        }
      }

      setIsStorageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [seed.readinessSeed, seed.storeMemorySeed]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(readinessStorageKey, JSON.stringify(readiness));
  }, [isStorageReady, readiness]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(sessionLog));
  }, [isStorageReady, sessionLog]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(emailDraftStorageKey, JSON.stringify(emailDraft));
  }, [emailDraft, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(
      parsedAlertHistoryStorageKey,
      JSON.stringify(parsedAlertHistory),
    );
  }, [isStorageReady, parsedAlertHistory]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(storeMemoryStorageKey, JSON.stringify(storeMemory));
  }, [isStorageReady, storeMemory]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(
      mailboxFiltersStorageKey,
      JSON.stringify(mailboxFilters),
    );
  }, [isStorageReady, mailboxFilters]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(
      deliverySettingsStorageKey,
      JSON.stringify(deliverySettings),
    );
  }, [deliverySettings, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(deliveryLogStorageKey, JSON.stringify(deliveryLog));
  }, [deliveryLog, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(
      productRulesStorageKey,
      JSON.stringify(productNotificationRules),
    );
  }, [isStorageReady, productNotificationRules]);

  const filteredWatchItems = useMemo(() => {
    if (selectedChannel === "All") {
      return seed.watchItems;
    }

    return seed.watchItems.filter((item) => item.channel === selectedChannel);
  }, [seed.watchItems, selectedChannel]);

  const readinessCompleted = useMemo(
    () => Object.values(readiness).filter(Boolean).length,
    [readiness],
  );

  const readinessTotal = seed.readinessSeed.length;
  const readinessPercent = Math.round(
    (readinessCompleted / readinessTotal) * 100,
  );

  const recentEntries = useMemo(
    () =>
      [...sessionLog]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [sessionLog],
  );

  const recentParsedAlerts = useMemo(
    () =>
      [...parsedAlertHistory]
        .sort(
          (a, b) =>
            new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime(),
        )
        .slice(0, 6),
    [parsedAlertHistory],
  );

  const canonicalTargets = useMemo(
    () => seed.productRegistry.map((product) => product.title),
    [seed.productRegistry],
  );

  const prioritizedStoreMemory = useMemo(
    () =>
      [...storeMemory].sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        return order[a.reliability] - order[b.reliability];
      }),
    [storeMemory],
  );

  const sessionChannelAnalytics = useMemo(
    () =>
      seed.channels
        .filter((item) => item !== "All")
        .map((channelName) => {
          const entries = sessionLog.filter((entry) => entry.channel === channelName);
          const wins = entries.filter((entry) => entry.outcome === "Win").length;
          const misses = entries.filter((entry) => entry.outcome === "Miss").length;
          const falseAlarms = entries.filter(
            (entry) => entry.outcome === "False Alarm",
          ).length;
          const attempts = entries.length;
          const winRate = attempts > 0 ? Math.round((wins / attempts) * 100) : 0;

          return {
            channel: channelName,
            attempts,
            wins,
            misses,
            falseAlarms,
            winRate,
          };
        })
        .sort((a, b) => {
          if (b.winRate !== a.winRate) {
            return b.winRate - a.winRate;
          }

          return b.attempts - a.attempts;
        }),
    [seed.channels, sessionLog],
  );

  const parsedSourceAnalytics = useMemo(() => {
    const sourceOrder: ParsedAlertHistoryEntry["source"][] = [
      "Mailbox",
      "Upload",
      "Manual",
    ];

    return sourceOrder.map((source) => {
      const entries = parsedAlertHistory.filter((entry) => entry.source === source);
      const critical = entries.filter(
        (entry) => entry.parsed.urgency === "Critical",
      ).length;
      const mapped = entries.filter(
        (entry) => entry.normalized?.primaryMatch !== null,
      ).length;

      return {
        source,
        total: entries.length,
        critical,
        mapped,
      };
    });
  }, [parsedAlertHistory]);

  const bestChannel = sessionChannelAnalytics.find((entry) => entry.attempts > 0);

  function appendDeliveryLog(
    entry: Omit<DeliveryLogEntry, "id" | "createdAt">,
  ) {
    setDeliveryLog((current) => [
      {
        id: createClientId(),
        createdAt: new Date().toISOString(),
        ...entry,
      },
      ...current,
    ].slice(0, 12));
  }

  async function routeParsedAlert(
    parsed: ParsedSignal,
    normalized: ProductNormalizationResult | null,
    nextUploadMeta: UploadedEmailMeta | null,
  ) {
    const matchedProductId = normalized?.primaryMatch?.productId;
    const productTitle = normalized?.primaryMatch?.title ?? "Unmapped signal";
    const effectiveThreshold = resolveProductThreshold(
      matchedProductId,
      productNotificationRules,
      deliverySettings.threshold,
    );
    const headline = `${parsed.signalType} · ${parsed.channel}`;
    const sourceDetail = nextUploadMeta?.fileName
      ? `Source ${nextUploadMeta.fileName}.`
      : "Parsed inside the dashboard.";
    const launchHref =
      normalized?.primaryMatch?.launchLinks[0]?.href ?? parsed.urls[0] ?? "";
    const deliveryBody = [
      parsed.urgency,
      parsed.signalType,
      parsed.purchaseLimit ?? "No limit text detected",
    ].join(" · ");

    if (!urgencyMeetsThreshold(parsed.urgency, effectiveThreshold)) {
      appendDeliveryLog({
        route: "Browser",
        status: "Suppressed",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} Below the ${effectiveThreshold.toLowerCase()} threshold.`,
      });
      if (deliverySettings.webhookEnabled || deliverySettings.webhookUrl.trim()) {
        appendDeliveryLog({
          route: "Webhook",
          status: "Suppressed",
          urgency: parsed.urgency,
          headline,
          product: productTitle,
          detail: `${sourceDetail} Below the ${effectiveThreshold.toLowerCase()} threshold.`,
        });
      }
      return;
    }

    if (!deliverySettings.browserEnabled) {
      appendDeliveryLog({
        route: "Browser",
        status: "Suppressed",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} Browser delivery is currently turned off.`,
      });
    } else if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      appendDeliveryLog({
        route: "Browser",
        status: "Not Supported",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} This browser does not expose the Notification API.`,
      });
    } else {
      const permission = Notification.permission;
      setNotificationPermission(permission);

      if (permission !== "granted") {
        appendDeliveryLog({
          route: "Browser",
          status: "Permission Needed",
          urgency: parsed.urgency,
          headline,
          product: productTitle,
          detail: `${sourceDetail} Allow browser notifications to surface this signal instantly.`,
        });
      } else {
        const notification = new Notification(productTitle, {
          body: deliveryBody,
          tag: normalized?.primaryMatch?.productId ?? parsed.signalType,
        });

        if (launchHref) {
          notification.onclick = () => {
            window.focus();
            window.open(launchHref, "_blank", "noopener,noreferrer");
          };
        }

        setDeliveryStatus(
          `Delivered ${parsed.urgency.toLowerCase()} ${parsed.signalType} to browser alerts.`,
        );
        appendDeliveryLog({
          route: "Browser",
          status: "Delivered",
          urgency: parsed.urgency,
          headline,
          product: productTitle,
          detail: launchHref
            ? `${sourceDetail} Click the notification to open the mapped launch page.`
            : `${sourceDetail} Delivered without a mapped launch page.`,
        });
      }
    }

    if (!deliverySettings.webhookEnabled) {
      appendDeliveryLog({
        route: "Webhook",
        status: "Suppressed",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} Webhook relay is currently turned off.`,
      });
      return;
    }

    if (!deliverySettings.webhookUrl.trim()) {
      appendDeliveryLog({
        route: "Webhook",
        status: "Failed",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} Add a webhook URL before enabling relay.`,
      });
      setDeliveryStatus("Webhook relay needs a destination URL.");
      return;
    }

    try {
      const response = await fetch("/api/relay-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: deliverySettings.webhookUrl.trim(),
          authToken: deliverySettings.webhookAuthToken.trim() || undefined,
          preset: deliverySettings.webhookPreset,
          ntfyTopic: deliverySettings.ntfyTopic.trim() || undefined,
          payload: {
            deliveredAt: new Date().toISOString(),
            source: nextUploadMeta?.fileName ?? "dashboard-parser",
            parsed,
            normalized,
            launchHref,
            productTitle,
          },
        }),
      });

      const data = (await response.json()) as WebhookRelayResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ??
            `Webhook relay returned ${data.status ?? response.status}.`,
        );
      }

      setDeliveryStatus(
        `Delivered ${parsed.urgency.toLowerCase()} ${parsed.signalType} to the webhook relay.`,
      );
      appendDeliveryLog({
        route: "Webhook",
        status: "Delivered",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${sourceDetail} Relay returned ${data.status}. ${
          data.responsePreview ? `Preview: ${data.responsePreview}` : ""
        }`.trim(),
      });
    } catch (error) {
      setDeliveryStatus(
        error instanceof Error ? error.message : "Webhook relay failed.",
      );
      appendDeliveryLog({
        route: "Webhook",
        status: "Failed",
        urgency: parsed.urgency,
        headline,
        product: productTitle,
        detail: `${
          error instanceof Error ? error.message : "Webhook relay failed."
        } ${sourceDetail}`.trim(),
      });
    }
  }

  function toggleReadiness(id: string) {
    setReadiness((current) => ({ ...current, [id]: !current[id] }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNote = note.trim();

    const entry: SessionEntry = {
      id: createClientId(),
      outcome,
      channel,
      target,
      note: trimmedNote || "No note recorded.",
      createdAt: new Date().toISOString(),
    };

    setSessionLog((current) => [entry, ...current]);
    setNote("");
  }

  function clearHistory() {
    setSessionLog([]);
  }

  function handleStoreDraftChange<K extends keyof StoreMemoryDraft>(
    field: K,
    value: StoreMemoryDraft[K],
  ) {
    setStoreDraft((current) => ({ ...current, [field]: value }));
  }

  function saveStoreMemoryEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!storeDraft.name.trim() || !storeDraft.location.trim()) {
      setStoreError("Add at least a store name and a location anchor.");
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

  function removeStoreMemoryEntry(id: string) {
    setStoreMemory((current) => current.filter((entry) => entry.id !== id));
  }

  function resetStoreMemory() {
    setStoreMemory(seed.storeMemorySeed);
    setStoreDraft(createStoreDraft());
    setStoreError("");
  }

  function handleDeliverySettingChange<K extends keyof DeliverySettings>(
    field: K,
    value: DeliverySettings[K],
  ) {
    setDeliverySettings((current) => ({ ...current, [field]: value }));
  }

  function handleProductRuleChange(
    productId: string,
    threshold: ProductRuleThreshold,
  ) {
    setProductNotificationRules((current) => {
      if (threshold === "Default") {
        const next = { ...current };
        delete next[productId];
        return next;
      }

      return { ...current, [productId]: threshold };
    });
  }

  function resetProductRules() {
    setProductNotificationRules({});
    setDeliveryStatus("Product notification rules reset.");
  }

  async function requestNotificationAccess() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setDeliveryStatus("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setDeliveryStatus("Browser notifications are ready.");
      setDeliverySettings((current) => ({ ...current, browserEnabled: true }));
      return;
    }

    setDeliveryStatus("Browser notification permission was not granted.");
  }

  function sendTestDelivery() {
    const fallbackProduct = seed.productRegistry[0];

    void routeParsedAlert(
      parsedSignal ?? {
        channel: "Pokemon Center",
        signalType: "Test Alert",
        urgency: "Critical",
        confidence: "High",
        summary: "Test delivery from the dashboard.",
        actionItems: ["Open the mapped page and confirm your session is ready."],
        dates: [],
        urls: fallbackProduct?.launchLinks[0]
          ? [fallbackProduct.launchLinks[0].href]
          : [],
        purchaseLimit: "Test signal",
        matchedKeywords: ["test"],
      },
      normalizedProduct ?? (fallbackProduct
        ? {
            primaryMatch: {
              productId: fallbackProduct.id,
              title: fallbackProduct.title,
              release: fallbackProduct.release,
              msrp: fallbackProduct.msrp,
              channels: fallbackProduct.channels,
              launchLinks: fallbackProduct.launchLinks,
              score: 100,
              matchedTerms: ["test"],
              status: fallbackProduct.status,
            },
            candidates: [],
          }
        : null),
      {
        fileName: "Dashboard test delivery",
        from: null,
        subject: "Manual test",
      },
    );
  }

  function clearDeliveryLog() {
    setDeliveryLog([]);
    setDeliveryStatus("");
  }

  function prepareSessionEntryFromParsedAlert() {
    if (!parsedSignal) {
      return;
    }

    setChannel(normalizeJournalChannel(parsedSignal.channel, seed.channels));

    if (normalizedProduct?.primaryMatch?.title) {
      setTarget(normalizedProduct.primaryMatch.title);
    }

    setOutcome("Miss");
    setNote(
      `${parsedSignal.summary}${
        uploadMeta?.fileName ? ` Source: ${uploadMeta.fileName}.` : ""
      }`,
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

    void routeParsedAlert(parsed, normalizedResult, nextUploadMeta);
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
  }

  function loadParsedHistoryEntry(entry: ParsedAlertHistoryEntry) {
    setParseError("");
    setUploadStatus(
      entry.source === "Upload" && entry.uploadMeta
        ? `Loaded ${entry.uploadMeta.fileName} from history`
        : "Loaded parsed alert from history",
    );
    setParsedSignal(entry.parsed);
    setNormalizedProduct(entry.normalized);
    setUploadMeta(entry.uploadMeta);
    setEmailDraft(entry.draft);

    if (entry.normalized?.primaryMatch?.title) {
      setTarget(entry.normalized.primaryMatch.title);
    }
  }

  function clearParsedAlertHistory() {
    setParsedAlertHistory([]);
    setUploadStatus("");
    setMailboxStatus("");
  }

  async function handleParseEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsParsing(true);
    setParseError("");
    setUploadMeta(null);
    setUploadStatus("");

    try {
      const response = await fetch("/api/parse-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailDraft),
      });

      const data = (await response.json()) as ParseResponse & { error?: string };

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
    } catch (error) {
      setParsedSignal(null);
      setNormalizedProduct(null);
      setParseError(
        error instanceof Error ? error.message : "Parser request failed.",
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleUploadEmail(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setParseError("");
    setUploadStatus(
      files.length > 1 ? `Queued ${files.length} files for parsing` : "",
    );

    try {
      const failures: string[] = [];
      let successCount = 0;

      for (const [index, file] of files.entries()) {
        setUploadStatus(
          files.length > 1
            ? `Processing ${index + 1} of ${files.length}: ${file.name}`
            : `Processing ${file.name}`,
        );

        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/parse-email-upload", {
            method: "POST",
            body: formData,
          });

          const data = (await response.json()) as UploadParseResponse;

          if (
            !response.ok ||
            !data.parsed ||
            !data.parsedEmail ||
            !data.fileName
          ) {
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
          successCount += 1;
        } catch (error) {
          failures.push(
            `${file.name}: ${
              error instanceof Error ? error.message : "Upload request failed."
            }`,
          );
        }
      }

      if (failures.length > 0) {
        setParseError(
          `Batch finished with ${failures.length} issue${
            failures.length === 1 ? "" : "s"
          }. ${failures.join(" ")}`,
        );
      }

      if (successCount > 0) {
        setUploadStatus(
          `Parsed ${successCount} of ${files.length} file${
            files.length === 1 ? "" : "s"
          }`,
        );
      } else if (failures.length > 0) {
        setUploadStatus("No uploaded files could be parsed.");
      }
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Upload request failed.",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function applyMailboxEntries(data: MailboxUploadResponse, sourceLabel: string) {
    if (!data.entries) {
      return 0;
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
          fileName: `${sourceLabel} · ${
            entry.uid ? `UID ${entry.uid}` : `message ${entry.index}`
          }`,
          from: entry.parsedEmail.from,
          subject: entry.parsedEmail.subject,
        },
        parsedAt: data.parsedAt,
      });
    }

    return data.entries.filter((entry) => entry.parsed.urgency === "Critical")
      .length;
  }

  async function handleUploadMailbox(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsMailboxUploading(true);
    setParseError("");
    setMailboxStatus(`Processing mailbox archive ${file.name}`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-mailbox-upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as MailboxUploadResponse;

      if (
        !response.ok ||
        !data.entries ||
        data.entries.length === 0 ||
        !data.fileName
      ) {
        throw new Error(
          data.error ?? "Mailbox archive parser could not read this file.",
        );
      }

      const criticalCount = applyMailboxEntries(data, data.fileName);

      setMailboxStatus(
        `Imported ${data.entries.length} message${
          data.entries.length === 1 ? "" : "s"
        } from ${data.fileName}. ${criticalCount} critical signal${
          criticalCount === 1 ? "" : "s"
        } detected.`,
      );
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Mailbox upload failed.",
      );
      setMailboxStatus("");
    } finally {
      setIsMailboxUploading(false);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mailboxFilters),
      });
      const data = (await response.json()) as MailboxSyncResponse;

      if (!response.ok) {
        const missing = data.missing?.length
          ? ` Missing: ${data.missing.join(", ")}.`
          : "";
        throw new Error(data.error ? `${data.error}${missing}` : "Mailbox sync failed.");
      }

      if (!data.entries || data.entries.length === 0) {
        const filterNote =
          data.scannedCount !== undefined
            ? ` Scanned ${data.scannedCount} recent message${
                data.scannedCount === 1 ? "" : "s"
              } against the active filters.`
            : "";
        setMailboxStatus(
          `Mailbox sync checked ${data.mailbox ?? "INBOX"} for the last ${
            data.sinceHours ?? 48
          } hours. No usable messages were found.${filterNote}`,
        );
        return;
      }

      const sourceLabel = `IMAP ${data.mailbox ?? "INBOX"}`;
      const criticalCount = applyMailboxEntries(data, sourceLabel);

      setMailboxStatus(
        `Synced ${data.entries.length} message${
          data.entries.length === 1 ? "" : "s"
        } from ${data.mailbox ?? "INBOX"} after scanning ${
          data.scannedCount ?? data.entries.length
        } recent message${
          (data.scannedCount ?? data.entries.length) === 1 ? "" : "s"
        }. ${criticalCount} critical signal${
          criticalCount === 1 ? "" : "s"
        } detected.`,
      );
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Mailbox sync failed.",
      );
      setMailboxStatus("");
    } finally {
      setIsMailboxSyncing(false);
    }
  }

  function loadSample(kind: "early-access" | "restock") {
    if (kind === "early-access") {
      setEmailDraft({
        subject: "Pokemon Center Early Access: Mega Evolution - Chaos Rising",
        body:
          "You have Early Access to purchase Mega Evolution - Chaos Rising products on May 22, 2026. This single-use invite link is tied to your account. Do not share this link. Limit one per customer. Shop now: https://www.pokemoncenter.com/early-access",
      });
      return;
    }

    setEmailDraft({
      subject: "Target: Pokemon TCG product available now",
      body:
        "Your saved item is available now for pickup or shipping. Store availability may vary. Limit 3 per customer. View item: https://www.target.com/p/pokemon-tcg",
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0a1526_42%,_#08101d_100%)] text-slate-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/90">
              Pokemon TCG Drop Intelligence
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              A fast manual cockpit for finding retail windows before the resale
              crowd swallows them.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Seeded from official channel rules and current release signals as
              of {seed.generatedAt}. This version now remembers your readiness
              state and your own results from each drop session.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[460px]">
            {seed.watchItems.slice(0, 3).map((item, index) => (
              <div
                key={item.title}
                className="relative h-36 overflow-hidden rounded-lg border border-white/10 bg-slate-950/55"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 1024px) 33vw, 150px"
                  preload={index === 0}
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/75">
                    {item.channel}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-5 text-white">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {seed.statBlocks.map((stat) => (
            <article
              key={stat.label}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {stat.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {stat.helper}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                  Priority Watch
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  What this cockpit should care about first
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {seed.channels.map((channelName) => {
                  const active = channelName === selectedChannel;

                  return (
                    <button
                      key={channelName}
                      type="button"
                      onClick={() => setSelectedChannel(channelName)}
                      className={`rounded-md border px-3 py-2 text-sm transition ${
                        active
                          ? "border-amber-300 bg-amber-300 text-slate-950"
                          : "border-white/12 bg-slate-950/50 text-slate-300 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {channelName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {filteredWatchItems.map((item) => (
                <WatchCard key={item.title} item={item} />
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">
                    Readiness
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Session posture
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-white">
                    {readinessPercent}%
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {completionLabel(readinessCompleted, readinessTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-300 transition-[width]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>

              <div className="mt-5 space-y-3">
                {seed.readinessSeed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleReadiness(item.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      readiness[item.id]
                        ? "border-emerald-400/25 bg-emerald-400/12"
                        : "border-white/10 bg-slate-950/45 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs ${
                          readiness[item.id]
                            ? "border-emerald-300 bg-emerald-300 text-slate-950"
                            : "border-white/20 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300/80">
                Acquisition Map
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Channel roles
              </h2>

              <div className="mt-5 space-y-4">
                {seed.channelData.map((item) => (
                  <article
                    key={item.name}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">
                        {item.name}
                      </h3>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {item.speed}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-sky-200/90">
                      {item.status}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {item.edge}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {item.playbook}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                Local Edge
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Where geography still matters
              </h2>

              <div className="mt-5 space-y-4">
                {seed.localOps.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                  >
                    <h3 className="text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.detail}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                    Store Memory
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Save the local map you actually trust
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetStoreMemory}
                  className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Reset to seed
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {prioritizedStoreMemory.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                            {entry.kind}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-1 text-xs uppercase tracking-[0.18em] ${reliabilityBadgeClass(entry.reliability)}`}
                          >
                            {entry.reliability}
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-white">
                          {entry.name}
                        </h3>
                        <p className="mt-2 text-sm text-slate-300">
                          {entry.location} · {entry.driveTime}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeStoreMemoryEntry(entry.id)}
                        className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>

                    <p className="mt-3 text-sm font-medium text-amber-200/90">
                      {entry.nextWindow}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {entry.note}
                    </p>
                  </article>
                ))}
              </div>

              <form className="mt-5 grid gap-4" onSubmit={saveStoreMemoryEntry}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Name</span>
                    <input
                      value={storeDraft.name}
                      onChange={(event) =>
                        handleStoreDraftChange("name", event.target.value)
                      }
                      placeholder="Store, machine, or pickup cluster"
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Location anchor</span>
                    <input
                      value={storeDraft.location}
                      onChange={(event) =>
                        handleStoreDraftChange("location", event.target.value)
                      }
                      placeholder="Neighborhood, route, or store cluster"
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Type</span>
                    <select
                      value={storeDraft.kind}
                      onChange={(event) =>
                        handleStoreDraftChange(
                          "kind",
                          event.target.value as StoreMemoryDraft["kind"],
                        )
                      }
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                    >
                      <option value="League Store">League Store</option>
                      <option value="Vending Machine">Vending Machine</option>
                      <option value="Pickup Zone">Pickup Zone</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Drive time</span>
                    <input
                      value={storeDraft.driveTime}
                      onChange={(event) =>
                        handleStoreDraftChange("driveTime", event.target.value)
                      }
                      placeholder="22 min"
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Reliability</span>
                    <select
                      value={storeDraft.reliability}
                      onChange={(event) =>
                        handleStoreDraftChange(
                          "reliability",
                          event.target.value as StoreMemoryDraft["reliability"],
                        )
                      }
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Next window</span>
                    <input
                      value={storeDraft.nextWindow}
                      onChange={(event) =>
                        handleStoreDraftChange("nextWindow", event.target.value)
                      }
                      placeholder="Usually restocks on Fridays"
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Note</span>
                  <textarea
                    value={storeDraft.note}
                    onChange={(event) =>
                      handleStoreDraftChange("note", event.target.value)
                    }
                    placeholder="What actually makes this location worth remembering?"
                    rows={4}
                    className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                  />
                </label>

                {storeError ? (
                  <div className="rounded-lg border border-rose-400/25 bg-rose-400/12 p-4 text-sm leading-6 text-rose-100">
                    {storeError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                >
                  Save local entry
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">
                Go Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Manual checkout prep
              </h2>
              <ol className="mt-5 space-y-3">
                {seed.goMode.map((step, index) => (
                  <li
                    key={step}
                    className="grid grid-cols-[32px_1fr] gap-3 rounded-md border border-white/10 bg-slate-950/45 px-3 py-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-slate-950">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-6 text-slate-200">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                    Inbox Parser
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Turn alerts into structured signals
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadSample("early-access")}
                    className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    Load Early Access sample
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample("restock")}
                    className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    Load retail sample
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-white/12 bg-slate-950/35 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Upload a raw alert file
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Accepts `.eml`, `.txt`, or raw message exports. Good for
                      real forwarded alerts without copy-pasting the whole body.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white">
                    <input
                      type="file"
                      accept=".eml,.txt,.html,.htm,.msg"
                      multiple
                      onChange={handleUploadEmail}
                      className="hidden"
                    />
                    {isUploading ? "Uploading..." : "Choose files"}
                  </label>
                </div>
                {uploadStatus ? (
                  <p className="mt-3 text-sm text-cyan-200">{uploadStatus}</p>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-white/12 bg-slate-950/35 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Sync or import mailbox alerts
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Pull recent IMAP messages when configured, or import
                      `.mbox` exports when you want a local batch parse.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSyncMailbox}
                      disabled={isMailboxSyncing}
                      className="rounded-md border border-emerald-300/35 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isMailboxSyncing ? "Syncing..." : "Sync mailbox"}
                    </button>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white">
                      <input
                        type="file"
                        accept=".mbox,.txt"
                        onChange={handleUploadMailbox}
                        disabled={isMailboxUploading}
                        className="hidden"
                      />
                      {isMailboxUploading ? "Importing..." : "Import mailbox"}
                    </label>
                  </div>
                </div>
                {mailboxStatus ? (
                  <p className="mt-3 text-sm text-emerald-200">
                    {mailboxStatus}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Sender filters</span>
                    <textarea
                      value={mailboxFilters.senderFilters}
                      onChange={(event) =>
                        setMailboxFilters((current) => ({
                          ...current,
                          senderFilters: event.target.value,
                        }))
                      }
                      placeholder="pokemoncenter.com, target, bestbuy"
                      rows={3}
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Subject filters</span>
                    <textarea
                      value={mailboxFilters.subjectFilters}
                      onChange={(event) =>
                        setMailboxFilters((current) => ({
                          ...current,
                          subjectFilters: event.target.value,
                        }))
                      }
                      placeholder="pokemon, tcg, restock, early access"
                      rows={3}
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMailboxFilters(createInitialMailboxFilters())}
                    className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    Reset filters
                  </button>
                  <p className="text-sm leading-6 text-slate-400">
                    Separate filters with commas or new lines. Sender and
                    subject filters both apply when both are filled.
                  </p>
                </div>
              </div>

              <form className="mt-5 grid gap-4" onSubmit={handleParseEmail}>
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Email subject</span>
                  <input
                    value={emailDraft.subject}
                    onChange={(event) =>
                      setEmailDraft((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="Paste the subject line"
                    className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Email body</span>
                  <textarea
                    value={emailDraft.body}
                    onChange={(event) =>
                      setEmailDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Paste the email body or forwarded text here"
                    rows={7}
                    className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isParsing}
                  className="rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:bg-cyan-300/70"
                >
                  {isParsing ? "Parsing alert..." : "Parse alert"}
                </button>
              </form>

              {parseError ? (
                <div className="mt-5 rounded-lg border border-rose-400/25 bg-rose-400/12 p-4 text-sm leading-6 text-rose-100">
                  {parseError}
                </div>
              ) : null}

              {parsedSignal ? (
                <article className="mt-5 rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                        {parsedSignal.channel}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {parsedSignal.signalType}
                      </h3>
                      {uploadMeta ? (
                        <div className="mt-3 space-y-1 text-sm text-slate-300">
                          <p>{uploadMeta.fileName}</p>
                          {uploadMeta.from ? <p>{uploadMeta.from}</p> : null}
                          {uploadMeta.subject ? (
                            <p className="text-slate-400">{uploadMeta.subject}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-amber-300/20 bg-amber-300/12 px-2 py-1 text-xs uppercase tracking-[0.18em] text-amber-100">
                        {parsedSignal.urgency}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {parsedSignal.confidence} confidence
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {parsedSignal.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={prepareSessionEntryFromParsedAlert}
                      className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                    >
                      Prepare journal entry
                    </button>
                    <p className="text-sm leading-6 text-slate-400">
                      Push this signal into the session journal with the channel,
                      target, and note prefilled.
                    </p>
                  </div>

                  <div className="mt-4 rounded-md border border-cyan-300/18 bg-cyan-300/8 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">
                      Canonical product
                    </p>
                    {normalizedProduct?.primaryMatch ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-white">
                          {normalizedProduct.primaryMatch.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {normalizedProduct.primaryMatch.release} ·{" "}
                          {normalizedProduct.primaryMatch.msrp}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Score {normalizedProduct.primaryMatch.score} · matched{" "}
                          {normalizedProduct.primaryMatch.matchedTerms.join(", ")}
                        </p>
                        <LaunchLinkList
                          links={normalizedProduct.primaryMatch.launchLinks}
                          heading="Launch pages"
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        No strong canonical product match yet. Review the
                        candidate list below or expand the registry.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Action items
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                        {parsedSignal.actionItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Dates
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">
                          {parsedSignal.dates.length > 0
                            ? parsedSignal.dates.join(", ")
                            : "No explicit date detected."}
                        </p>
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Purchase limit
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">
                          {parsedSignal.purchaseLimit ?? "No limit text detected."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Links
                      </p>
                      <div className="mt-3 flex flex-col gap-2 text-sm">
                        {parsedSignal.urls.length > 0 ? (
                          parsedSignal.urls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-cyan-200 transition hover:text-cyan-100"
                            >
                              {url}
                            </a>
                          ))
                        ) : (
                          <p className="text-slate-200">No links detected.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Matched keywords
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {parsedSignal.matchedKeywords.length > 0 ? (
                          parsedSignal.matchedKeywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-xs uppercase tracking-[0.16em] text-slate-300"
                            >
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-slate-200">
                            No strong signal keywords detected.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Match candidates
                      </p>
                      <div className="mt-3 space-y-3">
                        {normalizedProduct?.candidates.length ? (
                          normalizedProduct.candidates.map((candidate) => (
                            <div
                              key={candidate.productId}
                              className="rounded-md border border-white/8 bg-slate-900/70 p-3"
                            >
                              <p className="text-sm font-semibold text-white">
                                {candidate.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">
                                Score {candidate.score} · {candidate.status}
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                {candidate.matchedTerms.join(", ")}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-200">
                            No product candidates detected.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                    Parse Memory
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Recent parsed alerts
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={clearParsedAlertHistory}
                  className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Clear parsed alerts
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {recentParsedAlerts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/12 bg-slate-950/30 p-4 text-sm leading-6 text-slate-400">
                    No parsed alerts saved yet. Manual parses and uploaded
                    files will start building a reusable memory here.
                  </div>
                ) : (
                  recentParsedAlerts.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/12 px-2 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                              {entry.source}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                              {entry.parsed.channel}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white">
                            {entry.draft.subject || "Untitled alert"}
                          </p>
                          <p className="text-sm leading-6 text-slate-300">
                            {entry.parsed.signalType}
                            {entry.normalized?.primaryMatch
                              ? ` · ${entry.normalized.primaryMatch.title}`
                              : ""}
                          </p>
                          {entry.uploadMeta?.fileName ? (
                            <p className="text-sm text-slate-400">
                              {entry.uploadMeta.fileName}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-start gap-3 lg:items-end">
                          <button
                            type="button"
                            onClick={() => loadParsedHistoryEntry(entry)}
                            className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                          >
                            Load result
                          </button>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {new Date(entry.parsedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="border-b border-white/10 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300/80">
                      Push Delivery
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Surface the alerts worth acting on
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Browser notifications and webhook relay now sit on top of
                      the parser, launch links, and urgency model. Every delivery
                      attempt gets logged so we can see what was surfaced,
                      suppressed, or blocked by permissions and config.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      Permission: {notificationPermission}
                    </span>
                    <span className="rounded-md border border-cyan-300/20 bg-cyan-300/12 px-2 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                      Threshold: {deliverySettings.threshold}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Delivery controls
                  </p>

                  <form
                    className="mt-4 space-y-4"
                    autoComplete="off"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <label className="flex items-start gap-3 rounded-md border border-white/8 bg-slate-900/70 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={deliverySettings.browserEnabled}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "browserEnabled",
                            event.target.checked,
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/70"
                      />
                      <span className="leading-6 text-slate-200">
                        Enable browser delivery when a parsed alert meets the
                        selected urgency threshold.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-md border border-white/8 bg-slate-900/70 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={deliverySettings.webhookEnabled}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "webhookEnabled",
                            event.target.checked,
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/70"
                      />
                      <span className="leading-6 text-slate-200">
                        Enable webhook relay so threshold-matching alerts can
                        forward structured JSON into Discord, ntfy, Zapier, or a
                        service you control.
                      </span>
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="text-slate-300">Minimum urgency</span>
                      <select
                        value={deliverySettings.threshold}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "threshold",
                            event.target.value as ParsedSignal["urgency"],
                          )
                        }
                        className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                      >
                        {(["Critical", "High", "Medium", "Low"] as const).map(
                          (item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <div className="rounded-md border border-white/8 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase text-slate-400">
                          Product rules
                        </p>
                        <button
                          type="button"
                          onClick={resetProductRules}
                          className="rounded-md border border-white/12 px-2 py-1 text-xs text-slate-300 transition hover:border-white/25 hover:text-white"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {seed.productRegistry.map((product) => {
                          const currentRule =
                            productNotificationRules[product.id] ?? "Default";

                          return (
                            <label
                              key={product.id}
                              className="grid gap-2 text-sm md:grid-cols-[1fr_150px] md:items-center"
                            >
                              <span className="text-slate-200">
                                {product.title}
                              </span>
                              <select
                                value={currentRule}
                                onChange={(event) =>
                                  handleProductRuleChange(
                                    product.id,
                                    event.target.value as ProductRuleThreshold,
                                  )
                                }
                                className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none transition focus:border-amber-300"
                              >
                                {(
                                  [
                                    "Default",
                                    "Critical",
                                    "High",
                                    "Medium",
                                    "Low",
                                  ] as const
                                ).map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <label className="grid gap-2 text-sm">
                      <span className="text-slate-300">Webhook preset</span>
                      <select
                        value={deliverySettings.webhookPreset}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "webhookPreset",
                            event.target.value as DeliverySettings["webhookPreset"],
                          )
                        }
                        className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                      >
                        <option value="custom">Custom JSON</option>
                        <option value="discord">Discord</option>
                        <option value="slack">Slack</option>
                        <option value="ntfy">ntfy</option>
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="text-slate-300">Webhook URL</span>
                      <input
                        type="url"
                        value={deliverySettings.webhookUrl}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "webhookUrl",
                            event.target.value,
                          )
                        }
                        placeholder="https://your-webhook-endpoint.example"
                        className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                      />
                    </label>

                    {deliverySettings.webhookPreset === "ntfy" ? (
                      <label className="grid gap-2 text-sm">
                        <span className="text-slate-300">ntfy topic</span>
                        <input
                          type="text"
                          value={deliverySettings.ntfyTopic}
                          onChange={(event) =>
                            handleDeliverySettingChange(
                              "ntfyTopic",
                              event.target.value,
                            )
                          }
                          placeholder="pokemon-alerts"
                          className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                        />
                      </label>
                    ) : null}

                    <input
                      type="text"
                      value="webhook-token"
                      autoComplete="username"
                      readOnly
                      aria-hidden="true"
                      tabIndex={-1}
                      className="sr-only"
                    />

                    <label className="grid gap-2 text-sm">
                      <span className="text-slate-300">
                        Bearer token <span className="text-slate-500">(optional)</span>
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={deliverySettings.webhookAuthToken}
                        onChange={(event) =>
                          handleDeliverySettingChange(
                            "webhookAuthToken",
                            event.target.value,
                          )
                        }
                        placeholder="Stored locally in this browser"
                        className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={requestNotificationAccess}
                        className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                      >
                        Allow browser alerts
                      </button>
                      <button
                        type="button"
                        onClick={sendTestDelivery}
                        className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:text-white"
                      >
                        Send test alert
                      </button>
                    </div>

                    <p className="text-sm leading-6 text-slate-400">
                      {deliveryStatus ||
                        "Critical or threshold-matching parsed alerts will route here automatically after manual parse, file upload, or mailbox import."}
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      Webhook credentials stay in local storage for now, which is
                      fine for a single-user workstation and keeps setup friction
                      low while we validate the flow.
                    </p>
                  </form>
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Delivery log
                    </p>
                    <button
                      type="button"
                      onClick={clearDeliveryLog}
                      className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                    >
                      Clear log
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {deliveryLog.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-white/12 bg-slate-950/30 p-4 text-sm leading-6 text-slate-400">
                        No delivery attempts recorded yet. Parse or import an
                        alert, or send a test signal to start the trail.
                      </div>
                    ) : (
                      deliveryLog.map((entry) => (
                        <article
                          key={entry.id}
                          className="rounded-md border border-white/8 bg-slate-900/70 p-3"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                                  {entry.route}
                                </span>
                                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                                  {entry.urgency}
                                </span>
                              </div>
                              <p className="mt-3 text-sm font-semibold text-white">
                                {entry.product}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">
                                {entry.headline}
                              </p>
                            </div>
                            <span
                              className={`rounded-md border px-2 py-1 text-xs uppercase tracking-[0.18em] ${deliveryStatusClass(entry.status)}`}
                            >
                              {entry.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-400">
                            {entry.detail}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="border-b border-white/10 pb-5">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">
                  Signal Analytics
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Which paths are earning your attention
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {bestChannel
                    ? `${bestChannel.channel} is your best logged channel so far at ${bestChannel.winRate}% win rate across ${bestChannel.attempts} attempts.`
                    : "Start logging outcomes and the app will begin ranking channels and parser feeds for you."}
                </p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Channel conversion
                  </p>
                  <div className="mt-4 space-y-3">
                    {sessionChannelAnalytics.map((entry) => (
                      <article
                        key={entry.channel}
                        className="rounded-md border border-white/8 bg-slate-900/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {entry.channel}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {entry.attempts} attempts · {entry.wins} wins ·{" "}
                              {entry.misses} misses
                            </p>
                          </div>
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                            {entry.winRate}%
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {entry.falseAlarms} false alarms logged
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Feed health
                  </p>
                  <div className="mt-4 space-y-3">
                    {parsedSourceAnalytics.map((entry) => (
                      <article
                        key={entry.source}
                        className="rounded-md border border-white/8 bg-slate-900/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {entry.source}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {entry.total} parsed alerts · {entry.critical} critical
                            </p>
                          </div>
                          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/12 px-2 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                            {entry.mapped} mapped
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-rose-300/80">
                    Session Journal
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Log what happened
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Clear history
                </button>
              </div>

              <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Target</span>
                    <select
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                    >
                      {canonicalTargets.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">Channel</span>
                    <select
                      value={channel}
                      onChange={(event) => setChannel(event.target.value)}
                      className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition focus:border-amber-300"
                    >
                      {seed.channels
                        .filter((item) => item !== "All")
                        .map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Outcome</span>
                  <div className="flex flex-wrap gap-2">
                    {(["Win", "Miss", "False Alarm"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setOutcome(item)}
                        className={`rounded-md border px-3 py-2 text-sm transition ${
                          outcome === item
                            ? "border-amber-300 bg-amber-300 text-slate-950"
                            : "border-white/12 bg-slate-950/60 text-slate-300 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What actually happened: queue moved, stock died, pickup vanished, local shop had boxes, invite hit late..."
                    rows={4}
                    className="rounded-md border border-white/12 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                >
                  Save session entry
                </button>
              </form>

              <div className="mt-6 space-y-3">
                {recentEntries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/12 bg-slate-950/30 p-4 text-sm leading-6 text-slate-400">
                    No personal results logged yet. Start recording wins, misses,
                    and bad signals so this dashboard grows a memory.
                  </div>
                ) : (
                  recentEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {entry.target}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {entry.channel}
                          </p>
                        </div>
                        <EntryBadge outcome={entry.outcome} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {entry.note}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                Product Registry
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Canonical watch targets
              </h2>

              <div className="mt-5 space-y-4">
                {seed.productRegistry.map((product) => (
                  <article
                    key={product.id}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {product.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-300">
                          {product.release} · {product.msrp}
                        </p>
                      </div>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {product.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {product.aliases.join(", ")}
                    </p>
                    <LaunchLinkList
                      links={product.launchLinks}
                      heading="Retailer and official pages"
                    />
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-300/80">
                Official Signals
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Source map
              </h2>

              <div className="mt-5 space-y-4">
                {seed.sourceLinks.map((source) => (
                  <SourceCard key={source.href} source={source} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-rose-300/80">
                Build Queue
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                What comes next in the app
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {seed.buildQueue.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-4"
                  >
                    <h3 className="text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
