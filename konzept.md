# Tennis Reservation App

## 1. Projektübersicht

Entwicklung einer mandantenfähigen Webanwendung zur Verwaltung und Reservierung von Tennisplätzen.

Die Anwendung richtet sich zunächst an Tennisclubs mit mehreren Plätzen, Mitgliedern und unterschiedlichen Buchungsregeln. Spieler sollen Plätze über eine responsive Weboberfläche reservieren können. Club-Administratoren sollen Plätze, Mitglieder, Mitgliedschaften, Zeitpläne, Sperrzeiten und Buchungsregeln verwalten können.

Das System soll später um Gastbuchungen, Onlinezahlungen, öffentliche Matches, Mitspielersuche, Zutrittskontrolle und einen Marketplace für mehrere Clubs erweitert werden können.

## 2. Produktziele

### Primäre Ziele

- Tennisplätze zuverlässig und konfliktfrei reservieren.
- Doppelbuchungen technisch verhindern.
- Unterschiedliche Mitgliedschafts- und Buchungsregeln abbilden.
- Club-Administratoren mit einer einfachen Verwaltungsoberfläche ausstatten.
- Mobile Nutzung für Spieler ermöglichen.
- Mehrere Clubs getrennt voneinander verwalten.
- Eine erweiterbare technische Basis schaffen.

### Sekundäre Ziele

- Gastbuchungen ermöglichen.
- Onlinezahlungen integrieren.
- Öffentliche Matches anbieten.
- Mitspielersuche ermöglichen.
- Platzbelegung und Umsatz analysieren.
- Zutrittscodes oder QR-Codes integrieren.

### Nicht-Ziele für das MVP

- Native Mobile Apps.
- Vollständige Turnierverwaltung.
- Dynamische Preise.
- Hardwaresteuerung.
- Komplexe Split-Payments.
- Integration mit vielen externen Buchungssystemen.
- Vollständiger Marketplace für beliebige Sportanlagen.

## 3. Produktpositionierung

Die Anwendung kombiniert drei Produktideen:

1. Club-Management nach dem Vorbild von BalleJaune.
2. Einfache spontane Buchung und öffentliche Matches nach dem Vorbild von Anybuddy.
3. Community-, Kurs- und Statistikfunktionen nach dem Vorbild von Playtomic.

Der Fokus der ersten Version liegt auf zuverlässiger Club-Reservierung und flexiblen Buchungsregeln.

## 4. Zielgruppen

### Tennisclubs

- Kleine und mittelgroße Clubs.
- Zwei bis zwanzig Tennisplätze.
- Indoor- und Outdoor-Plätze.
- Mitglieder mit verschiedenen Tarifen.
- Gelegentliche Gastspieler.
- Saisonbetrieb oder ganzjähriger Betrieb.

### Mitglieder

- Möchten schnell einen Platz buchen.
- Möchten bestehende Buchungen sehen und stornieren.
- Möchten Mitspieler zu einer Buchung hinzufügen.
- Möchten gegebenenfalls offene Matches erstellen.

### Gäste

- Möchten ohne langfristige Mitgliedschaft buchen.
- Bezahlen gegebenenfalls pro Reservierung.
- Haben eingeschränkte Buchungsrechte.

### Club-Administratoren

- Verwalten Plätze, Mitglieder und Regeln.
- Erstellen Buchungen im Namen anderer Personen.
- Sperren Plätze für Wartung oder Veranstaltungen.
- Sehen Auslastung und Buchungsstatistiken.

## 5. Rollen und Berechtigungen

### Plattform-Administrator

Darf:

- Alle Clubs verwalten.
- Clubs anlegen, deaktivieren und löschen.
- Plattformweite Einstellungen verwalten.
- Abonnements und Limits konfigurieren.
- Systemprotokolle und Fehler einsehen.

### Club-Administrator

Darf:

