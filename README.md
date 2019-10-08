## Rummy

Playing [Brändi Rummy](https://www.braendi-shop.ch/de/A~SB.A05-03) (which I think is the same as 
[Rummikub](https://www.rummikub.com/)) I often become desperate by not being sure if I missed a possibility to put 
down all my tiles. So I wrote this code to check if and how a bunch of tiles can be put on the table.

The code cas curently no UI (go ahead an write one) so it has to be accessed programmatically. See 
`TableFactory.spec.ts` to learn how.


Generate jscode in the `build` directory with:

    npm i
    npm run build

Test with:

    npm i
    npm test