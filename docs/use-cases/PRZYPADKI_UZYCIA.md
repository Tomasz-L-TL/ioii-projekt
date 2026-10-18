# RoomBook — formalne przypadki użycia

Podstawa: [specyfikacja 1.0](../SPECYFIKACJA_ROOMBOOK.md), rozdziały 3–7, 8.5 i 10. Poniższe scenariusze określają wymagane zachowanie P1, nie potwierdzają implementacji. Reguły wspólne zestawiono w [wymaganiach](../requirements/WYMAGANIA.md); śledzenie do planowanych testów zawiera [macierz](../requirements/MACIERZ_SPOJNOSCI.md). [Diagram UML](diagram-przypadkow-uzycia.puml) obejmuje dokładnie te same osiem UC i dwóch aktorów.

We wszystkich chronionych działaniach system ma sprawdzać sesję, rolę i dostęp do danych po stronie serwera (WF-15). Brak/wygaśnięcie sesji kończy żądanie odmową i koniecznością logowania; niewłaściwa rola lub cudzy rekord nie pozwalają odczytać ani zmienić chronionych danych. Nieudany zapis nie pozostawia częściowych zmian. Wszystkie terminy i porównania czasu dotyczą `Europe/Warsaw`.

## UC-01 — Logowanie do systemu

- **Aktor główny:** Student albo Administrator. **Inni uczestnicy:** brak.
- **Cel:** uzyskać dostęp właściwy dla roli, a następnie móc zakończyć sesję.
- **Powiązane WF:** WF-01, WF-15.
- **Wyzwalacz:** aktor otwiera formularz logowania.
- **Warunki wstępne:** istnieje konto demonstracyjne przygotowane przez seed; aktor nie ma aktywnej sesji dla przebiegu logowania.

**Scenariusz podstawowy**

1. Aktor wpisuje login i hasło oraz wybiera logowanie.
2. System weryfikuje dane konta i ustala rolę po stronie serwera.
3. System ustanawia sesję i otwiera widok odpowiedni dla Studenta lub Administratora.
4. Aktor korzysta z dostępnych dla roli funkcji, a następnie wybiera wylogowanie.
5. System kończy sesję i pokazuje formularz logowania. Kolejna próba chronionego działania bez ponownego logowania jest odrzucona.

**Alternatywy i błędy**

- **A1 (krok 2):** błędny login/hasło — system odmawia logowania i pokazuje komunikat; powrót do kroku 1.
- **A2 (po kroku 3):** aktor pozostaje zalogowany i nie wybiera jeszcze wylogowania — cel uzyskania dostępu osiągnięty; przebieg kończy się aktywną sesją.
- **A3 (krok 4):** sesja wygasła — chronione działanie odrzucone; zakończenie z koniecznością ponownego wykonania kroku 1.
- **A4 (krok 4):** student próbuje operacji administratora, także bezpośrednim żądaniem — system odmawia bez zmiany danych; powrót do właściwego widoku z kroku 3.

**Warunki końcowe sukcesu:** rola została rozpoznana i dostęp udzielony; po wylogowaniu sesja nie uprawnia do dalszych żądań. **Niepowodzenie:** brak nowej sesji i brak dostępu do chronionych danych; istniejące dane biznesowe bez zmian.

## UC-02 — Przeglądanie sal i dostępności

- **Aktor główny:** Student albo Administrator. **Inni uczestnicy:** brak.
- **Cel:** znaleźć salę i orientacyjnie dostępny termin.
- **Powiązane WF:** WF-02, WF-03.
- **Wyzwalacz:** aktor otwiera listę sal/kalendarz.
- **Warunki wstępne:** ważna sesja jednej z dwóch ról. Istnienie wolnego terminu nie jest wymagane.

**Scenariusz podstawowy**

1. Aktor żąda listy sal.
2. System pokazuje studentowi tylko aktywne sale (numer, opcjonalna nazwa, pojemność); administratorowi również nieaktywne z informacją o statusie.
3. Aktor wybiera salę, tydzień i długość zajęć 45 albo 90 minut.
4. System pokazuje pon.–pt., godzinne starty 07:00–22:00 i rozróżnia terminy wolne, zajęte rezerwacjami, zablokowane i niedozwolone. Dla 90 min wymaga dwóch kolejnych wolnych dozwolonych slotów; ostatni start to 21:00, dla 45 min — 22:00.
5. Aktor przegląda tydzień lub zmienia wybór, wracając do kroku 3. Może przejść do UC-03, gdzie zapis wymaga ponownej walidacji.

