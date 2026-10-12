import { expect } from 'chai';
import 'mocha';
import { generatePuzzle, DIFFICULTIES } from './Generator';
import { analyzeSet } from './Rules';
import { solve } from './Optimizer';
import { tilesFromIds } from './Tile';

describe('Generator', () => {

    it('is deterministic', () => {
        expect(generatePuzzle(1234, 'medium')).to.deep.equal(generatePuzzle(1234, 'medium'));
    });

    DIFFICULTIES.forEach(difficulty => {
        it('creates consistent ' + difficulty + ' puzzles', function () {
            this.timeout(60000);
            for (let seed = 1; seed <= 15; seed++) {
                const puzzle = generatePuzzle(seed * 7919, difficulty);
                const all = ([] as number[]).concat(...puzzle.board, puzzle.hand);
                expect(new Set(all).size, 'unique tiles').to.equal(all.length);
                puzzle.board.forEach(set => expect(analyzeSet(tilesFromIds(set))).not.to.equal(null));
                puzzle.solution.forEach(set => expect(analyzeSet(tilesFromIds(set))).not.to.equal(null));
                expect(puzzle.optimum).to.be.greaterThan(0);
                const solution = solve(tilesFromIds(([] as number[]).concat(...puzzle.board)), tilesFromIds(puzzle.hand))!;
                expect(solution.placed).to.equal(puzzle.optimum);
            }
        });
    });
});