- Clubdaten bearbeiten.
- Standorte und Plätze verwalten.
- Mitglieder verwalten.
- Mitgliedschaften zuweisen.
- Buchungsregeln konfigurieren.
- Plätze sperren.
- Buchungen bearbeiten und stornieren.
- Statistiken einsehen.
- Zahlungen und Rückerstattungen verwalten.

### Platzmanager

Darf:

- Kalender einsehen.
- Buchungen manuell erstellen.
- Buchungen stornieren.
- Plätze sperren.
- Keine globalen Club- oder Zahlungssettings ändern.

### Trainer

Darf:

- Eigene Verfügbarkeiten verwalten.
- Trainingsplätze reservieren.
- Kurse oder Trainingsslots verwalten, sofern aktiviert.

### Mitglied

Darf:

- Verfügbare Plätze sehen.
- Buchungen erstellen.
- Eigene Buchungen bearbeiten und stornieren.
- Mitspieler hinzufügen.
- Eigene Mitgliedschaft einsehen.

### Gast

Darf:

- Öffentliche verfügbare Slots sehen.
- Sich registrieren.
- Plätze buchen, sofern der Club dies erlaubt.
- Buchungen bezahlen.
- Keine internen Clubdaten einsehen.

## 6. Technologievorschlag

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod für Validierung
- TanStack Query oder vergleichbare Lösung für Server-State
- Responsive Design für Mobilgeräte

### Backend

Eine der folgenden Varianten ist zulässig:

#### Variante A: TypeScript Full Stack

- NestJS
- TypeScript
- REST API oder tRPC
- Prisma ORM

#### Variante B: Laravel

- Laravel
- PHP
- Laravel Sanctum
- Eloquent ORM
- REST API oder serverseitige Views

Für das Projekt wird standardmäßig Variante A verwendet, sofern kein anderer Entscheid getroffen wird.

### Infrastruktur

- PostgreSQL
- Redis für Hintergrundjobs und temporäre Sperren
- Docker Compose für lokale Entwicklung
- S3-kompatibler Storage für Dateien
- E-Mail-Service über SMTP oder Transaktionsanbieter
- Stripe für Zahlungen in einer späteren Phase
- GitHub Actions für CI/CD

### Entwicklungsprinzipien

- TypeScript strict mode aktivieren.
- Testbare Business-Logik.
- Keine Buchungslogik ausschließlich im Frontend.
- Alle Zeitwerte serverseitig korrekt behandeln.
- UTC in der Datenbank speichern.
- Zeitzone des Clubs für Darstellung und Regeln verwenden.
- Datenbanktransaktionen für Buchungen verwenden.
- Alle kritischen Aktionen protokollieren.
- Keine hardcodierten Clubregeln im Quellcode.

## 7. Mandantenfähigkeit

Die Anwendung ist mandantenfähig.

Jeder Club ist ein eigener Tenant. Daten eines Clubs dürfen niemals für Benutzer eines anderen Clubs sichtbar oder veränderbar sein.

### Anforderungen

- Jede relevante Tabelle enthält `tenant_id` oder ist indirekt einem Tenant zugeordnet.
- Jeder API-Endpunkt prüft den Tenant-Kontext.
- Admins dürfen nur innerhalb ihres Clubs arbeiten.
- Plattform-Admins dürfen tenantübergreifend arbeiten.
- Tests müssen Cross-Tenant-Zugriffe abdecken.
- Datenbankabfragen müssen standardmäßig tenant-gefiltert sein.

## 8. Kernfunktionen des MVP

### Authentifizierung

- Registrierung per E-Mail und Passwort.
- Login.
- Logout.
- Passwort zurücksetzen.
- E-Mail-Verifizierung.
- Optionaler Login über OAuth in einer späteren Phase.
- Session- oder JWT-basierte Authentifizierung.
- Rate-Limiting für Login und Passwort-Reset.
- Sichere Passwort-Hashing-Strategie.

