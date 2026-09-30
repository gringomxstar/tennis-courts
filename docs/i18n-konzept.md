# Konzept: Mehrsprachigkeit (DE / FR / EN, später IT)

Status: Idee, nichts gebaut. Stand 2026-09-30.

## Ausgangslage
- Alle Texte stehen fest auf Deutsch im Code: Komponenten, Server-Actions (Fehlermeldungen), Mails.
- Keine i18n-Bibliothek. Datums-/Zahlenformate sind teils fest `de-CH`.
- Next.js App Router, Routen `/c/[clubSlug]/...`.

## Ziel
Oberfläche in mehreren Sprachen, Übersetzungen ziehen bei Textänderungen automatisch nach.

## Vorgehen

### 1. Texte auslagern (der eigentliche Aufwand)
- `next-intl` (oder gleichwertig), Quelle `messages/de.json`.
- Sprache aus Cookie bzw. Profil-Einstellung, URLs bleiben unverändert (kein Umbau von `/c/[clubSlug]`).
- Mechanische Arbeit über ca. 40 Dateien und mehrere hundert Strings; gut an günstige Sub-Agenten delegierbar, 1–2 Sessions.
- Server-Actions liefern Fehlercodes oder Schlüssel statt fertiger deutscher Sätze, oder übersetzen serverseitig mit der Nutzersprache.

### 2. Automatisch aktuell halten
- Script vergleicht `de.json` mit `fr.json` / `en.json` (Hash je Schlüssel) und übersetzt nur neue oder geänderte Einträge per Claude-API.
- Läuft lokal vor dem Commit oder in CI beim PR; Ergebnis wird mitcommitet (Review im Diff möglich).
- Glossar (Sperre, Abo, Trainer, Platz, Guthaben …) steckt im Prompt, damit Begriffe stabil bleiben.
- Bestehende Übersetzungen bleiben unverändert, solange der deutsche Text gleich bleibt.

### 3. Formate und Nebenthemen
- `toLocaleDateString("de-CH")` u. ä. an die gewählte Sprache koppeln; Währung bleibt CHF.
- Stripe Checkout: Parameter `locale` setzen.
- Mails: Vorlagen je Sprache (gleiche Schlüssel-Logik).
- Öffentliche Gast-Seiten: Sprache aus Browser (`Accept-Language`), sonst Club-Standard.

## Nicht automatisch übersetzen
- Nutzerinhalte: Kursnamen, Clubnamen, Notizen, Beschreibungen.
- Live-Übersetzung zur Laufzeit: zu langsam, zu teuer, unzuverlässig bei Preisen, Stornoregeln, Fehlermeldungen. Vorübersetzt ist besser.
- Rechtstexte (AGB, Datenschutz): prüfen lassen.

## Risiken
- Qualität: bei Claude meist gut; Schweizer Französisch und Italienisch kurz von einer Muttersprachlerin / einem Muttersprachler durchsehen lassen.
- Textlängen: Französisch ist länger als Deutsch, enge Stellen (Chips, Tab-Bar, Buttons) testen.
- Teilweise übersetzte Seiten, wenn Schlüssel fehlen: Fallback auf Deutsch.

## Empfohlener Einstieg
Pilot mit einem Screen (Kalender) in DE/FR/EN: zeigt Aufwand, Layout-Probleme und Übersetzungsqualität, bevor alles umgestellt wird.
