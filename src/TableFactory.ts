import { Table } from "./Table";
import { Piece } from "./Piece";

export const TableFactory = {

    /**
     * Creates all possible Tables with the given Pieces.
     * @param pieces Set of Pieces to be used.
     * @returns Set of all Tables containing only and all given Pieces.
     */
    create(pieces: Set<Piece>): Set<Table> {
        const emptyTable = new Table();
        const resultMap = new Map<string, Table>();
        emptyTable.addAll(pieces).forEach(table => resultMap.set(table.toString(), table));
        return new Set(resultMap.values());
    }
}