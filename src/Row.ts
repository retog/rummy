import { Piece } from "./Piece";
import { Grouping } from "./Grouping";

export class Row implements Grouping {
    
    pieces: Set<Piece>;

    constructor (public orderedPieces: Array<Piece>) {
        this.pieces = new Set(orderedPieces);
        if (orderedPieces.length < 3) throw new Error("Row to short (Needs 3)");
        for (let i = 1; i < orderedPieces.length; i++) {
            if (orderedPieces[i-1].value + 1 != orderedPieces[i].value) throw new Error("Row not consecutive");
        }
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Grouping, Set<Piece>]> {
        let result = new Set<[Grouping, Set<Piece>]>();
        if ((mandatory.value - 1 === this.orderedPieces[this.orderedPieces.length - 1].value)
            && (mandatory.color === this.orderedPieces[0].color)) {
            result.add([new Row(this.orderedPieces.concat(mandatory)), optional]);
        }
        return result;
    }

    
}