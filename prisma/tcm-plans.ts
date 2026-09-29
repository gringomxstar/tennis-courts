// TC Marly tariffs (tennismarly.ch/inscription-et-tarifs), sold as 365-day Abos.
// One row per sport combination and person count; extra fields go into rulesJson (see planFromDb).
type Sport = "TENNIS" | "PADEL";
type Cat = { key: string; category: string; ageMin?: number; ageMax?: number; proofRequired?: boolean; playWindow?: { weekdays: number[]; fromHour: number; toHour: number }; description: string };

const CATS: Record<string, Cat> = {
  kind: { key: "kind", category: "Kinder", ageMax: 12, description: "Für Kinder bis 12 Jahre." },
  junior: { key: "junior", category: "Junioren", ageMin: 13, ageMax: 18, description: "Für Jugendliche von 13 bis 18 Jahren." },
  jung: { key: "jung", category: "Junge Erwachsene", ageMax: 26, description: "Bis 26 Jahre." },
  student: { key: "student", category: "Studierende & Lehrlinge", ageMax: 30, proofRequired: true, description: "Bis 30 Jahre, mit Studierenden- oder Lehrlingsausweis." },
  adult: { key: "adult", category: "Erwachsene", ageMin: 19, description: "Volle Spielberechtigung." },
  senior: { key: "senior", category: "Senioren", ageMin: 65, description: "Ab 65 Jahren." },
  soleil: { key: "soleil", category: "Abo Soleil", playWindow: { weekdays: [1, 2, 3, 4, 5], fromHour: 8, toHour: 16 }, description: "Montag bis Freitag, 8 bis 16 Uhr." },
  rolli: { key: "rolli", category: "Rollstuhltennis", description: "Für Rollstuhlspielerinnen und -spieler." },
};

// [category, single price, couple price?] per sport combination
const PRICES: { sports: Sport[]; label: string; rows: [keyof typeof CATS, number, number?][] }[] = [
  { sports: ["TENNIS"], label: "Tennis", rows: [["kind", 60], ["junior", 100], ["jung", 200], ["student", 200], ["adult", 380, 550], ["senior", 300, 550], ["soleil", 200], ["rolli", 100]] },
  { sports: ["PADEL"], label: "Padel", rows: [["kind", 60], ["junior", 100], ["student", 185], ["adult", 290, 400], ["senior", 230, 400]] },
  { sports: ["TENNIS", "PADEL"], label: "Tennis + Padel", rows: [["kind", 110], ["junior", 150], ["student", 250], ["adult", 480, 750], ["senior", 400, 750]] },
];

export const TCM_PLANS = PRICES.flatMap(({ sports, label, rows }) =>
  rows.flatMap(([key, single, couple]) => {
    const c = CATS[key];
    const slug = sports.map((s) => s[0].toLowerCase()).join("");
    const base = (persons: 1 | 2, price: number) => ({
      id: `tcm-${slug}-${key}${persons === 2 ? "-paar" : ""}`,
      name: `${c.category} · ${label}${persons === 2 ? " · Paar" : ""}`,
      description: persons === 2 ? `${c.description} Für zwei Personen.` : c.description,
      price,
      rulesJson: {
        sports,
        category: c.category,
        persons,
        ageMin: c.ageMin ?? null,
        ageMax: c.ageMax ?? null,
        proofRequired: Boolean(c.proofRequired),
        playWindow: c.playWindow ?? null,
        guestsPerWeek: null,
      },
    });
    return couple ? [base(1, single), base(2, couple)] : [base(1, single)];
  })
);
