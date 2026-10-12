## Rummy

Playing [Brändi Rummy](https://www.braendi-shop.ch/de/A~SB.A05-03) (which I think is the same as 
[Rummikub](https://www.rummikub.com/)) I often become desperate by not being sure if I missed a possibility to put 
down all my tiles. So I wrote this code to check if and how a bunch of tiles can be put on the table.

The solver can be accessed programmatically, see `TableFactory.spec.ts` or `demo.ts` to learn how. There is also a
web app to train your skills, see below.


Generate jscode in the `build` directory with:

    npm i
    npm run build

Then you can run the demo with:

    npm run demo

Test with:

    npm test
## Rummy Trainer (web app)

A puzzle trainer that runs in the browser and can be installed as an app (PWA, works offline):

- You see the sets on the table and the tiles on your rack. Rearrange the table and place as many of your tiles as
  possible: drag tiles between sets, onto *New set* or back to the rack (or tap a tile, then tap where it should go).
- **Check** tells you whether every set is valid and whether your solution is optimal. If a better solution exists,
  you can keep trying or have an optimal solution shown.
- Points depend on how close you got to the optimum, the difficulty (easy ×1, medium ×2, hard ×3) and the number of
  failed attempts. Your results are stored in the browser's local storage and shown as a chart of your progress.
- Sounds and animations give feedback on moves, failures and successes.

Run it locally with

    npm i
    npm run serve:web

and open http://localhost:8000. `npm run build:web` creates a static build in `dist/web` (including the service
worker). The workflow in `.github/workflows/pages.yml` deploys it to GitHub Pages on every push to `master`; Pages has
to be enabled with *GitHub Actions* as source in the repository settings.

The puzzles are made by `src/puzzle/Generator.ts`: it lays out random valid sets, takes some tiles from the table
(checking that the remaining tiles can still be arranged into valid sets), shows a fresh arrangement of the remaining
tiles and adds some random tiles to the rack. The optimum is computed by `src/puzzle/Optimizer.ts`, a memoized
search that finds the largest number of rack tiles that can be placed while all tiles on the table end up in valid
sets. Unlike `TableFactory`, which enumerates all tables, it treats equal tiles as interchangeable and only explores
sets containing the lowest remaining tile, so it solves even large positions in milliseconds. Its results are checked
against an exhaustive search in `Optimizer.spec.ts`.
