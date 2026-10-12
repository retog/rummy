import { ValuePiece } from './ValuePiece.ts';
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";


describe('construct', () => {

    it('should have the color set', () => {
        const p = new ValuePiece("pink", 3);
        expect(p.color).toBe('pink');
    });

});