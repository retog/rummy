import { Table } from "./Table.ts";

export class ValidSet {

    tables: Set<Table>;
        
    constructor () {
        this.tables = new Set();
    }
}