import { dashboardSeed } from "@/app/_lib/dashboard-data";
import { parseEmailAlert, parseMailboxArchive } from "@/app/_lib/email-parser";
import { normalizeProductSignal } from "@/app/_lib/sku-normalizer";

const maxMailboxFileBytes = 5_000_000;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Attach a mailbox archive to parse." },
      { status: 400 },
    );
  }

  if (file.size > maxMailboxFileBytes) {
    return Response.json(
      { error: "Mailbox archive is too large. Upload an archive under 5 MB." },
      { status: 413 },
    );
  }

  const rawText = await file.text();

  if (!rawText.trim()) {
    return Response.json(
      { error: "The uploaded mailbox archive is empty." },
      { status: 400 },
    );
  }

  const parsedMailbox = parseMailboxArchive(rawText);

  if (parsedMailbox.length === 0) {
    return Response.json(
      { error: "No usable messages were found in this mailbox archive." },
      { status: 400 },
    );
  }

  const entries = parsedMailbox.map((message) => {
    const parsed = parseEmailAlert(message.subject, message.body);
    const normalized = normalizeProductSignal(
      `${message.subject} ${message.body}`,
      dashboardSeed.productRegistry,
    );

    return {
      index: message.index,
      parsedEmail: {
        from: message.from,
        subject: message.subject,
        body: message.body,
      },
      parsed,
      normalized,
    };
  });

  return Response.json({
    parsedAt: new Date().toISOString(),
    fileName: file.name,
    messageCount: entries.length,
    entries,
  });
}
