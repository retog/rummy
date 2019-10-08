import { Series } from "./Series";
import { Piece } from "./Piece";
import { ValuePiece } from "./ValuePiece";

export interface SeriesFactory {

    /**
     * returns an minimal grouping with at least the
     * mandatory piece plus any required pievce from optional
     * @param {*} mandatory 
     * @returns a set of tuples with expanding grouping and left-over pieces
     */
    create : (mandatory: ValuePiece, optional: Set<Piece>) => Set<[Series, Set<Piece>]>;
}