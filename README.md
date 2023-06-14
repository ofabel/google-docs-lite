# Readme

Die produktive Instanz ist unter [wodss.sufa.li](https://wodss.sufa.li/) erreichbar. Die Dokumentation befindet sich
[hier](./documentation/report/chapters/01-introduction.md).

## Konventionen

* JAVA Naming für Klassen und Komponenten (CamelCase)
* kebap-case für sonstige Ordner und Dateien
* Feature Branch Name `[V]orname` `[Na]chname` -> vna z.B. `ofa/feature-name`
* Feature Branches mit Squash Commit Fast-Forward Merging

## Hinweise zu Git

Um einen Branch zu pullen kann folgendes Kommando verwendet werden:

````bash
git pull origin <branch> --rebase
````

Um einen Branch zu rebasen kann folgendes Kommando verwendet werden:

````bash
git rebase <other>
````

Dieses Kommando macht einen rebase des aktuellen Branches auf den `<other>` Branch. Da dieser Befehl die History des
eigenen Branches verändert, ist danach ein force push notwendig:

````bash
git push orgin <branch> --force
````

Mehr Informationen zum Thema rebase finden
sich [hier](https://www.atlassian.com/git/tutorials/rewriting-history/git-rebase).

## Anforderungen

* [Node](https://nodejs.org/) 16.14.0
* npm 8.3.1
* [Docker](https://www.docker.com/) 20.10.12
* [Docker Compose](https://docs.docker.com/compose/install/) 1.29.2
* Bash kompatibler Kommandozeileninterpreter

**Hinweis: Zur einfachen Installation verschiedener Node Versionen eignet sich
der [Node Version Manager](https://github.com/nvm-sh/nvm).**

## Entwicklungsumgebung aufsetzen

1. Eine `bash` Kommandozeile öffnen und in den `projects` Ordner navigieren.
2. Das `install.sh` Skript ausführen. Dieses Skript installiert alle Abhängigkeiten in den Unterprojekten.
3. Das `setup.sh` Skript mit dem Argument `local` ausführen: `./setup.sh local`. Dieses Skript erzeugt die notwendigen
   Logging Konfigurationen und `.env` Dateien für die lokale Entwicklung.
4. In den Ordner `projects/mosquitto` navigieren.
5. Das `start.sh` Skript ausführen. Dieses Skript startet eine Mosquitto Instanz in einem Dockercontainer.
6. In den Ordner `projects/mongodb` navigieren.
5. Das `start.sh` Skript ausführen. Dieses Skript startet eine Mongo Datenbank Instanz in einem Dockercontainer.

Diese Schritte sind nur einmal, zum Initialisieren der Entwicklungsumgebung, notwendig. Der Mosquitto Container trägt
den Namen `wodss-mosquitto`. Dieser kann jeweils während der Entwicklung von Hand gestartet werden:

````bash
docker start wodss-mosquitto
````

Zum Stoppen des Containers genügt folgendes Kommando:

````bash
docker stop wodss-mosquitto
````

Analog dazu kann die Mongo Datenbank gesteuert werden:

````bash
docker start wodss-mongodb
````

````bash
docker stop wodss-mongodb
````

## Das Projekt mit Docker laufen lassen

1. Eine `bash` Kommandozeile öffnen und in den `projects` Ordner navigieren.
2. Das `serve.sh` Skript mit dem Argument `docker` ausführen: `./serve.sh docker`. Dieses Skript startet
   mit `docker-compose` die Container.
3. Einen Browser öffnen und nach [http://localhost/](http://localhost/) navigieren.
4. Der Monitor ist
   unter [http://localhost/monitor.html](http://localhost/monitor.html#eyJ1cmwiOiJ3czovL2xvY2FsaG9zdDoxOTAwMS93cyIsInVzZXJuYW1lIjoibW9uaXRvciIsInBhc3N3b3JkIjoicEJaN2dDcVREc0g0Q2RORW8ydVAifQ==)
   erreichbar.
