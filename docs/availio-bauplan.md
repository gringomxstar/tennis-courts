# Bauplan: availio-WebApp-Funktionen in TennisCourts

Stand: 28.09.2026. Grundlage ist `availio-funktionen.md`, Abschnitt 2 (WebApp) plus die Admin-Regeln, von denen die WebApp abhängt. Jede Funktion wurde im Code geprüft.

**Nicht im Umfang:** BookingStation/Kiosk, IoT (Licht, Heizung, Türen), FIBU/eBill/QR-Rechnung, Swiss-Tennis-Schnittstelle.

## Ergebnis in Kürze

**Vorhanden:**
- Buchungskalender
- Platz-Sortierung
- freie/belegte/gesperrte Slots
- eigene Buchungen
- Stornierung mit Frist
- Mitspieler (Mitglieder) hinzufügen
- Gäste mit Preisanzeige
- Buchungsbestätigung per Mail

**Teilweise vorhanden:**
- Multi-Club
- Club-Regeln
- Buchen nach Spielbeginn
- Spieleranzahl je Dauer
- Mitspieler ohne Konto
- Equipment
- Twint/Karte (nur Gäste)
- Rechnung (nur Mitgliedschaften)
- dynamische Preise
- Wallet (nur Mock)
- Support-Kontakt
- Kontingente pro Gruppe

**Fehlt:**
- Serienbuchungen
- Kostenaufteilung
- Barzahlung
- Einladungs-Onboarding
- Push-Benachrichtigungen
- Profil bearbeiten
- Gäste-Regeln pro Gruppe

## Stand 29.09.2026

Umgesetzt (Branch `feat/phase0-1-2-admin`):

- **Phase 0 komplett.** Regeln prüfen gegen Postgres (`src/lib/booking-rules.ts`, Check: `scripts/check-booking-rules.ts`). Guthaben wird in einer Transaktion abgebucht und beim Storno zurückgebucht (`src/lib/wallet.ts`, Check gegen die DB mit Rollback: `scripts/check-wallet-db.ts`). Aufladen läuft über Stripe Checkout und wird per Webhook oder beim Zurückkehren gutgeschrieben. Plan-Regeln werden durchgesetzt: Vorlauf, Dauern, max. aktiv, pro Tag. «2 Std» gibt es nur im Doppel. Storno-Mail ist neu.
- **Phase 1:** mehrere Gäste mit Name/E-Mail, Profil bearbeiten (ohne Admin-Freigabe), Favoriten in der DB (`TenantUser.favoriteUserIds`), Club-Kontakt im Profil, `lateBookingMinutes` (Standard 15), Club-Wechsler und Club-Liste auf `/` bei mehreren Clubs. Gäste ohne Konto bekommen in der Mail einen Link auf `/c/{club}/buchung/{id}?t=…` (HMAC-Token) zum Ansehen und Stornieren, mit Stripe-Rückerstattung.
- **Phase 2:** Button «Bezahlen» statt Twint. Mitglieder zahlen mit Guthaben, oder online, wenn das Guthaben nicht reicht. Vor Ort und Rechnung sind pro Club einschaltbar, der Admin markiert sie unter «Heute» als bezahlt. Preisregeln (Wochentag, Uhrzeit in Zürcher Zeit, Früh-/Last-Minute) gibt es im Admin. Kosten teilen belastet das Guthaben aller Mitglieder. Plan-Feld «Gäste/Woche» liegt in `rulesJson`.
- **Admin:** Limits für aktive Buchungen pro Rolle (Mitglied/Trainer/Gast) und Sportart (leer = unbegrenzt). Trainer sind von der Marly-Folge-/Pausenregel ausgenommen. Rollen werden unter Admin → Mitglieder vergeben.

Bewusst weggelassen: Admin-Freigabe von Profiländerungen (wenig Nutzen), Phase 3 und 4 (Entscheid vom 28.09.).

## Phase 0: Fehler zuerst beheben (S, ca. 1 Tag)

Diese Punkte gibt die UI heute schon vor, in der Datenbank passiert aber nichts:

1. **Buchungsregeln greifen nicht.** `createBookingAction` prüft die Marly-Regel und die Ballmaschinen-Exklusivität gegen `mockDb` (`src/app/actions/booking.ts:183,198`). Die echten Buchungen liegen aber in Postgres, also blockt die Prüfung nie.
   - Fix: gegen Prisma prüfen. `checkBallMachineAvailability` gibt es schon in `src/lib/data/index.ts`.
2. **Mitglieder zahlen nie.** Der Button zeigt „CHF X Guthaben“, aber nirgends wird Guthaben abgebucht.
   - Fix: in einer Prisma-`$transaction` `UserWallet` reduzieren und eine `WalletTransaction` (`BOOKING_PAYMENT`) anlegen. Die Rückerstattung beim Storno geht dann auch über die DB.
