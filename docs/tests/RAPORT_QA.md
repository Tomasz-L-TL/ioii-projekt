# RoomBook — raport QA etapu 11

Data: 2026-11-11. Badano rzeczywisty kod lokalnego `main`, bazowy i końcowy HEAD `62c3ac50dc2b72635220de1c30548fb3f3bb010e`. Bramka wejściowa: czysty working tree; remote `git@github.com:Tomasz-L-TL/ioii-projekt.git`; po `git fetch origin` rozbieżność `HEAD...origin/main` = `0 0`. Historia zawiera frontend ADMIN (`bb258fe`) i późniejsze poprawki UI (`62c3ac5`). Ekrany UI-04…07 mają rzeczywiste API, DTO, role, HMAC i dokładne ID. Nie wykonywano commitów, pusha ani integracji historii.

## Środowisko i zakres

Windows 11 Home `10.0.26200`, x64; AMD Ryzen 7 5700G, 16 logicznych CPU, RAM 34 201 288 704 B; Node `v24.20.0`, npm `11.19.0`, Prisma/adapter `7.10.1`, Vitest `5.0.4`, Playwright `1.64.1`. Parametry uzyskano z Node podczas smoke perf; dostępna pamięć jest zmienna. Kod API i Vite uruchamiane lokalnie, bez nowych usług. Silniki pobrano standardowym instalatorem Playwright do lokalnego cache, bez globalnej instalacji przeglądarek.

Źródła: specyfikacja (§3–5, 7, 10–11, 14–15), wymagania, macierz, UC-01…08, oba opisy API, makiety/nawigacja oraz bieżące źródła/testy. PDF uczelniany nieobecny w repo. Wymagana tabela z oczekiwanym i uzyskanym rezultatem znajduje się w [PRZYPADKI_TESTOWE.md](PRZYPADKI_TESTOWE.md).

## Polecenia i uzyskane wyniki

Wszystkie poniższe wykonania są lokalne na Windows; `0` oznacza rzeczywisty kod wyjścia. Polecenia uruchamiano w katalogu repo przez PowerShell. Odrzucone próby i ponowienia są wymienione osobno, nie zastępują wyników testów.

