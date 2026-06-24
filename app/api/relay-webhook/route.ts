import { lookup } from "node:dns/promises";

type WebhookPreset = "custom" | "discord" | "slack" | "ntfy";

type RelayWebhookRequest = {
  url?: string;
  authToken?: string;
  preset?: WebhookPreset;
  ntfyTopic?: string;
  payload?: unknown;
};

type RelaySignalPayload = {
  deliveredAt?: string;
  launchHref?: string;
  productTitle?: string;
  source?: string;
  parsed?: {
    channel?: string;
    signalType?: string;
    urgency?: string;
    confidence?: string;
    summary?: string;
    purchaseLimit?: string | null;
  };
};

async function readRelayRequest(request: Request) {
  try {
    return (await request.json()) as RelayWebhookRequest;
  } catch {
    return null;
  }
}

function previewResponse(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function isSignalPayload(payload: unknown): payload is RelaySignalPayload {
  return typeof payload === "object" && payload !== null;
}

function getSignalPayload(payload: unknown): RelaySignalPayload {
  return isSignalPayload(payload) ? payload : {};
}

function getMessageParts(payload: unknown) {
  const signal = getSignalPayload(payload);
  const parsed = signal.parsed ?? {};
  const productTitle = signal.productTitle ?? "Pokemon TCG signal";
  const urgency = parsed.urgency ?? "Unknown";
  const signalType = parsed.signalType ?? "Alert";
  const channel = parsed.channel ?? "Unknown channel";
  const summary = parsed.summary ?? "A tracked signal matched your delivery rules.";
  const purchaseLimit = parsed.purchaseLimit ?? "No purchase-limit text detected";
  const launchHref = signal.launchHref ?? "";
  const source = signal.source ?? "dashboard-parser";
  const text = `${urgency} ${signalType}: ${productTitle}`;

  return {
    channel,
    launchHref,
    productTitle,
    purchaseLimit,
    signalType,
    source,
    summary,
    text,
    urgency,
  };
}

function ntfyPriority(urgency: string) {
  if (urgency === "Critical") {
    return 5;
  }

  if (urgency === "High") {
    return 4;
  }

  if (urgency === "Medium") {
    return 3;
  }

  return 2;
}

function formatRelayPayload(
  preset: WebhookPreset,
  payload: unknown,
  ntfyTopic: string,
) {
  if (preset === "custom") {
    return payload ?? {};
  }

  const message = getMessageParts(payload);

  if (preset === "discord") {
    return {
      content: message.text,
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: message.productTitle,
          description: message.summary,
          url: message.launchHref || undefined,
          color: message.urgency === "Critical" ? 16753920 : 3447003,
          fields: [
            { name: "Signal", value: message.signalType, inline: true },
            { name: "Channel", value: message.channel, inline: true },
            { name: "Limit", value: message.purchaseLimit, inline: false },
            { name: "Source", value: message.source, inline: false },
          ],
        },
      ],
    };
  }

  if (preset === "slack") {
    return {
      text: message.text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${message.text}*\n${message.summary}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Channel*\n${message.channel}` },
            { type: "mrkdwn", text: `*Limit*\n${message.purchaseLimit}` },
            { type: "mrkdwn", text: `*Source*\n${message.source}` },
          ],
        },
        ...(message.launchHref
          ? [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `<${message.launchHref}|Open mapped launch page>`,
                },
              },
            ]
          : []),
      ],
    };
  }

  return {
    topic: ntfyTopic,
    title: message.text,
    message: `${message.summary}\n${message.purchaseLimit}`,
    priority: ntfyPriority(message.urgency),
    tags: ["pokemon", message.urgency.toLowerCase()],
    click: message.launchHref || undefined,
  };
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  );
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

async function isPrivateWebhookTarget(url: URL) {
  if (isPrivateHostname(url.hostname)) {
    return true;
  }

  const addresses = await lookup(url.hostname, { all: true });

  return addresses.some((item) =>
    item.family === 4 ? isPrivateIpv4(item.address) : isPrivateIpv6(item.address),
  );
}

export async function POST(request: Request) {
  const body = await readRelayRequest(request);

  if (!body) {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const url = body.url?.trim() ?? "";
  const preset = body.preset ?? "custom";
  const ntfyTopic = body.ntfyTopic?.trim() ?? "";

  if (!url) {
    return Response.json(
      { error: "Provide a webhook URL for relay." },
      { status: 400 },
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return Response.json(
      { error: "Webhook URL must be a valid absolute URL." },
      { status: 400 },
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return Response.json(
      { error: "Webhook URL must use http or https." },
      { status: 400 },
    );
  }

  if (process.env.POKEMON_ALLOW_PRIVATE_WEBHOOKS !== "true") {
    try {
      if (await isPrivateWebhookTarget(parsedUrl)) {
        return Response.json(
          {
            error:
              "Webhook URL cannot target localhost or private network addresses unless POKEMON_ALLOW_PRIVATE_WEBHOOKS=true.",
          },
          { status: 400 },
        );
      }
    } catch {
      return Response.json(
        { error: "Webhook URL host could not be verified." },
        { status: 400 },
      );
    }
  }

  if (!["custom", "discord", "slack", "ntfy"].includes(preset)) {
    return Response.json(
      { error: "Webhook preset must be custom, discord, slack, or ntfy." },
      { status: 400 },
    );
  }

  if (preset === "ntfy" && !ntfyTopic) {
    return Response.json(
      { error: "ntfy preset requires a topic." },
      { status: 400 },
    );
  }

  try {
    const relayPayload = formatRelayPayload(preset, body.payload, ntfyTopic);
    const response = await fetch(parsedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(body.authToken
          ? { Authorization: `Bearer ${body.authToken.trim()}` }
          : {}),
      },
      body: JSON.stringify(relayPayload),
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    const responsePreview = previewResponse(responseText);

    if (!response.ok) {
      return Response.json(
        {
          error: `Relay target responded with ${response.status} ${response.statusText}.`,
          ok: false,
          relayedAt: new Date().toISOString(),
          responsePreview,
          status: response.status,
          statusText: response.statusText,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      relayedAt: new Date().toISOString(),
      responsePreview,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook relay request failed.",
      },
      { status: 502 },
    );
  }
}
