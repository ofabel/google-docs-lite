# Teststack

## Einführung

Um die Softwarequalität sicher zu stellen, werden verschiedene automatisierte testing Tools eingesetzt.
Hier werden die Tools und Qualitätssicherungsmassnahmen beschrieben.

## Funktionale Tests

Mittels den funktionalen Tests soll die korrekte Umsetzung der Funktionalitäten sichergestellt werden.

### Unit Tests

Da sowohl Frontend als auch Backend in Typescript geschrieben werden, kann dasselbe Unittest Framework für beide Teile eingesetzt werden.
Als Framework wird Jest (<https://jestjs.io/>) eingesetzt. Im Projekt wird eine Testabdeckung von 80% angestrebt.

### API Tests

Da die API mittels eines Message Brokers umgesetzt wird und selbst keine Logik implementiert, kann auf funktionale API Tests verzichtet werden.
Es wird ein Smoketest erstellt, welcher prüft ob der Message Broker läuft und korrekt konfiguriert ist, damit er Messages empfangen und weiterleiten kann.

### GUT Tests

Das Frontend wird mittels Selenium(<https://www.selenium.dev/>) getestet, da Selenium das Testing mittels mehreren simultanen Clients unterstützt.

## Nicht-Funktionale Tests

Mittels den nicht-funktionalen Tests werden nicht-funktionale Aspekte wie Belastbarkeit, Performance und Accessibility sichergestellt.

### Last- & Performance

Das MQTT System wird mittels JMeter und dem Plugin mqtt-jmeter(<https://github.com/xmeter-net/mqtt-jmeter>) auf Performance und Durchsatz geprüft.

### Usability und Accessibility

Beim Entwickeln des Frontends wird ein starker Fokus auf Barrierefreiheit gesetzt.
Um die Accessibility der Webseite zu Prüfen werden Browser Plugins von WAVE (<https://wave.webaim.org/extension/>) eingesetzt.

## Code Qualität

Damit eine einheitliche Code Strukturierung und allgemeine best practices eingehalten werden, wird ESLint(<https://eslint.org/>) eingesetzt.
