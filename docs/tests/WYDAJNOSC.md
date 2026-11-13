# RoomBook — WN-02 / TC-23

## Status

Pełny pomiar: **PASS**, wykonany 2026-11-11 poleceniem `npm.cmd run test:perf`, kod wyjścia **0**. Środowisko Windows, wykonanie poza sandboxem. API i generator pracowały w osobnych procesach; w tym oknie nie uruchamiano E2E, Vitest ani buildów. Nie kontrolowano wszystkich procesów tła systemu operacyjnego. To lokalny wynik tego środowiska, bez deklaracji pomiaru GitHub Actions lub buildu produkcyjnego.

| Metryka                                            | Wynik uzyskany                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Start / stop okna UTC                              | 2026-11-11 **18:06:25.562–18:16:25.562** (19:06–19:16 Europe/Warsaw)           |
| Okno monotoniczne / obserwacja z domknięciem       | **600 000 ms** / 600 049,676 ms                                                |
| Fizyczny count SQLite / FK / konflikty ACTIVE      | **1200** / 0 naruszeń / 0 kolizji                                              |
| Konta / klienci / różne sesje / maks. żądań w toku | 6 (5 STUDENT) / **10 / 10 / 10**                                               |
| Warm-up (poza pomiarem)                            | 5000 ms, 680 poprawnych odczytów                                               |
| Rozpoczęte / zakończone w oknie / zakończone poza  | **78 649 / 78 649 / 0**                                                        |
| Kody HTTP                                          | **200: 78 649**, pozostałe: 0                                                  |
| Błędy HTTP / wyjątki / timeouty / błędny DTO       | **0 / 0 / 0 / 0** (0%)                                                         |
| Poprawne odpowiedzi                                | **78 649**                                                                     |
| Mediana / p95 / p99 (nearest-rank)                 | **19,854 / 27,658 / 30,784 ms**                                                |
| Throughput wszystkich zakończonych prób            | **131,082 req/s**                                                              |
| Liczniki 10 klientów                               | 7865, 7865, 7865, 7865, 7865, 7865, 7865, 7865, 7865, 7864                     |
| Ocena WN-02                                        | **PASS**: pełne 600 s, count≥1000, 10 sesji/klientów, p95≤2000 ms, zero błędów |

Środowisko zapisane przez runner: Windows 11 Home, release `10.0.26200`, x64, AMD Ryzen 7 5700G, 16 logicznych CPU, RAM **34 201 288 704 B**, wolna RAM na końcu **9 947 889 664 B**, Node **v24.20.0**, npm **11.19.0**. API: TypeScript/tsx bez watchera, ten sam Express/Prisma 7.10.1/better-sqlite3 co w aplikacji. Rozkład danych i metodyka poniżej. Podsumowanie zostało wypisane dopiero po zamknięciu API i pomyślnym cleanup fixture.

Smoke wykonano 2026-11-11, 17:46:07.288–17:46:22.288 UTC: 15 000 ms, 1200 rekordów, 10 odrębnych sesji, 1990 zakończonych HTTP 200 w oknie, 0 błędów; p50 20,462 ms, p95 28,579 ms, p99 32,385 ms, 132,667 req/s. Trzy żądania ukończone po końcu okna nie weszły do percentyli. Smoke biegł równolegle z E2E, więc służy wyłącznie sprawdzeniu narzędzia. Kod wyjścia 0, wynik `SMOKE_PASS`.

Po pełnym pomiarze doprecyzowano cleanup: proces API już zakończony sygnałem nie jest ponownie oczekiwany przez zdarzenie exit. Metodyka i pętla pomiarowa nie zmieniły się. Końcowy smoke 18:17:54.697–18:18:09.697 UTC: **SMOKE_PASS**, kod 0; 1966 HTTP 200 w 15 s, 0 błędów, p95 28,331 ms, 3 poprawne odpowiedzi domknięte poza oknem. To kontrola końcowej wersji narzędzia, oddzielna od zaliczenia WN-02.

## Polecenia i bezpieczeństwo

Po `npm.cmd ci` (Node 24, npm 11), z katalogu repo:

```powershell
npm.cmd run test:perf -- --smoke
npm.cmd run test:perf
```

Drugie polecenie wykonuje pełne **600 s pomiaru**, oprócz migracji, seeda, logowania i warm-up. Skrypt: [run.ts](../../tests/performance/run.ts); API w osobnym procesie: [server.ts](../../tests/performance/server.ts). Bez zewnętrznych usług i nowych pakietów. API działa w trybie TypeScript/tsx bez watchera, z tym samym createApp i adapterem co aplikacja; nie jest to pomiar builda produkcyjnego.

Nie ustawiaj DATABASE_URL w procesie: runner **odmawia każdej wskazanej bazy**, w tym dev.db i istniejącego pliku. Nie ładuje lokalnego `.env`. Używa `testDatabase(true)`: nowy katalog `roombook-test-*` w systemowym temp, nowy `test.db` otwarty z `wx`, rzeczywiste `migrate deploy`, seed z losowym hasłem i sekret w pamięci. Child sprawdza ścieżkę temp i nazwę pliku, nasłuchuje tylko na 127.0.0.1 na porcie przydzielonym atomowo przez OS. W finally kończy własne API i zamyka/usuwa wyłącznie własny katalog fixture z kontrolą ścieżki. Nie używa resetu ani bazy demonstracyjnej.

