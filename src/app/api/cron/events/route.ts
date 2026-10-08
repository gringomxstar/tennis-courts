import { NextResponse } from "next/server";
import { runEvents } from "@/lib/events-server";

/** Vercel Cron (vercel.json, daily): Erinnerungen vor Anmeldeschluss und «Morgen»-Mails. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runEvents(new Date()));
}
