/** ISO 13616 check (mod 97 = 1); expects spaces already removed and upper case. */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** "CH9300762011623852957" → "CH93 0076 2011 6238 5295 7" */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();
