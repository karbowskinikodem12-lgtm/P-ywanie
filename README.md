# Tor — dziennik pływaka


Progresywna aplikacja webowa (PWA) do prowadzenia dziennika żywienia i treningu
dla pływaka trenującego wyczynowo. Rozpoznaje posiłek ze zdjęcia, liczy 31
składników odżywczych, dopasowuje cele do faktycznie wykonanego treningu i
działa offline. Zdjęcie jest skrótem, nie wymogiem — przycisk z ołówkiem obok
przycisku aparatu dodaje posiłek od razu przez wyszukiwarkę produktów, a posiłek
jedzony regularnie wraca jednym dotknięciem z sekcji „Powtórz”.

**Wszystko dzieje się na urządzeniu.** Zdjęcia i dane nie są nigdzie wysyłane,
nie ma konta ani serwera. Jedyne zapytanie sieciowe to jednorazowe pobranie
modelu rozpoznawania obrazu — po nim aplikacja działa w pełni offline.

---

## Uruchomienie

Statyczne pliki — wystarczy dowolny serwer HTTP:

```bash
npx http-server -p 8080 -c-1 .
# albo: python3 -m http.server 8080
```

Otwórz `http://localhost:8080`. Service worker i moduły ES wymagają `http(s)://`
— otwarcie pliku przez `file://` nie zadziała.

Brak kroku budowania, brak zależności, brak `node_modules`.

---

## Architektura

```
index.html            powłoka aplikacji (statyczna, ~6 kB)
sw.js                 service worker: powłoka z sieci, wagi modelu z cache
manifest.webmanifest  instalacja, skróty (zdjęcie / trening / woda)

css/
  base.css            tokeny motywu, reset, typografia, siatka
  components.css      komponenty wielokrotnego użytku (karty, paski, panele)
  views.css           style poszczególnych ekranów

js/
  core/
    utils.js          formatowanie, daty, throttle/debounce, haptyka
    db.js             IndexedDB → localStorage → pamięć (trójstopniowy zapis)
    store.js          stan aplikacji, migracje, mutatory, kosz
  data/
    nutrients.js      definicje 32 pozycji: normy, jednostki, rola, źródła
    foods.js          137 produktów, pełny profil na 100 g
    dishes.js         62 dania jako receptury na produktach
    food-db.js        wspólne API: wyszukiwanie, porcje, wartości odżywcze
    exercise.js       MET, pot, węglowodany, obciążenie treningowe
  domain/
    targets.js        cele dnia z BMR + planu + faktycznych sesji
    analysis.js       sumy, wyniki, niedobory, rekomendacje, trendy
  vision/
    image.js          dekodowanie, skalowanie, cechy obrazu, segmentacja
    capabilities.js   wykrywanie WebGPU / WebNN / WASM SIMD / sieci
    model-engine.js   model CLIP w przeglądarce (transformers.js)
    heuristic-engine.js  awaryjne rozpoznawanie bez modelu
    learning.js       pamięć poprawek użytkownika (kNN po sygnaturach)
    portion.js        szacowanie gramatury
    index.js          orkiestracja: natychmiastowy wynik + upgrade modelem
  ui/
    icons.js          zestaw ikon (inline SVG)
    components.js     karty, paski, kafelki, wykresy, wiersze list
    sheet.js          panel dolny: gest zsuwania, pułapka focusu, przycisk wstecz
    toast.js          krótkie potwierdzenia z akcją „Cofnij”
    thumbs.js         dociąganie miniatur z IndexedDB po renderze
    undo.js           każde usunięcie przechodzi tą samą, odwracalną ścieżką
    reminders.js, onboarding.js
    views/            dashboard, analyze, training, micro, history, settings
  app.js              powłoka: routing, delegacja zdarzeń, cykl życia
```

Warstwy nie przeskakują w drugą stronę: `ui` czyta `domain`, `domain` czyta
`data`, `data` nie wie o niczym powyżej. Widoki są czystymi funkcjami
zwracającymi HTML; interakcje idą przez delegację `[data-action]` w `app.js`.

---

## Jak działa rozpoznawanie posiłku

