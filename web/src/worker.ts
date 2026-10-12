/** Generates puzzles off the main thread. */

import { generatePuzzle, Difficulty } from "../../src/puzzle/Generator";

interface Request {
    id: number;
    seed: number;
    difficulty: Difficulty;
}

self.onmessage = (event: MessageEvent<Request>) => {
    const { id, seed, difficulty } = event.data;
    try {
        (self as unknown as Worker).postMessage({ id, puzzle: generatePuzzle(seed, difficulty) });
    } catch (e) {
        (self as unknown as Worker).postMessage({ id, error: String(e) });
    }
};