### Benutzerprofil

Felder:

- Vorname.
- Nachname.
- E-Mail.
- Telefonnummer.
- Profilbild optional.
- Spielniveau optional.
- Bevorzugte Sprache.
- Zeitzone.
- Benachrichtigungseinstellungen.
- Datenschutz- und Marketing-Einwilligungen.

### Clubverwaltung

Ein Club besitzt:

- Name.
- Kurzname oder Slug.
- Beschreibung.
- Logo.
- Adresse.
- Kontaktinformationen.
- Zeitzone.
- Öffnungszeiten.
- Stornierungsbedingungen.
- Allgemeine Hinweise.
- Aktivierungsstatus.

### Standortverwaltung

Ein Club kann mehrere Standorte besitzen.

Ein Standort besitzt:

- Name.
- Adresse.
- Beschreibung.
- GPS-Koordinaten optional.
- Öffnungszeiten.
- Zugehöriger Club.

### Platzverwaltung

Ein Platz besitzt:

- Name, zum Beispiel `Platz 1`.
- Standort.
- Belag, zum Beispiel Sand oder Hartplatz.
- Indoor-/Outdoor-Status.
- Beleuchtungsstatus.
- Barrierefreiheitsinformationen optional.
- Aktiver/inaktiver Status.
- Sortierreihenfolge.
- Preisprofil.
- Buchbarkeit.
- Interne Notizen.

### Kalender

Der Kalender muss folgende Ansichten unterstützen:

- Tagesansicht.
- Wochenansicht.
- Mobile Listenansicht.
- Filter nach Standort.
- Filter nach Platz.
- Filter nach Buchungsstatus.
- Filter nach Sportart, falls später weitere Sportarten unterstützt werden.

Mögliche Slot-Status:

- Frei.
- Gebucht.
- Vorübergehend reserviert.
- Gesperrt.
- Nur für bestimmte Mitgliedschaft verfügbar.
- Vergangen.
- Nicht buchbar außerhalb der Öffnungszeit.

### Buchungen

Eine Buchung enthält:

- Club.
- Standort.
- Platz.
- Organisator.
- Startzeit.
- Endzeit.
- Status.
- Buchungstyp.
- Preis.
- Währung.
- Stornierungsfrist.
- Notiz.
- Erstellungszeitpunkt.
- Änderungszeitpunkt.
- Ersteller.
- Zahlungsstatus.

Buchungstypen:

- Mitglied.
- Gast.
- Trainer.
- Kurs.
- Turnier.
- Admin.
- Wartung.
- Veranstaltung.

Buchungsstatus:

- `pending`
- `confirmed`
- `cancelled`
- `expired`
- `completed`
- `no_show`

### Teilnehmer

Eine Buchung kann mehrere Teilnehmer besitzen.

Ein Teilnehmer enthält:

- Buchung.
- Benutzer oder Gastname.
- E-Mail optional.
- Rolle.
- Einladungsstatus.
- Zahlungsstatus.
- Erstellungszeitpunkt.

Teilnehmerrollen:

- Organisator.
- Mitspieler.
- Gast.
- Trainer.

### Buchungen erstellen

Der Buchungsprozess:

1. Benutzer wählt Club.
2. Benutzer wählt Standort.
3. Benutzer wählt Datum.
4. Benutzer wählt Zeitfenster.
5. System zeigt verfügbare Plätze.
6. Benutzer wählt einen Platz.
7. System prüft alle Berechtigungen.
8. System zeigt Preis und Bedingungen.
9. Benutzer bestätigt.
10. System erstellt eine Buchung in einer Transaktion.
11. System verschickt eine Bestätigung.

### Buchungen stornieren

- Benutzer darf eigene Buchung innerhalb der Clubregeln stornieren.
- Admin darf Buchungen jederzeit stornieren.
- Stornierung muss protokolliert werden.
- Rückerstattungen werden in einer späteren Zahlungsphase unterstützt.
- Bei Stornierung wird der Slot wieder verfügbar.
- Teilnehmer erhalten optional eine Benachrichtigung.

