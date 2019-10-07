import { Piece } from './Piece';
import { expect } from 'chai';
import 'mocha';
import { Table } from './Table';
import { TableFactory } from './TableFactory';


describe('TableFactory', () => {

    it('3 x 3', () => {
        const elements = new Set([
            new Piece("red",1),
            new Piece("green",1),
            new Piece("blue",1),
            new Piece("red",2),
            new Piece("green",2),
            new Piece("blue",2),
            new Piece("red",3),
            new Piece("green",3),
            new Piece("blue",3)]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(2);
    });

    it('4 x 3', () => {
        const elements = new Set([
            new Piece("red",1),
            new Piece("green",1),
            new Piece("blue",1),
            new Piece("orange",1),
            new Piece("red",2),
            new Piece("green",2),
            new Piece("blue",2),
            new Piece("orange",2),
            new Piece("red",3),
            new Piece("green",3),
            new Piece("blue",3),
            new Piece("orange",3)]);
        const tables = TableFactory.create(elements);
        expect(tables.size).to.equal(16);
    });
});