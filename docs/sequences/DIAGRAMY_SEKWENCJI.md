# RoomBook — projektowe diagramy sekwencji

Podstawa: [specyfikacja §3–4, §7–9](../SPECYFIKACJA_ROOMBOOK.md), [UC](../use-cases/PRZYPADKI_UZYCIA.md), [WF](../requirements/WYMAGANIA.md), rzeczywiste [AD](../activities/DIAGRAMY_AKTYWNOSCI.md) oraz [C4](../architecture/ARCHITEKTURA_C4.md). Klasy i pełne sygnatury określa [model klas](../classes/MODEL_KLAS.md) / [UML](../classes/class-diagram.puml).

| SD    | UC    | WF                    | AD                                                            | link .puml                          |
| ----- | ----- | --------------------- | ------------------------------------------------------------- | ----------------------------------- |
| SD-01 | UC-03 | WF-04/05/06           | [AD-01](../activities/AD-01-rezerwowanie-sali.puml)           | [Rezerwacja](SD-01-rezerwacja.puml) |
| SD-02 | UC-05 | WF-08/15; nota WF-10  | [AD-02](../activities/AD-02-anulowanie-rezerwacji.puml)       | [Anulowanie](SD-02-anulowanie.puml) |
| SD-03 | UC-07 | WF-14; kontrola WF-15 | [AD-03](../activities/AD-03-blokowanie-lub-dezaktywacja.puml) | [Blokada](SD-03-blokada.puml)       |

## Ścieżki i odmowy

**SD-01:** API sprawdza sesję, usługa ponownie sprawdza inicjatora, właściciela, salę, termin, limity i całe przedziały, po czym zapisuje `ACTIVE` i zwraca 201 dopiero po COMMIT. Dla studenta właściciel i inicjator są tą samą osobą; administrator wskazuje STUDENT i pomija wyłącznie limit 3 i +14 dni. `400` oznacza błędny format; `422` niepoprawne reguły/właściciela, horyzont lub limit; `401/403` brak dostępu; `404` brak sali; `409` nieaktywną salę, kolizję lub zajętą bazę. Żadna odmowa nie tworzy nowej rezerwacji. Powrót po rollbacku kończy próbę, nie przechodzi do INSERT.

**SD-02:** pobranie rezerwacji i kontrola własności, `ACTIVE` oraz ścisłej przyszłości następują w transakcji. `cancelMany` z jednym ID zapisuje komplet metadanych `STUDENT_CANCELLED`; sukces to 200. Brak lub cudzy rekord daje jednakowe 404, już anulowana 409, rozpoczęta/zakończona 422, brak sesji 401. Rekord nie jest usuwany, a anulowany nie zajmuje slotów. WF-10 stosuje tę samą przyszłość dla administratora, z `ADMIN_CANCELLED` i bez ograniczenia do własnego wpisu; nie rozszerza to głównego scenariusza UC-05.

**SD-03:** podgląd pokazuje liczbę przyszłych `ACTIVE` sali nakładających się na blokadę. Administrator świadomie potwierdza skutki, także N=0; rezygnacja kończy bez zmian. Projekt kontraktu używa `POST /api/admin/blocks` z `mode=preview` lub `mode=confirm` (szczegół wykonawczy §8.5). API wywołuje odpowiednio `previewBlock` lub `createBlock`; token podpisany przez serwer wiąże input, admina, liczbę i ID podglądu. Token wraca z klienta w potwierdzeniu; serwer nie ufa dowolnemu `count`/ID przesłanemu przez klienta. Usługa powtarza walidację i ustala świeży zbiór w transakcji. Różnica liczby **lub zestawu**, nawet przy takiej samej liczbie, daje 409 `PREVIEW_CHANGED` i wymaga nowego podglądu oraz potwierdzenia. Niepoprawne dane, brak sali, nakładające się blokady lub błędy odczytu kończą podgląd bez tokena sukcesu. Dopiero poprawne potwierdzenie tworzy blokadę i anuluje dokładnie właściwe rezerwacje z `TIME_BLOCKED`. Błąd INSERT przerywa przed anulowaniami; błąd dowolnego zapisu/COMMIT wycofuje całość. Sukces daje 201. Dezaktywacja sali pozostaje w AD-03 / UC-06, poza tym SD.

## Wspólne granice i stan wykonania

Przeglądarka i API to granice infrastruktury, SQLite to jedna baza. Pozostali uczestnicy występują pod dokładnymi nazwami klas UML; aliasy PlantUML jedynie skracają źródło. Wiadomości SQL do bazy i powroty nie są metodami klas. Usługi koordynują transakcję bez dodatkowego mikroserwisu czy repozytorium transakcji.

`critical` oznacza wymaganą serializację: `BEGIN IMMEDIATE` na jednym połączeniu **przed odczytami**, ten sam `tx` w repozytoriach, jeden COMMIT lub ROLLBACK. Nie jest to globalna blokada pamięci procesu. Nieudane BEGIN pomija wszystkie dalsze kroki transakcji. Wszelkie błędy odczytu/zapisu po BEGIN również wycofują całość (409 dla współbieżności/blokady, 500 dla pozostałych błędów). Gałąź „COMMIT udany” obejmuje próbę zatwierdzenia pokazaną wiadomością; jej błąd prowadzi do gałęzi rollbacku. Ponowienie zaczyna nową pełną walidację, nigdy sam INSERT. Zegar `now` jest pobierany po uzyskaniu transakcji; granica przyszłości dotyczy tej chwili walidacji.

To projekty etapu 04, zgodne ze [szkicem danych](../data-model/schema-plan.prisma), a nie działające endpointy. API pozostaje szkieletem; TC-01…TC-26, w tym współbieżność TC-11 na prawdziwej SQLite, nadal są planowane. Lokalnego renderera PlantUML nie odnaleziono w PATH ani sprawdzonych lokalizacjach narzędzi; SVG nie utworzono, składnia nie została zweryfikowana rendererem i nie wykonano weryfikacji wizualnej. Źródła poddano kontroli tekstowej spójności.
