# RoomBook — nawigacja

## Stan implementacji etapów 09–10

Role pochodzą wyłącznie z API. Przy starcie i odświeżeniu GET `/api/auth/me` poprzedza render chronionej treści: ładowanie → sesja, 401 → login, pozostały błąd → komunikat z ponowieniem. UI-01 ma rzeczywisty formularz; STUDENT po login trafia do UI-02, ADMIN do UI-04. Wejście zalogowanego na UI-01 wraca do punktu wejścia roli i nie zastępuje wylogowania. Hashe, Back/Forward i bezpośrednie linki są chronione także w renderze; hash nie przełącza tożsamości.

Student — rzeczywiste dane: UI-02 ↔ UI-03. Kalendarz odczytuje aktywne sale i dostępność 5×16 w Europe/Warsaw. Wybór 45/90 min → podsumowanie zajęć i zajętości → osobne potwierdzenie → POST rezerwacji. 201 odświeża kalendarz i własną listę; konflikt odświeża dostępność bez komunikatu sukcesu. Tydzień poza +14 dni pozostaje czytelny, zapis jest niedozwolony. Własna lista filtruje serwerowe UPCOMING, STARTED/COMPLETED i CANCELLED. Akcja anulowania zależy od `canCancel`; potwierdzenie → POST z `{}` → aktualna lista i historia, bez usuwania wpisu.

Każdy odczyt ma ładowanie, pusty stan lub błąd z ponowieniem. 401 podczas pracy usuwa prywatne dane i pokazuje wygaśnięcie sesji; 403 pozostawia sesję i pokazuje odmowę. „Wyloguj” wysyła POST `/api/auth/logout`; dopiero 204 usuwa stan. Błąd sieci pozostawia sesję i umożliwia ponowienie. Żądania poprzednich widoków i sesji są unieważniane; dane kont i rezerwacji pozostają tylko w pamięci. Jedyny trwały klucz UI to `roombook-theme`.

Administrator — rzeczywiste dane: UI-04 (sale) ↔ UI-05 (rezerwacje) ↔ UI-06 (blokady) ↔ UI-07 (rezerwacja dla studenta). UI-04…07 są dostępne tylko dla ADMIN; student nie renderuje tych ekranów i nie wysyła administracyjnych żądań. Brak przełącznika roli i danych demo.

UI-04: dodaj/edytuj → formularz z fokusem → zapis → aktualna lista; dezaktywuj → GET podglądu → dialog z salą i liczbą skutków → PATCH z podpisem i dokładnymi ID. Aktywacja ma osobne potwierdzenie bez podglądu. UI-05: lokalne wyszukiwanie i filtr → właściciel/inicjator/historia → anulowanie po potwierdzeniu → odświeżona lista.

UI-06: sala/tydzień/długość/powód → wybór w siatce 5×16 → GET podglądu parametrów → osobne potwierdzenie → POST z niezmienionymi parametrami i tokenem. Dwa sloty zaznaczają dwie komórki; blokada może objąć zajętość rezerwacji i nieaktywną salę. Start 22:00 dla dwóch slotów jest niedostępny. Lista blokad → potwierdzenie usunięcia → DELETE bez body. UI-07: student i aktywna sala → tydzień/długość/wolny termin → podsumowanie właściciela i inicjatora → POST wspólnego endpointu z `studentId`.

Dialog zamraża parametry podglądu i wymaga zgody również dla zera anulowań. Zamknięcie odrzuca token. Po `PREVIEW_STALE` lub innym błędzie zapisu dialog zostaje zamknięty, dane odświeżone; nie ma automatycznego retry ani ponownej zgody w imieniu użytkownika. Nowa operacja masowa wymaga nowego GET i potwierdzenia. Tokeny pozostają tylko w pamięci i nie trafiają do DOM, storage ani logów. Aktywacja i usuwanie blokady nie odtwarzają rezerwacji.

Asynchroniczny podgląd zachowuje przycisk wywołujący, aby Escape przywracał właściwy fokus. Efekt normalizacji hasha nie nadpisuje nowej nawigacji oczekującej na `hashchange`. [Raport etapu 10](../testing/ETAP_10_RAPORT.md) zawiera wyniki i ograniczenia.

Zachowano skip-link, fokus tytułu po przejściu, natywne dialogi z Escape i przywracaniem fokusu, tekstowe stany slotów i lokalne przewijanie tabel. Okresowe odświeżanie i powrót do okna pobierają aktualne stany z API; klient nie wylicza trwałych statusów.

## Historyczna nawigacja makiet etapu 05

Poniższy opis dokumentuje pierwotny prototyp. Aktualne działanie UI-01…07 i ochronę ról opisano powyżej.

Wszystkie adresy to fragmenty jednej aplikacji SPA, np. `/#UI-02`. Odświeżenie i historia przeglądarki zachowują wybrany ekran. Nieznany fragment pokazuje UI-01. Podgląd roli jest wyznaczany przez ekran; otwarcie bezpośredniego odnośnika administratora zmienia wyłącznie prezentację. Nie istnieje sesja ani uwierzytelnienie.