| Polecenie                                                                                                                                         | Uzyskany wynik etapu 11                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `git rev-parse --show-toplevel`, `git branch --show-current`, `git status --short --untracked-files=all`, `git log -8 --oneline`, `git remote -v` | Właściwa ścieżka, main, początkowo czysto, etap 10 obecny                                       |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/main`                                                                        | 0; brak rozbieżności (0/0); bez pull/reset                                                      |
| `node --version`, `npm.cmd --version`                                                                                                             | v24.20.0 / 11.19.0                                                                              |
| `npm.cmd ci`                                                                                                                                      | 0; 426 dodanych pakietów, 429 sprawdzonych; lockfile bez zmian                                  |
| `npm.cmd run db:generate`, `npm.cmd run db:validate`                                                                                              | 0; klient wygenerowany, schemat poprawny                                                        |
| `npm.cmd run test` — inwentaryzacja                                                                                                               | 0; **183/183**, 11 plików, 76,82 s                                                              |
| `npm.cmd run test` — po dodaniu testów HMAC                                                                                                       | 0; **185/185**, 11 plików, 67,42 s                                                              |
| `npm.cmd run test` — po izolacji każdego przypadku                                                                                                | 0; **185/185**, 11 plików, 112,72 s; bez skip/only i zmian pool                                 |
| `npm.cmd run test:e2e` — końcowa regresja Chromium                                                                                                | 0; **26/26**, 54,7 s po ko?cowej poprawce helpera; Chromium **156.0.8078.4**                    |
| `npm.cmd run test:e2e:firefox`                                                                                                                    | 0; **26/26**, 1,5 min według raportera; Firefox **157.0**                                       |
| `npm.cmd run test:perf -- --smoke`                                                                                                                | 0; 15 s, 1200 rekordów, 10 sesji; 1990 HTTP 200, 0 błędów, p95 28,579 ms; **nie zalicza WN-02** |
| `npm.cmd run test:perf`                                                                                                                           | Pełny pomiar: [WYDAJNOSC.md](WYDAJNOSC.md); bez wyniku smoke jako substytutu                    |
| `npm.cmd run lint`                                                                                                                                | 0; ESLint i Prettier poprawne po sformatowaniu trzech nowych/uzupełnionych plików dokumentacji  |
| `npm.cmd run typecheck`                                                                                                                           | 0 po dodaniu runnera, perf i testów; końcowa kontrola zgodna z tabelą poleceń                   |
| `npm.cmd run build`                                                                                                                               | 0; Vite i TypeScript API; web JS 268,63 kB, CSS 13,53 kB (przed gzip)                           |
| `npm.cmd audit --json`                                                                                                                            | 0; **0** info/low/moderate/high/critical                                                        |
| `npm.cmd audit --omit=dev --json`                                                                                                                 | 0; **0** info/low/moderate/high/critical                                                        |
| `git diff --check`                                                                                                                                | 0; bez błędów whitespace                                                                        |

## Nieudane próby i diagnoza

- `git fetch origin` w sandboxie: odmowa zapisu `.git/FETCH_HEAD`; jednorazowe wykonanie poza sandboxem zakończone 0. Nie zmieniano historii ani konfiguracji Git.
- `npm ci` w sandboxie: EACCES podczas pobierania minimatch i zapisu cache. Ponowienie z dostępem do rejestru zakończone 0. `Get-CimInstance Win32_Process` odmówiło dostępu; `Get-Process node,chrome,firefox` nie wykazało takich procesów przed instalacją. Nie zamykano cudzych sesji.
- E2E/perf uruchomione w sandboxie: `uv_os_get_passwd returned ENOMEM` w tsx, przed wykonaniem testów. Konkretne polecenia powtórzono poza sandboxem; nie zmieniano testów dla obejścia tej przeszkody.
- Pierwsze E2E poza sandboxem: **24 nieudane starty**, brak wymaganej binarki Chromium. `playwright install --list` potwierdziło brak cache, `install --dry-run chromium firefox` wskazało konkretne buildy; `node node_modules/@playwright/test/cli.js install chromium firefox` pobrało je skutecznie. To błąd środowiska, a nie 24 błędy aplikacji.
- Nowy test klawiatury w trakcie tworzenia: przejściowe przebiegi 25/26 i 1/2. Przyczyny: przejście do następnego tygodnia przed załadowaniem kalendarza, niewłaściwy napis przycisku ADMIN oraz założenie, że STUDENT ma pole daty identyczne z ADMIN. Poprawiono wyłącznie synchronizację/selektory testu; nie zmieniono asercji wymaganych zachowań. Końcowe wyniki są oddzielne w tabeli powyżej.
- Firefox: pierwszy pełny przebieg **24/26**, diagnostyczne testy klawiatury **0/2**. Izolowany probe bez RoomBook (`firefox.launch`, statyczny HTML z dwoma linkami, przyciskiem i inputem) wykazał kolejność A→BUTTON→A→INPUT, następnie pozostawanie fokusu na końcu dokumentu. Helper zakładał zawijanie Tab do wcześniejszej nawigacji. Poprawka testu porównuje jedynie kolejność elementów DOM i używa Shift+Tab do wcześniejszych kontrolek. Nie ustawia fokusu ani nie zmienia DOM/prefów Firefox; asercje pozostały. Następny pełny Firefox: 26/26; ponowny pełny Chromium po tej poprawce: 26/26 (54,7 s).
- Audyty npm w sandboxie nie miały dostępu do endpointu advisory. Wyniki 0 pochodzą z rzeczywistych ponowień z siecią.

Guard perf sprawdzono oddzielnie: `DATABASE_URL=file:./prisma/dev.db` w procesie i `node --import tsx tests/performance/run.ts --smoke` → **kod 1, oczekiwana odmowa** „perf nie przyjmuje wskazanej bazy”, przed utworzeniem fixture/otwarciem DB. Zmienną procesu przywrócono w finally. Kod 1 nie został zamieniony na sukces polecenia obciążenia.

Pozostałe ostrzeżenia: zastana niepoprawna wartość globalnego `safe.directory` (`'*' not absolute`); Git ostrzega także o LF→CRLF. npm zgłasza wycofanie `prebuild-install@7.1.3` i cztery pakiety ze skryptami nieobjętymi `allowScripts` (Prisma, silnik, better-sqlite3, esbuild). Nie wyłączano globalnie ochrony skryptów; działanie natywnego adaptera potwierdzają rzeczywiste testy. Ostrzeżenie `NO_COLOR`/`FORCE_COLOR` nie zmienia wyniku. Smoke zgłosił Node DEP0190 przy odczycie wersji npm przez shell; poprawiono to na uruchomienie npm-cli przez Node bez shella przed pełnym pomiarem. Nie używano `audit fix`, nie aktualizowano zależności ani lockfile.

Po pełnym pomiarze doprecyzowano oczekiwanie na zakończenie własnego procesu API (sprawdzenie exitCode oraz signalCode). Końcowy smoke: 0 / SMOKE_PASS, 15 s, 1966 HTTP 200 w oknie, 0 błędów, p95 28,331 ms; 3 HTTP 200 domknięte poza oknem. WN-02 nadal opiera się wyłącznie na pełnym przebiegu 600 s. Sprawdzenie lokalnych linków w sześciu zmienionych/nowych dokumentach: 0 uszkodzonych odsyłaczy.

## Bezpieczeństwo, SQLite i pokrycie

TC-01…22 mają wykonane testy funkcjonalne. HTTP/Supertest korzysta z fizycznych baz migrowanych tym samym SQL i natywnym adapterem. Auth, DB, rezerwacje, usługi czasu i ADMIN otrzymują teraz świeżą bazę/sekret dla każdego przypadku. Dwa niezależne klienty jednego pliku i równoległe HTTP sprawdzają kolizje sali/studenta, limit, anulowania oraz wyścigi rezerwacja–blokada/dezaktywacja. Nie zmieniono timeoutów transakcji ani pool Vitest.

Sprawdzone negatywne przypadki: 401/403/404/409/422, Content-Type, Origin/Fetch Metadata, zły/za duży JSON, nieznane pola, bezpieczne 500. Cudze ID nie ujawnia rekordu. Zegar usług i fake Date sprawdzają ścisłą przyszłość, +14/+15, 21/22, DST i historię bez przepisywania ACTIVE. Powody anulowań: STUDENT_CANCELLED, ADMIN_CANCELLED, ROOM_DEACTIVATED, TIME_BLOCKED.

HMAC: wymagane wszystkie pola i zgoda również dla pustej listy, podmieniony podpis, wygasły token, inny administrator/obiekt/termin/opis/operacja/zbiór. Ten sam count przy innych ID jest odrzucany. Nowe testy HTTP wygaśnięcia sprawdzają cały snapshot DB. Triggery testowe wymuszają awarię po części operacji i pominięty UPDATE; rollback sprawdzany na rzeczywistym pliku. E2E potwierdza nowy podgląd po 409, brak cichego sukcesu oraz rozdzielenie właściciela i inicjatora UI-07. Przy błędzie dialog jest zamykany zgodnie z zaakceptowaną nawigacją etapu 10, operacja pozostaje niewykonana, a ponowienie wymaga nowej zgody.

Hasła w seedzie są bcrypt cost 12. Cookie jest HttpOnly/SameSite, Secure w produkcji, token ma ograniczoną ważność. Logout usuwa cookie przeglądarki; zachowano istniejący bezstanowy model sesji bez serwerowej listy unieważnień. Brak poświadczeń w DTO i local/sessionStorage. Ślady sieci pozostają wyłączone; nie dodano artefaktów CI. Asercje porównujące HMAC w E2E zwracają bool, aby raport błędu nie wypisał tokenu. Pliki DB, surowe raporty i screenshoty są ignorowane, nie dodano ich do repo. Baza użytkownika nie była seedowana, migrowana ani kasowana.

## Dostępność, przeglądarki i ograniczenia

Nowe EK przechodzą wyłącznie przez klawisze: bez kliknięć, `locator.focus`, `selectOption` i modyfikacji DOM. Asercje sprawdzają `activeElement`, `:focus-visible` i obrys co najmniej 2 px, Escape i fokus po dialogu. Obejmują obie role, edycję/aktywność sal, blokadę/usunięcie, rezerwację i anulowanie, logout. Testy EU sprawdzają 7 ekranów × 2 szerokości × 2 motywy, brak scrolla strony względem clientWidth oraz motyw po reload na każdym chronionym ekranie. Tabele mogą mieć własny poziomy scroll.

Obejrzano również dwa zrzuty z końcowego Chromium: UI-04/light/1280 i UI-07/light/375. Nagłówki i obrys fokusu są czytelne, elementy mieszczą się w układzie; kalendarz mobilny korzysta z lokalnego przewijania. To przegląd obrazów dwóch stanów, bez przypisania ręcznego PASS wszystkim działaniom lub motywom. Obrazy pozostają wyłącznie w ignorowanym test-results.

**TC-24/25/26: PARTIAL.** Nie wykonano nowej ludzkiej oceny używalności i pełnych działań mobilnych. Nie uruchomiono lokalnych stabilnych instalacji Google Chrome i Firefox; nie znaleziono ich w standardowych ścieżkach Program Files. Silniki Playwright nie są równoważnym dowodem WN-04. Powtarzalne kroki i pola wyników: [PROTOKOL_RECZNY.md](PROTOKOL_RECZNY.md). Brak deklaracji pełnego WCAG lub 100% pokrycia.

## CI i stan do audytu

Istniejący `.github/workflows/ci.yml` obsługuje push i pull_request. Node 24/npm 11, npm ci, generate, lint, typecheck, validate, pełny Vitest i build pozostają bramką. Dodano job E2E z macierzą Chromium/Firefox, standardowym `playwright install --with-deps`, workers=1, własną SQLite/sekretem/portami i `reuseExistingServer:false`. Bez continue-on-error, bez obciążenia 600 s na push i bez uploadu trace/HAR. Każdy job instaluje zależności raz we własnym środowisku.

**GitHub Actions Linux: NIEURUCHOMIONO** — nie wykonano pusha. Poprawność lokalnych poleceń i formatowania YAML nie oznacza zielonego zdalnego przebiegu. Kod produkcyjny, reguły biznesowe, migracje i zależności nie zmieniły się. Otwarte pozostają TC-24…26 w części ręcznej/stabilnych instalacji oraz potwierdzenie zdalnego CI. Wynik WN-02 jest niezależny w raporcie wydajności. Nie rozpoczęto etapu 12.

## Zakres plików i przygotowanie do niezależnego audytu

Zmodyfikowano 14 plików śledzonych; dodano 7 plików pozostających untracked do decyzji audytora. `git diff --stat` obejmuje tylko pliki już śledzone, dlatego należy czytać go razem z `git status --short --untracked-files=all`. Nie wykonano `git add`.

Końcowy `git diff --stat`: **14 files changed, 153 insertions(+), 29 deletions(-)**, dodatkowo 7 nowych plików z listy poniżej. `git diff --check` zakończył się 0; końcowe lint i typecheck także 0. Zestawienie TC: **23 PASS / 3 PARTIAL / 0 FAIL / 0 BLOCKED / 0 NIEURUCHOMIONO**. HEAD przed/po identyczny; brak commitów i pusha.

| Grupa            | Zmienione / nowe pliki                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testy API        | `admin/admin.test.ts`, `auth/auth.test.ts`, `bookings/bookings.test.ts`, `bookings/service.test.ts`, `db/database.test.ts` (wszystkie względem `apps/api/src/`) |
| E2E              | `tests/e2e/admin-audit.spec.ts`, `admin.spec.ts`, `start.spec.ts`, `ui.spec.ts`, nowy `keyboard.spec.ts`; `tests/run-e2e.ts`                                    |
| Perf i polecenia | nowe `tests/performance/run.ts`, `tests/performance/server.ts`; `package.json`                                                                                  |
| CI               | `.github/workflows/ci.yml`                                                                                                                                      |
| Dokumentacja     | `README.md`, `docs/requirements/MACIERZ_SPOJNOSCI.md`; nowe `docs/tests/PRZYPADKI_TESTOWE.md`, `RAPORT_QA.md`, `WYDAJNOSC.md`, `PROTOKOL_RECZNY.md`             |

Paczki kontrolnej nie tworzono. Po ustaleniu metody archiwizacji przygotuj poza repo `ROOMBOOK_REVIEW_ETAP11_*.zip`, uwzględniając źródła, testy, konfiguracje, manifesty/lockfile i dokumentację, także nowe pliki etapu 11. Wyklucz `.git`, `.env*` poza szablonem `.env.example`, node_modules, bazy SQLite, buildy, cache, logi i artefakty testów. Sam `git archive HEAD` pominie niezacommitowane zmiany; audyt wymaga bieżącej zawartości working tree. Nie dodawaj zapisów sesji ani poświadczeń.
