import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Archivo } from "next/font/google";
import sandplatz from "@/assets/sandplatz.webp";
import startLight from "@/assets/fuer-clubs/start-390-light.jpg";
import startDark from "@/assets/fuer-clubs/start-390-dark.jpg";
import calLight from "@/assets/fuer-clubs/calendar-390-light.jpg";
import calDark from "@/assets/fuer-clubs/calendar-390-dark.jpg";
import abosLight from "@/assets/fuer-clubs/abos-390-light.jpg";
import abosDark from "@/assets/fuer-clubs/abos-390-dark.jpg";
import deskLight from "@/assets/fuer-clubs/calendar-1440-light.jpg";
import deskDark from "@/assets/fuer-clubs/calendar-1440-dark.jpg";
import { RoleTabs, StoryPhone } from "./motion";
import "./fuer-clubs.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "TennisCourts für Clubs",
  description: "Platzreservation für Tennisclubs: Mitglieder, Gäste, Trainer und Vorstand in einer App, mit TWINT, Saison-Abos und Fairgate-Import.",
};

/** Light and dark screenshot; the app's theme class on <html> picks one (see fuer-clubs.css). */
function Shot({ light, dark, alt, sizes }: { light: StaticImageData; dark: StaticImageData; alt: string; sizes: string }) {
  return (
    <>
      <Image className="lt" src={light} alt={alt} sizes={sizes} placeholder="blur" />
      <Image className="dk" src={dark} alt={alt} sizes={sizes} placeholder="blur" />
    </>
  );
}

const phone = "(min-width: 980px) 320px, 280px";
const LIVE = "/";

const steps = [
  { k: "Start", h: "Die nächsten freien Zeiten stehen schon da.", p: "Die Startseite zeigt freie Plätze ab jetzt. Antippen, und die Buchung ist vorbereitet.", light: startLight, dark: startDark, alt: "Startseite mit den nächsten freien Zeiten" },
  { k: "Kalender", h: "Eine Zeile pro Platz, gross genug für jede Brille.", p: "Filtern nach Sand, Allwetter oder Padel. Auf dem Handy als Liste oder Raster mit genau zwei Plätzen pro Bildschirm.", light: calLight, dark: calDark, alt: "Kalender als Liste mit Stunden-Chips pro Platz" },
  { k: "Abo", h: "Wer oft spielt, sieht, wann sich das Abo lohnt.", p: "Die Abo-Seite rechnet vor: ab wie vielen Stunden das Abo günstiger ist als der Gasttarif.", light: abosLight, dark: abosDark, alt: "Abo-Seite mit Rechner und Junioren-Abo" },
];

