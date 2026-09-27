# 🎾 Tennis Reservation App

Moderne, mandantenfähige Webanwendung zur Verwaltung und Reservierung von Tennisplätzen für Tennisclubs, Mitglieder, Gäste und Administratoren.

Gebaut mit **Next.js 16 (App Router)**, **Prisma ORM**, **Neon Serverless PostgreSQL**, **Tailwind CSS** und **Shadcn UI**.

---

## 🚀 Kernfunktionen

- **Mandantenfähigkeit (Multi-Tenant):** Jeder Tennisclub besitzt einen eigenen Bereich (`/c/[clubSlug]`) mit getrennter Datenhaltung, Standorten und Plätzen.
- **Konfliktfreie Buchungen:** Doppelbuchungen werden technisch auf Datenbankebene durch **PostgreSQL Exclusion Constraints** (`btree_gist`) und transaktionale Absicherung verhindert.
- **Flexible Buchungsregeln & Mitgliedschaftstarife:** Quoten (z.B. max. 4 zukünftige Buchungen), Buchungsfenster, Abendbeschränkungen und Stornierungsfristen.
- **Mobile-First Buchungskalender:** Maßgeschneidertes Tennis-Court-Grid (Plätze als Spalten, Zeitslots als Zeilen) mit Touch-Unterstützung.
- **Club- & Platzverwaltung:** Club-Admins verwalten Standorte, Plätze (Sand, Hartplatz, Halle, Flutlicht) und temporäre Platzsperren (Wartung, Regen, Turniere).

---

## 🛠️ Tech-Stack

- **Frontend & Fullstack:** [Next.js](https://nextjs.org/) (App Router, Server Components & Server Actions)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives, Lucide Icons)
- **Datenbank & ORM:** [Neon PostgreSQL](https://neon.tech/) & [Prisma ORM](https://www.prisma.io/)
- **Authentifizierung:** [Auth.js / NextAuth v5](https://authjs.dev/) mit Prisma Adapter
- **CI/CD & Hosting:** [GitHub Actions](.github/workflows/ci.yml) & [Vercel](https://vercel.com/)

---

## 📦 Erste Schritte

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Umgebungsvariablen einrichten

Kopiere `.env.example` nach `.env.local` und trage deine Neon-PostgreSQL-Verbindungsdaten ein:

```bash
cp .env.example .env.local
```

### 3. Datenbank synchronisieren & Seeden

```bash
# Schema auf Neon PostgreSQL anwenden
npx prisma db push

# Doppelbuchungsschutz auf DB-Ebene aktivieren (PostgreSQL Exclusion Constraint)
# Siehe prisma/exclusion_constraint.sql

# Testdaten für Demo-Club "TC Rot-Weiss Zürich" einspielen
npx prisma db seed
```

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Die Anwendung ist anschließend unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## 📄 Architektur & Bauplan

- Fachkonzept: [konzept.md](konzept.md)
- Phasen- & Etappenbauplan: [bauplan.md](file:///Users/alain/.gemini/antigravity/brain/aee8e322-9bd6-434e-9289-7679b9f25401/bauplan.md)
