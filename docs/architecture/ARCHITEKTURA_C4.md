# RoomBook — architektura C4

**Diagramy przedstawiają docelowy stan P1.** Obecny szkielet etapu 01 zawiera stronę startową React i diagnostyczne API `GET /api/health`. Prisma jest skonfigurowana dla SQLite, ale nie ma modeli, migracji ani połączenia API z bazą; sesje, rezerwacje i pozostała logika domenowa wymagają implementacji.

Podstawę stanowią [specyfikacja 1.0](../SPECYFIKACJA_ROOMBOOK.md), rozdziały 2–4 i 8, [wymagania WF/WN](../requirements/WYMAGANIA.md), [scenariusze UC](../use-cases/PRZYPADKI_UZYCIA.md) oraz [diagram przypadków użycia — źródło](../use-cases/diagram-przypadkow-uzycia.puml) / [SVG](../use-cases/diagram-przypadkow-uzycia.svg).

## Dwa poziomy tego samego systemu

| Poziom         | Cel                                                                                      | Źródło .puml                  | SVG                         |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------- | --------------------------- |
| System Context | RoomBook jako całość oraz cele Studenta i Administratora poza jego granicą               | [PlantUML](c4-context.puml)   | [Diagram](c4-context.svg)   |
| Container      | Uszczegółowienie tego samego systemu na trzy części, ich odpowiedzialności i komunikację | [PlantUML](c4-container.puml) | [Diagram](c4-container.svg) |

Context pokazuje użytkowników i relacje do RoomBook, bez szczegółów technicznych. Container zachowuje te same role i obejmuje jedną granicą RoomBook aplikację webową, API oraz lokalny plik SQLite; granica oznacza zakres systemu, a nie pojedynczy proces lub maszynę wirtualną.

| Element                                                 | Rola / odpowiedzialność                                                                               | Technologia                                                  | Relacje                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Student                                                 | Przeglądanie sal i dostępności, tworzenie, przeglądanie i anulowanie własnych rezerwacji              | Przeglądarka                                                 | Korzysta z RoomBook przez aplikację webową                                             |
| Administrator                                           | Zarządzanie salami i blokadami; przeglądanie i anulowanie rezerwacji; rezerwowanie w imieniu studenta | Przeglądarka                                                 | Korzysta z tego samego interfejsu, w widokach roli administratora                      |
| RoomBook                                                | Lokalny system rezerwacji sal, kontrola dostępności i historia anulowań                               | Stos trzech kontenerów poniżej                               | Udostępnia funkcje obu aktorom; brak zależnych systemów zewnętrznych                   |
| Aplikacja webowa (`apps/web`)                           | Kalendarz tygodniowy, formularze, widoki ról, prezentacja danych i komunikatów                        | React + TypeScript; Vite do budowania i pracy developerskiej | Aktorzy obsługują UI; web wysyła żądania do API i odbiera dane przez lokalny HTTP/JSON |
| Serwer API (`apps/api`)                                 | REST/JSON, weryfikacja sesji, roli i dostępu do danych, logika domenowa, walidacje i transakcje       | Node.js + Express + TypeScript; Prisma jako biblioteka ORM   | Obsługuje żądania web; odczytuje i zapisuje SQLite przez Prisma/SQL                    |
| Baza danych (`prisma` — konfiguracja i przyszłe modele) | Trwałe konta, sale, rezerwacje z historią oraz blokady                                                | SQLite, lokalny plik                                         | API wykonuje odczyty i atomowe zapisy; web nie ma bezpośredniego dostępu               |

Trzy kontenery oddzielają interfejs w przeglądarce, proces serwera i trwałe dane. Prisma działa wewnątrz API jako biblioteka, a Vite jest narzędziem budowania/deweloperskim; nie stanowią osobnych kontenerów. SQLite nie wymaga osobnego serwera bazy.

Komunikacja web–API wykorzystuje lokalny HTTP/JSON pod `/api`; obecnie Vite przekazuje te żądania do Express na `127.0.0.1` (domyślnie porty 5173 i 3001). Strzałki C4 wskazują kierunek korzystania z funkcji i danych; odpowiedzi wracają w ramach tych samych interakcji. Serwer ma egzekwować reguły niezależnie od ograniczeń UI, w tym ponowną walidację i ochronę przed współbieżnymi konfliktami w SQLite; szczegóły protokołu sesji i mechanizmu transakcji pozostają do dopracowania przed implementacją zgodnie ze specyfikacją.

P1 działa lokalnie i nie zależy od systemów zewnętrznych: nie wymaga USOS, poczty, płatności ani zewnętrznego dostawcy tożsamości. Narzędzia budowania, testów i GitHub Actions nie są usługami wymaganymi do działania aplikacji i nie rozszerzają granicy C4.

## Renderowanie

Źródła korzystają z lokalnej biblioteki C4-PlantUML: `!include <C4/C4_Context>` i `!include <C4/C4_Container>`, zawartej w standardowej bibliotece PlantUML. Eksporty odtwarza [polecenie lokalne](../activities/DIAGRAMY_AKTYWNOSCI.md#odczyt-i-lokalne-renderowanie); nie wymagają zdalnych `!includeurl`, usług renderujących ani przechowywania narzędzi w repozytorium.
