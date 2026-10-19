# Mozambik 🌍

Gra na telefon: pojedynek na znajomość stolic państw świata.

## Jak grać

- **Wyzwij kolegę** — odpowiadasz na 10 pytań i wysyłasz link (WhatsApp, SMS…).
  Kolega dostaje **te same pytania**, a po swojej grze widzi porównanie wyników
  i może odesłać ci link z rezultatem.
- **Trening** — gra solo.
- **Losowy przeciwnik** — w przygotowaniu (wymaga serwera).

Każde pytanie ma 15 sekund. Poprawna odpowiedź daje 100–250 pkt — im szybciej, tym więcej.
Można wybrać kontynent albo cały świat (194 państwa).

## Jak to działa

Zwykła strona internetowa (PWA) bez serwera i bez instalacji zależności.
Na telefonie: otwórz stronę → „Dodaj do ekranu głównego”, a gra działa jak aplikacja (także offline).

Pojedynek nie potrzebuje serwera: pytania są losowane deterministycznie z „ziarna”,
które razem z wynikami graczy jest zapisane w linku (`#w=…`).

| Plik | Zawartość |
| --- | --- |
| `index.html` | szkielet strony |
| `app.js` | logika gry, ekrany, linki z wyzwaniem |
| `data.js` | lista państw i stolic (po zmianie podbij `DATA_VERSION`) |
| `style.css` | wygląd (jasny i ciemny motyw) |
| `sw.js`, `manifest.webmanifest`, `icons/` | instalacja na telefonie i tryb offline |

## Uruchomienie lokalnie

```sh
python3 -m http.server 8000
# otwórz http://localhost:8000
```