### Admin-Buchung

Admins müssen Buchungen im Namen eines Mitglieds oder Gastes erstellen können.

Admin-Buchungen dürfen optional:

- Quoten überschreiben.
- Buchungsfenster überschreiben.
- Sperrzeiten überschreiben.
- Kosten überschreiben.
- Benachrichtigungen deaktivieren.

Jede Überschreibung muss im Audit-Log vermerkt werden.

## 9. Mitgliedschaften und Tarife

### Mitgliedschaftsplan

Ein Mitgliedschaftsplan enthält:

- Name.
- Beschreibung.
- Preis.
- Währung.
- Gültigkeitsdauer.
- Startdatum.
- Enddatum.
- Buchungsfenster in Tagen.
- Anzahl gleichzeitig möglicher zukünftiger Buchungen.
- Maximalbuchungen pro Tag.
- Maximalbuchungen pro Woche.
- Maximalbuchungen pro Monat.
- Erlaubte Wochentage.
- Erlaubte Uhrzeiten.
- Erlaubte Plätze.
- Erlaubte Buchungsdauern.
- Gastregel.
- Prioritätsstufe.
- Aktivierungsstatus.

### Saisonale Abos (Sommer- vs. Winterbetrieb)

Clubs unterscheiden häufig zwischen Saisons:

- **Sommerabo (z. B. 01. Mai – 30. September):**
  - Beinhaltet uneingeschränkte Nutzung aller Freiplätze (Sand, Hartplatz) gemäss Quoten.
  - Hallennutzung ist ausgeschlossen oder nur gegen reduzierten Aufpreis/Credits buchbar.
- **Winterabo (z. B. 01. Oktober – 30. April):**
  - Feste wöchentliche Hallen-Fixplätze (Fix-Abo) oder Buchungskontingente für die Tennishalle.
- **Ganzjahres- & Kombi-Abos:**
  - Uneingeschränkte Freiplatz- und Hallenberechtigung oder Tennis + Padel Kombi.

### Dynamische Buchungsdauer & Spieleranzahl (Einzel vs. Doppel)

Die erlaubte Spieldauer und Anzahl buchbarer Slots hängt von der Spieleranzahl ab:

- **Einzel (2 Spieler):**
  - Max. 1 Stunde (1 Slot, z. B. 14:00 – 15:00 Uhr).
  - Ein Spieler kann im Einzel keine 2 aufeinanderfolgenden Stunden blockieren.
- **Doppel (4 Spieler):**
  - Möglichkeit, **2 aufeinanderfolgende Stunden (2x 1h, z. B. 14:00 – 16:00 Uhr)** direkt am Stück zu reservieren.
  - Voraussetzung: Mindestens 3 zusätzliche Spieler (Mitglieder oder Gäste) müssen als Teilnehmer hinterlegt sein.
- **Clubspezifisch konfigurierbar:**
  - Jeder Club kann einstellen: `allowConsecutiveSlotsForDoubles` (true/false) und Mindestanzahl Spieler.

### Clubspezifische Buchungsregeln & Sperrfristen (z. B. TC Marly-Modell)

Verschiedene Clubs verfolgen unterschiedliche Fairplay- und Auslastungsmodelle:

- **Standard-Modell:**
  - Bis zu $N$ gleichzeitige Buchungen im Voraus (z. B. max. 2 offene Buchungen).
  - Kostenlose Stornierung bis 24 Stunden vor Spielbeginn.
