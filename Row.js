export class Row {
    constructor (pieces) {
        if (pieces.length < 3) throw new Error("Row to short (Needs 3)");
        for (let i = 1; i < pieces.length; i++) {
            if (pieces[i-1].value + 1 != pieces[1].value) throw new Error("Row not consecutive");
        }
        this.pieces = pieces || new Array();
    }

    /**
     * returns an minimal row that expand this row by at least the
     * mandatory piece plus any required pievce from optional
     * @param {*} mandatory 
     */
    expandWith(mandatory, optional) {

    }
}