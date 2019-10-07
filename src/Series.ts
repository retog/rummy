import { Piece } from "./Piece";

export interface Series {
    pieces: Set<Piece>;

    /**
     * returns all minimal series that expand this series with at least the
     * mandatory piece plus any required piece from optional
     * @param {*} mandatory
     * @returns a set of tuples with expanding grouping and left-over pieces
     */
    expandWith : (mandatory: Piece, optional: Set<Piece>) => Set<[Series, Set<Piece>]>;
}