- **Marly-Modell (Cooldown & Rolling Slot Release):**
  - Ein Mitglied hat z. B. 2 Slots Guthaben/Kontingent.
  - **Keine direkt aufeinanderfolgenden Buchungen:** Wer um 14:00 Uhr spielt, kann nicht zeitgleich 15:00 Uhr buchen (ausser bei 4 Spielern im Doppel).
  - **Rolling Release:** Der nächste Slot wird erst freigeschaltet, nachdem die Spielzeit des ersten Slots **abgelaufen** ist (oder frühestens mit Mindestabstand, z. B. 1 Stunde Pause).
  - Verhindert das "Hamstern" beliebter Abendstunden an aufeinanderfolgenden Tagen.

### Multi-Sportarten & differenzierte Platzpreise

Das System unterstützt mehrere Sportarten und Platzarten mit eigenen Tarifprofilen:

- **Tennis Freiplatz (Sand / Hartplatz):** Typischerweise im Club-Abo inklusive; für Gäste z. B. 30 CHF/h.
- **Tennishalle (Indoor Teppich / Granulat):** Höherer Tarif, z. B. 45 CHF/h (auch für Mitglieder teils kostenpflichtig oder über Winterabo abgedeckt).
- **Padel Courts:** Eigene Sportart mit 4 Spielern, separate Padel-Abos oder Buchungstarif (z. B. 40 CHF/h).
- **Peak / Off-Peak Tarife:** Abende (ab 17:00 Uhr) und Wochenenden können mit höheren Stundensätzen belegt werden.

### Zusatzleistungen & exklusive Ressourcen (Equipment Add-ons)

Clubs bieten buchbare Zusatzressourcen an:

- **Ballmaschine:**
  - Aufpreis pro Stunde (z. B. +10 CHF / Stunde).
  - **Exklusivitäts-Lock:** Da der Club meist nur 1 oder 2 Ballmaschinen besitzt, kann diese Ressource zeitgleich nur auf genau einem Platz gebucht werden. Das System verhindert Überbuchung der Ressource!
- **Flutlicht:**
  - Automatische Buchung bei Abenddämmerung oder als optionales Add-on (z. B. +5 CHF / Token).

### Regelprüfung

Die Regelprüfung muss eine zentrale Domain-Funktion sein:

```ts
checkBookingEligibility({
  user,
  membership,
  court,
  startAt,
  endAt,
  existingBookings,
  clubRules,
});
```

Die Funktion gibt entweder eine erfolgreiche Prüfung oder strukturierte Fehler zurück.

Beispiel:

```ts
{
  allowed: false,
  reason: "BOOKING_QUOTA_EXCEEDED",
  message: "Du hast bereits vier zukünftige Buchungen."
}
```

Mögliche Fehlercodes:

- `USER_NOT_AUTHENTICATED`
- `MEMBERSHIP_REQUIRED`
- `MEMBERSHIP_EXPIRED`
- `BOOKING_WINDOW_EXCEEDED`
- `BOOKING_QUOTA_EXCEEDED`
- `DAILY_LIMIT_EXCEEDED`
- `WEEKLY_LIMIT_EXCEEDED`
- `TIME_RESTRICTED`
- `COURT_RESTRICTED`
- `COURT_UNAVAILABLE`
- `COURT_BLOCKED`
- `BOOKING_CONFLICT`
- `DURATION_NOT_ALLOWED`
- `CLUB_CLOSED`

## 10. Zeit und Zeitzonen

- Alle Zeitpunkte werden in UTC gespeichert.
- Jeder Club besitzt eine IANA-Zeitzone, zum Beispiel `Europe/Zurich`.
- Benutzer sehen Zeiten in der Club-Zeitzone.
- Buchungsregeln werden in der Club-Zeitzone ausgewertet.
- Sommerzeit und Winterzeit müssen korrekt funktionieren.
- API-Zeitwerte werden als ISO-8601 übertragen.
- Keine lokale Zeit ohne Zeitzoneninformation speichern.

## 11. Doppelbuchungen verhindern

Die Anwendung muss Doppelbuchungen auf mehreren Ebenen verhindern.

### Anwendungsebene

