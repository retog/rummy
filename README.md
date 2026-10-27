## Rummy

Playing [Brändi Rummy](https://www.braendi-shop.ch/de/A~SB.A05-03) (which I think is the same as 
[Rummikub](https://www.rummikub.com/)) I often become desperate by not being sure if I missed a possibility to put 
down all my tiles. So I wrote this code to check if and how a bunch of tiles can be put on the table.

The solver can be accessed programmatically, see `TableFactory.test.ts` or `demo.ts` to learn how. There is also a
web app to train your skills, see below.

The project uses [Deno](https://deno.com/). Run the demo with:

    deno task demo

Test with:

    deno task test

## Rummy Trainer (web app)

A puzzle trainer that runs in the browser and can be installed as an app (PWA, works offline):

- You see the sets on the table and the tiles on your rack. Rearrange the table and place as many of your tiles as
  possible: drag tiles between sets, onto *New set* or back to the rack (or tap a tile, then tap where it should go).
- **Check** tells you whether every set is valid and whether your solution is optimal. If a better solution exists,
  you can keep trying or have an optimal solution shown.
- Points depend on how close you got to the optimum, the difficulty (easy ×1, medium ×2, hard ×3, extreme ×5) and the
  number of failed attempts. Your results are stored in the browser's local storage and shown as a chart of your progress.
- After a puzzle, **Share** passes your result on: the score and the level, optionally also the time it took and your
  total score, together with a link that opens the trainer at the same level (`?level=hard`). It opens the share sheet
  of the system where the browser offers one; WhatsApp, Telegram, Facebook, X, Bluesky, email and copying to the
  clipboard work in every browser. Facebook only takes the link, so the text is copied to be pasted into the post.
- **Extreme** puzzles are built to resist shortcuts: nothing from the rack fits into a set as it is or forms a set on its
  own, placing even a single tile requires changing at least two sets, and every optimal solution rearranges at least
  five sets of the table.
- Sounds and animations give feedback on moves, failures and successes.
- Every color also has its own symbol (red ●, blue ■, orange ▲, black ★), so the tiles can be told apart without
  relying on color.

It is published at https://retog.github.io/rummy/. To run it locally:

    deno task serve

and open http://localhost:8000; the app is rebuilt whenever a source file changes. `deno task build` creates the
static site in `dist/web` (bundled with `deno bundle`, including the service worker for offline use).

The workflow in `.github/workflows/pages.yml` type-checks, tests and builds every push; pushes to `master` are
deployed to GitHub Pages. This requires *GitHub Actions* as the source in the repository's Pages settings.

The puzzles are made by `src/puzzle/Generator.ts`: it lays out random valid sets, takes some tiles from the table
(checking that the remaining tiles can still be arranged into valid sets), shows a fresh arrangement of the remaining
tiles and adds some random tiles to the rack. The optimum is computed by `src/puzzle/Optimizer.ts`, a memoized
search that finds the largest number of rack tiles that can be placed while all tiles on the table end up in valid
sets. Unlike `TableFactory`, which enumerates all tables, it treats equal tiles as interchangeable and only explores
sets containing the lowest remaining tile, so it solves even large positions in milliseconds. Its results are checked
against an exhaustive search in `Optimizer.test.ts`.

How hard a puzzle is can be measured with the optimizer as an oracle, see `src/puzzle/Analysis.ts`: which rack tiles fit
a set as it is, how many sets the cheapest move changes, and the *depth* of the puzzle, the number of sets on the table
that every optimal solution changes (found by searching for the largest group of sets that can stay untouched). Extreme
puzzles use these measures as acceptance criteria. Their hidden tiles are chosen so that the remaining tiles can be
arranged with no room for any of them (the optimizer supports this as a constraint), the distractors are decoys that
look like they fit, and a candidate is only accepted if no rack tiles form a set by themselves, placing any single tile
changes at least two sets and every optimal solution changes at least five. Since this can take a couple of seconds,
the web app prepares the next puzzle in its worker while the current one is being solved.
