import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";

export class Group implements Series {

    value: number;
    colors: Set<string>;

    constructor (public pieces: Set<ValuePiece>) {
        if (pieces.size < 3) throw new Error("Group too short (Needs 3)");
        this.colors = new Set<string>();
        const values = new Set<number>();
        pieces.forEach(piece => {
            this.colors.add(piece.color);
            values.add(piece.value);
        });
        if (this.colors.size !== pieces.size && values.size !== 1) throw new Error("Group invalid");
        this.value = [...values][0];
    }

    expandWith(mandatory: ValuePiece, optional: Set<ValuePiece>): Set<[Series, Set<ValuePiece>]> {
        if (mandatory.value !== this.value || this.colors.has(mandatory.color)) return new Set<[Series, Set<ValuePiece>]>();
        return new Set<[Series, Set<ValuePiece>]>([[new Group(new Set([...this.pieces].concat(mandatory))), optional]]);
    }

    toString() {
        return [ ... this.pieces].sort().join(" - ");
    }
}