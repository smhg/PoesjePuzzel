# PoesjePuzzel – ontwerp en afspraken

Een rustig puzzelspel in de browser voor een kind dat gek is op poezen.
Stijl: knusse kamer, zachte pasteltinten, mollige "jelly" poezen zoals in Catomino.
Geen tijdsdruk, geen game-over, niets dat flitst of schrikt.

## Spelidee
- Op de vloer ligt een kleedje met een vorm (hartje, visje, huisje, ...).
- De poezen zijn polyomino's (tetris-achtige vormen van 2 tot 5 vakjes) en liggen verspreid in de kamer.
- Sleep een poes naar het kleedje; past ze precies in de vorm, dan klikt ze vast (plofje, hartjes, sprankels).
- Klik (zonder slepen) op een poes om haar te draaien. Rechtermuisknop, scrollwiel, spatie of R draaien ook.
- Alle vakjes gevuld = puzzel klaar: belletjes, hartjes, de poezen vallen in slaap, kaartje met "Volgende puzzel".
- Heel af en toe (ongeveer elke 1 à 1,5 minuut, 70% kans) staat een poes op het kleedje op, rekt zich uit, zegt "mrrp!" en wandelt terug de kamer in.
- De puzzel is altijd oplosbaar zonder draaien: de poezen zijn letterlijk de stukjes waarin de vorm is opgeknipt.

## Bestanden
- `index.html`, `style.css` – schil en UI (titelbalk, hint, kaartje/splash).
- `js/sound.js` – alle geluid met WebAudio, live gesynthetiseerd: spinnen (noise + 26 Hz puls), miauwtjes, plofje, belletjes, zachte achtergrondakkoorden met sporadische pentatonische nootjes.
- `js/levels.js` – de vormen als ASCII (`#` = vakje) en het opdelen van een vorm in samenhangende stukjes.
- `js/cat.js` – de poes: vorm, kop/staart-keuze, animatie (uitrekken bij bewegen, stuiterveertje, knipperen, oortjes, slapen) en het tekenen (vloeiende omtrek via `outlinePath`, schaduw, vacht, gezichtje).
- `js/room.js` – kamer (muur, raam, vloer, zonlicht, planten, krabpaal) en het kleedje.
- `js/splash.js` – startscherm met geanimeerde mascotte.
- `js/game.js` – spelverloop, invoer, plaatsen, neerzetten, wegwandelen, deeltjes, lus.

Geen build-stap: `index.html` direct openen in een browser. Gewone `<script>`-tags, geen modules (werkt via `file://`).

## Handig bij ontwikkelen
- `index.html?nosplash` slaat het startscherm over.
- `index.html?level=7` begint bij puzzel 7.
- Schermafdruk zonder browser: `google-chrome --headless=new --screenshot=uit.png --window-size=1280,800 --virtual-time-budget=4000 "file:///…/index.html?nosplash"`.

## Afspraken
- Taal in het spel: Nederlands, zo min mogelijk tekst.
- Logische canvasmaat 1280×800, geschaald naar het venster; vakjes zijn 58 px.
- Alles blijft kalm: langzame bewegingen, zachte kleuren, geluid zacht en uitzetbaar (knop rechtsboven).

## Ideeën voor later
- Meer vormen en kamers (slaapkamer, tuin), seizoenen.
- Poezen met eigen namen en voorkeuren (zonneplekje, naast een vriendje).
- Speeltjes om mee te spelen tussen puzzels door, bolletje wol dat rolt.
- Sticker-album met de voltooide vormen.
