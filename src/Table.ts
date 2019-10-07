import { Piece } from "./Piece";
import { Grouping } from "./Grouping";
import { GroupingFactory } from "./GroupingFactory";
import { RowFactory } from "./RowFactory";

export class Table {

    factories: Set<GroupingFactory>;

    constructor(public groupings: Set<Grouping> = new Set<Grouping>()) {
        this.factories = new Set<GroupingFactory>([new RowFactory]);
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

}