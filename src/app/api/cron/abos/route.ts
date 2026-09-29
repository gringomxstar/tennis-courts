import { NextResponse } from "next/server";
import { runAboRenewals } from "@/lib/abo-renewal";

/** Vercel Cron (vercel.json, daily): season-end reminders and auto-renewals. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runAboRenewals());
}
