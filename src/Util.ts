import { Piece } from "./Piece";

export const Util = {
    findIn(color: string, value: number, pieces: Set<Piece>): Piece | null {
        let found: Piece | null = null;
        pieces.forEach(piece => {
            if (piece.color === color && piece.value === value) found = piece;
        });
        return found;
    },

    pickLowest(pieces: Set<Piece>): Piece {
        let found: Piece | null = null;
        pieces.forEach(piece => {
            if (!found || found.value > piece.value) found = piece;
        });
        if (!found) throw new Error("Can't pick lowest of empty Set")
        return found;
    }
}