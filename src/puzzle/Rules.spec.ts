import { expect } from 'chai';
import 'mocha';
import { analyzeSet, evaluateArrangement } from './Rules';
import { Tile, cellIndex } from './Tile';

const RED = 0, BLUE = 1, ORANGE = 2, BLACK = 3;
let nextId = 1000;
const t = (color: number, value: number): Tile => ({ id: nextId++, color, value });
const joker = (): Tile => ({ id: nextId++, color: -1, value: 0 });

describe('Rules.analyzeSet', () => {

    it('accepts runs and groups', () => {
        expect(analyzeSet([t(RED, 3), t(RED, 4), t(RED, 5)])!.kind).to.equal('run');
        expect(analyzeSet([t(RED, 7), t(BLUE, 7), t(BLACK, 7), t(ORANGE, 7)])!.kind).to.equal('group');
    });

    it('rejects short, mixed and duplicate sets', () => {
        expect(analyzeSet([t(RED, 3), t(RED, 4)])).to.equal(null);
        expect(analyzeSet([t(RED, 3), t(BLUE, 4), t(RED, 5)])).to.equal(null);
        expect(analyzeSet([t(RED, 7), t(RED, 7), t(BLUE, 7)])).to.equal(null);
        expect(analyzeSet([t(RED, 3), t(RED, 4), t(RED, 6)])).to.equal(null);
        expect(analyzeSet([t(RED, 12), t(RED, 13), t(RED, 1)])).to.equal(null);
    });

    it('lets jokers fill gaps and ends', () => {
        const meld = analyzeSet([t(RED, 6), joker(), t(RED, 4)])!;
        expect(meld.kind).to.equal('run');
        expect(meld.values).to.deep.equal([4, 5, 6]);
        expect(analyzeSet([t(RED, 12), t(RED, 13), joker()])!.values).to.deep.equal([11, 12, 13]);
        expect(analyzeSet([t(BLUE, 9), t(BLACK, 9), joker()])!.kind).to.equal('group');
        expect(analyzeSet([joker(), joker(), joker()])).to.equal(null);
        expect(analyzeSet([t(BLUE, 9), t(BLACK, 9), t(RED, 9), t(ORANGE, 9), joker()])).to.equal(null);
    });

    it('rejects runs beyond 13', () => {
        const run = [];
        for (let v = 1; v <= 13; v++) run.push(t(BLACK, v));
        expect(analyzeSet(run)).not.to.equal(null);
        expect(analyzeSet(run.concat(joker()))).to.equal(null);
    });
});

describe('Rules.evaluateArrangement', () => {

    it('counts placed rack tiles and finds invalid sets', () => {
        const board = [t(RED, 3), t(RED, 4), t(RED, 5)];
        const rack = [t(RED, 6), t(BLUE, 1)];
        const boardIds = board.map(x => x.id);
        let result = evaluateArrangement([board.concat(rack[0])], boardIds);
        expect(result.valid).to.equal(true);
        expect(result.placed).to.equal(1);
        result = evaluateArrangement([board, [rack[1]]], boardIds);
        expect(result.valid).to.equal(false);
        expect(result.invalidSets).to.deep.equal([1]);
        result = evaluateArrangement([board.slice(0, 2)], boardIds);
        expect(result.valid).to.equal(false);
        expect(result.missingBoardTiles).to.deep.equal([board[2].id]);
    });
});

describe('Tile.cellIndex', () => {
    it('is value-major', () => {
        expect(cellIndex(RED, 1)).to.equal(0);
        expect(cellIndex(BLACK, 1)).to.equal(3);
        expect(cellIndex(RED, 2)).to.equal(4);
    });
});
