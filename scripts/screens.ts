/**
 * Screenshot every app route as guest, member and admin at phone + desktop width, light + dark.
 * Read-only: navigates and logs in, never books or edits.
 *
 *   SHOT_MEMBER=mail:pass SHOT_ADMIN=mail:pass npx tsx scripts/screens.ts [label]
 *
 * SHOT_BASE (default http://localhost:3000), SHOT_SLUG (default tc-marly).
 * Output: .screens/<label>/<role>-<route>-<width>-<theme>.jpg (viewport only, jpeg q70).
 */
import { chromium, type BrowserContext } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.SHOT_BASE ?? "http://localhost:3000";
const slug = process.env.SHOT_SLUG ?? "tc-marly";
const label = process.argv[2] ?? "before";
const out = `.screens/${label}`;
mkdirSync(out, { recursive: true });

const c = `/c/${slug}`;
const roles: Record<string, { creds?: string; routes: string[] }> = {
  guest: { routes: [c, `${c}/calendar`, `${c}/abos`, `${c}/profile`, "/login"] },
  member: { creds: process.env.SHOT_MEMBER, routes: [c, `${c}/calendar`, `${c}/bookings`, `${c}/profile`, `${c}/abos`] },
  admin: {
    creds: process.env.SHOT_ADMIN,
    routes: [`${c}/admin`, `${c}/admin/calendar`, `${c}/admin/blocks`, `${c}/admin/members`, `${c}/admin/settings`, `${c}/admin/stats`, `${c}/admin/profile`],
  },
};
const sizes = [
  [390, 844],
  [1440, 900],
] as const;

async function login(ctx: BrowserContext, creds: string) {
  const [email, password] = creds.split(":");
  const p = await ctx.newPage();
  await p.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 90_000 });
  await p.fill("#email", email);
  await p.fill("#password", password);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }), p.click("form button")]);
  await p.close();
}

async function main() {
const browser = await chromium.launch();
let n = 0;
for (const [role, { creds, routes }] of Object.entries(roles)) {
  if (role !== "guest" && !creds) {
    console.log(`skip ${role}: no SHOT_${role.toUpperCase()}`);
    continue;
  }
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    if (creds) await login(ctx, creds);
    for (const theme of ["light", "dark"]) {
      const page = await ctx.newPage();
      await page.addInitScript((t) => localStorage.setItem("tennis-theme", t), theme);
      for (const r of routes) {
        const name = `${role}-${r.replace(c, "").replace(/^\/|\/$/g, "").replace(/\//g, "_") || "start"}-${w}-${theme}.jpg`;
        try {
          await page.goto(base + r, { waitUntil: "networkidle", timeout: 120_000 });
          await page.waitForTimeout(400); // spring animations settle
          await page.screenshot({ path: `${out}/${name}`, type: "jpeg", quality: 70, scale: "css" });
          n++;
        } catch (e) {
          console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`);
        }
      }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`${n} screenshots in ${out}`);
}
main();
