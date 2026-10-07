/**
 * Minimal .xlsx reader for the browser: first worksheet → tab separated text (for the import parsers).
 * Uses the native DecompressionStream and DOMParser, no library. Dates stay Excel serial numbers.
 * ponytail: first sheet only, no formulas evaluated (cached values are read); add a library if clubs need more.
 */
export async function xlsxToText(buf: ArrayBuffer): Promise<string> {
  const files = await unzip(buf, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheetName = Object.keys(files).filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => parseInt(a.slice(19)) - parseInt(b.slice(19)))[0];
  if (!sheetName) throw new Error("Keine Tabelle in der Datei gefunden.");
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const shared = files["xl/sharedStrings.xml"]
    ? [...xml(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent ?? "").join(""))
    : [];
  const rows: string[][] = [];
  for (const row of xml(files[sheetName]).getElementsByTagName("row")) {
    const cells: string[] = [];
    for (const c of row.getElementsByTagName("c")) {
      const ref = c.getAttribute("r") ?? "";
      const col = [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent).join("") : v;
      cells[col >= 0 ? col : cells.length] = val.replace(/[\t\r\n]+/g, " ").trim();
    }
    rows.push(Array.from(cells, (x) => x ?? ""));
  }
  return rows.map((r) => r.join("\t")).join("\n");
}

/** Reads the wanted entries of a zip (stored or deflated) via the central directory. */
async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Record<string, string>> {
  const dv = new DataView(buf);
  let eocd = buf.byteLength - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Keine gültige Excel-Datei (.xlsx).");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = new Uint8Array(buf, start, size);
    out[name] = method === 0 ? dec.decode(data) : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
