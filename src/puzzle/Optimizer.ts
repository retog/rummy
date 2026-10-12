import { Tile, isJoker, CELL_COUNT, COLOR_COUNT, MAX_VALUE, cellIndex } from "./Tile.ts";

/** The best possible table for a board and a rack. */
export interface Solution {
    /** number of rack tiles that are placed on the table */
    placed: number;
    /** the complete table: all board tiles plus the placed rack tiles */
    sets: Tile[][];
    /** rack tiles that are placed on the table */
    placedTiles: Tile[];
    /** rack tiles that could not be placed */
    remaining: Tile[];
}

export interface SolveOptions {
    /** abort with a SolverBudgetExceeded error after visiting this many states */
    maxStates?: number;
}

export const SOLVER_BUDGET_EXCEEDED = "SolverBudgetExceeded";

const NEG = -1e9;
const DEFAULT_MAX_STATES = 3000000;

interface Move {
    /** consumed cells, encoded as cell * 2 + (fromHand ? 1 : 0) */
    slots: number[];
    boardJokers: number;
    handJokers: number;
}

/** marks that the lowest rack tile is left on the rack */
const SKIP: Move = { slots: [], boardJokers: 0, handJokers: 0 };

/**
 * Finds a table that contains all board tiles and as many rack tiles as possible.
 *
 * The search always takes the lowest remaining tile (by value, then color) and
 * either leaves it on the rack (rack tiles only) or enumerates every run and
 * group in which it is the lowest real tile. Tiles of the same color and value
 * are interchangeable, so the state is just the count of board and rack copies
 * per (color, value) plus the jokers, which makes memoization very effective.
 * When copies from the board and from the rack are both available, a set always
 * takes the board copy first, which never loses solutions.
 *
 * @returns the optimal table, or null if the board tiles alone can't form a valid table
 */