Zamknij własne inne obciążenia przed pomiarem; nie uruchamiaj równocześnie E2E/builda. Nie wyłączaj cudzych procesów. W środowisku Codex Windows tsx może wymagać jednorazowego wykonania konkretnego polecenia poza sandboxem (`uv_os_get_passwd returned ENOMEM`); to ograniczenie środowiska, nie wynik testu.

## Dane wejściowe

Seed bez zmian: 6 kont, w tym 5 STUDENT i 1 ADMIN, 8 sal. Fixture dodaje przez Prisma **1200 fizycznych rezerwacji**: 10 kolejnych tygodni roboczych × 5 dni × 24 wpisy/dzień. Początek zakresu to poniedziałek 5 tygodni przed aktualnym tygodniem Warszawy. Dla badania 2026-11-11: **2026-10-05…2026-12-11**. Są dane historyczne, bieżące i przyszłe.

Rozkład: 300 ACTIVE 1-slotowych, 600 ACTIVE 2-slotowych, 300 CANCELLED 1-slotowych z ADMIN_CANCELLED; łącznie 900 ACTIVE i 300 CANCELLED. Właściciel rotuje po pięciu studentach, sala po ośmiu; grupy startują od 07/10/13/16/19, 1 lub 2 sloty mieszczą się w harmonogramie. Nie ma kolizji sal ani studentów między salami. Autorem jest ADMIN, więc przyszłe wpisy mogą przekraczać dwa limity STUDENT. Czas utworzenia/anulowania poprzedza termin i nie leży w przyszłości. Historyczne ACTIVE są zakończone według zegara, zgodnie z modelem bez statusu COMPLETED.

Przed pomiarem runner wykonuje rzeczywisty `booking.count()` = 1200, `PRAGMA foreign_key_check` bez naruszeń i SQL self-join sprawdzający zero konfliktów ACTIVE. CHECK/FK pochodzą z migracji. Rozkład potwierdza `groupBy` DB. Nie modyfikuje produkcyjnego seeda.

## Metodyka i kryterium

10 klientów wykonuje prawdziwe logowania HTTP (po dwóch na konto STUDENT); każdy zachowuje własne cookie. Runner sprawdza 10 różnych tokenów: logowania tego samego konta w tej samej sekundzie są deterministyczne, więc ewentualnie odczekuje 1100 ms i loguje ponownie **przed** warm-up. Żadne poświadczenie nie jest logowane.

Osobny warm-up: 5 s, 10 współbieżnych pętli i sprawdzenie poprawnych odpowiedzi. Potem wspólny start monotoniczny `performance.now()`, stop `start+600000`. Każdy klient ma najwyżej jedno żądanie w toku; po odpowiedzi 50 ms czasu namysłu. To model zamknięty 10 klientów, bez wymuszonego RPS; maksimum jednoczesnych żądań i liczniki każdego klienta są raportowane. Rotacja obejmuje osiem sal i wszystkie dziesięć tygodni, również tygodnie z rezerwacjami.

Endpoint: uwierzytelniony `GET /api/availability?roomId=…&weekStart=…`. Czas w ms obejmuje pobranie całego body i sprawdzenie JSON/DTO. Timeout 5000 ms. Poprawny odczyt wymaga HTTP 200, JSON, właściwej sali/tygodnia/Europe/Warsaw i pięciu dni po 16 poprawnych slotów. 401/500, wyjątki, timeouty i błędny body są błędami, nie szybkimi sukcesami.

Do próby wchodzą wyłącznie odpowiedzi zakończone przed końcem wspólnego okna. Żądania w toku na granicy są domykane i raportowane osobno (liczba, statusy, błędy), poza percentylami i throughput. Liczba rozpoczętych równa się zakończonym w oknie plus poza oknem. Czas domknięcia nie wydłuża statystycznego okna 600 s.

Percentyle poprawnych odczytów: nearest-rank, posortowane czasy, element `ceil(p*n)-1`; mediana analogicznie dla p=0,5. p95/p99 w ms; throughput = wszystkie zakończone próby w oknie / 600 s; błędy = niepoprawne / zakończone. Runner zapisuje histogram kodów i osobny histogram kategorii błędów. Kryterium jest jawnie surowe: **≥1000 rekordów, 10 różnych sesji/klientów z wykonanymi żądaniami, maksimum 10 w toku, pełne 600 s, p95 ≤2000 ms oraz zero błędów w oknie**. Niespełnienie powoduje kod 1, nigdy pozorny PASS. Smoke ma osobny wynik i nie może zaliczyć WN-02.

Podsumowanie: ignorowany `test-results/performance-summary.json` (smoke: `performance-smoke.json`), wyłącznie zredagowane statystyki bez cookie/hasła/HMAC i surowych śladów. Kolejny E2E może wyczyścić test-results; istotne wyniki należy przepisać do tego dokumentu przed kolejnym przebiegiem.
