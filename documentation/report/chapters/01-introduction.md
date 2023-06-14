# Einleitung

Projekt: Vertiefungs-Workshop Verteilte Systeme (WODSS)

Gruppe: 4

## Inhaltsverzeichnis

- [Architektur](./02-overview.md)
- [Entwicklung](./03-development.md)
- [Testing](./04-testing.md)
- [Komponenten](./05-components.md)
- [Schlussfolgerungen](./06-conclusions.md)

## Überblick

Im Rahmen der Fachvertiefung: Verteilte Systeme des FHNW Informatik Bachelor Studiums entstand dieses Projekt. Es wurde
eine message basierte multi User Applikation zur Editierung von Dokumenten, gemäss den
gegebenen [Spezifikationen](../../../GoogleDocsLight.md)
entwickelt.

## Bonus Features

- Hochverfügbares und horizontal skalierbares Backend
- Logging Topic, welches die Applications Logs publisht
- Vollständige Dockerisierung des Application Stacks
- Automatische CI/CD Pipeline mit automatischem Deployment des Master Branches in die Produktion
- Möglichkeit mehrere Dokumente anzulegen und zu bearbeiten
- Chat Funktion pro Dokument, zum Austausch während der Dokument Bearbeitung