- Vorprüfung der Verfügbarkeit.
- Buchung innerhalb einer Datenbanktransaktion.
- Wiederholte Requests mit Idempotency-Key behandeln.
- Temporäre Reservierungen mit Ablaufzeit unterstützen.

### Datenbankebene

PostgreSQL soll über einen geeigneten Exclusion Constraint oder eine äquivalente Lösung verhindern, dass aktive Buchungen desselben Platzes zeitlich überlappen.

Logik:

```text
Gleicher Platz
UND
Startzeit der bestehenden Buchung < Endzeit der neuen Buchung
UND
Endzeit der bestehenden Buchung > Startzeit der neuen Buchung
UND
Status ist aktiv
```

Mögliche aktive Status:

- `pending`
- `confirmed`

Nicht aktive Status:

- `cancelled`
- `expired`

## 12. Platzsperren

Admins können Plätze sperren.

Eine Sperre enthält:

- Platz.
- Startzeit.
- Endzeit.
- Grund.
- Öffentliche Beschreibung optional.
- Erstellt von.
- Erstellt am.
- Änderungszeitpunkt.

Sperrgründe:

- Wartung.
- Regen.
- Schnee.
- Turnier.
- Training.
- Veranstaltung.
- Privater Anlass.
- Sonstiges.

Standardmäßig verhindert eine Sperre neue Buchungen. Bereits bestehende Buchungen dürfen nicht automatisch gelöscht werden. Stattdessen muss der Admin bewusst entscheiden, ob betroffene Buchungen storniert und Benutzer informiert werden.

## 13. Wiederkehrende Buchungen

Wiederkehrende Buchungen werden nach dem MVP implementiert.

Unterstützte Muster:

- Wöchentlich.
- Alle zwei Wochen.
- Bestimmte Wochentage.
- Enddatum.
- Maximale Anzahl von Wiederholungen.

Beim Erstellen muss jede einzelne Instanz geprüft werden. Bei einem Konflikt soll der Benutzer sehen:

- Welche Termine erfolgreich wären.
- Welche Termine kollidieren.
- Ob nur konfliktfreie Termine erstellt werden sollen.
- Ob die ganze Serie abgebrochen werden soll.

## 14. Öffentliche Matches

Spätere Funktion für Community-Bildung.

Ein Organisator kann eine Buchung als öffentlich markieren.

Öffentliche Matchdaten:

- Club.
- Standort.
- Platz oder Platzart.
- Datum.
- Startzeit.
- Dauer.
- Spielniveau.
- Anzahl benötigter Spieler.
- Beschreibung.
- Sichtbarkeit.
- Beitrittsfrist.

Andere Benutzer können dem Match beitreten. Der Organisator kann Teilnehmer akzeptieren oder automatisch bestätigen.

Mögliche Status:

- Offen.
- Voll.
- Abgeschlossen.
- Abgesagt.

## 15. Zahlungen & Credits-System (Wallet)

### Integriertes Credits-System (Club-Guthaben)

Um Spielern und Clubs maximale Flexibilität zu bieten und Entwicklungs-/Testing-Zyklen drastisch zu vereinfachen, verfügt das System über ein **integriertes Credits- & Wallet-System**:

- **Prepaid-Guthaben / Credit-Konto:**
  - Jedes Mitglied bzw. jeder Gast kann ein Credit-Guthaben führen (z. B. 100 Credits = 100 CHF).
  - Credits können für Platzbuchungen (Non-Members), Gastgebühren oder Zusatzleistungen (Ballmaschine, Flutlicht) eingelöst werden.
