# RoomBook — specyfikacja nadrzędna projektu

**Wersja:** 1.0 — dokument bazowy  
**Data zatwierdzenia założeń:** 2026-10-14  
**Status:** ustalony zakres P1; implementacja i dokumentacja wykonawcza nie są jeszcze ukończone  
**Przeznaczenie:** jedno źródło prawdy dla analizy, projektowania UML/C4, kodu, interfejsu, danych, testów i weryfikacji zaliczenia IO II.

> **Reguła nadrzędna:** Żaden diagram, komponent aplikacji ani test nie może wprowadzać zachowania sprzecznego z niniejszym dokumentem. Jeśli konieczna jest zmiana reguł, najpierw należy ją uzgodnić, zapisać w rejestrze zmian i następnie zsynchronizować wszystkie dotknięte artefakty. Nie wolno dopasowywać wymagań po cichu do przypadkowo powstałego kodu.

## 1. Podstawa i sposób interpretacji

### 1.1. Hierarchia źródeł

1. **Obowiązkowe wymagania zaliczenia:** „Projekt zaliczeniowy Inżynieria oprogramowania II”, 4-stronicowy dokument prowadzącej, w szczególności wykaz 11 etapów i macierz spójności na stronach 2–3.
2. **Ustalenia funkcjonalne i techniczne projektu:** decyzje zespołu dotyczące RoomBook z 2026-10-14 (w tym 60-minutowe bloki, role i wyjątki administratora).
3. **Wskazówki metodyczne z wykładów:** poprawna notacja UML, jednoznaczne wymagania, scenariusze podstawowe i alternatywne, diagramy niewielkie i czytelne, zachowywanie spójności.
4. **Szczegóły wykonawcze poniżej:** doprecyzowania konieczne do uzyskania deterministycznej implementacji. Nie zmieniają decyzji z punktów 1–2; odstępstwa wymagają zatwierdzenia.

**Rozdzielenie wymagań:** zakresy liczbowe diagramów, tabel i klas z PDF są **orientacyjne**, a nie sztywnymi limitami. Podane w tym dokumencie identyfikatory, technologie i konkretne reguły RoomBook to decyzje projektowe, **nie** narzucone przez prowadzącą.

### 1.2. Cel systemu

RoomBook to lokalnie uruchamiana aplikacja webowa do przeglądania dostępności i rezerwowania uczelnianych sal do nauki. Student zarządza własnymi rezerwacjami, a administrator salami, blokadami i rezerwacjami studentów. System chroni przed konfliktami czasowymi i zachowuje historię anulowań.

### 1.3. Kryterium sukcesu

Działająca aplikacja realizuje zakres podstawowy P1; wszystkie wymagania posiadają mierzalne kryteria akceptacji i powiązane testy, a dokumentacja opisuje **faktycznie zaimplementowany** system. Kluczowe procesy da się prześledzić od wymagania, przez przypadek użycia i diagram, do modułu kodu oraz wyniku testu.

## 2. Zakres i granice

### 2.1. Zakres podstawowy — P1

- Logowanie/wylogowanie na przygotowanych wcześniej kontach studenta i administratora.
- Lista uczelnianych sal oraz tygodniowy kalendarz godzinowej dostępności.
- Rezerwacja 45 albo 90 minut zajęć, z odpowiednio zarezerwowaną częścią kalendarza i buforem.
- Kontrola dozwolonych terminów, limitów studenta i konfliktów sal, użytkowników i blokad.
- Podgląd i anulowanie własnych przyszłych rezerwacji; historia anulowanych i zakończonych.
- Administrator: rezerwowanie w imieniu wskazanego studenta, podgląd i anulowanie przyszłych rezerwacji.
- Administrator: dodawanie/edycja sal, aktywacja/dezaktywacja, blokowanie i odblokowywanie terminów.
- Automatyczne anulowanie przyszłych rezerwacji dotkniętych dezaktywacją sali albo blokadą terminu.
- Prosty, responsywny interfejs w języku polskim z trybem jasnym i ciemnym.
- Automatyczne testy wybranych reguł, testy API, wybrane E2E, pomiar wydajności.

### 2.2. Ewentualne rozszerzenia — P2 (bez obowiązku implementacji)

- Powiadomienia e-mail o utworzeniu lub anulowaniu rezerwacji.
- Eksport rezerwacji do CSV.

Rozszerzenia mogą zostać podjęte wyłącznie po pełnej realizacji P1 i po osobnym zatwierdzeniu. Nie mogą zmieniać semantyki istniejących reguł bez aktualizacji tej specyfikacji.

### 2.3. Poza zakresem

Samodzielna rejestracja, przypomnienie/reset/zmiana hasła, integracja z USOS i uczelnianym SSO, płatności, wysyłanie e-maili, integracja z kalendarzami zewnętrznymi, powtarzające się rezerwacje, zatwierdzanie rezerwacji przez administratora, wyposażenie sal, zdjęcia, fizyczne kasowanie sal, produkcyjny hosting, Docker i aplikacja mobilna jako osobny produkt.

System nie korzysta z żadnego zewnętrznego dostawcy danych lub płatności. Użytkownicy są poza granicą systemu; przeglądarka, serwer i baza to kontenery wewnętrzne systemu w sensie C4.

## 3. Aktorzy, uprawnienia i zasady uwierzytelniania

| Rola | Uprawnienia | Ograniczenia |
|---|---|---|
| **STUDENT** | Logowanie, lista sal, tygodniowy podgląd terminów, tworzenie własnych rezerwacji, podgląd i anulowanie własnych przyszłych rezerwacji | Co najwyżej 3 przyszłe aktywne rezerwacje; maksymalnie 14 dni kalendarzowych wyprzedzenia; żadnych nakładających się własnych rezerwacji |
| **ADMIN** | Wszystko, co potrzebne do administrowania: sale, blokady, lista rezerwacji, anulowanie cudzych rezerwacji, zakładanie rezerwacji w imieniu wybranego studenta | Brak limitu liczby rezerwacji i brak 14-dniowego horyzontu dla rezerwacji tworzonych przez administratora; **nadal obowiązują** przyszłość terminu, dozwolone dni/godziny, dostępność sal, brak kolizji rezerwacji tego samego studenta i blokad |

