import { SeriesFactory } from "./SeriesFactory";
import { Piece } from "./Piece";
import { Series } from "./Series";
import { Util } from "./Util";
import { Group } from "./Group";

export class GroupFactory implements SeriesFactory {
    
    create(mandatory: Piece, optional: Set<Piece>): Set<[Series, Set<Piece>]> {
        const color = new Set<string>();
        const candidates = new Set([...optional].filter(p => p.value === mandatory.value)
            .filter(p => p.color !== mandatory.color)
            .filter(p => color.has(p.color) ? false : color.add(p.color)));
        const results = new Set<[Series, Set<Piece>]>();
        if (candidates.size === 2) {
            const remaining = new Set(optional);
            candidates.forEach(c => remaining.delete(c));
            results.add([new Group(new Set([...candidates, mandatory])),remaining]);
        }
        if (candidates.size === 3) {
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