- **Vorteile für Testing & Betrieb:**
  - **1-Klick Dev-/Testing-Aufladung:** Für Vorführungen und automatisierte Tests muss kein echter Kreditkartendialog durchlaufen werden; Tester können ihr Konto per Klick aufladen.
  - **Keine Transaktionsgebühren für jeden Einzelslot:** Clubs sparen Payment-Provider-Gebühren, wenn Mitglieder z.B. 100 CHF auf einmal einzahlen und daraus abbuchen.
  - **Admin-Gutschriften & Kulanz:** Admins können bei Spielausfällen (z. B. plötzlicher Regen) direkt Credits gutschreiben.

### Spätere Stripe-Integration (Kreditkarte / Twint)

Benötigt werden:

- Stripe Customer.
- Payment Intent.
- Payment Method.
- Zahlungsergebnis.
- Rückerstattung.
- Webhook-Verarbeitung.
- Idempotente Webhooks.
- Rechnungsinformationen.

Zahlungsstatus:

- `unpaid`
- `pending`
- `paid`
- `failed`
- `refunded`
- `partially_refunded`

### Multi-Club-Modell

Für eine Marketplace-Version kann Stripe Connect verwendet werden.

Möglicher Ablauf:

1. Club verbindet Stripe-Konto.
2. Spieler zahlt über die Plattform.
3. Plattform berechnet optional eine Gebühr.
4. Club erhält den verbleibenden Betrag.
5. Rückerstattung wird über die ursprüngliche Transaktion verarbeitet.

Split-Payments zwischen mehreren Spielern werden erst nach Validierung des Grundmodells implementiert.

## 16. Benachrichtigungen

### E-Mail-Benachrichtigungen

- Registrierung.
- E-Mail-Verifizierung.
- Passwort-Reset.
- Buchungsbestätigung.
- Buchungsänderung.
- Buchungsstornierung.
- Einladung als Mitspieler.
- Erinnerung vor dem Spiel.
- Benachrichtigung bei Platzsperre.
- Zahlungsbestätigung.
- Zahlungsfehler.

### Benachrichtigungseinstellungen

Benutzer können konfigurieren:

- E-Mail aktiv/inaktiv.
- Push später.
- Erinnerungen aktiv/inaktiv.
- Marketingkommunikation aktiv/inaktiv.
- Benachrichtigungen für Clubankündigungen.

## 17. Admin-Oberfläche

### Dashboard

Anzeigen:

- Buchungen heute.
- Auslastung heute.
- Offene Konflikte.
- Aktive Mitglieder.
- Umsatz, falls Zahlungen aktiviert sind.
- Gesperrte Plätze.
- Kommende Veranstaltungen.

### Kalenderverwaltung

Admins können:

- Buchungen ansehen.
- Buchungen erstellen.
- Buchungen bearbeiten.
- Buchungen stornieren.
- Buchungen verschieben.
- Platzsperren erstellen.
- Nach Benutzer suchen.
- Nach Platz filtern.
- Nach Status filtern.

### Mitgliederverwaltung

Admins können:

- Benutzer suchen.
- Benutzer einladen.
- Benutzer aktivieren/deaktivieren.
- Mitgliedschaft zuweisen.
- Mitgliedschaft verlängern.
- Rollen vergeben.
- Buchungshistorie ansehen.
- Datenschutzexport starten.
- Benutzer löschen oder anonymisieren.

### Regelverwaltung

Admins können:

- Mitgliedschaftspläne erstellen.
- Quoten definieren.
- Buchungsfenster definieren.
- Zeitfenster definieren.
- erlaubte Platzarten definieren.
- Gastregeln definieren.
- Stornierungsbedingungen definieren.

## 18. Statistiken

Nach dem MVP:

- Auslastung pro Platz.
- Auslastung pro Wochentag.
- Auslastung nach Uhrzeit.
- Auslastung nach Mitgliedschaft.
- Stornoquote.
- No-Show-Rate.
- Umsatz pro Platz.
- Umsatz pro Zeitraum.
- Anzahl Gastbuchungen.
- Durchschnittliche Buchungsdauer.

Auslastung:

```text
Auslastung =
gebuchte Minuten / verfügbare Minuten * 100
```

