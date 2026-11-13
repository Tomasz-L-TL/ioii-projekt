# RoomBook — system rezerwacji sal na uczelni

RoomBook to lokalna aplikacja rozwijana na przedmiot **Inżynieria Oprogramowania II**. **Etapy 07/08 dostarczają backend rezerwacji i administracji na rzeczywistej SQLite: sale, blokady, historia i anulowania, z ochroną współbieżnych zapisów oraz podpisanym podglądem skutków operacji masowych. Etap 09 integruje frontend studenta z API: logowanie, tygodniowy kalendarz, rezerwowanie 45/90 min, własna historia, anulowanie i wylogowanie.** Etap 10 integruje UI-04…07 z istniejącym API: sale, kalendarz blokad, podgląd i anulowanie rezerwacji oraz rezerwowanie dla studenta. Operacje masowe wymagają podglądu HMAC i osobnej zgody. Projekt nie wymaga hostingu ani Dockera.

Podstawą jest [specyfikacja RoomBook 1.0](docs/SPECYFIKACJA_ROOMBOOK.md). Dokumentacja projektu:

- Etap 02: [wymagania](docs/requirements/WYMAGANIA.md), [macierz spójności](docs/requirements/MACIERZ_SPOJNOSCI.md), [osiem przypadków użycia](docs/use-cases/PRZYPADKI_UZYCIA.md), [diagram UC](docs/use-cases/diagram-przypadkow-uzycia.puml).
- Etap 03: [diagramy aktywności](docs/activities/DIAGRAMY_AKTYWNOSCI.md), [architektura C4](docs/architecture/ARCHITEKTURA_C4.md).
- Etap 04: [model klas](docs/classes/MODEL_KLAS.md), [sekwencje](docs/sequences/DIAGRAMY_SEKWENCJI.md), [ERD i model danych](docs/data-model/MODEL_DANYCH.md), [projekt Prisma](docs/data-model/schema-plan.prisma). Projekt zachowano; cztery modele aktywowano w etapie 06.
- Etap 05: [siedem makiet SVG](docs/ui/MAKIETY.md), [nawigacja WF/UC](docs/ui/NAWIGACJA.md). SVG zachowują historyczny projekt etapu 05. React UI-01…07 korzysta z sesji i rzeczywistych danych. Historyczne pliki makiet i demo nie zasilają ekranów administracji.

## Środowisko i instalacja

Windows 11 / PowerShell, Node **24 LTS**, npm **11**. React/Vite/TypeScript i Express 5/TypeScript tworzą npm workspaces; SQLite używa Prisma **7.10.1** i adaptera better-sqlite3. Testy: Vitest/Supertest i Playwright. Wersje odtwarza `package-lock.json`. Polecenia wykonuj w katalogu głównym; `npm.cmd` omija problemy polityki skryptów PowerShell.

