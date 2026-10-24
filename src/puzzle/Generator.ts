import { Tile, tileFromId, isJoker, compareTiles, CELL_COUNT, COLOR_COUNT, MAX_VALUE, JOKER_IDS, cellIndex } from "./Tile.ts";
import { analyzeSet } from "./Rules.ts";
import { solve, Solution, SOLVER_BUDGET_EXCEEDED } from "./Optimizer.ts";
import { cheapestMove, depth, directFits } from "./Analysis.ts";

export type Difficulty = "easy" | "medium" | "hard" | "extreme";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extreme"];

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
    /** the number of sets on the table that every optimal solution changes (extreme puzzles only) */
    depth?: number;
}

/**
 * What makes extreme puzzles extreme. The table is arranged so that no hidden tile fits
 * into a set as it is, the distractors are decoys that look like they fit but can't be
 * placed on their own, no rack tiles form a set by themselves, and a puzzle is only accepted
 * if placing up to `moveTiles` rack tiles changes at least `minFirstMove` sets and every
 * optimal solution changes at least `minDepth`.
 */
interface Hardening {
    minDepth: number;
    minFirstMove: number;
    /** moves of up to this many tiles are examined for `minFirstMove` */
    moveTiles: number;
    /** feasibility checks to spend on hiding tiles before a table is given up */
    maxHideChecks: number;
    /** solver states a feasibility check may visit while hiding tiles and choosing decoys */
    checkBudget: number;
}

interface Profile {
    sets: [number, number];
    hidden: [number, number];
    distractors: [number, number];
    jokers: number;
    jokerChance: number;
    /** how many hidden tiles may simply be appended to the set they were taken from */
    maxTrivial: number;
    hardening?: Hardening;
}

const PROFILES: { [d in Difficulty]: Profile } = {
    easy: { sets: [3, 4], hidden: [2, 2], distractors: [2, 2], jokers: 0, jokerChance: 0, maxTrivial: 2 },
    medium: { sets: [5, 6], hidden: [3, 3], distractors: [3, 3], jokers: 1, jokerChance: 0.5, maxTrivial: 1 },
    hard: { sets: [7, 8], hidden: [4, 5], distractors: [3, 4], jokers: 2, jokerChance: 0.7, maxTrivial: 0 },
    extreme: {
        sets: [8, 10], hidden: [5, 7], distractors: [3, 4], jokers: 2, jokerChance: 0.8, maxTrivial: 0,
        hardening: { minDepth: 5, minFirstMove: 2, moveTiles: 1, maxHideChecks: 40, checkBudget: 400000 },
    },
};