- Konta są wprowadzane wyłącznie przez skrypt danych demonstracyjnych (seed). Brak formularza rejestracji i zarządzania kontami w GUI.
- Administrator **nie rezerwuje na własne konto administracyjne**: wybiera konkretnego studenta jako właściciela rezerwacji.
- Limit „3 przyszłe aktywne” weryfikowany jest przy **samodzielnej** próbie rezerwowania przez studenta, na podstawie całej liczby jego przyszłych aktywnych rezerwacji, także utworzonych wcześniej przez administratora. Administrator może przekroczyć limit w imieniu studenta.
- Zakaz nakładania się dwóch rezerwacji tego samego studenta dotyczy również rezerwacji administracyjnych. Wyjątek administratora dotyczy **liczby** i **wyprzedzenia**, nie konfliktów.
- API sprawdza tożsamość i rolę po stronie serwera, niezależnie od ukrywania przycisków w interfejsie.
- Hasła muszą być bezpiecznie hashowane (np. bcrypt), nigdy przechowywane jawnym tekstem.
- Preferowana implementacja sesji: podpisany token w ciasteczku `HttpOnly`, z ograniczonym czasem ważności, odpowiednią polityką `SameSite`, ochroną sekretu w `.env` i bez umieszczania danych uwierzytelniających w `localStorage`. Szczegół protokołu sesji trzeba ustalić jednolicie przed implementacją API i opisać w dokumentacji architektury.

## 4. Jednoznaczne reguły czasu i rezerwacji

### 4.1. Godziny i jednostki

- Strefa czasu reguł biznesowych i wyświetlania: `Europe/Warsaw`.
- Dni dopuszczające nowe rezerwacje: **poniedziałek–piątek**, bez specjalnych wyjątków świątecznych.
- Dozwolone **godziny rozpoczęcia**: pełne godziny `07:00`, `08:00`, …, `22:00` (16 startów dziennie).
- Jeden blok systemowy to 60 minut. Jest jednostką **zajętości sali**, nie długością zajęć.

| Wybór użytkownika | Czas zajęć | Zajętość systemowa sali | Przykład od 07:00 | Ostatni dopuszczalny start |
|---|---:|---:|---|---|
| **45 min** | 45 minut | 1 × 60 min | zajęcia 07:00–07:45, bufor 07:45–08:00 | 22:00 (zajęcia do 22:45; slot do 23:00) |
| **90 min** | 90 minut | 2 × 60 min | zajęcia 07:00–08:30, łącznie 30 min bufora do 09:00 | 21:00 (zajęcia do 22:30; sloty do 23:00) |

**Uwaga:** przy 90 minutach dwa systemowe bloki to 120 minut: 90 minut zajęć + 15 minut przerwy + 15 minut dodatkowego bufora. Nie wolno implementować 105-minutowej zajętości, ponieważ zrywałaby pełnogodzinną siatkę.

### 4.2. Formalna reprezentacja i konflikty

Rezerwacja oraz blokada posiadają `date` (lokalna data `YYYY-MM-DD`), `startHour` (liczba całkowita) i `durationSlots ∈ {1,2}`. Liczba minut zajęć wynika z `durationSlots`: 1 → 45, 2 → 90. Zajętość systemowa to półotwarty przedział `[startHour, startHour + durationSlots)` liczony w pełnych godzinach tego samego dnia.

Dwa przedziały zachodzą na siebie wtedy i tylko wtedy, gdy:

`a.startHour < b.startHour + b.durationSlots && b.startHour < a.startHour + a.durationSlots`

- Rezerwacje są sprzeczne, jeśli zachodzą na siebie dla **tej samej sali** lub **tego samego studenta** na dany dzień.
- Blokada sali uniemożliwia rezerwację nachodzącego terminu.
- Różne sale mogą być niezależnie rezerwowane w tym samym terminie przez różnych studentów.
- Anulowane rezerwacje nie blokują terminów; nie usuwa się ich z historii.
- Blokady nie mogą nakładać się na inne aktywne blokady tej samej sali; duplikat należy odrzucić z czytelną informacją.
- Dla długości 2 bloków start o `22:00` jest niepoprawny; dla długości 1 jest dozwolony.

### 4.3. Horyzont czasowy i limity studenta

- Każda nowa rezerwacja musi zaczynać się **w przyszłości** względem aktualnego czasu `Europe/Warsaw`.
- Student może dokonywać rezerwacji na lokalne daty od dzisiaj do **dzisiaj + 14 dni kalendarzowych włącznie**, pod warunkiem że wybrana godzina jeszcze się nie rozpoczęła i dzień jest roboczy.
- Administrator może rezerwować dowolnie daleko w przyszłość, ale nie w przeszłość, weekend ani godzinę spoza harmonogramu.
- Student może mieć **maksymalnie 3 przyszłe aktywne rezerwacje**. Rezerwacja rozpoczęta lub zakończona nie zalicza się do tego limitu przyszłych rezerwacji. System może nadal prezentować ją historycznie jako zakończoną, bez przepisywania statusu bazy.
- Administrator nie ma limitu 3 rezerwacji, lecz tworzone przez niego rezerwacje liczą się później do limitu studenta.
- Student i administrator nie mogą utworzyć nakładających się rezerwacji dla tego samego studenta, nawet w różnych salach.
- Każda rezerwacja zatwierdzana jest natychmiast po spełnieniu reguł; nie ma etapu akceptacji administracyjnej.

### 4.4. Anulowanie i historia

- Student może anulować **tylko własną aktywną rezerwację, której godzina rozpoczęcia jest nadal w przyszłości**.
- Administrator może anulować **dowolną przyszłą aktywną rezerwację studenta**, ale nie rozpoczętą ani zakończoną.
- Anulowanie zmienia status na `CANCELLED`, zapisuje czas, inicjatora i przyczynę. Nie usuwa rekordu.
- Zakończenie rezerwacji wyświetlane jest jako stan wynikający z czasu; nie wymaga trzeciego trwałego statusu `COMPLETED`.
- Kategorie przyczyn anulowania: `STUDENT_CANCELLED`, `ADMIN_CANCELLED`, `ROOM_DEACTIVATED`, `TIME_BLOCKED`.
- Ponowna aktywacja sali ani usunięcie blokady **nie przywraca** anulowanych rezerwacji.

### 4.5. Działania administratora zmieniające wiele rekordów

