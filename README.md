# RoomBook — system rezerwacji sal na uczelni

RoomBook to projekt lokalnej aplikacji webowej do przeglądania dostępności i rezerwowania uczelnianych sal do nauki, rozwijany na potrzeby przedmiotu **Inżynieria Oprogramowania II**. Student będzie zarządzać własnymi rezerwacjami, a administrator salami, blokadami i rezerwacjami studentów. **Etap 01 dostarcza wyłącznie szkielet technologiczny: stronę startową oraz diagnostyczne API. Funkcje biznesowe jeszcze nie istnieją.** Projekt nie wymaga hostingu ani Dockera.

Wymagania nadrzędne: [specyfikacja RoomBook 1.0](docs/SPECYFIKACJA_ROOMBOOK.md).

Dokumentacja analityczna etapu 02: [wymagania](docs/requirements/WYMAGANIA.md), [macierz spójności](docs/requirements/MACIERZ_SPOJNOSCI.md), [osiem przypadków użycia](docs/use-cases/PRZYPADKI_UZYCIA.md) i [diagram UML (PlantUML)](docs/use-cases/diagram-przypadkow-uzycia.puml). Opisują wymagane zachowanie P1; funkcje biznesowe pozostają do implementacji.

## Technologie i środowisko

- Windows 11 / PowerShell, Node.js **24 LTS**, npm **11**, Git.
- React + Vite + TypeScript; Node.js + Express + TypeScript.
- SQLite + Prisma 7.10 (konfiguracja bez modeli, migracji i danych).
- Vitest + Supertest, Playwright (smoke test), ESLint + Prettier.
- Jedno repozytorium npm workspaces i GitHub Actions do kontroli jakości.

Wersje zależności są odtwarzane z `package-lock.json`. Polecenia poniżej wykonuje się w katalogu głównym repozytorium. Użycie `npm.cmd` i `npx.cmd` pozwala uruchamiać narzędzia bez zmieniania polityki wykonywania skryptów PowerShell; standardowe `npm` i `npx` działają, jeżeli środowisko na to pozwala.

## Instalacja i uruchomienie

```powershell
node --version
npm.cmd --version
git --version
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

`npm run dev` uruchamia równolegle oba workspaces przez `concurrently`. Zakończenie: `Ctrl+C`.

- Frontend: <http://127.0.0.1:5173>.
- Diagnostyka API: <http://127.0.0.1:3001/api/health>, odpowiedź `200` i `{ "status": "ok" }`.
- Proxy developerskie: <http://127.0.0.1:5173/api/health> przekazuje żądanie do API.

Porty `WEB_PORT` i `API_PORT` można ustawić w głównym `.env` (domyślnie 5173 i 3001). Zmienne środowiskowe procesu mają pierwszeństwo. Serwery nasłuchują na `127.0.0.1`; zajęty port powoduje błąd zamiast cichej zmiany adresu. Frontend używa ścieżek `/api`, dzięki czemu w środowisku developerskim nie jest potrzebny CORS. Do kodu przeglądarki Vite udostępnia tylko zmienne z prefiksem `VITE_`; nie należy umieszczać tam sekretów.

Sprawdzenie z drugiego terminala:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

## Budowanie i kontrola jakości

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run db:validate
```

`test` uruchamia rzeczywisty test API Vitest/Supertest bez importowania punktu uruchomienia serwera i bez bazy danych. `build` tworzy `apps/web/dist` oraz `apps/api/dist`. Zbudowane API można uruchomić poleceniem `npm.cmd run start --workspace @roombook/api`; frontend developerski uruchamia Vite. Workflow CI wykonuje instalację z lockfile, lint, sprawdzenie typów, walidację Prisma, test API i build; nie wymaga przeglądarek ani sekretów.

