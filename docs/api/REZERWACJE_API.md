# RoomBook — API rezerwacji (etap 07)

Sesje i uruchamianie: [README](../../README.md). Wszystkie endpointy wymagają cookie sesji (inaczej 401). POST wymaga `Content-Type: application/json`, treści do 4 KiB i źródła zgodnego z ochroną Origin/Fetch Metadata. Nieznane pola i parametry są odrzucane. Format błędu: `{"error":{"code":"…","message":"…"}}`, bez szczegółów SQL.

## Odczyty

`GET /api/rooms` zwraca tablicę uporządkowaną rosnąco po `roomNumber`, następnie `id`:

```json
[{ "id": 1, "roomNumber": "A-101", "name": "Sala projektowa", "capacity": 6 }]
```

STUDENT widzi tylko aktywne sale, ADMIN wszystkie, z dodatkowym `isActive`. Brak query. Nazwa może być `null`.

`GET /api/availability?roomId=1&weekStart=2026-11-02` wymaga dodatniego ID oraz rzeczywistej daty poniedziałku. Zwraca jeden snapshot sali, aktywnych rezerwacji i blokad, pięć dni oraz po 16 slotów:

```json
{
  "roomId": 1,
  "weekStart": "2026-11-02",
  "timeZone": "Europe/Warsaw",
  "days": [
    {
      "date": "2026-11-02",
      "slots": [
        {
          "startHour": 7,
          "status": "AVAILABLE",
          "past": false,
          "available45": true,
          "fits90": true,
          "available90": true
        }
      ]
    }
  ]
}
```

Przykład skraca tablice. Kolejność: pon.–pt., godziny 7…22. Priorytet `status`: `INACTIVE` → `BLOCKED` → `RESERVED` → `PAST` → `AVAILABLE`. `past` niezależnie oznacza początek ≤ teraz, także przy zajętości. `fits90` określa granicę harmonogramu (false o 22); `available90` wymaga dwóch kolejnych slotów AVAILABLE. Zajętość obejmuje cały bufor. Student nie odczyta nieaktywnej sali (404); ADMIN zobaczy INACTIVE. Brak danych właścicieli, ID rezerwacji, autora i powodów blokad.

Odczyt kalendarza nie ma limitu +14 dni. Dostępność opisuje salę i czas; nie uwzględnia osobistego limitu, horyzontu zapisu ani rezerwacji studenta w innych salach. Podgląd jest orientacyjny: zapis ponownie sprawdza wszystkie warunki.

## Utworzenie

`POST /api/bookings`, STUDENT:

```json
{ "roomId": 1, "date": "2026-11-02", "startHour": 10, "durationSlots": 2 }
```

ADMIN podaje dodatkowo obowiązkowe `studentId` istniejącego STUDENT. STUDENT nie może podać tego pola, nawet własnego ID (403). Inne dodatkowe pola, w tym inicjator, status i metadane anulowania: 422. ID to dodatnie całkowite liczby JSON w zakresie Prisma Int (≤2147483647), bez konwersji stringów. Daty: dokładne `YYYY-MM-DD`, lata 0001…9999, z kontrolą istnienia dnia. ID w ścieżce/query: cyfry dziesiętne bez zer wiodących.

Sukces 201 zwraca DTO:

```json
{
  "id": 1,
  "studentId": 2,
  "room": {
    "id": 1,
    "roomNumber": "A-101",
    "name": "Sala projektowa",
    "capacity": 6
  },
  "date": "2026-11-02",
  "startHour": 10,
  "durationSlots": 2,
  "lessonMinutes": 90,
  "occupiedMinutes": 120,
  "status": "ACTIVE",
  "state": "UPCOMING",
  "canCancel": true,
  "createdAt": "2026-10-28T12:00:00.000Z",
  "createdBy": { "id": 2, "displayName": "Anna Nowak", "role": "STUDENT" },
  "cancelledAt": null,
  "cancelledByUserId": null,
  "cancelReason": null
}
```

`createdBy` to rzeczywisty inicjator z sesji, bez loginu/hasła. Poprawna rezerwacja natychmiast ma ACTIVE.

## Własna lista i anulowanie

`GET /api/bookings/mine`, tylko STUDENT: tablica powyższych DTO, ACTIVE i CANCELLED, wyłącznie właściciela z sesji (również wpisy admina). Kolejność rosnąca: `date`, `startHour`, `id`. Query jest odrzucane; nie można wybrać właściciela. ADMIN otrzymuje 403.

`state`: `UPCOMING`, `STARTED`, `COMPLETED`, `CANCELLED`. Koniec zajęć wyznacza 45/90 minut; bufor nadal zajmuje pełne 60/120 minut. Trwały status DB: ACTIVE/CANCELLED. `canCancel` wymaga ACTIVE i początku ściśle w przyszłości.

`POST /api/bookings/:id/cancel`, tylko STUDENT, body `{}`. Sukces 200 z aktualnym DTO. Warunkowy UPDATE ustawia CANCELLED, czas zdarzenia, ID studenta i STUDENT_CANCELLED; rekord pozostaje. Cudzy i nieistniejący rekord mają identyczną odmowę 404. Już anulowany: 409, rozpoczęty/zakończony: 422. ADMIN otrzymuje 403; jego anulowanie i listy należą do etapu 08. Klient nie podaje powodu anulowania.

## Reguły i błędy