- Dezaktywacja sali ustawia `isActive=false` oraz anuluje **wszystkie jej przyszłe aktywne rezerwacje** w jednej transakcji. Przed potwierdzeniem należy wyświetlić liczbę rezerwacji, które zostaną anulowane.
- Ponowna aktywacja sali pozwala tworzyć nowe rezerwacje; nie przywraca starych.
- Administrator może założyć blokadę na 1 lub 2 bloki systemowe. Jeśli nachodzi ona na przyszłe aktywne rezerwacje tej sali, należy je anulować w tej samej transakcji co utworzenie blokady. Przed zatwierdzeniem należy pokazać liczbę anulowanych rezerwacji.
- Blokada musi rozpoczynać się w przyszłości, mieścić się w dniach i godzinach harmonogramu i nie kolidować z już istniejącą blokadą.
- Usunięcie blokady zwalnia czas do nowych rezerwacji, nie cofa wcześniejszych anulowań.
- Zmiana nazwy/numeru/opisu/pojemności sali nie modyfikuje historii rezerwacji.
- Nie oferujemy usuwania sal ani automatycznego przenoszenia rezerwacji do innych sal.
- Operacje grupowe są **atomowe**: w razie błędu baza nie może pozostać w stanie „sala wyłączona, część rezerwacji nadal aktywna” lub „blokada utworzona, rezerwacje nieanulowane”.

### 4.6. Integralność przy współbieżności

Sprawdzenie dostępności na ekranie jest informacją orientacyjną, nie gwarancją późniejszej rezerwacji. Podczas zapisu należy ponownie zweryfikować cały zestaw reguł i zapewnić serializację/atomowość operacji w SQLite. Dwie współbieżne próby zapisu kolidujących terminów nie mogą obie zakończyć się sukcesem. Należy obsłużyć blokady bazy, przejściowe błędy i konflikt odpowiednim statusem API, bez tworzenia duplikatów. Konkretna implementacja może korzystać z transakcji i/lub odpowiednich ograniczeń integralności, ale musi zdać test współbieżności na **rzeczywistej** bazie SQLite.

## 5. Sale i dane demonstracyjne

- Sala ma **unikalny numer** (`roomNumber`), opcjonalną nazwę (`name`), opcjonalny opis (`description`), dodatnią liczbę miejsc (`capacity`) oraz flagę aktywności (`isActive`).
- „Sala aktywna” oznacza, że może być udostępniana do nowych rezerwacji. „Termin dostępny” jest **wyliczany** na podstawie aktywności sali, rezerwacji i blokad; nie jest osobnym statusem całej sali.
- Numery są obowiązkowe, unikalne po normalizacji białych znaków i wielkości liter.
- Edycja odbywa się na istniejącym rekordzie; historii rezerwacji nie usuwa się.

### 5.1. Osiem sal demonstracyjnych

| Numer sali | Nazwa (opcjonalna) | Miejsca | Status początkowy |
|---|---|---:|---|
| A-101 | Sala projektowa | 6 | aktywna |
| A-102 | Sala seminaryjna | 8 | aktywna |
| B-201 | Sala do konsultacji | 4 | aktywna |
| B-202 | Sala zespołowa | 10 | aktywna |
| C-301 | Sala warsztatowa | 12 | aktywna |
| C-302 | — | 5 | aktywna |
| D-401 | Sala konferencyjna | 16 | aktywna |
| D-402 | — | 6 | aktywna |

Seed powinien też tworzyć **1 konto administratora i 5 fikcyjnych kont studentów** (np. Anna Nowak, Jan Kowalski, Julia Wiśniewska, Piotr Zieliński, Maja Lewandowska), z hasłami demonstracyjnymi przeznaczonymi wyłącznie do środowiska lokalnego, zapisanymi jako hashe. Instrukcja lokalnego uruchomienia podaje sposób uzyskania danych testowych. Seed musi być powtarzalny i nie może przypadkowo duplikować rekordów.

## 6. Wymagania funkcjonalne — wszystkie P1

Poniższe kryteria akceptacji są minimalnym kontraktem. Identyfikatory są trwałe; przy zmianie nie należy ich przypadkowo renumerować.

| ID | Funkcjonalność | Kryterium akceptacji (weryfikowalne) |
|---|---|---|
| **WF-01** | Logowanie i wylogowanie | Poprawny login/hasło konta demonstracyjnego otwiera właściwy widok; błędne dane dają odmowę; po wylogowaniu chroniony endpoint odmawia dostępu bez ponownego zalogowania. |
| **WF-02** | Przeglądanie sal | Student widzi tylko aktywne sale, numer, opcjonalną nazwę i pojemność; administrator widzi także nieaktywne i ich status. |
| **WF-03** | Tygodniowy kalendarz dostępności | Po wyborze sali i tygodnia pokazywane są sloty pon.–pt. 07:00–22:00; zajęte, zablokowane i niedozwolone terminy są rozróżnione; wybór 90 min wymaga dwóch wolnych kolejnych slotów. |
| **WF-04** | Samodzielne rezerwowanie przez studenta | Poprawna rezerwacja na 45/90 min zostaje zapisana dla zalogowanego studenta jako `ACTIVE`; limit 3, +14 dni, przyszłość i godziny są sprawdzane. |
| **WF-05** | Rezerwowanie w imieniu studenta | Administrator wybiera studenta i tworzy jego rezerwację bez limitu liczby oraz horyzontu +14 dni; zapisuje rzeczywistego właściciela i administratora jako inicjatora. |
| **WF-06** | Odrzucanie konfliktów | Kolidujące rezerwacje sali, kolidujące rezerwacje studenta, blokady oraz nieaktywna sala powodują odmowę; także przy próbach równoczesnych nie powstają dwa sprzeczne wpisy. |
| **WF-07** | Moje rezerwacje i historia | Student widzi wyłącznie własne rezerwacje, datę, godzinę, długość zajęć, salę i stan: nadchodząca, rozpoczęta/zakończona lub anulowana. |
| **WF-08** | Samodzielne anulowanie | Student anuluje wyłącznie własną przyszłą aktywną rezerwację; status i powód anulowania zostają zapisane, a termin zwolniony. |
| **WF-09** | Podgląd wszystkich rezerwacji | Administrator widzi rezerwacje wszystkich studentów wraz z właścicielem, salą, datą, długością, statusem i źródłem utworzenia. |
| **WF-10** | Anulowanie administracyjne | Administrator może anulować dowolną przyszłą aktywną rezerwację, a historia zawiera powód i inicjatora. |
| **WF-11** | Dodawanie sal | Administrator tworzy salę o unikalnym numerze i dodatniej pojemności; brakujący numer lub duplikat powoduje odrzucenie. |
| **WF-12** | Edytowanie sal | Administrator zmienia numer, nazwę, opis lub liczbę miejsc; walidacja obowiązuje, a zapisane rezerwacje nadal wskazują tę samą salę. |
| **WF-13** | Aktywacja/dezaktywacja sal | Dezaktywacja blokuje nowe rezerwacje i atomowo anuluje wszystkie przyszłe aktywne rezerwacje; aktywacja nie odtwarza anulowanych. |
| **WF-14** | Zarządzanie blokadami | Administrator zakłada i usuwa blokady 1/2-slotowe; utworzenie blokady anuluje atomowo przyszłe kolidujące rezerwacje i wymaga potwierdzenia liczby anulowań. |
| **WF-15** | Kontrola ról i dostępu do danych | Student nie może wywołać administracyjnych operacji przez API ani odczytać/modyfikować cudzych rezerwacji, nawet zmieniając identyfikator żądania. |