Analiza jest wielostopniowa i **każdy kolejny stopień jest ulepszeniem, nigdy
warunkiem**. Użytkownik dostaje wynik natychmiast, a model dokłada się do niego
w tle, jeśli urządzenie mu na to pozwala.

```
zdjęcie ─► dekodowanie i skalowanie      (~40 ms)
        ─► cechy: barwa, tekstura, segmentacja regionów   (~60 ms)
        ─► pamięć poprawek + heurystyka  ──►  WYNIK NA EKRANIE (~150-250 ms)
                                          └►  model CLIP (WebGPU/WASM) ──► WYNIK
```

1. **Cechy lokalne** — histogram barw, energia krawędzi, wariancja luminancji i
   segmentacja siatkowa dzieląca talerz na składowe (mięso / kasza / warzywa).
   Krawędź kadru o niskim nasyceniu jest rozpoznawana jako talerz, a nie jako
   jedzenie.
2. **Pamięć poprawek** — sygnatura obrazu (16 liczb) trafia do lokalnej pamięci
   przy każdym zapisanym posiłku. Kolejne zdjęcie tego samego dania jest
   rozpoznawane po podobieństwie kosinusowym, nawet gdy model ogólny się myli.
3. **Heurystyka** — dopasowanie regionów do bazy produktów po barwie i teksturze,
   z korektą na porę dnia i częstotliwość, z jaką użytkownik je dany posiłek.
   Odległość barw uwzględnia, że odcień jest bez znaczenia przy niskim nasyceniu
   (blady ryż i blada kalafior mierzą się losowo różnym odcieniem mimo że
   wizualnie oba są po prostu „bezbarwne” — waga odcienia skaluje się więc
   nasyceniem obu kolorów). Pewność jest z założenia ograniczona do 58% —
   histogram barw nie jest dowodem.
4. **Model na urządzeniu** — CLIP (zero-shot) przez `transformers.js`, na WebGPU
   albo na procesorze, z promptem `"a photo of {}, a type of food"` — dokładnie
   ten szablon, który w materiałach OpenAI dla CLIP mierzalnie poprawia trafność
   na zbiorach typu Food-101. Modelowi pokazywana jest **cała baza produktów**
   (nie skrócona lista) — wcześniejsza wersja zawężała kandydatów heurystyką,
   która przy owocach i warzywach systematycznie się myliła, więc model nigdy
   nie dostawał szansy na poprawną odpowiedź. Etykiety pochodzą **wyłącznie z
   bazy produktów tej aplikacji**, więc model nie może zwrócić czegoś, czego nie
   umiemy przeliczyć na wartości odżywcze. Dodanie produktu do bazy automatycznie
   uczy o nim rozpoznawanie — bez trenowania czegokolwiek.
   Na WebGPU pierwszy w kolejce jest **ViT-B/16**, na procesorze **ViT-B/32**:
   B/16 tnie obraz na kafelki 16-pikselowe zamiast 32, więc widzi czterokrotnie
   więcej szczegółu przestrzennego i jest wyraźnie trafniejszy — ok. pięciu
   punktów zero-shot top-1 różnicy — kosztem mniej więcej czterokrotnie
   większego rachunku. Na GPU to opłacalne, na WASM byłaby to różnica między
   czekaniem a zawieszeniem.

### Kiedy na zdjęciu nie ma jedzenia

Klasyfikacja zero-shot to softmax **dokładnie po tych etykietach, które
dostanie**. Poda się jej dwieście produktów spożywczych i nic poza tym — i każde
zdjęcie na świecie jest jedzeniem, bo prawdopodobieństwa muszą zsumować się do
jedynki w obrębie menu. Zdjęcie czyichś kolan wracało jako „Schabowy z
ziemniakami, 78%" właśnie dlatego i **żaden próg na tej liczbie nigdy by tego nie
wyłapał**, bo ta liczba nigdy nie mierzyła „czy to jedzenie".

Razem z menu punktowany jest więc zestaw etykiet **nie-jedzenia**: ludzie,
ubrania, wnętrza, zwierzęta, ekrany, podłoga — plus `pusty talerz` i `brudne
naczynia`, czyli bliskie pudła akurat tej aplikacji, aparat wycelowany w stół
chwilę za wcześnie albo za późno. Dopiero wtedy pytanie ma odpowiedź.

