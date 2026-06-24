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

export type RawEmailParseResult = {
  subject: string;
  body: string;
  from: string | null;
};

export type MailboxMessageParseResult = RawEmailParseResult & {
  index: number;
};

const channelMatchers = [
  { name: "Pokemon Center", keywords: ["pokemon center", "pokemoncenter"] },
  { name: "Target", keywords: ["target"] },
  { name: "Walmart", keywords: ["walmart"] },
  { name: "Best Buy", keywords: ["best buy", "bestbuy"] },
  { name: "GameStop", keywords: ["gamestop", "game stop"] },
  { name: "Local", keywords: ["prerelease", "league", "local tournament"] },
];

const signalMatchers = [
  {
    type: "Early Access Invite",
    keywords: ["early access", "exclusive access", "invite link", "single-use"],
  },
  {
    type: "Queue Notice",
    keywords: ["queue", "line is paused", "you are in line", "virtual queue"],
  },
  {
    type: "Preorder Open",
    keywords: ["preorder", "pre-order", "reserve now"],
  },
  {
    type: "Restock Alert",
    keywords: ["back in stock", "available now", "now live", "inventory"],
  },
  {
    type: "Pickup Change",
    keywords: ["pickup", "pick up", "store availability"],
  },
  {
    type: "Local Event",
    keywords: ["prerelease", "league", "registration", "event"],
  },
];

const monthNames =
  "January|February|March|April|May|June|July|August|September|October|November|December";

