# RoomBook — architektura C4

**Diagramy przedstawiają docelowy stan P1.** Etap 06 uruchamia cztery modele SQLite/Prisma, pierwszą migrację z CHECK/FK, atomowy seed oraz rzeczywiste logowanie, sesje i kontrolę ról Express. `GET /api/health` działa nadal. Frontend pozostaje siedmioekranowym podglądem etapu 05; integracja logowania należy do etapu 09. Operacje sal, rezerwacji i blokad pozostają do implementacji.

Podstawę stanowią [specyfikacja 1.0](../SPECYFIKACJA_ROOMBOOK.md), rozdziały 2–4 i 8, [wymagania WF/WN](../requirements/WYMAGANIA.md), [scenariusze UC](../use-cases/PRZYPADKI_UZYCIA.md) oraz [diagram przypadków użycia — źródło](../use-cases/diagram-przypadkow-uzycia.puml) / [SVG](../use-cases/diagram-przypadkow-uzycia.svg).

## Dwa poziomy tego samego systemu

| Poziom         | Cel                                                                                      | Źródło .puml                  | SVG                         |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------- | --------------------------- |
| System Context | RoomBook jako całość oraz cele Studenta i Administratora poza jego granicą               | [PlantUML](c4-context.puml)   | [Diagram](c4-context.svg)   |
| Container      | Uszczegółowienie tego samego systemu na trzy części, ich odpowiedzialności i komunikację | [PlantUML](c4-container.puml) | [Diagram](c4-container.svg) |

Context pokazuje użytkowników i relacje do RoomBook, bez szczegółów technicznych. Container zachowuje te same role i obejmuje jedną granicą RoomBook aplikację webową, API oraz lokalny plik SQLite; granica oznacza zakres systemu, a nie pojedynczy proces lub maszynę wirtualną.

| Element                                                 | Rola / odpowiedzialność                                                                               | Technologia                                                  | Relacje                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Student                                                 | Przeglądanie sal i dostępności, tworzenie, przeglądanie i anulowanie własnych rezerwacji              | Przeglądarka                                                 | Korzysta z RoomBook przez aplikację webową                                             |
| Administrator                                           | Zarządzanie salami i blokadami; przeglądanie i anulowanie rezerwacji; rezerwowanie w imieniu studenta | Przeglądarka                                                 | Korzysta z tego samego interfejsu, w widokach roli administratora                      |
| RoomBook                                                | Lokalny system rezerwacji sal, kontrola dostępności i historia anulowań                               | Stos trzech kontenerów poniżej                               | Udostępnia funkcje obu aktorom; brak zależnych systemów zewnętrznych                   |
| Aplikacja webowa (`apps/web`)                           | Kalendarz tygodniowy, formularze, widoki ról, prezentacja danych i komunikatów                        | React + TypeScript; Vite do budowania i pracy developerskiej | Aktorzy obsługują UI; web wysyła żądania do API i odbiera dane przez lokalny HTTP/JSON |
| Serwer API (`apps/api`)                                 | REST/JSON, weryfikacja sesji, roli i dostępu do danych, logika domenowa, walidacje i transakcje       | Node.js + Express + TypeScript; Prisma jako biblioteka ORM   | Obsługuje żądania web; odczytuje i zapisuje SQLite przez Prisma/SQL                    |
| Baza danych (`prisma` — konfiguracja i przyszłe modele) | Trwałe konta, sale, rezerwacje z historią oraz blokady                                                | SQLite, lokalny plik                                         | API wykonuje odczyty i atomowe zapisy; web nie ma bezpośredniego dostępu               |

Trzy kontenery oddzielają interfejs w przeglądarce, proces serwera i trwałe dane. Prisma działa wewnątrz API jako biblioteka, a Vite jest narzędziem budowania/deweloperskim; nie stanowią osobnych kontenerów. SQLite nie wymaga osobnego serwera bazy.

Komunikacja web–API wykorzystuje lokalny HTTP/JSON pod `/api`; Vite przekazuje żądania do Express na `127.0.0.1` (domyślnie porty 5173 i 3001). Strzałki C4 wskazują kierunek korzystania z funkcji i danych; odpowiedzi wracają w ramach tych samych interakcji. Serwer ma egzekwować reguły niezależnie od UI. Transakcyjne reguły rezerwacji/blokad i ochrona przed współbieżnymi konfliktami pozostają zakresem kolejnych etapów; transakcja seeda nie jest ich implementacją.

P1 działa lokalnie i nie zależy od systemów zewnętrznych: nie wymaga USOS, poczty, płatności ani zewnętrznego dostawcy tożsamości. Narzędzia budowania, testów i GitHub Actions nie są usługami wymaganymi do działania aplikacji i nie rozszerzają granicy C4.

## Protokół sesji wdrożony w etapie 06

`POST /api/auth/login` sprawdza znormalizowany e-mail i bcrypt cost 12 w SQLite; nieznane konto też wykonuje kosztowne porównanie zastępczego hasha. Publiczna odmowa jest identyczna. Sukces i `GET /api/auth/me` zwracają wyłącznie `{id,email,displayName,role}`. `AuthService` weryfikuje podpis przed odczytem konta, `requireAuth` ładuje aktualną rolę z DB, a `requireRole` odmawia odpowiednio 401/403. `createApp` pozwala testować Express bez uruchamiania serwera.

Format stateless tokena to `base64url(JSON {sub: ID, exp: Unix-seconds}).base64url(HMAC-SHA256(payload))`; algorytm jest stały, podpis porównywany w stałym czasie, exp obowiązkowe, TTL 8h. Token nie zawiera roli, e-maila ani hasła. Wymagany `SESSION_SECRET` to 32 losowe bajty zapisane jako 64 znaki hex, poza Git; brak sekretu zatrzymuje API. Cookie `roombook_session` ma HttpOnly, SameSite=Lax, Path=/api i Max-Age=28800. Secure jest obowiązkowe przy `NODE_ENV=production`/HTTPS; development działa lokalnie po HTTP. Nie ma tokenów w localStorage, URL, logach ani JSON odpowiedzi.

POST login/logout akceptują application/json i limit 4 KiB; Origin musi wskazywać skonfigurowany adres web/API na 127.0.0.1. Fetch Metadata odrzuca cross-site oraz przeglądarkowe żądania bez Origin. Klient bez obu nagłówków (np. PowerShell) jest dozwolony. Proxy eliminuje potrzebę CORS. `POST /api/auth/logout` usuwa cookie z tymi samymi Path/SameSite/Secure; **skopiowany wcześniej token działa do exp**. Nie ma tabeli sesji ani obietnicy serwerowego unieważnienia.

Adapter rozwiązuje ścieżkę SQLite względem repozytorium, jawnie włącza i sprawdza FK. Migracja chroni rolę/status, spójność anulowania, zakresy godzin/slotów i pojemność, a sześć FK ma RESTRICT. Role właściciela rezerwacji i autora blokady, daty i konflikty przedziałów wymagają przyszłych usług domenowych. Integracje Vitest/Supertest używają odrębnych migrowanych plików SQLite, losowych sekretów w pamięci i usuwają pliki po zamknięciu połączeń.

## Renderowanie

Źródła korzystają z lokalnej biblioteki C4-PlantUML: `!include <C4/C4_Context>` i `!include <C4/C4_Container>`, zawartej w standardowej bibliotece PlantUML. Eksporty odtwarza [polecenie lokalne](../activities/DIAGRAMY_AKTYWNOSCI.md#odczyt-i-lokalne-renderowanie); nie wymagają zdalnych `!includeurl`, usług renderujących ani przechowywania narzędzi w repozytorium.
