# Plan Anlässe (Events) – Entwurf 2026-10-08

Etappen: E1 MVP (Vorlagen, Einladen Mitglieder/Abo-Typ/Sponsoren/Gäste, Zu-/Absage ohne Login, Begleitpersonen, Warteliste mit Nachrücken, Erinnerungs-Cron, Platzsperre automatisch, CSV, ICS) · E2 Zahlung Twint/Karte (purpose "event"), Gäste von Mitgliedern, Turnier Einzel/Doppel · E3 Helfer-Schichten, QR-Check-in, Auslosung/Spielplan/Resultate, Serien.

Datenmodell E1 (additiv): enum EventReply {INVITED YES NO WAITLIST}; Event (tenantId, title, kind, startsAt, endsAt, location?, description?, priceNote?, deadline?, maxSeats?, maxPlusOnes, createdById, cancelledAt?); EventInvite (eventId, userId?, sponsorId?, email, name, reply, plusOnes, comment?, sentAt?, remindedAt?, respondedAt?, @@unique[eventId,email]); CourtBlock.eventId? (Cascade). Vorlagen als Konstante in src/lib/events.ts.

Regeln: Link öffnet Seite, Antwort nur per POST (Mail-Scanner!). HMAC-Token eventToken(inviteId) in booking-link.ts. Warteliste: belegt = Σ(1+plusOnes) der YES; Überlauf → WAITLIST nach respondedAt; Absage/Reduktion → Nachrücken + Mail; Advisory-Lock pro Event. Nach Anmeldeschluss nur Absage. Cron: Versand-Queue (max/Tag), Erinnerung 2 Tage vor Schluss an Offene, Tag vorher an Zusagen mit ICS.

Pakete: WP0 Schema+lib+tests (sequenziell) → WP1 Admin (actions/events.ts, admin/events/**, admin-events.tsx, admin-event-detail.tsx, Hub-Kachel, tab-bar) ∥ WP2 Öffentlich/Mitglied (app/e/[inviteId]/**, actions/event-reply.ts, event-reply.tsx, home-view.tsx) ∥ WP3 Cron (api/cron/events, vercel.json).

Risiken: Brevo 300/Tag (Queue, Option «nur App»), Datenschutz Kommentar (nur Admin), geteilte DB (nur additiv, DATABASE_URL UND DIRECT_URL beachten), Sperren bei Verschiebung mitziehen.

## Entscheide Alain 2026-10-08
1 Kostentext «vor Ort», keine Online-Zahlung · 2 Begleitpersonen ja · 3 keine nicht eingeladenen Gäste · 4 Sponsoren sehen nur Anzahl · 5 Mitglieder sehen Namen der Zugesagten · 6 Turnier-Anmeldung Einzel/Doppel nicht nötig · 7 Brevo später upgraden (jetzt nur Test) → Versand sofort, keine Tages-Drosselung · 8 pro Anlass wählbar: Mail oder nur App · 9 Erinnerungen automatisch · 10 nur Club-Admin erstellt
