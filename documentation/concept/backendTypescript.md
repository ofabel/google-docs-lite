# Technologiestackinformation Typescript

## Einführung

Typescript erweitert Javascript um Typisierungsinformationen sowie Syntax- und Codeverifizierung zur Compile- statt zur Laufzeit. Es kann entsprechend auch so konfiguriert werden, dass implizite Typenänderung (man kann in einer Variable sowohl Strings als auch Zahlen speichern) wie sie im Standard Javascript erlaubt und üblich sind als Fehler angesehen werden und abgefangen werden müssen.

Die generelle Grundidee ist, dass man immernoch normales Javascript verwenden kann aber den Code ein wenig robuster gegen Syntaxfehler zu machen.

## Vergleich im Überblick

* Typisierte Variablen  `var value : string` -> Nur ein String ist hier gültig

        //Returns a type not assignable error
        var x: string = 56

* Selber definierte Typen mit dem `interface` Keyword, welche wie von OOP Sprachen bekannt als Klassen implementiert werden können, diese können wiederum als Variablentypen verwendet werden.

``` typescript
        interface Point {
            x: number;
            y: number;
        }

        function printCoord(pt: Point) {
            console.log("The coordinate's x value is " + pt.x);
            console.log("The coordinate's y value is " + pt.y);
        }

        printCoord({x: 5, y:7});
```

* Generics welche die generische Typen erlaubt - `type NumberArray = Array<number>` definiert einen Array-Typen bei dem nur Zahlen erlaubt sind.
* Union Typen, falls man eine Variable doch mit unterschiedlichen Typen verwenden will: `id: number | string`

``` typescript
        function printId(id: number | string) {
            if (typeof id === "string") {
                // In this branch, id is of type 'string'
                console.log(id.toUpperCase());
            } else {
                // Here, id is of type 'number'
                console.log(id);
            }
            }
 ```


* Explizites deklarieren von optionalen Funktionsparametern `function f(x: number)` braucht zwingend ein Argument `function f(x?: number)` kann auch ohne Argument aufgerufen werden
* Unterstützung von Tuple Typen `tuple: [string, number]`, der nach der Initialisierung eine feste Grösse und klare Typzuweisungen hat.
* Sichtbarkeit von Klassen-/Methodenvariablen mittels den bekannten `public, protected, private (auch in "Standard" JS mit #)` Modifizierern