const RUN_LENGTHS = [3, 3, 3, 4, 4, 5, 6];
const GENERATOR_MAX_STATES = 400000;
const SOLVER_OPTIONS = { maxStates: GENERATOR_MAX_STATES };

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

    /** one colored tile of every kind that is still available */
    available(): Tile[] {
        return this.cells.filter(c => c.length > 0).map(c => c[c.length - 1]);
    }

    remove(tile: Tile) {
        const cell = this.cells[cellIndex(tile.color, tile.value)];
        cell.splice(cell.indexOf(tile), 1);
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

/**
 * Arranges the tiles into valid sets that none of the `noRoomFor` tiles fits into.
 * @returns the sets, or null if that is impossible (or not found within the budget)
 */
function arrange(tiles: Tile[], noRoomFor: Tile[], maxStates: number): Tile[][] | null {
    try {
        const solution = solve(tiles, [], { maxStates, noRoomFor });
        return solution ? solution.sets : null;
    } catch (e) {
        if (isBudgetError(e)) return null;
        throw e;
    }
}

/** True if the tile can be placed on the table on its own (rearranging as needed), or if that is unclear. */
function placeableAlone(boardTiles: Tile[], tile: Tile, maxStates: number): boolean {
    try {
        const solution = solve(boardTiles, [tile], { maxStates });
        return solution !== null && solution.placed === 1;
    } catch (e) {
        if (isBudgetError(e)) return true;
        throw e;
    }
}

/** True if the tile has the value of a group on the table or is close to the end of a run of its color. */
function looksLikeFit(board: Tile[][], tile: Tile): boolean {
    return board.some(set => {
        const meld = analyzeSet(set);
        if (!meld) return false;
        if (meld.kind === "group") return meld.values[0] === tile.value;
        const real = set.find(t => !isJoker(t));
        if (!real || real.color !== tile.color) return false;
        const low = meld.values[0];
        const high = meld.values[meld.values.length - 1];
        return Math.abs(tile.value - low) <= 2 || Math.abs(tile.value - high) <= 2;
    });
}

interface Hidden {
    hidden: Tile[];
    /** the remaining tiles arranged into valid sets */
    arrangement: Tile[][];
}

/**
 * Takes `count` tiles from the sets so that the rest can still be rearranged into valid sets,
 * trying the candidates in order. At most `profile.maxTrivial` of them may leave their set valid.
 */
function hide(sets: Tile[][], candidates: [number, Tile][], count: number, profile: Profile): Hidden | null {
    const hidden: Tile[] = [];
    let arrangement: Tile[][] | null = null;
    let trivialCount = 0;
    for (let pass = 0; pass < 2; pass++) {
        for (const [s, tile] of candidates) {
            if (hidden.length >= count) break;
            if (!sets[s].includes(tile)) continue;
            const rest = sets[s].filter(t => t !== tile);
            const trivial = analyzeSet(rest) !== null;
            if (pass === 0 && trivial) continue;
            if (pass === 1 && (!trivial || trivialCount >= profile.maxTrivial)) continue;
            const before = sets[s];
            sets[s] = rest;
            const arranged = arrange(flatten(sets), [], GENERATOR_MAX_STATES);
            if (arranged) {
                hidden.push(tile);
                arrangement = arranged;
                if (trivial) trivialCount++;
            } else {
                sets[s] = before;
            }
        }
    }
    return hidden.length >= count && arrangement ? { hidden, arrangement } : null;
}

/**
 * How promising it is to hide the tile so that the rest of the table can be arranged with no
 * room for it (lower is better): a run of its color ending next to it would offer room, so
 * neighbours on the table are bad, unless the tile's other copy is there to seal the gap; a
 * complete set of its value could become a group with room, and a set that already lost a
 * tile is easier to dissolve further.
 */
function hidePriority(tile: Tile, table: Tile[], setBroken: boolean): number {
    let neighbours = 0;
    let copies = 0;
    let sameValue = 0;
    for (const t of table) {
        if (t.color === tile.color) {
            if (Math.abs(t.value - tile.value) === 1) neighbours++;
            else if (t.value === tile.value && t !== tile) copies++;
        } else if (t.value === tile.value) {
            sameValue++;
        }
    }
    return (copies === 0 ? 2 : 0) + Math.min(neighbours, 2) + (sameValue >= 3 ? 1 : 0) - (setBroken ? 1 : 0);
}

/** True if the tile forms a valid set together with some of the others. */
function formsSetWith(tile: Tile, others: readonly Tile[]): boolean {
    const chosen = [tile];
    const next = (from: number): boolean => {
        if (chosen.length >= 3 && analyzeSet(chosen) !== null) return true;
        for (let i = from; i < others.length && chosen.length < COLOR_COUNT; i++) {
            chosen.push(others[i]);
            if (next(i + 1)) return true;
            chosen.pop();
        }
        return false;
    };
    return next(0);
}

/**
 * Takes up to `count` tiles (at least `profile.hidden[0]`) from the sets so that the rest can
 * be arranged into valid sets none of the hidden tiles fits into, and so that the hidden tiles
 * don't form a set among themselves. The most promising candidates are tried first; the number
 * of feasibility checks is limited.
 */
function hideSealed(sets: Tile[][], candidates: [number, Tile][], count: number, profile: Profile, hardening: Hardening): Hidden | null {
    const hidden: Tile[] = [];
    const broken = new Set<number>();
    let arrangement: Tile[][] | null = null;
    let checks = 0;
    while (hidden.length < count && checks < hardening.maxHideChecks && candidates.length > 0) {
        const table = flatten(sets);
        let best = 0;
        let bestPriority = Infinity;
        candidates.forEach(([s, tile], k) => {
            const priority = hidePriority(tile, table, broken.has(s));
            if (priority < bestPriority) {
                bestPriority = priority;
                best = k;
            }
        });
        const [s, tile] = candidates.splice(best, 1)[0];
        const rest = sets[s].filter(t => t !== tile);
        if (analyzeSet(rest) !== null) continue; // appending the tile again would be too easy
        if (formsSetWith(tile, hidden)) continue; // the rack must not hold a ready-made set
        const before = sets[s];
        sets[s] = rest;
        checks++;
        const arranged = arrange(flatten(sets), hidden.concat(tile), hardening.checkBudget);
        if (arranged) {
            hidden.push(tile);
            broken.add(s);
            arrangement = arranged;
        } else {
            sets[s] = before;
        }
    }
    return hidden.length >= profile.hidden[0] && arrangement ? { hidden, arrangement } : null;
}

function tryGenerate(rng: Random, profile: Profile): { board: Tile[][]; hand: Tile[] } | null {
    const pool = new Pool(profile.jokers);
    const hardening = profile.hardening;

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
    const taken = hardening
        ? hideSealed(sets, candidates, hiddenCount, profile, hardening)
        : hide(sets, candidates, hiddenCount, profile);
    if (!taken) return null;
    const { hidden, arrangement } = taken;

    // 4. the board as the player sees it: a fresh arrangement of the remaining tiles
    //    (the one found by the last feasibility check)
    const boardTiles = flatten(sets);

    // 5. some tiles that might or might not fit
    const distractors: Tile[] = [];
    const distractorCount = randomInt(rng, profile.distractors[0], profile.distractors[1]);
    if (hardening) {
        // decoys: they look like they fit, but don't fit a set as it is and preferably can't be
        // placed on their own either (when they can, the first-move check decides later)
        const options = shuffle(rng, pool.available());
        const near = new Set(options.filter(t => looksLikeFit(arrangement, t)));
        options.sort((a, b) => Number(near.has(b)) - Number(near.has(a)));
        const fallback: Tile[] = [];
        for (const tile of options) {
            if (distractors.length >= distractorCount) break;
            if (directFits(arrangement, [tile]).length > 0 || formsSetWith(tile, hidden.concat(distractors))) continue;
            if (placeableAlone(boardTiles, tile, hardening.checkBudget)) fallback.push(tile);
            else distractors.push(tile);
        }
        while (distractors.length < distractorCount && fallback.length > 0) {
            const tile = fallback.shift() as Tile;
            if (!formsSetWith(tile, hidden.concat(distractors))) distractors.push(tile);
        }
        distractors.forEach(tile => pool.remove(tile));
        if (distractors.length < distractorCount) return null;
    } else {
        for (let d = 0; d < distractorCount; d++) {
            const tile = pool.takeRandom(rng);
            if (tile) distractors.push(tile);
        }
    }
    return {
        board: shuffle(rng, arrangement),
        hand: hidden.concat(distractors).sort(compareTiles),
    };
}

/**
 * Checks the hardening requirements.
 * @returns the depth of the puzzle, or undefined if it is not hard enough
 */
function hardness(board: Tile[][], hand: Tile[], optimum: number, hardening: Hardening): number | undefined {
    const d = depth(board, hand, optimum, { ...SOLVER_OPTIONS, atLeast: hardening.minDepth });
    if (d < hardening.minDepth) return undefined;
    if (cheapestMove(board, hand, hardening.moveTiles, SOLVER_OPTIONS) < hardening.minFirstMove) return undefined;
    return d;
}

function ids(tiles: Tile[]): number[] {
    return tiles.map(t => t.id);
}

/** Generates a puzzle; the same seed and difficulty always produce the same puzzle. */
export function generatePuzzle(seed: number, difficulty: Difficulty): Puzzle {
    const profile = PROFILES[difficulty];
    const rng = createRandom(seed);
    const attempts = profile.hardening ? 1000 : 100;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const generated = tryGenerate(rng, profile);
        if (!generated) continue;
        let solution: Solution | null;
        let puzzleDepth: number | undefined;
        try {
            solution = solve(flatten(generated.board), generated.hand);
            if (!solution || solution.placed === 0) continue;
            if (profile.hardening) {
                puzzleDepth = hardness(generated.board, generated.hand, solution.placed, profile.hardening);
                if (puzzleDepth === undefined) continue;
            }
        } catch (e) {
            if (isBudgetError(e)) continue;
            throw e;
        }
        const puzzle: Puzzle = {
            seed,
            difficulty,
            board: generated.board.map(set => ids(orderForDisplay(set))),
            hand: ids(generated.hand),
            optimum: solution.placed,
            solution: solution.sets.map(set => ids(orderForDisplay(set))),
        };
        if (puzzleDepth !== undefined) puzzle.depth = puzzleDepth;
        return puzzle;
    }
    throw new Error("Could not generate a puzzle for seed " + seed);
}

/** Orders the tiles of a set as they would lie on the table. */
export function orderForDisplay(set: Tile[]): Tile[] {
    const meld = analyzeSet(set);
    return meld ? meld.tiles : set.slice().sort(compareTiles);
}
