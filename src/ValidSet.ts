import { Table } from "./Table";

export class ValidSet {

    tables: Set<Table>;
        
    constructor () {
        this.tables = new Set();
    }
}