Dwie liczby są czytane **z czubków obu list, nigdy z sum**. Etykiet jedzenia jest
dwieście, negatywnych trzydzieści, więc suma dawałaby jedzeniu siedmiokrotną
przewagę wynikającą wyłącznie z liczebności, a nie ze zdjęcia:

| liczba | co mówi | jak liczona |
|---|---|---|
| werdykt | czy to w ogóle jedzenie | najlepsze jedzenie × 1,15 ≥ najlepszy negatyw |
| `certainty` | jak bardzo to jedzenie | najlepsze jedzenie / (najlepsze jedzenie + najlepszy negatyw) |
| wynik pozycji | **które** jedzenie | renormalizowany w obrębie samych produktów |

Pewność pokazywana w interfejsie to iloczyn dwóch ostatnich: danie może pewnie
wygrać swoje menu i **nadal** nie zostać zaraportowane jako pewne, jeśli samo
zdjęcie było ledwie jedzeniem.

Margines 1,15 jest celowo powyżej jedynki, bo obie pomyłki nie kosztują tyle
samo: odrzucenie prawdziwej kolacji odsyła człowieka po zdjęcie, które było
dobre, a przyjęcie wątpliwej kosztuje jedno dotknięcie w alternatywę. Negatyw
musi więc wygrać wyraźnie, nie remisować.

**Jak to sprawdzić na własnym telefonie.** Czy werdykt był słuszny, nie da się
rozstrzygnąć ze zrzutu ekranu, a wag modelu nie da się pobrać z każdego
środowiska — więc zamiast się o to spierać, Ustawienia → Rozpoznawanie zdjęć →
Szczegóły pokazują **surowe liczby, z których decyzja zapadła**: najlepsze
jedzenie, trzy najwyżej ocenione etykiety „to nie jedzenie” i wynikowa pewność.
Jeśli aplikacja nazwie posiłkiem zdjęcie pokoju, widać tam, czy negatywy
przegrały i o ile — a to jest już diagnoza, nie domysł.

Obok tego Ustawienia → Dane pokazują **wersję aplikacji**. Bez kroku budowania
nic nie stempluje plików numerem, a telefon trzymający starego service workera
renderuje starą aplikację bez zarzutu — więc „czy to naprawione” i „czy to do
mnie dotarło” wyglądają identycznie. To już raz kosztowało rundę diagnozowania
błędu, który po prostu nie był jeszcze wdrożony.

**Czego to nie naprawia.** Tylko model potrafi odmówić. Tryb wspomagany to
dopasowanie barwy i tekstury — nie ma pojęcia „nie jedzenie" i przy zdjęciu
podłogi nadal zaproponuje posiłek. Dlatego jego pewność jest z góry ograniczona
do 58%, a plakietka mówi wprost „Tryb wspomagany". Odmowa modelu **kończy**
analizę i nie schodzi na heurystykę — zejście zniweczyłoby cały sens.

Jeśli model jest już załadowany, wstępna propozycja heurystyki **nie jest
pokazywana**: werdykt jest o sekundę, a mignięcie zgadniętym daniem przy
zdjęciu, które za chwilę zostanie odrzucone, to pokazanie posiłku, którego nikt
nie jadł. Propozycja wraca tylko wtedy, gdy wagi się jeszcze pobierają i panel
inaczej stałby pusty.

---

Jeśli urządzenie nie ma akceleracji, jest offline przed pierwszym pobraniem
modelu albo użytkownik oszczędza transfer — aplikacja zostaje na trybie
wspomaganym. Widoczna różnica to plakietka i wskaźnik pewności; przepływ pracy
jest identyczny.

**Nauka na poprawkach** obejmuje trzy niezależne pamięci, wszystkie lokalne i
możliwe do wyczyszczenia w ustawieniach:

| pamięć | co zapisuje | do czego służy |
|---|---|---|
| `priors` | ile razy dany produkt został potwierdzony | częste posiłki wygrywają remisy |
| `signatures` | sygnatura zdjęcia → potwierdzone danie | rozpoznawanie powtarzalnych posiłków |
| `portions` | zwykła gramatura użytkownika | trafniejsze szacowanie porcji |

### Dlaczego ta pamięć ma zaciągnięty hamulec

