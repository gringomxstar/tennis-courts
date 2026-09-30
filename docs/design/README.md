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
- **Start:** Hero-Karte (Verlauf, Uhrzeit 60px, Avatare, drei Aktionen), Platzkarte (Linienzeichnung, freie Slots als Chips; im Produkt optional Clubfoto), Kommende Buchungen (Avatar-Liste), Heatmap „Wann ist heute frei?" (Plätze × Stunden), Abo-Donut.
- **Kalender:** Raster Plätze als Spalten, Stunden als Zeilen, Zellen 56px rund, Buchungen als farbige Blöcke (Icon nur bei 2 Stunden), aktuelle Stunde als dunkle Pille, gestrichelte Jetzt-Linie, ausgewählte Zelle mit „+ Reservieren", Formular rechts (320px). Handy: Tagesleiste, Stundenliste mit Platz-Chips, Tipp öffnet Sheet.
- **Mitglieder:** vier Kennzahl-Karten (eine im Verlauf), Tabelle mit Farb-Avataren und Status-Pills, Sammelaktions-Pille dunkel, Detailkarte + Balkendiagramm rechts. Handy: 2×2 Kennzahlen, Suche, Liste.

## Nicht im Entwurf, gleiche Sprache
Buchungen, Profil, Abos, Login/Register, Gast-Buchung, Heute, Sperren, Statistik, Einstellungen, Rechnung: dieselben Karten, Pillen, Chips und Tabellen. Dark Mode: gleiche Tokens invertiert (Grund `#101413`, Karte `#182120`).
