"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Spinner } from "@/components/app/avatar";
import type { MembershipPlan } from "@/types";

const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function features(p: MembershipPlan) {
  const d = [...p.allowedDurations].sort((a, b) => a - b);
  return [
    "Sandplätze ohne Platzgebühr",
    `Buchen bis ${p.bookingWindowDays} Tage im Voraus`,
    p.simultaneousBookingLimit === 1 ? "1 offene Buchung" : `${p.simultaneousBookingLimit} offene Buchungen gleichzeitig`,
    d.length ? `Spieldauer ${d.join(" / ")} Min` : "",
  ].filter(Boolean);
}

export function AbosView({
  slug,
  clubName,
  loggedIn,
  plans,
  initialPlan,
  guestRate,
  invoice,
  membership,
}: {
  slug: string;
  clubName: string;
  loggedIn: boolean;
  plans: MembershipPlan[];
  initialPlan?: string;
  guestRate: number;
  invoice: boolean;
  membership: { planId: string; name: string; validity: string } | null;
}) {
  const popular = plans.length >= 3 ? plans[Math.floor(plans.length / 2)].id : null;
  const [sel, setSel] = useState(
    [initialPlan, membership?.planId, popular].find((id) => id && plans.some((p) => p.id === id)) ?? plans[0]?.id
  );
  const [paying, setPaying] = useState<"STRIPE" | "OFFLINE_INVOICE" | null>(null);
  const sp = plans.find((p) => p.id === sel);
  const registerHref = `/c/${slug}/profile?register=1&next=${encodeURIComponent(`/c/${slug}/abos?plan=${sel ?? ""}`)}`;

  async function pay(paymentMethod: "STRIPE" | "OFFLINE_INVOICE") {
    if (!sp || paying) return;
    setPaying(paymentMethod);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: sp.id, paymentMethod }),
      });
      const j: { url?: string; error?: string } = await r.json();
      if (j.url) return window.location.assign(j.url);
      toast(j.error ?? "Zahlung fehlgeschlagen");
    } catch {
      toast("Zahlung fehlgeschlagen");
    }
    setPaying(null);
  }

  const primary = "flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]";
  const secondary = "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold text-clay-text";
  const payLabel = sp ? `Mit Twint oder Karte zahlen · CHF ${fmt(sp.price)}` : "";

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Abos</h1>
        <div className="text-[15px] text-muted-foreground">{clubName}</div>
      </div>

      {membership && (
        <div className="mx-5 mt-4 rounded-[26px] border border-border bg-card p-5">
          <div className={label}>Dein Abo</div>
          <div className="mt-[3px] text-[22px] font-bold tracking-[-.02em]">{membership.name}</div>
          <div className="mt-px text-[14px] text-muted-foreground">{membership.validity}</div>
        </div>
      )}

      {sp && guestRate > 0 && sp.price > 0 && (
        <div className="mx-5 mt-4 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground">
          Als Gast: CHF {fmt(guestRate)}/Std. – dein Abo ist nach{" "}
          <span className="font-bold text-foreground">{Math.ceil(sp.price / guestRate)} Stunden</span> bezahlt.
        </div>
      )}

      {plans.length === 0 ? (
        <div className="mx-5 mt-4 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground">
          Der Club hat noch keine Abos eingerichtet.
        </div>
      ) : (
        <div className="mx-5 mt-3 flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:items-start">
          {plans.map((p) => {
            const on = p.id === sel;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSel(p.id)}
                className={`w-full rounded-[26px] border-2 bg-card p-5 text-left transition-[border-color] duration-[250ms] ${on ? "border-clay" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 text-[20px] font-bold tracking-[-.02em]">{p.name}</div>
                  {p.id === popular && (
                    <span className="rounded-full bg-clay px-2.5 py-[3px] text-[12px] font-bold text-white">Am beliebtesten</span>
                  )}
                </div>
                {p.description && <div className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">{p.description}</div>}
                <div className="mt-2 text-[52px] font-bold leading-[1.1] tracking-[-.045em]">
                  <span className="text-[22px] tracking-normal text-muted-foreground">CHF </span>
                  {fmt(p.price)}
                  <span className="text-[17px] font-semibold tracking-normal text-muted-foreground"> / Jahr</span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {features(p).map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[15px] font-semibold">
                      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-clay-text">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      {plans.length > 0 && (
        <div className="px-5 pt-4 text-center text-[13px] text-muted-foreground">
          Sofort freigeschaltet · Sicher bezahlt über Stripe · Jederzeit im Profil
        </div>
      )}

      {sp && sp.price > 0 && (
        <div className="sticky bottom-[calc(106px+env(safe-area-inset-bottom))] z-20 mx-3 mt-4 rounded-[26px] border border-border bg-glass p-3 shadow-elevation backdrop-blur-[24px] backdrop-saturate-[1.6] lg:bottom-6 lg:mx-5 lg:flex lg:items-center lg:gap-3">
          {loggedIn ? (
            <button type="button" onClick={() => pay("STRIPE")} disabled={!!paying} className={`${primary} lg:max-w-md`}>
              {paying === "STRIPE" && <Spinner />}
              {paying === "STRIPE" ? "Weiterleiten…" : payLabel}
            </button>
          ) : (
            <Link href={registerHref} className={`${primary} lg:max-w-md`}>
              {payLabel}
            </Link>
          )}
          {invoice &&
            (loggedIn ? (
              <button type="button" onClick={() => pay("OFFLINE_INVOICE")} disabled={!!paying} className={`${secondary} lg:mt-0 lg:w-auto lg:px-4`}>
                {paying === "OFFLINE_INVOICE" && <Spinner />}Auf Rechnung
              </button>
            ) : (
              <Link href={registerHref} className={`${secondary} lg:mt-0 lg:w-auto lg:px-4`}>
                Auf Rechnung
              </Link>
            ))}
        </div>
      )}
    </>
  );
}
