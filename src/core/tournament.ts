export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface TournamentPayout {
  place: number;
  amountTgb: number;
  percentage: number;
}

export const STANDARD_BLIND_STRUCTURE: BlindLevel[] = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 10 },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 10 },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 20, durationMinutes: 10 },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 10 },
  { level: 5, smallBlind: 150, bigBlind: 300, ante: 40, durationMinutes: 10 },
  { level: 6, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 10 },
  { level: 7, smallBlind: 300, bigBlind: 600, ante: 75, durationMinutes: 10 },
  { level: 8, smallBlind: 400, bigBlind: 800, ante: 100, durationMinutes: 10 },
  { level: 9, smallBlind: 500, bigBlind: 1000, ante: 125, durationMinutes: 10 },
  { level: 10, smallBlind: 750, bigBlind: 1500, ante: 200, durationMinutes: 10 },
  { level: 11, smallBlind: 1000, bigBlind: 2000, ante: 250, durationMinutes: 10 },
  { level: 12, smallBlind: 1500, bigBlind: 3000, ante: 400, durationMinutes: 10 },
];

export const TURBO_BLIND_STRUCTURE: BlindLevel[] = STANDARD_BLIND_STRUCTURE.map(l => ({
  ...l,
  durationMinutes: 5,
}));

/**
 * TGB Poker — Tournament Director & Payout Engine
 */
export class TournamentEngine {
  /**
   * Calculates MTT Payout Table based on entries and prize pool
   */
  public static calculatePayouts(entriesCount: number, prizePoolTgb: number): TournamentPayout[] {
    if (entriesCount < 2 || prizePoolTgb <= 0) return [];

    // Calculate number of places paid (typically 15% of field, minimum 2, maximum 100)
    let placesPaid = Math.max(2, Math.floor(entriesCount * 0.15));
    if (entriesCount <= 4) placesPaid = 2;
    else if (entriesCount <= 10) placesPaid = 3;

    // Weight formula: 1 / (rank ^ 0.65)
    const weights: number[] = [];
    let totalWeight = 0;
    for (let r = 1; r <= placesPaid; r++) {
      const w = 1 / Math.pow(r, 0.65);
      weights.push(w);
      totalWeight += w;
    }

    const payouts: TournamentPayout[] = [];
    let allocatedTotal = 0;

    for (let i = 0; i < placesPaid; i++) {
      const place = i + 1;
      const pct = (weights[i] / totalWeight) * 100;
      const amount = Math.floor((prizePoolTgb * weights[i]) / totalWeight);
      allocatedTotal += amount;
      payouts.push({
        place,
        amountTgb: amount,
        percentage: Math.round(pct * 10) / 10,
      });
    }

    // Add remainder dust to 1st place
    const dust = prizePoolTgb - allocatedTotal;
    if (dust > 0 && payouts.length > 0) {
      payouts[0].amountTgb += dust;
    }

    return payouts;
  }

  /**
   * Table Balancing Algorithm:
   * Identifies if any table has >= 2 more players than another table and computes optimal player move.
   */
  public static calculateTableBalanceMoves(
    tables: { tableId: string; playerCount: number; seats: { seatNumber: number; userId: string; isBigBlindNext: boolean }[] }[]
  ): { fromTableId: string; toTableId: string; userId: string } | null {
    if (tables.length <= 1) return null;

    const sortedTables = [...tables].sort((a, b) => b.playerCount - a.playerCount);
    const fullest = sortedTables[0];
    const emptiest = sortedTables[sortedTables.length - 1];

    if (fullest.playerCount - emptiest.playerCount >= 2) {
      // Find candidate player from fullest table (preferably next big blind player to ensure fair blind rotation)
      const candidate = fullest.seats.find(s => s.isBigBlindNext) || fullest.seats[0];
      if (candidate) {
        return {
          fromTableId: fullest.tableId,
          toTableId: emptiest.tableId,
          userId: candidate.userId,
        };
      }
    }

    return null;
  }
}
