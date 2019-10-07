import { ValuePiece } from "./ValuePiece";

export interface Series {
    pieces: Set<ValuePiece>;

    /**
     * returns all minimal series that expand this series with at least the
     * mandatory piece plus any required piece from optional
     * @param {*} mandatory
     * @returns a set of tuples with expanding grouping and left-over pieces
     */
    expandWith : (mandatory: ValuePiece, optional: Set<ValuePiece>) => Set<[Series, Set<ValuePiece>]>;
}