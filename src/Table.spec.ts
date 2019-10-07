import { ValuePiece } from './ValuePiece';
import { expect } from 'chai';
import 'mocha';
import { Table } from './Table';


describe('Table', () => {

    it('adding elements consecutively', () => {
        const table = new Table();
        let expansions = table.expandWith(new ValuePiece("Blue", 3),
            new Set([new ValuePiece("Blue", 6), new ValuePiece("Blue", 5), new ValuePiece("Blue", 4), new ValuePiece("Blue", 7)]));
        expect(expansions.size).to.equal(1);
        for (var count = 6; count <= 7; count++) {
            const table2 = [...expansions][0][0];
            expansions = table2.expandWith(new ValuePiece("Blue", count),
                new Set());
            expect(expansions.size).to.equal(1);
        }
        const table3 = [...expansions][0][0];
        expansions = table3.expandWith(new ValuePiece("Blue", 8), new Set());
        // This would be neede for an incremental algorithm
        //expect(expansions.size).to.equal(2);
    });

    it('adding two batches', () => {
        const table = new Table();
        let expansions = table.expandWith(new ValuePiece("Blue", 3),
            new Set([new ValuePiece("Blue", 6), new ValuePiece("Blue", 5), new ValuePiece("Blue", 4), new ValuePiece("Blue", 7)]));
        expect(expansions.size).to.equal(1);
        const table2 = [...expansions][0][0];
        expansions = table2.expandWith(new ValuePiece("Blue", 6),
            new Set([new ValuePiece("Blue", 7), new ValuePiece("Blue", 8)]));
        expect(expansions.size).to.equal(2);
    });

    it('adding wrong element', () => {
        const table = new Table();
        const expansions = table.expandWith(new ValuePiece("Blue", 9),
            new Set([new ValuePiece("Blue", 4), new ValuePiece("Blue", 5), new ValuePiece("Blue", 6), new ValuePiece("Blue", 7)]))
        expect(expansions.size).to.equal(0);
    });

});