Sygnatura to szesnaście liczb nieujemnych: dwanaście koszyków odcienia plus
nasycenie, jasność, energia krawędzi i udział jedzenia w kadrze. Odległość
kosinusowa między wektorami nieujemnymi mieści się w wąskim pasmie tuż nad
zerem — próg 0,16, z którym to wyszło, brzmi ostrożnie, a nie jest. Zmierzone
na prawdziwym kodzie:

| | zakres odległości |
|---|---|
| ten sam posiłek, pięć ujęć (światło, kadr, balans bieli) | 0,000 – 0,058 |
| zdjęcia wizualnie niepowiązane | od 0,028 w górę |

**Zakresy się nakładają** i to jest właściwe odkrycie: żaden próg ich nie
rozdzieli, bo brązowy kotlet i czerwone danie pomidorowe mają naprawdę podobne
histogramy barw. Przy 0,16 czternaście procent niepowiązanych par liczyło się
jako ten sam posiłek — dość, by jedno potwierdzone danie zaczęło wygrywać
**każde** kolejne zdjęcie.

Próg leży więc poniżej punktu, w którym niepowiązane zdjęcia zaczynają
kolidować, kosztem gubienia powtórek zrobionych przy innym balansie bieli.
Nierozpoznanie części prawdziwych powtórek jest znacznie mniejszą porażką niż
nazywanie wszystkiego tym samym daniem.

Reszta obrony leży w tym, ile pamięć **wolno** jej zmienić. Histogram barw
zgadzający się z histogramem barw nie jest podstawą, żeby unieważnić etap,
który faktycznie patrzył na zdjęcie:

- mnożnik pewności ograniczony do 1,18× (oba składniki złożone sięgały 2,03×)
- w heurystyce zapamiętane danie, które zdjęcie **też** przypomina, dostaje
  realny podnośnik; takie, którego nie przypomina — ledwie próg wejścia
- gdy model się wypowiedział, **model wybiera posiłek**: kandydaci znalezieni
  wyłącznie przez heurystykę lądują poniżej najsłabszego kandydata modelu

To ostatnie było osobnym błędem. Wynik heurystyki jest z definicji ograniczony
do 0,58, a wynik modelu to prawdopodobieństwo — skalowanie heurystyki płaskim
0,5 i przeplatanie obu list porównywało dwie różne skale. Odkąd wyniki modelu
zaczęły nieść mnożnik pewności „czy to jedzenie", spadły na tyle, że
dopasowanie kolorystyczne potrafiło je wyprzedzić na zdjęciu, które model
rozpoznał pewnie.

---

## Powtarzanie posiłków

Dziennik żywienia stoi codziennością: ta sama owsianka rano, ta sama kanapka po
treningu. Sekcja „Powtórz” w oknie dodawania posiłku pokazuje to, co jest jadane
najczęściej, i wstawia cały posiłek — wszystkie składniki wraz z gramaturą —
jednym dotknięciem.

Posiłki grupowane są po nazwie, bo tym właśnie jest „ten sam posiłek” dla osoby,
która go zapisuje: owsianka odważona raz na 78 g, a raz na 82 g to nie są dwa
różne posiłki. Gramaturę podaje **najnowsze** wystąpienie nazwy, więc podpowiedź
nadąża za tym, jak posiłek jest jedzony teraz, a nie jak wyglądał za pierwszym
razem. Kolejność wyznacza częstość, a przy remisie świeżość — na starcie, gdy
wszystko było jedzone raz, listę porządkuje więc świeżość, co jest właściwym
zachowaniem dla pustego dziennika.

Wartości odżywcze są **przeliczane od nowa** ze składników, a nie kopiowane, więc
powtórzenie odzwierciedla aktualną bazę produktów. Zdjęcie celowo nie jest
przenoszone: to fotografia tamtego talerza, a przekazanie jej identyfikatora
dałoby dwa posiłki władające jednym obrazem — usunięcie któregokolwiek wyjęłoby
zdjęcie spod drugiego.

---

## Rozkład dnia na posiłki

Jedna liczba dzienna nie odpowiada na pytanie zadawane o 16:00: „ile mi zostało
na kolację”. Pulpit rozkłada więc cel energetyczny na cztery pory dnia
(24 / 30 / 24 / 22 %) i zestawia go z tym, co faktycznie do każdej z nich
trafiło, wyróżniając porę, w której jest zegar.

