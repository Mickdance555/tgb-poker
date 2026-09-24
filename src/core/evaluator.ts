import { Card, HandCategory, HandEvaluation, Rank, RANK_NAMES } from './types.js';

/**
 * TGB Poker — 7-Card Hand Evaluator
 * Fully deterministic, evaluates any 5 to 7 card collection to the optimal 5-card Texas Hold'em hand.
 */
export class HandEvaluator {
  /**
   * Evaluates the best 5-card hand from an array of 5, 6, or 7 cards
   */
  public static evaluate(cards: Card[]): HandEvaluation {
    if (cards.length < 5 || cards.length > 7) {
      throw new Error(`Evaluator requires between 5 and 7 cards, received ${cards.length}`);
    }

    const fiveCardCombinations = this.getCombinations(cards, 5);
    let bestHand: HandEvaluation | null = null;

    for (const combo of fiveCardCombinations) {
      const evaluation = this.evaluateFiveCards(combo);
      if (!bestHand || evaluation.score > bestHand.score) {
        bestHand = evaluation;
      }
    }

    if (!bestHand) {
      throw new Error('Failed to evaluate hands');
    }

    return bestHand;
  }

  /**
   * Compares two hand evaluations: returns > 0 if A wins, < 0 if B wins, 0 if tie
   */
  public static compare(a: HandEvaluation, b: HandEvaluation): number {
    return a.score - b.score;
  }

  /**
   * Internal evaluator for exactly 5 cards
   */
  private static evaluateFiveCards(cards: Card[]): HandEvaluation {
    // Sort cards descending by rank (A=14 down to 2)
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);

    const isFlush = sorted.every(c => c.suit === sorted[0].suit);
    const straightInfo = this.checkStraight(sorted);

