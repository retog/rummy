import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";
import { Piece } from "./Piece";

export class Row implements Series {
    
    pieces: Set<Piece>;
    color: string = "";  
    firstValue: number = 0;  

    constructor (public orderedPieces: Array<Piece>) {
        this.pieces = new Set(orderedPieces);
        if (orderedPieces.length < 3) throw new Error("Row too short (Needs 3)");
        for (let i = 0; i < orderedPieces.length; i++) {
            const p = orderedPieces[i];
            if (p instanceof ValuePiece) {
                this.firstValue = p.value - i;
                this.color = p.color;
                break;
            }
        }
        if (this.firstValue <= 0) {
            throw new Error("Row must have at least one non-joker. Jokers must stand for positive numbers.");
        }
        for (let i = 0; i < orderedPieces.length; i++) {
            const p = orderedPieces[i];
            if (p instanceof ValuePiece) {
                if (p.value != this.firstValue+i) throw new Error("Row not consecutive");
                if (p.color != this.color) throw new Error("Row must be in one color");
            }
        }
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        let result = new Set<[Series, Set<Piece>]>();
        if (mandatory instanceof ValuePiece) {
            if ((mandatory.value === this.firstValue + this.orderedPieces.length)
                && (mandatory.color === this.color)) {
                result.add([new Row(this.orderedPieces.concat(mandatory)), optional]);
            }
        } else {
            //joker
            result.add([new Row(this.orderedPieces.concat(mandatory)), optional]);
        }
        return result;
    }

    toString() {
        return "Row: "+this.orderedPieces.join(" - ");
    }
    
}