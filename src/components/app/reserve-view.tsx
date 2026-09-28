"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Segmented } from "@/components/app/segmented";
import { Spinner } from "@/components/app/avatar";
import { SwitchKnob } from "@/components/app/switch";
import { createBookingAction } from "@/app/actions/booking";
import { computeBookingCost, needsFloodlight } from "@/lib/pricing";
import { courtColor, courtLabel, hh, initials, longDate, slotState } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Booking, Court, CourtBlock, Tenant } from "@/types";
import { cn } from "@/lib/utils";

const GUEST = "__guest__";
const FAV_KEY = "tc-favorites";
const Star = ({ on }: { on: boolean }) => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill={on ? "#f59e0b" : "none"} stroke={on ? "#f59e0b" : "currentColor"} strokeWidth="2" strokeLinejoin="round" className={on ? "" : "text-muted-foreground"}>
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z" />
  </svg>
);

export function ReserveView({
  tenant,
  court,
  start,
  initialPlayers,
  members,
  partners,
  bookings,
  blocks,
  userId,
}: {
  tenant: Tenant;
  court: Court;
  start: string;
  initialPlayers: string[];
  members: Person[];
  partners: Person[];
  bookings: Booking[];
  blocks: CourtBlock[];
  userId: string;
}) {
  const router = useRouter();
  const startDate = new Date(start);
  const [rtype, setRtype] = useState<"single" | "double">(initialPlayers.length > 1 ? "double" : "single");
  const [dur, setDur] = useState<1 | 2>(1);
  const [players, setPlayers] = useState<string[]>(initialPlayers);
  const [ball, setBall] = useState(false);
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState(false);
  // ponytail: favorites live in localStorage (per device); move to DB when they must sync across devices
  const [favs, setFavs] = useState<string[]>(partners.slice(0, 3).map((p) => p.id));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAV_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once
      if (saved) setFavs(JSON.parse(saved));
    } catch {}
  }, []);
  const saveFavs = (next: string[]) => {
    setFavs(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
  };

  const others = members.filter((m) => m.id !== userId);
  const byId = new Map(others.map((m) => [m.id, m]));
  const nameOf = (id: string) => (id === GUEST ? "Gast" : byId.get(id)?.name ?? "");
  const max = rtype === "double" ? 3 : 1;
  const toggle = (id: string) => {
    if (players.includes(id)) return setPlayers(players.filter((x) => x !== id));
    if (players.length >= max) {
      toast(max === 1 ? "Einzel: 1 Mitspieler. Für mehr auf Doppel wechseln" : "Maximal 3 Mitspieler");
      return;
    }
    setPlayers([...players, id]);
  };
  const pickDur = (n: 1 | 2) => {
    const next = new Date(startDate.getTime() + 3_600_000);
    const closing = tenant.settingsJson?.closingHour ?? 22;
    if (n === 2 && !(next.getHours() < closing && slotState(court.id, next, 60, bookings, blocks, userId) === "free")) {
      toast("Folgestunde nicht frei");
      return;
    }
    setDur(n);
  };

  const guestOn = players.includes(GUEST);
  const light = needsFloodlight(court, startDate.getHours()) || (dur === 2 && needsFloodlight(court, startDate.getHours() + 1));
  const cost = computeBookingCost({
    settings: tenant.settingsJson,
    court,
    isGuest: false,
    durationMinutes: dur * 60,
    guestCount: guestOn ? 1 : 0,
    hasBallMachine: ball,
    hasLighting: light,
  });
  const color = courtColor(court);
  const l = courtLabel(court);
  const q = search.toLowerCase();

  async function confirm() {
    if (paying) return;
    setPaying(true);
    const res = await createBookingAction({
      clubSlug: tenant.slug,
      courtId: court.id,
      startsAt: startDate.toISOString(),
      durationMinutes: dur * 60,
      matchType: rtype === "double" ? "DOUBLE" : "SINGLE",
      participants: players.map((id) =>
        id === GUEST ? { type: "GUEST" as const, guestName: "Gast" } : { type: "MEMBER" as const, userId: id }
      ),
      hasBallMachine: ball,
      hasLighting: light,
    }).catch(() => ({ success: false as const, error: "Verbindung fehlgeschlagen. Bitte erneut versuchen." }));
    setPaying(false);
    if (!res.success) {
      toast(res.error ?? "Reservierung fehlgeschlagen");
      return;
    }
    toast(`Reserviert · ${l.name}, ${hh(startDate.getHours())}`);
    router.push(`/c/${tenant.slug}/bookings`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-background lg:left-64">
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col overflow-hidden lg:max-w-[1100px] lg:px-6">
        <div className="flex items-center gap-3 px-5 pb-2 pt-[60px] lg:pt-12">
          <button type="button" aria-label="Zurück" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h1 className="text-[30px] font-bold tracking-[-.035em]">Reservieren</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:content-start lg:items-start lg:gap-x-8">
          <div className="lg:col-start-1 lg:row-start-1">
          <div className="flex items-end justify-between rounded-[26px] px-5 py-[18px] text-white transition-[background] duration-[400ms]" style={{ background: color }}>
            <div>
              <div className="text-[14px] font-semibold">{longDate(startDate)}</div>
              <div className="text-[34px] font-bold leading-[1.1] tracking-[-.04em]">
                {hh(startDate.getHours())}
                {dur > 1 ? ` – ${hh(startDate.getHours() + dur)}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-bold">{l.name}</div>
              <div className="text-[14px]">{l.sub}</div>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <Segmented
              size="lg"
              className="flex-1"
              label="Spielform"
              value={rtype}
              onChange={(v) => { setRtype(v); setPlayers(players.slice(0, v === "double" ? 3 : 1)); }}
              options={[["single", "Einzel"], ["double", "Doppel"]] as const}
            />
            <Segmented size="lg" className="flex-1" label="Dauer" value={dur} onChange={pickDur} options={[[1, "1 Std"], [2, "2 Std"]] as const} />
          </div>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="mt-6 flex items-baseline justify-between lg:mt-0">
            <h2 className="text-[20px] font-bold tracking-[-.02em]">Mitspieler</h2>
            <div className="text-[14px] font-semibold text-muted-foreground">{players.length} von {max}</div>
          </div>
          {players.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {players.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`${nameOf(id)} entfernen`}
                  onClick={() => toggle(id)}
                  className="flex animate-[pop_.4s_var(--ease-spring)] items-center gap-2 rounded-full border border-border bg-card py-[5px] pl-[5px] pr-3"
                >
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#e25b36] text-[12px] font-bold text-white">
                    {id === GUEST ? "G" : initials(nameOf(id))}
                  </span>
                  <span className="text-[15px] font-semibold">{nameOf(id).split(" ")[0]}</span>
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-muted-foreground"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              ))}
            </div>
          )}

          {favs.some((id) => byId.has(id)) && (
            <>
              <div className="mt-[18px] flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z" /></svg>
                Favoriten
              </div>
              <div className="no-scrollbar mt-2.5 flex gap-3.5 overflow-x-auto pb-0.5 pt-1">
                {favs.filter((id) => byId.has(id)).map((id) => {
                  const on = players.includes(id);
                  return (
                    <button key={id} type="button" aria-pressed={on} aria-label={nameOf(id)} onClick={() => toggle(id)} className="flex flex-none flex-col items-center gap-1.5">
                      <span
                        className={cn("flex h-[58px] w-[58px] items-center justify-center rounded-full text-[18px] font-bold transition-all duration-[350ms] ease-spring", on ? "bg-clay text-white" : "bg-acc text-foreground")}
                        style={{ boxShadow: on ? "0 0 0 3px var(--background), 0 0 0 5px var(--tennis-clay)" : "none" }}
                      >
                        {initials(nameOf(id))}
                      </span>
                      <span className="text-[13px] font-semibold text-muted-foreground">{nameOf(id).split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <label className="mt-[18px] flex h-12 items-center gap-2.5 rounded-[15px] bg-inset px-3.5">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-muted-foreground"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <span className="sr-only">Mitglied suchen</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mitglied suchen" className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground" />
          </label>
          <div className="mt-2.5 overflow-hidden rounded-[22px] border border-border bg-card">
            {others.filter((m) => !q || m.name.toLowerCase().includes(q)).slice(0, 30).map((m) => {
              const on = players.includes(m.id);
              const fav = favs.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0">
                  <button type="button" aria-pressed={on} onClick={() => toggle(m.id)} className="flex flex-1 items-center gap-3 text-left">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-acc text-[13px] font-bold">{initials(m.name)}</span>
                    <span className="flex-1">
                      <span className="block text-[16px] font-semibold">{m.name}</span>
                      {m.plan && <span className="block text-[13px] text-muted-foreground">{m.plan}</span>}
                    </span>
                  </button>
                  <button type="button" aria-pressed={fav} aria-label={`${m.name} als Favorit`} onClick={() => saveFavs(fav ? favs.filter((x) => x !== m.id) : [...favs, m.id])} className="flex h-9 w-9 items-center justify-center">
                    <Star on={fav} />
                  </button>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => toggle(m.id)}
                    className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-all duration-[250ms] ease-spring", on ? "border-[#e25b36] bg-[#e25b36]" : "border-muted-foreground bg-transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: on ? 1 : 0 }}><path d="M20 6 9 17l-5-5" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={guestOn}
            onClick={() => toggle(GUEST)}
            className={cn("mt-2.5 flex w-full items-center justify-between rounded-[18px] px-4 py-3.5 text-[16px] font-semibold transition-[background] duration-300", guestOn ? "bg-[#e25b36] text-white" : "bg-inset text-foreground")}
          >
            <span>Gast hinzufügen</span>
            <span>CHF {tenant.settingsJson?.guestFee ?? 15}</span>
          </button>
          </div>

          <div className="lg:col-start-1 lg:row-start-2">

          {(tenant.settingsJson?.ballMachineAvailable ?? true) && (
            <>
              <h2 className="mt-6 text-[20px] font-bold tracking-[-.02em]">Extras</h2>
              <button type="button" aria-pressed={ball} onClick={() => setBall(!ball)} className="mt-2.5 flex w-full items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5 text-left">
                <span className="flex-1">
                  <span className="block text-[16px] font-semibold">Ballmaschine</span>
                  <span className="block text-[13px] text-muted-foreground">CHF {tenant.settingsJson?.ballMachineFee ?? 10}</span>
                </span>
                <SwitchKnob on={ball} />
              </button>
            </>
          )}
          </div>
        </div>
        <div className="border-t border-border bg-glass px-5 pb-10 pt-3 backdrop-blur-[24px] lg:flex lg:flex-col lg:items-end lg:pb-6">
          <div className="flex justify-between px-1 pb-2.5 lg:w-full lg:max-w-md text-[14px] font-semibold text-muted-foreground">
            <span>Total</span>
            <span className="text-[17px] font-bold text-foreground">{cost.total ? `CHF ${cost.total}` : "Inklusive"}</span>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={paying}
            className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[20px] text-[18px] font-bold text-white active:scale-[.97] lg:max-w-md"
            style={{ background: color, boxShadow: `0 14px 30px -10px ${color}` }}
          >
            {paying && <Spinner />}
            Reservieren
          </button>
        </div>
      </div>
    </div>
  );
}