```powershell
node --version
npm.cmd --version
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Uzupełnij tylko brakujące sekrety; skrypt ich nie wypisuje.
@'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
let text = readFileSync('.env', 'utf8');
for (const key of ['SESSION_SECRET', 'SEED_DEMO_PASSWORD']) {
  if (!new RegExp('^' + key + '=.+$', 'm').test(text)) {
    text = text.replace(new RegExp('^' + key + '=$', 'm'), '');
    text += '\n' + key + '=' + randomBytes(32).toString('hex') + '\n';
  }
}
writeFileSync('.env', text, { mode: 0o600 });
'@ | node --input-type=module
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

`dev` uruchamia oba workspaces przez concurrently; zakończenie: Ctrl+C. Frontend: <http://127.0.0.1:5173>, API: <http://127.0.0.1:3001/api/health>, proxy: <http://127.0.0.1:5173/api/health>. Health zwraca `200 {"status":"ok"}`.

Główny `.env` jest ładowany jawnie; zmienne procesu mają pierwszeństwo. `WEB_PORT`/`API_PORT` domyślnie wynoszą 5173/3001. Host to `127.0.0.1`; zajęty port powoduje błąd. Frontend korzysta z proxy `/api`, bez CORS. Nigdy nie umieszczaj sekretów w `VITE_*`.

## Baza i seed

CLI, klient i adapter mają wersję **7.10.1**. URL znajduje się w [prisma.config.ts](prisma.config.ts), zgodnie z [konfiguracją Prisma 7](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference). Generator `prisma-client` tworzy ESM w ignorowanym `apps/api/src/generated/prisma/`; generowanie poprzedza dev, testy, typecheck i build, również po `npm ci`. Importy `.js` są zgodne z NodeNext i zbudowanym API.

`DATABASE_URL=file:./prisma/dev.db` jest rozwiązywany względem repozytorium również po buildzie i uruchomieniu z workspace. `db:migrate` i `db:deploy` wykonują `prisma migrate deploy`: stosują zapisaną migrację bez resetu danych, tworzenia kolejnych migracji i bazy cienia. `db:seed` wykonuje seed jawnie, zgodnie z Prisma 7.

Migracja tworzy cztery tabele domenowe: `users`, `rooms`, `bookings`, `time_blocks`. Prisma ma dodatkową techniczną `_prisma_migrations`, SQLite własną `sqlite_sequence`; nie ma tabeli sesji. Sześć FK ma RESTRICT dla DELETE/UPDATE. Adapter jawnie włącza i sprawdza `PRAGMA foreign_keys=ON`. CHECK chronią role, statusy, powody i kompletność anulowania, dodatnią całkowitą capacity, niepusty numer oraz całkowite godziny/sloty. Indeksy (sala,data) i (student,data) wspierają odczyty.

Usługi egzekwują role, daty, przyszłość, limity, aktywność sal i konflikty przedziałów w jednej transakcji SQLite z blokadą zapisu przed odczytami. Anulowanie zachowuje historię. Szczegóły i dowód współbieżności: [API rezerwacji](docs/api/REZERWACJE_API.md) i [API administracji](docs/api/ADMINISTRACJA_API.md). Baza bezpośrednio nie gwarantuje wszystkich reguł domenowych; nie ma pozornego indeksu unikatowego godziny ani triggerów biznesowych.

Seed wymaga `SEED_DEMO_PASSWORD`: minimum 12 znaków, maksimum 72 bajty UTF-8 (ograniczenie bcrypt). Generator powyżej tworzy silne losowe hasło. Własne hasło można wybrać przed pierwszym seedem, edytując ignorowany `.env`. Hasła w DB: bcrypt cost 12. Jedna transakcja dodaje brakujące 6 fikcyjnych kont i 8 aktywnych sal zgodnych ze specyfikacją, bez rezerwacji/blokad. Kolejne wywołania zachowują istniejące hasła, role, dane i aktywność sal oraz historię. Zmiana hasła w `.env` nie zmienia hasła już istniejących kont.

Hasło znajdziesz w wartości `SEED_DEMO_PASSWORD` w lokalnym `.env` otwartym w edytorze. Nie wyświetlaj całego pliku ani ciasteczek w terminalu przeznaczonym do udostępnienia. Początkowo to samo wybrane hasło działa dla:

- administratora: `admin@roombook.test`;
- studentów: `anna.nowak@roombook.test`, `jan.kowalski@roombook.test`, `julia.wisniewska@roombook.test`, `piotr.zielinski@roombook.test`, `maja.lewandowska@roombook.test`.

## Próba logowania przez HTTP

PowerShell 7, API uruchomione w drugim terminalu:

```powershell
$credentials = Get-Credential -UserName 'anna.nowak@roombook.test' -Message 'Hasło demonstracyjne z lokalnego .env'
$body = @{ email = $credentials.UserName; password = $credentials.GetNetworkCredential().Password } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3001/api/auth/login -Method Post -ContentType 'application/json' -Body $body -SessionVariable roomBookCookies
Remove-Variable body, credentials
Invoke-RestMethod http://127.0.0.1:3001/api/auth/me -WebSession $roomBookCookies
Invoke-RestMethod http://127.0.0.1:3001/api/auth/logout -Method Post -ContentType 'application/json' -Body '{}' -WebSession $roomBookCookies
# Oczekiwane 401 po wylogowaniu, bez wypisywania nagłówków:
Invoke-WebRequest http://127.0.0.1:3001/api/auth/me -WebSession $roomBookCookies -SkipHttpErrorCheck | Select-Object StatusCode
```

Dla ADMIN powtórz z `admin@roombook.test`. Login/me zwracają tylko `{id,email,displayName,role}`. Nieistniejący login i złe hasło mają identyczną odmowę 401. Błędy mają format `{error:{code,message}}`, polski komunikat i status 400 (JSON/rozmiar/Content-Type), 422 (pola), 401 (sesja/poświadczenia), 403 (rola/źródło), 404 lub 500 bez szczegółów DB.

Sesja: `base64url({sub,exp}).base64url(HMAC-SHA256)`, TTL 8h, tylko cookie `roombook_session`: HttpOnly, SameSite=Lax, Path=/api, Max-Age=28800. `SESSION_SECRET` to 32 losowe bajty zapisane jako 64 znaki hex; brak lub błędny sekret zatrzymuje start API, bez fallbacku. Przy `NODE_ENV=production` cookie ma Secure i wymaga HTTPS; lokalny development dopuszcza HTTP na 127.0.0.1. `requireAuth` odczytuje aktualne konto i rolę z DB, `requireRole` egzekwuje 401/403. Token zawiera tylko ID i exp. Logout usuwa cookie z identycznymi Path/SameSite/Secure; **wcześniej skopiowany token pozostaje ważny do exp**, bez serwerowego rejestru unieważnień.

POST wymaga application/json, maksymalnie 4 KiB i zaufanego Origin: 127.0.0.1 ze skonfigurowanymi portami web/API. Fetch Metadata odrzuca cross-site i przeglądarkowe żądania bez Origin; klienci terminalowi bez obu nagłówków są dozwoleni. Nie ma CORS z cookies. React sprawdza GET `/api/auth/me` przed pokazaniem danych i chroni hashe według roli z serwera. Sekrety nie trafiają do localStorage, URL ani logów.

## Korzystanie ze ścieżki studenta (etap 09)

Po przygotowaniu lokalnego `.env`, migracji i seeda według instrukcji powyżej uruchom `npm.cmd run dev`. Hasło odczytaj samodzielnie z ignorowanego `.env`; aplikacja go nie podpowiada. Zaloguj się na konto studenta, wybierz salę, tydzień i 45/90 min. Wybierz przyszły wolny slot i osobno potwierdź zapis. Komunikat zawiera ID z API; „Moje rezerwacje” pokazują własne wpisy i historię. Anulowanie wymaga potwierdzenia, zwalnia termin i zachowuje rekord w „Anulowane”. „Wyloguj” kończy sesję dopiero po odpowiedzi API.

Dane odświeżają się po zapisie, anulowaniu, powrocie do okna i co minutę. Daty dotyczą Europe/Warsaw; tygodnie można przeglądać bez ograniczenia +14 dni, ale zapis poza horyzontem jest niedostępny. Backend rozstrzyga konflikty i limit. Po nieznanym wyniku sieci sprawdź listę przed następną próbą; mutacje nie są automatycznie ponawiane. Hashe nie nadają roli. Po 401 dane są usuwane z pamięci i pojawia się login; błąd początkowego odczytu sesji ma przycisk ponowienia. W storage pozostaje wyłącznie `roombook-theme`.

## Korzystanie ze ścieżki administratora (etap 10)

Zaloguj się jako `admin@roombook.test`, używając własnego hasła demonstracyjnego. „Sale” umożliwiają dodawanie i edycję numeru, nazwy, pojemności oraz opisu. „Podgląd dezaktywacji” pobiera z API liczbę przyszłych anulowań; dopiero osobny przycisk w dialogu zapisuje operację. Aktywacja nie przywraca rezerwacji.

„Blokady sal” pokazują tygodniowy kalendarz pon.–pt. 07:00–22:00. Wybierz salę, tydzień, 1/2 sloty (60/120 min), ewentualny powód i termin. Możesz objąć blokadą zajęte sloty; podgląd pokaże skutki. Dane podglądu i powód są zamrożone na czas potwierdzenia. Również zero anulowań wymaga zatwierdzenia. Usuwanie blokady ma osobny dialog i nie przywraca historii.

„Rezerwacje studentów” umożliwiają wyszukiwanie po studencie, sali, dacie lub ID, filtrowanie stanów, podgląd właściciela/inicjatora oraz administracyjne anulowanie przyszłych wpisów. „Rezerwacja dla studenta” korzysta z rzeczywistej listy studentów i kalendarza aktywnych sal; pokazuje właściciela i faktycznego inicjatora. Brak limitu 3 i +14 dni nie wyłącza kontroli konfliktów i harmonogramu.

Podgląd jest ważny 5 minut. `PREVIEW_STALE` zamyka potwierdzenie: pobierz nowy podgląd i zatwierdź go ponownie. UI przekazuje otrzymane `confirmationToken` i `expectedCancellationIds`, nie tworzy podpisów i nie ponawia mutacji automatycznie. Po nieznanym wyniku sieci sprawdź odświeżone dane przed ponowną próbą. Chronione ekrany i żądania są unieważniane po wygaśnięciu sesji lub zmianie widoku.

Raport zmian, rzeczywiste wyniki i ograniczenia: [etap 10](docs/testing/ETAP_10_RAPORT.md). Aktualny [audyt etapu 10](docs/testing/AUDYT_ETAP_10.md): 183/183 Vitest, 24/24 E2E Chromium oraz 24/24 Firefox, odtwarzalne npm ci i 0 podatności.

## Rezerwacje przez HTTP

Po zalogowaniu dostępne są `GET /api/rooms`, `GET /api/availability?roomId=&weekStart=`, `POST /api/bookings`, `GET /api/bookings/mine` i `POST /api/bookings/:id/cancel`. Lista własna wymaga STUDENT; anulowanie obsługuje obie role, a student wyłącznie własne wpisy. ADMIN tworzy przez ten sam POST dla wskazanego studenta (wariant etapu 07). Payloady, DTO, kody błędów oraz reguły czasu opisuje [kontrakt API](docs/api/REZERWACJE_API.md).

Zachowaj `$roomBookCookies` z próby logowania powyżej, wykonując logout dopiero po sprawdzeniu rezerwacji. Wybierz przyszły dzień roboczy i dostępny termin, maksymalnie 14 dni od dziś dla studenta:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/rooms -WebSession $roomBookCookies
$bookingDate = Read-Host 'Data rezerwacji YYYY-MM-DD (Europe/Warsaw)'
$bookingBody = @{ roomId = 1; date = $bookingDate; startHour = 10; durationSlots = 2 } | ConvertTo-Json
$booking = Invoke-RestMethod http://127.0.0.1:3001/api/bookings -Method Post -ContentType 'application/json' -Body $bookingBody -WebSession $roomBookCookies
Invoke-RestMethod http://127.0.0.1:3001/api/bookings/mine -WebSession $roomBookCookies
Invoke-RestMethod "http://127.0.0.1:3001/api/bookings/$($booking.id)/cancel" -Method Post -ContentType 'application/json' -Body '{}' -WebSession $roomBookCookies
```

