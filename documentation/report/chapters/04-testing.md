# Testing

## Einführung
In diesem Kapitel werden die durchgeführten und automatisierten Tests aufgeführt.
Zudem wird auf spezielle Herausforderungen eingegangen, welche beim Testen aufgetreten sind.

## Unit Tests
Unit Tests werden primär in der Shared Library implementiert, da sich dort die gesamte Applikationslogik befindet.
Da die Applikation die meisten Operationen auf einem YJS Store durchführt, hat es sich herausgestellt, dass isolierte Unittests sehr schwer zu implementieren sind. Das Hauptproblem liegt bei der komplexen CRDT Datenstruktur, welche YSJ verwendet, diese ist sehr schwierig zu Mocken.
Zudem hätte für gewisse Tests ebenfalls der Message Broker gemockt werden müssen, was den Rahmen des Projektes gesprengt hätte.
Daher liegt der Fokus von automatisierten Tests auf der Integrationsstufe, wo immer mehrere Komponenten im Verbund getestet werden.

## Integrations Tests
Die Integrationstests sind in der Shared Library implementiert.
Zur Ausführung der Integrationstests muss eine lokale Mosquitto Instanz gestartet werden.
Damit wird aufwändiges Mocken von Messages umgangen.
Integrationstests wurden für folgende Komponenten erstellt:

### [hub](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/shared/tests/core/hub)
Hier wird geprüft. ob die Synchronisierung der Stores zwischen mehreren Instanzen korrekt funktioniert.
Dazu werden mehrere Hubs in verschiedenen Rollen instanziiert:
```typescript
const serverHub1 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher1, new wodss.core.db.DummyAdapter(), 'server', stateFactory)[1];
const serverHub2 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher2, new wodss.core.db.DummyAdapter(), 'server', stateFactory)[1];
const clientHub1 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher1, new wodss.core.db.DummyAdapter(), 'client', stateFactory)[1];
const clientHub2 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher2, new wodss.core.db.DummyAdapter(), 'client', stateFactory)[1];
```
Danach werden einzelne Stores manipuliert und geprüft, ob die Änderungen korrekt über die Message Queue synchronisiert werden.

### [mom](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/shared/tests/core/mom)
Hier wird geprüft, ob Messages korrekt über die Message Queue verschickt und empfangen werden können.
Zu diesem Zweck werden mehrere Message Queue Dispatcher instanziiert und test Messages über die Message Queue verschickt.
###  [msg](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/shared/tests/core/msg)
Hier wird geprüft, ob die Encodierung, Codierung und Kompression der Messages, welche über die Message Queue ausgetauscht werden, korrekt funktioniert.

### [store](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/shared/tests/core/store)
Hier wird geprüft, ob die YJS Patches korrekt auf den synchronisierten Store angewendet werden.
Zudem wird geprüft, ob der Store readOnly Flags und Mutexe respektiert und nur Daten ändert, welche auch geändert werden dürfen.

