import { ValuePiece } from "./ValuePiece";
import { SeriesFactory } from "./SeriesFactory";
import { Series } from "./Series";
import { Util } from "./Util";
import { Row } from "./Row";

export class RowFactory implements SeriesFactory {

    create(mandatory: ValuePiece, optional: Set<ValuePiece>): Set<[Series, Set<ValuePiece>]> {
        const remaining = new Set(optional);
        const pieces = [mandatory];
        while (pieces.length < 3) {
            const nextPiece = Util.findIn(mandatory.color, pieces[pieces.length - 1].value + 1, remaining);
            if (nextPiece) {
                pieces.push(nextPiece);
                remaining.delete(nextPiece);
            }
            else return new Set<[Series, Set<ValuePiece>]>();
            //else throw new Error("Can't build row");
        }
        return new Set<[Series, Set<ValuePiece>]>([[new Row(pieces), remaining]]);
    }
}