### 6.1. Wymagania niefunkcjonalne — P1

| ID | Kategoria | Kryterium akceptacji |
|---|---|---|
| **WN-01** | Ochrona poświadczeń | Żadne hasło konta nie jest zapisane jawnie w bazie; żądania wymagające roli mają weryfikowaną sesję i uprawnienia po stronie serwera. |
| **WN-02** | Wydajność | Przy bazie z co najmniej 1000 rezerwacji, przy 10 równoczesnych użytkownikach testowych, co najmniej 95% odpowiedzi operacji przeglądania dostępności ma czas ≤ 2 s podczas pomiaru trwającego 10 min; zapisać środowisko i wyniki. |
| **WN-03** | Obsługa klawiaturą | Logowanie, wybór terminu, złożenie/anulowanie rezerwacji i podstawowe działania administratora są możliwe samą klawiaturą; fokus jest widoczny. |
| **WN-04** | Zgodność przeglądarek | Kluczowe scenariusze przechodzą w aktualnych stabilnych wersjach Chrome i Firefox na komputerze. |
| **WN-05** | Responsywność i motywy | Kluczowe widoki są używalne na szerokości ekranu 375 px i 1280 px bez poziomego przewijania całej strony; dostępny tryb jasny/ciemny, a wybór jest zachowany po odświeżeniu w danej przeglądarce. |

## 7. Przypadki użycia i modelowanie zachowania

### 7.1. Diagram przypadków użycia

Jeden diagram systemu z **dwoma aktorami** i **ośmioma głównymi przypadkami**:

| ID | Nazwa | Aktorzy | Powiązane wymagania |
|---|---|---|---|
| **UC-01** | Logowanie do systemu | Student, Administrator | WF-01, WF-15 |
| **UC-02** | Przeglądanie sal i dostępności | Student, Administrator | WF-02, WF-03 |
| **UC-03** | Rezerwowanie sali | Student, Administrator (w imieniu studenta) | WF-04, WF-05, WF-06 |
| **UC-04** | Przeglądanie własnych rezerwacji | Student | WF-07 |
| **UC-05** | Anulowanie własnej rezerwacji | Student | WF-08 |
| **UC-06** | Zarządzanie salami | Administrator | WF-11, WF-12, WF-13 |
| **UC-07** | Zarządzanie blokadami | Administrator | WF-14 |
| **UC-08** | Zarządzanie rezerwacjami studentów | Administrator | WF-09, WF-10 |

Dla **każdego UC-01…UC-08** należy opracować formalny opis zawierający: ID, nazwę, aktora, cel, warunki wstępne, scenariusz podstawowy (kroki), scenariusze alternatywne/wyjątkowe i warunki końcowe. Powiązania między aktorami i UC modelować zgodnie ze standardową notacją UML; nie dodawać nieuzasadnionych `include`/`extend`.

### 7.2. Diagramy aktywności

- **AD-01 / UC-03:** wybór terminu, rozróżnienie 45/90, sprawdzanie limitów i konfliktów, ponowna weryfikacja w transakcji, sukces/błąd.
- **AD-02 / UC-05, UC-08:** anulowanie własne i administracyjne, kontrola właściciela/roli, przyszłości terminu oraz historii.
- **AD-03 / UC-07, UC-06:** blokada albo dezaktywacja sali, podgląd liczby anulowań, zatwierdzenie, transakcyjne anulowania.

Diagramy aktywności muszą zawierać istotne rozgałęzienia i prawidłową notację UML, nie tylko zwykłe schematy blokowe.

### 7.3. Diagramy sekwencji projektowej

- **SD-01 / UC-03:** rezerwacja i atomowe sprawdzenie konfliktów.
- **SD-02 / UC-05:** anulowanie własnej rezerwacji i weryfikacja uprawnień.
- **SD-03 / UC-07:** administrator tworzy blokadę, ustala kolizje i anuluje rezerwacje w transakcji.

Operacje i obiekty na diagramach sekwencji **muszą odpowiadać** klasom i metodom z diagramu klas. Jeśli kod lub nazwy klas się zmienią, model także musi zostać uaktualniony.

## 8. Architektura i technologie

### 8.1. Stos technologiczny

| Obszar | Zatwierdzona technologia / ograniczenie |
|---|---|
| UI | React + TypeScript + Vite |
| Serwer API | Node.js + Express + TypeScript |
| Dane | SQLite |
| ORM / migracje | Prisma, w wersji kompatybilnej z wybranym Node.js |
| Testy jednostkowe | Vitest |
| Testy HTTP/API | Supertest |
| Testy E2E | Playwright |
| Diagramy UML i C4 | PlantUML, pliki źródłowe `.puml` oraz wyrenderowane SVG/PNG |
| CI | GitHub Actions dla sprawdzania jakości kodu i testów możliwych w CI |
| Wdrożenie | Wyłącznie lokalnie na Windows 11 / PowerShell; brak Dockera i hostingu |
| Język | Polski UI i dokumentacja, angielskie identyfikatory programistyczne |

Kod powinien być podzielony na łatwo odnajdywalne moduły, bez niepotrzebnego rozbudowywania warstw. Wymaga się wyraźnej separacji: interfejs → kontrolery API → logika biznesowa → repozytoria → baza danych. Dozwolone są proste funkcje pomocnicze dla arytmetyki slotów i walidacji.

### 8.2. C4 System Context

System: RoomBook. Osoby: Student i Administrator. Relacje opisują przeglądanie sal/rezerwacje oraz zarządzanie salami/rezerwacjami. **Brak usług zewnętrznych**. Baza danych i frontend są elementami systemu, więc **nie** należy rysować ich jako zewnętrznych systemów w C4 Context.

### 8.3. C4 Container

