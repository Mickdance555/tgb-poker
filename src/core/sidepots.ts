import { HandEvaluation, SidePot } from './types.js';

export interface PlayerContribution {
  seatNumber: number;
  userId: string;
  totalContributed: number;
  isFolded: boolean;
  handEvaluation?: HandEvaluation;
}

export interface PotAward {
  seatNumber: number;
  userId: string;
  chipsWon: number;
  potIndex: number;
  reason: string;
}

/**
 * TGB Poker — Side Pot Calculator
 * Robust mathematical side pot construction and split pot resolver with odd chip rules.
 */
export class SidePotCalculator {
  /**
   * Resolves uncalled bets before pot construction:
   * If the highest contributor contributed more than the second highest, the excess is immediately returned.
   */
  public static handleUncalledBets(contributions: PlayerContribution[]): {
    refundSeat?: number;
    refundAmount: number;
    adjustedContributions: PlayerContribution[];
  } {
    const adjusted = contributions.map(c => ({ ...c }));
    // Filter active (non-folded) or all contributors
    const activeContributors = adjusted
      .filter(c => !c.isFolded && c.totalContributed > 0)
      .sort((a, b) => b.totalContributed - a.totalContributed);

    if (activeContributors.length <= 1) {
      // If only one active player remains, or all others are all-in with less
      const allSorted = adjusted
        .filter(c => c.totalContributed > 0)
        .sort((a, b) => b.totalContributed - a.totalContributed);

      if (allSorted.length >= 2 && allSorted[0].totalContributed > allSorted[1].totalContributed) {
        const excess = allSorted[0].totalContributed - allSorted[1].totalContributed;
        const target = adjusted.find(c => c.seatNumber === allSorted[0].seatNumber)!;
        target.totalContributed -= excess;
        return {
          refundSeat: target.seatNumber,
          refundAmount: excess,
          adjustedContributions: adjusted,
        };
      }
      return { refundAmount: 0, adjustedContributions: adjusted };
    }

    const highest = activeContributors[0];
    const secondHighest = activeContributors[1];

    if (highest.totalContributed > secondHighest.totalContributed) {
      const excess = highest.totalContributed - secondHighest.totalContributed;
      const target = adjusted.find(c => c.seatNumber === highest.seatNumber)!;
      target.totalContributed -= excess;
      return {
        refundSeat: target.seatNumber,
        refundAmount: excess,
        adjustedContributions: adjusted,
      };
    }

    return { refundAmount: 0, adjustedContributions: adjusted };
  }

  /**
   * Builds Main Pot and all Side Pots based on player contribution levels.
   */
  public static calculatePots(contributions: PlayerContribution[]): SidePot[] {
    const pots: SidePot[] = [];
    const nonZeroContribs = contributions.filter(c => c.totalContributed > 0);
    if (nonZeroContribs.length === 0) return pots;

    // Get sorted unique positive contribution levels of non-folded players
    const candidateLevels = Array.from(
      new Set(
        nonZeroContribs
          .filter(c => !c.isFolded)
          .map(c => c.totalContributed)
      )
    ).sort((a, b) => a - b);

    if (candidateLevels.length === 0) {
      // All remaining contributors folded; award to whoever didn't fold or handle gracefully
      return pots;
    }

    let previousLevel = 0;
    let potIndex = 0;

    for (const currentLevel of candidateLevels) {
      const levelDiff = currentLevel - previousLevel;
      if (levelDiff <= 0) continue;

      let potAmount = 0;
      const eligibleSeats: number[] = [];

      for (const player of nonZeroContribs) {
        if (player.totalContributed > previousLevel) {
          const contributedAtThisLevel = Math.min(
            player.totalContributed - previousLevel,
            levelDiff
          );
          potAmount += contributedAtThisLevel;

          if (!player.isFolded && player.totalContributed >= currentLevel) {
            eligibleSeats.push(player.seatNumber);
          }
        }
      }

      if (potAmount > 0 && eligibleSeats.length > 0) {
        pots.push({
          potIndex,
          amount: potAmount,
          eligibleSeatNumbers: eligibleSeats,
          winningSeats: [],
          payoutPerWinner: 0,
          remainderChips: 0,
        });
        potIndex++;
      }

      previousLevel = currentLevel;
    }

    return pots;
  }

  /**
   * Distributes each pot to winning eligible hands, handling split pots and odd chips.
   * dealerSeat is used to award odd chips clockwise from the button.
   */
  public static distributePots(
    pots: SidePot[],
    players: PlayerContribution[],
    dealerSeat: number,
    seatOrder: number[]
  ): { awards: PotAward[]; updatedPots: SidePot[] } {
    const awards: PotAward[] = [];
    const updatedPots: SidePot[] = [];

    for (const pot of pots) {
      // Find eligible players for this specific pot
      const eligiblePlayers = players.filter(
        p => pot.eligibleSeatNumbers.includes(p.seatNumber) && !p.isFolded && p.handEvaluation
      );

      if (eligiblePlayers.length === 0) {
        // Fallback: eligible players who didn't fold even if evaluation missing
        const active = players.filter(
          p => pot.eligibleSeatNumbers.includes(p.seatNumber) && !p.isFolded
        );
        if (active.length === 1) {
          awards.push({
            seatNumber: active[0].seatNumber,
            userId: active[0].userId,
            chipsWon: pot.amount,
            potIndex: pot.potIndex,
            reason: 'Uncontested pot award',
          });
          pot.winningSeats = [active[0].seatNumber];
          pot.payoutPerWinner = pot.amount;
          pot.remainderChips = 0;
          updatedPots.push(pot);
          continue;
        }
      }

      // Find highest hand score among eligible
      let maxScore = -1;
      for (const p of eligiblePlayers) {
        if (p.handEvaluation && p.handEvaluation.score > maxScore) {
          maxScore = p.handEvaluation.score;
        }
      }

      const winners = eligiblePlayers.filter(
        p => p.handEvaluation && p.handEvaluation.score === maxScore
      );

      pot.winningSeats = winners.map(w => w.seatNumber);
      const winnerCount = winners.length;
      const basePayout = Math.floor(pot.amount / winnerCount);
      let remainder = pot.amount % winnerCount;

      pot.payoutPerWinner = basePayout;
      pot.remainderChips = remainder;

      // Distribute odd chip remainder clockwise starting from dealer seat + 1
      const sortedSeatsClockwise = [...seatOrder].sort((a, b) => {
        const distA = (a - dealerSeat + 9) % 9;
        const distB = (b - dealerSeat + 9) % 9;
        return distA - distB;
      });

      for (const winner of winners) {
        let winAmount = basePayout;
        awards.push({
          seatNumber: winner.seatNumber,
          userId: winner.userId,
          chipsWon: winAmount,
          potIndex: pot.potIndex,
          reason: winner.handEvaluation?.description || 'Best Hand',
        });
      }

      // Add odd chips to winners closest to dealer button clockwise
      if (remainder > 0) {
        for (const seat of sortedSeatsClockwise) {
          const award = awards.find(
            a => a.potIndex === pot.potIndex && a.seatNumber === seat
          );
          if (award) {
            award.chipsWon += 1;
            remainder -= 1;
            if (remainder === 0) break;
          }
        }
      }

      updatedPots.push(pot);
    }

    return { awards, updatedPots };
  }
}