## Administracja przez HTTP

Po zalogowaniu jako ADMIN działają:

- `GET /api/admin/students`, `/api/admin/bookings`, `/api/admin/blocks`;
- `POST /api/admin/rooms` i `PATCH /api/admin/rooms/:id` (edycja albo aktywność);
- `GET /api/admin/rooms/:id/deactivation-preview` i `GET /api/admin/blocks/preview`;
- `POST /api/admin/blocks` i `DELETE /api/admin/blocks/:id` bez body;
- wspólny `POST /api/bookings/:id/cancel` z `{}`.

Dezaktywacja i dodanie blokady wymagają najpierw GET podglądu, następnie `confirmed:true`, zwróconych `expectedCancellationIds` i `confirmationToken`. Token HMAC wiąże administratora, operację, pełne parametry i skutki przez 5 minut. Przy blokadzie podaj ten sam `reason` już w query podglądu. Zmiana danych/terminu/skutków wymaga nowego podglądu, także przy zerze anulowań. Aktywacja i usunięcie blokady nie przywracają historii. Szczegółowe przykłady: [API administracji](docs/api/ADMINISTRACJA_API.md).

Lokalny odczyt po zalogowaniu z zachowanym `$roomBookCookies`:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/admin/students -WebSession $roomBookCookies
Invoke-RestMethod http://127.0.0.1:3001/api/admin/bookings -WebSession $roomBookCookies
Invoke-RestMethod http://127.0.0.1:3001/api/admin/rooms/1/deactivation-preview -WebSession $roomBookCookies
npm.cmd exec -- vitest run apps/api/src/admin/admin.test.ts
```

## Kontrola jakości

Etap 11: [tabela TC-01…26](docs/tests/PRZYPADKI_TESTOWE.md), [raport QA](docs/tests/RAPORT_QA.md), [wydajność WN-02](docs/tests/WYDAJNOSC.md) i [protokół ręczny](docs/tests/PROTOKOL_RECZNY.md). Raport odróżnia lokalne silniki Playwright od stabilnych instalacji przeglądarek oraz od niewykonanego zdalnego CI.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run db:validate
npm.cmd audit
npm.cmd audit --omit=dev
npm.cmd exec -- playwright install chromium firefox
npm.cmd run test:e2e
npm.cmd run test:e2e:firefox
npm.cmd run test:perf -- --smoke
npm.cmd run test:perf
```

