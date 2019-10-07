import { Piece } from "./Piece";

export interface Grouping {
    pieces: Set<Piece>;

    /**
     * returns an minimal row that expand this row by at least the
     * mandatory piece plus any required pievce from optional
     * @param {*} mandatory 
     * @returns a set of tuples with expanding grouping and left-over pieces
     */
    expandWith : (mandatory: Piece, optional: Set<Piece>) => Set<[Grouping, Set<Piece>]>;
}