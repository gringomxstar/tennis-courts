export interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ImportError {
  line: number;
  reason: string;
}

type Col = "firstName" | "lastName" | "name" | "email" | "phone";

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
};

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
  const head = splitLine(first, sep).map((c) => HEADERS[c.toLowerCase().replace(/[^a-z]/g, "")]);
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
    });
  });

  return { rows, errors };
}
