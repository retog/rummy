import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";

export interface SeriesFactory {

    /**
     * returns an minimal grouping with at least the
     * mandatory piece plus any required pievce from optional
     * @param {*} mandatory 
     * @returns a set of tuples with expanding grouping and left-over pieces
     */
    create : (mandatory: ValuePiece, optional: Set<ValuePiece>) => Set<[Series, Set<ValuePiece>]>;
}