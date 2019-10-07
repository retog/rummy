export class ValuePiece {
    color: string;
    value: number;
    constructor (color: string, value: number) {
        this.color = color;
        this.value = value;
    }

    toString() {
        return "("+this.color+","+this.value+")";
    }
}