Czas biznesowy zawsze Europe/Warsaw; zegar usług można wstrzykiwać. Arytmetyka dni jest kalendarzowa, niezależna od DST i strefy hosta. Początek ściśle przyszły; pon.–pt., całkowite starty 7…22, sloty 1/2, koniec ≤23. Jeden slot: 45 min zajęć/60 min zajętości; dwa: 90/120. Student: data ≤dzisiaj+14 włącznie i maksymalnie trzy przyszłe ACTIVE, licząc wpisy admina. ADMIN pomija wyłącznie te dwa limity.

Konflikt to przecięcie półotwartych przedziałów ACTIVE tego samego dnia dla sali **lub** studenta (również między salami), albo blokady sali. Sąsiednie terminy nie kolidują; CANCELLED nie zajmuje czasu. Sala musi być aktywna, właściciel musi nadal mieć rolę STUDENT.

| HTTP | Kody                                                                                             | Znaczenie                                                                   |
| ---- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 400  | `EXPECTED_JSON`, `INVALID_JSON`, `INVALID_BODY`                                                  | Content-Type, uszkodzony JSON, rozmiar/kodowanie                            |
| 401  | `UNAUTHENTICATED`                                                                                | Brak ważnej sesji                                                           |
| 403  | `FORBIDDEN`, `UNTRUSTED_ORIGIN`                                                                  | Rola, manipulacja właścicielem, zmiana roli podczas zapisu, źródło          |
| 404  | `ROOM_NOT_FOUND`, `STUDENT_NOT_FOUND`, `BOOKING_NOT_FOUND`, `NOT_FOUND`                          | Brak zasobu; nieaktywna sala dla studenta; cudzy wpis przy anulowaniu       |
| 409  | `ROOM_INACTIVE`, `SLOT_CONFLICT`, `ALREADY_CANCELLED`, `WRITE_CONFLICT`                          | Konflikt sali/studenta/blokady, stan anulowania, blokada/timeout transakcji |
| 422  | `INVALID_INPUT`, `INVALID_STUDENT`, `WEEKEND`, `NOT_FUTURE`, `HORIZON_EXCEEDED`, `BOOKING_LIMIT` | Format, harmonogram, właściciel ADMIN, termin, horyzont, limit              |
| 500  | `INTERNAL_ERROR`                                                                                 | Nieoczekiwany błąd, bez maskowania jako konflikt                            |

## Transakcje SQLite i testy

Prisma 7.10.1 / adapter better-sqlite3 7.10.1 rozpoczyna interaktywną transakcję instrukcją `BEGIN` (kod `startTransaction` adaptera). Nie wysyłamy osobnego BEGIN IMMEDIATE obok Prisma. Równoważne uzyskanie transakcji zapisu przed odczytami realizuje pierwsza instrukcja **tego samego `tx`**: `UPDATE rooms SET id = id WHERE 0`. Nie zmienia rekordów i nie wymaga tabeli blokad/migracji. SQLite uzyskuje blokadę zapisu także bez dopasowanych wierszy. To wykonawcze doprecyzowanie granicy BEGIN IMMEDIATE w SD-01/02 zachowuje sygnatury usług, serializację przed odczytami oraz wspólny uchwyt repozytoriów. Podstawa: [semantyka pierwszej instrukcji zapisu SQLite](https://www.sqlite.org/lang_transaction.html).

Po blokadzie: odczyty aktualnego inicjatora, właściciela, sali, zegara, licznika i konfliktów, jeden COMMIT/ROLLBACK. Zegar sprawdzany ponownie bezpośrednio przed i po INSERT/UPDATE. Anulowanie ma warunkowy UPDATE ACTIVE/właściciela/przyszłości i wymaga jednej zmiany. Błąd wycofuje całość. Repozytoria nie otwierają transakcji. Brak blokady procesu jako jedynej ochrony i brak automatycznych retry.

Adapter: timeout 100 ms, transakcja: maxWait 1000 ms, timeout 5000 ms. Krótki timeout ogranicza synchroniczne blokowanie Node. SQLITE_BUSY adapter mapuje na SocketTimeout/P1008; znane konflikty i rozpoznane timeouty P2028 dają 409. Pozostałe P2028 i błędy SQL pozostają 500.

Wykonane testy [HTTP](../../apps/api/src/bookings/bookings.test.ts), [usług/transakcji](../../apps/api/src/bookings/service.test.ts) i [czasu](../../apps/api/src/bookings/time.test.ts) obejmują TC-05…14. Równoległe żądania Supertest na dwóch niezależnych klientach tego samego zmigrowanego pliku, po trzy powtórzenia: konflikt sali, studenta między salami, wyścig o trzecią rezerwację i anulowanie. Dokładnie jeden sukces i poprawny stan DB po operacjach. Osobno: jeden klient adaptera oraz utrzymywana blokada bez zmian rekordów — drugi klient otrzymuje 409 WRITE_CONFLICT, po zwolnieniu blokady zapis działa. Błąd triggera testowego i przekroczenie początku przy INSERT/UPDATE potwierdzają rollback. Bez mocków SQLite.

Testy korzystają wyłącznie z migrowanych baz tymczasowych. Integracja React, administracja salami/blokadami i pomiar WN-02 pozostają poza etapem. Mechanizm chroni zapisy przez usługę; dowolny bezpośredni SQL poza usługą nie egzekwuje reguł domenowych.
