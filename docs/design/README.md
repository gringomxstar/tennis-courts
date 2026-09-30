# Design v3 (abgenommen 30.09.2026)

Quelle: `entwurf-v3.html` in diesem Ordner (identisch mit dem Artifact, das Alain freigegeben hat). Ein Markup, drei Breiten über Container-Queries. Der Port übernimmt Werte 1:1; Abweichungen nur mit Begründung im PR.

## Tokens (siehe `.app { … }` im Entwurf)
- Clubfarbe: `--brand #147a68`, `--brand-deep #0f5c4f`, `--brand-dark #0b433a`, `--brand-soft #d6ece6`, `--brand-tint #ecf5f2`. Im Produkt kommt der Grundton aus `settingsJson.brandColor`; die Stufen werden mit `color-mix` abgeleitet (wie heute `--tennis-clay`).
- Grund `--bg #e9efec`, Karte `#fff`, Text `--ink #16201d` / `--ink-2 #4f5e5a` / `--ink-3 #8a9793`, Linie `#e6ecea`.
- Platzfarben: Sand `#e0653a`, Allwetter `#4c6b8a`, Padel `#3a7bd5`.
- Buchungstypen: eigene `#147a68`, Mitglied `#38b58a`, Gast `#f0a33a`, Training `#7c5cff`, gesperrt `#b9c3c0` (gestreift). Status: ok `#1f8a5b`/`#dcf3e8`, offen `#b5680c`/`#fdefd6`, abgelaufen `#c9432f`/`#fde3df`.
- Handy-Hero: Navy-Verlauf `#1f2f52 → #14213d → #0f182c`, Button grün `#38b58a`.
- Schatten: `0 10px 30px -12px rgba(15,60,50,.16), 0 2px 6px rgba(15,60,50,.04)`; Hero `0 24px 50px -24px rgba(15,60,50,.35)`.
- Radien: Karten 24px, innere Elemente 12–16px, Buttons/Chips/Pillen 999px.
- Schrift: Outfit 400–800 (Google Fonts, `next/font`), tabellarische Ziffern überall.

## Shell
- ≥ 640px: Icon-Leiste links (72px, weisse Karte, aktiver Button rund in `--brand-deep`), oben Pillen-Navigation (Start · Kalender · Buchungen · Profil, im Admin-Bereich Heute · Mitglieder · Sperren · Statistik · Einstellungen), Suche, Glocke, Avatar. App-Padding 16px, Karten-Gap 16px.
- < 640px: keine Leiste, Inhalt 16px Rand, dunkle schwebende Pille unten (aktiv grün), Titelzeile mit rundem Plus-Button.
- < 1100px: Seitenpanels (Formular, Detail) werden zum Sheet/Dialog; 3-Spalten-Raster wird 2-spaltig.

## Screens im Entwurf
Umschalter oben in drei Gruppen (Mitglied, Zugang, Verwaltung), jede Seite bei 390 vollständig, bei 1024/1440 fliessen die Karten um. Sheets sind auf dem Handy unten, ab 640px ein Dialog in der Mitte. Pinke Zahlen in den Buchen-Screens sind Tipp-Zähler (nur Entwurf).

**Mitglied**
- **Start:** Hero-Karte (Verlauf, Uhrzeit 60px, Avatare, drei Aktionen), Platzkarte mit freien Slots als Buttons (Tipp öffnet direkt das Buchungs-Sheet), Kommende Buchungen, Heatmap, Abo-Donut. Plus-Button trägt auf dem Handy jetzt Text („Reservieren“).
- **Kalender, zwei Handy-Varianten** (Desktop bleibt: Raster Plätze × Stunden, Formular rechts 320px):
  - **A (Vorschlag v3):** Tagesleiste, Stundenliste mit Platz-Chips.
  - **B (heutige Idee):** pro Platz eine Zeile mit Stunden-Chips, umschaltbar Liste/Raster (Raster = 9 Plätze × Stunden).
- **Buchen in 3 Zuständen:** 1 Slot gewählt, 2 Sheet (Dauer, Mitspieler mit letztem vorausgewählt, Preis-Split „Abo deckt eigenen Anteil, Rest zahlt, wer bucht“, Zahlart Twint/Karte/Guthaben), 3 Bestätigung.
  - **Tipps:** über den Kalender 3 (Kalender → Platz/Stunde → Reservieren), in A und B gleich. Über die Platzkarte auf Start 2. Anderen Mitspieler wählen = +1.
- **Buchungen:** Kommend/Vergangen, Tipp öffnet **Buchungsdetail**-Sheet (Spieler mit Abo-Status, Preis, Stornieren). Serien mit „Serie stornieren“ nur für Trainer.
- **Profil** (heutige Reihenfolge): Guthaben-Karte im Verlauf mit Aufladen, Abo, Daten, Rechnungen, Schalter, Abmelden.
- **Abos** (heutige Struktur): abgelaufenes Abo vorausgewählt, Sportart, Für mich/Als Paar, Optionen, Kaufleiste unten mit Auto-Verlängern, ein Tipp verlängert.
- **Rechnung:** Beleg mit Status, PDF/E-Mail, weitere Belege, offener Betrag direkt bezahlbar.

**Zugang** (ohne Navigation): **Einstieg** (abgemeldet, heutige Struktur: Mitglied anmelden primär, Als Gast buchen, Mitglied werden → Abo-Seite, dort Abo wählen, dann Registrieren und bezahlen; „Jetzt frei“ als seitwärts scrollende Slot-Reihe; ohne Abo keine Mitglied-Buchung), **Login** (mit Fehlerzustand, Gast-Button), **Registrieren**, **Gast-Buchung** (Slot, Name/E-Mail/Handy, Twint oder Karte, Preis-Split).

**Verwaltung**
- **Übersicht (/admin):** Kacheln pro Bereich mit der wichtigsten Zahl.
- **Heute:** Regen-Schalter „alle Sandplätze sperren“ zuoberst, vier Kennzahlen, Belegungs-Heatmap, nächste Buchungen.
- **Sperren:** Formular (Grund, Plätze, Von/Bis, Wiederholen, Warnung zu betroffenen Buchungen) und Liste aktiv/geplant.
- **Mitglieder:** vier Kennzahl-Karten, Tabelle mit Farb-Avataren und Status-Pills, Sammelaktions-Pille, Detailkarte + Balkendiagramm. Handy: 2×2 Kennzahlen, Suche, Liste.
- **Statistik:** Jahr-Pillen, vier Kennzahlen, Einnahmen pro Monat, Auslastung pro Platz, „CSV exportieren“ als Text-Button.
- **Einstellungen:** Regeln, Plätze, Tarife, Branding als Karten, Speichern-Leiste dunkel und sticky (Handy über der Navigation).

## Regeln aus der Abnahme
- Klarheit vor Optik, so wenig Tipps wie nötig. Hauptaktion ohne Scrollen sichtbar, Aktionen immer mit Text, keine Box in der Box.
- Leere und Fehlerzustände zeigen, wo sie zählen (kein Abo, falsches Passwort, betroffene Buchungen beim Sperren).

## Noch nicht im Entwurf
Dark Mode: gleiche Tokens invertiert (Grund `#101413`, Karte `#182120`).
