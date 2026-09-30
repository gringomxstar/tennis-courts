import { prisma } from "@/lib/prisma";

/** Club statistics for the admin (Kasse, Auslastung, GV, Pflege, Junioren). Postgres only. */

const TZ = "Europe/Zurich";
const DAY = 86_400_000;
export const METHODS = ["WALLET", "ONLINE", "ON_SITE", "INVOICE"] as const;
export const METHOD_LABEL: Record<(typeof METHODS)[number], string> = {
  WALLET: "Guthaben",
  ONLINE: "Online (Karte/Twint)",
  ON_SITE: "Vor Ort",
  INVOICE: "Rechnung",
};
export const TYPE_LABEL: Record<string, string> = {
  MEMBER: "Mitglieder",
  GUEST: "Gäste",
  COACH: "Training",
  COURSE: "Kurs",
  TOURNAMENT: "Turnier",
  ADMIN: "Admin",
  MAINTENANCE: "Wartung",
  EVENT: "Anlass",
};
export const REASON_LABEL: Record<string, string> = {
  RAIN: "Regen", MAINTENANCE: "Wartung", TOURNAMENT: "Turnier", SNOW: "Schnee", TRAINING: "Training",
  EVENT: "Anlass", PRIVATE: "Privat", OTHER: "Andere",
};
/** Age classes (age reached in the year, Swiss Tennis style). */
export const AGE_CLASSES = ["U10", "U12", "U14", "U16", "U18", "19–29", "30+", "45+", "55+", "65+", "unbekannt"] as const;
const PLAYED = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW"]);

const partsFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23", weekday: "short" });
const WDS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Club-local year, month (1–12), weekday (0 = Monday), hour, yyyy-mm-dd. */
export function local(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  const [y, m, day] = [Number(p.year), Number(p.month), Number(p.day)];
  return { y, m, wd: WDS.indexOf(p.weekday), h: Number(p.hour), date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

/** Age class by birth year; `year` is the reference year. */
export function ageClass(birthDate: Date | null | undefined, year: number): (typeof AGE_CLASSES)[number] {
  if (!birthDate) return "unbekannt";
  const age = year - birthDate.getUTCFullYear();
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 19) return "U18";
  if (age < 30) return "19–29";
  if (age < 45) return "30+";
  if (age < 55) return "45+";
  if (age < 65) return "55+";
  return "65+";
}
export const isJunior = (b: Date | null | undefined, year: number) => Boolean(b) && year - b!.getUTCFullYear() < 19;

const hours = (b: { startsAt: Date; endsAt: Date }) => (b.endsAt.getTime() - b.startsAt.getTime()) / 3_600_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

export async function loadStats(tenantId: string, year: number, openHour: number, closeHour: number) {
  const now = new Date();
  const yStart = new Date(Date.UTC(year, 0, 1) - 2 * 3_600_000); // Zurich is UTC+1/+2; filtered by local() below
  const from = new Date(Math.min(Date.UTC(year - 1, 0, 1) - 2 * 3_600_000, now.getTime() - 400 * DAY));
  const to = new Date(Math.max(Date.UTC(year + 1, 0, 1), now.getTime() + 31 * DAY));

  const [bookings, memberships, tenantUsers, courts, blocks, wallets, txs] = await Promise.all([
    prisma.booking.findMany({
      where: { tenantId, startsAt: { gte: from, lt: to } },
      select: {
        id: true, courtId: true, organizerId: true, startsAt: true, endsAt: true, status: true, bookingType: true,
        paymentStatus: true, paymentMethod: true, totalCost: true, hasLighting: true, cancelledAt: true, refundedAt: true, createdAt: true, updatedAt: true,
        organizer: { select: { firstName: true, lastName: true, email: true, birthDate: true } },
        court: { select: { name: true, sportType: true } },
        participants: { select: { userId: true, role: true, guestName: true, user: { select: { birthDate: true } } } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { tenantId },
      select: {
        id: true, userId: true, startsAt: true, endsAt: true, status: true, pricePaid: true, paidAt: true, createdAt: true,
        plan: { select: { name: true, price: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.tenantUser.findMany({
      where: { tenantId, role: { not: "PLATFORM_ADMIN" } },
      select: { role: true, user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, birthDate: true, gender: true } } },
    }),
    prisma.court.findMany({ where: { tenantId, status: "ACTIVE" }, select: { id: true, name: true, sportType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.courtBlock.findMany({ where: { tenantId, startsAt: { gte: yStart, lt: to } }, select: { courtId: true, startsAt: true, endsAt: true, reason: true } }),
    prisma.userWallet.findMany({ where: { tenantId }, select: { balance: true } }),
    prisma.walletTransaction.findMany({
      where: { wallet: { tenantId }, createdAt: { gte: yStart, lt: to } },
      select: { amount: true, type: true, createdAt: true, description: true, wallet: { select: { user: { select: { firstName: true, lastName: true, email: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const inYear = (d: Date, y = year) => local(d).y === y;
  const yb = bookings.filter((b) => inYear(b.startsAt));
  // only what has started: a confirmed booking next week is not played yet
  const played = (y: number) => bookings.filter((b) => PLAYED.has(b.status) && b.startsAt <= new Date() && inYear(b.startsAt, y));
  const playedY = played(year);
  // Kasse = cash principle (OR 957 Abs. 2, small clubs): revenue counts when the money comes in, not when the game is played.
  // Wallet/online are paid at booking; on-site/invoice when the admin marks them paid (last update).
  // ponytail: no Booking.paidAt column; add one if a paid booking can be edited later and the date matters
  const paidOn = (b: (typeof bookings)[number]) => (b.paymentMethod === "WALLET" || b.paymentMethod === "ONLINE" ? b.createdAt : b.updatedAt);
  const paidIn = (y: number) => bookings.filter((b) => b.paymentStatus === "PAID" && b.status !== "CANCELLED" && Number(b.totalCost) > 0 && inYear(paidOn(b), y));
  const roleOf = new Map(tenantUsers.map((t) => [t.user.id, t.role]));

  // ---- 1. Kasse ----------------------------------------------------------
  const months = Array.from({ length: 12 }, (_, i) => ({
    m: i + 1,
    byMethod: Object.fromEntries(METHODS.map((k) => [k, 0])) as Record<(typeof METHODS)[number], number>,
    abos: 0,
    topUps: 0,
  }));
  const byType: Record<string, number> = {};
  let open = 0, waived = 0;
  for (const b of paidIn(year)) {
    const amt = Number(b.totalCost);
    if (b.paymentMethod) months[local(paidOn(b)).m - 1].byMethod[b.paymentMethod] += amt;
    byType[b.bookingType] = (byType[b.bookingType] ?? 0) + amt;
  }
  for (const b of playedY) {
    const amt = Number(b.totalCost);
    if (b.paymentStatus === "UNPAID") open += amt;
    else if (b.paymentStatus === "WAIVED") waived += amt;
  }
  // memberships without the price snapshot (before it existed) fall back to the plan price
  const paidMemberships = memberships.filter((m) => m.status === "ACTIVE" || m.status === "EXPIRED");
  const aboAmount = (m: (typeof memberships)[number]) => Number(m.pricePaid ?? m.plan.price);
  const aboDate = (m: (typeof memberships)[number]) => m.paidAt ?? m.createdAt;
  for (const m of paidMemberships) if (inYear(aboDate(m))) months[local(aboDate(m)).m - 1].abos += aboAmount(m);
  const wallet = { topUps: 0, used: 0, refunds: 0, grants: 0, liability: r2(wallets.reduce((s, w) => s + Number(w.balance), 0)) };
  for (const t of txs) {
    if (!inYear(t.createdAt)) continue;
    const a = Number(t.amount);
    if (t.type === "TOP_UP") {
      wallet.topUps += a;
      months[local(t.createdAt).m - 1].topUps += a;
    } else if (t.type === "BOOKING_PAYMENT") wallet.used += -a;
    else if (t.type === "REFUND") wallet.refunds += a;
    else wallet.grants += a;
  }
  const kasse = {
    months: months.map((x) => ({
      ...x,
      byMethod: Object.fromEntries(METHODS.map((k) => [k, r2(x.byMethod[k])])) as Record<(typeof METHODS)[number], number>,
      abos: r2(x.abos),
      topUps: r2(x.topUps),
    })),
    byType: Object.entries(byType).map(([k, v]) => [TYPE_LABEL[k] ?? k, r2(v)] as const).sort((a, b) => b[1] - a[1]),
    open: r2(open),
    waived: r2(waived),
    wallet: { ...wallet, topUps: r2(wallet.topUps), used: r2(wallet.used), refunds: r2(wallet.refunds), grants: r2(wallet.grants) },
  };

  // ---- 2. Auslastung -----------------------------------------------------
  // ponytail: the denominator is the days between the first and last booking of the year, so a
  // winter break doesn't dilute the rate; real per-court seasons would need opening dates per court.
  const dates = playedY.map((b) => local(b.startsAt).date).sort();
  const first = dates[0], last = dates[dates.length - 1];
  const activeDays = first ? Math.round((Date.parse(last) - Date.parse(first)) / DAY) + 1 : 0;
  const perWd = Array(7).fill(0) as number[]; // how often each weekday occurs in that span
  for (let i = 0; i < activeDays; i++) perWd[(new Date(Date.parse(first) + i * DAY).getUTCDay() + 6) % 7]++;
  const slotHours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i);
  const heat = Array.from({ length: 7 }, () => slotHours.map(() => 0));
  const perCourt = new Map(courts.map((c) => [c.id, { name: c.name, sport: c.sportType, hours: 0, light: 0 }]));
  const bySport: Record<string, number> = {};
  for (const b of playedY) {
    const h = hours(b);
    const c = perCourt.get(b.courtId);
    if (c) {
      c.hours += h;
      if (b.hasLighting) c.light += h;
    }
    bySport[b.court.sportType] = (bySport[b.court.sportType] ?? 0) + h;
    // count every started hour the booking covers
    for (let t = b.startsAt.getTime(); t < b.endsAt.getTime(); t += 3_600_000) {
      const l = local(new Date(t));
      const i = slotHours.indexOf(l.h);
      if (i >= 0) heat[l.wd][i] += 1;
    }
  }
  const blockedByReason: Record<string, number> = {};
  for (const bl of blocks) {
    if (!inYear(bl.startsAt)) continue;
    blockedByReason[bl.reason] = (blockedByReason[bl.reason] ?? 0) + hours(bl);
  }
  const capacity = activeDays * slotHours.length;
  const auslastung = {
    first, last, activeDays, slotHours,
    heat: heat.map((row, wd) => row.map((n) => (perWd[wd] && courts.length ? n / (perWd[wd] * courts.length) : 0))),
    courts: [...perCourt.values()].map((c) => ({ ...c, hours: r2(c.hours), light: r2(c.light), rate: capacity ? c.hours / capacity : 0 })),
    bySport: Object.entries(bySport).map(([k, v]) => [k === "PADEL" ? "Padel" : "Tennis", r2(v)] as const),
    blocked: Object.entries(blockedByReason).map(([k, v]) => [REASON_LABEL[k] ?? k, r2(v)] as const).sort((a, b) => b[1] - a[1]),
    lightHours: r2(playedY.filter((b) => b.hasLighting).reduce((s, b) => s + hours(b), 0)),
  };

  // ---- 3. GV-Bericht -----------------------------------------------------
  const cutOf = (y: number) => (y === local(now).y ? now : new Date(Date.UTC(y, 11, 31, 12)));
  const holders = (y: number) => {
    const cut = cutOf(y);
    const out = new Map<string, string>(); // userId → plan name
    for (const m of paidMemberships) if (m.startsAt <= cut && (!m.endsAt || m.endsAt >= cut)) out.set(m.userId, m.plan.name);
    return out;
  };
  const now_ = holders(year), prev = holders(year - 1);
  const planCounts: Record<string, number> = {};
  for (const p of now_.values()) planCounts[p] = (planCounts[p] ?? 0) + 1;
  const yearFigures = (y: number) => {
    const p = played(y);
    return {
      bookings: p.length,
      hours: r2(p.reduce((s, b) => s + hours(b), 0)),
      guests: p.reduce((s, b) => s + b.participants.filter((x) => x.role === "GUEST").length + (b.bookingType === "GUEST" ? 1 : 0), 0),
      // Guthaben-Buchungen are not counted: that money came in with the top-up
      bookingRevenue: r2(paidIn(y).filter((b) => b.paymentMethod !== "WALLET").reduce((s, b) => s + Number(b.totalCost), 0)),
      aboRevenue: r2(paidMemberships.filter((m) => inYear(aboDate(m), y)).reduce((s, m) => s + aboAmount(m), 0)),
    };
  };
  const gv = {
    cut: cutOf(year),
    members: now_.size,
    membersPrev: prev.size,
    joined: [...now_.keys()].filter((id) => !prev.has(id)).length,
    left: [...prev.keys()].filter((id) => !now_.has(id)).length,
    plans: Object.entries(planCounts).sort((a, b) => b[1] - a[1]),
    cur: yearFigures(year),
    prev: yearFigures(year - 1),
  };

  // ---- 4. Mitgliederpflege ------------------------------------------------
  const lastPlayed = new Map<string, Date>();
  const hoursBy = new Map<string, number>();
  for (const b of bookings) {
    if (!PLAYED.has(b.status) || b.startsAt > now) continue;
    const ids = new Set([b.organizerId, ...b.participants.map((p) => p.userId).filter((x): x is string => Boolean(x))]);
    for (const id of ids) {
      if (!lastPlayed.has(id) || lastPlayed.get(id)! < b.startsAt) lastPlayed.set(id, b.startsAt);
      if (inYear(b.startsAt)) hoursBy.set(id, (hoursBy.get(id) ?? 0) + hours(b));
    }
  }
  const current = holders(local(now).y);
  const users = new Map(tenantUsers.map((t) => [t.user.id, t.user]));
  const inactive = [...current.keys()]
    .map((id) => ({ id, user: users.get(id), last: lastPlayed.get(id) ?? null }))
    .filter((x) => x.user && (!x.last || now.getTime() - x.last.getTime() > 60 * DAY))
    .map((x) => ({ name: name(x.user!), email: x.user!.email, last: x.last }))
    .sort((a, b) => (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));
  const expiring = paidMemberships
    .filter((m) => m.status === "ACTIVE" && m.endsAt && m.endsAt > now && m.endsAt.getTime() - now.getTime() < 30 * DAY)
    // skip anyone who already renewed
    .filter((m) => !paidMemberships.some((o) => o.userId === m.userId && o.startsAt > m.endsAt!))
    .map((m) => ({ name: name(m.user), email: m.user.email, plan: m.plan.name, endsAt: m.endsAt! }));
  const top = [...hoursBy.entries()]
    .filter(([id]) => users.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, h]) => ({ name: name(users.get(id)!), hours: r2(h) }));
  const cancelled = yb.filter((b) => b.status === "CANCELLED").length;
  const noShows = new Map<string, number>();
  for (const b of playedY) if (b.status === "NO_SHOW") noShows.set(b.organizerId, (noShows.get(b.organizerId) ?? 0) + 1);
  // guest → member: first played as a guest (booking or participant slot), membership starts later in the year
  const firstGuest = new Map<string, Date>();
  for (const b of bookings) if (b.bookingType === "GUEST" && !firstGuest.has(b.organizerId)) firstGuest.set(b.organizerId, b.startsAt);
  const converted = [...firstGuest.entries()].filter(([id, d]) =>
    paidMemberships.some((m) => m.userId === id && m.startsAt > d && inYear(m.startsAt))
  ).length;
  const pflege = {
    inactive,
    expiring,
    top,
    cancelRate: yb.length ? cancelled / (cancelled + playedY.length || 1) : 0,
    cancelled,
    noShows: [...noShows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ name: users.get(id) ? name(users.get(id)!) : "Gast", n })),
    guestsTotal: [...firstGuest.values()].filter((d) => inYear(d)).length,
    converted,
  };

  // ---- 5. Junioren & Altersstruktur ---------------------------------------
  const members = tenantUsers.filter((t) => t.role !== "GUEST");
  const ages = AGE_CLASSES.map((c) => ({ cls: c, M: 0, F: 0, X: 0, "?": 0 }));
  for (const t of members) {
    const row = ages[AGE_CLASSES.indexOf(ageClass(t.user.birthDate, year))];
    const g = t.user.gender === "M" || t.user.gender === "F" || t.user.gender === "X" ? t.user.gender : "?";
    row[g]++;
  }
  let juniorHours = 0, coachHours = 0;
  for (const b of playedY) {
    const h = hours(b);
    if (isJunior(b.organizer.birthDate, year) || b.participants.some((p) => isJunior(p.user?.birthDate, year))) juniorHours += h;
    if (b.bookingType === "COACH" || roleOf.get(b.organizerId) === "COACH" || b.participants.some((p) => p.role === "COACH")) coachHours += h;
  }
  const junioren = {
    ages,
    withBirthDate: members.filter((t) => t.user.birthDate).length,
    total: members.length,
    juniors: members.filter((t) => isJunior(t.user.birthDate, year)).length,
    juniorHours: r2(juniorHours),
    coachHours: r2(coachHours),
  };

  return { year, kasse, auslastung, gv, pflege, junioren, raw: { yb, txs: txs.filter((t) => inYear(t.createdAt)), tenantUsers, current, lastPlayed, paidMemberships, aboAmount, aboDate } };
}

export type Stats = Awaited<ReturnType<typeof loadStats>>;

// ---- CSV (Swiss Excel / Banana / Bexio: ";" + UTF-8 BOM + dd.mm.yyyy) ----

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // also neutralises formula injection (=, +, -, @ at the start)
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
export const chDate = (d: Date | null | undefined) => {
  if (!d) return "";
  const l = local(d);
  return `${l.date.slice(8, 10)}.${l.date.slice(5, 7)}.${l.date.slice(0, 4)}`;
};
const chTime = (d: Date) => d.toLocaleTimeString("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const STATUS_LABEL: Record<string, string> = { CONFIRMED: "bestätigt", COMPLETED: "gespielt", NO_SHOW: "nicht erschienen", CANCELLED: "storniert", PENDING: "offen", EXPIRED: "abgelaufen" };
const PAY_LABEL: Record<string, string> = { PAID: "bezahlt", UNPAID: "offen", WAIVED: "erlassen" };

export const EXPORTS = {
  buchungen: "Buchungen",
  kasse: "Kassenjournal (Monate)",
  abos: "Abo-Zahlungen",
  wallet: "Guthaben-Bewegungen",
  mitglieder: "Mitgliederliste",
} as const;
export type ExportType = keyof typeof EXPORTS;

export function exportRows(s: Stats, type: ExportType): unknown[][] {
  if (type === "buchungen") {
    return [
      ["Datum", "Von", "Bis", "Platz", "Organisator", "E-Mail", "Art", "Status", "Zahlart", "Zahlung", "Betrag CHF", "Flutlicht", "Mitspieler", "Gäste"],
      ...s.raw.yb.flatMap((b) => [[
        chDate(b.startsAt), chTime(b.startsAt), chTime(b.endsAt), b.court.name, name(b.organizer), b.organizer.email,
        TYPE_LABEL[b.bookingType] ?? b.bookingType, STATUS_LABEL[b.status] ?? b.status,
        b.paymentMethod ? METHOD_LABEL[b.paymentMethod] : "", PAY_LABEL[b.paymentStatus] ?? b.paymentStatus,
        Number(b.totalCost).toFixed(2), b.hasLighting ? "ja" : "nein",
        b.participants.filter((p) => p.role !== "ORGANIZER" && p.role !== "GUEST").length,
        b.participants.filter((p) => p.role === "GUEST").map((p) => p.guestName).join(", "),
      ],
        // Stripe refunds are always full (refundStripeBooking, dated by refundedAt): reverse them so the export nets to 0
        ...(b.refundedAt && b.paymentMethod === "ONLINE" && b.paymentStatus === "PAID" && Number(b.totalCost) > 0
          ? [[chDate(b.refundedAt), "", "", b.court.name, name(b.organizer), b.organizer.email, TYPE_LABEL[b.bookingType] ?? b.bookingType,
              "Storno-Rückerstattung", METHOD_LABEL.ONLINE, "zurückerstattet", (-Number(b.totalCost)).toFixed(2), "", "", ""]]
          : []),
      ]),
    ];
  }
  if (type === "kasse") {
    return [
      ["Monat", ...METHODS.map((m) => METHOD_LABEL[m]), "Abos", "Guthaben-Aufladungen", "Total Einnahmen (ohne Guthaben-Nutzung)"],
      ...s.kasse.months.map((m) => [
        `${String(m.m).padStart(2, "0")}.${s.year}`, ...METHODS.map((k) => m.byMethod[k].toFixed(2)), m.abos.toFixed(2), m.topUps.toFixed(2),
        (m.byMethod.ONLINE + m.byMethod.ON_SITE + m.byMethod.INVOICE + m.abos + m.topUps).toFixed(2),
      ]),
      [],
      ["Offene Posten", s.kasse.open.toFixed(2)],
      ["Erlassen", s.kasse.waived.toFixed(2)],
      ["Guthaben-Saldo aller Mitglieder (Verbindlichkeit, heute)", s.kasse.wallet.liability.toFixed(2)],
    ];
  }
  if (type === "abos") {
    return [
      ["Bezahlt am", "Name", "E-Mail", "Abo", "Gültig von", "Gültig bis", "Betrag CHF", "Referenz"],
      ...s.raw.paidMemberships.filter((m) => chDate(s.raw.aboDate(m)).endsWith(String(s.year))).map((m) => [
        chDate(s.raw.aboDate(m)), name(m.user), m.user.email, m.plan.name, chDate(m.startsAt), chDate(m.endsAt),
        s.raw.aboAmount(m).toFixed(2), m.id,
      ]),
    ];
  }
  if (type === "wallet") {
    const T: Record<string, string> = { TOP_UP: "Aufladung", BOOKING_PAYMENT: "Buchung", REFUND: "Rückerstattung", ADMIN_GRANT: "Gutschrift Admin" };
    return [
      ["Datum", "Mitglied", "E-Mail", "Art", "Betrag CHF", "Beschreibung"],
      ...s.raw.txs.map((t) => [chDate(t.createdAt), name(t.wallet.user), t.wallet.user.email, T[t.type] ?? t.type, Number(t.amount).toFixed(2), t.description]),
    ];
  }
  const G: Record<string, string> = { M: "m", F: "w", X: "d" };
  return [
    ["Vorname", "Nachname", "E-Mail", "Telefon", "Geburtsdatum", "Geschlecht", "Altersklasse", "Rolle", "Abo aktuell", "Letztes Spiel"],
    ...s.raw.tenantUsers.map((t) => [
      t.user.firstName, t.user.lastName, t.user.email, t.user.phone ?? "",
      t.user.birthDate ? chDate(new Date(t.user.birthDate.getTime() + 12 * 3_600_000)) : "", G[t.user.gender ?? ""] ?? "",
      ageClass(t.user.birthDate, s.year), t.role, s.raw.current.get(t.user.id) ?? "", chDate(s.raw.lastPlayed.get(t.user.id)),
    ]),
  ];
}