**Alternatywy i błędy**

- **A1 (krok 2):** lista pusta — system informuje o braku sal; zakończenie bez wyboru.
- **A2 (krok 4):** brak dostępnych terminów, data przeszła, weekend, przekroczony horyzont studenta lub sala nieaktywna oglądana przez administratora — system oznacza niedostępność/niedozwolony wybór; powrót do kroku 3. Administrator nie podlega +14 dni, ale nie może rezerwować nieaktywnej sali.
- **A3 (krok 4):** tylko jeden z dwóch slotów jest wolny — 90 min nie jest dostępne; powrót do kroku 3, np. po zmianę długości.
- **A4 (krok 4):** błąd odczytu lub sala już niedostępna dla roli — system informuje o problemie; ponowienie od kroku 1 lub zakończenie bez danych dostępności.

**Warunki końcowe sukcesu:** aktor zna listę i stan kalendarza z chwili odczytu. **Niepowodzenie:** nie otrzymał żądanej dostępności. W obu przypadkach brak zmian rezerwacji; podgląd nie gwarantuje późniejszego sukcesu zapisu.

## UC-03 — Rezerwowanie sali

- **Aktor główny:** Student albo Administrator działający w imieniu studenta. **Inni uczestnicy:** wskazany student jako właściciel w wariancie administracyjnym; nie wykonuje wtedy kroków.
- **Cel:** zapisać rezerwację zajęć 45/90 minut dla studenta.
- **Powiązane WF:** WF-04, WF-05, WF-06.
- **Wyzwalacz:** aktor rozpoczyna tworzenie rezerwacji.
- **Warunki wstępne:** ważna sesja; w wariancie administracyjnym istnieje konto studenta do wyboru. Wcześniejszy podgląd wolnego terminu nie jest warunkiem gwarantującym zapis.

**Scenariusz podstawowy — Student**

1. Student wybiera salę, lokalną datę, pełną godzinę i długość 45/90 min.
2. System przedstawia termin, czas zajęć i zajętość 1/2 slotów; właścicielem jest zalogowany student.
3. Student zatwierdza utworzenie rezerwacji.
4. System podczas zapisu ponownie sprawdza rolę, aktywność sali, przyszłość początku, pon.–pt., start 07:00…22:00 (90 min najpóźniej 21:00), datę ≤dzisiaj+14 włącznie oraz limit maks. 3 przyszłych aktywnych po zapisie. Liczy również rezerwacje utworzone przez administratora.
5. System sprawdza pełną zajętość: brak konfliktu aktywnej rezerwacji sali, tego samego właściciela także w innej sali oraz blokady. Atomowo zapisuje `ACTIVE` z właścicielem i inicjatorem równymi studentowi; chroni integralność przy równoczesnych zapisach.
6. System potwierdza utworzenie i aktualizuje dostępność oraz listę własnych rezerwacji.

**Alternatywy i błędy**

- **A1 — Administrator (zamiast kroków 1–2):** administrator wybiera konto właściciela-studenta oraz salę, datę, godzinę i długość. System pokazuje właściciela i podsumowanie. Powrót do kroku 3 z administratorem jako zatwierdzającym. W kroku 4 pomija wyłącznie limit 3 i +14 dni; pozostałe walidacje kroków 4–5 obowiązują bez wyjątków. Zapis zachowuje właściciela-studenta i administratora jako inicjatora. W kroku 6 potwierdza utworzenie i aktualizuje dostępność/listę administracyjną; wpis jest też widoczny właścicielowi w UC-04.
- **A2 (kroki 1–4):** brak/niepoprawny właściciel w wariancie administratora, konto administracyjne jako właściciel, niepoprawny termin, limit lub horyzont — komunikat konkretnej odmowy, brak zapisu; powrót do kroku 1 odpowiedniego wariantu.
- **A3 (kroki 4–5):** sala nieaktywna, konflikt sali/właściciela/blokady, również powstały po podglądzie — system odmawia bez rezerwacji, odświeża informację; powrót do kroku 1.
- **A4 (krok 5):** równoczesna kolidująca próba, blokada bazy lub błąd przejściowy — brak sprzecznego/częściowego zapisu, komunikat konfliktu/błędu; zakończenie niepowodzeniem. Ewentualne ponowienie zaczyna się od kroku 1 i pełnej walidacji.
- **A5 (przed krokiem 3):** aktor rezygnuje — zakończenie bez zapisu.