## 19. API-Entwurf

### Authentifizierung

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

### Clubs

```http
GET    /api/clubs
POST   /api/clubs
GET    /api/clubs/:clubId
PATCH  /api/clubs/:clubId
DELETE /api/clubs/:clubId
```

### Standorte und Plätze

```http
GET    /api/clubs/:clubId/locations
POST   /api/clubs/:clubId/locations
GET    /api/locations/:locationId/courts
POST   /api/locations/:locationId/courts
PATCH  /api/courts/:courtId
DELETE /api/courts/:courtId
```

### Verfügbarkeit

```http
GET /api/clubs/:clubId/availability
```

Query-Parameter:

```text
locationId
courtId
date
from
to
duration
```

### Buchungen

```http
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/:bookingId
PATCH  /api/bookings/:bookingId
POST   /api/bookings/:bookingId/cancel
POST   /api/bookings/:bookingId/participants
DELETE /api/bookings/:bookingId/participants/:participantId
```

### Sperren

```http
GET    /api/courts/:courtId/blocks
POST   /api/courts/:courtId/blocks
PATCH  /api/blocks/:blockId
DELETE /api/blocks/:blockId
```

### Mitgliedschaften

```http
GET   /api/clubs/:clubId/membership-plans
POST  /api/clubs/:clubId/membership-plans
PATCH /api/membership-plans/:planId
POST  /api/users/:userId/membership
```

## 20. Datenbankmodell

### `users`

```text
id
email
password_hash
first_name
last_name
phone
locale
timezone
status
email_verified_at
created_at
updated_at
deleted_at
```

### `tenants`

```text
id
name
slug
logo_url
timezone
address
email
phone
status
created_at
updated_at
```

### `tenant_users`

```text
id
tenant_id
user_id
role
status
created_at
updated_at
```

### `locations`

```text
id
tenant_id
name
address
latitude
longitude
status
created_at
updated_at
```

### `courts`

```text
id
tenant_id
location_id
name
surface
is_indoor
has_lighting
status
sort_order
created_at
updated_at
```

### `membership_plans`

```text
id
tenant_id
name
description
price
currency
booking_window_days
simultaneous_booking_limit
daily_booking_limit
weekly_booking_limit
monthly_booking_limit
allowed_durations
rules_json
status
created_at
updated_at
```

### `memberships`

```text
id
tenant_id
user_id
membership_plan_id
starts_at
ends_at
status
created_at
updated_at
```

### `bookings`

```text
id
tenant_id
court_id
organizer_id
starts_at
ends_at
status
booking_type
price
currency
notes
cancelled_at
cancelled_by
created_by
created_at
updated_at
```

### `booking_participants`

```text
id
booking_id
user_id
guest_name
guest_email
participant_role
invitation_status
payment_status
created_at
updated_at
```

### `court_blocks`

```text
id
tenant_id
court_id
starts_at
ends_at
reason
description
created_by
created_at
updated_at
```

### `payments`

```text
id
tenant_id
booking_id
user_id
provider
external_id
amount
currency
status
paid_at
refunded_at
created_at
updated_at
```

### `audit_logs`

```text
id
tenant_id
actor_id
action
entity_type
entity_id
metadata_json
ip_address
user_agent
created_at
```

## 21. UI-Anforderungen

### Allgemein

- Mobile-first.
- Desktop- und Tablet-Unterstützung.
- Tastaturbedienung.
- Ausreichende Farbkontraste.
- Keine Information darf ausschließlich durch Farbe vermittelt werden.
- Lade-, Fehler- und Leerzustände implementieren.
- Lokalisierbare Texte.
- Deutsche Standardsprache als erste Sprache.
- Englische Übersetzbarkeit vorbereiten.

### Buchungskalender

- Freie Slots klar anzeigen.
- Gebuchte Slots als nicht auswählbar darstellen.
- Gesperrte Slots