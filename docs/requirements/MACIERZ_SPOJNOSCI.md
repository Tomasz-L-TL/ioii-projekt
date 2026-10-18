# RoomBook — macierz spójności

Podstawa: [specyfikacja 1.0](../SPECYFIKACJA_ROOMBOOK.md), rozdziały 7, 10–12. Macierz wiąże [wymagania](WYMAGANIA.md) z [formalnymi UC](../use-cases/PRZYPADKI_UZYCIA.md) i [diagramem UC](../use-cases/diagram-przypadkow-uzycia.puml).

**Wszystkie TC, AD, SD i UI poniżej są planowane, do wykonania w następnych etapach.** Identyfikatory TC-01…TC-26 zachowują znaczenie z rozdziału 11 specyfikacji; przypisanie nie oznacza wykonania testu ani pełnego pokrycia kryterium. Kolumna braków wskazuje warianty, o które trzeba rozszerzyć planowane testy; nie nadaje nowych ID. Dodatkowe powiązania TC-13/14/15 z WF-15 dotyczą prywatności i autoryzacji, a nie zmiany zakresu testów.

## Wymagania funkcjonalne

| WF | UC | Planowane TC | Planowane AD/SD/UI | Pokrycie minimalnego TC i uzupełnienia wymagane później |
| --- | --- | --- | --- | --- |
| WF-01 | UC-01 | TC-01, TC-02 | UI-01 | Poprawne logowanie studenta, wylogowanie, błędne hasło. Uzupełnić poprawne logowanie administratora, właściwy widok roli i odmowę chronionego żądania po wylogowaniu. |
| WF-02 | UC-02 | TC-03 | UI-02, UI-04, UI-07 | Aktywne sale studenta i pojemność. Uzupełnić numer/opcjonalną nazwę oraz widoczność nieaktywnych sal i statusu dla administratora. |
| WF-03 | UC-02 | TC-04 | UI-02, UI-07 | Komórki godzinne i zajętość tygodnia. Uzupełnić rozróżnienie blokad/niedozwolonych, granice pon.–pt. i godzin oraz dwa sąsiednie wolne sloty przy 90 min. |
| WF-04 | UC-03 | TC-05, TC-06, TC-07, TC-08 | AD-01, SD-01; UI-02 | 45/90 min, limit, >14 dni i weekend. Uzupełnić +14 włącznie, ścisłą przyszłość, ostatnie starty 22:00/21:00, właściciela/inicjatora i `ACTIVE`; do limitu wliczać wpisy administratora, wykluczać rozpoczęte/anulowane. |
| WF-05 | UC-03 | TC-09 | AD-01, SD-01; UI-07 | Wyjątki liczby i horyzontu. Uzupełnić właściciela-studenta i inicjatora-admina, odmowę rezerwacji na konto admina oraz wszystkie nadal obowiązujące walidacje czasu i konfliktów. |
| WF-06 | UC-03 | TC-10, TC-11, TC-12 | AD-01, SD-01; UI-02, UI-07 | Konflikt sali/właściciela, współbieżność i blokada. Uzupełnić nieaktywną salę, konflikty całych 2 slotów, sąsiedztwo przedziałów, odmowę także dla admina, rewalidację po podglądzie i błędy bazy. TC-11 wykonać na rzeczywistej SQLite. |
| WF-07 | UC-04 | TC-13 | UI-03 | Własna historia i niewidoczność cudzej. Uzupełnić komplet pól, wszystkie stany czasowe/anulowanie oraz widoczność wpisów utworzonych przez administratora. |
| WF-08 | UC-05 | TC-14, TC-15 | AD-02, SD-02; UI-03 | Zwolnienie terminu i odmowa anulowania cudzej przez studenta. Uzupełnić rozpoczętą/zakończoną/już anulowaną, kontrolę przy wykonaniu oraz czas, inicjatora, `STUDENT_CANCELLED` i zachowanie historii. |
| WF-09 | UC-08 | TC-16 | UI-05 | Lista wszystkich rezerwacji. Uzupełnić asercje wszystkich pól, właściciela, stanów i źródła utworzenia z inicjatorem. |
| WF-10 | UC-08 | TC-15 | AD-02; UI-05 | Dozwolone anulowanie cudzej przez administratora. Uzupełnić ścisłą przyszłość/aktywność, odmowę historycznych i ponownego anulowania, zwolnienie terminu oraz `ADMIN_CANCELLED`, czas i inicjatora w historii. |
| WF-11 | UC-06 | TC-17 | UI-04 | Dodanie i duplikat numeru. Uzupełnić brak/pusty numer, normalizację białych znaków i wielkości liter, dodatnią całkowitą pojemność i opcjonalność nazwy/opisu. |
| WF-12 | UC-06 | TC-17 | UI-04 | Edycja i duplikat. Uzupełnić wszystkie edytowalne pola, pełną walidację oraz zachowanie tożsamości sali i powiązań historycznych. |
| WF-13 | UC-06 | TC-18 | AD-03; UI-04 | Atomowe anulowanie przyszłych przy dezaktywacji. Uzupełnić podgląd/potwierdzenie i zmianę liczby skutków, rollback, brak nowych rezerwacji, nienaruszoną historię oraz reaktywację bez odtwarzania anulowanych. Sprawdzić metadane anulowania. |
| WF-14 | UC-07 | TC-12, TC-19, TC-20 | AD-03, SD-03; UI-06 | Zakaz rezerwacji blokady, 2 sloty i anulowania, duplikat, usunięcie bez odtworzenia. Uzupełnić 1 slot, wszystkie walidacje terminu i nakładanie blokad, podgląd/potwierdzenie, zmianę liczby skutków, rollback i metadane `TIME_BLOCKED`. |
| WF-15 | UC-01, UC-04, UC-05, UC-06, UC-07, UC-08 | TC-21; uzupełniająco TC-01, TC-13, TC-14, TC-15 | SD-02; UI-01, UI-03, UI-04, UI-05, UI-06 | TC-21 sprawdza odmowę API administratora; TC-13/15 prywatność/anulowanie. Uzupełnić brak/wygaśnięcie sesji oraz podmiany identyfikatorów przy odczycie i modyfikacji, niezależnie od widoczności przycisków. |