Planer istniał w kodzie od dawna, ale nigdy nie został podłączony — i modelował
**pięć** pór, dzieląc przekąski na `snack1` i `snack2`, podczas gdy zapisany
posiłek może nieść tylko jedną z czterech. Planowanej i zjedzonej strony nie dało
się więc zestawić. Przydziały przekąskowe są teraz połączone, a ostatnia pozycja
domyka zaokrąglenia, żeby części sumowały się dokładnie do celu dnia.

---

## Jak liczą się cele

- **Energia** — Mifflin-St Jeor + 1,35 (aktywność poza treningiem) + energia
  sesji. Dopóki nie ma wpisanego treningu, używany jest średni koszt z planu
  tygodnia; po wpisaniu sesji plan jest **zastępowany**, a nie sumowany —
  inaczej policzyłby się dwa razy. Zastępowana jest jednak tylko część
  przypadająca na sesje **już wpisane**: te, które według planu dopiero
  nastąpią, wciąż liczą się po stawce planu.

  To była realna usterka. `sessionsPerDay` siedziało w profilu od początku i
  **nie było czytane przez nic**, więc pływak trenujący dwa razy dziennie,
  wpisując poranną sesję, mówił aplikacji „to był cały dzień" — i cel spadał o
  kilkaset kalorii, mimo że druga sesja była dopiero przed nim. Przy planie
  14 h + 3 h tygodniowo wpisanie treningu 90 min **obniżało** cel o 475 kcal;
  teraz **podnosi** go o 191. Trening ma zarabiać na jedzenie, nie kosztować.

  Rezerwa na sesje jeszcze nieodbyte **wygasa przez wieczór** — o którejś
  godzinie trzeci trening już nie nastąpi, a przed snem cel ma odzwierciedlać
  to, co faktycznie się wydarzyło. Dni minione nigdy jej nie dostają. Cała ta
  arytmetyka jest wypisana wprost w „Cele dnia”, żeby liczba nie zmieniała się
  po cichu.
- **Białko** — 1,7–2,3 g/kg zależnie od fazy i objętości dnia.
- **Węglowodany** — 3–11 g/kg sterowane obciążeniem sesji, bo to ono opróżnia
  glikogen.
- **Tłuszcz** — reszta energii, ale nigdy poniżej 0,8 g/kg (próg hormonalny);
  poniżej tej granicy przycinane są węglowodany.
- **Woda** — 35 ml/kg + straty z potu policzone z sesji.
- **Mikroskładniki** — normy skalowane masą ciała, energią (witaminy z grupy B),
  podażą białka (B6) i płcią (żelazo).

Trzy wskaźniki na pulpicie: **mikroskładniki** (średnie pokrycie norm),
**regeneracja** (paliwo, białko, węglowodany, nawodnienie, sen, mikro + kara za
skok obciążenia 7:28) i **trening** (dzisiaj vs plan, tydzień, regularność).

---

## Dane i prywatność

- Zapis: IndexedDB, z awaryjnym localStorage i pamięcią sesji. Widoczne w
  ustawieniach, żeby użytkownik wiedział, gdzie faktycznie leżą jego dane.
- **Obrazy poza stanem.** Zdjęcia i miniatury leżą w osobnym magazynie
  IndexedDB, a rekord posiłku trzyma tylko klucz. Rok logowania to około
  1500 posiłków — miniatury w treści stanu dokładały do niego blisko 4 MB,
  serializowane przy każdej edycji i przekraczające limit localStorage.
  Miniatury z wcześniejszej wersji są przenoszone w tle przy starcie.
- Historia: do 400 dni. Kosz: 30 dni z możliwością przywrócenia — sprzątanie
  obrazów pomija wszystko, co czeka w koszu.
- Kopia zapasowa do pliku JSON i odtworzenie z pliku.
- Dane z poprzedniej, jednoplikowej wersji aplikacji (`localStorage: swim-log`)
  są migrowane automatycznie przy pierwszym uruchomieniu. Posiłki z tamtej
  wersji znają swoje wartości odżywcze, ale nie składniki — niosą je więc ze
  sobą i skalują wagą zamiast przeliczać od nowa.