const roles = [
  {
    id: "mit", label: "Mitglieder",
    big: "Buchen, stornieren, Mitspieler einladen. Ohne Anruf beim Platzwart.",
    sub: "Der Preis steht vor dem Klick fest. Was die App anzeigt, wird auch abgerechnet.",
    items: [
      ["Einzel und Doppel", "Mitspieler aus dem Club oder registrierte Gäste direkt auswählen."],
      ["Kosten fair geteilt", "Das Abo deckt den eigenen Anteil. Wer ohne Abo mitspielt, zahlt seinen Teil."],
      ["Selbst stornieren", "Bis zur Frist des Clubs. Alle Mitspieler bekommen eine Mail."],
      ["Guthaben", "Aufladen, automatisch abbuchen, jede Bewegung im Profil nachlesen."],
      ["Quittung per Link", "Jede Zahlung kommt mit Quittung in der Bestätigungsmail."],
      ["Auf dem Homescreen", "Wie eine App, mit Club-Logo als Symbol. Hell und dunkel."],
    ],
  },
  {
    id: "gas", label: "Gäste",
    big: "Gäste zahlen online. Und werden oft Mitglied.",
    sub: "Ohne Konto buchen, mit TWINT bezahlen, danach mit einem Passwort ein Konto behalten.",
    items: [
      ["Buchen ohne Konto", "Name und E-Mail reichen. Bestätigung per Mail."],
      ["Platz wird wieder frei", "Ohne Zahlung gibt die App den Platz nach 30 Minuten automatisch frei."],
      ["Abo-Rechner", "Zeigt, ab wie vielen Stunden sich das Abo gegenüber dem Gasttarif lohnt."],
      ["Diner Tennis", "Mo-Fr 11-13 Uhr bringen Mitglieder mit Abo einen Gast kostenlos mit."],
      ["Gastbuchungen steuern", "Der Club schaltet sie ein oder aus. Der Gasttarif gilt automatisch."],
      ["Belegt bleibt anonym", "Gäste sehen „Belegt“, nie die Namen der Mitglieder."],
    ],
  },
  {
    id: "tra", label: "Trainer",
    big: "Eine Saison Training in einem Formular.",
    sub: "Kurse über mehrere Plätze, Wochentage und Monate. Im Kalender steht der Kursname in seiner Farbe.",
    items: [
      ["Kurs als Serie", "Wochentage, Zeitraum, pro Platz eigene Zeit und Dauer. Bei einem Konflikt wird nichts halb gebucht."],
      ["Mehrere Kacheln", "Im Kalender markieren und als Kurs buchen. Am Desktop und am Handy."],
      ["Kurs bearbeiten", "Name, Farbe, Dauer ändern, einen Platz entfernen oder die ganze Serie absagen."],
      ["61 Tage voraus", "Trainer planen weiter voraus als Mitglieder, ohne Mitgliederlimiten."],
      ["Sieben Kursfarben", "Junioren, 50+, Interclub: jede Gruppe sofort erkennbar."],
      ["Trainer-Stunden", "Separat in der Statistik, als Grundlage für die Abrechnung."],
    ],
  },
  {
    id: "adm", label: "Vorstand",
    big: "Heute, Mitglieder, Sperren, Statistik, Einstellungen.",
    sub: "Fünf Bereiche für den Vorstand. Jede Aufgabe mit wenigen Taps erledigt.",
    items: [
      ["Heute", "Alle Buchungen mit Spielern. Offene Zahlungen als bezahlt oder erlassen markieren."],
      ["Mitglieder", "Suche, Filter nach Abo und Gültigkeit, Sammelaktionen, Rollen vergeben."],
      ["Platzsperren", "Wartung, Regen, Turnier, Wintersperre bis zu einem Jahr. Betroffene Buchungen sichtbar."],
      ["Statistik", "Auslastung nach Wochentag und Stunde, Einnahmen, Ein- und Austritte, offene Posten."],
      ["CSV für den Kassier", "Buchungen und Abo-Zahlungen als Export."],
      ["Ihr Look", "Clubname, Logo, App-Symbol, Clubfarbe und Farben pro Buchungsart."],
    ],
  },
] satisfies { id: string; label: string; big: string; sub: string; items: [string, string][] }[];

const more = ["Wintersperre", "Keine Doppelstunde im Einzel", "Junioren bis 18", "Alters- und Ausweisprüfung", "Demo-Modus", "Mehrere Clubs", "Paar-Abo", "Storno in Minuten", "Buchungsfarben", "CSV-Export"];

const roadmap = [
  ["Konzept steht", "Mehrsprachig", "Deutsch, Französisch, Englisch."],
  ["Idee", "Abgleich mit Fairgate", "Mitglieder automatisch synchron halten statt per CSV."],
  ["Geplant", "Kurs-Teilnehmer", "Teilnehmende und Mails pro Kurs."],
  ["Geplant", "Ballmaschine", "Zusatzleistungen mit dem Platz buchen."],
  ["Idee", "Licht und Türen", "Flutlicht und Zutritt nach Buchung steuern."],
  ["Idee", "QR-Rechnung", "Schweizer QR-Rechnung für Zahlung auf Rechnung."],
];