Trzy podstawowe kontenery: (1) React SPA w przeglądarce, (2) serwer Express REST/JSON, (3) lokalna baza SQLite. Opisać odpowiedzialność każdego i relacje `HTTP/JSON` / dostęp ORM do SQLite. Pokazać zastosowane technologie, bez wymyślania dodatkowej infrastruktury.

### 8.4. Plan diagramu klas — zakres projektowy backendu

Około 12 kluczowych klas:

- **Encje domenowe:** `User`, `Room`, `Booking`, `TimeBlock`.
- **Usługi biznesowe:** `AuthService`, `RoomService`, `BookingService`, `TimeBlockService`.
- **Repozytoria:** `UserRepository`, `RoomRepository`, `BookingRepository`, `TimeBlockRepository`.

Model klas obejmuje ważne pola, operacje i relacje. Jest modelem **wybranej części obiektowej backendu**, nie każdej funkcji i komponentu w React. Operacje z SD-01…SD-03 muszą istnieć w diagramie; metody pomocnicze można wydzielać, jeśli poprawia to czytelność, ale wówczas zaktualizować diagram i opis architektury.

### 8.5. API — minimalne kontrakty (możliwa korekta nazw bez zmiany zachowania)

| Metoda i ścieżka | Opis / rola |
|---|---|
| `POST /api/auth/login` | Logowanie obu ról |
| `POST /api/auth/logout` | Wylogowanie obu ról |
| `GET /api/auth/me` | Bieżące konto i rola |
| `GET /api/rooms` | Lista sal z zakresem informacji odpowiednim do roli |
| `GET /api/availability?roomId=&weekStart=` | Dostępność tygodniowa i rozróżnienie blokad/rezerwacji |
| `POST /api/bookings` | Rezerwacja studenta lub administratora na rzecz studenta |
| `GET /api/bookings/mine` | Rezerwacje zalogowanego studenta |
| `POST /api/bookings/:id/cancel` | Własne lub administracyjne anulowanie z kontrolą roli |
| `GET /api/admin/students` | Lista demonstracyjnych studentów do wybrania przez administratora |
| `GET /api/admin/bookings` | Lista wszystkich rezerwacji |
| `POST /api/admin/rooms` | Dodanie sali |
| `PATCH /api/admin/rooms/:id` | Edycja/aktywacja/dezaktywacja sali; przy dezaktywacji podgląd skutków i potwierdzenie |
| `GET /api/admin/blocks` | Lista blokad |
| `POST /api/admin/blocks` | Utworzenie blokady i atomowe anulowanie kolidujących rezerwacji |
| `DELETE /api/admin/blocks/:id` | Usunięcie blokady |

Operacje wymagające potwierdzenia anulowań mają dostarczać w UI liczbę dotkniętych rekordów przed ostateczną zmianą; serwer liczy kolizje **ponownie w transakcji**. W razie rozbieżności po potwierdzeniu wymagane jest odświeżenie informacji lub bezpieczna odmowa — nigdy ciche anulowanie dodatkowych rezerwacji nieobjętych potwierdzeniem. Konkretny mechanizm `preview/confirm` trzeba doprecyzować w kontrakcie API i testach przed implementacją administracji.

Oczekiwane kategorie odpowiedzi HTTP: `401` brak sesji, `403` niewystarczające uprawnienia, `400/422` błędne dane, `404` brak zasobu lub cudzy rekord odpowiednio do polityki ujawniania, `409` konflikt terminu lub współbieżności; spójny format błędów. Żadne żądanie frontendowe nie może omijać walidacji backendu.

## 9. Model danych i integralność

**Docelowo cztery podstawowe tabele**. Ostateczne nazwy pól można dopracować przy projektowaniu Prisma, zachowując semantykę.

### `users`

- `id` — klucz główny.
- `email` — niepusty, unikatowy login.
- `display_name` — fikcyjna nazwa użytkownika.
- `password_hash` — wymagany hash, nigdy hasło jawne.
- `role` — `STUDENT` albo `ADMIN`.

### `rooms`

- `id` — klucz główny.
- `room_number` — unikatowy, obowiązkowy.
- `name` — opcjonalna.
- `description` — opcjonalny.
- `capacity` — liczba całkowita dodatnia.
- `is_active` — boolean.

### `bookings`

- `id` — klucz główny.
- `student_id` — FK do `users`, właściciel rezerwacji.
- `room_id` — FK do `rooms`.
- `created_by_user_id` — FK do `users`, kto rzeczywiście zainicjował rezerwację.
- `date` — lokalne `YYYY-MM-DD` (nie mieszać z pełnym znacznikiem UTC).
- `start_hour` — liczba całkowita `7…22`.
- `duration_slots` — `1` albo `2`.
- `status` — `ACTIVE` albo `CANCELLED`.
- `created_at`, `cancelled_at` (opcjonalnie).
- `cancelled_by_user_id` (opcjonalnie FK) i `cancel_reason` (opcjonalnie).

### `time_blocks`

- `id` — klucz główny.
- `room_id` — FK do `rooms`.
- `date`, `start_hour`, `duration_slots` — analogiczne do rezerwacji.
- `reason` — opcjonalny opis.
- `created_by_user_id` — FK do administratora.
- `created_at`.

Wymagane: klucze obce, unikalność e-maili i numerów sal, walidacja wartości liczbowych, transakcyjna spójność przy konfliktach. **Prosta unikalność `(room_id, date, start_hour)` nie wystarczy** do ochrony przed nakładaniem się 90-minutowych rezerwacji; trzeba zaimplementować właściwe sprawdzanie przedziałów i weryfikować je w testach równoległych. Baza musi zachowywać historię anulowań, więc nie stosujemy kasowania kaskadowego rezerwacji przy zmianie sali.

## 10. Interfejs i nawigacja

Wymagane **siedem kluczowych widoków**:

1. `UI-01` — Logowanie.
2. `UI-02` — Tygodniowy kalendarz studenta z wyborem sali, tygodnia, długości 45/90 min oraz zatwierdzeniem rezerwacji.
3. `UI-03` — Moje rezerwacje (nadchodzące/historia/anulowane; akcja anulowania wyłącznie gdy dozwolona).
4. `UI-04` — Zarządzanie salami (administrator: lista, dodawanie, edycja, aktywacja/dezaktywacja z potwierdzeniem).
5. `UI-05` — Wszystkie rezerwacje (administrator: wyszukanie/podgląd i anulowanie).
6. `UI-06` — Blokady sal (administrator: tworzenie/usuwanie, podgląd skutków).
7. `UI-07` — Rezerwacja w imieniu studenta (administrator: wskazanie studenta, sali, daty i długości).

