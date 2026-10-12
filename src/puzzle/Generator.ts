import { Tile, tileFromId, isJoker, compareTiles, CELL_COUNT, COLOR_COUNT, MAX_VALUE, JOKER_IDS, cellIndex } from "./Tile";
import { analyzeSet } from "./Rules";
import { solve, SOLVER_BUDGET_EXCEEDED } from "./Optimizer";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** A training puzzle. Tiles are referenced by their id (see Tile.ts). */
export interface Puzzle {
    seed: number;
    difficulty: Difficulty;
    /** the sets on the table at the start */
    board: number[][];
    /** the tiles on the rack */
    hand: number[];
    /** the maximal number of rack tiles that can be placed */
    optimum: number;
    /** a table that places `optimum` rack tiles */
    solution: number[][];
}

interface Profile {
    sets: [number, number];
    hidden: [number, number];
    distractors: [number, number];
    jokers: number;
    jokerChance: number;
    /** how many hidden tiles may simply be appended to the set they were taken from */
    maxTrivial: number;
}

const PROFILES: { [d in Difficulty]: Profile } = {
    easy: { sets: [3, 4], hidden: [2, 2], distractors: [2, 2], jokers: 0, jokerChance: 0, maxTrivial: 2 },
    medium: { sets: [5, 6], hidden: [3, 3], distractors: [3, 3], jokers: 1, jokerChance: 0.5, maxTrivial: 1 },
    hard: { sets: [7, 8], hidden: [4, 5], distractors: [3, 4], jokers: 2, jokerChance: 0.7, maxTrivial: 0 },
};

const RUN_LENGTHS = [3, 3, 3, 4, 4, 5, 6];
const GENERATOR_MAX_STATES = 400000;

export type Random = () => number;

