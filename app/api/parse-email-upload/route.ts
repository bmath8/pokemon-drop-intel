import { dashboardSeed } from "@/app/_lib/dashboard-data";
import { parseEmailAlert, parseRawEmail } from "@/app/_lib/email-parser";
import { normalizeProductSignal } from "@/app/_lib/sku-normalizer";

const maxEmailFileBytes = 1_000_000;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Attach an email file to parse." },
      { status: 400 },
    );
  }

  if (file.size > maxEmailFileBytes) {
    return Response.json(
      { error: "Email file is too large. Upload a file under 1 MB." },
      { status: 413 },
    );
  }

  const rawText = await file.text();

  if (!rawText.trim()) {
    return Response.json(
      { error: "The uploaded file is empty." },
      { status: 400 },
    );
  }

  const parsedEmail = parseRawEmail(rawText);
  const parsedSignal = parseEmailAlert(parsedEmail.subject, parsedEmail.body);
  const normalized = normalizeProductSignal(
    `${parsedEmail.subject} ${parsedEmail.body}`,
    dashboardSeed.productRegistry,
  );

  return Response.json({
    parsedAt: new Date().toISOString(),
    parsedEmail,
    parsed: parsedSignal,
    normalized,
    fileName: file.name,
  });
}