Oczekiwane cechy: czytelny prosty wygląd uczelniany, responsywność, jasny/ciemny motyw, widoczny fokus klawiatury, komunikaty walidacyjne oraz potwierdzenia dla operacji masowych. Week view pokazuje poniedziałek–piątek i pełne godzinne sloty; 90-minutowa rezerwacja graficznie zajmuje **dwie** komórki. Nie wprowadzać drag-and-drop ani kompleksowego kalendarza zewnętrznego, jeśli nie jest to konieczne.

Makiety powinny przedstawiać powyższe ekrany i diagram/krótki opis nawigacji. W końcowej dokumentacji porównać makiety z rzeczywiście działającym interfejsem.

## 11. Wymagane testy i przykładowa macierz pokrycia

Przypadki testowe trzeba zapisać w tabeli z polami: `ID`, wymaganie / scenariusz, dane wejściowe lub warunki, oczekiwany rezultat, **rzeczywiście uzyskany rezultat**, status i ewentualna uwaga. **Nie wypełniać pól wyniku uzyskanego przed wykonaniem testu.**

| ID | Pokrywane wymagania | Minimalny scenariusz |
|---|---|---|
| TC-01 | WF-01 | Poprawne logowanie studenta i wylogowanie |
| TC-02 | WF-01 | Błędne hasło nie loguje użytkownika |
| TC-03 | WF-02 | Student widzi tylko aktywne sale z pojemnością |
| TC-04 | WF-03 | Tygodniowy kalendarz pokazuje 60-minutowe komórki i stan zajętości |
| TC-05 | WF-04 | Student rezerwuje 45 min na wolny termin |
| TC-06 | WF-04 | Student rezerwuje 90 min; zajmuje 2 systemowe sloty |
| TC-07 | WF-04 | Student nie może utworzyć 4. przyszłej rezerwacji |
| TC-08 | WF-04 | Student nie może rezerwować > 14 dni naprzód ani w weekend |
| TC-09 | WF-05 | Administrator rezerwuje dla studenta > 14 dni w przyszłości mimo 3 jego rezerwacji |
| TC-10 | WF-06 | Kolizja sali lub dwóch rezerwacji tego samego studenta powoduje odrzucenie |
| TC-11 | WF-06 | Dwie współbieżne próby kolidujące kończą się co najwyżej jednym zapisem |
| TC-12 | WF-06, WF-14 | Zablokowanego terminu nie można zarezerwować |
| TC-13 | WF-07 | Student widzi własną historię, nie widzi cudzej |
| TC-14 | WF-08 | Anulowanie własnej przyszłej rezerwacji zwalnia slot |
| TC-15 | WF-08, WF-10 | Anulowanie cudzej rezerwacji przez studenta zabronione; przez admina dozwolone |
| TC-16 | WF-09 | Administrator widzi wszystkie rezerwacje |
| TC-17 | WF-11, WF-12 | Dodanie/edycja sali, wykrywanie zduplikowanego numeru |
| TC-18 | WF-13 | Dezaktywacja sali atomowo anuluje wszystkie jej przyszłe rezerwacje |
| TC-19 | WF-14 | Blokada 90 min anuluje kolidujące przyszłe rezerwacje i nie powstaje duplikat blokady |
| TC-20 | WF-14 | Usunięcie blokady nie przywraca anulowanych rezerwacji |
| TC-21 | WF-15 | Próby wejścia studenta na API administratora dają odmowę |
| TC-22 | WN-01 | W bazie brak haseł jawnych |
| TC-23 | WN-02 | Udokumentowany 10-minutowy test wydajnościowy zgodny z metryką p95 |
| TC-24 | WN-03 | Krytyczne ścieżki obsługiwane klawiaturą |
| TC-25 | WN-04 | Chrome i Firefox: podstawowe scenariusze E2E |
| TC-26 | WN-05 | 375 px / 1280 px, jasny/ciemny tryb i zapis preferencji |

**Automatyzacja minimalna:** Vitest dla reguł slotów, uprawnień i limitów; Supertest dla API/rezerwacji i atomowości; Playwright dla logowania, rezerwacji, anulowania i administracji. Test obciążeniowy ma posiadać skrypt, opis środowiska, sposób seedowania co najmniej 1000 rekordów i zachowane wyniki rzeczywistego uruchomienia. Wyniki uzyskane w lokalnej maszynie należy odróżnić od tych uzyskanych w CI.

Testy muszą być deterministyczne: kontrola zegara w testach, izolacja bazy testowej, odtwarzalne dane, osobna konfiguracja testowa bez niszczenia danych demonstracyjnych.

## 12. Zgodność z 11 etapami zaliczenia (35 punktów)

| Etap | Rezultat wymagany przez prowadzącą | Planowane artefakty RoomBook | Pkt |
|---|---|---|---:|
| 1. Analiza/specyfikacja | Cel, zakres P1/P2, tabelaryczne WF/WN, priorytety i kryteria akceptacji | niniejszy dokument + ostateczny opis analizy | 4 |
| 2. Przypadki użycia | Diagram UML oraz formalne opisy wybranych UC | UC-01…08 i ich formalne opisy | 4 |
| 3. Aktywności | Warianty i decyzje na diagramach UML | AD-01…03 | 2 |
| 4. Kontekst | C4 System Context z relacjami | `c4-context.puml` | 2 |
| 5. Architektura | C4 Container, odpowiedzialności, technologie, komunikacja | `c4-container.puml` + opis | 3 |
| 6. Struktura obiektowa | Klasy, atrybuty, operacje, relacje | `class-diagram.puml` (~12 klas) | 4 |
| 7. Sekwencje | Projektowe sekwencje zgodne z klasami | SD-01…03 | 3 |
| 8. Dane | Model zgodny z rzeczywistą bazą | ERD 4 tabel + migracje Prisma | 1 |
| 9. UI | Makiety głównych ekranów i nawigacja | UI-01…07, schemat przejść | 2 |
| 10. Implementacja | Działająca aplikacja zgodna z projektem | kod frontend/backend, lokalna instrukcja | 6 |
| 11. Testowanie | Tabela testów z wynikiem uzyskanym i testy automatyczne | TC-01…26, skrypty i raporty | 4 |
| **Razem** | | | **35** |

