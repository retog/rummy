import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { generatePuzzle, DIFFICULTIES } from './Generator.ts';
import { analyzeSet } from './Rules.ts';
import { solve } from './Optimizer.ts';
import { tilesFromIds } from './Tile.ts';

describe('Generator', () => {

    it('is deterministic', () => {
        expect(generatePuzzle(1234, 'medium')).toEqual(generatePuzzle(1234, 'medium'));
    });

    DIFFICULTIES.forEach(difficulty => {
        it('creates consistent ' + difficulty + ' puzzles', function () {
            for (let seed = 1; seed <= 15; seed++) {
                const puzzle = generatePuzzle(seed * 7919, difficulty);
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