Ostatnie polecenie mierzy pełne **600 s**, po osobnym warm-up, z 1200 rezerwacjami i 10 odrębnymi sesjami HTTP. Smoke trwa 15 s i nie zalicza WN-02. Perf tworzy własną bazę i sekret; odmawia przy ustawionym w procesie `DATABASE_URL`. Nie wymaga lokalnego `.env`. Nie uruchamiaj pomiaru razem z innymi testami. Zredagowane statystyki trafiają do ignorowanego `test-results/performance-summary.json`; w repo pozostaje raport Markdown. Runner E2E sam wybiera dwa porty i nie używa istniejących serwerów. Jeden worker zachowuje kolejność mutacji wspólnej tymczasowej bazy E2E.

Vitest/Supertest sprawdza auth, role, cookie, błędne wejścia, migrację, FK/CHECK/indeksy, idempotencję i rollback seeda oraz TC-05…14: czas Warszawy/DST, terminy 45/90, limity, konflikty sali/studenta/blokad, historię i anulowanie. Równoległe HTTP na dwóch klientach jednego pliku SQLite sprawdza kolizje, limit i pojedyncze anulowanie; test utrzymywanej blokady potwierdza rzeczywisty konflikt zapisu. Każda grupa integracyjna migruje oddzielny plik tymczasowy, używa losowego sekretu/hasła w pamięci, zamyka połączenia i usuwa pliki. Testy nie używają prywatnej lokalnej bazy ani daty makiet; granice czasu sprawdzają usługi z wstrzykiwanym zegarem.

