# PoesjePuzzel – ontwerp en afspraken

Een rustig puzzelspel in de browser voor een kind dat gek is op poezen.
Stijl: knusse kamer, zachte pasteltinten, mollige "jelly" poezen zoals in Catomino.
Geen tijdsdruk, geen game-over, niets dat flitst of schrikt.

## Spelidee
- Op de vloer ligt een kleedje met een vorm (hartje, visje, huisje, ...).
- De poezen zijn polyomino's (tetris-achtige vormen van 2 tot 5 vakjes) en liggen verspreid in de kamer.
- Klik op een poes om haar op te pakken; ze volgt de muis zonder dat je de knop ingedrukt hoeft te houden. Klik nog eens om haar neer te leggen. Klassiek slepen met ingedrukte knop werkt ook.
- Past ze precies in de vorm, dan klikt ze vast (plofje, hartjes, sprankels).
- Spatiebalk draait de poes die je vasthoudt met de klok mee (ook R, pijltjes, scrollwiel, rechtermuisknop). Scrollen of rechtsklikken boven een liggende poes draait haar ter plekke.
- Een muis-loslaten vlak na een toetsaanslag wordt genegeerd: touchpads die tijdens het typen uitschakelen lieten anders de poes vallen.
- Geen tekstwolkjes: de poezen laten alleen geluidjes horen.
- Alle vakjes gevuld = puzzel klaar: belletjes, hartjes, de poezen vallen in slaap, kaartje met "Volgende puzzel".
- Heel af en toe (ongeveer elke 1 à 1,5 minuut, 70% kans) staat een poes op het kleedje op, rekt zich uit, zegt "mrrp!" en wandelt terug de kamer in.
- De puzzel is altijd oplosbaar zonder draaien: de poezen zijn letterlijk de stukjes waarin de vorm is opgeknipt.

## Bestanden
- `index.html`, `style.css` – schil en UI (titelbalk, hint, kaartje/splash).
- `js/sound.js` – alle geluid met WebAudio, live gesynthetiseerd: spinnen (noise + 26 Hz puls), miauwtjes, plofje, belletjes, zachte achtergrondakkoorden met sporadische pentatonische nootjes.
- `js/levels.js` – de vormen als ASCII (`#` = vakje) en het opdelen van een vorm in samenhangende stukjes.
- `js/cat.js` – de poes: vorm, kop/staart-keuze, animatie (uitrekken bij bewegen, stuiterveertje, knipperen, oortjes, slapen) en het tekenen. De pluizige vacht (plukjes langs de rand, haartjes, zachte patronen) is duur en wordt per poes in twee offscreen canvassen gecachet (lijf en kop); alleen bij draaien of een andere schermschaal wordt hij opnieuw getekend. Ogen, oren, staart, schaduw en squash blijven per frame.
- `js/room.js` – kamer en kleedje. Muur, raam, vloer, plankje, kussen en mandje worden één keer per schermschaal voorgetekend (`renderBackground`); het kleedje één keer per puzzel in een offscreen canvas (`drawCarpet`). Plant, bolletje wol, etensbakje en krabpaal zijn "spulletjes die reageren": `Room.bump(id, richting, kracht)` geeft een zetje (bladeren zwaaien en ritselen, bolletje rolt weg en wikkelt draad af, bakje schommelt met rimpels en het visje schiet naar de andere kant, krabpaal wiegt en het muisje slingert na), `Room.nudge` duwt het bolletje zachtjes onder een poes vandaan, `Room.updateProps(dt, t, vermijd)` laat alles uitdempen (gedempte veren) en houdt het bolletje van kleedje, meubels en liggende poezen af, `Room.drawables()` geeft tekenlagen met hun onderkant zodat game.js ze samen met de poezen op diepte sorteert. `Room.propRects()` zijn de raakvlakken; game.js (`checkBumps`) test de gedragen en huppelende poezen ertegen, met per poes en voorwerp een afkoeltijd van 0,8 s.
- `js/splash.js` – startscherm met geanimeerde mascotte.
- `js/game.js` – spelverloop, invoer, plaatsen, neerzetten, wegwandelen, deeltjes, lus. Voortgang (puzzelnummer) staat in `localStorage` onder `poesjepuzzel.level`.
- `manifest.json`, `sw.js`, `icons/` – installeerbaar als app op het beginscherm en offline speelbaar. De service worker haalt online altijd de nieuwste bestanden (network-first) en valt offline terug op de cache.
- Draaiknop `#btn-rotate` rechtsonder verschijnt zodra je een poes vasthoudt (voor tablets zonder toetsenbord).

