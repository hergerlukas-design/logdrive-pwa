## 📑 AKTUALISIERTES MASTER-MANIFEST: "LogDrive PWA"

### Daten-Mapping (Dropbox-Dateiname)
Das Schema lautet: `Betrag_Projekt_Datum_Zusatz.pdf`
* **Betrag:** Kosten des Tankvorgangs/Ladens.
* **Projekt:** Der Kunde/Auftraggeber (z. B. "Audi").
* **Datum:** Zeitpunkt der Ausgabe.
* **Zusatz:** Das **Kennzeichen** (Der Match-Key für unsere Datenbank).

---

## 🛠 Aktualisierter Prompt für Chat D: [INTEGRATION SERVICE]

> **Initial-Prompt (V2):**
> "Du bist der Integrations-Spezialist für 'LogDrive PWA'. Deine Aufgabe ist die Verknüpfung der App mit einer Dropbox-Ablage.
> 
> **Die Logik:** In einer Dropbox landen PDF-Scans von Tankbelegen. Der Dateiname folgt dem Schema: `Betrag_Projekt_Datum_Zusatz.pdf`.
> 
> **Deine Aufgabe:**
> 1. Erstelle eine Logik (Node.js/Edge Function), die den Dropbox-Ordner scannt.
> 2. **Parsing-Regel:** >    - `Betrag` -> `amount`
>    - `Projekt` -> `customer` (Zuweisung zum Eintrag)
>    - `Datum` -> `date`
>    - `Zusatz` -> **Kennzeichen** (Wichtig: Hiermit wird das Fahrzeug in der Datenbank identifiziert).
> 3. Verknüpfe den Beleg automatisch mit dem Fahrzeug in der Supabase-Tabelle `vehicles`, das dieses Kennzeichen trägt.
> 
> **Vorgabe:** Nutze den vorhandenen Dropbox App-Key. Der Code muss sicher, professionell und ohne Abkürzungen geschrieben sein."

---

## 📊 Projekt-Zusammenfassung (Status: Ende Konzeptionsphase)
*Dies ist die vereinbarte Zusammenfassung nach dem 7. Prompt.*

| Bereich | Status & Details |
| :--- | :--- |
| **Projektname** | **LogDrive PWA** |
| **Rolle AI** | Code Agent (Vollständige, professionelle Begleitung) |
| **Plattform** | Mobile First PWA (Vite, React, Tailwind) |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) |
| **Besonderheit** | Multi-Driver & Multi-Vehicle Management |
| **Scanner-Logik** | Dropbox-Integration; Parsing von `Betrag_Kunde_Datum_Kennzeichen.pdf` |
| **Arbeitsweise** | Getrennte Chats (Architekt, DB, Frontend, Integration) |
| **Nächster Schritt** | Versionsprüfung am PC & Initialisierung Chat B (Datenbank) |