**Warunki końcowe sukcesu:** istnieje jedna nowa aktywna rezerwacja właściwego studenta, z rzeczywistym inicjatorem i zajętością 60/120 min; bez etapu akceptacji administratora. **Niepowodzenie:** próba nie tworzy rezerwacji i nie zmienia istniejących wpisów.

## UC-04 — Przeglądanie własnych rezerwacji

- **Aktor główny:** Student. **Inni uczestnicy:** brak.
- **Cel:** poznać własne nadchodzące rezerwacje i historię.
- **Powiązane WF:** WF-07, WF-15 (ochrona danych).
- **Wyzwalacz:** student otwiera „Moje rezerwacje”.
- **Warunki wstępne:** ważna sesja studenta; lista może być pusta.

**Scenariusz podstawowy**

1. Student żąda własnej listy rezerwacji.
2. System ustala właściciela z sesji i pobiera tylko jego wpisy, także utworzone w jego imieniu przez administratora.
3. System pokazuje salę, datę, godzinę, długość zajęć i stan: nadchodząca, rozpoczęta, zakończona albo anulowana. Rozpoczęcie/zakończenie wynika z czasu, nie z trwałego statusu `COMPLETED`.
4. Student przegląda nadchodzące i historyczne wpisy; system udostępnia anulowanie wyłącznie przyszłych aktywnych (przejście do UC-05).

**Alternatywy i błędy**

- **A1 (krok 2):** brak własnych wpisów — system pokazuje pustą listę; zakończenie sukcesem odczytu.
- **A2 (krok 2):** próba odczytu cudzych wpisów przez zmianę identyfikatora — odmowa bez ujawnienia historii; zakończenie żądania, powrót do kroku 1 dla własnych danych.
- **A3 (krok 2):** błąd odczytu — komunikat; ponowienie od kroku 1 lub zakończenie niepowodzeniem.

**Warunki końcowe sukcesu:** student otrzymał wyłącznie własne dane lub pustą listę. **Niepowodzenie:** żądane dane nie zostały udostępnione. Żaden wariant nie zmienia rezerwacji.

## UC-05 — Anulowanie własnej rezerwacji

- **Aktor główny:** Student. **Inni uczestnicy:** brak.
- **Cel:** zwolnić własny przyszły termin z zachowaniem historii.
- **Powiązane WF:** WF-08, WF-15 (ochrona danych).
- **Wyzwalacz:** student wybiera anulowanie rezerwacji.
- **Warunki wstępne:** ważna sesja studenta i wskazana rezerwacja. Własność, status i przyszłość muszą być zweryfikowane przy wykonaniu, nawet gdy akcja była wcześniej widoczna.

**Scenariusz podstawowy**

1. Student wskazuje własną nadchodzącą rezerwację i żąda anulowania.
2. System ponownie sprawdza właściciela, `ACTIVE` i początek ściśle w przyszłości.
3. System atomowo ustawia `CANCELLED`, zapisuje czas, studenta jako inicjatora i przyczynę `STUDENT_CANCELLED`; zachowuje wpis historyczny i zwalnia zajętość.
4. System potwierdza wynik i pokazuje zaktualizowaną listę/dostępność.

**Alternatywy i błędy**

- **A1 (krok 2):** cudzy lub nieistniejący wpis, także po podmianie identyfikatora — odmowa bez ujawnienia cudzych danych; zakończenie bez zmiany.
- **A2 (krok 2):** wpis już anulowany, rozpoczęty lub zakończony — odmowa, odświeżenie stanu; zakończenie bez zmiany. Dotyczy również zmiany stanu między podglądem a żądaniem.
- **A3 (krok 3):** błąd zapisu/współbieżna zmiana — brak częściowej zmiany, komunikat; zakończenie niepowodzeniem, ponowienie od kroku 1 po odświeżeniu.

**Warunki końcowe sukcesu:** przyszła rezerwacja została anulowana z pełną historią, a jej sloty zwolnione. **Niepowodzenie:** próba nie zmienia rezerwacji ani historii anulowań.

## UC-06 — Zarządzanie salami