TC-15…21 dodają administracyjne DTO/role, walidację sal, podpis/ważność/powiązanie tokenów, nieaktualny dokładny zbiór (także ta sama liczba, inne ID), dezaktywację i blokady z anulowaniami. Każdy przypadek administracji ma własny migrowany plik SQLite. Wyścigi na dwóch klientach sprawdzają rezerwację wobec blokady/dezaktywacji, dwie zachodzące blokady, dwa potwierdzenia i admin-cancel wobec student-cancel; oprócz HTTP kontrolują trwałe tabele. Awaria DB, pominięty UPDATE i przekroczenie początku wycofują całą zmianę. W etapie 08 React pozostawał bez integracji; ścieżkę studenta podłączono w etapie 09.

Kontrola etapu 08: Node 24.20.0, npm 11.19.1, Prisma 7.10.1; **162/162 testy PASS**, bez pominięć (135 dotychczasowych + 27 administracji). Wykonano z powodzeniem `db:generate`, `db:validate`, `lint`, `typecheck`, `test`, `build`, `audit` i `audit --omit=dev`; oba audyty: 0 podatności. 423 obecne pakiety mają wersje zgodne z lockfile; `npm ci` nie było potrzebne. Nie instalowano przeglądarek ani nie uruchamiano E2E. Bez zmian zależności, migracji i frontendu.