Playwright ma jeden smoke test: widoczna strona startowa oraz diagnostyka API przez proxy. Przed pierwszym uruchomieniem należy pobrać Chromium (wymagany dostęp do sieci):

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Test sam uruchamia i kończy środowisko developerskie; porty muszą być wolne. Nie zastępuje przyszłych testów funkcji biznesowych ani testów Chrome/Firefox. Artefakty błędów trafiają do ignorowanego `test-results/`.

Przy małej ilości miejsca na dysku systemowym można przed instalacją i testem ustawić `$env:PLAYWRIGHT_BROWSERS_PATH` na katalog na innym dysku. Tę samą wartość trzeba stosować przy obu poleceniach.

## Struktura i konwencje

| Ścieżka                              | Odpowiedzialność                           |
| ------------------------------------ | ------------------------------------------ |
| `apps/web/src/`                      | Prosta strona React w języku polskim       |
| `apps/web/vite.config.ts`            | Port frontendu i lokalne proxy API         |
| `apps/api/src/app.ts`                | Konfiguracja Express bez `listen()`        |
| `apps/api/src/server.ts`             | Uruchomienie serwera i zakończenie procesu |
| `apps/api/src/routes/`               | Endpoint diagnostyczny i test Supertest    |
| `apps/api/src/config/`               | Odczyt głównego `.env` i walidacja portu   |
| `prisma/`, `prisma.config.ts`        | Fundament SQLite/Prisma                    |
| `tests/e2e/`, `playwright.config.ts` | Smoke test przeglądarkowy                  |
| `docs/`                              | Istniejąca specyfikacja nadrzędna          |
| `.github/workflows/ci.yml`           | Kontrole jakości w GitHub Actions          |

TypeScript działa w trybie `strict`. Kod używa ESM i importów względnych: API stosuje `NodeNext` oraz rozszerzenia `.js` w importach TypeScript, zgodne z wynikowym kodem Node; frontend i konfiguracje narzędzi stosują rozwiązywanie `Bundler`. Nazwy kodu są angielskie, interfejs i dokumentacja polskie. ESLint kontroluje JS/TS, a Prettier formatowanie (`npm.cmd run format`). Specyfikacja jest wyłączona z formatowania. Katalog modułów domenowych powstanie dopiero z rzeczywistą logiką w kolejnych etapach; nie ma pustych warstw.

## Prisma na tym etapie

CLI, klient i adapter SQLite mają zgodną wersję **7.10.0**. Zgodnie z [konfiguracją Prisma 7](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference) adres bazy jest w `prisma.config.ts`, a `schema.prisma` zawiera jedynie generator `prisma-client` i datasource `sqlite`. Główny `.env` jest ładowany jawnie; domyślny adres `file:./prisma/dev.db` jest taki sam w konfiguracji i `.env.example`. CLI jest uruchamiane z katalogu głównego. Przyszły klient będzie generowany do `apps/api/src/generated/prisma/` (ignorowany przez Git).

W etapie 01 wykonuje się tylko `npm.cmd run db:validate`. Nie ma instancji klienta ani połączenia API z bazą. Generowanie klienta, `prisma migrate dev`, utworzenie bazy, integracja adaptera i seed zostaną sprawdzone po zatwierdzeniu modeli w etapach 04/06. Nie należy dodawać fikcyjnych encji, aby uruchomić te polecenia wcześniej.

Ograniczenie zależności: `npm.cmd audit` podczas inicjalizacji zgłosił cztery pozycje wysokiego poziomu w drzewie Prisma CLI (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`). API nie używa tego CLI ani MySQL. Zgłoszenia pozostają nierozwiązane; przed integracją bazy należy ponownie sprawdzić dostępne poprawki. Nie zastosowano `npm audit fix --force`, ponieważ raport proponował zmianę głównej wersji Prisma.

`.env`, SQLite wraz z plikami pomocniczymi, zależności, buildy, cache i raporty testów są ignorowane przez Git. `.env.example` zawiera wyłącznie niesekretne wartości lokalne.

## Zespół

- Tomasz Łoin
- Krzysztof Sarnacki