- **Aktor główny:** Administrator. **Inni uczestnicy:** studenci, których rezerwacje mogą zostać anulowane; nie wykonują kroków.
- **Cel:** utrzymać dane i aktywność sal bez utraty historii.
- **Powiązane WF:** WF-11, WF-12, WF-13, WF-15 (dostęp administracyjny).
- **Wyzwalacz:** administrator otwiera zarządzanie salami.
- **Warunki wstępne:** ważna sesja administratora; edycja/zmiana aktywności wymaga istniejącej sali.

**Scenariusz podstawowy — dodanie**

1. Administrator wybiera dodanie sali i podaje numer, pojemność oraz opcjonalne nazwę/opis.
2. System sprawdza niepusty numer, unikalność po normalizacji białych znaków i wielkości liter oraz dodatnią całkowitą pojemność.
3. Administrator zatwierdza dane; system ponownie je sprawdza i zapisuje nową salę.
4. System potwierdza dodanie i odświeża listę sal.

**Alternatywy i błędy**

- **A1 — edycja (zamiast kroku 1):** administrator wybiera istniejącą salę i zmienia numer/nazwę/opis/pojemność; kroki 2–4 dotyczą aktualizacji. System zachowuje tożsamość sali, powiązania i historię rezerwacji.
- **A2 — dezaktywacja (zamiast kroków 1–4):** administrator wybiera aktywną salę i dezaktywację. System pokazuje liczbę wszystkich przyszłych aktywnych rezerwacji tej sali do anulowania. Administrator świadomie potwierdza skutki. System w transakcji ponownie ustala zbiór i liczbę, dezaktywuje salę i anuluje te rezerwacje (`ROOM_DEACTIVATED`, czas, administrator jako inicjator). Potwierdza wynik; zakończenie sukcesem. Rozpoczęte, zakończone i wcześniej anulowane pozostają bez zmian.
- **A3 — aktywacja (zamiast kroku 1):** administrator wybiera nieaktywną salę i aktywację; system przywraca możliwość nowych rezerwacji, bez odtwarzania anulowanych; zakończenie sukcesem.
- **A4 (kroki 2–3/A1):** brak numeru, duplikat lub pojemność niebędąca dodatnią liczbą całkowitą — odmowa bez zapisu, wskazanie błędu; powrót do formularza kroku 1/A1.
- **A5 (A2, ponowne wyliczenie):** liczba kolizji zmieniła się od podglądu — odświeżenie skutków i ponowne potwierdzenie albo bezpieczna odmowa. Brak cichego anulowania dodatkowych rezerwacji; powrót do podglądu A2 lub zakończenie bez zmiany.
- **A6 (A2, przed potwierdzeniem):** administrator rezygnuje — zakończenie bez zmian.
- **A7 (zapis dowolnego wariantu):** brak zasobu, konflikt lub błąd — komunikat i brak częściowych zmian; transakcja dezaktywacji jest w całości wycofana. Zakończenie niepowodzeniem; ponowienie od listy sal.

**Warunki końcowe sukcesu:** dane/aktywność zmienione zgodnie z wybranym wariantem; dezaktywacja i wymagane anulowania wykonane razem, historia zachowana. **Niepowodzenie:** operacja nie zmienia sali ani rezerwacji. Fizyczne usuwanie sal i przenoszenie rezerwacji nie należą do tego UC.

## UC-07 — Zarządzanie blokadami

- **Aktor główny:** Administrator. **Inni uczestnicy:** studenci dotknięci anulowaniem; nie wykonują kroków.
- **Cel:** wyłączyć termin sali lub usunąć blokadę, zachowując historię anulowań.
- **Powiązane WF:** WF-14, WF-15 (dostęp administracyjny).
- **Wyzwalacz:** administrator otwiera zarządzanie blokadami.
- **Warunki wstępne:** ważna sesja administratora; sala istnieje, a przy usuwaniu wskazana blokada istnieje.

**Scenariusz podstawowy — utworzenie**

1. Administrator wybiera salę, datę, godzinę oraz 1 albo 2 sloty blokady; może podać opis przyczyny.
2. System sprawdza przyszły początek, pon.–pt., pełne godziny 07:00…22:00, koniec zajętości do 23:00 (2 sloty najpóźniej od 21:00) i brak nakładania z inną blokadą tej sali.
3. System pokazuje liczbę przyszłych aktywnych rezerwacji sali kolidujących z całą zajętością blokady, które zostaną anulowane.
4. Administrator świadomie zatwierdza utworzenie i skutki, również gdy liczba wynosi zero.
5. System w transakcji ponownie sprawdza termin, blokady i zbiór/liczbę kolidujących przyszłych aktywnych rezerwacji. Tworzy blokadę i anuluje te rezerwacje, zapisując `TIME_BLOCKED`, czas i administratora jako inicjatora; zachowuje historię.
6. System potwierdza wynik i odświeża blokady oraz dostępność.

