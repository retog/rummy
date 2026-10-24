/**
 * Measures how hard a puzzle is, using the optimizer as an oracle.
 *
 * All measures are exact: they say what is true for every optimal solution of
 * the puzzle, not just for the one the generator happens to know.
 */

import { Tile, COLOR_COUNT } from "./Tile.ts";
import { analyzeSet } from "./Rules.ts";
import { solve, SolveOptions } from "./Optimizer.ts";

export type Board = readonly (readonly Tile[])[];

function flatten(sets: Board, skip?: ReadonlySet<number>): Tile[] {
    const tiles: Tile[] = [];
    sets.forEach((set, i) => {
        if (!skip || !skip.has(i)) tiles.push(...set);
    });
    return tiles;
}

/** The rack tiles that fit into a set on the table as it is (no rearranging needed). */
export function directFits(board: Board, hand: readonly Tile[]): Tile[] {
    return hand.filter(t => board.some(set => analyzeSet(set.concat(t)) !== null));
}

/** The rack tiles that can be placed on their own, with the table rearranged in any way. */
export function singleFits(board: Board, hand: readonly Tile[], options: SolveOptions = {}): Tile[] {
    const tiles = flatten(board);
    return hand.filter(t => {
        const solution = solve(tiles, [t], options);
        return solution !== null && solution.placed === 1;
    });
}

/**
 * The smallest number of rack tiles that can be placed together: 1 if some tile can be
 * placed on its own, 2 if only pairs work, and so on. Subsets are examined up to `limit`
 * tiles; the result is limit + 1 if none of them can be placed.
 */
export function smallestStep(board: Board, hand: readonly Tile[], limit = 3, options: SolveOptions = {}): number {
    const tiles = flatten(board);
    const n = hand.length;
    for (let size = 1; size <= Math.min(limit, n); size++) {
        const chosen: Tile[] = [];
        const found = (from: number): boolean => {
            if (chosen.length === size) {
                const solution = solve(tiles, chosen, options);
                return solution !== null && solution.placed === size;
            }
            for (let i = from; i <= n - (size - chosen.length); i++) {
                chosen.push(hand[i]);
                if (found(i + 1)) return true;
                chosen.pop();
            }
            return false;
        };
        if (found(0)) return size;
    }
    return limit + 1;
}

/** Calls `visit` with every combination of up to `size` tiles until it returns true. */
function combinations(tiles: readonly Tile[], size: number, visit: (chosen: Tile[]) => boolean): boolean {
    const chosen: Tile[] = [];
    const next = (from: number): boolean => {
        if (chosen.length > 0 && visit(chosen)) return true;
        for (let i = from; i < tiles.length && chosen.length < size; i++) {
            chosen.push(tiles[i]);
            if (next(i + 1)) return true;
            chosen.pop();
        }
        return false;
    };
    return next(0);
}

/**
 * The fewest sets on the table that a cheap move changes: 0 if some rack tiles form a set by
 * themselves, 1 if up to `maxTiles` rack tiles can be placed by taking apart a single set.
 * Other moves are not examined: the result is then 2.
 */
export function cheapestMove(board: Board, hand: readonly Tile[], maxTiles = 1, options: SolveOptions = {}): number {
    if (combinations(hand, COLOR_COUNT, chosen => chosen.length >= 3 && analyzeSet(chosen) !== null)) return 0;
    const single = combinations(hand, maxTiles, chosen => board.some(set => {
        const solution = solve(set, chosen, options);
        return solution !== null && solution.placed === chosen.length;
    }));
    return single ? 1 : 2;
}

export interface DepthOptions extends SolveOptions {
    /**
     * Stop as soon as it is clear that fewer than this many sets have to change. The
     * returned depth is then exact only if it is at least `atLeast`.
     */
    atLeast?: number;
}

/**
 * The number of sets on the table that every optimal solution changes: the complement
 * of the largest group of sets that can stay exactly as they are while `optimum` rack
 * tiles are still placed.
 *
 * Keeping a set means its tiles are not available for rearranging, so a group of sets
 * that can be kept together can also be kept in part. This lets the search prune:
 * sets are added one by one, and a group that already fails is never extended.
 */
export function depth(board: Board, hand: readonly Tile[], optimum: number, options: DepthOptions = {}): number {
    const n = board.length;
    const limit = options.atLeast === undefined ? n + 1 : n - options.atLeast + 1;
    const kept = new Set<number>();
    let best = 0;

    function feasible(): boolean {
        const solution = solve(flatten(board, kept), hand, options);
        return solution !== null && solution.placed >= optimum;
    }

    function search(from: number) {
        if (kept.size > best) best = kept.size;
        for (let i = from; i < n && best < limit; i++) {
            if (kept.size + (n - i) <= best) return;
            kept.add(i);
            if (feasible()) search(i + 1);
            kept.delete(i);
        }
    }

    search(0);
    return n - best;
}