**Macierz spójności:** WF ↔ UC ↔ AD/SD ↔ diagram klas/C4/ERD ↔ ekrany ↔ moduły kodu ↔ TC. W szczególności: `WF-04/WF-06 → UC-03 → AD-01/SD-01 → BookingService/BookingRepository → bookings → UI-02/UI-07 → TC-05…11`. W końcowej dokumentacji należy przygotować pełną tabelę odsyłaczy i skontrolować brak „osieroconych” wymagań.

## 13. Organizacja kodu i dokumentacji

**Proponowany układ** (katalogi można dostosować w ramach etapów, zachowując podział odpowiedzialności):

```text
roombook/
├── README.md
├── package.json                  # skrypty uruchamiania/testów całego projektu
├── package-lock.json             # odtwarzalne instalacje
├── apps/
│   ├── web/                       # React/Vite/TypeScript
│   └── api/                       # Express/TypeScript, domena, usługi, repozytoria
├── prisma/                        # schemat, migracje, seed
├── docs/
│   ├── SPECYFIKACJA_ROOMBOOK.md   # aktualna specyfikacja nadrzędna
│   ├── requirements/              # tabelaryczne wymagania i śledzenie zmian
│   ├── use-cases/                 # UC i ich formalne scenariusze
│   ├── activities/                # AD .puml + SVG/PNG
│   ├── architecture/              # C4 Context/Container
│   ├── classes/                   # diagram klas
│   ├── sequences/                 # SD
│   ├── data-model/                # ERD i opis danych
│   ├── wireframes/                # UI i nawigacja
│   ├── testing/                   # przypadki testowe, wyniki, instrukcje
│   └── CHANGELOG.md              # decyzje i korekty dokumentacji
├── tests/                         # testy wspólne, E2E i obciążeniowe
└── .github/workflows/             # typy, testy, budowanie
```

Nie chodzi o posiadanie ogromnej liczby plików: dokumentacja ma być kompletna, lecz **zwięzła**. Nie powielać tych samych akapitów w każdym etapie; korzystać z odsyłaczy i identyfikatorów.

Przykładowe skrypty projektowe: `npm install`, `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run build`, `npm run lint`, `npm run db:seed`. Ich rzeczywiste nazwy muszą zostać zapisane w README po implementacji. Instrukcje mają działać w Windows 11 / PowerShell. GitHub Actions uruchamia odpowiedni podzbiór kontroli jakości, mimo że aplikacja działa wyłącznie lokalnie.

## 14. Plan podziału na 12 etapów wykonawczych

Każdy etap powinien być możliwy do wykonania w **odrębnej sesji roboczej**, opierając się na repozytorium i niniejszej specyfikacji zamiast na pamięci poprzedniej sesji. Nie wykonywać niezatwierdzonych zadań z późniejszych etapów; każde zadanie kończy się weryfikacją, raportem i przekazaniem stanu.

| Nr | Temat | Główne artefakty | Bramka jakości |
|---|---|---|---|
| **01** | Inicjalizacja i konwencje | mono-repo, TypeScript, Vite, Express, Prisma, test runners, scripts, README | Projekt instaluje się, startuje i buduje w PowerShell; brak przypadkowego kodu biznesowego |
| **02** | Analiza wymagań i przypadki użycia | kompletne WF/WN, 8 UC, scenariusze, macierz WF→UC | kryteria jednoznaczne, zgodność z niniejszą specyfikacją |
| **03** | Aktywności i C4 | AD-01…03, C4 Context i Container | diagramy renderują się i mają poprawną notację, nie ma sprzecznych aktorów/kontenerów |
| **04** | Klasy, sekwencje i dane | diagram klas, SD-01…03, ERD, szkic Prisma | operacje SD istnieją w klasach, wszystkie dane niezbędne do reguł są modelowane |
| **05** | Makiety i fundament interfejsu | UI-01…07, opis nawigacji, układ jasny/ciemny | makiety pozwalają zrealizować główne UC, UI odpowiada zakresowi |
| **06** | Backend: dane i uwierzytelnianie | migracje SQLite, seed, login/logout, role, testy auth | wymagania WF-01/WF-15 i WN-01 pokryte testami |
| **07** | Backend: rezerwacje | walidacje dat i slotów, kolizje, rezerwacja/anulowanie, transakcje i test współbieżności | WF-04…08, TC-05…14 przechodzą |
| **08** | Backend: administracja | zarządzanie salami, studentami, rezerwacjami, blokady i masowe anulowania | WF-05/WF-09…14, atomowość i potwierdzenia |
| **09** | Frontend: student | logowanie, kalendarz tygodniowy, moje rezerwacje, anulowanie | kompletna ręczna ścieżka studenta + podstawowe E2E |
| **10** | Frontend: administrator | sale, blokady, przegląd, tworzenie/anulowanie rezerwacji | kompletna ręczna ścieżka administratora + E2E |
| **11** | Testy i jakość | rozwinięcie Vitest/Supertest/Playwright, test obciążenia, CI, tabela TC z rzeczywistymi wynikami | nie ma testów „zaliczonych na papierze”; zgłoszone wszystkie blokery |
| **12** | Audyt zaliczeniowy | kontrola WF→UC→AD/SD/C4/ERD/UI→kod→TC, poprawki, finalny README | kompletność 11 etapów; dokumentacja i kod opisują ten sam system |

**Uwaga o podziale:** etap 07 lub 08 można rozciąć na dodatkowe mniejsze sesje, jeśli czytanie kodu, testowanie i poprawki grożą wyczerpaniem budżetu kontekstu. **Jakość i limit kontekstu są ważniejsze niż sztywna liczba 12 sesji**. Rozdzielenie etapu nie zmienia zakresu wymagań ani identyfikatorów.

### 14.1. Obowiązkowe zakończenie każdego etapu

Każdy etap pozostawia zwięzły, sprawdzalny stan:

1. Lista wykonanych zadań i zmodyfikowanych plików.
2. Powiązania z WF/UC/AD/SD/TC, których dotyczyły zmiany.
3. Wykonane komendy walidacyjne i ich **rzeczywiste** wyniki.
4. Lista otwartych problemów i świadomie niezaimplementowanych elementów.
5. Rzeczywista historia zmian Git: kto wykonał i zatwierdził każdą zmianę.
6. Zwięzła instrukcja rozpoczęcia kolejnego etapu.

Nie zapisywać niezweryfikowanych stwierdzeń „wszystkie testy przeszły” bez uruchomienia tych testów. Nie wprowadzać bez uzgodnienia nowych bibliotek, usług ani funkcji wykraczających poza zatwierdzony zakres.

## 15. Zarządzanie zmianami i historia repozytorium

