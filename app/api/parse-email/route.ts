import { dashboardSeed } from "@/app/_lib/dashboard-data";
import { parseEmailAlert } from "@/app/_lib/email-parser";
import { normalizeProductSignal } from "@/app/_lib/sku-normalizer";

type ParseRequest = {
  subject?: string;
  body?: string;
};

const maxParseTextLength = 200_000;

async function readParseRequest(request: Request) {
  try {
    return (await request.json()) as ParseRequest;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const payload = await readParseRequest(request);

  if (!payload) {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const subject = payload.subject?.trim() ?? "";
  const body = payload.body?.trim() ?? "";

  if (!subject && !body) {
    return Response.json(
      { error: "Provide an email subject or body to parse." },
      { status: 400 },
    );
  }

  if (subject.length + body.length > maxParseTextLength) {
    return Response.json(
      { error: "Email text is too large to parse in one request." },
      { status: 413 },
    );
  }

  const parsed = parseEmailAlert(subject, body);
  const normalized = normalizeProductSignal(
    `${subject} ${body}`,
    dashboardSeed.productRegistry,
  );

  return Response.json({
    parsedAt: new Date().toISOString(),
    parsed,
    normalized,
  });
}