3. **Wallet-Aufladen ist nur Mock.** `topUpWalletAction` schreibt in `mockDb`, die Anzeige liest aber aus Postgres.
   - Fix: Aufladen über Stripe Checkout (Twint/Karte) wie bei den Gästen und im Webhook gutschreiben.
4. **Plan-Regeln werden nie geprüft.** `bookingWindowDays`, `allowedDurations` und `simultaneousBookingLimit` sind pro Mitgliedschaft gespeichert, werden aber nirgends geprüft.
   - Fix: in `createBookingAction` durchsetzen; die Tage im Kalender richten sich nach `bookingWindowDays`.
5. **„2 Std“ beim Einzel** wird in der UI angeboten und dann vom Server abgelehnt.
   - Fix: den Button deaktivieren, solange kein Doppel gewählt ist.
6. **Storno-Mail fehlt.**
   - Fix: `sendBookingCancellation` in `src/lib/mail.ts`.

## Phase 1: Spieler-Grundfunktionen (M, 3–4 Tage)

| Funktion | Umsetzung |
|---|---|
| Mitspieler/Gäste ohne Konto mit Name und E-Mail, mehrere möglich | Eingabefelder in `reserve-view.tsx`. Der Server akzeptiert `guestName`/`guestEmail` bereits. |
| Profil bearbeiten (optional mit Freigabe durch Admin) | `updateProfileAction`. Für die Freigabe ein Modell `ProfileChangeRequest` und eine Liste in Admin → Mitglieder. |
| Favoriten in der DB statt im Browser | Feld `favoriteUserIds` auf `TenantUser` |
| Support-Kontakt in der App | E-Mail und Telefon des Clubs im Profil |
| Buchen nach Spielbeginn | Club-Einstellung `lateBookingMinutes`, gilt für Slot-Status und Server |
| Multi-Club | Club-Wechsler aus `session.user.tenants`; Landing-Page mit Club-Liste statt fest verdrahtetem Slug |

## Phase 2: Bezahlen und Preise (M, 3–4 Tage)

| Funktion | Umsetzung |
|---|---|
| Twint/Karte auch für Mitglieder (ohne Guthaben) | Denselben Checkout-Weg wie bei Gästen verwenden, wenn das Guthaben nicht reicht |
| Barzahlung vor Ort / Rechnung | Enum `paymentMethod` auf `Booking`; Club legt erlaubte Zahlarten fest; Admin markiert „bezahlt“ wie bei den Rechnungen |
| Dynamische Preise (Tageszeit, Wochentag, Frühbucher, Last Minute) | `priceRules[]` in den Tenant-Settings; `computeBookingCost` erweitern. Client und Server nutzen dieselbe Funktion. |
| Kostenaufteilung unter Mitspielern | Option „Kosten teilen“: den Betrag auf die Mitglieder verteilen und bei jedem vom Guthaben abbuchen. `BookingParticipant.paymentStatus` gibt es schon. |
| Gäste-Regeln pro Mitgliedschaft (Zeitfenster, Limit pro Tag/Woche/Saison) | `rulesJson` auf `MembershipPlan` (Feld existiert); im Server die GUEST-Teilnehmer zählen |

## Phase 3: Onboarding und Benachrichtigungen (M–L, 3–5 Tage)

| Funktion | Umsetzung |
|---|---|
| Einladung per Link mit vorausgefülltem Formular, Massenversand, Erinnerungen | Modell `Invitation` (Token, E-Mail, Tenant, Vorbelegung); Versand über `sendMail`; `/register?token=`; Erinnerungen per Vercel-Cron |
| Push-Benachrichtigungen | Service Worker + `web-push`, Modell `PushSubscription`; ausgelöst dort, wo heute die Mails verschickt werden |

## Phase 4: Grössere Bausteine (L, je 3+ Tage)

| Funktion | Umsetzung |
|---|---|
| Serienbuchungen, einzelne Termine freigeben | Modell `BookingSeries` + `Booking.seriesId`; Admin legt Serien an; Spieler gibt einzelne Termine über `cancelBookingAction` frei |
| Equipment/Zusatzleistungen allgemein (Schläger-Miete usw.) | Modelle `Extra` + `BookingExtra` ersetzen `hasBallMachine`; Admin-Verwaltung + Auswahl beim Reservieren |

## Reihenfolge

Phase 0 zuerst. Heute zeigt die App Regeln und Preise an, die sie gar nicht durchsetzt, und das ist vor dem Livegang mit echten Mitgliedern das grösste Risiko. Danach Phase 1 und 2, weil sie den Alltag der Spieler abdecken. Phase 3 und 4 kommen je nach Bedarf der Clubs.
