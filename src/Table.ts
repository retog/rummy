import { ValuePiece } from "./ValuePiece";
import { Series } from "./Series";
import { SeriesFactory } from "./SeriesFactory";
import { RowFactory } from "./RowFactory";
import { Util } from "./Util";
import { GroupFactory } from "./GroupFactory";
import { Piece } from "./Piece";

export class Table {

    factories: Set<SeriesFactory>;

    constructor(public seriesSet: Set<Series> = new Set<Series>()) {
        this.factories = new Set<SeriesFactory>([new RowFactory, new GroupFactory]);
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Table, Set<Piece>]> {
        const result = new Set<[Table, Set<Piece>]>();
        this.seriesSet.forEach(grouping => {
            grouping.expandWith(mandatory, optional).forEach(tuple => {
                const newGrouping = tuple[0];
                const remaining = tuple[1];
                const newSeriesSet = new Set(this.seriesSet);
                newSeriesSet.delete(grouping);
                newSeriesSet.add(newGrouping);
                result.add([new Table(newSeriesSet), remaining])
            })
        });
        if (mandatory instanceof ValuePiece) {
            this.factories.forEach(factory => {
                factory.create(mandatory, optional).forEach(tuple => {
                    const newGrouping = tuple[0];
                    const remaining = tuple[1];
                    const newGroupings = new Set(this.seriesSet);
                    newGroupings.add(newGrouping);
                    result.add([new Table(newGroupings), remaining])
                })
            })
        }
        return result;
    }

    addAll(pieces: Set<Piece>): Set<Table> {
        const lowest = Util.pickLowest(pieces);
        const rest = new Set(pieces);
        const result = new Set<Table>();
        rest.delete(lowest);
        const expanded = this.expandWith(lowest, rest)
        /*if (expanded.size === 0) {
            console.debug("No expansion was possible with "+lowest+" and "+[ ... rest]);
        }*/
        expanded.forEach(tuple => {
            const newTable = tuple[0];
            const remaining = tuple[1];
            if (remaining.size === 0) {
                result.add(newTable);
            } else {
                newTable.addAll(remaining).forEach(table => result.add(table));
            }
        });
        return result;
    }

    toString(): string {
        return [... this.seriesSet].sort().join("\n")
    }
}