    // Group cards by rank
    const rankCounts: Record<number, number> = {};
    for (const c of sorted) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }

    // Sort rank groups by frequency descending, then rank descending
    const groups = Object.entries(rankCounts)
      .map(([rankStr, count]) => ({ rank: parseInt(rankStr, 10) as Rank, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.rank - a.rank;
      });

    // 1. Royal Flush & Straight Flush
    if (isFlush && straightInfo.isStraight) {
      if (straightInfo.highRank === 14) {
        return {
          category: HandCategory.ROYAL_FLUSH,
          categoryName: 'Royal Flush',
          score: this.computeScore(HandCategory.ROYAL_FLUSH, [14]),
          tieBreakers: [14],
          bestFiveCards: straightInfo.orderedCards || sorted,
          description: `Royal Flush in ${sorted[0].suit}`,
        };
      }

      return {
        category: HandCategory.STRAIGHT_FLUSH,
        categoryName: 'Straight Flush',
        score: this.computeScore(HandCategory.STRAIGHT_FLUSH, [straightInfo.highRank]),
        tieBreakers: [straightInfo.highRank],
        bestFiveCards: straightInfo.orderedCards || sorted,
        description: `Straight Flush, ${RANK_NAMES[straightInfo.highRank]} High`,
      };
    }

    // 2. Four of a Kind
    if (groups[0].count === 4) {
      const quadRank = groups[0].rank;
      const kickerRank = groups[1].rank;
      const ordered = [
        ...sorted.filter(c => c.rank === quadRank),
        ...sorted.filter(c => c.rank === kickerRank),
      ];
      return {
        category: HandCategory.FOUR_OF_A_KIND,
        categoryName: 'Four of a Kind',
        score: this.computeScore(HandCategory.FOUR_OF_A_KIND, [quadRank, kickerRank]),
        tieBreakers: [quadRank, kickerRank],
        bestFiveCards: ordered,
        description: `Four of a Kind, ${RANK_NAMES[quadRank]}s`,
      };
    }

    // 3. Full House
    if (groups[0].count === 3 && groups[1].count === 2) {
      const tripleRank = groups[0].rank;
      const pairRank = groups[1].rank;
      const ordered = [
        ...sorted.filter(c => c.rank === tripleRank),
        ...sorted.filter(c => c.rank === pairRank),
      ];
      return {
        category: HandCategory.FULL_HOUSE,
        categoryName: 'Full House',
        score: this.computeScore(HandCategory.FULL_HOUSE, [tripleRank, pairRank]),
        tieBreakers: [tripleRank, pairRank],
        bestFiveCards: ordered,
        description: `Full House, ${RANK_NAMES[tripleRank]}s full of ${RANK_NAMES[pairRank]}s`,
      };
    }

    // 4. Flush
    if (isFlush) {
      const tieBreakers = sorted.map(c => c.rank);
      return {
        category: HandCategory.FLUSH,
        categoryName: 'Flush',
        score: this.computeScore(HandCategory.FLUSH, tieBreakers),
        tieBreakers,
        bestFiveCards: sorted,
        description: `Flush, ${RANK_NAMES[sorted[0].rank]} High`,
      };
    }

    // 5. Straight
    if (straightInfo.isStraight) {
      return {
        category: HandCategory.STRAIGHT,
        categoryName: 'Straight',
        score: this.computeScore(HandCategory.STRAIGHT, [straightInfo.highRank]),
        tieBreakers: [straightInfo.highRank],
        bestFiveCards: straightInfo.orderedCards || sorted,
        description: `Straight, ${RANK_NAMES[straightInfo.highRank]} High`,
      };
    }

    // 6. Three of a Kind
    if (groups[0].count === 3) {
      const tripleRank = groups[0].rank;
      const kickers = groups.slice(1).map(g => g.rank);
      const ordered = [
        ...sorted.filter(c => c.rank === tripleRank),
        ...sorted.filter(c => c.rank !== tripleRank),
      ];
      return {
        category: HandCategory.THREE_OF_A_KIND,
        categoryName: 'Three of a Kind',
        score: this.computeScore(HandCategory.THREE_OF_A_KIND, [tripleRank, ...kickers]),
        tieBreakers: [tripleRank, ...kickers],
        bestFiveCards: ordered,
        description: `Three of a Kind, ${RANK_NAMES[tripleRank]}s`,
      };
    }

    // 7. Two Pair
    if (groups[0].count === 2 && groups[1].count === 2) {
      const highPairRank = Math.max(groups[0].rank, groups[1].rank) as Rank;
      const lowPairRank = Math.min(groups[0].rank, groups[1].rank) as Rank;
      const kickerRank = groups[2].rank;
      const ordered = [
        ...sorted.filter(c => c.rank === highPairRank),
        ...sorted.filter(c => c.rank === lowPairRank),
        ...sorted.filter(c => c.rank === kickerRank),
      ];
      return {
        category: HandCategory.TWO_PAIR,
        categoryName: 'Two Pair',
        score: this.computeScore(HandCategory.TWO_PAIR, [highPairRank, lowPairRank, kickerRank]),
        tieBreakers: [highPairRank, lowPairRank, kickerRank],
        bestFiveCards: ordered,
        description: `Two Pair, ${RANK_NAMES[highPairRank]}s and ${RANK_NAMES[lowPairRank]}s`,
      };
    }

    // 8. One Pair
    if (groups[0].count === 2) {
      const pairRank = groups[0].rank;
      const kickers = groups.slice(1).map(g => g.rank);
      const ordered = [
        ...sorted.filter(c => c.rank === pairRank),
        ...sorted.filter(c => c.rank !== pairRank),
      ];
      return {
        category: HandCategory.ONE_PAIR,
        categoryName: 'One Pair',
        score: this.computeScore(HandCategory.ONE_PAIR, [pairRank, ...kickers]),
        tieBreakers: [pairRank, ...kickers],
        bestFiveCards: ordered,
        description: `One Pair of ${RANK_NAMES[pairRank]}s`,
      };
    }

    // 9. High Card
    const tieBreakers = sorted.map(c => c.rank);
    return {
      category: HandCategory.HIGH_CARD,
      categoryName: 'High Card',
      score: this.computeScore(HandCategory.HIGH_CARD, tieBreakers),
      tieBreakers,
      bestFiveCards: sorted,
      description: `High Card, ${RANK_NAMES[sorted[0].rank]}`,
    };
  }

  /**
   * Helper to compute monotonically comparable integer score:
   * category * 10^10 + rank1 * 10^8 + rank2 * 10^6 + rank3 * 10^4 + rank4 * 10^2 + rank5
   */
  private static computeScore(category: HandCategory, ranks: number[]): number {
    let score = category * 10000000000;
    const multipliers = [100000000, 1000000, 10000, 100, 1];
    for (let i = 0; i < ranks.length && i < multipliers.length; i++) {
      score += ranks[i] * multipliers[i];
    }
    return score;
  }

  /**
   * Check for standard straight or 5-high (wheel) straight (A-2-3-4-5)
   */
  private static checkStraight(sorted: Card[]): {
    isStraight: boolean;
    highRank: Rank;
    orderedCards?: Card[];
  } {
    const ranks = sorted.map(c => c.rank);

    // Standard straight check: consecutive ranks
    let isStandard = true;
    for (let i = 0; i < 4; i++) {
      if (ranks[i] - ranks[i + 1] !== 1) {
        isStandard = false;
        break;
      }
    }
    if (isStandard) {
      return { isStraight: true, highRank: ranks[0] as Rank, orderedCards: sorted };
    }

    // Wheel check: Ace-2-3-4-5 (Ace is rank 14)
    if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
      // Re-order to 5, 4, 3, 2, A
      const ordered = [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]];
      return { isStraight: true, highRank: 5 as Rank, orderedCards: ordered };
    }

    return { isStraight: false, highRank: 2 as Rank };
  }

  /**
   * Generates combinations of size k from an array
   */
  private static getCombinations<T>(array: T[], k: number): T[][] {
    const result: T[][] = [];

    function combine(start: number, combo: T[]) {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < array.length; i++) {
        combo.push(array[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }

    combine(0, []);
    return result;
  }
}
