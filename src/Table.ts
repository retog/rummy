import { Piece } from "./Piece";
import { Series } from "./Series";
import { SeriesFactory } from "./SeriesFactory";
import { RowFactory } from "./RowFactory";
import { Util } from "./Util";
import { GroupFactory } from "./GroupFactory";

export class Table {

    factories: Set<SeriesFactory>;

    constructor(public groupings: Set<Series> = new Set<Series>()) {
        this.factories = new Set<SeriesFactory>([new RowFactory, new GroupFactory]);
    }

    expandWith(mandatory: Piece, optional: Set<Piece>): Set<[Table, Set<Piece>]> {
        const result = new Set<[Table, Set<Piece>]>();
        this.groupings.forEach(grouping => {
            grouping.expandWith(mandatory, optional).forEach(tuple => {
                const newGrouping = tuple[0];
                const remaining = tuple[1];
                const newGroupings = new Set(this.groupings);
                newGroupings.delete(grouping);
                newGroupings.add(newGrouping);
                result.add([new Table(newGroupings), remaining])
            })
        });
        this.factories.forEach(factory => {
            factory.create(mandatory, optional).forEach(tuple => {
                const newGrouping = tuple[0];
                const remaining = tuple[1];
                const newGroupings = new Set(this.groupings);
                newGroupings.add(newGrouping);
                result.add([new Table(newGroupings), remaining])
            })
        })
        return result;
    }

    addAll(pieces: Set<Piece>): Set<Table> {
        const lowest = Util.pickLowest(pieces);
        const rest = new Set(pieces);
        const result = new Set<Table>();
        rest.delete(lowest);
        const expanded = this.expandWith(lowest, rest)
        if (expanded.size === 0) {
            console.log("No expansion was possible with "+lowest+", "+rest);
        }
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
        return [... this.groupings].sort().join("\n")
    }
}