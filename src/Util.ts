import { Piece } from "./Piece";

export const Util = {
    findIn(color: string, value: number, pieces: Set<Piece>): Piece | null {
        let found: Piece | null = null;
        pieces.forEach(piece => {
            if (piece.color === color && piece.value === value) found = piece;
        });
        return found;
    }
}