# RoomBook — API administracji (etap 08)

Uruchamianie i logowanie: [README](../../README.md). Wszystkie `/api/admin/*` wymagają aktualnej sesji ADMIN: bez niej 401, STUDENT 403 również dla podglądów i zgadniętych ID. Mutacje ponownie odczytują rolę w transakcji. Brak zarządzania kontami, usuwania sal, przywracania anulowań i integracji React (etap 10).

POST/PATCH wymagają `application/json`, maksymalnie 4 KiB, poprawnego Origin/Fetch Metadata jak rezerwacje. DELETE wymaga tej samej ochrony źródła, ale **nie przyjmuje body i nie wymaga Content-Type**. GET nie wymaga Origin/Content-Type. Nieznane pola/query są odrzucane. Jedyną trasą administracji przyjmującą query jest podgląd blokady. Błędy: `{"error":{"code":"…","message":"…"}}`, bez SQL i sekretów.

## Listy i pojedyncze anulowanie

| Endpoint                  | Wynik                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/admin/students` | Tablica `{id,displayName,email}` wyłącznie STUDENT, kolejność `displayName,id` rosnąco |
| `GET /api/admin/bookings` | Wszystkie ACTIVE/CANCELLED, kolejność `date,startHour,id` rosnąco                      |
| `GET /api/admin/blocks`   | Wszystkie blokady, kolejność `date,startHour,id` rosnąco                               |

Rezerwacja ma [DTO rezerwacji](REZERWACJE_API.md) oraz `student:{id,displayName,role}` i nullable `cancelledBy:{id,displayName,role}`. `createdBy` wskazuje faktycznego autora, `student` właściciela. `lessonMinutes` wynosi 45/90, `occupiedMinutes` 60/120. Stany czasowe: UPCOMING/STARTED/COMPLETED/CANCELLED; w DB wyłącznie ACTIVE/CANCELLED. Listy nie zwracają hashy, sesji ani tokenów. Nie dodano filtrów ani paginacji.

`POST /api/bookings/:id/cancel` jest wspólny dla obu ról, body `{}`. ADMIN anuluje każdą przyszłą ACTIVE z `ADMIN_CANCELLED`; STUDENT wyłącznie własną z `STUDENT_CANCELLED`. Serwer zapisuje prawdziwego inicjatora i czas; sukces 200 z aktualnym DTO. Już anulowana: 409 ALREADY_CANCELLED, rozpoczęta/zakończona: 422 NOT_FUTURE; brak rekordu (także cudzy dla studenta): 404 BOOKING_NOT_FOUND. Nie ma klonu tej trasy pod `/api/admin`.

`POST /api/bookings` z obowiązkowym `studentId` dla ADMIN istniał już w etapie 07. Nadal respektuje aktywność sali, konflikty właściciela/sali/blokad i harmonogram; wyjątki ADMIN dotyczą wyłącznie limitu 3 i +14 dni.

## Sale

`POST /api/admin/rooms`:

```json
{
  "roomNumber": " b  201 ",
  "capacity": 10,
  "name": "Seminaryjna",
  "description": null
}
```

Przykładowy wynik 201 (ID nadawane przez DB):

```json
{
  "id": 9,
  "roomNumber": "B 201",
  "capacity": 10,
  "name": "Seminaryjna",
  "description": null,
  "isActive": true
}
```

`roomNumber` i `capacity` wymagane. Numer: istniejące `normalizeRoomNumber` — trim, scalenie białych znaków, wielkie litery; unikalność także przez UNIQUE SQLite. Limit wejściowy numeru: 100 znaków, nazwy: 200, opisu: 2000. `capacity` to dodatni integer JSON ≤2147483647; bez konwersji stringów. `name`/`description` są opcjonalne: pominięcie przy tworzeniu daje null, przy edycji zachowuje wartość; null lub tekst pusty po trim usuwa wartość. Inne typy są odrzucane. Klient nie ustala ID, aktywności przy tworzeniu ani pól audytu.

`PATCH /api/admin/rooms/:id` przyjmuje jeden z rozłącznych wariantów:

```json
{
  "roomNumber": "A-110",
  "capacity": 12,
  "name": null,
  "description": "Nowy opis"
}
```

```json
{ "isActive": true }
```

```json
{
  "isActive": false,
  "confirmed": true,
  "expectedCancellationIds": [12, 15],
  "confirmationToken": "<token z podglądu>"
}
```

Pierwszy wariant to niepusta częściowa edycja numeru/nazwy/opisu/pojemności. Sukces 200 z DTO sali, stałym ID i zachowanymi FK/historią. Aktywacja nie wymaga podglądu i niczego nie przywraca; ponowna aktywacja jest dozwolona. Nie wolno mieszać aktywności z edycją. **Powtórna dezaktywacja nieaktywnej sali oraz jej podgląd dają 409 ROOM_INACTIVE**, bez zmian. Nie ma DELETE sali. `GET /api/rooms` nadal pokazuje studentowi aktywne sale, ADMIN również nieaktywne ze statusem.

## Podgląd i kryptograficzne potwierdzenie

`GET /api/admin/rooms/:id/deactivation-preview` zwraca:

```json
{
  "roomId": 1,
  "cancellationCount": 2,
  "expectedCancellationIds": [12, 15],
  "confirmationToken": "<nieprzezroczysty token>"
}
```

`GET /api/admin/blocks/preview?roomId=1&date=2026-11-02&startHour=10&durationSlots=2&reason=Remont` ma identyczny format wyniku. `reason` jest opcjonalny; **jeśli ma zostać zapisany, trzeba go uwzględnić już w podglądzie**. Parametry liczbowe query są kanonicznymi cyframi bez zer wiodących; przy zapisie są liczbami JSON. Powtórzone parametry, obiekty i nieznane query są odrzucane.

Podgląd jest spójnym snapshotem tylko do odczytu. UI pokazuje liczbę skutków i parametry. Również zero wymaga osobnego, świadomego potwierdzenia. Potwierdzenie musi zawierać `confirmed:true`, dokładną rosnącą listę `expectedCancellationIds` (bez duplikatów) i `confirmationToken`. Same ID ani sama liczba nie wystarczą. Wszystkie ID to dodatnie Prisma Int; ścieżki nie przyjmują zer wiodących. Limit 4 KiB obejmuje całe potwierdzenie; nadmiernie duże listy są odrzucane bez zapisu.

Token jest ważny **5 minut**. Podpis HMAC-SHA256 korzysta z `node:crypto` i klucza wyprowadzonego przez HMAC z istniejącego sekretu aplikacji oraz domeny `roombook:admin-impact:v1`. Nie jest tokenem sesji; nie wymaga tabeli ani nowego sekretu. Format: base64url JSON z wersją, terminem ważności i skrótem SHA-256 kanonicznego kontekstu, następnie kropka i podpis base64url. Podpis porównywany jest w stałym czasie. Podpisany skrót wiąże administratora, rodzaj operacji, salę, wszystkie znormalizowane parametry (w tym trim/null opisu blokady), uporządkowane ID i liczbę. Pełna lista pozostaje w DTO, a token nie dubluje jej rozmiaru. Nie należy logować tokenów ani samodzielnie konstruować ich w UI.

W transakcji zapisu serwer weryfikuje aktualnego ADMIN, istnienie/stan sali, token i reguły terminu/kolizji; sam ponownie oblicza dokładny zbiór przyszłych ACTIVE. Różnica ID (także ta sama liczba przy innych ID), parametrów, administratora, rodzaju operacji lub wygaśnięcie tokena: **409 PREVIEW_STALE**, bez zmian; konieczny nowy GET i zgoda. Uszkodzony podpis/format: 422 INVALID_CONFIRMATION; brak lub zła struktura potwierdzenia: 422 INVALID_INPUT. Konflikt istniejącej blokady może wcześniej dać BLOCK_CONFLICT, nieaktywna sala ROOM_INACTIVE, niedozwolony termin 422.

Token nie jest jednorazowym rekordem serwera. Ponowne wykonanie udanej dezaktywacji jest odrzucane jako ROOM_INACTIVE, istniejącej blokady jako BLOCK_CONFLICT. Usunięcie blokady nie unieważnia kryptograficznie wcześniejszego tokena przed jego wygaśnięciem; każde ponowienie nadal musi spełnić reguły, dokładny zbiór i jawne potwierdzenie.

## Blokady i masowe anulowania

`POST /api/admin/blocks`, po powyższym podglądzie:

```json
{
  "roomId": 1,
  "date": "2026-11-02",
  "startHour": 10,
  "durationSlots": 2,
  "reason": "Remont",
  "confirmed": true,
  "expectedCancellationIds": [12, 15],
  "confirmationToken": "<token z podglądu>"
}
```

Wynik 201: szczegóły blokady z `cancelledCount`:

```json
{
  "id": 3,
  "roomId": 1,
  "date": "2026-11-02",
  "startHour": 10,
  "durationSlots": 2,
  "reason": "Remont",
  "createdAt": "2026-10-28T12:00:00.000Z",
  "createdBy": { "id": 1, "displayName": "Administrator", "role": "ADMIN" },
  "room": {
    "id": 1,
    "roomNumber": "A-101",
    "capacity": 6,
    "name": null,
    "description": null,
    "isActive": true
  },
  "cancelledCount": 2
}
```

Przykładowe ID, czasy i nazwy ilustrują strukturę, nie dane konkretnej bazy. Lista blokad zawiera te same pola bez `cancelledCount`.

Terminy: prawdziwe YYYY-MM-DD, Europe/Warsaw, pon.–pt., starty całkowite 7…22, sloty 1/2, koniec ≤23 i początek ściśle przyszły. Dwa sloty od 21 są dozwolone, od 22 odrzucone. Brak horyzontu +14 dni. Blokada może dotyczyć istniejącej nieaktywnej sali; sama blokada nie zmienia jej aktywności. Zajętość to 60/120 minut. Przecięcie: `a.startHour < b.startHour+b.durationSlots && b.startHour < a.startHour+a.durationSlots`. Zachodząca blokada tej samej sali: 409 BLOCK_CONFLICT, sąsiedztwo dozwolone. `reason` jest nullable opisem (trim/pusty → null, maksimum 2000 znaków), nigdy kategorią anulowania.

Dezaktywacja w jednej transakcji ustawia `isActive=false` i anuluje **wszystkie przyszłe ACTIVE sali**, także poza +14 dni. Sukces PATCH: DTO sali i `cancelledCount`. Blokada w jednej transakcji tworzy TimeBlock i anuluje tylko przyszłe ACTIVE tej sali nachodzące na przedział. Każde anulowanie zapisuje CANCELLED, aktualny czas, prawdziwego ADMIN i odpowiednio ROOM_DEACTIVATED/TIME_BLOCKED. Rozpoczęte, zakończone, wcześniej anulowane, inne sale i niekolidujące wpisy pozostają bez zmian.

`DELETE /api/admin/blocks/:id`: 204 bez body; usuwa wyłącznie blokadę, również historyczną. Brak rekordu/kolejne usunięcie: 404 BLOCK_NOT_FOUND. Nie przywraca anulowań. Po usunięciu nowe rezerwacje podlegają wszystkim zwykłym ograniczeniom. Aktywacja sali także nie przywraca historii.

## Atomowość, współbieżność i błędy

Rezerwacje i wszystkie mutacje administracji używają jednego mechanizmu [writeTransaction](../../apps/api/src/bookings/transaction.ts): pierwsze `UPDATE rooms SET id=id WHERE 0` na tym samym interaktywnym `tx` uzyskuje blokadę SQLite **przed** odczytami decydującymi o zapisie. Jest to wykonawcza realizacja serializowanej transakcji z SD-03; brak osobnego połączenia BEGIN IMMEDIATE i mutexu procesu. Repozytoria nie otwierają autonomicznych transakcji.

Po sprawdzeniu potwierdzenia serwer zapisuje stan sali/blokadę, warunkowo anuluje wyliczone ID z ACTIVE i ścisłą przyszłością, porównuje liczbę efektów oraz sprawdza zegar bezpośrednio przed/po anulowaniu (dla blokady także przed INSERT). Przekroczenie początku, wygaśnięcie tokena, niezgodny count lub błąd DB wycofują całość. Konkurująca rezerwacja albo wygrywa i unieważnia podgląd, albo po wygranej administracji widzi nieaktywną/zablokowaną salę. Nie ma cichego anulowania nowej rezerwacji ani częściowego COMMIT.

| HTTP | Kod / przyczyna                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 400  | EXPECTED_JSON, INVALID_JSON, INVALID_BODY — typ, składnia, kodowanie/rozmiar                          |
| 401  | UNAUTHENTICATED — brak ważnej sesji                                                                   |
| 403  | FORBIDDEN, UNTRUSTED_ORIGIN — rola/źródło                                                             |
| 404  | ROOM_NOT_FOUND, BLOCK_NOT_FOUND, BOOKING_NOT_FOUND, NOT_FOUND                                         |
| 409  | ROOM_NUMBER_CONFLICT, ROOM_INACTIVE, BLOCK_CONFLICT, PREVIEW_STALE, ALREADY_CANCELLED, WRITE_CONFLICT |
| 422  | INVALID_INPUT, INVALID_CONFIRMATION, WEEKEND, NOT_FUTURE                                              |
| 500  | INTERNAL_ERROR — nieoczekiwany błąd, bez ujawniania szczegółów                                        |

Rozpoznawanie WRITE_CONFLICT i timeouty pozostają wspólne z etapem 07. Nie ma automatycznych retry ani aktualizacji zależności.

Weryfikacja: [TC-15…21](../../apps/api/src/admin/admin.test.ts) oraz regresja [rezerwacji](../../apps/api/src/bookings/bookings.test.ts). Testy używają rzeczywistych migrowanych plików SQLite (osobny plik dla każdego przypadku administracji), rzeczywistych sesji HMAC i kontrolowanego zegara. Wyścigi HTTP mają dwóch niezależnych klientów Prisma jednego pliku, po trzy powtórzenia, z kontrolą tabel rooms/bookings/time_blocks. Triggery wyłącznie w bazach testowych wymuszają błąd lub pominięcie UPDATE, aby sprawdzić rollback i count. Testy zegara używają też wstrzykiwanego `now`. Uruchomienie: `npm.cmd run test`; tylko administracja: `npm.cmd exec -- vitest run apps/api/src/admin/admin.test.ts`.
