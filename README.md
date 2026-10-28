# RoomBook — system rezerwacji sal na uczelni

RoomBook to lokalna aplikacja rozwijana na przedmiot **Inżynieria Oprogramowania II**. **Etap 07 dostarcza backend listy sal, dostępności, tworzenia i anulowania rezerwacji oraz własnej historii na rzeczywistej SQLite, z ochroną współbieżnych zapisów. Frontend nadal jest demonstracyjny i nie korzysta z API auth/rezerwacji.** Administracja salami, blokadami i cudzymi rezerwacjami pozostaje na etap 08. Projekt nie wymaga hostingu ani Dockera.

Podstawą jest [specyfikacja RoomBook 1.0](docs/SPECYFIKACJA_ROOMBOOK.md). Dokumentacja projektu:

- Etap 02: [wymagania](docs/requirements/WYMAGANIA.md), [macierz spójności](docs/requirements/MACIERZ_SPOJNOSCI.md), [osiem przypadków użycia](docs/use-cases/PRZYPADKI_UZYCIA.md), [diagram UC](docs/use-cases/diagram-przypadkow-uzycia.puml).
- Etap 03: [diagramy aktywności](docs/activities/DIAGRAMY_AKTYWNOSCI.md), [architektura C4](docs/architecture/ARCHITEKTURA_C4.md).
- Etap 04: [model klas](docs/classes/MODEL_KLAS.md), [sekwencje](docs/sequences/DIAGRAMY_SEKWENCJI.md), [ERD i model danych](docs/data-model/MODEL_DANYCH.md), [projekt Prisma](docs/data-model/schema-plan.prisma). Projekt zachowano; cztery modele aktywowano w etapie 06.
- Etap 05: [siedem makiet SVG](docs/ui/MAKIETY.md), [nawigacja WF/UC](docs/ui/NAWIGACJA.md). Widoki `/#UI-01`…`/#UI-07` mają fikcyjne dane i stałą datę 19.10.2026, 08:00 Europe/Warsaw. Działają filtry, nawigacja i trwały motyw. Formularz logowania jest tylko do odczytu, potwierdzenia niczego nie zapisują. Integracja UI z auth należy do etapu 09.

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

Usługa rezerwacji egzekwuje role, daty, przyszłość, limity, aktywność sal i konflikty przedziałów w jednej transakcji SQLite z blokadą zapisu przed odczytami. Anulowanie zachowuje historię. Szczegóły i dowód współbieżności: [API rezerwacji](docs/api/REZERWACJE_API.md). Baza bezpośrednio nie gwarantuje wszystkich reguł domenowych; nie ma pozornego indeksu unikatowego godziny ani triggerów biznesowych. Zarządzanie salami/blokadami pozostaje na etap 08.

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

POST wymaga application/json, maksymalnie 4 KiB i zaufanego Origin: 127.0.0.1 ze skonfigurowanymi portami web/API. Fetch Metadata odrzuca cross-site i przeglądarkowe żądania bez Origin; klienci terminalowi bez obu nagłówków są dozwoleni. Nie ma CORS z cookies. Frontend nadal ma demonstracyjne logowanie. Sekrety nie trafiają do localStorage, URL ani logów.

## Rezerwacje przez HTTP

Po zalogowaniu dostępne są `GET /api/rooms`, `GET /api/availability?roomId=&weekStart=`, `POST /api/bookings`, `GET /api/bookings/mine` i `POST /api/bookings/:id/cancel`. Lista własna i anulowanie wymagają STUDENT. ADMIN tworzy przez ten sam POST dla wskazanego studenta; jego listy i anulowanie nie są jeszcze wdrożone. Payloady, DTO, kody błędów oraz reguły czasu opisuje [kontrakt API](docs/api/REZERWACJE_API.md).

Zachowaj `$roomBookCookies` z próby logowania powyżej, wykonując logout dopiero po sprawdzeniu rezerwacji. Wybierz przyszły dzień roboczy i dostępny termin, maksymalnie 14 dni od dziś dla studenta:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/rooms -WebSession $roomBookCookies
$bookingDate = Read-Host 'Data rezerwacji YYYY-MM-DD (Europe/Warsaw)'
$bookingBody = @{ roomId = 1; date = $bookingDate; startHour = 10; durationSlots = 2 } | ConvertTo-Json
$booking = Invoke-RestMethod http://127.0.0.1:3001/api/bookings -Method Post -ContentType 'application/json' -Body $bookingBody -WebSession $roomBookCookies
Invoke-RestMethod http://127.0.0.1:3001/api/bookings/mine -WebSession $roomBookCookies
Invoke-RestMethod "http://127.0.0.1:3001/api/bookings/$($booking.id)/cancel" -Method Post -ContentType 'application/json' -Body '{}' -WebSession $roomBookCookies
```

## Kontrola jakości

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run db:validate
npm.cmd audit
```

