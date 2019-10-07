import { ValuePiece } from "./ValuePiece";

export const Util = {
    findIn(color: string, value: number, pieces: Set<ValuePiece>): ValuePiece | null {
        let found: ValuePiece | null = null;
        pieces.forEach(piece => {
            if (piece.color === color && piece.value === value) found = piece;
        });
        return found;
    },

    pickLowest(pieces: Set<ValuePiece>): ValuePiece {
        let found: ValuePiece | null = null;
        pieces.forEach(piece => {
            if (!found || found.value > piece.value) found = piece;
        });
        if (!found) throw new Error("Can't pick lowest of empty Set")
        return found;
    }
}