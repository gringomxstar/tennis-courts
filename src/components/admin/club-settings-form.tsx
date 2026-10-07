"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LimitRole, PriceRule, SportType, TenantSettings } from "@/types";
import { LIMIT_ROLES, SPORTS, cancelDeadlineMinutes } from "@/lib/booking-rules";
import { WD } from "@/lib/courts";
import { DINER_DEFAULT } from "@/lib/pricing";
import { purgeDemoDataAction, updateClubSettingsAction } from "@/app/actions/club-settings";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";

const label = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";
const well = "rounded-[20px] bg-inset p-4";
const wellInput =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-card px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
const row = "flex w-full items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 text-left";
const unit = "shrink-0 text-[14px] font-semibold text-muted-foreground";

/** Two taps: "Demo-Daten löschen" → "Wirklich löschen?". */
function PurgeDemo({ clubSlug }: { clubSlug: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [msg, setMsg] = useState("");
  const run = async () => {
    if (step === "idle") return setStep("confirm");
    setStep("busy");
    const r = await purgeDemoDataAction(clubSlug);
    setMsg(r.success ? `Gelöscht: ${r.bookings} Buchungen, ${r.blocks} Sperren. Guthaben der Demo-Konten auf 0.` : r.error || "Fehler");
    setStep("idle");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={run}
        onBlur={() => step === "confirm" && setStep("idle")}
        disabled={step === "busy"}
        className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-inset text-[16px] font-bold text-clay-text disabled:opacity-70"
      >
        {step === "busy" && <Spinner />}
        {step === "confirm" ? "Wirklich alle Demo-Buchungen löschen?" : "Demo-Daten löschen"}
      </button>
      <p role="status" className="px-1 text-[13px] leading-[1.35] text-muted-foreground">
        {msg || "Löscht Buchungen, Sperren und Guthaben-Verlauf der Demo-Konten in diesem Club. Keine Rückzahlungen."}
      </p>
    </div>
  );
}

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
  initialAddress?: string | null;
  /** nur diesen Abschnitt zeigen; die übrigen Werte gehen unverändert mit */
  section?: SettingsSection;
}

export type SettingsSection = "oeffnung" | "regeln" | "preise" | "zahlungen" | "gaeste";

