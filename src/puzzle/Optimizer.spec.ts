import { expect } from 'chai';
import 'mocha';
import { solve } from './Optimizer';
import { analyzeSet } from './Rules';
import { createRandom, Random } from './Generator';
import { Tile, isJoker, compareTiles, tileFromId, JOKER_IDS } from './Tile';

const RED = 0, BLUE = 1, ORANGE = 2, BLACK = 3;
const used = new Set<number>();
/** a tile with a unique id (first or second copy) */
function t(color: number, value: number): Tile {
    const first = color * 13 + value - 1;
    if (used.has(first) && used.has(first + 52)) throw new Error('no copy left of ' + color + '/' + value);
    const tile = used.has(first) ? tileFromId(first + 52) : tileFromId(first);
    used.add(tile.id);
    return tile;
}
function j(): Tile {
    const id = used.has(JOKER_IDS[0]) ? JOKER_IDS[1] : JOKER_IDS[0];
    used.add(id);
    return tileFromId(id);
}

function popcount(n: number): number {
    let c = 0;
    while (n) { c += n & 1; n >>= 1; }
    return c;
}

/** exhaustive check whether the tiles can be split into valid sets */
function canPartition(tiles: Tile[]): boolean {
    if (tiles.length === 0) return true;
    const sorted = tiles.slice().sort(compareTiles);
    const first = sorted[0];
    const rest = sorted.slice(1);
    const partners = rest.filter(x => isJoker(x) || isJoker(first) || x.color === first.color || x.value === first.value);
    for (let mask = 1; mask < 1 << partners.length; mask++) {
        if (popcount(mask) < 2) continue;
        const set = [first].concat(partners.filter((_, i) => mask & (1 << i)));
        if (!analyzeSet(set)) continue;
        if (canPartition(rest.filter(x => set.indexOf(x) < 0))) return true;
    }
    return false;
}

/** exhaustive optimum over all subsets of the rack */
function bruteForce(board: Tile[], hand: Tile[]): number {
    let best = -1;
    for (let mask = 0; mask < 1 << hand.length; mask++) {
        const size = popcount(mask);
        if (size <= best) continue;
        if (canPartition(board.concat(hand.filter((_, i) => mask & (1 << i))))) best = size;
    }
    return best;
}

const stats = { feasible: 0, infeasible: 0 };
function checkSolution(board: Tile[], hand: Tile[]) {
    const solution = solve(board, hand);
    const expected = bruteForce(board, hand);
    if (expected < 0) stats.infeasible++;
    else stats.feasible++;
    if (expected < 0) {
        expect(solution).to.equal(null);
        return;
    }
    expect(solution).not.to.equal(null);
    expect(solution!.placed).to.equal(expected);
    const onTable = new Set<number>();
    solution!.sets.forEach(set => {
        expect(analyzeSet(set), 'valid set ' + set.map(x => x.id)).not.to.equal(null);
        set.forEach(x => {
            expect(onTable.has(x.id)).to.equal(false);
            onTable.add(x.id);
        });
    });
    board.forEach(x => expect(onTable.has(x.id)).to.equal(true));
    expect(onTable.size).to.equal(board.length + expected);
    expect(solution!.placedTiles.length + solution!.remaining.length).to.equal(hand.length);
}

/** random tiles from a small range of values and colors, so that many combinations exist */
function randomTiles(rng: Random, count: number, jokerChance: number): Tile[] {
    const tiles: Tile[] = [];
    while (tiles.length < count) {
        if (rng() < jokerChance && used.size < 106 && !(used.has(JOKER_IDS[0]) && used.has(JOKER_IDS[1]))) {
            tiles.push(j());
            continue;
        }
        const color = Math.floor(rng() * 3);
        const value = 3 + Math.floor(rng() * 5);
        const first = color * 13 + value - 1;
        if (used.has(first) && used.has(first + 52)) continue;
        tiles.push(t(color, value));
    }
    return tiles;
}

