# Card Games

A small collection of classic card games, built as installable, ad-free web apps.

**Play them here:** https://battlingamazons.github.io/card-games/

Each game works offline once loaded and can be added to your phone's Home Screen (Share → Add to Home Screen) to play like a native app.

## Games

- **[Gin Rummy](https://battlingamazons.github.io/card-games/gin-rummy/)** — play against a computer opponent, with full authentic scoring (knocks, gin, undercuts, boxes).
- **[Solitaire](https://battlingamazons.github.io/card-games/solitaire/)** — classic Klondike, draw three, with auto-complete once you've won.
- **[FreeCell](https://battlingamazons.github.io/card-games/freecell/)** — all 52 cards dealt face up with four free cells; almost every deal is winnable.
- **[Video Poker](https://battlingamazons.github.io/card-games/video-poker/)** — Jacks or Better five-card draw with a saved credit bank.
- **[Blackjack](https://battlingamazons.github.io/card-games/blackjack/)** — beat the dealer to 21, with double down, 3:2 on blackjack and a saved credit bank.
- **[Slots](https://battlingamazons.github.io/card-games/slots/)** — three-reel slot machine with a saved credit bank.
- **[Roulette](https://battlingamazons.github.io/card-games/roulette/)** — European single-zero wheel with a full betting layout and a saved credit bank.
- **[Keno](https://battlingamazons.github.io/card-games/keno/)** — pick up to 10 of 80 numbers, the machine draws 20; saved credit bank.
- **[Invaders](https://battlingamazons.github.io/card-games/invaders/)** — a fixed-shooter arcade game with asteroid cover, a bonus ship, waves and a floating thumb-stick plus fire button.
- **[Air Hockey](https://battlingamazons.github.io/card-games/hockey/)** — drag-to-play air hockey against a computer rival that gets tougher with each win in a row.
- **[Scratch-Offs](https://battlingamazons.github.io/card-games/scratch/)** — scratch lottery tickets with your finger, match three to win; saved credit bank and unfinished tickets.

## Project structure

This is an npm-workspaces monorepo:

```
apps/
  landing/     static landing page (no build step) — becomes the site root
  gin-rummy/   Vite + vite-plugin-pwa app
  solitaire/   Vite + vite-plugin-pwa app
  freecell/    Vite + vite-plugin-pwa app
  video-poker/ Vite + vite-plugin-pwa app
  blackjack/   Vite + vite-plugin-pwa app
  slots/       Vite + vite-plugin-pwa app
  roulette/    Vite + vite-plugin-pwa app
  keno/        Vite + vite-plugin-pwa app
  invaders/    Vite + vite-plugin-pwa app (canvas game)
  hockey/       Vite + vite-plugin-pwa app (canvas game)
  scratch/      Vite + vite-plugin-pwa app
packages/
  shared/      shared Card model, rendering helpers, table.css, and icon generation
```

Each game is a self-contained PWA (installable, offline-capable) sharing only the card model, rendering, and base styles from `@card-games/shared`. There's no framework — each app renders plain HTML strings from a game-state snapshot and re-renders on every state change.

## Development

```
npm install
npm run dev --workspace=gin-rummy   # or solitaire / freecell / video-poker / blackjack / slots / roulette / keno / invaders / hockey / scratch
```

## Building

```
npm run build
```

Builds every app and assembles the static site (landing page + each app's build output) into `site/`, which is what gets deployed to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

## Adding a new game

1. Copy an existing app under `apps/` as a starting point (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `scripts/gen-icons.mjs`).
2. Write the game logic in `src/game/` (a state machine plus a `getSnapshot()` for rendering) and the UI in `src/main.ts`.
3. Run `npm run gen-icons` inside the new app to generate its PWA icons.
4. Add a card for it to `apps/landing/index.html`.
