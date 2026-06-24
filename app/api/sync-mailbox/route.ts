import { ImapFlow } from "imapflow";

import { dashboardSeed } from "@/app/_lib/dashboard-data";
import { parseEmailAlert, parseRawEmail } from "@/app/_lib/email-parser";
import { normalizeProductSignal } from "@/app/_lib/sku-normalizer";

export const runtime = "nodejs";

const requiredEnv = [
  "POKEMON_MAILBOX_HOST",
  "POKEMON_MAILBOX_USER",
  "POKEMON_MAILBOX_PASSWORD",
];

type MailboxSyncRequest = {
  senderFilters?: string;
  subjectFilters?: string;
};

function parseFilterList(value?: string) {
  if (!value) {
    return [] as string[];
  }

  return [
    ...new Set(
      value
        .split(/[,\n]/g)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function mergeFilters(...groups: string[][]) {
  return [...new Set(groups.flat())];
}

async function readSyncRequest(request: Request): Promise<MailboxSyncRequest> {
  try {
    return (await request.json()) as MailboxSyncRequest;
  } catch {
    return {};
  }
}

function readPositiveInteger(name: string, fallback: number, max: number) {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function readMailboxConfig(body: MailboxSyncRequest) {
  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    return { missing };
  }

  return {
    host: process.env.POKEMON_MAILBOX_HOST!.trim(),
    port: readPositiveInteger("POKEMON_MAILBOX_PORT", 993, 65535),
    secure: process.env.POKEMON_MAILBOX_SECURE?.toLowerCase() !== "false",
    user: process.env.POKEMON_MAILBOX_USER!.trim(),
    password: process.env.POKEMON_MAILBOX_PASSWORD!,
    mailbox: process.env.POKEMON_MAILBOX_PATH?.trim() || "INBOX",
    limit: readPositiveInteger("POKEMON_MAILBOX_LIMIT", 20, 50),
    scanLimit: readPositiveInteger("POKEMON_MAILBOX_SCAN_LIMIT", 80, 200),
    sinceHours: readPositiveInteger("POKEMON_MAILBOX_SINCE_HOURS", 48, 24 * 14),
    senderFilters: mergeFilters(
      parseFilterList(process.env.POKEMON_MAILBOX_SENDER_FILTERS),
      parseFilterList(body.senderFilters),
    ),
    subjectFilters: mergeFilters(
      parseFilterList(process.env.POKEMON_MAILBOX_SUBJECT_FILTERS),
      parseFilterList(body.subjectFilters),
    ),
  };
}

function envelopeSenderText(
  envelope?: { from?: Array<{ name?: string; address?: string }> },
) {
  return (envelope?.from ?? [])
    .map((address) => `${address.name ?? ""} ${address.address ?? ""}`)
    .join(" ")
    .toLowerCase();
}

function envelopeMatches(
  envelope: {
    from?: Array<{ name?: string; address?: string }>;
    subject?: string;
  } | undefined,
  senderFilters: string[],
  subjectFilters: string[],
) {
  const senderText = envelopeSenderText(envelope);
  const subjectText = (envelope?.subject ?? "").toLowerCase();
  const senderMatches =
    senderFilters.length === 0 ||
    senderFilters.some((filter) => senderText.includes(filter));
  const subjectMatches =
    subjectFilters.length === 0 ||
    subjectFilters.some((filter) => subjectText.includes(filter));

  return senderMatches && subjectMatches;
}

export async function POST(request: Request) {
  const body = await readSyncRequest(request);
  const config = readMailboxConfig(body);

  if ("missing" in config) {
    return Response.json(
      {
        error: "Mailbox sync needs IMAP environment variables before it can connect.",
        missing: config.missing,
        requiredEnv,
      },
      { status: 400 },
    );
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    disableAutoIdle: true,
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock(config.mailbox, { readOnly: true });

    try {
      const since = new Date(Date.now() - config.sinceHours * 60 * 60 * 1000);
      const ids = await client.search({ since }, { uid: true });

      if (!ids || ids.length === 0) {
        return Response.json({
          parsedAt: new Date().toISOString(),
          mailbox: config.mailbox,
          sinceHours: config.sinceHours,
          filters: {
            sender: [],
            subject: [],
          },
          scannedCount: 0,
          matchedCount: 0,
          messageCount: 0,
          entries: [],
        });
      }

      const selectedIds = ids.slice(-config.scanLimit);
      const envelopes = await client.fetchAll(
        selectedIds,
        {
          uid: true,
          envelope: true,
        },
        { uid: true },
      );
      const matchingIds = envelopes
        .filter((message) =>
          envelopeMatches(
            message.envelope,
            config.senderFilters,
            config.subjectFilters,
          ),
        )
        .map((message) => message.uid)
        .slice(-config.limit);

      if (matchingIds.length === 0) {
        return Response.json({
          parsedAt: new Date().toISOString(),
          mailbox: config.mailbox,
          sinceHours: config.sinceHours,
          filters: {
            sender: config.senderFilters,
            subject: config.subjectFilters,
          },
          scannedCount: envelopes.length,
          matchedCount: 0,
          messageCount: 0,
          entries: [],
        });
      }

      const messages = await client.fetchAll(
        matchingIds,
        {
          uid: true,
          source: { maxLength: 1_000_000 },
        },
        { uid: true },
      );

      const entries = messages
        .filter((message) => message.source)
        .map((message, index) => {
          const parsedEmail = parseRawEmail(message.source!.toString("utf8"));
          const parsed = parseEmailAlert(parsedEmail.subject, parsedEmail.body);
          const normalized = normalizeProductSignal(
            `${parsedEmail.subject} ${parsedEmail.body}`,
            dashboardSeed.productRegistry,
          );

          return {
            index: index + 1,
            uid: message.uid,
            parsedEmail,
            parsed,
            normalized,
          };
        })
        .filter((entry) => entry.parsedEmail.subject.trim() || entry.parsedEmail.body.trim());

      return Response.json({
        parsedAt: new Date().toISOString(),
        mailbox: config.mailbox,
        sinceHours: config.sinceHours,
        filters: {
          sender: config.senderFilters,
          subject: config.subjectFilters,
        },
        scannedCount: envelopes.length,
        matchedCount: matchingIds.length,
        messageCount: entries.length,
        entries,
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mailbox sync failed before messages could be parsed.",
      },
      { status: 502 },
    );
  } finally {
    await client.logout().catch(() => undefined);
  }
}
