# RoomBook — protokół ręczny TC-24…26

Stan 2026-11-11: **NIEURUCHOMIONO ręcznie w etapie 11**. Kontrole Playwright opisuje [raport QA](RAPORT_QA.md). Starsze przeglądy etapu 10 są dowodami historycznymi. Poniższa lista jest instrukcją wykonania, bez przypisanych sukcesów.

## Bezpieczne środowisko

Użyj izolacji runnera, a nie bazy demonstracyjnej. Po instalacji silników Playwright można uruchomić:

```powershell
npm.cmd run test:e2e -- --headed --debug tests/e2e/keyboard.spec.ts
npm.cmd run test:e2e:firefox -- --headed --debug tests/e2e/keyboard.spec.ts
```

Runner tworzy własny plik SQLite, sekret, losowe hasło i dwa porty. Inspector umożliwia zatrzymanie przed logout i ręczną kontrolę otwartej strony. Nie kopiuj hasła/cookie do raportu, nie nagrywaj logowania ani sieci. Po zakończeniu zamknij przebieg, aby wykonał cleanup. Nie wskazuj własnego DATABASE_URL ani nie uruchamiaj resetu migracji.

## TC-24 — tylko klawiatura

W obu motywach sprawdź widoczność fokusu i osiągalność każdej akcji przez Tab/Shift+Tab. Enter aktywuje linki/przyciski, Space sloty, Escape zamyka dialog i oddaje fokus wywołującemu. Fokus nie może zniknąć pod stałym nagłówkiem ani utknąć poza dialogiem. Po błędzie komunikat i ponowienie muszą być osiągalne.

| Ścieżka              | Kroki                                                                                                                                          | Wynik ręczny etapu 11 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| STUDENT, UI-01/02/03 | Login → wybór sali/tygodnia → 45 i 90 min → podsumowanie → Escape → ponowne potwierdzenie → własna historia → anulowanie → wolny slot → logout | NIEURUCHOMIONO        |
| ADMIN, UI-04         | Login → dodaj/edytuj salę → błąd duplikatu → poprawa → preview dezaktywacji → Escape → nowa zgoda → dezaktywacja → aktywacja                   | NIEURUCHOMIONO        |
| ADMIN, UI-06         | Wybór sali/tygodnia/długości/powodu → 1 i 2 sloty → preview zera i kolizji → potwierdzenie → usunięcie blokady → historia bez odtwarzania      | NIEURUCHOMIONO        |
| ADMIN, UI-07/05      | Student jako właściciel, ADMIN jako inicjator → rezerwacja → lista → anulowanie → logout                                                       | NIEURUCHOMIONO        |
| Odmowy               | Zmiana rezerwacji po preview w drugiej testowej sesji → 409 → brak sukcesu → nowy preview i nowa zgoda; wygaśnięcie sesji                      | NIEURUCHOMIONO        |

## TC-25 — stabilne przeglądarki

Zapisz produkt, pełną wersję z „Informacje”, kanał stabilny, OS, datę i wykonawcę. Zweryfikuj aktualność wersji w dniu badania. W tej sesji nie uruchomiono lokalnego stabilnego Chrome ani Firefox; nie znaleziono ich w standardowych katalogach Program Files. To nie wyklucza instalacji w niestandardowym miejscu.

Dla zainstalowanego Chrome runner obsługuje kanał:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try { npm.cmd run test:e2e } finally { Remove-Item Env:PLAYWRIGHT_CHANNEL }
```

To testuje lokalny Chrome; zapisany wynik nadal wymaga potwierdzenia kanału i aktualności. Firefox dostarczany przez Playwright jest specjalnym buildem automatyzacyjnym. Nie podmieniaj go arbitralnie ścieżką do zwykłego Firefox. Stabilny Firefox wymaga niezależnej kontroli ręcznej w izolowanym środowisku; nie łącz go z bazą użytkownika. W razie braku takiego środowiska pozostaw BLOCKED/NIEURUCHOMIONO.

Powtórz UC-01…08 i odmowy ról z tabeli TC. Dla każdej przeglądarki zapisz oczekiwany/uzyskany rezultat oraz błąd, jeśli wystąpił.

## TC-26 — responsywność i motywy

Macierz ręczna: UI-01…07 × 375/1280 px × light/dark = 28 kombinacji. Obejrzyj pełną stronę, formularze edycji, listy z wpisami, podsumowania i dialogi. Sprawdź dostępność przycisków oraz czytanie długich komunikatów. Po reload motyw ma pozostać. Cała strona: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; przewijanie wewnętrznej tabeli jest dozwolone.

Wpis wyniku: `data | wykonawca | OS/przeglądarka/wersja | TC/UI/szerokość/motyw | oczekiwany | uzyskany | PASS/FAIL/BLOCKED | uwagi`. Zrzuty, jeśli potrzebne, bez poświadczeń i danych prywatnych, poza repo. Nie zaznaczaj zbiorczo PASS na podstawie samego otwarcia strony.
