# RoomBook — diagramy aktywności

Diagramy UML opisują docelowe procesy P1 według [specyfikacji 1.0](../SPECYFIKACJA_ROOMBOOK.md), rozdziałów 3–4 i 7, [wymagań](../requirements/WYMAGANIA.md) i [scenariuszy UC](../use-cases/PRZYPADKI_UZYCIA.md). Nie potwierdzają wdrożenia funkcji biznesowych. Powiązania z planowanymi testami zawiera [macierz spójności](../requirements/MACIERZ_SPOJNOSCI.md).

| AD    | Źródłowe UC  | WF                  | Scenariusz                                                    | Źródło .puml                                       | SVG                                              |
| ----- | ------------ | ------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| AD-01 | UC-03        | WF-04, WF-05, WF-06 | Rezerwowanie przez studenta lub administratora w jego imieniu | [PlantUML](AD-01-rezerwowanie-sali.puml)           | [Diagram](AD-01-rezerwowanie-sali.svg)           |
| AD-02 | UC-05, UC-08 | WF-08, WF-10, WF-15 | Anulowanie własne lub administracyjne                         | [PlantUML](AD-02-anulowanie-rezerwacji.puml)       | [Diagram](AD-02-anulowanie-rezerwacji.svg)       |
| AD-03 | UC-07, UC-06 | WF-14, WF-13        | Utworzenie blokady lub dezaktywacja sali z anulowaniami       | [PlantUML](AD-03-blokowanie-lub-dezaktywacja.puml) | [Diagram](AD-03-blokowanie-lub-dezaktywacja.svg) |

## AD-01 — Rezerwowanie sali

Student rezerwuje dla siebie, a administrator wskazuje konto studenta jako właściciela; rzeczywisty inicjator pozostaje zapisany. Podgląd dostępności jest orientacyjny: podczas zapisu system ponownie weryfikuje cały zestaw reguł, w tym zajętość 60/120 minut oraz kolizje sali i właściciela również między salami. Administrator pomija wyłącznie limit 3 przyszłych aktywnych rezerwacji i datę dzisiaj +14 dni; pozostałe reguły obowiązują obie role. Odmowa lub błąd transakcji nie tworzą rezerwacji; sukces daje natychmiast `ACTIVE`, bez dodatkowej akceptacji administracyjnej.

## AD-02 — Anulowanie rezerwacji

Student może anulować wyłącznie własną rezerwację, a administrator dowolną studencką, zawsze pod warunkiem `ACTIVE` i początku ściśle w przyszłości. Atomowy zapis zachowuje historię oraz czas, inicjatora i przyczynę `STUDENT_CANCELLED` albo `ADMIN_CANCELLED`, dzięki czemu termin przestaje być zajęty przez ten wpis. Ponowne anulowanie, cudzy wpis dla studenta, rozpoczęcie lub zakończenie powodują odmowę bez modyfikacji; stan zakończenia wynika z czasu i nie wymaga trwałego `COMPLETED`.

## AD-03 — Blokowanie terminu lub dezaktywacja sali

Administrator wybiera blokadę pełnych 1/2 slotów albo dezaktywację sali; wspólny przebieg pokazuje liczbę przyszłych aktywnych rezerwacji do anulowania i wymaga świadomego potwierdzenia, także dla zera. W transakcji system ponownie kontroluje reguły i porównuje zarówno liczbę, jak i zestaw rezerwacji z potwierdzonym podglądem; rozbieżność przerywa operację bez zmian i wymaga nowego podglądu oraz potwierdzenia. Blokada/dezaktywacja i wszystkie anulowania z przyczyną `TIME_BLOCKED`/`ROOM_DEACTIVATED`, czasem i inicjatorem są jedną atomową operacją: błąd wycofuje całość. **Usunięcie blokady lub ponowna aktywacja sali nie przywraca anulowanych rezerwacji.**

## Odczyt i lokalne renderowanie

Partycje oddzielają aktora od RoomBook; węzły początkowe/końcowe, akcje, decyzje z warunkami i scalenia przedstawiają przepływ sterowania UML. Zakończenie ścieżki odmowy oznacza koniec bieżącej próby; ponowienie wymaga nowego żądania i aktualnej walidacji.

SVG można otworzyć w przeglądarce. Do odtworzenia eksportów użyj lokalnego PlantUML (zweryfikowany renderer: 1.2025.10, Java 8), bez serwera renderującego; plik JAR pozostaje poza repozytorium:

```powershell
$plantumlJar = 'C:\narzedzia\plantuml.jar' # własna lokalizacja narzędzia
java '-Djava.awt.headless=true' -jar $plantumlJar -charset UTF-8 -failfast2 -tsvg docs/activities/*.puml docs/architecture/*.puml docs/use-cases/diagram-przypadkow-uzycia.puml
```

Polecenie uruchomione z katalogu głównego odtwarza także [eksport diagramu UC](../use-cases/diagram-przypadkow-uzycia.svg). C4 używa biblioteki standardowej zawartej w PlantUML, zgodnie z [opisem architektury](../architecture/ARCHITEKTURA_C4.md).
