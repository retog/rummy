import { ValuePiece } from "./ValuePiece.ts";
import { Joker } from "./Joker.ts";
import { TableFactory } from "./TableFactory.ts";

const elements = new Set([
    new ValuePiece("red",1),
    new ValuePiece("green",1),
    new Joker(),
    new ValuePiece("red",2),
    new ValuePiece("green",2),
    new ValuePiece("blue",2),
    new ValuePiece("red",3),
    new ValuePiece("green",3),
    new Joker()]);

console.log("Computing possible tables with all of "+[ ... elements].sort()+"\n")

const tables = TableFactory.create(elements);

console.log("Found "+tables.size+" possible solutions.\n")
console.log([... tables].map(t => "TABLE: \n"+t.toString()).sort().join("\n\n------------------------\n\n"));
