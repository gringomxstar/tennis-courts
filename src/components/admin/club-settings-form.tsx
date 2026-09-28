"use client";

import { useState } from "react";
import { LimitRole, PriceRule, SportType, TenantSettings } from "@/types";
import { LIMIT_ROLES, SPORTS } from "@/lib/booking-rules";
import { WD } from "@/lib/courts";
import { updateClubSettingsAction } from "@/app/actions/club-settings";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";
const well = "rounded-[20px] bg-inset p-4";
const wellInput =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-card px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
const row = "flex w-full items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 text-left";
const unit = "shrink-0 text-[14px] font-semibold text-muted-foreground";

function Toggle({ on, set, title, sub }: { on: boolean; set: (v: boolean) => void; title: string; sub: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => set(!on)} className={row}>
      <span className="flex-1">
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className="block text-[13px] leading-[1.35] text-muted-foreground">{sub}</span>
      </span>
      <SwitchKnob on={on} />
    </button>
  );
}

interface ClubSettingsFormProps {
  clubSlug: string;
  initialSettings?: TenantSettings | null;
}

export function ClubSettingsForm({
  clubSlug,
  initialSettings,
}: ClubSettingsFormProps) {
  const [openingHour, setOpeningHour] = useState<number>(
    initialSettings?.openingHour ?? 7
  );
  const [closingHour, setClosingHour] = useState<number>(
    initialSettings?.closingHour ?? 22
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(
    initialSettings?.slotDurationMinutes ?? 60
  );
  const [cancellationDeadlineHours, setCancellationDeadlineHours] =
    useState<number>(initialSettings?.cancellationDeadlineHours ?? 24);
  const [allowGuestBookings, setAllowGuestBookings] = useState<boolean>(
    initialSettings?.allowGuestBookings ?? true
  );

  // Epic settings
  const [allowConsecutiveSlotsForDoubles, setAllowConsecutiveSlotsForDoubles] = useState<boolean>(
    initialSettings?.allowConsecutiveSlotsForDoubles ?? true
  );
  const [marlyRuleEnabled, setMarlyRuleEnabled] = useState<boolean>(
    initialSettings?.marlyRuleEnabled ?? true
  );
  const [marlyCooldownMinutes, setMarlyCooldownMinutes] = useState<number>(
    initialSettings?.marlyCooldownMinutes ?? 60
  );
  const maxActiveSlotsPerPlayer = initialSettings?.maxActiveSlotsPerPlayer ?? 2;
  // "" = unlimited; without saved limits, members/guests start at the old club-wide max, coaches unlimited
  const [limits, setLimits] = useState<Record<LimitRole, Record<SportType, string>>>(() => {
    const saved = initialSettings?.slotLimits;
    const row = (role: LimitRole) =>
      Object.fromEntries(
        SPORTS.map(([sp]) => {
          const v = saved ? saved[role]?.[sp] : role === "COACH" ? null : maxActiveSlotsPerPlayer;
          return [sp, v == null ? "" : String(v)];
        })
      ) as Record<SportType, string>;
    return { MEMBER: row("MEMBER"), COACH: row("COACH"), GUEST: row("GUEST") };
  });
  const [lateBookingMinutes, setLateBookingMinutes] = useState<number>(initialSettings?.lateBookingMinutes ?? 15);
  const [payOnSite, setPayOnSite] = useState<boolean>(initialSettings?.payOnSite ?? false);
  const [payByInvoice, setPayByInvoice] = useState<boolean>(initialSettings?.payByInvoice ?? false);
  const [priceRules, setPriceRules] = useState<PriceRule[]>(initialSettings?.priceRules ?? []);
  const setRule = (i: number, patch: Partial<PriceRule>) =>
    setPriceRules(priceRules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const optNum = (v: string) => (v === "" ? undefined : Number(v));
  const [ballMachineFee, setBallMachineFee] = useState<number>(
    initialSettings?.ballMachineFee ?? 10
  );
  const [floodlightFee, setFloodlightFee] = useState<number>(
    initialSettings?.floodlightFee ?? 5
  );
  const [guestFee, setGuestFee] = useState<number>(
    initialSettings?.guestFee ?? 15
  );
  const [defaultHourlyRateTennis, setDefaultHourlyRateTennis] = useState<number>(
    initialSettings?.defaultHourlyRateTennis ?? 30
  );
  const [defaultHourlyRateHalle, setDefaultHourlyRateHalle] = useState<number>(
    initialSettings?.defaultHourlyRateHalle ?? 45
  );
  const [defaultHourlyRatePadel, setDefaultHourlyRatePadel] = useState<number>(
    initialSettings?.defaultHourlyRatePadel ?? 40
  );

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await updateClubSettingsAction(clubSlug, {
        openingHour: Number(openingHour),
        closingHour: Number(closingHour),
        slotDurationMinutes: Number(slotDurationMinutes),
        cancellationDeadlineHours: Number(cancellationDeadlineHours),
        allowGuestBookings,
        allowConsecutiveSlotsForDoubles,
        marlyRuleEnabled,
        marlyCooldownMinutes: Number(marlyCooldownMinutes),
        maxActiveSlotsPerPlayer,
        slotLimits: Object.fromEntries(
          LIMIT_ROLES.map(([role]) => [
            role,
            Object.fromEntries(SPORTS.map(([sp]) => [sp, limits[role][sp] === "" ? null : Number(limits[role][sp])])),
          ])
        ),
        lateBookingMinutes: Number(lateBookingMinutes),
        payOnSite,
        payByInvoice,
        priceRules,
        ballMachineFee: Number(ballMachineFee),
        floodlightFee: Number(floodlightFee),
        guestFee: Number(guestFee),
        defaultHourlyRateTennis: Number(defaultHourlyRateTennis),
        defaultHourlyRateHalle: Number(defaultHourlyRateHalle),
        defaultHourlyRatePadel: Number(defaultHourlyRatePadel),
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: "Club-Einstellungen und Buchungsregeln erfolgreich gespeichert!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Speichern fehlgeschlagen.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-border bg-card p-5">
      <h2 className="text-[22px] font-bold tracking-[-.02em]">Club-Regeln &amp; Tarife</h2>
      <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">
        Betriebszeiten, TC Marly Fairplay-Regeln, Doppel-Verlängerung und Gebühren.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
        {feedback && (
          <div
            role="status"
            className={`rounded-[18px] px-4 py-3 text-[15px] font-semibold ${
              feedback.type === "success" ? "bg-paid-bg text-paid-fg" : "bg-clay text-white"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={label}>Öffnung</span>
            <select id="openingHour" value={openingHour} onChange={(e) => setOpeningHour(Number(e.target.value))} className={input}>
              {[6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00 Uhr
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Schliessung</span>
            <select id="closingHour" value={closingHour} onChange={(e) => setClosingHour(Number(e.target.value))} className={input}>
              {[19, 20, 21, 22, 23, 24].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00 Uhr
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className={label}>Slot-Dauer (Einzel)</span>
            <select
              id="slotDurationMinutes"
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
              className={input}
            >
              <option value={45}>45 Minuten</option>
              <option value={60}>60 Minuten (1 Stunde)</option>
              <option value={90}>90 Minuten (1.5 Stunden)</option>
            </select>
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className={label}>Storno-Frist</span>
            <span className="flex items-center gap-2.5">
              <input
                id="cancellationDeadlineHours"
                type="number"
                min={0}
                max={72}
                value={cancellationDeadlineHours}
                onChange={(e) => setCancellationDeadlineHours(Number(e.target.value))}
                className={input}
              />
              <span className={`${unit} mt-1.5`}>Std.</span>
            </span>
          </label>
        </div>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Fairplay &amp; Rolling Release</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle
              on={marlyRuleEnabled}
              set={setMarlyRuleEnabled}
              title="Marly-Regel"
              sub="Keine Doppel-Stunden im Einzel, Rolling Release nach Spielende."
            />
            <Toggle
              on={allowConsecutiveSlotsForDoubles}
              set={setAllowConsecutiveSlotsForDoubles}
              title="2h Doppel erlauben"
              sub="2 Stunden am Stück, wenn 4 Spieler im Doppel antreten."
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className={label}>Nach Beginn buchbar</span>
              <span className="flex items-center gap-2.5">
                <input
                  id="lateBooking"
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  value={lateBookingMinutes}
                  onChange={(e) => setLateBookingMinutes(Number(e.target.value))}
                  className={wellInput}
                />
                <span className={`${unit} mt-1.5`}>Min.</span>
              </span>
            </label>
            <label className="block">
              <span className={label}>Cooldown Min.</span>
              <input
                id="cooldown"
                type="number"
                min={0}
                step={15}
                value={marlyCooldownMinutes}
                onChange={(e) => setMarlyCooldownMinutes(Number(e.target.value))}
                className={wellInput}
              />
            </label>
          </div>
        </div>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Aktive Buchungen pro Person</h3>
          <p className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
            Wie viele kommende Buchungen jemand gleichzeitig haben darf. Leer = unbegrenzt.
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] items-center gap-x-3 gap-y-2">
            <span />
            {SPORTS.map(([sp, l]) => (
              <span key={sp} className={label}>{l}</span>
            ))}
            {LIMIT_ROLES.map(([role, roleLabel]) => (
              <div key={role} className="contents">
                <span className="text-[15px] font-semibold">{roleLabel}</span>
                {SPORTS.map(([sp, l]) => (
                  <input
                    key={sp}
                    type="number"
                    min={0}
                    max={50}
                    placeholder="∞"
                    aria-label={`${roleLabel}, ${l}`}
                    value={limits[role][sp]}
                    onChange={(e) => setLimits({ ...limits, [role]: { ...limits[role], [sp]: e.target.value } })}
                    className={`${wellInput} mt-0`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Zahlarten</h3>
          <p className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
            Online (Karte, Twint, Apple/Google Pay) und Guthaben sind immer möglich.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle on={payOnSite} set={setPayOnSite} title="Vor Ort bezahlen" sub="Bar oder Karte im Club. Du markierst die Zahlung unter Heute." />
            <Toggle on={payByInvoice} set={setPayByInvoice} title="Auf Rechnung" sub="Nur für angemeldete Spieler." />
          </div>
        </div>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Preisregeln</h3>
          <p className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
            Auf- oder Abschlag auf den Platzpreis, z. B. -20 % am Vormittag oder +10 % Last Minute.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {priceRules.map((r, i) => (
              <div key={i} className="rounded-[18px] border border-border bg-card p-3">
                <div className="flex gap-2">
                  <input aria-label="Name der Regel" placeholder="Name, z. B. Vormittag" value={r.label} onChange={(e) => setRule(i, { label: e.target.value })} className={`${input} mt-0 flex-[2]`} />
                  <span className="flex flex-1 items-center gap-1.5">
                    <input aria-label="Prozent" type="number" min={-100} max={200} value={r.percent} onChange={(e) => setRule(i, { percent: Number(e.target.value) })} className={`${input} mt-0`} />
                    <span className={unit}>%</span>
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = r.weekdays?.includes(d) ?? false;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setRule(i, { weekdays: on ? r.weekdays!.filter((x) => x !== d) : [...(r.weekdays ?? []), d] })}
                        className={`h-9 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-inset"}`}
                      >
                        {WD[d]}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["fromHour", "Ab Uhr"],
                      ["toHour", "Bis Uhr"],
                      ["minLeadHours", "Mind. Std. vorher"],
                      ["maxLeadHours", "Max. Std. vorher"],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k} className="block">
                      <span className={label}>{l}</span>
                      <input type="number" min={0} value={r[k] ?? ""} onChange={(e) => setRule(i, { [k]: optNum(e.target.value) })} className={input} />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => setPriceRules(priceRules.filter((_, j) => j !== i))} className="mt-2 text-[14px] font-bold text-clay-text">
                  Regel entfernen
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPriceRules([...priceRules, { label: "", percent: -10 }])}
              className="h-12 rounded-[15px] border border-dashed border-border text-[15px] font-bold text-clay-text"
            >
              + Preisregel
            </button>
          </div>
        </div>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Gebühren &amp; Stundensätze (CHF)</h3>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {(
              [
                ["guestFee", "Gast / Spieler", guestFee, setGuestFee],
                ["ballMachineFee", "Ballmaschine", ballMachineFee, setBallMachineFee],
                ["floodlightFee", "Flutlicht", floodlightFee, setFloodlightFee],
                ["rateTennis", "Sand (Gast)", defaultHourlyRateTennis, setDefaultHourlyRateTennis],
                ["rateHalle", "Tennishalle / h", defaultHourlyRateHalle, setDefaultHourlyRateHalle],
                ["ratePadel", "Padel Court / h", defaultHourlyRatePadel, setDefaultHourlyRatePadel],
              ] as const
            ).map(([id, text, value, set]) => (
              <label key={id} className="block">
                <span className={label}>{text}</span>
                <input
                  id={id}
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  className={wellInput}
                />
              </label>
            ))}
          </div>
        </div>

        <Toggle
          on={allowGuestBookings}
          set={setAllowGuestBookings}
          title="Gastbuchungen erlauben"
          sub="Nicht registrierte Spieler dürfen freie Slots anfragen oder buchen."
        />

        <button
          type="submit"
          disabled={loading}
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-clay text-[17px] font-bold text-white active:scale-[.97] disabled:opacity-70"
        >
          {loading && <Spinner />}
          {loading ? "Wird gespeichert…" : "Einstellungen speichern"}
        </button>
      </form>
    </section>
  );
}