export function solve(board: readonly Tile[], hand: readonly Tile[], options: SolveOptions = {}): Solution | null {
    const maxStates = options.maxStates || DEFAULT_MAX_STATES;
    const b = new Int8Array(CELL_COUNT);
    const h = new Int8Array(CELL_COUNT);
    let bj = 0;
    let hj = 0;
    let handCount = 0;
    for (const t of board) {
        if (isJoker(t)) bj++;
        else b[cellIndex(t.color, t.value)]++;
    }
    for (const t of hand) {
        if (isJoker(t)) hj++;
        else h[cellIndex(t.color, t.value)]++;
        handCount++;
    }

    const memo = new Map<string, number>();
    const moves = new Map<string, Move>();
    const codes: number[] = [];

    function key(from: number): string {
        codes.length = 0;
        for (let i = from; i < CELL_COUNT; i++) codes.push(48 + b[i] * 3 + h[i]);
        codes.push(48 + bj * 3 + hj);
        return String.fromCharCode.apply(null, codes);
    }

    function lowest(from: number): number {
        let i = from;
        while (i < CELL_COUNT && b[i] === 0 && h[i] === 0) i++;
        return i;
    }

    function search(from: number): number {
        const i = lowest(from);
        if (i === CELL_COUNT) return bj > 0 ? NEG : 0;
        const k = key(i);
        const cached = memo.get(k);
        if (cached !== undefined) return cached;
        if (memo.size >= maxStates) {
            const error = new Error("Solver budget of " + maxStates + " states exceeded");
            error.name = SOLVER_BUDGET_EXCEEDED;
            throw error;
        }

        const bound = handCount;
        const value = Math.floor(i / COLOR_COUNT) + 1;
        const color = i % COLOR_COUNT;
        let best = NEG;
        let bestMove: Move | undefined;
        let done = false;
        const slots: number[] = [];
        let usedBoardJokers = 0;
        let usedHandJokers = 0;

        function take(cell: number): number {
            if (b[cell] > 0) {
                b[cell]--;
                slots.push(cell * 2);
                return 0;
            }
            h[cell]--;
            handCount--;
            slots.push(cell * 2 + 1);
            return 1;
        }

        function untake() {
            const slot = slots.pop() as number;
            const cell = slot >> 1;
            if (slot & 1) {
                h[cell]++;
                handCount++;
            } else {
                b[cell]++;
            }
        }

        /** takes n jokers, board jokers first; returns the number of rack jokers taken */
        function takeJokers(n: number): number {
            const fromBoard = Math.min(bj, n);
            const fromHand = n - fromBoard;
            bj -= fromBoard;
            hj -= fromHand;
            handCount -= fromHand;
            usedBoardJokers += fromBoard;
            usedHandJokers += fromHand;
            return fromHand;
        }

        function giveJokers(n: number, fromHand: number) {
            const fromBoard = n - fromHand;
            bj += fromBoard;
            hj += fromHand;
            handCount += fromHand;
            usedBoardJokers -= fromBoard;
            usedHandJokers -= fromHand;
        }

        function emit(gain: number) {
            const rest = search(i);
            if (rest >= 0 && rest + gain > best) {
                best = rest + gain;
                bestMove = { slots: slots.slice(), boardJokers: usedBoardJokers, handJokers: usedHandJokers };
                if (best === bound) done = true;
            }
        }

        /** runs of `color` starting with the real tile at `value` whose last real tile is at `end` */
        function runs(end: number, gain: number) {
            const length = end - value + 1;
            const room = value - 1 + (MAX_VALUE - end);
            const maxPadding = Math.min(bj + hj, room);
            for (let x = Math.max(0, 3 - length); x <= maxPadding && !done; x++) {
                const fromHand = takeJokers(x);
                emit(gain + fromHand);
                giveJokers(x, fromHand);
            }
            const available = bj + hj;
            for (let gap = 0; gap <= available && !done; gap++) {
                const next = end + 1 + gap;
                if (next > MAX_VALUE) break;
                const cell = cellIndex(color, next);
                if (b[cell] === 0 && h[cell] === 0) continue;
                const fromHand = takeJokers(gap);
                const g = take(cell);
                runs(next, gain + fromHand + g);
                untake();
                giveJokers(gap, fromHand);
            }
        }

        function groups(gain: number) {
            const others: number[] = [];
            for (let c = 0; c < COLOR_COUNT; c++) {
                if (c === color) continue;
                const cell = cellIndex(c, value);
                if (b[cell] > 0 || h[cell] > 0) others.push(cell);
            }
            for (let mask = 0; mask < 1 << others.length && !done; mask++) {
                let g = gain;
                let n = 0;
                for (let o = 0; o < others.length; o++) {
                    if (mask & (1 << o)) {
                        g += take(others[o]);
                        n++;
                    }
                }
                const minJokers = Math.max(0, 2 - n);
                const maxJokers = Math.min(3 - n, bj + hj);
                for (let j = minJokers; j <= maxJokers && !done; j++) {
                    const fromHand = takeJokers(j);
                    emit(g + fromHand);
                    giveJokers(j, fromHand);
                }
                for (let o = 0; o < n; o++) untake();
            }
        }

        // place the lowest tile in a run or group
        const gain = take(i);
        runs(value, gain);
        if (!done) groups(gain);
        untake();

        // or leave it on the rack
        if (!done && b[i] === 0) {
            h[i]--;
            handCount--;
            const rest = search(i);
            h[i]++;
            handCount++;
            if (rest > best) {
                best = rest;
                bestMove = SKIP;
            }
        }

        memo.set(k, best);
        if (bestMove) moves.set(k, bestMove);
        return best;
    }

    const placed = search(0);
    if (placed < 0) return null;

    // replay the best moves, assigning actual tiles
    const boardPool: Tile[][] = [];
    const handPool: Tile[][] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
        boardPool.push([]);
        handPool.push([]);
    }
    const boardJokers: Tile[] = [];
    const handJokers: Tile[] = [];
    for (const t of board) {
        if (isJoker(t)) boardJokers.push(t);
        else boardPool[cellIndex(t.color, t.value)].push(t);
    }
    for (const t of hand) {
        if (isJoker(t)) handJokers.push(t);
        else handPool[cellIndex(t.color, t.value)].push(t);
    }
    const handIds = new Set(hand.map(t => t.id));
    const sets: Tile[][] = [];
    const remaining: Tile[] = [];
    let i = lowest(0);
    while (i < CELL_COUNT) {
        const move = moves.get(key(i)) as Move;
        if (move === SKIP) {
            h[i]--;
            handCount--;
            remaining.push(handPool[i].pop() as Tile);
        } else {
            const set: Tile[] = [];
            for (const slot of move.slots) {
                const cell = slot >> 1;
                if (slot & 1) {
                    h[cell]--;
                    set.push(handPool[cell].pop() as Tile);
                } else {
                    b[cell]--;
                    set.push(boardPool[cell].pop() as Tile);
                }
            }
            for (let j = 0; j < move.boardJokers; j++) set.push(boardJokers.pop() as Tile);
            for (let j = 0; j < move.handJokers; j++) set.push(handJokers.pop() as Tile);
            bj -= move.boardJokers;
            hj -= move.handJokers;
            sets.push(set);
        }
        i = lowest(i);
    }
    remaining.push(...handJokers);
    const placedTiles: Tile[] = [];
    sets.forEach(set => set.forEach(t => {
        if (handIds.has(t.id)) placedTiles.push(t);
    }));
    return { placed, sets, placedTiles, remaining };
}
