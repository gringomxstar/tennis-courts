# Etappenbauplan: Tennis Reservation App

Dieser Bauplan definiert die schrittweise Entwicklung der mandantenfähigen Tennis-Reservierungsplattform basierend auf den abgestimmten Architekturentscheidungen und dem Fachkonzept ([konzept.md](file:///Users/alain/TennisCourts/konzept.md)).

---

## 1. Übersicht & Ziel-Architektur

```mermaid
flowchart TD
    subgraph Client ["Client (Browser / Mobile)"]
        UI["Next.js App Router (React, Tailwind CSS, Shadcn UI)"]
        Calendar["Custom Court Grid (Spalten: Plätze / Zeilen: Slots)"]
    end

    subgraph Hosting ["Vercel Edge & Serverless"]
        RSC["React Server Components & Server Actions"]
        API["REST Route Handlers (/api/...)"]
        Auth["Auth.js v5 (Session & JWT)"]
        MW["Multi-Tenant Middleware (/c/[clubSlug])"]
    end

    subgraph Data ["Neon Serverless PostgreSQL"]
        Prisma["Prisma ORM Client"]
        Constraints["PostgreSQL Exclusion Constraints (Overlap Protection)"]
        DB[(PostgreSQL Database)]
    end

    subgraph VCS ["Version Control & CI/CD"]
        GH["GitHub Repository"]
        GHA["GitHub Actions (Lint, Typecheck, Test)"]
    end

    UI --> MW
    MW --> RSC
    MW --> API
    RSC --> Prisma
    API --> Prisma
    Prisma --> DB
    Constraints --> DB
    GH --> GHA
    GH --> Hosting
```

| Bereich | Technologie | Zweck |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, React 19 / TypeScript) | Full-Stack Webframework mit RSC und Server Actions |
| **Styling & UI** | Tailwind CSS + Shadcn UI (Radix Primitives) + Lucide Icons | Barrierefreies, responsives Mobile-First UI mit individuellem Tennis-Kalender |
| **Datenbank** | Neon PostgreSQL (Serverless) | Relationale DB mit Branching-Support und nativen Überlappungs-Constraints |
| **ORM / Migration** | Prisma ORM | Typsichere Datenbankabfragen und schema-gesteuerte Migrationen |
| **Authentifizierung** | Auth.js (NextAuth v5) mit Prisma-Adapter | E-Mail/Passwort, Session-Handling, RBAC (6 Rollen) |
| **Multi-Tenancy** | Path-basiert (`/c/[clubSlug]/...`), Tenant-Context Middleware | Vollständige Daten- und Rechttrennung zwischen Tennisclubs |
| **Hosting & CI/CD** | Vercel + GitHub + GitHub Actions | Automatisches Preview- & Production-Deployment bei jedem Git-Push |

---

## 2. Phasenplan (Etappenbauplan)

### Phase 1: Projekt-Fundament, Git & Tooling
**Ziel:** Lauffähige Next.js-Basis mit Tooling, Formatierung, UI-Komponentenbibliothek und sauber initialisiertem Git-Repository.

- [x] **1.1 Next.js App initialisieren**: Next.js 16 (TypeScript, Tailwind CSS v4, ESLint, App Router, `src/`-Verzeichnis).
- [x] **1.2 Git & GitHub Setup**:
  - `git init`, `.gitignore` konfiguriert (inkl. `.env.example`, Next.js, Prisma).
  - Git Commits erstellt auf Branch `main`.
  - GitHub Actions Workflow angelegt.
- [x] **1.3 UI-Grundgerüst mit Shadcn UI**:
  - UI-Komponenten (`Button`, `Card`, `Badge`), `cn`-Utility und `lucide-react` Icons.
  - Landingpage mit Club-Finder, Feature-Übersicht und Emerald-Tennisthema.
- [x] **1.4 GitHub Actions CI Workflow**:
  - `.github/workflows/ci.yml` für Linting, TypeScript-Check und Next.js Build-Validierung.

---

### Phase 2: Datenbankmodell, Neon Postgres & Prisma
**Ziel:** Vollständig modelliertes Schema in Prisma mit Neon-Postgres-Verbindung, Seed-Skript und Schutz vor Doppelbuchungen.

- [x] **2.1 Neon PostgreSQL Provisionierung**:
  - Automatisches Provisionierungsskript `scripts/provision-db.ts` (`npm run db:provision`) für Schema-Push, Extension-Aktivierung und Seeding bereitgestellt.
  - Verbindungszeichenfolgen (`DATABASE_URL`, `DIRECT_URL`) in `.env.local` vorbereitet.
- [x] **2.2 Prisma Schema Definition**:
  - Alle Tabellen aus dem Fachkonzept in `prisma/schema.prisma` definiert:
    - `User`, `Tenant`, `TenantUser` (6 Rollen)
    - `Location`, `Court` (Sand, Hartplatz, Halle, Beleuchtung)
    - `MembershipPlan`, `Membership` (Quoten, Fenster, Dauern)
    - `Booking`, `BookingParticipant`, `CourtBlock`
    - `AuditLog` & NextAuth-Tabellen (`Account`, `Session`, `VerificationToken`)
  - Prisma Client erfolgreich generiert (`prisma/schema.prisma` -> `@prisma/client`).
- [x] **2.3 Doppelbuchungsschutz (Exclusion Constraint & Live-Testing)**:
  - `prisma/exclusion_constraint.sql` für atomare Überlappungsverhinderung (`btree_gist` Extension) idempotent implementiert.
  - Automatisierter Live-Test `scripts/test-exclusion-constraint.ts` (`npm run db:test-constraints`) mit 5 Testfällen (Kollisionsabwehr mit Code `23P01`, parallele Plätze, Slot-Aneinanderreihung, Freigabe nach Storno).
- [x] **2.4 Seeding-Skript**:
  - `prisma/seed.ts` mit Demo-Club ("TC Rot-Weiss Zürich"), 4 Plätzen, 3 Mitgliedern, Tarifen und Beispiel-Buchungen erstellt (`npm run db:seed`).

---

### Phase 3: Authentifizierung & Multi-Tenancy Routing
**Ziel:** Sichere Benutzeranmeldung, Rollenprüfung und URL-Routing für Clubs.

- [x] **3.1 Auth.js (v5) Setup**:
  - Credentials-Provider mit `bcryptjs` Passwort-Hashing und robuster Fallback-Schicht.
  - NextAuth-Prisma-Adapter Integration und JWT/Session Callbacks mit Tenant-Rollen.
  - Registrierungs- und Login-Formulare mit Zod-Validierung und 1-Klick Demo-Logins.
- [x] **3.2 Multi-Tenant Routing & Middleware**:
  - Routen-Layout:
    - `/` Landingpage / Club-Finder.
    - `/login`, `/register`.
    - `/admin` Plattform-Administration (nur für `PLATFORM_ADMIN`).
    - `/c/[clubSlug]` Club-Home, Plätze, Kalender.
    - `/c/[clubSlug]/admin` Club-Management (nur für Club-Admins).
    - `/c/[clubSlug]/bookings` Buchungsübersicht der Spieler.
  - Next.js Edge-Middleware zur Validierung und Absicherung geschützter Routen.
- [x] **3.3 Tenant-Context Helper**:
  - Typsichere Session- und Tenant-Extraktoren (`getTenantContext`, `requireTenantAdmin`, `requirePlatformAdmin`) für Server Components und Server Actions.

---

### Phase 4: Club-, Platz- & Sperrzeiten-Verwaltung (Admin)
**Ziel:** Administratoren können ihren Club, Standorte, Plätze, Tarife und Sperren vollständig konfigurieren.

- [x] **4.1 Club-Einstellungen & Öffnungszeiten**: Dynamische Konfiguration von Öffnungszeiten, Schliesszeiten, Standard-Slot-Dauer, Stornofristen und Gastbuchungsrechten (`ClubSettingsForm` + Server Action `updateClubSettingsAction`).
- [x] **4.2 Standort- & Platzverwaltung**: Plätze einsehen, Sortierung, Platzattribute (Indoor, Sand, Flutlicht).
- [x] **4.3 Platzsperren (Court Blocks)**: Formular zum Sperren von Plätzen (`CreateCourtBlockForm`) mit Wartung, Turnier, Witterung.
- [x] **4.4 Mitgliederverwaltung**: Mitgliederverzeichnis mit Rollen und Berechtigungen.
- [x] **4.5 Dynamische Tarif- & Quotenverwaltung**: Verwaltung von Mitgliedschaftstarifen (`MembershipPlan`) mit Preisen, Buchungsfenstern (Tage), max. gleichzeitigen Buchungen und Spieldauern via `MembershipPlansManager` (`createMembershipPlanAction`, `deleteMembershipPlanAction`).

---

### Phase 5: Buchungs-Engine & Regelprüfung (Core Domain)
**Ziel:** Transaktionales Buchungssystem mit flexibler Regelprüfung.

- [x] **5.1 Zentrale Regelprüfung (`createBookingAction`)**:
  - Schutz vor Überlappungen (Kollisionsprüfung auf Platz und Zeitslot).
  - Berücksichtigung von Platzsperren (Court Blocks).
  - Prüfung der erlaubten Spieldauern (60 Min, 90 Min).
- [x] **5.2 Transaktionale Buchungserstellung**:
  - Teilnehmer-Zuordnung (`BookingParticipant`: Organisator, Mitspieler, Gast).
  - Idempotente Speicherung (DB + Store) und sofortige Cache-Revalidierung.
- [x] **5.3 Stornierungslogik**:
  - Prüfung der Club-Stornierungsfrist (z. B. 24h vor Spielbeginn für Mitglieder, jederzeit für Admins).
  - Schnelle Stornierung direkt aus dem Buchungskalender oder `/c/[clubSlug]/bookings`.

---

### Phase 6: Interaktives Buchungs-UI (Court Grid Kalender)
**Ziel:** Flüssige, responsive Buchungsoberfläche für Mobile und Desktop.

- [x] **6.1 Maßgeschneidertes Tennis-Court-Grid**:
  - Tagesansicht: Plätze als Spalten, Uhrzeiten (07:00 – 22:00 Uhr) als Zeilen.
  - Mobile Ansicht: Schnellumschaltung zwischen Plätzen via Court-Tabs.
  - Farbliche Indikatoren: Frei (dashed, hover-plus), Gebucht (blau/slate), Eigene Buchung (smaragdgrün mit Badge), Gesperrt (gelb/amber mit Grund).
- [x] **6.2 Buchungs-Modal & Buchungsdetails-Modal**:
  - Start-/Endzeit, Dauer (60/90 Min), Spielart (Einzel/Doppel), Mitspieler-Auswahl / Gastspieler-Eingabe, Notizen.
  - Details-Modal für bestehende Buchungen mit Schnell-Storno für eigene Matches.
- [x] **6.3 Kalender-Navigation & Filter**:
  - Tagesnavigation (Vor/Zurück, "Heute"-Button, nativer Date Picker).
  - Filter nach Belag (Sand, Hartplatz), Hallen-/Freiplatz (Indoor/Outdoor) und Flutlicht.

---

### Phase 7: Spieler-Dashboard & Profil
**Ziel:** Mitglieder können ihre Buchungen verwalten und Profile bearbeiten.

- [x] **7.1 Mein Bereich (`/c/[clubSlug]/bookings`)**:
  - Übersicht der anstehenden und vergangenen Buchungen mit Status-Badges.
  - Schnell-Storno-Funktion mit interaktivem Bestätigungsdialog und Stornofristen.
- [ ] **7.2 Benutzerprofil**:
  - Kontaktdaten, Telefonnummer, bevorzugte Spielzeiten, Passwort ändern.

---

### Phase 8: Deployment, Vercel & GitHub Actions CI/CD
**Ziel:** Produktionsreifes Deployment auf Vercel mit Preview-Deployments für Pull Requests.

- [ ] **8.1 Vercel Projektverbindung**:
  - Verknüpfung mit GitHub-Repository.
  - Hinterlegung aller Environment-Variablen (`DATABASE_URL`, `AUTH_SECRET`, etc.).
- [ ] **8.2 Automatisierte Migrationen im Build-Prozess**:
  - `prisma migrate deploy` im Vercel Build Step oder per GitHub Action.
- [ ] **8.3 Smoke- & E2E-Tests**:
  - Grundlegende Tests für Buchungsworkflow und Tenant-Isolierung.

---

### Neuer Epic (Nächste Session / Separater PR): Credits, Mitspieler-Deluxe, dynamische Buchungsregeln & Multi-Sport
**Ziel:** Erstklassiges Reservierungserlebnis mit nahtlosem Credits-Guthaben, club-spezifischen Buchungsregeln (z.B. TC Marly), dynamischer Dauer nach Spieleranzahl, Ballmaschinen-Buchung und saisonalen Tarifen (Sommer-/Winterabo, Padel, Tennishalle).

- [x] **E.1 Integriertes Credits- & Wallet-System (Club-Guthaben & Test-Engine)**:
  - **Credit-Konto:** Jedes Mitglied/Gast besitzt ein clubweites Guthaben-Konto (z. B. 1 Credit = 1 CHF).
  - **Test-Guthaben (1-Klick):** Direkte Dev-/Testing-Aufladung (z.B. "+50 CHF Test-Credits aufladen") im Modal/Header ohne Zwang zu echten Kreditkartentransaktionen.
  - **Automatisches Einlösen:** Bezahlung von Gastgebühren, Platzmieten oder Zusatzleistungen (Ballmaschine) direkt aus dem Credit-Guthaben mit Quittungshistorie.
  - **Admin-Gutschriften:** Admins können Mitgliedern bei Witterungsausfall direkt Credits gutschreiben.

- [x] **E.2 Deluxe Mitspieler- & Favoriten-Auswahl (Buddies)**:
  - **Favoriten-Leiste ("Häufige Partner"):** 1-Klick-Auswahl beliebter Spielpartner über prominente Avatar-Pills direkt oben im Sheet.
  - **Interaktive Mitgliedersuche:** Schnellsuche mit Live-Filter, Club-Status, Profil-Initialen statt langweiligem Dropdown.
  - **Gäste-Erfassung:** Einfaches Hinzufügen von externen Gastspielern (Name & E-Mail) mit automatischer Berechnung des Gastkostenanteils.

- [x] **E.3 Dynamische Slot-Dauer & Verknüpfung mit Spieleranzahl**:
  - **Einzel (2 Spieler):** Standardmässig maximal **1 Stunde** (1 Slot, z.B. 14:00 – 15:00 Uhr).
  - **Doppel (4 Spieler):** Möglichkeit, direkt **2 aufeinanderfolgende Stunden (2x 1h, z.B. 14:00 – 16:00 Uhr)** am Stück zu buchen.
  - **Club-Konfiguration:** Jeder Club kann `allowConsecutiveSlotsForDoubles` und die benötigte Spieleranzahl im Adminbereich selbst konfigurieren.

- [x] **E.4 Clubspezifische Buchungsregeln & Cooldowns (z. B. TC Marly-Modell)**:
  - **Rolling Release nach Slot-Ablauf:** Ein Mitglied hat z. B. ein Kontingent von 2 aktiven Slots. Ein weiterer Slot wird erst buchbar, nachdem die Zeit des ersten Slots **abgelaufen** ist.
  - **Anti-Blockier-Regel (Kein Consecutive Booking im Einzel):** Ein Spieler kann nicht 14:00 Uhr und direkt 15:00 Uhr hintereinander reservieren (ausser im 4er-Doppel).
  - **Mindestabstand (Cooldown):** Konfigurierbare Pause zwischen Buchungen desselben Spielers (z. B. mind. 1 Stunde Pause).
  - **Stornierungsfristen:** 24h vor Spielbeginn kostenlos, danach Sperre oder Verfall von Credits.

- [x] **E.5 Zusatzleistungen & exklusive Ressourcen (Equipment: Ballmaschine, Flutlicht)**:
  - **Ballmaschine buchen:** Optionale Checkbox im Buchungsdialog (z. B. +10 CHF / Stunde).
  - **Exklusivitäts-Schutz:** Da ein Club meist nur 1 Ballmaschine besitzt, kann diese zeitgleich nur auf genau einem Platz gebucht werden. Bei paralleler Buchung auf Platz 2 wird sie automatisch als belegt/ausgegraut angezeigt.
  - **Flutlicht-Steuerung/Gebühr:** Buchbar als Zusatz-Option für Abendslots.

- [x] **E.6 Multi-Sportarten & saisonale Abos (Padel, Tennis, Halle, Sommer-/Winterabo)**:
  - **Sportarten-Differenzierung:** Tennis (Sand, Hartplatz), Padel Courts (4 Spieler, eigene Regeln) und Tennishalle (Teppich/Granulat).
  - **Differenzierte Platzpreise:** Eigene Stundensätze für Halle (z. B. 45 CHF/h), Padel (z. B. 40 CHF/h) und Sandplatz (z. B. 30 CHF/h).
  - **Saisonale Mitgliedschaften:**
    - *Sommerabo (Mai – Sept):* Freiplätze inklusive (0 CHF), Hallenplätze nur mit Aufpreis/Credits buchbar.
    - *Winterabo (Okt – April):* Berechtigung für Tennishalle mit Vorverkaufsfenster und Fixplatz-Option.

---

### Phase 9: Nach dem MVP (Erweiterungen)
- Stripe Online-Zahlungen (Kreditkarte, Twint für Gastbuchungen & Credit-Pakete).
- E-Mail-Transaktionsmails via Resend oder Postmark.
- Öffentliche Matches & Mitspielersuche (Community).
- Erweiterte Club-Statistiken & Auslastungsberichte.

---

## 3. Sofortige nächste Schritte für die NEUE Session

1. **Neuen Feature-Branch erstellen:**
   - `git checkout -b feat/credits-player-rules-multisport`
2. **Datenmodell & Mock/Prisma erweitern:**
   - Wallet/Credits für Tenant-User anlegen.
   - Resource-Modell für Ballmaschine hinzufügen.
   - Club-Regelparameter (Marly-Cooldown, Doppel-Verlängerung) in `settingsJson` integrieren.
3. **UI & Buchungs-Sheet implementieren:**
   - Neues Partner-Auswahl-Sheet mit Favoriten-Pills & Mitgliedersuche.
   - Dynamische 1h vs. 2h Slot-Auswahl bei 4 Spielern.
   - Credits-Anzeige mit 1-Klick Test-Aufladung und Ballmaschinen-Checkbox.
