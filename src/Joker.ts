import { Piece } from "./Piece.ts";

export class Joker implements Piece {

    toString() {
        return "( ** JOKER ** )";
    }
}