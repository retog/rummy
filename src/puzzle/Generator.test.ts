import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { generatePuzzle, DIFFICULTIES, Difficulty, Puzzle } from './Generator.ts';
import { analyzeSet } from './Rules.ts';
import { solve } from './Optimizer.ts';
import { tilesFromIds } from './Tile.ts';
import { cheapestMove, depth, directFits } from './Analysis.ts';

/** extreme puzzles take a while to generate, so fewer of them are checked, and only once */
const SEEDS: { [d in Difficulty]: number } = { easy: 15, medium: 15, hard: 15, extreme: 4 };
const cache = new Map<string, Puzzle>();
function puzzle(seed: number, difficulty: Difficulty): Puzzle {
    const key = difficulty + seed;
    if (!cache.has(key)) cache.set(key, generatePuzzle(seed, difficulty));
    return cache.get(key) as Puzzle;
}

describe('Generator', () => {

    it('is deterministic', () => {
        expect(generatePuzzle(1234, 'medium')).toEqual(generatePuzzle(1234, 'medium'));
    });

    it('makes extreme puzzles that need deep rearranging', () => {
        for (let seed = 1; seed <= SEEDS.extreme; seed++) {
            const p = puzzle(seed * 7919, 'extreme');
            const board = p.board.map(tilesFromIds);
            const hand = tilesFromIds(p.hand);
            expect(p.board.length).toBeGreaterThanOrEqual(7);
            expect(p.hand.length).toBeGreaterThanOrEqual(8);
            expect(p.optimum).toBeGreaterThanOrEqual(5);
            // nothing fits without rearranging
            expect(directFits(board, hand)).toEqual([]);
            // no rack tiles form a set by themselves, and placing any single tile changes at least two sets
            expect(cheapestMove(board, hand, 1)).toBe(2);
            // every optimal solution changes at least five sets
            expect(p.depth).toBeGreaterThanOrEqual(5);
            expect(depth(board, hand, p.optimum)).toBe(p.depth);
        }
    });

    DIFFICULTIES.forEach(difficulty => {
        it('creates consistent ' + difficulty + ' puzzles', function () {
            for (let seed = 1; seed <= SEEDS[difficulty]; seed++) {
                const puzzle = difficulty === 'extreme' ? cache.get(difficulty + seed * 7919) || generatePuzzle(seed * 7919, difficulty) : generatePuzzle(seed * 7919, difficulty);
                const all = ([] as number[]).concat(...puzzle.board, puzzle.hand);
                expect(new Set(all).size, 'unique tiles').toBe(all.length);
                puzzle.board.forEach(set => expect(analyzeSet(tilesFromIds(set))).not.toBe(null));
                puzzle.solution.forEach(set => expect(analyzeSet(tilesFromIds(set))).not.toBe(null));
                expect(puzzle.optimum).toBeGreaterThan(0);
                const solution = solve(tilesFromIds(([] as number[]).concat(...puzzle.board)), tilesFromIds(puzzle.hand))!;
                expect(solution.placed).toBe(puzzle.optimum);
            }
        });
    });
});
