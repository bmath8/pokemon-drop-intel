import { dashboardSeed } from "@/app/_lib/dashboard-data";

export async function GET() {
  return Response.json(dashboardSeed);
}
