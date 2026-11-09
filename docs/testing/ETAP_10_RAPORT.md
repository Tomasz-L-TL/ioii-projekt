# RoomBook — raport etapu 10/12

> Zapis zakończenia implementacji przed audytem. Aktualny wynik audytu, poprawkę zależności i rozszerzone E2E opisuje [AUDYT_ETAP_10.md](AUDYT_ETAP_10.md). Sformułowania o oczekiwaniu na zgodę i historyczne wyniki poniżej dotyczą stanu przed późniejszym poleceniem użytkownika audytu i publikacji.

Data: 2026-11-09. Status: implementacja i lokalne kontrole zakończone; zmiany robocze do późniejszego audytu. Bez commita i pushowania.

## Stan początkowy i Git

Repozytorium: `C:\Users\tomas\Desktop\projekt_figiel\ioii-projekt`. Początkowo czysta gałąź `main` wskazywała `6e5da48`; zapisane lokalnie `origin/main` było nieaktualne. Po `git fetch origin` potwierdzono trzy istniejące commity etapu 09: `bd53d0e`, `fc6d57f`, `967472b`. Rzeczywisty autor tych commitów: Krzysztof-S-TM. Wcześniejsze commity etapu 08 zachowują Tomasz_L_TL jako autora.

`gh run list` potwierdził zakończony sukcesem workflow „Kontrola jakości” dla pełnego SHA `967472be73282d8243caff508c5694be3b029e45`: [run 41453163450](https://github.com/Tomasz-L-TL/ioii-projekt/actions/runs/41453163450). Następnie wykonano `git merge --ff-only origin/main`; nie było lokalnych zmian do zachowania ani konfliktów. Odczyt Git wymagał uruchomienia poza ograniczonym kontekstem narzędzia, co rozwiązało wcześniejszy błąd „must be run in a work tree”; konfiguracji repozytorium nie zmieniano.

Końcowy HEAD i origin/main nadal wskazują `967472b`. Staging pozostaje pusty. Nie wykonano `git add`, commita, pushowania, resetu, stasha, przepisywania historii ani zmiany tożsamości Git. Etap 10 przygotował Codex na polecenie użytkownika, bez przypisywania tych zmian autorowi etapu 09 lub tworzenia fikcyjnej historii. Przy późniejszym commitowaniu należy zachować rzeczywisty wkład i uzgodnione autorstwo.

Praca została wykonana bezpośrednio w tym repozytorium przez narzędzia plikowe i polecenia, bez sterowania oknem Codex CLI. Specyfikacja repozytorium jest identyczna z nadrzędnym plikiem projektu; przeczytano kontrakty API i dokumentację UI. Materiałów `sources/` nie zmieniano.

## Wykonane funkcje

- UI-04: odczyt aktywnych i nieaktywnych sal, wyszukiwanie, dodawanie i edycja numeru/nazwy/opisu/pojemności; aktywacja oraz dezaktywacja po podglądzie skutków. Brak usuwania sal i odtwarzania anulowanych rezerwacji.
- UI-05: wszystkie rezerwacje, wyszukiwanie po studencie/sali/dacie/ID, filtrowanie stanów, właściciel i faktyczny inicjator, administracyjne anulowanie przyszłych rezerwacji oraz historia z powodem, czasem i anulującym.
- UI-06: kalendarz pon.–pt. 07:00–22:00, wybór tygodnia/sali i 1/2 slotów (60/120 minut), opcjonalny powód, podgląd skutków, osobne zatwierdzenie oraz usuwanie blokad z ostrzeżeniem o braku przywracania rezerwacji. Dopuszczono zajęte sloty i nieaktywne sale zgodnie z API.
- UI-07: rzeczywista lista studentów i aktywnych sal, kalendarz wolnych terminów, 45/90 minut zajęć i 60/120 minut zajętości, właściciel-student oraz inicjator-administrator. Brak limitu 3 i +14 dni; pozostałe reguły nadal egzekwuje API.
- Podgląd przechowuje niezmienne parametry, `confirmationToken` i `expectedCancellationIds`. Potwierdzenie przekazuje dokładny token i uporządkowane ID otrzymane z serwera. UI nie konstruuje HMAC, nie umieszcza tokenów w DOM/storage/logach i nie ponawia mutacji automatycznie. Potwierdzenie jest konieczne także dla zera skutków.
- `PREVIEW_STALE` zamyka potwierdzenie, odświeża dane i wymaga nowego podglądu oraz osobnej zgody. Błąd sieci przy mutacji informuje o nieznanym wyniku i potrzebie sprawdzenia aktualnych danych. Obsłużono ładowanie, puste wyniki, błędy odczytu z ponowieniem, konflikty i odmowy API.
- Zachowano role i sesję etapu 09, usuwanie prywatnych danych po 401 oraz unieważnianie żądań po zmianie widoku/sesji. Dialogi obsługują klawiaturę i Escape, wracają do właściwego przycisku po asynchronicznym podglądzie; otwarcie formularza sali przenosi fokus na jego tytuł. Usunięto wyścig normalizacji hasha z nową nawigacją po loginie.

Nie zmieniono specyfikacji, UML, modelu danych, migracji, pakietów ani pliku blokady zależności. W kodzie odczytu dodano `description` wyłącznie do DTO sali administratora, aby edycja zachowywała istniejący opis; DTO studenta pozostaje bez zmian. Wspólny klient HTTP obsługuje teraz PATCH i DELETE; DELETE nie wysyła body ani Content-Type.

## Zmienione pliki

| Obszar                          | Pliki                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integracja i API UI             | `apps/web/src/App.tsx`, `api/client.ts`, `api/index.ts`, `api/types.ts`                                                                                       |
| Ekrany administratora           | `apps/web/src/screens/AdminRooms.tsx`, `AdminBookings.tsx`, `AdminSchedule.tsx`, `AdminShared.tsx`                                                            |
| Ergonomia                       | `apps/web/src/components/ConfirmDialog.tsx`, `apps/web/src/styles.css`                                                                                        |
| Backend i infrastruktura testów | `apps/api/src/bookings/reads.ts`, `bookings.test.ts`, `apps/api/src/testing/database.ts`                                                                      |
| Testy frontendowe               | `apps/web/src/api/admin.test.ts`, `apps/web/src/screens/AdminShared.test.ts`, `tests/e2e/admin.spec.ts`, `tests/e2e/ui.spec.ts`                               |
| Dokumentacja                    | `README.md`, `docs/api/ADMINISTRACJA_API.md`, `REZERWACJE_API.md`, `docs/ui/NAWIGACJA.md`, `MAKIETY.md`, `docs/requirements/MACIERZ_SPOJNOSCI.md`, ten raport |

## Wyniki rzeczywistej weryfikacji

Środowisko: Windows, Node 24.20.0, npm 11.19.1, Vitest 5.0.4, Playwright 1.64.1, Chromium 156.0.8078.4. Brak nowych bibliotek. Pobrano przeglądarkę testową wymaganą przez zainstalowaną wersję Playwright, ponieważ Edge oraz oczekiwana wersja Chromium nie były dostępne.

| Polecenie                 | Rzeczywisty wynik końcowy                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm.cmd run lint`        | PASS — ESLint i Prettier                                                     |
| `npm.cmd run typecheck`   | PASS — oba workspaces i narzędzia                                            |
| `npm.cmd run db:validate` | PASS — schemat Prisma poprawny                                               |
| `npm.cmd run test`        | PASS — 183/183, 11 plików, zero pominięć; końcowe uruchomienie 39,89 s       |
| `npm.cmd run test:e2e`    | PASS — 20/20 w Chromium, jeden worker, rzeczywiste API/cookie/SQLite; 24,4 s |
| `npm.cmd run build`       | PASS — React/Vite oraz API TypeScript                                        |
| `git diff --check`        | PASS — bez błędów białych znaków                                             |

Wszystkie powyższe polecenia zakończyły się kodem 0. Vitest obejmuje dotychczasowe 173 testy oraz 10 nowych: 9 klienta API i komponentów, 1 regresję opisu sali według roli. Komponenty renderowano przez React do HTML i sprawdzano treść, 80 komórek, dwa wybrane sloty, granice dopuszczalności oraz brak ujawnienia tokena. Interakcje komponentów, fokus i operacje asynchroniczne pokrywają E2E w przeglądarce.

| Wymagania / przypadki                      | Warunki i oczekiwany efekt                                                         | Uzyskany rezultat                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| WF-11/12, UC-06, UI-04, TC-17              | Dodanie, edycja opisu/pojemności, reload, duplikat numeru                          | PASS — trwały zapis, zachowany opis, odmowa duplikatu                                                   |
| WF-13, UC-06, AD-03, UI-04, TC-18          | Podgląd jednej rezerwacji; wymiana na inne ID przy tej samej liczbie               | PASS — 409 bez dezaktywacji; nowy podgląd i zgoda pozwalają zapisać; aktywacja nie odtwarza anulowania  |
| WF-14, UC-07, AD-03/SD-03, UI-06, TC-19/20 | Blokada 120 min na rezerwacji; dokładny powód/token/ID; usunięcie                  | PASS — dwie komórki, TIME_BLOCKED, usunięcie bez odtworzenia historii                                   |
| WF-05/06, UC-03, AD-01/SD-01, UI-07, TC-09 | Student ma już 3 rezerwacje, nowa >14 dni, start 21 i 90 min                       | PASS — czwarty zapis ADMIN dla studenta; start 22 dla dwóch slotów niedostępny                          |
| WF-09/10, UC-08, AD-02, UI-05, TC-15/16    | Wyszukanie i anulowanie rezerwacji studenta                                        | PASS — właściciel i inicjator rozróżnieni, ADMIN_CANCELLED i historia                                   |
| WF-15, TC-21                               | Błąd odczytu/ponowienie, 403 podglądu, 401 podczas pracy; student na hashach ADMIN | PASS — odmowy bez mutacji, po 401 brak prywatnych danych i login; brak żądań administracyjnych studenta |
| WN-03/05, TC-24/26 (zakres automatyczny)   | Escape z zerowego podglądu; UI-01…07, 375/1280 px, oba motywy                      | PASS — brak zapisu, powrót fokusu i brak poziomego przewijania całej strony                             |

Zachowano regresję studenta z etapu 09. Jedynie test wymagający prototypu administratora zastąpiono sprawdzeniem rzeczywistego panelu. Liczba sal w teście studenta wynika teraz z danych fixture: test CRUD administratora dodaje salę do wspólnej tymczasowej bazy, a aplikacja celowo nie udostępnia kasowania sal. Nie usunięto testów prywatności, ról, limitów, konfliktów, kalendarza ani historii. Oryginalny plik `tests/e2e/student.spec.ts` pozostaje bez zmian.

Pierwsze uruchomienia ujawniły problem Prisma z tworzeniem nieistniejącego pliku SQLite w tym środowisku. Na odrębnym pliku potwierdzono, że pusty istniejący plik pozwala wykonać migrację. Fixture tworzy teraz pusty plik przez `writeFile(..., {flag:'wx'})`, a następnie wykonuje te same rzeczywiste migracje i seed. Nie pominięto SQL, FK/CHECK ani testów transakcyjnych; prywatnej bazy demonstracyjnej nie używano. Kolejne E2E wykryły i pozwoliły poprawić powrót fokusu oraz wyścig nawigacji. Nieudane próby nie są liczone jako PASS; tabela pokazuje zakończone końcowe uruchomienia.

## Ograniczenia i następny krok

- Zielone zdalne CI dotyczy bazowego etapu 09. Dla niezatwierdzonych zmian etapu 10 wykonano kontrole lokalne; nie uruchamiano nowego CI przez push.
- Wykonano automatyczne E2E w Chromium. Nie wykonano pełnego ręcznego odbioru, Firefox ani osobnego stabilnego Chrome; pełne WN-04/TC-25 pozostaje do etapu 11. Kontrole klawiatury i responsywności nie zastępują pełnego audytu dostępności.
- Test wydajnościowy WN-02/TC-23 i końcowy audyt spójności pozostają etapami 11–12. Nie aktualizowano zależności ani nie powtarzano audytu podatności; wyniki wcześniejszego npm audit w dokumentacji są historyczne.
- API nie ma paginacji; wyszukiwanie i filtry działają na pobranych listach zgodnie z kontraktem. Potwierdzenia nadal podlegają serwerowemu limitowi 4 KiB; błąd nie powoduje automatycznego ponowienia.

Następny krok: niezależny audyt różnic i niniejszych wyników, potem dopiero zgoda użytkownika na rzeczywiste commity i push. Przed rozpoczęciem etapu 11 sprawdzić ponownie stan Git i CI po zaakceptowanych commitach; nie przypisywać obecnym zmianom zdalnego PASS przed jego uzyskaniem.
