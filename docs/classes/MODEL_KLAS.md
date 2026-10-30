# RoomBook — projekt modelu klas API

[Diagram UML](class-diagram.puml) rozwija kontener API z [C4 Container](../architecture/c4-container.puml) i [opisu architektury](../architecture/ARCHITEKTURA_C4.md). Obejmuje 12 klas backendu, bez klas React, dodatkowych mikroserwisów i osobnego serwera bazy. Podstawa: [specyfikacja §3–4, §8–9](../SPECYFIKACJA_ROOMBOOK.md), [WF](../requirements/WYMAGANIA.md) i [UC](../use-cases/PRZYPADKI_UZYCIA.md).

## Odpowiedzialności

| Klasa               | Odpowiedzialność                                                    | Najważniejsze operacje                                                                          |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| User                | Konto i rola, hasło wyłącznie jako hash                             | Dane tożsamości; bez operacji persystencji                                                      |
| Room                | Tożsamość, pojemność i aktywność sali                               | Dane sali; dostępność jest wyliczana                                                            |
| Booking             | Właściciel, inicjatorzy, zajętość i historia                        | Dane rezerwacji i anulowania                                                                    |
| TimeBlock           | Zajętość wyłączona przez administratora                             | Dane blokady i jej inicjatora                                                                   |
| AuthService         | Weryfikacja podpisu i ważności tokena sesji, odczyt bieżącego konta | `authenticate`                                                                                  |
| RoomService         | Polityka administracyjnej dezaktywacji wraz z anulowaniami          | `previewDeactivation`, `deactivate` (UC-06 / WF-13; poza trzema SD)                             |
| BookingService      | Reguły tworzenia i anulowania, koordynacja transakcji               | `createBooking`, `cancelBooking`                                                                |
| TimeBlockService    | Podgląd skutków, potwierdzenie i atomowe utworzenie blokady         | `previewBlock`, `createBlock`                                                                   |
| UserRepository      | Odczyt konta inicjatora i właściciela                               | `findById`                                                                                      |
| RoomRepository      | Odczyt sali i zapis aktywności                                      | `findById`, `setActive`                                                                         |
| BookingRepository   | Zapytania o zajętość, limit i skutki; zapis i anulowania            | `findById`, `countFutureActive`, `findOverlapping`, `findFutureForRoom`, `insert`, `cancelMany` |
| TimeBlockRepository | Odczyt konfliktów blokad i zapis                                    | `findOverlapping`, `insert`                                                                     |

Diagram pokazuje publiczne pola/operacje (`+`); nie deklaruje zbędnych prywatnych metod ani dziedziczenia. Repozytoria zależą od odczytywanych/zapisywanych encji; usługi zależą od repozytoriów. Zależność przerywana oznacza korzystanie, nie posiadanie i nie niezależną transakcję.

## Słownik sygnatur

Pola i metody mają angielskie nazwy zgodne z TypeScript. Operacje I/O zwracają `Promise<T>`, błędy odrzucają obietnicę i są mapowane przez API na HTTP. `number` oznacza dla ID/godzin/liczników liczbę całkowitą, a `Date` znacznik zdarzenia. Typy poniżej są aliasami lub DTO, nie dodatkowymi klasami UML ani tabelami:

- `Role = 'STUDENT' | 'ADMIN'`, `Slots = 1 | 2`, `BookingStatus = 'ACTIVE' | 'CANCELLED'`.
- `CancelReason = 'STUDENT_CANCELLED' | 'ADMIN_CANCELLED' | 'ROOM_DEACTIVATED' | 'TIME_BLOCKED'`.
- `LocalDate`: zwalidowany string lokalnej daty `YYYY-MM-DD`, interpretowany w `Europe/Warsaw`.
- `BookingInput`: `roomId`, `date`, `startHour`, `durationSlots`, opcjonalny `studentId` dla admina. API mapuje wybór 45/90 min na 1/2 sloty; usługa waliduje wynik. Student nie może wskazać innego właściciela.
- `SlotWindow`: `date`, `startHour`, `durationSlots`; `BlockInput` rozszerza te dane o `roomId` i nullable `reason`. W SD `window` to część `input` opisująca przedział.
- `NewBooking`: wszystkie pola `Booking` poza generowanym `id`; `NewTimeBlock`: wszystkie pola `TimeBlock` poza `id`. Parametr `data` w SD oznacza taki kompletny obiekt.
- `ImpactPreview`: `roomId: number`, `cancellationCount: number`, `expectedCancellationIds: number[]`, `confirmationToken: string`. Podpisany token wiąże rodzaj operacji, administratora, pełny znormalizowany input (także reason), liczbę i posortowane ID rekordów z podglądu. HMAC-SHA256 z kluczem przeznaczonym do potwierdzeń, wyprowadzonym z sekretu aplikacji; ważność 5 minut. Serwer sprawdza podpis, ważność i powiązanie; UI pokazuje podsumowanie i liczbę, również zero. Potwierdzenie wymaga `confirmed:true`, listy ID i tokena. Nie potrzeba piątej tabeli.
- `Tx`: techniczny uchwyt jednej transakcji/połączenia SQLite. `null` oznacza samodzielny odczyt podglądu lub konta sesji. Każda operacja zapisu wymaga niepustego `tx`.