### [editor](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/shared/tests/editor)
Hier wird der [Fuzzy Test](#fuzzy-test), parallel (relativ zur Anzahl verfügbaren CPU Cores) ohne Browser in Form eines Jest Tests für 30 Sekunden ausgeführt.


## Performance Tests 
Es wurden verschiedene Ansätze geprüft, wie das System einem Lasttest unterzogen werden könnte.
Da das System keine REST APIs anbietet, können viele bekannte Lasttest Tools (Jmeter / Gatling / Postman) nicht eingesetzt werden.
Jmeter würde mittels eines Plugins das Versenden von mqtt Messages unterstützen.
Auf Grund der komplexen YJS Datenstruktur ergibt sich hier ein Problem bei der Bereitstellung von geigneten Testdaten.
Um diese Testdaten zu generieren, wäre es notwendig, die Shared Library in den Test einzubinden, um auf die entsprechenden YJS Funktionen zugreifen zu können.
Ein Testtool, welches diese Möglichkeit anbietet, wurde nicht gefunden.

Daher wurde ein eigener Fuzzy Test direkt in der Applikation implementiert.

### Fuzzy Test
Der Fuzzy Test kann mittels `/fuzzy.html` gestartet werden.
Folgendes User Interface wird angeboten:
![grafik](https://user-images.githubusercontent.com/47743448/169645996-bc5f58f9-5569-4b9a-a2bd-e4d5ac8b97e2.png)

- op/sec: Regelt die Operationen pro Sekunde, welche eine Instanz des Tests durchführt
- Instance: Anzahl Instanzen, welche gleichzeitig Operationen durchführen
- Latency: Ein Latenzzeitbereich, welcher im Dispatcher das Senden und Empfangen von Messages verzögert, um bei lokalen Tests eine langsame Internetverbindung zu simulieren
- Start: Startet den Test

Ablauf:

Für jede Instanz wird im Browser ein Iframe mit einer Applikationsinstanz gerendert:
![grafik](https://user-images.githubusercontent.com/47743448/169647824-a3420902-4326-4de7-8e71-69424e3762fa.png)

Der Test führt zufällig folgende Operationen aus:

- Paragraph hinzufügen: wenn weniger als 10 Paragraphen existieren
- Paragraph über einem anderen Paragraph hinzufügen: 30%
- Paragraph entfernen: 20%
- Text in einen Paragraph schreiben: 25%
- Paragraphen verschieben (move up / move down): 25%

Vor jeder Operation wird geprüft ob die Integrität, des Stores noch gewährleistet ist.
Dieser halb automatische Test unterstützt das manuelle Testing, da eine gut konfigurierbare Grundlast auf dem System generiert werden kann.

## [E2E Tests](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/tree/master/projects/frontend/tests/gui)
Für automatisierte GUI Tests wurden zwei Testframeworks [Cypress](https://www.cypress.io/) und [Selenium](https://www.selenium.dev/) evaluiert:

Da Cypress nur eine Browser Instanz unterstützt und somit keine Multiuser Tests implementiert werden können, wurde Selenium als E2E Testframework gewählt.

Selenium wurde mittels des [Geckodriver](https://github.com/mozilla/geckodriver/) für den Firefox eingerichtet.
Die Tests werden in TypeScript geschrieben und mittels Jest ausgeführt.

### Selektoren im HTML
Für einen reibungslosen Testaufbau wurden im HTML der Applikation alle, in Tests verwendeten, Elemente mit `data-test` [Attributen](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/data-*) versehen.
Damit sind sie für den Test eindeutig identifizierbar und nicht von CSS, Klasse oder ID abhängig.

### [Business Process Testing](https://www.softwaretestinghelp.com/what-is-business-process-testing-bpt/)
Die E2E Tests sind nach dem BPT Konzept gebaut.
Auf Grund der Verwendung von `data-test` Attributen wurde auf ein Komponenten Repository verzichtet.
Die Tests sind mittels eines Config Files konfigurierbar:
- headLess: Lässt den Browser ohne GUI laufen
- rootUrl: die URL auf welcher die Tests durchgeführt werden
- nrOfClient: Anzahl paralleler Client instanzen

Die einzlenen Komponenten der Tests sind als Funktionen definiert und werden in Spec Files zu Business Process Tests zusammengestellt.

### Ausführen der E2E Tests
- Application Stack lokal starten mit dem [`serve.sh docker`](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/blob/master/projects/serve.sh)
- Im Frontend mittels npm script `test:gui` [link](https://github.com/FHNW-WODSS-FS22/team-document-ofabel/blob/master/projects/frontend/package.json)

## Manuelle Tests
Funktionen, welche nicht mit automatisierten Tests geprüft werden, wurden manuell auf ihre Korrektheit geprüft.

### Aufallsicherheit Backend
Da mehrere Backend Instanzen eine Hochverfügbarkeit gewährleisten sollen wurde folgender Test durchführt:
- Starten des gesamten Systems mittels `server.sh docker`
- Somit wird folgender Application Stack aufgebaut:
- ![grafik](https://user-images.githubusercontent.com/47743448/169647113-82f0982c-87b0-49ed-b7a2-3d6cc18afc7f.png)
- Backend 1 (Master):
```
2022-05-20T16:15:06.582Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend - Client:      WG39dkMjR8yH_22I9ft-WQ
2022-05-20T16:15:06.582Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend - Database:    wodss
2022-05-20T16:15:06.583Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend - Revision:    a11ba23
2022-05-20T16:15:06.583Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend - YJS Version: 1
2022-05-20T16:15:06.584Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend - -----------------------------------
2022-05-20T16:15:06.589Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:hub - candidate asks who is in charge?
2022-05-20T16:15:06.597Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:dispatcher - hello from client Zg91j8TIQcWbtGWF9eppog received
2022-05-20T16:15:06.638Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:hub - new candidate Zg91j8TIQcWbtGWF9eppog joins the election ...
2022-05-20T16:15:06.638Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:hub - candidate asks who is in charge?
2022-05-20T16:15:08.689Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:hub - I'am in charge
2022-05-20T16:15:08.709Z [WG39dkMjR8yH_22I9ft-WQ] INFO backend:hub - participant is ready as server
```
- Backend 2 (BackUp):
```
2022-05-20T16:15:04.924Z [Zg91j8TIQcWbtGWF9eppog] INFO backend - Client:      Zg91j8TIQcWbtGWF9eppog
2022-05-20T16:15:04.925Z [Zg91j8TIQcWbtGWF9eppog] INFO backend - Database:    wodss
2022-05-20T16:15:04.925Z [Zg91j8TIQcWbtGWF9eppog] INFO backend - Revision:    a11ba23
2022-05-20T16:15:04.926Z [Zg91j8TIQcWbtGWF9eppog] INFO backend - YJS Version: 1
2022-05-20T16:15:04.926Z [Zg91j8TIQcWbtGWF9eppog] INFO backend - -----------------------------------
2022-05-20T16:15:04.931Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - candidate asks who is in charge?
2022-05-20T16:15:06.565Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:dispatcher - hello from client WG39dkMjR8yH_22I9ft-WQ received
2022-05-20T16:15:06.594Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - new candidate WG39dkMjR8yH_22I9ft-WQ joins the election ...
2022-05-20T16:15:06.596Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - candidate asks who is in charge?
2022-05-20T16:15:08.638Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - participant WG39dkMjR8yH_22I9ft-WQ is in charge
2022-05-20T16:15:08.867Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - participant is ready as client
```
- Der oben erwähnt Fuzzy Test mit mehreren Instanzen lokal ausführen
- Im Docker die Master Instanz manuell stoppen
- ![grafik](https://user-images.githubusercontent.com/47743448/169647325-f3edbcdb-d2dc-4732-affa-2ac89bf87133.png)
- Backend 2 übernimmt den Leadership:
```
2022-05-20T16:15:06.596Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - candidate asks who is in charge?
2022-05-20T16:15:08.638Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - participant WG39dkMjR8yH_22I9ft-WQ is in charge
2022-05-20T16:15:08.867Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - participant is ready as client
2022-05-21T10:22:50.201Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:dispatcher - bye from client WG39dkMjR8yH_22I9ft-WQ received
2022-05-21T10:22:50.368Z [Zg91j8TIQcWbtGWF9eppog] INFO backend:hub - replacing the leadership of WG39dkMjR8yH_22I9ft-WQ
```
- Der Fuzzy Test läuft normal weiter ohne, dass die Integrietätsprüfung fehlschlägt


### Logrotation
Die Logrotation der Logger Komponente wurde lokal geprüft:
- Lokal wurde die maximale Log Grösse auf 10KB und die maximlale Anzahl der Logfiles auf 15 gesetzt
- Der Logfolder aus dem Docker Container wurde auf ein lokales Volume gemountet
- Mittels des Fuzzy Tests wurden Logs generiert
- Dabei konnte lokal folgendes, korrektes Verhalten beobachtet werden:
![MicrosoftTeams-image](https://user-images.githubusercontent.com/47743448/169647668-7f2d1f7f-b5f2-41a7-9537-311ffe7f6265.png)
