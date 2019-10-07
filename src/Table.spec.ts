import { Piece } from './Piece';
import { expect } from 'chai';
import 'mocha';
import { Table } from './Table';


describe('Table', () => {

    it('adding element', () => {
        const table = new Table();
        const expansions = table.expandWith(new Piece("Blue", 3),
            new Set([new Piece("Blue", 6), new Piece("Blue", 5), new Piece("Blue", 4), new Piece("Blue", 7)]))
        expect(expansions.size).to.equal(1);
    });

    it('adding wrong element', () => {
        const table = new Table();
        const expansions = table.expandWith(new Piece("Blue", 9),
            new Set([new Piece("Blue", 4), new Piece("Blue", 5), new Piece("Blue", 6), new Piece("Blue", 7)]))
        expect(expansions.size).to.equal(0);
    });

});