`findOverlapping` rezerwacji wybiera tylko `ACTIVE` dla daty, z konfliktem **sali LUB studenta**, także między salami. Wersja repozytorium blokad filtruje salę i datę. Obie używają przecięcia `[startHour, startHour + durationSlots)`. `countFutureActive` liczy wszystkie przyszłe `ACTIVE` właściciela, także utworzone przez admina. `findFutureForRoom` filtruje przyszłe `ACTIVE` sali; `window=null` oznacza wszystkie (dezaktywacja), a podane okno ogranicza do nakładających się (blokada).

`cancelMany` aktualizuje dokładnie podane ID, wyłącznie nadal przyszłe `ACTIVE`, zapisując `CANCELLED`, `cancelReason`, `cancelledAt=now`, `cancelledByUserId=actorId`; zwraca liczbę zmian. Niezgodność tej liczby z oczekiwaną wycofuje całą transakcję. Pusta lista daje zero zmian. Usługa ustala przyczynę z operacji/roli, nigdy z dowolnego tekstu klienta.

## Relacje i współbieżność

Każda rezerwacja ma dokładnie jednego właściciela `student`, jednego inicjatora `createdBy` i zero albo jednego `cancelledBy`. Każdy użytkownik może mieć 0..* rezerwacji w każdej z tych **trzech odrębnych ról**. Jedna sala ma 0..* rezerwacji i 0..* blokad; każda z nich wskazuje jedną salę. Blokada ma jednego inicjatora z rolą ADMIN; administrator może utworzyć 0..* blokad. Są to zwykłe asocjacje, bez kompozycji i kaskadowego kasowania historii. Ograniczenia roli i kompletności anulowania dopełniają krotności — FK sam nie sprawdza roli.

API sprawdza sesję i rolę; usługi sprawdzają politykę operacji. `AuthService` odrzuca błędny/wygasły token przed odczytem konta. Odczyty konta w SD zakładają poprawny token. Przy zapisie bieżące konto jest ponownie odczytywane. Usługa inicjuje **jedną transakcję `BEGIN IMMEDIATE` przed odczytami decydującymi o zapisie**, przekazuje wspólny `tx` i zatwierdza raz. Wiadomości do SQLite z usługi oznaczają tę techniczną granicę; odczyty i modyfikacje domenowe przechodzą przez repozytoria. Nie dodano klasy `TransactionManager`.

Prisma/adapter w implementacji musi udostępnić ten sam kontekst połączenia dla całej operacji; nie wolno wysłać `BEGIN` na inne połączenie ani zagnieżdżać autonomicznych transakcji repozytoriów. Sposób realizacji i obsługę blokad należy zweryfikować na prawdziwej SQLite przed wdrożeniem. `SQLITE_BUSY`/konflikt oznacza odmowę 409; inne błędy bazy 500; każda rozpoczęta nieudana transakcja podlega rollbackowi. Nieudane uzyskanie transakcji nie uruchamia jej dalszych kroków. Wstępna walidacja formatu może zakończyć się przed transakcją.

## Śledzenie i stan projektu

[SD-01](../sequences/SD-01-rezerwacja.puml) wiąże UC-03 / WF-04/05/06 z `BookingService` i repozytoriami; [SD-02](../sequences/SD-02-anulowanie.puml) UC-05 / WF-08/15 z anulowaniem; [SD-03](../sequences/SD-03-blokada.puml) UC-07 / WF-14 z `TimeBlockService` i wspólnym zapisem blokady/anulowań. WF-13 / UC-06 / AD-03 prowadzą do `RoomService` i `BookingRepository`, bez dodatkowego SD. Pozostałe operacje P1 (np. logowanie, edycja sal i usunięcie blokady) pozostają poza zakresem operacji tego wybranego modelu.

Diagram pozostaje modelem odpowiedzialności, nie diagramem wygenerowanym z kodu. W etapie 08 projektowe odpowiedzialności RoomService i TimeBlockService realizuje jeden spójny [AdminService](../../apps/api/src/admin/service.ts): `previewDeactivation`, `patchRoom` (wariant dezaktywacji), `previewBlock`, `createBlock`, a ponadto listy i CRUD bez usuwania sal. BookingService zachowuje tworzenie i wspólne anulowanie obu ról. Zapytania administracji korzystają ze wspólnego `tx` Prisma i istniejących repozytoriów; odpowiednikiem `findFutureForRoom` jest pomocnicze `affected`, a `setActive`/`insert` wykonywane są na tym samym `tx`. Nie ma drugiego ORM ani niezależnych transakcji repozytoriów. `writeTransaction` realizuje granicę BEGIN IMMEDIATE pierwszą instrukcją `UPDATE rooms SET id=id WHERE 0` przed odczytami, jak w etapie 07. Dokładny kontrakt i mapowanie SD-03 opisuje [API administracji](../api/ADMINISTRACJA_API.md); wykonane TC wskazuje [macierz](../requirements/MACIERZ_SPOJNOSCI.md). Odpowiedniki pól i FK zawiera [model danych](../data-model/MODEL_DANYCH.md).
