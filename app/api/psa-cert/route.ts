import { NextResponse } from "next/server";
import { collectorSeed } from "@/app/_lib/dashboard-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cert = searchParams.get("cert")?.trim() ?? "";
  const configured = Boolean(process.env.PSA_CERT_API_URL && process.env.PSA_CERT_API_KEY);
  const sample = collectorSeed.gradingOrders.find((order) => order.certNumber === cert);

  if (configured) {
    return NextResponse.json({
      status: "configured",
      message:
        "PSA adapter credentials are present. Add the approved upstream request mapping before enabling live verification.",
      result: sample ?? null,
    });
  }

  return NextResponse.json({
    status: "setup-required",
    message:
      "No approved PSA cert API is configured. Manual cert entry and seeded slab views remain available.",
    result:
      sample ??
      (cert
        ? {
            certNumber: cert,
            title: "Manual PSA cert lookup",
            stage: "Research",
            population: "Connect an approved PSA source to fetch live population data.",
          }
        : null),
  });
}
