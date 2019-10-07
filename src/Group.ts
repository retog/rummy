import { Piece } from "./Piece";
import { Series } from "./Series";

export class Group implements Series {

    value: number;
    colors: Set<string>;

    constructor (public pieces: Set<Piece>) {
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

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        if (mandatory.value !== this.value || this.colors.has(mandatory.color)) return new Set<[Series, Set<Piece>]>();
        return new Set<[Series, Set<Piece>]>([[new Group(new Set([...this.pieces].concat(mandatory))), optional]]);
    }

    toString() {
        return [ ... this.pieces].sort().join(" - ");
    }
}