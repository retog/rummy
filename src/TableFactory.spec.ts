import { ValuePiece } from './ValuePiece';
import { expect } from 'chai';
import 'mocha';
import { Table } from './Table';
import { TableFactory } from './TableFactory';
import { Joker } from './Joker';


describe('TableFactory', () => {

    it('3 x 3', () => {
        const elements = new Set([
            new ValuePiece("red",1),
            new ValuePiece("green",1),
            new ValuePiece("blue",1),
            new ValuePiece("red",2),
            new ValuePiece("green",2),
            new ValuePiece("blue",2),
            new ValuePiece("red",3),
            new ValuePiece("green",3),
            new ValuePiece("blue",3)]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(2);
    });

    it('4 x 3', () => {
        const elements = new Set([
            new ValuePiece("red",1),
            new ValuePiece("green",1),
            new ValuePiece("blue",1),
            new ValuePiece("orange",1),
            new ValuePiece("red",2),
            new ValuePiece("green",2),
            new ValuePiece("blue",2),
            new ValuePiece("orange",2),
            new ValuePiece("red",3),
            new ValuePiece("green",3),
            new ValuePiece("blue",3),
            new ValuePiece("orange",3)]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(6);
    });


    it('4 x 4', () => {
        const elements = new Set([
            new ValuePiece("red",1),
            new ValuePiece("green",1),
            new ValuePiece("blue",1),
            new ValuePiece("orange",1),
            new ValuePiece("red",2),
            new ValuePiece("green",2),
            new ValuePiece("blue",2),
            new ValuePiece("orange",2),
            new ValuePiece("red",3),
            new ValuePiece("green",3),
            new ValuePiece("blue",3),
            new ValuePiece("orange",3),
            new ValuePiece("red",4),
            new ValuePiece("green",4),
            new ValuePiece("blue",4),
            new ValuePiece("orange",4)]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(24);
    });

    it('3 x 3 with jokers', () => {
        const elements = new Set([
            new ValuePiece("red",1),
            new ValuePiece("green",1),
            new Joker(),
            new ValuePiece("red",2),
            new ValuePiece("green",2),
            new ValuePiece("blue",2),
            new ValuePiece("red",3),
            new ValuePiece("green",3),
            new Joker()]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(3);
    });
});