/** a few random valid sets (sometimes with a joker) in a small range of values */
function randomBoard(rng: Random): Tile[] {
    const board: Tile[] = [];
    const sets = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < sets; s++) {
        const set: Tile[] = [];
        const start = 2 + Math.floor(rng() * 5);
        const available = (color: number, value: number) => !used.has(color * 13 + value - 1) || !used.has(color * 13 + value + 51);
        if (rng() < 0.5) {
            const color = Math.floor(rng() * 3);
            const length = 3 + Math.floor(rng() * 2);
            for (let v = start; v < start + length; v++) if (available(color, v)) set.push(t(color, v));
        } else {
            for (let c = 0; c < 3 + Math.floor(rng() * 2); c++) if (available(c, start)) set.push(t(c, start));
        }
        if (rng() < 0.2 && !used.has(JOKER_IDS[1])) {
            const pos = Math.floor(rng() * set.length);
            used.delete(set[pos].id);
            set[pos] = j();
        }
        board.push(...set);
    }
    return board;
}

describe('Optimizer', () => {

    beforeEach(() => used.clear());

    it('places a tile at the end of a run', () => {
        const board = [t(RED, 3), t(RED, 4), t(RED, 5)];
        const hand = [t(RED, 6), t(BLUE, 9)];
        const solution = solve(board, hand)!;
        expect(solution.placed).to.equal(1);
        expect(solution.remaining.map(x => x.id)).to.deep.equal([hand[1].id]);
    });

    it('needs to split a run', () => {
        const board = [t(RED, 3), t(RED, 4), t(RED, 5), t(RED, 6), t(RED, 7), t(RED, 8), t(RED, 9)];
        const hand = [t(BLUE, 6), t(BLACK, 6)];
        // red 3-4-5 | red 6 blue 6 black 6 | red 7-8-9
        expect(solve(board, hand)!.placed).to.equal(2);
    });

    it('returns null for an invalid board', () => {
        expect(solve([t(RED, 3), t(RED, 4)], [])).to.equal(null);
    });

    it('uses jokers from the board and the rack', () => {
        const board = [t(RED, 3), j(), t(RED, 5)];
        const hand = [t(RED, 4), t(BLUE, 4), t(BLACK, 4)];
        // red 3-4-5 + joker moves to the group 4 4 J or into the run
        expect(solve(board, hand)!.placed).to.equal(3);
        used.clear();
        const solution = solve([t(BLUE, 1), t(BLUE, 2), t(BLUE, 3)], [j(), t(ORANGE, 11)])!;
        expect(solution.placed).to.equal(1);
    });

    it('matches exhaustive search on random positions', function () {
        this.timeout(60000);
        const rng = createRandom(Number(process.env.SEED || 4711));
        for (let round = 0; round < Number(process.env.ROUNDS || 150); round++) {
            used.clear();
            const board = rng() < 0.8 ? randomBoard(rng) : randomTiles(rng, 3 + Math.floor(rng() * 7), 0.08);
            const hand = randomTiles(rng, 1 + Math.floor(rng() * 6), 0.08);
            checkSolution(board, hand);
        }
        expect(stats.feasible).to.be.greaterThan(100);
    });

    it('is fast on a full rack', function () {
        this.timeout(20000);
        const rng = createRandom(99);
        used.clear();
        // a large board made of runs and groups plus a big rack
        const board: Tile[] = [];
        for (let c = 0; c < 4; c++) for (let v = 1; v <= 13; v++) board.push(t(c, v));
        const hand = [];
        for (let k = 0; k < 14; k++) {
            const c = Math.floor(rng() * 4), v = 1 + Math.floor(rng() * 13);
            const first = c * 13 + v - 1;
            if (used.has(first + 52)) continue;
            hand.push(t(c, v));
        }
        hand.push(j(), j());
        const solution = solve(board, hand)!;
        expect(solution.placed).to.equal(hand.length);
    });
});
