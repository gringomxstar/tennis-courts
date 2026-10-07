import { NextResponse } from "next/server";
import { runSponsoring } from "@/lib/sponsor-server";

/** Vercel Cron (vercel.json, daily): campaign mails, reminders, board tasks, invoices of running contracts, dunning. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSponsoring());
}