function normalizeText(text: string) {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMatches(text: string, candidates: string[]) {
  const lowered = text.toLowerCase();
  return candidates.filter((keyword) => lowered.includes(keyword));
}

function detectChannel(text: string) {
  for (const matcher of channelMatchers) {
    if (matcher.keywords.some((keyword) => text.includes(keyword))) {
      return matcher.name;
    }
  }

  return "Unknown";
}

function detectSignalType(text: string) {
  for (const matcher of signalMatchers) {
    if (matcher.keywords.some((keyword) => text.includes(keyword))) {
      return matcher.type;
    }
  }

  return "General Alert";
}

function detectUrgency(text: string, signalType: string): ParsedSignal["urgency"] {
  if (
    signalType === "Early Access Invite" ||
    text.includes("single-use") ||
    text.includes("available now") ||
    text.includes("now live")
  ) {
    return "Critical";
  }

  if (
    signalType === "Queue Notice" ||
    signalType === "Preorder Open" ||
    text.includes("expires") ||
    text.includes("limited")
  ) {
    return "High";
  }

  if (signalType === "Restock Alert" || signalType === "Pickup Change") {
    return "Medium";
  }

  return "Low";
}

function detectConfidence(
  channel: string,
  signalType: string,
  keywordCount: number,
): ParsedSignal["confidence"] {
  if (channel !== "Unknown" && signalType !== "General Alert" && keywordCount >= 2) {
    return "High";
  }

  if (channel !== "Unknown" || signalType !== "General Alert") {
    return "Medium";
  }

  return "Low";
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return [...new Set(matches)];
}

function extractDates(text: string) {
  const regex = new RegExp(`\\b(?:${monthNames})\\s+\\d{1,2},\\s+\\d{4}\\b`, "gi");
  const matches = text.match(regex) ?? [];
  return [...new Set(matches)];
}

function extractPurchaseLimit(text: string) {
  const limitMatch = text.match(
    /\b(limit(?:ed)?\s+(?:to\s+)?)((?:one|two|three|\d+)[^.;,!]*?(?:customer|household|account))\b/i,
  );

  if (limitMatch) {
    return limitMatch[0].trim();
  }

  return null;
}

function buildActionItems(channel: string, signalType: string, urgency: ParsedSignal["urgency"]) {
  const actions: string[] = [];

  if (signalType === "Early Access Invite") {
    actions.push("Open the invite link from the same account path you expect to use at checkout.");
    actions.push("Confirm the target product and whether preorder items must be separated from other cart items.");
  }

  if (signalType === "Queue Notice") {
    actions.push("Join through the official link and keep one clean browser session active.");
    actions.push("Avoid improvising with duplicate tabs or alternate queue paths.");
  }

  if (signalType === "Preorder Open" || signalType === "Restock Alert") {
    actions.push("Verify sign-in state, payment method, and pickup preferences before clicking through.");
  }

  if (signalType === "Local Event") {
    actions.push("Call or message the store immediately to confirm registration timing and allocation details.");
  }

  if (channel === "Target" || channel === "Best Buy") {
    actions.push("Check pickup radius and store selection before you commit to ship-to-home fallback.");
  }

  if (urgency === "Critical" && actions.length < 3) {
    actions.push("Move this into your session journal after the attempt so you can measure whether this alert source converts.");
  }

  if (actions.length === 0) {
    actions.push("Review the message manually and tag whether it changes your active watchlist.");
  }

  return actions;
}

export function parseEmailAlert(subject: string, body: string): ParsedSignal {
  const cleanedSubject = normalizeText(subject);
  const cleanedBody = normalizeText(body);
  const combined = `${cleanedSubject} ${cleanedBody}`.toLowerCase();

  const matchedKeywords = [
    ...new Set(
      collectMatches(
        combined,
        [...channelMatchers, ...signalMatchers].flatMap((item) => item.keywords),
      ),
    ),
  ];

  const channel = detectChannel(combined);
  const signalType = detectSignalType(combined);
  const urgency = detectUrgency(combined, signalType);
  const confidence = detectConfidence(channel, signalType, matchedKeywords.length);
  const dates = extractDates(`${cleanedSubject} ${cleanedBody}`);
  const urls = extractUrls(body);
  const purchaseLimit = extractPurchaseLimit(cleanedBody);
  const actionItems = buildActionItems(channel, signalType, urgency);

  const summaryParts = [
    channel !== "Unknown" ? channel : "Unclassified sender",
    signalType.toLowerCase(),
  ];

  if (dates[0]) {
    summaryParts.push(`mentions ${dates[0]}`);
  }

  return {
    channel,
    signalType,
    urgency,
    confidence,
    summary: `${summaryParts.join(" ")}.`,
    actionItems,
    dates,
    urls,
    purchaseLimit,
    matchedKeywords,
  };
}

function decodeHeaderValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeQuotedPrintable(text: string) {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([A-F0-9]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function stripMultipartBoundary(text: string) {
  return text
    .split(/\r?\n--[^\r\n]+/g)[0]
    .replace(/\r?\nContent-[^\r\n]+:.*(?:\r?\n[ \t].*)*/gi, "")
    .trim();
}

function extractHeaderBlock(rawEmail: string) {
  const separator = rawEmail.match(/\r?\n\r?\n/);

  if (!separator || separator.index === undefined) {
    return { headerBlock: rawEmail, bodyBlock: "" };
  }

  const splitIndex = separator.index;
  const separatorLength = separator[0].length;

  return {
    headerBlock: rawEmail.slice(0, splitIndex),
    bodyBlock: rawEmail.slice(splitIndex + separatorLength),
  };
}

function extractHeaderValue(headerBlock: string, name: string) {
  const regex = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?:\\r?\\n[^ \\t]|$)`, "im");
  const match = headerBlock.match(regex);

  if (!match) {
    return null;
  }

  return decodeHeaderValue(match[1].replace(/\r?\n[ \t]+/g, " "));
}

export function parseRawEmail(rawEmail: string): RawEmailParseResult {
  const { headerBlock, bodyBlock } = extractHeaderBlock(rawEmail);
  const subject = extractHeaderValue(headerBlock, "Subject") ?? "";
  const from = extractHeaderValue(headerBlock, "From");
  const contentType = extractHeaderValue(headerBlock, "Content-Type") ?? "";
  const transferEncoding =
    extractHeaderValue(headerBlock, "Content-Transfer-Encoding") ?? "";

  let normalizedBody = bodyBlock.trim();

  if (contentType.toLowerCase().includes("multipart/")) {
    normalizedBody = stripMultipartBoundary(normalizedBody);
  }

  if (transferEncoding.toLowerCase().includes("quoted-printable")) {
    normalizedBody = decodeQuotedPrintable(normalizedBody);
  }

  const body = normalizeText(normalizedBody);

  return {
    subject,
    body,
    from,
  };
}

function splitMailboxMessages(rawMailbox: string) {
  const normalized = rawMailbox.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const messages: string[] = [];
  let current: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const isEnvelopeBoundary = line.startsWith("From ") && index !== 0;

    if (isEnvelopeBoundary) {
      const message = current.join("\n").trim();

      if (message) {
        messages.push(message);
      }

      current = [];
      continue;
    }

    current.push(line);
  }

  const finalMessage = current.join("\n").trim();

  if (finalMessage) {
    messages.push(finalMessage);
  }

  return messages;
}

export function parseMailboxArchive(rawMailbox: string): MailboxMessageParseResult[] {
  return splitMailboxMessages(rawMailbox)
    .map((message, index) => ({
      index: index + 1,
      ...parseRawEmail(message),
    }))
    .filter((message) => message.subject.trim() || message.body.trim());
}
