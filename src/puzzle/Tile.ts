/**
 * Compact tile model used by the puzzle trainer.
 *
 * A full game has two copies of every colored tile (4 colors x 13 values)
 * plus two jokers, 106 tiles in total. Every physical tile has a stable id so
 * that puzzles can be serialized as plain arrays of numbers:
 *
 *   id = copy * 52 + color * 13 + (value - 1)   for colored tiles (0..103)
 *   id = 104, 105                               for the two jokers
 */

export const COLORS = ["red", "blue", "orange", "black"] as const;
export const COLOR_COUNT = 4;
export const MAX_VALUE = 13;
export const CELL_COUNT = COLOR_COUNT * MAX_VALUE;
export const JOKER_IDS = [104, 105];

export interface Tile {
    readonly id: number;
    /** 0..3, -1 for jokers */
    readonly color: number;
    /** 1..13, 0 for jokers */
    readonly value: number;
}

export function isJoker(tile: Tile): boolean {
    return tile.value === 0;
}

export function tileFromId(id: number): Tile {
    if (id >= 2 * CELL_COUNT) return { id, color: -1, value: 0 };
    const rem = id % CELL_COUNT;
    return { id, color: Math.floor(rem / MAX_VALUE), value: (rem % MAX_VALUE) + 1 };
}

export function tilesFromIds(ids: readonly number[]): Tile[] {
    return ids.map(tileFromId);
}

/** Index of the (color, value) cell in value-major order, as used by the optimizer. */
export function cellIndex(color: number, value: number): number {
    return (value - 1) * COLOR_COUNT + color;
}

/** Orders tiles by value, then color; jokers last. */
export function compareTiles(a: Tile, b: Tile): number {
    if (isJoker(a) !== isJoker(b)) return isJoker(a) ? 1 : -1;
    return a.value - b.value || a.color - b.color || a.id - b.id;
}

/** Orders tiles by color, then value; jokers last. */
export function compareTilesByColor(a: Tile, b: Tile): number {
    if (isJoker(a) !== isJoker(b)) return isJoker(a) ? 1 : -1;
    return a.color - b.color || a.value - b.value || a.id - b.id;
}

export function tileToString(tile: Tile): string {
    return isJoker(tile) ? "Joker" : COLORS[tile.color] + " " + tile.value;
}

/** All 106 tiles of a game (or only the colored ones when jokers is 0). */
export function createDeck(jokers = 2): Tile[] {
    const deck: Tile[] = [];
    for (let id = 0; id < 2 * CELL_COUNT; id++) deck.push(tileFromId(id));
    for (let j = 0; j < jokers && j < JOKER_IDS.length; j++) deck.push(tileFromId(JOKER_IDS[j]));
    return deck;
}