export default function FuerClubsPage() {
  return (
    <div className={`fc ${archivo.variable}`}>
      <header className="nav">
        <div className="w">
          <a className="mark" href="#top">
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <rect width="26" height="26" rx="7" fill="var(--clay)" />
              <path d="M5 9h16M5 17h16M13 9v8" stroke="#fff" strokeWidth="2" fill="none" />
            </svg>
            TennisCourts
          </a>
          <ul>
            <li><a href="#rollen">Funktionen</a></li>
            <li><a href="#bezahlen">Bezahlen</a></li>
            <li><a href="#saison">Abos</a></li>
            <li><a href="#fairgate">Fairgate</a></li>
          </ul>
          <Link className="btn go" href={LIVE}>Live ansehen</Link>
        </div>
      </header>

      <div className="w" id="top">
        <div className="hero">
          <Image className="hero-photo" src={sandplatz} alt="Tennisball auf einem Sandplatz neben der Grundlinie" priority placeholder="blur" sizes="100vw" />
          <div className="hero-copy">
            <span className="lab">Platzreservation für Tennisclubs</span>
            <h1>
              <span className="line"><span>Platz frei.</span></span>
              <span className="line"><span>Zwei Taps.</span></span>
              <span className="line"><span>Gebucht.</span></span>
            </h1>
            <p>Die Club-App für Mitglieder, Gäste, Trainer und Vorstand. Mit TWINT, Saison-Abos und Ihrem Logo.</p>
            <div className="cta">
              <Link className="btn go" href={LIVE}>Live ansehen <span className="arr">→</span></Link>
              <a className="btn" href="#rollen">Funktionen</a>
            </div>
          </div>
          <div className="hero-phone">
            <div className="phone"><Shot light={startLight} dark={startDark} alt="Startseite der App mit den nächsten freien Zeiten" sizes="300px" /></div>
          </div>
        </div>
      </div>

      <section className="w">
        <div className="story">
          <div>
            <div className="story-intro">
              <h2>So bucht ein Mitglied.</h2>
              <p>Kein Login-Marathon, keine Tabelle. Die App zeigt zuerst, was jetzt frei ist.</p>
            </div>
            {steps.map((s, i) => (
              <div key={s.k} className={i === 0 ? "step on" : "step"} data-i={i}>
                <span className="k">{s.k}</span>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
                <div className="inline phone"><Shot light={s.light} dark={s.dark} alt={s.alt} sizes={phone} /></div>
              </div>
            ))}
          </div>
          <StoryPhone screens={steps.map((s) => <Shot key={s.k} light={s.light} dark={s.dark} alt="" sizes={phone} />)} />
        </div>
      </section>

      <section className="w" id="rollen">
        <h2 className="tabs-head rv">Jede Rolle sieht nur, was sie braucht.</h2>
        <RoleTabs roles={roles} />
      </section>

      <section className="w" id="bezahlen">
        <h2 className="rv">Bezahlt wird vor dem ersten Aufschlag.</h2>
        <div className="bento">
          <div className="cell a rv">
            <h3>Geteilter Platzpreis</h3>
            <div className="price"><b>CHF 15</b><span>pro Person und Stunde</span></div>
            <div className="split">
              <span><b>CHF 30</b>Platz pro Stunde</span>
              <span><b>÷ 2</b>Spieler im Einzel</span>
              <span><b>CHF 0</b>Anteil mit Abo</span>
            </div>
            <p className="src">Beispielpreise. Jeder Club setzt eigene Preise.</p>
          </div>
          <div className="cell b rv">
            <Image src={sandplatz} alt="" sizes="(min-width: 980px) 400px, 100vw" />
            <h3>TWINT</h3>
          </div>
          <div className="cell c rv">
            <h3>Zahlungsarten</h3>
            <p>Online über Stripe. Weitere Arten schaltet der Club selbst zu.</p>
            <div className="methods"><span>TWINT</span><span>Kredit- und Debitkarte</span><span>Guthaben</span><span>Auf Rechnung</span><span>Vor Ort</span></div>
          </div>
          <div className="cell d rv">
            <h3>Flutlicht und Rückerstattung</h3>
            <p>Abendstunden rechnen Flutlicht automatisch mit ein. Wer rechtzeitig storniert, bekommt den Betrag zurück.</p>
          </div>
        </div>
      </section>

      <section className="w" id="saison">
        <span className="lab">Saison-Abos</span>
        <h2 style={{ marginTop: 14 }} className="rv">Ein Abo pro Saison. Verlängern ohne Lücke.</h2>
        <div className="season rv">
          <p>Abos laufen immer vom 1. April bis 31. März. Wer verlängert, bekommt die nächste Saison direkt angehängt.</p>
          <div className="track" aria-hidden="true">
            <div className="season-fill" />
            <div className="marks">
              {[0, 75, 87, 100].map((l) => <i key={l} style={{ left: `${l}%` }} />)}
            </div>
          </div>
          <div className="months" aria-hidden="true">
            {["Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez", "Jan", "Feb", "Mär"].map((m) => <span key={m}>{m}</span>)}
          </div>
          <div className="season-notes">
            <div><b>1. April</b><p>Saisonstart. Abo online kaufen, für sich oder als Paar-Abo.</p></div>
            <div><b>Ab Januar</b><p>Die nächste Saison ist schon kaufbar. Sie startet, wenn die laufende endet.</p></div>
            <div><b>Vor Saisonende</b><p>Erinnerungsmail an alle, deren Abo ausläuft, mit Link zum Verlängern.</p></div>
            <div><b>31. März</b><p>Saisonende. Beim Paar-Abo verlängert die kaufende Person für beide.</p></div>
          </div>
        </div>
      </section>

      <section className="w" id="fairgate">
        <h2 className="rv">Ihre Mitglieder kommen aus Fairgate. In einem Schritt.</h2>
        <p style={{ marginTop: 16 }} className="rv">Kontakte in Fairgate filtern, als CSV exportieren, in der App hochladen. Fertig.</p>
        <div className="fg">
          <div className="rv">
            <h3>Export aus Fairgate</h3>
            <pre className="csv">Vorname;Nachname;E-Mail;{"\n"}Geburtsdatum;<b>Abo</b>{"\n"}Léa;Rossier;lea@…;2009-05-14;<b>Junioren</b></pre>
          </div>
          <div className="arrow" aria-hidden="true">→</div>
          <div className="rv">
            <h3>Spalten erkannt</h3>
            <p>Die App erkennt die Fairgate-Spalten selbst, auch Umlaute aus Excel-Dateien.</p>
          </div>
          <div className="arrow" aria-hidden="true">→</div>
          <div className="rv">
            <h3>Mitglieder aktiv</h3>
            <p>Wer laut Abo-Spalte bereits bezahlt hat, ist für die Saison aktiv. Alle bekommen einen Link zum Passwort-Setzen.</p>
          </div>
        </div>
        <p className="aside">Ohne Fairgate? Mitglieder lassen sich auch von Hand erfassen. Geburtsdaten aus dem Import speisen die Junioren-Statistik.</p>
      </section>

      <section className="w">
        <div className="wide-head">
          <h2 className="rv">Am Desktop alle Plätze auf einen Blick.</h2>
          <p className="rv">Tag oder Woche, gefiltert nach Belag. Eine Linie markiert die aktuelle Uhrzeit.</p>
        </div>
        <div className="shot-wide">
          <Shot light={deskLight} dark={deskDark} alt="Desktop-Kalender mit neun Plätzen als Spalten und Stunden als Zeilen" sizes="(min-width: 1232px) 1200px, 100vw" />
        </div>
      </section>

      <div className="mq" aria-label="Weitere Funktionen">
        <div className="mq-t">
          {more.map((m) => <span key={m}>{m}</span>)}
          {more.map((m) => <span key={`d-${m}`} aria-hidden="true">{m}</span>)}
        </div>
      </div>

      <section className="w">
        <div className="rules">
          <div className="rv">
            <h2>Clubregeln prüft der Server.</h2>
            <dl>
              <dt>Buchungsfenster</dt><dd>Wie weit im Voraus, je Rolle und Sportart.</dd>
              <dt>Limiten</dt><dd>Maximal offene Buchungen pro Person.</dd>
              <dt>Storno-Frist</dt><dd>In Minuten oder Stunden.</dd>
              <dt>Folgebuchung</dt><dd>Keine Doppelstunde im Einzel, nächste Buchung erst nach Spielende.</dd>
              <dt>Preisregeln</dt><dd>Eigene Rabatte mit Name und Prozent.</dd>
            </dl>
          </div>
          <div className="trust rv">
            <h2>Zuverlässig, auch wenn viele gleichzeitig buchen.</h2>
            <div><h3>Keine Doppelbuchung</h3><p>Überschneidungen schliesst die Datenbank selbst aus, auch wenn zwei Leute gleichzeitig tippen.</p></div>
            <div><h3>Namen bleiben im Club</h3><p>Wer gebucht hat, sehen nur Mitglieder. E-Mail-Adressen sieht niemand.</p></div>
            <div><h3>Jeder Club für sich</h3><p>Eigene Adresse, eigene Plätze, eigene Regeln und Daten.</p></div>
          </div>
        </div>
      </section>

      <section className="w" style={{ paddingTop: 0 }}>
        <span className="lab">In Planung</span>
        <h2 style={{ marginTop: 14 }}>Was als Nächstes kommt.</h2>
        <div className="rail">
          {roadmap.map(([s, h, p]) => (
            <div key={h}><small>{s}</small><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </section>

      <div className="w">
        <div className="final">
          <Image src={sandplatz} alt="" sizes="100vw" />
          <h2>Probieren Sie es selbst.</h2>
          <p>Öffnen Sie den Kalender und buchen Sie wie ein Mitglied.</p>
          <Link className="btn go" href={LIVE}>Live ansehen <span className="arr">→</span></Link>
        </div>
        <footer><span>TennisCourts</span><span>Stand Oktober 2026</span></footer>
      </div>
    </div>
  );
}