/** Small seedable PRNG (mulberry32). */
export function createRandom(seed: number): Random {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomInt(rng: Random, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(rng: Random, items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
    }
    return items;
}

/** The tiles not yet used in a puzzle. */
class Pool {
    cells: Tile[][] = [];
    jokers: Tile[] = [];

    constructor(jokers: number) {
        for (let i = 0; i < CELL_COUNT; i++) this.cells.push([]);
        for (let id = 0; id < 2 * CELL_COUNT; id++) this.put(tileFromId(id));
        for (let j = 0; j < jokers; j++) this.put(tileFromId(JOKER_IDS[j]));
    }

    take(color: number, value: number): Tile | undefined {
        return this.cells[cellIndex(color, value)].pop();
    }

    put(tile: Tile) {
        if (isJoker(tile)) this.jokers.push(tile);
        else this.cells[cellIndex(tile.color, tile.value)].push(tile);
    }

    takeRandom(rng: Random): Tile | undefined {
        const available = this.cells.filter(c => c.length > 0);
        if (available.length === 0) return undefined;
        return available[Math.floor(rng() * available.length)].pop();
    }
}

function randomRun(rng: Random, pool: Pool): Tile[] | null {
    const length = RUN_LENGTHS[Math.floor(rng() * RUN_LENGTHS.length)];
    const color = Math.floor(rng() * COLOR_COUNT);
    const start = randomInt(rng, 1, MAX_VALUE - length + 1);
    const tiles: Tile[] = [];
    for (let v = start; v < start + length; v++) {
        const tile = pool.take(color, v);
        if (!tile) {
            tiles.forEach(t => pool.put(t));
            return null;
        }
        tiles.push(tile);
    }
    return tiles;
}

function randomGroup(rng: Random, pool: Pool): Tile[] | null {
    const value = randomInt(rng, 1, MAX_VALUE);
    const size = rng() < 0.55 ? 3 : 4;
    const colors = shuffle(rng, [0, 1, 2, 3]).slice(0, size);
    const tiles: Tile[] = [];
    for (const color of colors) {
        const tile = pool.take(color, value);
        if (!tile) {
            tiles.forEach(t => pool.put(t));
            return null;
        }
        tiles.push(tile);
    }
    return tiles;
}

function flatten(sets: Tile[][]): Tile[] {
    return ([] as Tile[]).concat(...sets);
}

function isBudgetError(e: unknown): boolean {
    return e instanceof Error && e.name === SOLVER_BUDGET_EXCEEDED;
}

function tryGenerate(rng: Random, profile: Profile): { board: Tile[][]; hand: Tile[] } | null {
    const pool = new Pool(profile.jokers);

    // 1. a random valid table
    const target = randomInt(rng, profile.sets[0], profile.sets[1]);
    const sets: Tile[][] = [];
    for (let tries = 0; sets.length < target && tries < 200; tries++) {
        const set = rng() < 0.5 ? randomRun(rng, pool) : randomGroup(rng, pool);
        if (set) sets.push(set);
    }
    if (sets.length < target) return null;

    // 2. let jokers stand in for some tiles
    for (let j = 0; j < profile.jokers; j++) {
        if (rng() >= profile.jokerChance || pool.jokers.length === 0) continue;
        const set = sets[Math.floor(rng() * sets.length)];
        const pos = Math.floor(rng() * set.length);
        if (isJoker(set[pos])) continue;
        pool.put(set[pos]);
        set[pos] = pool.jokers.pop() as Tile;
    }

    // 3. take tiles from the table so that the rest can still be rearranged into valid sets
    const hiddenCount = randomInt(rng, profile.hidden[0], profile.hidden[1]);
    const candidates: [number, Tile][] = [];
    sets.forEach((set, s) => set.forEach(t => {
        if (!isJoker(t)) candidates.push([s, t]);
    }));
    shuffle(rng, candidates);
    const hidden: Tile[] = [];
    let trivialCount = 0;
    for (let pass = 0; pass < 2; pass++) {
        for (const [s, tile] of candidates) {
            if (hidden.length >= hiddenCount) break;
            const pos = sets[s].indexOf(tile);
            if (pos < 0) continue;
            const rest = sets[s].filter(t => t !== tile);
            const trivial = analyzeSet(rest) !== null;
            if (pass === 0 && trivial) continue;
            if (pass === 1 && (!trivial || trivialCount >= profile.maxTrivial)) continue;
            const before = sets[s];
            sets[s] = rest;
            let feasible = false;
            try {
                feasible = solve(flatten(sets), [], { maxStates: GENERATOR_MAX_STATES }) !== null;
            } catch (e) {
                if (!isBudgetError(e)) throw e;
            }
            if (feasible) {
                hidden.push(tile);
                if (trivial) trivialCount++;
            } else {
                sets[s] = before;
            }
        }
    }
    if (hidden.length < hiddenCount) return null;

    // 4. the board as the players sees it: a fresh arrangement of the remaining tiles
    const boardTiles = flatten(sets);
    const arranged = solve(boardTiles, [], { maxStates: GENERATOR_MAX_STATES });
    if (!arranged) return null;

    // 5. some tiles that might or might not fit
    const distractors: Tile[] = [];
    const distractorCount = randomInt(rng, profile.distractors[0], profile.distractors[1]);
    for (let d = 0; d < distractorCount; d++) {
        const tile = pool.takeRandom(rng);
        if (tile) distractors.push(tile);
    }
    return {
        board: shuffle(rng, arranged.sets),
        hand: hidden.concat(distractors).sort(compareTiles),
    };
}

function ids(tiles: Tile[]): number[] {
    return tiles.map(t => t.id);
}

/** Generates a puzzle; the same seed and difficulty always produce the same puzzle. */
export function generatePuzzle(seed: number, difficulty: Difficulty): Puzzle {
    const profile = PROFILES[difficulty];
    const rng = createRandom(seed);
    for (let attempt = 0; attempt < 100; attempt++) {
        const generated = tryGenerate(rng, profile);
        if (!generated) continue;
        let solution;
        try {
            solution = solve(flatten(generated.board), generated.hand);
        } catch (e) {
            if (isBudgetError(e)) continue;
            throw e;
        }
        if (!solution || solution.placed === 0) continue;
        return {
            seed,
            difficulty,
            board: generated.board.map(set => ids(orderForDisplay(set))),
            hand: ids(generated.hand),
            optimum: solution.placed,
            solution: solution.sets.map(set => ids(orderForDisplay(set))),
        };
    }
    throw new Error("Could not generate a puzzle for seed " + seed);
}

/** Orders the tiles of a set as they would lie on the table. */
export function orderForDisplay(set: Tile[]): Tile[] {
    const meld = analyzeSet(set);
    return meld ? meld.tiles : set.slice().sort(compareTiles);
}
