import { Piece } from "./Piece";
import { GroupingFactory } from "./GroupingFactory";
import { Grouping } from "./Grouping";
import { Util } from "./Util";
import { Row } from "./Row";

export class RowFactory implements GroupingFactory {

    create(mandatory: Piece, optional: Set<Piece>): Set<[Grouping, Set<Piece>]> {
        const remaining = new Set(optional);
        const pieces = [mandatory];
        while (pieces.length < 3) {
            const nextPiece = Util.findIn(mandatory.color, pieces[pieces.length - 1].value + 1, remaining);
            if (nextPiece) {
                pieces.push(nextPiece);
                remaining.delete(nextPiece);
            }
            else return new Set<[Grouping, Set<Piece>]>();
            //else throw new Error("Can't build row");
        }
        return new Set<[Grouping, Set<Piece>]>([[new Row(pieces), remaining]]);
    }
}