**Alternatywy i błędy**

- **A1 — usunięcie (zamiast kroku 1):** administrator wybiera istniejącą blokadę i żąda usunięcia. System usuwa ją i odświeża dostępność; wcześniejsze anulowania pozostają, pozostałe ograniczenia dostępności nadal obowiązują. Zakończenie sukcesem, bez kroków tworzenia.
- **A2 (krok 2 lub 5):** termin niedozwolony, przeszły, 2 sloty od 22:00, duplikat lub nakładanie blokad — odmowa bez nowej blokady/anulowań; powrót do kroku 1.
- **A3 (krok 5):** liczba kolizji różni się od potwierdzonej — system odświeża skutki i wymaga ponownego potwierdzenia albo bezpiecznie odmawia; powrót do kroku 3 lub zakończenie bez zmian. Nie anuluje po cichu dodatkowych rezerwacji.
- **A4 (przed krokiem 4):** administrator rezygnuje — zakończenie bez zmian.
- **A5 (krok 5/A1):** błąd, współbieżna zmiana lub brak zasobu — komunikat i zakończenie niepowodzeniem; utworzenie i anulowania są w całości wycofane. Ponowienie od odświeżonej listy.

**Warunki końcowe sukcesu:** blokada istnieje wraz z kompletem wymaganych anulowań albo została usunięta bez odtworzenia rezerwacji. Rozpoczęte/zakończone rezerwacje nie są anulowane. **Niepowodzenie:** próba nie pozostawia blokady bez anulowań ani anulowań bez blokady; brak częściowych zmian.

## UC-08 — Zarządzanie rezerwacjami studentów

- **Aktor główny:** Administrator. **Inni uczestnicy:** właściciele-studenci, bez udziału w krokach.
- **Cel:** przeglądać rezerwacje wszystkich studentów i anulować przyszłe aktywne.
- **Powiązane WF:** WF-09, WF-10, WF-15 (dostęp administracyjny).
- **Wyzwalacz:** administrator otwiera listę wszystkich rezerwacji.
- **Warunki wstępne:** ważna sesja administratora; lista może być pusta. Anulowanie wymaga wskazania wpisu, którego aktualne warunki system dopiero weryfikuje.

**Scenariusz podstawowy**

1. Administrator żąda listy rezerwacji studentów.
2. System pokazuje wszystkich właścicieli, sale, daty, godziny, długości zajęć, statusy/stany czasowe i źródła utworzenia z rzeczywistymi inicjatorami.
3. Administrator odszukuje przyszłą aktywną rezerwację i wybiera anulowanie.
4. System ponownie weryfikuje uprawnienia, `ACTIVE` i początek ściśle w przyszłości.
5. System atomowo zapisuje `CANCELLED`, czas, administratora jako inicjatora i `ADMIN_CANCELLED`, zachowuje historię oraz zwalnia zajętość.
6. System potwierdza wynik i odświeża listę; anulowany wpis pozostaje widoczny również właścicielowi.

**Alternatywy i błędy**

- **A1 (po kroku 2):** administrator tylko przegląda listę lub lista jest pusta — zakończenie sukcesem odczytu, bez anulowania.
- **A2 (krok 4):** rezerwacja już anulowana, rozpoczęta, zakończona lub nie istnieje — odmowa bez zmiany, powrót do odświeżonej listy w kroku 2. Administrator nie może anulować historycznych wpisów.
- **A3 (krok 5):** błąd zapisu lub współbieżna zmiana — brak częściowej zmiany, komunikat i zakończenie niepowodzeniem; ponowienie od kroku 1.
- **A4 (krok 1):** błąd odczytu — komunikat i zakończenie niepowodzeniem, możliwość ponowienia od kroku 1.

**Warunki końcowe sukcesu:** lista została udostępniona administratorowi, a w wariancie anulowania przyszła rezerwacja zwolniona z zachowaniem powodu, czasu i inicjatora. **Niepowodzenie:** żądana operacja nie została wykonana; próba nie zmienia rezerwacji ani historii.
