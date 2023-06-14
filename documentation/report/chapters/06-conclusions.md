# Schlussfolgerungen und Ausblick

Im folgenden Teil ziehen wir Rückschlüsse zum Projekt und wagen einen Ausblick, zu möglichen Projekt Erweiterungen.

## Schlussfolgerung

Da wir uns im Team mehrfach neu organisieren mussten, konnten nicht alle Komponenten mit der gewünschten Sorgfalt
entwickelt werden. Manche Teile des Codes sollten vor der Implementierung neuer Features gehärtet und gegebenenfalls
refactored werden. Dies betrifft insbesondere folgende Bereiche:

* Der Sync Store Hub verfügt über kein Interface und durch Anwendung des _Strategy Patterns_ könne der Code vereinfacht
  werden.
* Die Testabdeckung der Shared Bibliothek müsste erhöht werden. Vor allem fehlen Unit Tests mit einem sauberen Mocking
  der Abhängigkeiten.
* Die Regressionstests in der Shared Bibliothek müssten refactored werden, sie prüfen zu viel auf einmal.
* Die Vue Komponenten im Frontend müssten überarbeitet werden, sie sind zu Komplex und müssten in mehrere kleinere
  Komponenten aufgespalten werden.

Zudem sollte die Testabdeckung im Frontend Teil und bei den E2E Tests erhöht werden. Beim lokalen automatisierten Testen
sind einige inkonsistente Zustände oder Synchronisierungsfehler aufgefallen, die jedoch nicht zuverlässig reproduziert
werden konnten. Zum Beispiel haben wir festgestellt, dass ein Browserfenster, sobald es minimiert, oder durch ein
anderes Fenster komplett verdeckt wird, seinen JavaScript Event-Loop pausiert. Dies führt dazu, dass Updates der Message
Queue nicht mehr angewendet werden und die Instanz quasi "offline" ist ohne jedoch die Verbindung zu verlieren. Wird das
Fenster danach wieder in den Vordergrund geholt, hat es einen alten State und evtl. auch ein Dokument über die gesamte
Zeitdauer gelockt.

Solche Probleme und Phänomene müssten noch genauer analysiert und entsprechend behandelt werden.

Im Grossen und Ganzen sind wir von unserer Technologie- und Architekturwahl überzeugt und würden für diese
Aufgabenstellung wieder denselben Ansatz verfolgen. Es bereitete uns grossen Spass mit neuen Technologien zu
experimentieren und unser Projekt im Rahmen des Workshops umzusetzen.

## Ausblick

Das Projekt bietet viele Möglichkeiten für Erweiterung, welche bewusst nicht angegangen wurden.

### User Management

Mittels des Mosquitto dynamic Security Plugins könnte eine User Verwaltung implementiert werden. Gewisse Admin Benutzer
könnten mittels eines management Topics über ein Webinterface neue Benutzer anlegen und berechtigen. Zudem könnten die
Berechtigungen bis auf Dokument Ebene implementiert werden.

### Offline Editierung

YSJ würde die Möglichkeit für eine offline Szenario bieten, bei welchem Änderungen in einem offline Store abgespeichert
würden und bei erneuter Internetverbindung mit dem synchronisierten State abgeglichen würden.

### Dezentrale Integritätsprüfung des verteilten States

Es könnten Algoritmen z.B. aus dem Blockchain Umfeld verwendet werden, um Integritätsverletzungen im State zu entdecken
und zu unterbinden.

### Anbindung weiterer monitoring und analyse Werkzeuge

Über das Logging Topics könnte der Application Log mittels eines Adaptes für weitere Monitoring Tools aufbereitet
werden. Die Logs könnten zusätzlich in einer [InfluxDB](https://www.influxdata.com/) archiviert und aufbereitet werden.
So könnte auch der Nutzerverhalten genau analysiert werden.

### Horizontale Skalierung über mehrere Server

Die momentante Lösung ist mittels Docker-Compose umgesetzt. Eine horizontale Skalierung
mittels [Kubernetes](https://kubernetes.io/de/) oder [Docker Swarm](https://docs.docker.com/engine/swarm/), wäre mit
unserer Applikation im Prinzip einfach möglich. Tests bezüglich Performance mit mehreren MQTT Brokern und Backends, die
auf verschiedenen Servern betrieben würden, wären daher sehr interessant.

### Dokument Historie / Undo Funktionalität

Yjs würde grundsätzlich die Möglichkeit bieten, eine Dokument Historie aufzubauen. Somit liessen sich Änderungen
nachverfolgen und der State eines Dokuments auf einen bestimmten Stand zurück setzen. Diese Funktionalität wurde nicht
aktiviert, da sie womöglich die Dokument Strukur schwerfälliger und grösser machen könnte. Wäre aber sicherlich ein
interessanter Feature.

