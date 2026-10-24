import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { cheapestMove, depth, directFits, singleFits, smallestStep } from './Analysis.ts';
import { generatePuzzle } from './Generator.ts';
import { solve } from './Optimizer.ts';
import { Tile, tileFromId, tilesFromIds } from './Tile.ts';

const RED = 0, BLUE = 1, ORANGE = 2, BLACK = 3;
const t = (color: number, value: number, copy = 0): Tile => tileFromId(copy * 52 + color * 13 + value - 1);
const run = (color: number, from: number, to: number): Tile[] => {
    const tiles = [];
    for (let v = from; v <= to; v++) tiles.push(t(color, v));
    return tiles;
};

/** the depth by trying every combination of sets to keep */
function depthByBruteForce(board: Tile[][], hand: Tile[], optimum: number): number {
    const n = board.length;
    let best = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
        const rest = ([] as Tile[]).concat(...board.filter((_, i) => !(mask & (1 << i))));
        const solution = solve(rest, hand);
        if (!solution || solution.placed < optimum) continue;
        let kept = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) kept++;
        best = Math.max(best, kept);
    }
    return n - best;
}

describe('Analysis', () => {

    it('finds the tiles that fit without rearranging', () => {
        const board = [run(RED, 3, 5), [t(BLUE, 7), t(ORANGE, 7), t(BLACK, 7)]];
        const hand = [t(RED, 6), t(RED, 7), t(BLUE, 3), t(BLUE, 7, 1)];
        expect(directFits(board, hand).map(x => x.id)).toEqual([hand[0].id, hand[1].id]);
    });

    it('finds the tiles that can be placed alone', () => {
        // blue 6 and black 6 can only be placed together, splitting the run around red 6
        const board = [run(RED, 3, 9)];
        const hand = [t(BLUE, 6), t(BLACK, 6), t(ORANGE, 12)];
        expect(directFits(board, hand)).toEqual([]);
        expect(singleFits(board, hand)).toEqual([]);
        expect(smallestStep(board, hand)).toBe(2);
        expect(singleFits(board, hand.concat(t(RED, 10))).map(x => x.value)).toEqual([10]);
        expect(smallestStep(board, hand.concat(t(RED, 10)))).toBe(1);
        expect(smallestStep([run(RED, 1, 3)], [t(BLUE, 9)])).toBe(4);
    });

    it('finds the cheapest move', () => {
        const board = [run(RED, 3, 6), run(RED, 7, 10), [t(BLUE, 12), t(ORANGE, 12), t(BLACK, 12)]];
        // blue 6 and black 6 go with red 6 after splitting one run: one set changes, but only as a pair
        expect(cheapestMove(board, [t(BLUE, 6), t(BLACK, 6)], 2)).toBe(1);
        expect(cheapestMove(board, [t(BLUE, 6), t(BLACK, 6)], 1)).toBe(2);
        // three ones form a set by themselves
        expect(cheapestMove(board, [t(RED, 1), t(BLUE, 1), t(ORANGE, 1), t(BLACK, 9)])).toBe(0);
        // red 12 can only go into the group, and nothing else can be placed at all
        expect(cheapestMove(board, [t(RED, 12), t(BLACK, 1)])).toBe(1);
        expect(cheapestMove(board, [t(BLACK, 1), t(BLACK, 2)])).toBe(2);
        // blue 7 needs red 7 out of the run, which then needs red 6 out of the other run: two sets
        expect(cheapestMove(board, [t(BLUE, 7), t(BLACK, 7, 1)], 1)).toBe(2);
        expect(cheapestMove(board, [t(BLUE, 7), t(BLACK, 7)], 2)).toBe(1);
    });

    it('counts the sets that every optimal solution changes', () => {
        // the pairs of sixes and sevens each need the red tile out of a run
        const board = [run(RED, 3, 6), run(RED, 7, 10), [t(BLUE, 12), t(ORANGE, 12), t(BLACK, 12)]];
        const hand = [t(BLUE, 6), t(BLACK, 6), t(BLUE, 7), t(BLACK, 7)];
        expect(solve(board.flat(), hand)!.placed).toBe(4);
        expect(depth(board, hand, 4)).toBe(2);
        expect(depth(board, hand, 2)).toBe(1);
        // a set formed by rack tiles alone changes nothing
        expect(depth(board, [t(RED, 12), t(BLUE, 12, 1), t(ORANGE, 12, 1)], 3)).toBe(0);
        // stop early: only "fewer than 2" is certain
        expect(depth(board, hand, 2, { atLeast: 2 })).toBeLessThan(2);
    });

    it('matches a brute-force search on generated puzzles', () => {
        for (let seed = 1; seed <= 12; seed++) {
            const puzzle = generatePuzzle(seed * 101, seed % 2 ? 'easy' : 'medium');
            const board = puzzle.board.map(tilesFromIds);
            const hand = tilesFromIds(puzzle.hand);
            expect(depth(board, hand, puzzle.optimum)).toBe(depthByBruteForce(board, hand, puzzle.optimum));
        }
    });
});