Kontrola etapu 07 odbyła się na Node 24.20.0 i npm 12.2.1 (ostrzeżenie o deklarowanym npm 11). `npm ci` odtworzyło lockfile. npm 12 zablokował skrypty instalacyjne; brakujący moduł natywny odtworzono przez `npm.cmd rebuild better-sqlite3 --dangerously-allow-all-scripts` (tylko wskazany pakiet), bez zmian manifestów i polityki projektu. Zalecane pozostaje środowisko npm 11 z instrukcji. Audit zgłosił 3 podatności: body-parser (high), fast-uri i qs (moderate); nie wykonywano automatycznej aktualizacji. Lokalny Chromium Playwright nie jest zainstalowany, więc E2E nie wykonano.

`build` tworzy `apps/web/dist` i `apps/api/dist`. Start zbudowanego API: `npm.cmd run start --workspace @roombook/api`. CI instaluje lockfile, generuje klienta przed importami, sprawdza lint, typy, schemat, testy i build. Osobny job z macierzą Chromium/Firefox instaluje wymagane silniki Playwright i wykonuje E2E na izolowanej bazie, bez lokalnych sekretów. Nie uruchamia 10-minutowego perf ani nie przesyła śladów sieci. Zdalny wynik wymaga rzeczywistego przebiegu GitHub Actions. Nie uruchamiaj automatycznie `audit fix --force` ani nie zmieniaj głównych wersji Prisma.

Playwright aktualizuje testy demonstracji do rzeczywistych sesji. [Scenariusze UI](tests/e2e/ui.spec.ts) i [studenta](tests/e2e/student.spec.ts) sprawdzają zapis 45/90 min, anulowanie i prywatność, 409/422/401, błędy odczytu i logout, role, klawiaturę, motyw oraz 375/1280 px. Runner tworzy unikalną migrowaną bazę tymczasową z zasianymi kontami i salami, losowym hasłem przekazanym wyłącznie do środowiska Node/Playwright i losowym sekretem. Jeden worker i cleanup przez API zapobiegają wyścigom scenariuszy. Po zakończeniu serwerów baza jest usuwana. Ślady sieci są wyłączone, aby nie utrwalać hasła. Runner oczekuje na health API przez proxy. Przy dostępnym Chromium:

```powershell
npm.cmd run test:e2e
```

