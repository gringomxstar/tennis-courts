# Funktionsübersicht: Fairgate availio Platzreservierungssystem

> Quelle: [Fairgate availio](https://fairgate.ch/availio/)  
> Stand: Analyse der Produktfeatures und Systemarchitektur

---

## 1. Übersicht & Architektur

**availio** ist das vollintegrierte Platzreservierungssystem der Schweizer Vereinssoftware Fairgate. Es richtet sich an Sportclubs und Center (Tennis, Padel, Badminton, Squash, Pickleball u. a.) und kombiniert eine Endnutzer-**WebApp**, ein Vor-Ort-Terminal (**availio BookingStation**) sowie eine tief integrierte **Club-Administration** mit direkter Anbindung an Finanzbuchhaltung (FIBU), Kontaktverwaltung, Swiss Tennis und Gebäudeautomation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Fairgate Gesamtplattform                      │
│                                                                        │
│   ┌─────────────────────┐   ┌───────────────────┐   ┌──────────────┐   │
│   │  Kontaktverwaltung  │   │   Finanzmodul &   │   │ Swiss Tennis │   │
│   │   & Mitgliedschaft  │   │  FIBU / eBill     │   │ Schnittstelle│   │
│   └──────────┬──────────┘   └─────────┬─────────┘   └───────┬──────┘   │
│              └────────────────────────┼─────────────────────┘          │
│                                       │                                │
│                           ┌───────────▼───────────┐                    │
│                           │   availio Core Engine │                    │
│                           └───────────┬───────────┘                    │
└───────────────────────────────────────┼────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌──────────────────┐          ┌───────────────────┐          ┌───────────────────┐
│     WebApp       │          │  BookingStation   │          │  Live-Bookings    │
│  (Spieler/User)  │          │   (Vor-Ort Kiosk) │          │  IoT & Automations│
│                  │          │                   │          │  API              │
│ • Kalenderbuchung│          │ • Touch-Terminal  │          │                   │
│ • Mitspieler/Gast│          │ • PIN-Login       │          │ • Lichtsteuerung  │
│ • TWINT / Karte  │          │ • Kiosk-Plätze    │          │ • Heizung         │
│ • Stornierung    │          │ • Live-Belegung   │          │ • Zutritt / Türen │
└──────────────────┘          └───────────────────┘          └───────────────────┘
```

---

## 2. User Interface (Endnutzer- / WebApp-Funktionen)

Die WebApp richtet sich an Clubmitglieder, Trainer sowie externe Gäste zur mobilen und Desktop-Nutzung.

### 2.1 Platzsuche & Buchungskalender
* **Klickbarer Buchungskalender:** Interaktive Kalenderansicht zur direkten Platzauswahl und Buchung per Klick/Tap auf freie Zeitfenster.
* **Multi-Club-Fähigkeit:** Unkompliziertes Buchen von Plätzen über verschiedene Sportclubs/Anlagen hinweg innerhalb der Plattform.
* **Optimierte Platzreihenfolge:** Übersichtliche Sortierung der Courts im Buchungskalender.
* **Echtzeit-Verfügbarkeit:** Transparente Anzeige freier, gebuchter, blockierter oder gesperrter Zeitslots.
* **Buchung nach Spielbeginn:** Konfigurierbare Möglichkeit, Plätze auch kurz nach Beginn der Spielstunde noch einzubuchen.
* **Einhaltung clubspezifischer Vorgaben:** Automatische Validierung von Regeln (z. B. nur volle Stunden buchbar, Back-to-Back-Buchungspflicht, maximale Vorlaufzeit).

### 2.2 Buchungsverwaltung & Stornierung
* **Persönliche Buchungsübersicht:** Auflistung aller bevorstehenden sowie vergangenen Reservierungen.
* **Stornierung & Fristen:** Stornierung gebuchter Plätze direkt in der WebApp unter Einhaltung der administrativ hinterlegten Fristen.
* **Serienbuchungen flexibel anpassen:** Bei wiederkehrenden Fixplätzen kann die buchende/verantwortliche Person einzelne Termine direkt in der WebApp freigeben (z. B. bei Abwesenheit).

### 2.3 Mitspieler- & Gästemanagement
* **Mitspieler hinzufügen:** Mitglieder können direkt bei der Buchung weitere Mitspielende (Partner/Doppel) auswählen.
* **Mitspieler ohne Account:** Hinzufügen von Mitspielenden, die über kein eigenes availio-Konto verfügen.
* **Gäste mitbringen:** Integrierte Gastmitnahme-Funktion mit automatischer Preisanzeige.
* **Teilnehmerbegrenzung nach Dauer:** Dynamische Begrenzung der maximal erlaubten Mitspieleranzahl gekoppelt an die gewählte Spieldauer.
* **Automatische Kostenaufteilung/Verrechnung:** Automatische Belastung zusätzlicher Mitspieler- oder Gastgebühren.

### 2.4 Zusatzleistungen & Equipment
* **Zusatzoptionen zubuchen:** Optionale Buchung von clubinternem Equipment (z. B. Ballmaschine, Leihmaterial oder Sonder-Services) direkt zusammen mit der Platzbuchung.

### 2.5 Bezahlung & Checkout
* **Integrierte Bezahlmethoden:**
  * **Fairgate Instant Payment:** TWINT, Kreditkarte, Debitkarte.
  * **Rechnung:** Kauf auf Rechnung (mit automatischer Verrechnung).
  * **Barzahlung:** Vor-Ort-Bezahlung (sofern vom Club zugelassen).
* **Preistransparenz:** Dynamische Preisberechnung nach Tageszeit, Benutzerkategorie, Early-Bird- oder Last-Minute-Tarifen.

### 2.6 Benutzerkonto, Onboarding & Benachrichtigungen
* **Einfaches Onboarding:** Registrierung über Einladungslink mit vorausgefülltem Formular.
* **Benachrichtigungen:** Sofortige Buchungsbestätigung per E-Mail sowie Push-Benachrichtigung.
* **Profilverwaltung:** Eigenständige Pflege der Profilangaben in der WebApp (optional mit Admin-Freigabeprozess).
* **Support:** Direkter Zugang zur Fairgate Mitglieder-Support-Hotline für Endanwender.

---

## 3. Vor-Ort Terminal (availio BookingStation / Kiosk)

Für die Anzeige und Buchung direkt auf der Clubanlage steht die **availio BookingStation** (Touchscreen-Hardware in Partnerschaft mit DAP IT-Solutions GmbH) zur Verfügung.

* **Live-Belegungsmonitor:** Öffentliche Anzeige des aktuellen Belegungsplans aller Courts auf der Anlage.
* **PIN-Login:** Schnelle und einfache Authentifizierung über einen persönlichen PIN-Code (keine lästige Eingabe von E-Mail und Passwort am Touchscreen nötig).
* **Exklusive Kiosk-Plätze:** Gezielte Freigabe bestimmter Plätze *ausschließlich* am Terminal vor Ort (zur Förderung von Spontanität und Clubleben).
* **Direktbuchung vor Ort:** Buchung von Plätzen für anwesende Mitglieder und Passanten direkt am Touch-Terminal.

---

## 4. Admin- & Verwaltungsfunktionen (Backend)

Die Administration ist nahtlos in das Fairgate-Backend integriert und bietet umfassende Steuerungs- und Kontrollmöglichkeiten.

### 4.1 Buchungskalender & Belegungssteuerung
* **Admin-Buchungskalender:** Zentrale Übersicht aller Standorte, Plätze, Belegungen und Sperrzeiten.
* **Zeitfilter & Ansichten:**
  * Umschaltung zwischen 24-Stunden-Ansicht und Öffnungszeiten-Filter.
  * Benutzerbezogenes Speichern der zuletzt genutzten Tages- und Kalenderansicht.
* **Drag-and-Drop Editor:** Buchungen direkt im Kalender verschieben, verlängern oder bearbeiten.
* **Buchungserstellung:** Manuelles Erstellen von Einzelbuchungen, Platzsperren oder Serienbuchungen (Fixplätze, Interclub, Training, Turniere).
* **Serienverwaltung:** Gesamte Serien oder einzelne Termine einer Serie stornieren bzw. verändern.
* **Sonderrechte bei Buchungsdauer:** Administratoren können individuelle Reservierungsdauern von bis zu 24 Stunden erfassen.
* **Platzsperren:** Flexible Sperrung von Einzelplätzen oder ganzen Anlagen für Wartung, Platzpflege, Wetterbedingungen oder Turniere.
* **Buchungslisten & Export:** Vollständige tabellarische Buchungsübersicht mit Filter- und Exportfunktionen (z. B. für Revisionen, Trainerabrechnungen).

### 4.2 Reservationsrichtlinien & Regelwerk-Engine
* **Saisonverwaltung:** Definition unterschiedlicher Saisons (z. B. Sommer-/Wintersaison) mit jeweils eigenen Parametern.
* **Hierarchische Regelskala:** Regeldefinitionen granular anpassbar pro:
  * Standort / Anlage
  * Einzelplatz oder Platz-/Objektgruppe (z. B. Hallenplätze, Sandplätze, Allwetterplätze)
  * Benutzergruppe
* **Zeitraster & Dauer:**
  * Festlegung buchbarer Zeitspannen (z. B. 60, 90, 120 Minuten).
  * Optionale Erzwingung von Buchungen "nur zur vollen Stunde" zur Vermeidung unrentabler Randzeiten/Lücken.
  * **Back-to-Back Buchungsregel:** Optionale Pflicht, Buchungen nahtlos an bestehende Buchungen anzuschliessen, um Leerlaufzeiten zu minimieren.
* **Vorlaufzeiten & Stornofristen:** Exakte Konfiguration, wie viele Tage/Stunden im Voraus gebucht oder kostenfrei storniert werden darf.
* **Buchungskontingente:** Begrenzung offener Reservierungen pro Benutzergruppe (z. B. maximal 2 aktive Reservierungen gleichzeitig pro Aktivmitglied).
* **Sonderöffnungszeiten:** Hinterlegung abweichender Öffnungszeiten für Feiertage, Events oder Revisionsarbeiten.

### 4.3 Benutzer- & Rechteverwaltung
* **Unlimitierte Benutzergruppen:** Beliebige Gruppen (z. B. Junioren, Aktive, Senioren, Schnuppermitglieder, Trainer, Vorstand, Externe).
* **Nahtlose Fairgate-Synchronisation:** Automatische Gruppenzuordnung über dynamische Filter, Rollen und Status in der Kontaktverwaltung (keine doppelte Datenpflege).
* **Granulare Admin-Rechte:** Eigene administrative Benutzerrechte speziell für das availio-Modul.
* **Genehmigungspflichtige Profiländerungen:** Optionale administrative Freigabe, bevor Änderungen von Nutzerprofilen aus der WebApp in den Hauptdatenbestand übernommen werden.
* **Automatisierte Einladefunktion:**
  * Importfunktion für bestehende Nutzer (z. B. bei Migration von GotCourts).
  * Stapelweiser E-Mail-Versand von Einladungslinks mit vorgefülltem Registrierungsformular.
  * Automatische Erinnerungsmails für noch nicht registrierte Nutzer.

### 4.4 Gästemanagement
* **Gast-Buchungsregeln:** Aktivierung/Deaktivierung der Gastmitnahme je Benutzergruppe.
* **Abweichende Gastzeiten:** Festlegung spezifischer Zeitfenster für Gastspiele (z. B. keine Gäste an Werktagabenden ab 18:00 Uhr).
* **Gästekontingente & Limits:** Limitierung der erlaubten Gastmitnahmen pro Spieler nach Tag, Woche oder Monat (z. B. max. 3 Gastspiele pro Saison).
* **Automatisierte Gastverrechnung:** Abrechnung der Gastgebühr direkt über das buchende Mitglied oder den Gast selbst.

### 4.5 Tarife, Preisgestaltung & Fakturierung
* **Matrix-Preissystem:** Individuelle Preismodelle definierbar nach:
  * Platz / Platzkategorie
  * Benutzergruppe (Mitgliederpreis vs. Gastpreis vs. Partnertarif)
  * Wochentag und Uhrzeit (Prime-Time vs. Randzeiten)
* **Dynamische Tarife:**
  * **Early-Bird Tarife:** Vergünstigungen für Buchungen am frühen Morgen.
  * **Last-Minute Tarife:** Automatische Preisreduktion für kurzfristig gebuchte Restzeiten.
* **Zusatzleistungen konfigurieren:** Preise für Ballmaschinen, Leihschläger, Flutlicht o. ä. anlegen und mit der Platzbuchung koppeln.
* **Vollautomatische Fakturierung:**
  * Direkte Rechnungserstellung unmittelbar nach Buchungsabschluss.
  * Versand von Rechnungen inkl. Schweizer QR-Rechnung und eBill-Anbindung.
  * Automatische Generierung von FIBU-Buchungssätzen für Bar-, Rechnungs- und Instant-Payment-Zahlungen.

### 4.6 Reporting, Auswertungen & Diagnose
* **Auslastungsstatistiken:** Grafische und tabellarische Reports zur Platzbelegung nach Zeit, Tag, Platz und Saison.
* **Einnahmenübersichten:** Detaillierte Finanzberichte über gebuchte Stunden, Gastgebühren und Zusatzleistungen.
* **Konfigurationsstatusprüfer:** Integriertes Diagnosetool zur automatischen Prüfung der Buchungsregeln auf Konflikte, Lücken oder Inkonsistenzen.

---

## 5. Automatisierung, Schnittstellen & Hardware-Integration

### 5.1 Gebäude- & Anlagenautomation (IoT)
* **availio Live-Bookings REST-API:** Standardisierte Programmierschnittstelle für den Echtzeit-Abruf aller Platzbuchungen.
* **Automatisierte Steuerungssysteme:**
  * **Lichtsteuerung:** Automatisches Ein- und Ausschalten des Platz-/Hallenflutlichts basierend auf Buchungsbeginn und -ende.
  * **Zutrittssteuerung:** Ansteuerung elektronischer Türen, Drehkreuze und Schliesssysteme (z. B. via PIN-Code oder RFID).
  * **Heizungs- & Klimasteuerung:** Bedarfsgerechte Temperierung von Tennishallen während gebuchter Slots zur Senkung von Energiekosten.
* **Zertifizierte Integrationspartner:** Vorkonfigurierte Gesamtlösungen über Partner wie *Mhochzwoi AG* und *meytronics GmbH*.

### 5.2 Swiss Tennis Verbandsschnittstelle
* **Lizenzverwaltung direkt in Fairgate:**
  * Swiss Tennis Lizenzen direkt in der Kontaktverwaltung bestellen, suspendieren und löschen.
  * Beseitigung der redundanten Pflege in der Swiss Tennis Verbandsdatenbank und im Clubsystem.

---

## 6. Direkter Funktionsvergleich: availio vs. GotCourts

| Feature / Kriterium | Fairgate availio | GotCourts |
| :--- | :--- | :--- |
| **Mitgliederverwaltung** | Direkt in Fairgate integriert; keine Synchronisation nötig | Eigenständige Benutzerverwaltung; manuelle Datenimporte |
| **Buchungskalender (WebApp)** | Klickbar, für alle Endgeräte optimiert | App- und Web-Buchungskalender |
| **Wiederkehrende Buchungen** | Einzelne Termine direkt durch Nutzer in WebApp stornierbar | Nur durch Club-Admin in der Verwaltung stornierbar |
| **Back-to-Back Buchungspflicht**| Ja (zur Vermeidung von Belegungslücken) | Nein |
| **Rechnungsstellung & FIBU** | Automatische Rechnung & Verbuchung in Fairgate FIBU (auch Instant Payment) | Datenexport nötig; Drittsystem-Verarbeitung |
| **Zahlungsmethoden** | Fairgate Instant Payment (TWINT, Kredit-/Debitkarte), Rechnung, Bar | TWINT, Kreditkarte, Guthaben, Bar |
| **Transaktionsgebühren** | 3.9 % + CHF 0.30 pro kostenpflichtige Buchung | Bis zu 8 % |
| **Regelwerk & Richtlinien** | Frei pro Platz, Benutzergruppe, Standort oder Objektgruppe | Nur pro Platz oder Benutzergruppe |
| **Zusatzdienstleistungen** | Beliebige Services & Equipment (Ballmaschine, Leihschläger etc.) | Nur Ballmaschine |
| **Gästemanagement** | Eigene Gast-Öffnungszeiten, Limits (Tag/Woche/Monat) & Gastpreise | Standard-Gastoptionen |
| **Onboarding** | Einladefunktion mit Erinnerungen & **Mitglieder-Support-Telefon** | Standard-Registrierung |
| **Kiosklösung vor Ort** | Ja (**availio BookingStation** inkl. PIN-Code) | Ja |
| **IoT / Anlagesteuerung** | Ja (**Live-Bookings REST API** für Licht, Heizung, Zutritt) | Ja |
| **Standorte & Externe** | Beliebig viele Standorte & Buchen ohne Account möglich | Mehrere Standorte & externe Buchende |
| **Reporting & Diagnose** | Detaillierte Statistiken & **Konfigurationsstatusprüfer** | Auslastungsberichte |
| **Kündigungsfristen** | Keine Vertragsbindung / monatliche Flexibilität | Häufig 6 Monate Kündigungsfrist |