---

## Wydajność

Mierzone w Chromium na pełnym roku danych (365 dni, 1460 posiłków, 365 sesji):

| co | wynik |
|---|---|
| start do pierwszego rysowania | ~280 ms |
| stan aplikacji (JSON) | 1,7 MB |
| render pulpitu / treningu / mikro / profilu | 0,6–1,4 ms |
| render historii (90 dni, wykresy, wyszukiwarka) | 6 ms |
| przeliczenie celów na dzień | < 0,1 ms |
| pamięć JS | ~20 MB |
| węzłów DOM na ekran | ~260 |

Widoki to czyste funkcje zwracające HTML, więc przerysowanie ekranu jest jedną
podmianą `innerHTML`; nie ma drzewa komponentów do uzgadniania. Analiza zdjęcia
liczy cechy na obrazie 192 px, nie na oryginale z aparatu.

### Płynność przewijania

Szybki render to nie to samo co płynne przewijanie — to drugie zależy od tego,
ile pracy kompozytor ma do wykonania w każdej klatce. Mierzone przy czterokrotnym
spowolnieniu procesora, żeby przybliżyć telefon:

| ekran | przed | po |
|---|---|---|
| Dzisiaj | 39 fps | 60 fps |
| Trening | 36 fps | 60 fps |
| Mikro | 41 fps | 60 fps |
| Historia | 37 fps | 60 fps |
| klatki powyżej 20 ms | 95–97 % | 0–0,7 % |

Złożyły się na to dwie przyczyny, obie niewidoczne w czasach renderowania:

**Rozmycie tła tam, gdzie nic się za nim nie rusza.** `backdrop-filter` czyta
jak szkło tylko wtedy, gdy coś pod nim przepływa. Karty z treścią przewijają
się razem ze swoim tłem, więc rozmycie kosztowało próbkowanie całej karty w
każdej klatce, a zwracało obraz nie do odróżnienia od zwykłego półprzezroczystego
wypełnienia. Pulpit rozmywał 2,74 ekranu na klatkę w czternastu warstwach. Zostały
trzy — pasek zakładek i dwa okrągłe przyciski, czyli jedyne powierzchnie, pod
którymi strona faktycznie przesuwa się w bok — łącznie 0,09 ekranu.

**Animacja, która przemalowywała największą kartę bez końca.** Fala na karcie
energii przesuwała `background-position-x`. Tej właściwości kompozytor nie
potrafi animować sam, więc karta była przemalowywana w każdej klatce, także gdy
aplikacja stała bezczynnie. Pasek fali jest teraz o jeden kafel szerszy niż karta
i przesuwa się przez `transform`, co dzieje się poza wątkiem głównym i nie
przemalowuje niczego.

Warto zauważyć, że to **nie** jest kompromis „mniej szkła za płynność". Z całego
efektu szkła tylko rozmycie tła kosztuje cokolwiek przy przewijaniu; rant,
faza i refleksy są malowane raz do warstwy elementu. Dlatego pływające menu jest
dziś wizualnie cięższe niż przed optymalizacją — pełna faza, jasny rant i smugi
światła wzdłuż krawędzi — mimo że rozmywa trzydzieści razy mniejszą powierzchnię.

---

### Spójność powłoki po wdrożeniu

Nie ma kroku budowania, więc nazwy plików nie niosą skrótu treści — dokument
zawsze odwołuje się do `css/components.css` pod stałą ścieżką. Gdy nawigacje
szły z sieci, a arkusze i moduły z cache, pierwsze wejście po każdym wdrożeniu
łączyło **świeży `index.html` z arkuszem i modułami z poprzedniego wydania**.
To nie jest ryzyko kosmetyczne: klasa, na której opiera się nowy znacznik, po
prostu nie istnieje w starym arkuszu, więc aplikacja rysuje się półubrana —
a stare moduły przy nowym znaczniku potrafią zepsuć samo działanie.

Dokument i kod, do którego się odwołuje, idą więc razem: z sieci, z cache jako
zapasem na tryb offline. Wagi modelu zostają cache-first, bo są adresowane
treścią i nigdy nie zmieniają się w miejscu.