Można użyć już zainstalowanego Edge: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`, następnie `npm.cmd run test:e2e`. Po testach usuń zmienną: `Remove-Item Env:PLAYWRIGHT_CHANNEL`. Instalacja silników Playwright wymaga sieci i miejsca w lokalnym cache. Można użyć `PLAYWRIGHT_BROWSERS_PATH` na innym dysku, zachowując tę samą wartość podczas instalacji i testów. Wynik Edge nie jest wynikiem Chrome/Firefox; Chromium Playwright również nie dowodzi zgodności lokalnego stabilnego Chrome. Artefakty błędów: ignorowany `test-results/`.

Historyczna kontrola etapu 09 (2026-11-02, Windows, Node 24.20.0, npm 11.19.0): **173/173 Vitest PASS** (162 backendowe bez zmian + 11 frontendowych), **14/14 E2E PASS w Microsoft Edge** z rzeczywistym API i SQLite. Wykonano `db:generate`, `db:validate`, `lint`, `typecheck` i `build`. Pełny `npm audit`: **11 moderate** w narzędziach developerskich (minimatch i zależne narzędzia ESLint), kod 1; `audit --omit=dev`: **0 podatności**. Zależności nie były zmieniane. Nie instalowano przeglądarek; Chrome/Firefox i GitHub Actions niezweryfikowane. Powyższe wyniki opisują wyłącznie etap 09; bieżące wyniki zawiera raport etapu 10.

## Struktura i konwencje

| Ścieżka                              | Odpowiedzialność                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `apps/web/src/`                      | Rzeczywisty frontend studenta i administratora                                            |
| `apps/web/vite.config.ts`            | Port web i proxy API                                                                      |
| `apps/api/src/app.ts`, `server.ts`   | Fabryka Express oraz uruchomienie i zamknięcie połączeń                                   |
| `apps/api/src/auth/`                 | Sesja, bcrypt, normalizacja, AuthService, middleware i router                             |
| `apps/api/src/bookings/`             | Odczyty sal/dostępności, reguły czasu, rezerwacja/historia/anulowanie, transakcje i testy |
| `apps/api/src/admin/`                | Listy ADMIN, sale, blokady, HMAC preview/confirm i testy atomowości/współbieżności        |
| `apps/api/src/db/`                   | Klient adaptera SQLite i atomowy seed                                                     |
| `apps/api/src/config/`, `http/`      | Główny .env, ścieżki i bezpieczne błędy API                                               |
| `prisma/`, `prisma.config.ts`        | Aktywny model, migracja i punkt startowy seeda                                            |
| `tests/e2e/`, `playwright.config.ts` | E2E rzeczywistych ścieżek obu ról i odmów dostępu                                         |
| `docs/`, `.github/workflows/ci.yml`  | Dokumentacja i CI                                                                         |

TypeScript strict, ESM; API ma NodeNext i importy `.js`, frontend używa Bundler. Kod ma angielskie nazwy, dokumentacja i interfejs są polskie. ESLint i Prettier: `npm.cmd run format`. Specyfikacja jest wyłączona z formatowania. `.env`, SQLite i pliki pomocnicze, klient generowany, zależności, buildy, cache i raporty testów są ignorowane przez Git. `.env.example` zawiera wyłącznie nazwy i niesekretne wartości.

## Zespół

- Tomasz Łoin
- Krzysztof Sarnacki

## Dodatkowe kontrole po audycie etapu 10

```powershell
npm.cmd exec -- playwright install chromium firefox
npm.cmd run test:e2e
$env:PLAYWRIGHT_BROWSER = 'firefox'
npm.cmd run test:e2e
Remove-Item Env:PLAYWRIGHT_BROWSER
npm.cmd audit
npm.cmd audit --omit=dev
```

Domyślnie E2E korzysta z Chromium. `PLAYWRIGHT_CHANNEL=msedge` lub `chrome` nadal działa dla rodziny Chromium; Firefox wybiera `PLAYWRIGHT_BROWSER=firefox` lub skrypt `test:e2e:firefox` i pomija kanał Chromium. Testy korzystają wyłącznie z własnej tymczasowej SQLite. Bieżącą konfigurację CI i wyniki etapu 11 opisuje [raport QA](docs/tests/RAPORT_QA.md); poniższe uwagi o zmianie minimatch pochodzą z audytu etapu 10.

`overrides.minimatch=11.0.1` usuwa podatność narzędzi developerskich GHSA-g3hv-75wg-m249 bez wymuszonego cofania ESLint i TypeScript ESLint. Jest to świadome nadpisanie głównej wersji pośredniej biblioteki; zweryfikowano npm ci, cały lint, typy, build i regresję. Należy je ponownie ocenić po przejściu zależności nadrzędnych na poprawioną wersję. Nie zmieniono zależności produkcyjnych.