## Wymagania niefunkcjonalne

| WN | Planowane TC | Planowana metoda weryfikacji | Zakres i brakujące sprawdzenia |
| --- | --- | --- | --- |
| WN-01 | TC-22; uzupełniająco TC-01, TC-21 | Inspekcja bazy i sposobu hashowania; negatywne testy sesji/uprawnień API. | TC-22 potwierdza brak jawnych haseł; sam nie dowodzi kontroli sesji i wszystkich ról — rozszerzyć testy żądań chronionych. |
| WN-02 | TC-23 | Odtwarzalny test obciążenia dostępności: ≥1000 rezerwacji, 10 równoczesnych użytkowników, 10 min, p95 ≤2 s; zapisać środowisko i rzeczywiste wyniki. | Minimalny TC odpowiada kryterium, ale pomiar i raport pozostają do wykonania. |
| WN-03 | TC-24 | Ręczne przejście klawiaturą logowania, wyboru terminu, tworzenia/anulowania i podstawowych operacji administratora; kontrola widocznego fokusu. | Doprecyzować listę przejść obu ról; ogólne „krytyczne ścieżki” bez kontroli fokusu nie wystarcza. |
| WN-04 | TC-25 | E2E i kontrola ręczna kluczowych ścieżek UC-01…08 w aktualnych stabilnych Chrome i Firefox na komputerze; zapisać wersje. | Uzupełnić podstawowe E2E o pozostałe kluczowe warianty obu ról; wynik w jednej przeglądarce nie pokrywa wymagania. |
| WN-05 | TC-26 | UI-01…07 przy 375/1280 px, oba motywy, kontrola używalności i braku poziomego przewijania całej strony, zapis preferencji po odświeżeniu. | Minimalny TC odpowiada kryterium; trzeba wykonać go dla wszystkich kluczowych widoków, z zachowaniem preferencji w danej przeglądarce. |

## Granice śledzenia na etapie analizy

Każde WF i WN ma plan weryfikacji, a każdy UC-01…08 jest powiązany z wymaganiem. AD-01…03, SD-01…03 i UI-01…07 odnoszą się wyłącznie do już zatwierdzonych identyfikatorów, nie do istniejących plików. W następnych etapach należy uzupełnić odnośniki do rzeczywistych diagramów, makiet, klas/C4/ERD, modułów i wyników testów. Brak diagramu AD/SD przy danym WF nie oznacza dodatkowego diagramu do wykonania: zatwierdzone diagramy opisują wybrane kluczowe procesy.

Nie deklaruje się procentowego ani pełnego pokrycia wykonanymi testami. Kontrole szkieletu technicznego nie są wynikami biznesowych TC-01…TC-26.