Online: GitHub Pages vanaf de `main`-branch van github.com/smhg/PoesjePuzzel. Geen build-stap: `index.html` direct openen in een browser werkt ook. Gewone `<script>`-tags, geen modules (werkt via `file://`).

## Handig bij ontwikkelen
- `index.html?nosplash` slaat het startscherm over.
- `index.html?level=7` begint bij puzzel 7.
- `index.html?debug` zet `window.PP` klaar (cats, held, grid) voor tests; zie de CDP-scripts in de sessie-scratchpad als voorbeeld van echte-invoer-tests via `google-chrome --remote-debugging-port`.
- Schermafdruk zonder browser: `google-chrome --headless=new --screenshot=uit.png --window-size=1280,800 --virtual-time-budget=4000 "file:///…/index.html?nosplash"`.

## Afspraken
- Taal in het spel: Nederlands, zo min mogelijk tekst.
- Muziek: alleen korte getokkelde noten (speeldoosje, zachte bas), geen lang aangehouden tonen; die voelden zwaarmoedig.
- Staarten: vaste lengte, per poes een eigen krul; in rust stil met af en toe een tik, zwaaien alleen tijdens dragen/lopen.
- Lichaam: heel lichte squash/stretch, niet meer.
- Logische canvasmaat 1280×800, geschaald naar het venster; vakjes zijn 58 px.
- Alles blijft kalm: langzame bewegingen, zachte kleuren, geluid zacht en uitzetbaar (knop rechtsboven).
- Kamerstijl sluit aan bij de pluche poezen: geen harde lijnen, lagen met verloop, fijne korrel (`furGrain`), pluizige randjes (`furEdge`) op kussens en plateaus. Reacties van spulletjes zijn klein en dempen in 1 à 3 seconden uit; alleen het bakje maakt een tikje (`Sound.pop`).

## Stand van zaken (8 november 2026)
- Online: https://smhg.github.io/PoesjePuzzel/ (GitHub Pages, branch `main`); installeerbaar op tablet, offline speelbaar, voortgang in `localStorage`.
- Bediening: tikken/klikken = draaien ter plekke, slepen = verplaatsen, roze knop of tweede vinger = draaien tijdens het slepen; spatie/R/pijltjes/scroll op desktop. Een loslaten vlak na een toets wordt genegeerd (touchpad dat uitschakelt tijdens typen); "draagmodus" (poes volgt zonder knop) bestaat alleen nog als redding daarna.
- Gedrag: huppelend weglopen na een verkeerde plek (eerst "huh?"), nieuwsgierig kijken naar een gedragen/huppelende poes, oortjes/snuffelen/tongetje, boos na schudden, samen in slaap vallen, laatst opgepakte poes bovenop.
- Prestaties: vacht en schaduw per poes gecachet; pixelverhouding begrensd op 1,5; oude poezen worden expliciet opgeruimd bij een nieuw level; kleedje gecachet.
- Kamer: reactieve meubels (plant, bolletje wol, bakje, krabpaal met muisje) en een rijkere stijl, door een Fable-agent in `js/room.js`; afronding/polish kan nog verder.
- Tests zonder browser-UI: CDP-scripts (echte invoer via `--remote-debugging-port`) staan als voorbeeld in de sessie-scratchpad; `?debug` geeft `window.PP` en een toetsenlog.

## Ideeën voor later
- Meer vormen en kamers (slaapkamer, tuin), seizoenen.
- Poezen met eigen namen en voorkeuren (zonneplekje, naast een vriendje).
- Meer speeltjes tussen puzzels door (het bolletje wol rolt al weg als je ertegenaan stoot).
- Sticker-album met de voltooide vormen.
