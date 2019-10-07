import { Piece } from "./Piece";
import { Grouping } from "./Grouping";

export class Row implements Grouping {
    
    pieces: Set<Piece>;

    constructor (orderedPieces: Array<Piece>) {
        this.pieces = new Set(orderedPieces);
        if (orderedPieces.length < 3) throw new Error("Row to short (Needs 3)");
        for (let i = 1; i < orderedPieces.length; i++) {
            if (orderedPieces[i-1].value + 1 != orderedPieces[1].value) throw new Error("Row not consecutive");
        }
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Grouping, Set<Piece>]> {
        let result = new Set<[Grouping, Set<Piece>]>();
        return result;
    }

    
}