Vitest/Supertest sprawdza auth, role, cookie, błędne wejścia, migrację, FK/CHECK/indeksy, idempotencję i rollback seeda oraz TC-05…14: czas Warszawy/DST, terminy 45/90, limity, konflikty sali/studenta/blokad, historię i anulowanie. Równoległe HTTP na dwóch klientach jednego pliku SQLite sprawdza kolizje, limit i pojedyncze anulowanie; test utrzymywanej blokady potwierdza rzeczywisty konflikt zapisu. Każda grupa integracyjna migruje oddzielny plik tymczasowy, używa losowego sekretu/hasła w pamięci, zamyka połączenia i usuwa pliki. Testy nie używają prywatnej lokalnej bazy ani daty makiet; granice czasu sprawdzają usługi z wstrzykiwanym zegarem.

Kontrola etapu 07 odbyła się na Node 24.20.0 i npm 12.2.1 (ostrzeżenie o deklarowanym npm 11). `npm ci` odtworzyło lockfile. npm 12 zablokował skrypty instalacyjne; brakujący moduł natywny odtworzono przez `npm.cmd rebuild better-sqlite3 --dangerously-allow-all-scripts` (tylko wskazany pakiet), bez zmian manifestów i polityki projektu. Zalecane pozostaje środowisko npm 11 z instrukcji. Audit zgłosił 3 podatności: body-parser (high), fast-uri i qs (moderate); nie wykonywano automatycznej aktualizacji. Lokalny Chromium Playwright nie jest zainstalowany, więc E2E nie wykonano.

`build` tworzy `apps/web/dist` i `apps/api/dist`. Start zbudowanego API: `npm.cmd run start --workspace @roombook/api`. CI instaluje lockfile, generuje klienta przed importami, sprawdza lint, typy, schemat, testy i build; nie wymaga sekretów lokalnych ani przeglądarek. Audit jest informacyjny: wcześniejsze zgłoszenia wysokiego poziomu dotyczyły drzewa Prisma CLI. Nie uruchamiaj automatycznie `audit fix --force` ani nie zmieniaj głównych wersji Prisma.

Playwright zachowuje cztery testy etapu 05: health przez proxy, nawigacja/motyw, kalendarz/klawiatura i siedem ekranów przy 375/1280 px w obu motywach. Skrypt E2E tworzy osobną migrowaną bazę i sekret w pamięci, a po zakończeniu serwerów usuwa pliki. Przy dostępnym Chromium:

```powershell
npm.cmd run test:e2e
```

Opcjonalna instalacja `npx.cmd playwright install chromium` wymaga sieci i osobnej decyzji. Można użyć `PLAYWRIGHT_BROWSERS_PATH` na innym dysku, zachowując tę samą wartość podczas instalacji i testów. Porty muszą być wolne. E2E demonstracyjnego UI nie zastępuje przyszłych testów funkcji biznesowych ani Chrome/Firefox. Artefakty błędów: ignorowany `test-results/`.

## Struktura i konwencje

| Ścieżka                              | Odpowiedzialność                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `apps/web/src/`                      | Siedem demonstracyjnych ekranów React                                                     |
| `apps/web/vite.config.ts`            | Port web i proxy API                                                                      |
| `apps/api/src/app.ts`, `server.ts`   | Fabryka Express oraz uruchomienie i zamknięcie połączeń                                   |
| `apps/api/src/auth/`                 | Sesja, bcrypt, normalizacja, AuthService, middleware i router                             |
| `apps/api/src/bookings/`             | Odczyty sal/dostępności, reguły czasu, rezerwacja/historia/anulowanie, transakcje i testy |
| `apps/api/src/db/`                   | Klient adaptera SQLite i atomowy seed                                                     |
| `apps/api/src/config/`, `http/`      | Główny .env, ścieżki i bezpieczne błędy API                                               |
| `prisma/`, `prisma.config.ts`        | Aktywny model, migracja i punkt startowy seeda                                            |
| `tests/e2e/`, `playwright.config.ts` | Cztery testy UI etapu 05                                                                  |
| `docs/`, `.github/workflows/ci.yml`  | Dokumentacja i CI                                                                         |

TypeScript strict, ESM; API ma NodeNext i importy `.js`, frontend używa Bundler. Kod ma angielskie nazwy, dokumentacja i interfejs są polskie. ESLint i Prettier: `npm.cmd run format`. Specyfikacja jest wyłączona z formatowania. `.env`, SQLite i pliki pomocnicze, klient generowany, zależności, buildy, cache i raporty testów są ignorowane przez Git. `.env.example` zawiera wyłącznie nazwy i niesekretne wartości.

## Zespół

- Tomasz Łoin
- Krzysztof Sarnacki
