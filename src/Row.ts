import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";

export class Row implements Series {
    
    pieces: Set<ValuePiece>;

    constructor (public orderedPieces: Array<ValuePiece>) {
        this.pieces = new Set(orderedPieces);
        if (orderedPieces.length < 3) throw new Error("Row too short (Needs 3)");
        for (let i = 1; i < orderedPieces.length; i++) {
            if (orderedPieces[i-1].value + 1 != orderedPieces[i].value) throw new Error("Row not consecutive");
        }
    }

    expandWith(mandatory: ValuePiece, optional: Set<ValuePiece>): Set<[Series, Set<ValuePiece>]> {
        let result = new Set<[Series, Set<ValuePiece>]>();
        if ((mandatory.value - 1 === this.orderedPieces[this.orderedPieces.length - 1].value)
            && (mandatory.color === this.orderedPieces[0].color)) {
            result.add([new Row(this.orderedPieces.concat(mandatory)), optional]);
        }
        return result;
    }

    toString() {
        return this.orderedPieces.join(" - ");
    }
    
}