Osobno: worker, który skończył instalację podczas wcześniejszej wizyty, czeka
zaparkowany w `waiting`, a `updatefound` nie odpali się dla niego drugi raz.
Aplikacja sprawdza więc `waiting` także na starcie, inaczej użytkownik mógłby
tkwić na starej wersji, mając nową tuż obok.

Aktualizacja **wchodzi sama**, jeśli nie ma czego przerwać. Wcześniej zawsze
czekała na dotknięcie, w imię zasady, że wersja nie może się podmienić w trakcie
edycji — ale ta zasada dotyczy dokładnie jednej sytuacji, otwartego panelu z
komponowanym posiłkiem, a dotknięcia żądano we wszystkich pozostałych. Tak
poprawka potrafi leżeć w `main` godzinę, podczas gdy telefon spokojnie serwuje
starą aplikację, a pytanie „czy to już naprawione” przestaje mieć odpowiedź.
Warunek jest więc sprawdzany, nie zakładany: `sheet.isOpen()` decyduje, czy
podmienić po cichu, czy zaproponować „Odśwież”.

Jest tu jedno ograniczenie warte zapisania: logika podmiany żyje w `app.js`, więc
**działa dopiero od wersji, która ją zawiera**. Przejście na nią wymaga jeszcze
starej ścieżki z dotknięciem; każde kolejne wdrożenie idzie już samo.

---

## Dostępność

- Kontrast tekstu pomocniczego 4,5:1 (WCAG AA) w obu motywach.
- Pasek zakładek jest przezroczystym szkłem, więc powierzchnia pod etykietą
  zmienia się razem z przewijaną treścią. Etykiety mierzone na tej powierzchni
  przy ukrytych glifach trzymają 6,1–8,9:1. Aktywna zakładka ma celowo
  nieprzezroczystą pigułkę — półprzezroczysta pozwalałaby treści pod spodem
  huśtać kontrastem napisu — i własny odcień błękitu (`--tab-on`), bo systemowy
  `--blue` na tej pigułce mierzy 3,4:1 i nie przechodzi AA.
- Wszystkie cele dotknięcia co najmniej 44 pt zgodnie z iOS HIG; wyjątkiem są
  segmentowane przełączniki (36 pt, tyle co systemowe) i słupki wykresu.
  Liczy się faktyczne pole trafienia, nie rozmiar wizualny: chipy i okrągłe
  przyciski w edytorze posiłku zostają małe, a zasięg niesie niewidoczna
  nakładka. Kontenery są pod nią dobrane — `.alts` jest oknem przewijania,
  które przycinało nakładkę do 40 px, a `.wrap` potrzebuje 10 px odstępu, żeby
  nakładki sąsiednich wierszy stykały się zamiast nachodzić.
- Każdy element sterujący ma nazwę dla czytnika ekranu, każde pole — etykietę.
- Panel dolny: pułapka focusu, zamykanie klawiszem Escape, gestem i przyciskiem
  wstecz. Gest obsłużony przez Pointer Events, więc działa palcem i myszą.
- `prefers-reduced-motion` wyłącza animacje, `prefers-contrast` wzmacnia
  separatory.

---

## Kompatybilność

- Cel: iPhone (Safari 16+), zoptymalizowane pod iPhone 16 — bezpieczne
  marginesy, gesty, `backdrop-filter`, brak wymuszonego zoomu.
- Działa też na Chrome/Edge/Firefox na Androidzie i desktopie.
- Model na WebGPU: Chrome/Edge 121+, Safari 18+. Bez WebGPU model działa na
  procesorze (WASM SIMD) albo aplikacja zostaje na trybie wspomaganym.
- Powiadomienia: `TimestampTrigger` tam, gdzie jest dostępny (działają przy
  zamkniętej aplikacji), w przeciwnym razie w trakcie sesji.

---

## Wartości odżywcze — zastrzeżenie

Baza opiera się na uśrednionych wartościach z tabel składu produktów (USDA
FoodData Central, tabele IŻŻ dla produktów lokalnych). To dobre dane do
wyłapywania trendów i braków, a nie wynik badania laboratoryjnego konkretnej
porcji. Aplikacja mówi o tym wprost w miejscach, gdzie pokazuje mikroskładniki.






<!-- deploy-retry: 20260806T193201Z -->
