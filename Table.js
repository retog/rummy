export class Table {
    constructor (groups, rows) {
        this.groups = groups || new Set();
        this.rows = rows || new Set();
    }

    derivates(piece, optionals) {
        const results = new Set(); //Set of (table, remaining)
        this.groups.forEach(group => {
            if (group.canAccomodate(piece)) {
                const newGroups = new Set(this.groups);
                newGroups.delete(group);
                newGroups.add(group.accomodate(piece));
                results.add(new Table(newGroups, this.rows));
            }
        })
    }
}