export function ClubSettingsForm({
  clubSlug,
  initialSettings,
  initialAddress,
  section,
}: ClubSettingsFormProps) {
  const show = (s: SettingsSection) => !section || section === s;
  const [address, setAddress] = useState(initialAddress ?? "");
  const [openingHour, setOpeningHour] = useState<number>(
    initialSettings?.openingHour ?? 7
  );
  const [closingHour, setClosingHour] = useState<number>(
    initialSettings?.closingHour ?? 22
  );
  const initialDeadline = cancelDeadlineMinutes(initialSettings);
  const [deadlineUnit, setDeadlineUnit] = useState<"min" | "h">(initialDeadline % 60 === 0 && initialDeadline > 0 ? "h" : "min");
  const [deadlineValue, setDeadlineValue] = useState<number | string>(initialDeadline % 60 === 0 && initialDeadline > 0 ? initialDeadline / 60 : initialDeadline);
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
  const [marlyCooldownMinutes, setMarlyCooldownMinutes] = useState<number | string>(
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
  const [lateBookingMinutes, setLateBookingMinutes] = useState<number | string>(initialSettings?.lateBookingMinutes ?? 15);
  const [payOnSite, setPayOnSite] = useState<boolean>(initialSettings?.payOnSite ?? false);
  const [payByInvoice, setPayByInvoice] = useState<boolean>(initialSettings?.payByInvoice ?? false);
  const [invoiceIban, setInvoiceIban] = useState(initialSettings?.invoiceIban ?? "");
  const [invoiceBank, setInvoiceBank] = useState(initialSettings?.invoiceBank ?? "");
  const [demoMode, setDemoMode] = useState<boolean>(initialSettings?.demoMode ?? false);
  const [priceRules, setPriceRules] = useState<PriceRule[]>(initialSettings?.priceRules ?? []);
  const setRule = (i: number, patch: Partial<PriceRule>) =>
    setPriceRules(priceRules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const [diner, setDiner] = useState(initialSettings?.dinerTennis ?? DINER_DEFAULT);
  const optNum = (v: string) => (v === "" ? undefined : Number(v));
  const [ballMachineFee, setBallMachineFee] = useState<number | string>(
    initialSettings?.ballMachineFee ?? 10
  );
  const [floodlightFee, setFloodlightFee] = useState<number | string>(
    initialSettings?.floodlightFee ?? 0
  );
  const [defaultHourlyRateTennis, setDefaultHourlyRateTennis] = useState<number | string>(
    initialSettings?.defaultHourlyRateTennis ?? 30
  );
  const [defaultHourlyRateHalle, setDefaultHourlyRateHalle] = useState<number | string>(
    initialSettings?.defaultHourlyRateHalle ?? 45
  );
  const [defaultHourlyRatePadel, setDefaultHourlyRatePadel] = useState<number | string>(
    initialSettings?.defaultHourlyRatePadel ?? 40
  );

  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<"clean" | "dirty" | "saved">("clean");
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
        cancellationDeadlineMinutes: Math.round(Number(deadlineValue) * (deadlineUnit === "h" ? 60 : 1)),
        allowGuestBookings,
        demoMode,
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
        invoiceIban,
        invoiceBank,
        priceRules,
        dinerTennis: diner,
        ballMachineFee: Number(ballMachineFee),
        floodlightFee: Number(floodlightFee),
        defaultHourlyRateTennis: Number(defaultHourlyRateTennis),
        defaultHourlyRateHalle: Number(defaultHourlyRateHalle),
        defaultHourlyRatePadel: Number(defaultHourlyRatePadel),
      }, address);

      toast(res.success ? "Einstellungen gespeichert" : res.error || "Speichern fehlgeschlagen.");
      if (res.success) {
        setState("saved");
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
    <section className="card p-5">
      <form
        onSubmit={handleSubmit}
        // any edit (inputs, or the toggle/chip buttons) marks the form as unsaved
        onChange={() => setState("dirty")}
        onClickCapture={(e) => (e.target as HTMLElement).closest("button[type=button]") && setState("dirty")}
        className="flex flex-col gap-5"
      >
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

        {show("oeffnung") && (
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
        </div>
        )}

        {show("regeln") && (
        <>
          <label className="block">
            <span className={label}>Gratis stornieren bis</span>
            <span className="flex items-center gap-2.5">
              <input
                id="cancellationDeadline"
                type="number"
                min={0}
                max={deadlineUnit === "h" ? 336 : 20160}
                value={deadlineValue}
                onChange={(e) => setDeadlineValue(e.target.value)}
                className={`${input} flex-1`}
              />
              <select
                aria-label="Einheit Storno-Frist"
                value={deadlineUnit}
                onChange={(e) => setDeadlineUnit(e.target.value as "min" | "h")}
                className="mt-1.5 h-[50px] w-[92px] shrink-0 rounded-[15px] border border-border bg-inset px-3 text-[16px] text-foreground outline-none focus-visible:border-clay"
              >
                <option value="min">Min.</option>
                <option value="h">Std.</option>
              </select>
              <span className="mt-1.5 shrink-0 text-[15px] text-muted-foreground">vor Beginn</span>
            </span>
          </label>

        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Fairplay</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle
              on={marlyRuleEnabled}
              set={setMarlyRuleEnabled}
              title="Einzel: keine Doppelstunde"
              sub="Wer Einzel spielt, kann erst nach Spielende wieder buchen."
            />
            <Toggle
              on={allowConsecutiveSlotsForDoubles}
              set={setAllowConsecutiveSlotsForDoubles}
              title="Doppel: 2 Stunden am Stück"
              sub="2 Stunden am Stück, wenn 4 Spieler im Doppel antreten."
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2">
            <label className="block">
              <span className={label}>Noch buchbar nach Beginn</span>
              <span className="flex items-center gap-2.5">
                <input
                  id="lateBooking"
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  value={lateBookingMinutes}
                  onChange={(e) => setLateBookingMinutes(e.target.value)}
                  className={wellInput}
                />
                <span className={`${unit} mt-1.5`}>Min.</span>
              </span>
            </label>
            <label className="block">
              <span className={label}>Wartezeit bis nächste Buchung</span>
              <span className="flex items-center gap-2.5">
                <input
                  id="cooldown"
                  type="number"
                  min={0}
                  step={15}
                  value={marlyCooldownMinutes}
                  onChange={(e) => setMarlyCooldownMinutes(e.target.value)}
                  className={wellInput}
                />
                <span className={`${unit} mt-1.5`}>Min.</span>
              </span>
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
        </>
        )}

        {show("zahlungen") && (
        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Zahlarten</h3>
          <p className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
            Online (Karte, Twint, Apple/Google Pay) und Guthaben sind immer möglich.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle on={payOnSite} set={setPayOnSite} title="Vor Ort bezahlen" sub="Bar oder Karte im Club. Du markierst die Zahlung unter Heute." />
            <Toggle on={payByInvoice} set={setPayByInvoice} title="Auf Rechnung" sub="Spieler mit Konto dürfen auf Rechnung bezahlen." />
            <div id="rechnungsdaten" className="mt-1 flex scroll-mt-24 flex-col gap-2">
              <p className="text-[13px] leading-[1.35] text-muted-foreground">Für den QR-Einzahlungsschein auf Rechnungen an Mitglieder und Sponsoren.</p>
              <div className="grid grid-cols-1 gap-2 @min-[640px]:grid-cols-2">
                <label className="block">
                  <span className={label}>IBAN</span>
                  <input value={invoiceIban} onChange={(e) => setInvoiceIban(e.target.value)} placeholder="CH.." autoComplete="off" className={wellInput} />
                </label>
                <label className="block">
                  <span className={label}>Bank</span>
                  <input value={invoiceBank} onChange={(e) => setInvoiceBank(e.target.value)} autoComplete="off" className={wellInput} />
                </label>
              </div>
              <label className="block">
                <span className={label}>Clubadresse</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Strasse Nr, PLZ Ort" autoComplete="street-address" className={wellInput} />
              </label>
            </div>
          </div>
        </div>

        )}

        {show("preise") && (
        <>
        <div className={well}>
          <h3 className="text-[17px] font-bold tracking-[-.01em]">Preisregeln</h3>
          <p className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
            Rabatt oder Zuschlag auf den Platzpreis, z. B. 20 % Rabatt am Vormittag. Leere Felder und keine Wochentage gewählt = gilt immer.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {priceRules.map((r, i) => (
              <div key={i} className="rounded-[18px] border border-border bg-card p-3">
                <div className="flex gap-2">
                  <input aria-label="Name der Regel" placeholder="Name, z. B. Vormittag" value={r.label} onChange={(e) => setRule(i, { label: e.target.value })} className={`${input} mt-0 flex-[2]`} />
                  <span className="flex flex-1 items-center gap-1.5">
                    <input aria-label="Prozent" type="number" min={0} max={200} value={Math.abs(r.percent)} onChange={(e) => setRule(i, { percent: (r.percent < 0 ? -1 : 1) * Number(e.target.value) })} className={`${input} mt-0`} />
                    <span className={unit}>%</span>
                  </span>
                </div>
                <div className="mt-2 flex gap-1 rounded-full bg-inset p-1">
                  {([["Rabatt", -1], ["Zuschlag", 1]] as const).map(([l, sign]) => {
                    const on = (r.percent < 0 ? -1 : 1) === sign;
                    return (
                      <button key={l} type="button" aria-pressed={on} onClick={() => setRule(i, { percent: sign * Math.abs(r.percent) })} className={`h-9 flex-1 rounded-full text-[14px] font-bold ${on ? "bg-card shadow-card" : "text-muted-foreground"}`}>
                        {l}
                      </button>
                    );
                  })}
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
                <div className="mt-2 grid grid-cols-2 gap-2 @min-[640px]:grid-cols-4">
                  {(
                    [
                      ["fromHour", "Ab Uhr"],
                      ["toHour", "Bis Uhr"],
                      ["minLeadHours", "Mind. Std. im Voraus gebucht"],
                      ["maxLeadHours", "Höchstens Std. im Voraus (Last Minute)"],
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
          <div className="mt-3 grid grid-cols-2 gap-4 @min-[640px]:grid-cols-3">
            {(
              [
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
                  onChange={(e) => set(e.target.value)}
                  className={wellInput}
                />
              </label>
            ))}
          </div>
        </div>

        </>
        )}

        {show("gaeste") && (
        <>
        <div className={well}>
          <Toggle
            on={diner.enabled}
            set={(enabled) => setDiner({ ...diner, enabled })}
            title="Diner Tennis"
            sub="Mitglieder mit Abo nehmen in diesem Zeitfenster 1 Gast gratis mit, wenn sie danach zusammen im Club essen."
          />
          {diner.enabled && (
            <>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = diner.weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDiner({ ...diner, weekdays: on ? diner.weekdays.filter((x) => x !== d) : [...diner.weekdays, d] })}
                      className={`h-9 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-card"}`}
                    >
                      {WD[d]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                {(
                  [
                    ["fromHour", "Von Uhr"],
                    ["toHour", "Bis Uhr"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="block">
                    <span className={label}>{l}</span>
                    <input type="number" min={0} max={24} value={diner[k]} onChange={(e) => setDiner({ ...diner, [k]: Number(e.target.value) })} className={wellInput} />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <Toggle
          on={allowGuestBookings}
          set={setAllowGuestBookings}
          title="Gastbuchungen erlauben"
          sub="Nicht registrierte Spieler dürfen freie Slots anfragen oder buchen."
        />

        <Toggle
          on={demoMode}
          set={setDemoMode}
          title="Demo-Modus"
          sub="Rollen-Umschalter für Tests. Vor dem Livegang ausschalten."
        />
        </>
        )}

        {/* stays in view above the floating tab bar while scrolling through the long form */}
        <div className="sticky bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-10 flex flex-col gap-1.5 @min-[640px]:bottom-4">
          {state !== "clean" && (
            <span role="status" className={`self-center rounded-full bg-card px-3 py-1 text-[13px] font-semibold shadow-card ${state === "dirty" ? "text-warn" : "text-ok"}`}>
              {state === "dirty" ? "Nicht gespeicherte Änderungen" : "Gespeichert ✓"}
            </span>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn !h-[50px] w-full !bg-ink text-white shadow-lift disabled:opacity-70"
          >
            {loading && <Spinner />}
            {loading ? "Wird gespeichert…" : "Speichern"}
          </button>
        </div>
      </form>

      {/* destructive, so apart from Save */}
      {show("gaeste") && <div className="mt-8 border-t border-border pt-5">
        <div className="pb-2 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Demo</div>
        <PurgeDemo clubSlug={clubSlug} />
      </div>}
    </section>
  );
}