| Ekran        | Akcja                              | Następny ekran / panel                                                |
| ------------ | ---------------------------------- | --------------------------------------------------------------------- |
| UI-01        | Podgląd studenta                   | UI-02                                                                 |
| UI-01        | Podgląd administratora             | UI-04                                                                 |
| UI-01        | Zaloguj                            | Komunikat: logowanie i zapis niedostępne                              |
| UI-02, UI-03 | Nawigacja studenta                 | UI-02 ↔ UI-03                                                         |
| UI-02        | Sala, tydzień, długość, wolny slot | Zmiana prezentacji i podsumowania na UI-02                            |
| UI-02        | Podgląd rezerwacji                 | Dialog projektu potwierdzenia; powrót do UI-02                        |
| UI-03        | Kategoria / anulowanie             | Lokalny filtr / dialog projektu; lista bez zmian                      |
| UI-04…07     | Nawigacja administratora           | Dowolny z UI-04, UI-05, UI-06, UI-07                                  |
| UI-04        | Dodaj / edytuj                     | Panel formularza, następnie projekt potwierdzenia                     |
| UI-04        | Dezaktywuj / aktywuj               | Dialog z liczbą przyszłych anulowań / informacją o braku odtwarzania  |
| UI-05        | Filtr / anulowanie                 | Lokalna lista / dialog projektu potwierdzenia                         |
| UI-06        | Utwórz / usuń blokadę              | Podgląd skutków i dialog; brak zapisu                                 |
| UI-07        | Wybór studenta i terminu           | Podsumowanie właściciela/inicjatora i dialog                          |
| Wszystkie    | Zmień podgląd roli                 | Student → UI-02; Administrator → UI-04                                |
| Wszystkie    | Ekran logowania                    | UI-01; bez fikcyjnego „wylogowania”                                   |
| Wszystkie    | Motyw jasny/ciemny                 | Ten sam ekran; zapis wyłącznie preferencji wyglądu                    |
| UI-02…07     | Projekty stanów                    | Pusto / błąd; dodatkowo odmowa albo brak uprawnień tam, gdzie dotyczy |

## Dostęp docelowy i ograniczenia

UI-01 jest wejściem obu ról. UI-02 i UI-03 projektują ścieżkę studenta; administrator przegląda sale również w UI-04, a termin wybiera w UI-07. UI-04…07 są docelowo wyłącznie administracyjne. API ma kontrolować sesję, rolę i właściciela niezależnie od widoczności nawigacji (WF-15). Prezentacyjny przełącznik „Student / Administrator” nie zastępuje autoryzacji API.

Student nie dostaje cudzej historii. Wariant administratora wybiera konto studenta, nigdy administratora jako właściciela. Powrót do UI-01 nie kończy sesji, bo prototyp jej nie tworzy.

## Desktop, telefon i klawiatura

Na desktopie nawigacja znajduje się po lewej; na telefonie przechodzi nad zawartość i zawija linki. W obu układach pozostaje dostępna bez ukrytego menu. Pasek demo i motyw są w nagłówku. Po przejściu fokus trafia na tytuł widoku. Link pomijający nawigację prowadzi do treści.

Kalendarz zachowuje pięć dni i 16 startów; na 375 px przewija się lokalnie. Tabele administratora mają własne kontenery przewijania dostępne klawiaturą. Formularze przechodzą do jednej kolumny. Cała strona nie wymaga poziomego przewijania.

Dialogi używają natywnego `dialog`, otrzymują fokus, zatrzymują go w panelu i zamykają się przyciskiem lub Escape. Zamknięcie przywraca fokus wywołującemu przyciskowi. Potwierdzenie w demonstracji pokazuje wyłącznie „To podgląd interfejsu. Zapis danych nie jest jeszcze dostępny.”. Żaden przycisk nie ogłasza udanego zapisu. Projekty błędów są opisane jako projekty, a nie rzeczywiste odpowiedzi serwera. `aria-live` informuje o faktycznej zmianie wybranego terminu lub zakończeniu podglądu.

## Powiązania z etapem 02

| UI    | WF                                | UC           |
| ----- | --------------------------------- | ------------ |
| UI-01 | WF-01, WF-15                      | UC-01        |
| UI-02 | WF-02, WF-03, WF-04, WF-06        | UC-02, UC-03 |
| UI-03 | WF-07, WF-08, WF-15               | UC-04, UC-05 |
| UI-04 | WF-02, WF-11, WF-12, WF-13, WF-15 | UC-06        |
| UI-05 | WF-09, WF-10, WF-15               | UC-08        |
| UI-06 | WF-14, WF-15                      | UC-07        |
| UI-07 | WF-02, WF-03, WF-05, WF-06        | UC-02, UC-03 |

Źródła: [wymagania](../requirements/WYMAGANIA.md), [formalne scenariusze UC-01…08](../use-cases/PRZYPADKI_UZYCIA.md), [diagram UC](../use-cases/diagram-przypadkow-uzycia.svg), [macierz spójności](../requirements/MACIERZ_SPOJNOSCI.md). [Makiety i porównanie z frontendem](MAKIETY.md) zawierają obrazy oraz decyzje projektowe. WF-15 jest przekrojowe również dla UI-02/UI-07; przypisania opisują projekt, nie wdrożone zabezpieczenia.
