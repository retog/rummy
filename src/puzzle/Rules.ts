import { Tile, isJoker, MAX_VALUE, COLOR_COUNT } from "./Tile.ts";

export type MeldKind = "run" | "group";

/** A valid set on the table, with its tiles in display order. */
export interface Meld {
    kind: MeldKind;
    /** tiles in display order (jokers placed where they stand) */
    tiles: Tile[];
    /** the value each position stands for */
    values: number[];
}

/**
 * Checks whether the tiles form a valid run (same color, consecutive values)
 * or group (same value, distinct colors). Jokers stand in for any tile.
 * @returns the meld in display order, or null if the tiles are not a valid set.
 */
export function analyzeSet(tiles: readonly Tile[]): Meld | null {
    if (tiles.length < 3) return null;
    const jokers = tiles.filter(isJoker);
    const reals = tiles.filter(t => !isJoker(t));
    if (reals.length === 0) return null;
    return asRun(reals, jokers) || asGroup(reals, jokers);
}

function asRun(reals: Tile[], jokers: Tile[]): Meld | null {
    const size = reals.length + jokers.length;
    if (size > MAX_VALUE) return null;
    const color = reals[0].color;
    if (reals.some(t => t.color !== color)) return null;
    const sorted = reals.slice().sort((a, b) => a.value - b.value);
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].value === sorted[i - 1].value) return null;
    }
    const min = sorted[0].value;
    const max = sorted[sorted.length - 1].value;
    // the run covers start .. start + size - 1 and has to contain min .. max
    const lowestStart = Math.max(1, max - size + 1);
    const highestStart = Math.min(min, MAX_VALUE - size + 1);
    if (lowestStart > highestStart) return null;
    // prefer jokers at the end of the run
    const start = highestStart;
    const ordered: Tile[] = [];
    const values: number[] = [];
    let r = 0;
    let j = 0;
    for (let v = start; v < start + size; v++) {
        if (r < sorted.length && sorted[r].value === v) {
            ordered.push(sorted[r++]);
        } else {
            ordered.push(jokers[j++]);
        }
        values.push(v);
    }
    return { kind: "run", tiles: ordered, values };
}

function asGroup(reals: Tile[], jokers: Tile[]): Meld | null {
    const size = reals.length + jokers.length;
    if (size > COLOR_COUNT) return null;
    const value = reals[0].value;
    if (reals.some(t => t.value !== value)) return null;
    const colors = new Set(reals.map(t => t.color));
    if (colors.size !== reals.length) return null;
    const ordered = reals.slice().sort((a, b) => a.color - b.color).concat(jokers);
    return { kind: "group", tiles: ordered, values: ordered.map(() => value) };
}

export interface Evaluation {
    /** true if every set on the table is valid and all board tiles are on the table */
    valid: boolean;
    /** indexes of the sets that are not valid */
    invalidSets: number[];
    /** number of tiles from the rack that are on the table */
    placed: number;
    /** board tiles that are missing on the table */
    missingBoardTiles: number[];
}

/**
 * Evaluates a table arrangement in a puzzle.
 * @param sets the sets on the table as tile arrays
 * @param boardIds ids of the tiles that were on the board initially
 */
export function evaluateArrangement(sets: readonly (readonly Tile[])[], boardIds: readonly number[]): Evaluation {
    const onTable = new Set<number>();
    const invalidSets: number[] = [];
    sets.forEach((set, i) => {
        set.forEach(t => onTable.add(t.id));
        if (!analyzeSet(set)) invalidSets.push(i);
    });
    const board = new Set(boardIds);
    const missingBoardTiles = boardIds.filter(id => !onTable.has(id));
    let placed = 0;
    onTable.forEach(id => {
        if (!board.has(id)) placed++;
    });
    return {
        valid: invalidSets.length === 0 && missingBoardTiles.length === 0,
        invalidSets,
        placed,
        missingBoardTiles,
    };
}
