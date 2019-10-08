import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";
import { Piece } from "./Piece";

export class Group implements Series {

    value: number;
    colors: Set<string>;

    constructor (public pieces: Set<Piece>) {
        if (pieces.size < 3) throw new Error("Group too short (Needs 3)");
        this.colors = new Set<string>();
        const values = new Set<number>();
        pieces.forEach(piece => {
            if (piece instanceof ValuePiece) {
                this.colors.add(piece.color);
                values.add(piece.value);
            }
        });
        if (this.colors.size !== pieces.size && values.size !== 1) throw new Error("Group invalid");
        this.value = [...values][0];
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        if (mandatory instanceof ValuePiece) {
            if (mandatory.value !== this.value || this.colors.has(mandatory.color)) return new Set<[Series, Set<ValuePiece>]>();            
        }
        //joker or matching
        return new Set<[Series, Set<Piece>]>([[new Group(new Set([...this.pieces].concat(mandatory))), optional]]);
    }

    toString() {
        return "Group: "+[ ... this.pieces].sort().join(" - ");
    }
}