export interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** yyyy-mm-dd */
  birthDate?: string;
  gender?: "M" | "F" | "X";
  /** Abo name as in the club's plans; granted as paid (bank, Fairgate) */
  plan?: string;
}

export interface ImportError {
  line: number;
  reason: string;
}

type Col = "firstName" | "lastName" | "name" | "email" | "phone" | "birthDate" | "gender" | "plan";

const HEADERS: Record<string, Col> = {
  vorname: "firstName",
  firstname: "firstName",
  nachname: "lastName",
  familienname: "lastName",
  lastname: "lastName",
  name: "name",
  email: "email",
  mail: "email",
  emailadresse: "email",
  telefon: "phone",
  tel: "phone",
  telefonnummer: "phone",
  phone: "phone",
  mobile: "phone",
  mobil: "phone",
  handy: "phone",
  natel: "phone",
  // Fairgate contact export
  geburtsdatum: "birthDate",
  geburtstag: "birthDate",
  birthdate: "birthDate",
  dateofbirth: "birthDate",
  geschlecht: "gender",
  gender: "gender",
  anrede: "gender",
  abo: "plan",
  abonnement: "plan",
  tarif: "plan",
  plan: "plan",
  mitgliedschaft: "plan",
};

/** Exact alias first, then loose matches like "E-Mail (primär)" or "Telefon (Mobile)". */
function headerCol(cell: string): Col | undefined {
  const k = cell.toLowerCase().replace(/[^a-z]/g, "");
  return HEADERS[k] ?? (k.includes("mail") ? "email" : /telefon|mobil|natel/.test(k) ? "phone" : /^abo|tarif|mitgliedschaft/.test(k) ? "plan" : undefined);
}

/** 31.12.1990, 31.12.90, 1990-12-31 → "1990-12-31"; anything else undefined. */
export function parseDate(v: string): string | undefined {
  let y: number, m: number, d: number;
  const ch = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ch) [d, m, y] = [+ch[1], +ch[2], +ch[3]];
  else if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else return undefined;
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || y < 1900 || dt.getTime() > Date.now()) return undefined;
  return dt.toISOString().slice(0, 10);
}

/** m / männlich / Herr / male → M, w / weiblich / Frau / f → F, divers → X. */
export function parseGender(v: string): "M" | "F" | "X" | undefined {
  const k = v.toLowerCase().replace(/[^a-z]/g, "");
  if (/^(m|herr|male|mann)/.test(k)) return "M";
  if (/^(w|f|frau|weib)/.test(k)) return "F";
  if (/^(d|x|divers|other)/.test(k)) return "X";
  return undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits one line on `sep`, honouring "double quoted" fields with "" escapes. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"' && !cur.trim()) quoted = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Parses pasted Excel cells or a CSV into member rows. Line numbers are 1-based. */
export function parseMembers(text: string): { rows: ImportRow[]; errors: ImportError[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n|\r/);
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return { rows, errors };
  const first = lines[firstIdx];

  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const head = splitLine(first, sep).map(headerCol);
  // Fairgate: "Vorname" + "Name" means Name is the last name
  if (head.includes("firstName") && !head.includes("lastName")) head.forEach((c, j) => c === "name" && (head[j] = "lastName"));
  const isHeader = head.includes("email") || head.filter(Boolean).length >= 2;
  const cols: (Col | undefined)[] = isHeader ? head : ["firstName", "lastName", "email", "phone"];
  const seen = new Map<string, number>();

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || (isHeader && i === firstIdx)) return;
    const v: Partial<Record<Col, string>> = {};
    splitLine(raw, sep).forEach((cell, j) => {
      const col = cols[j];
      if (col && cell && !v[col]) v[col] = cell;
    });
    if (v.name && !v.firstName && !v.lastName) {
      const at = v.name.lastIndexOf(" ");
      v.firstName = at > 0 ? v.name.slice(0, at).trim() : v.name;
      v.lastName = at > 0 ? v.name.slice(at + 1) : "";
    }
    const email = (v.email ?? "").toLowerCase();
    if (!email) return void errors.push({ line, reason: "E-Mail fehlt" });
    if (!EMAIL.test(email)) return void errors.push({ line, reason: "E-Mail ungültig" });
    if (!v.firstName) return void errors.push({ line, reason: "Vorname fehlt" });
    const dup = seen.get(email);
    if (dup) return void errors.push({ line, reason: `E-Mail doppelt (Zeile ${dup})` });
    seen.set(email, line);
    rows.push({
      firstName: v.firstName.slice(0, 60),
      lastName: (v.lastName ?? "").slice(0, 60),
      email: email.slice(0, 200),
      ...(v.phone ? { phone: v.phone.slice(0, 30) } : {}),
      ...(v.birthDate && parseDate(v.birthDate) ? { birthDate: parseDate(v.birthDate) } : {}),
      ...(v.gender && parseGender(v.gender) ? { gender: parseGender(v.gender) } : {}),
      ...(v.plan ? { plan: v.plan.slice(0, 100) } : {}),
    });
  });

  return { rows, errors };
}
