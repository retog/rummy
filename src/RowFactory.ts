import { ValuePiece } from "./ValuePiece";
import { SeriesFactory } from "./SeriesFactory";
import { Series } from "./Series";
import { Util } from "./Util";
import { Row } from "./Row";
import { Piece } from "./Piece";
import { Joker } from "./Joker";

export class RowFactory implements SeriesFactory {

    create(mandatory: ValuePiece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        const remaining = new Set(optional);
        const pieces:Array<Piece> = [mandatory];
        const firstValue = mandatory.value;
        const jokers : Array<Joker> = [... optional].filter(o => o instanceof Joker).map(o => o as Joker);
        while (pieces.length < 3) {
            const nextPiece = Util.findIn(mandatory.color, firstValue + pieces.length, remaining);
            if (nextPiece) {
                pieces.push(nextPiece);
                remaining.delete(nextPiece);
            } else {
                if (jokers.length > 0) {
                    const joker = jokers.pop() as Joker;
                    pieces.push(joker);
                    remaining.delete(joker);
                } else {
                    return new Set<[Series, Set<Piece>]>();
                }
            }
            //else throw new Error("Can't build row");
        }
        return new Set<[Series, Set<Piece>]>([[new Row(pieces), remaining]]);
    }
}