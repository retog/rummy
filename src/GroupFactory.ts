import { SeriesFactory } from "./SeriesFactory";
import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";
import { Util } from "./Util";
import { Group } from "./Group";
import { Piece } from "./Piece";
import { Joker } from "./Joker";

export class GroupFactory implements SeriesFactory {
    
    create(mandatory: ValuePiece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        const color = new Set<string>();
        const optionalValuePieces : Array<ValuePiece> = [... optional].filter(o => o instanceof ValuePiece).map(o => o as ValuePiece);
        const candidates:Array<Piece> = optionalValuePieces.filter(p =>  p.value === mandatory.value)
            .filter(p => p.color !== mandatory.color)
            .filter(p =>  color.has(p.color) ? false : color.add(p.color));
        const results = new Set<[Series, Set<Piece>]>();
        const jokers : Array<Joker> = [... optional].filter(o => o instanceof Joker).map(o => o as Joker);
        while ((candidates.length < 2) && (jokers.length > 0)) {
            candidates.push(jokers.pop() as Joker)
        } 
        if (candidates.length === 2) {
            const remaining = new Set(optional);
            candidates.forEach(c => remaining.delete(c));
            results.add([new Group(new Set([...candidates, mandatory])),remaining]);
        }
        if (candidates.length === 3) {
            candidates.forEach(candidate => {
                const used = new Set(candidates);
                used.delete(candidate);
                const remaining = new Set(optional);
                used.forEach(u => remaining.delete(u));
                results.add([new Group(new Set([...used, mandatory])),remaining]);
            })
        }
        return results;
    }
}