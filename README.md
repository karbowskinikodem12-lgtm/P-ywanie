# Tor — dziennik pływaka

Progresywna aplikacja webowa (PWA) do prowadzenia dziennika żywienia i treningu
dla pływaka trenującego wyczynowo. Rozpoznaje posiłek ze zdjęcia, liczy 31
składników odżywczych, dopasowuje cele do faktycznie wykonanego treningu i
działa offline. Zdjęcie jest skrótem, nie wymogiem — przycisk z ołówkiem obok
przycisku aparatu dodaje posiłek od razu przez wyszukiwarkę produktów.

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
sw.js                 service worker: shell + wagi modelu w cache
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

---

## Jak liczą się cele

- **Energia** — Mifflin-St Jeor + 1,35 (aktywność poza treningiem) + energia
  sesji. Dopóki nie ma wpisanego treningu, używany jest średni koszt z planu
  tygodnia; po wpisaniu sesji plan jest **zastępowany**, a nie sumowany.
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

---

## Dostępność

- Kontrast tekstu pomocniczego 4,5:1 (WCAG AA) w obu motywach.
- Wszystkie cele dotknięcia co najmniej 44 pt zgodnie z iOS HIG; wyjątkiem są
  segmentowane przełączniki (36 pt, tyle co systemowe) i słupki wykresu.
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
