/** Persistence in localStorage. Every access is guarded: storage may be unavailable. */

import { Difficulty, Puzzle } from "../../src/puzzle/Generator.ts";

const PREFIX = "rummy-trainer.";

function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function write(key: string, value: unknown) {
    try {
        if (value === null) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // storage full or blocked: the app keeps working without persistence
    }
}

export interface Settings {
    difficulty: Difficulty;
    sound: boolean;
    seenHelp: boolean;
    /** a shared result includes the time the puzzle took */
    shareTime: boolean;
    /** a shared result includes the total score */
    shareTotal: boolean;
}

/** One finished puzzle. */
export interface HistoryEntry {
    /** finish time (ms since epoch) */
    time: number;
    difficulty: Difficulty;
    seed: number;
    placed: number;
    optimum: number;
    points: number;
    /** invalid checks and "keep trying" rounds */
    penalties: number;
    durationMs: number;
    gaveUp: boolean;
}

/** A puzzle in progress (or just finished). */
export interface SavedGame {
    puzzle: Puzzle;
    sets: number[][];
    rack: number[];
    penalties: number;
    /** when the puzzle was started, moved on by the time the clock stood still */
    startedAt: number;
    /** since when the clock stands still: it does while the page is hidden or closed */
    pausedAt?: number;
    finished: boolean;
}

export const store = {
    settings(): Settings {
        return Object.assign(
            { difficulty: "easy", sound: true, seenHelp: false, shareTime: true, shareTotal: true },
            read<Partial<Settings>>("settings", {}),
        );
    },
    saveSettings(settings: Settings) {
        write("settings", settings);
    },
    history(): HistoryEntry[] {
        const history = read<HistoryEntry[]>("history", []);
        return Array.isArray(history) ? history : [];
    },
    saveHistory(history: HistoryEntry[]) {
        write("history", history);
    },
    game(): SavedGame | null {
        return read<SavedGame | null>("game", null);
    },
    saveGame(game: SavedGame | null) {
        write("game", game);
    },
};
