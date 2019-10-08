import { ValuePiece } from "./ValuePiece";
import { Piece } from "./Piece";

export const Util = {
    findIn(color: string, value: number, pieces: Set<Piece>): ValuePiece | null {
        let found: ValuePiece | null = null;
        pieces.forEach(piece => {
            if (piece instanceof ValuePiece) {
                if (piece.color === color && piece.value === value) found = piece;
            }
        });
        return found;
    },

    pickLowest(pieces: Set<Piece>): Piece {
        let found: ValuePiece | null = null;
        pieces.forEach(piece => {
            if ((piece instanceof ValuePiece) && (!found || found.value > piece.value)) found = piece;
        });
        if (!found) {
            if (pieces.size === 0) {
                throw new Error("Can't pick lowest of empty Set")
            } else {
                return [ ...  pieces][0]
            }
        }
        return found;
    }
}