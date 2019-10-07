import { Piece } from './Piece';
import { expect } from 'chai';
import 'mocha';


describe('construct', () => {

    it('should have the color set', () => {
        const p = new Piece("pink", 3);
        expect(p.color).to.equal('pink');
    });

});