- Projekt wraz z dokumentacją ma być rozwijany systematycznie na GitHub; prowadzący ma mieć dostęp do kodu, dokumentacji i historii od początku.
- Każdy student korzysta z **własnego konta GitHub**, a w historii repozytorium ma być widoczny jego **rzeczywisty** wkład. Nie przypisywać zmian osobie, która ich nie wykonała; nie tworzyć fikcyjnych commitów ani sztucznej historii pracy.
- Opisy commitów: krótkie, proste, zwykle jedno zdanie, dotyczące faktycznie wykonanej zmiany, np. `Dodano walidację terminów rezerwacji`.
- Liczba commitów na temat powinna wynikać z logicznych etapów pracy, a nie z obowiązkowego wzorca 2–3 zmian.
- Zmianę wymagań zatwierdza się przed zmianą projektu i kodu. Każda zatwierdzona korekta ma zawierać datę, zakres, powód i listę dotkniętych artefaktów.
- Dokumentacja końcowa ma odzwierciedlać rzeczywistą aplikację. Wstępne makiety i diagramy wolno korygować, ale zmian nie można przemilczeć.

## 16. Kontrola jakości przed końcowym odbiorem

- [ ] Wszystkie WF-01…WF-15 i WN-01…WN-05 mają kryteria akceptacji oraz powiązane testy.
- [ ] Diagram UC pokazuje dokładnie role i zachowania opisane w scenariuszach.
- [ ] Są 3 czytelne diagramy aktywności, 2 C4 i projektowe sekwencje zgodne z klasami.
- [ ] ERD, migracje Prisma, faktyczne pola i relacje odpowiadają sobie.
- [ ] UI pozwala wykonać wszystkie ważne scenariusze, w tym przypadki odmowy.
- [ ] Dla 90 minut system blokuje 2 pełne sloty; ostatni start 90 minut to 21:00.
- [ ] Student jest ograniczony do 3 aktywnych przyszłych rezerwacji i +14 dni; administrator ma dwa opisane wyjątki.
- [ ] Nawet administrator nie może nadpisać konfliktu sali, blokady ani podwójnie zarezerwować studenta.
- [ ] Anulowania admina, blokady i dezaktywacje są transakcyjne i zostawiają poprawną historię.
- [ ] Przetestowano prawdziwą współbieżność na SQLite.
- [ ] Po odświeżeniu działa jasny/ciemny tryb; interfejs działa na telefonie i klawiaturą.
- [ ] Testy jednostkowe, API i E2E rzeczywiście uruchomiono; wyniki zapisano bez fabrykowania.
- [ ] Test wydajnościowy spełnia przyjętą metrykę albo uczciwie ujawnia niespełnienie.
- [ ] `npm run build`, testy i instrukcja PowerShell są odtwarzalne ze świeżego klonu.
- [ ] Historia repozytorium jest rzeczywista i pozwala odróżnić faktyczny wkład członków zespołu.
- [ ] Końcowa macierz spójności nie zawiera niewyjaśnionych różnic między wymaganiami, projektami i kodem.

---

## Załącznik A. Rejestr decyzji bazowych

| Decyzja | Rozstrzygnięcie |
|---|---|
| A-01 | Aplikacja lokalna, bez hostingu i Dockera |
| A-02 | React/TypeScript/Vite + Express/TypeScript + Prisma/SQLite |
| A-03 | Konta demonstracyjne, 2 role, bez rejestracji i resetu hasła |
| A-04 | Poniedziałek–piątek; starty 07:00…22:00 co 60 minut |
| A-05 | 45 minut zajęć = 1 blok; 90 minut zajęć = 2 bloki |
| A-06 | Student: do 14 dni kalendarzowych naprzód, maks. 3 przyszłe aktywne rezerwacje |
| A-07 | Administrator: bez limitu 3 i 14 dni, ale bez obchodzenia reguł kolizji |
| A-08 | Anulowanie jedynie przyszłych aktywnych rezerwacji |
| A-09 | Dezaktywacja sali i blokada kolidującego terminu anulują przyszłe rezerwacje atomowo |
| A-10 | 8 sal demonstracyjnych, pojemność i opcjonalne nazwa/opis |
| A-11 | Tygodniowy kalendarz, polski UI, responsywność, jasny/ciemny motyw |
| A-12 | Dokumentacja kompletna i zwięzła, Markdown; UML/C4 w PlantUML |
| A-13 | Vitest, Supertest, Playwright, rzeczywiste testy wydajnościowe i GitHub Actions |
| A-14 | Zwięzły podział etapów, oddzielne bramki jakości i aktualizowanie stanu |

## Załącznik B. Doprecyzowania techniczne wynikające z konieczności implementacji

Poniższe elementy są **decyzjami wykonawczymi**, a nie dosłownymi cytatami z wymagań prowadzącej lub ustaleń pierwotnych. Przyjęto je, aby uniknąć niejednoznaczności:

1. Horyzont 14 dni oznacza lokalną datę „dzisiaj + 14 dni kalendarzowych **włącznie**”, nie dokładnie 336 godzin od chwili kliknięcia.
2. Przy samodzielnej rezerwacji liczone są wszystkie przyszłe aktywne rezerwacje studenta, także utworzone przez administratora.
3. Podwójna rezerwacja tego samego studenta jest zabroniona niezależnie od roli osoby zapisującej.
4. Operacje anulowania i blokowania są dozwolone wyłącznie dla **przyszłych** rozpoczęć; rozpoczęte rezerwacje pozostają historycznie bez zmian.
5. Blokady wolno zakładać tylko dla przyszłych, dopuszczalnych dni i godzin; blokady wzajemnie zachodzące na siebie są odrzucane.
6. Status końcowy zajęć jest wyliczany na podstawie czasu, nie zapisywany jako osobne `COMPLETED`.
7. Potwierdzenie działań administracyjnych musi uwzględniać ewentualną zmianę liczby kolizji pomiędzy podglądem a ostateczną transakcją.
8. Zabezpieczenie sesji, dokładny model transakcji Prisma/SQLite i kontrakty API muszą być dopracowane przed wykonaniem odpowiednich etapów, bez osłabiania wyżej opisanych zachowań.

---

**Stan dokumentu:** gotowy jako baza dla podzielonych etapów prac. Nie jest deklaracją, że aplikacja lub testy zostały już wykonane. Jeśli późniejsze wymagania z wykładu lub od prowadzącej zmienią zakres obowiązkowy, należy najpierw uaktualnić niniejszy dokument oraz rejestr decyzji.
