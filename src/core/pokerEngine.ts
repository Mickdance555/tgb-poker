import { Card } from './types.js';
import {
  ActionRecord,
  ActionType,
  HandCommitment,
  HandResult,
  HandStage,
  PlayerSeat,
  SidePot,
  ValidAction,
} from './types.js';
import { cardFromIndex } from './cards.js';
import { ProvablyFairRNG } from './csprng.js';
import { HandEvaluator } from './evaluator.js';
import { PlayerContribution, SidePotCalculator } from './sidepots.js';

export interface TableConfig {
  tableId: string;
  tournamentId: string;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  actionTimeoutSeconds: number;
}

/**
 * TGB Poker — Server-Authoritative Deterministic Table Engine
 * Manages full hand lifecycles, action validation, community cards, and showdown settlements.
 */
export class TableEngine {
  public config: TableConfig;
  public seats: (PlayerSeat | null)[];
  public dealerSeat: number;
  public smallBlindSeat: number;
  public bigBlindSeat: number;
  public currentTurnSeat: number | null;
  public stage: HandStage;
  public handNumber: number;
  public currentCommitment: HandCommitment | null;
  public deck: Card[];
  public deckIndex: number;
  public communityCards: Card[];
  public pots: SidePot[];
  public currentHighestBet: number;
  public minRaiseAmount: number;
  public lastRaiseDifference: number;
  public actionHistory: ActionRecord[];
  public lastHandResult: HandResult | null;

  constructor(config: TableConfig) {
    this.config = config;
    this.seats = Array.from({ length: config.maxSeats }, () => null);
    this.dealerSeat = 0;
    this.smallBlindSeat = 0;
    this.bigBlindSeat = 0;
    this.currentTurnSeat = null;
    this.stage = HandStage.COMPLETED;
    this.handNumber = 0;
    this.currentCommitment = null;
    this.deck = [];
    this.deckIndex = 0;
    this.communityCards = [];
    this.pots = [];
    this.currentHighestBet = 0;
    this.minRaiseAmount = 0;
    this.lastRaiseDifference = 0;
    this.actionHistory = [];
    this.lastHandResult = null;
  }

  /**
   * Add player to a specific seat (0-indexed)
   */
  public sitPlayer(seatNumber: number, userId: string, username: string, chips: number): void {
    if (seatNumber < 0 || seatNumber >= this.config.maxSeats) {
      throw new Error(`Invalid seat number ${seatNumber}`);
    }
    if (this.seats[seatNumber] !== null) {
      throw new Error(`Seat ${seatNumber} is already occupied`);
    }
    this.seats[seatNumber] = {
      seatNumber,
      userId,
      username,
      chips,
      currentBet: 0,
      roundContribution: 0,
      totalHandContribution: 0,
      holeCards: [],
      isFolded: false,
      isAllIn: false,
      isSittingOut: false,
      hasActedInRound: false,
      timeBankSeconds: 30,
    };
  }

  /**
   * Remove player from table
   */
  public standPlayer(seatNumber: number): PlayerSeat | null {
    const player = this.seats[seatNumber];
    this.seats[seatNumber] = null;
    return player;
  }

  public getActivePlayersWithChips(): PlayerSeat[] {
    return this.seats.filter(
      (s): s is PlayerSeat => s !== null && s.chips > 0 && !s.isSittingOut
    );
  }

  /**
   * Starts a brand new hand:
   * 1. Generates Provably Fair Commitment
   * 2. Moves dealer button clockwise
   * 3. Posts Blinds and Antes
   * 4. Deals 2 hole cards to each active player
   * 5. Sets turn to first player
   */
  public startHand(clientSeed: string = 'client_seed_default'): HandCommitment {
    const activePlayers = this.getActivePlayersWithChips();
    if (activePlayers.length < 2) {
      throw new Error('Cannot start hand: At least 2 active players with chips required');
    }

    this.handNumber++;
    this.stage = HandStage.PREFLOP;
    this.actionHistory = [];
    this.communityCards = [];
    this.pots = [];
    this.lastHandResult = null;

    // Reset player hand states
    for (const seat of this.seats) {
      if (seat) {
        seat.currentBet = 0;
        seat.roundContribution = 0;
        seat.totalHandContribution = 0;
        seat.holeCards = [];
        seat.isFolded = false;
        seat.isAllIn = false;
        seat.hasActedInRound = false;
      }
    }

    // 1. Provably Fair CSPRNG Deck Generation
    this.currentCommitment = ProvablyFairRNG.createHandCommitment(
      this.config.tournamentId,
      this.handNumber,
      clientSeed,
      this.handNumber
    );
    this.deck = this.currentCommitment.shuffledDeckIndices.map(cardFromIndex);
    this.deckIndex = 0;

    // 2. Button Movement (Dealer, SB, BB)
    this.rotatePositions(activePlayers);

    // 3. Post Blinds & Ante
    this.postBlindsAndAntes();

    // 4. Deal Hole Cards
    for (let c = 0; c < 2; c++) {
      for (const player of activePlayers) {
        player.holeCards.push(this.deck[this.deckIndex++]);
      }
    }

    // 5. Preflop action begins after Big Blind (or Dealer in Heads-Up)
    if (activePlayers.length === 2) {
      this.currentTurnSeat = this.dealerSeat; // Heads up: Dealer is SB and acts first preflop
    } else {
      this.currentTurnSeat = this.getNextActiveSeat(this.bigBlindSeat);
    }

    return this.currentCommitment;
  }

  /**
   * Rotate Dealer, Small Blind, and Big Blind positions
   */
  private rotatePositions(activePlayers: PlayerSeat[]): void {
    if (this.dealerSeat === 0 && this.handNumber === 1) {
      this.dealerSeat = activePlayers[0].seatNumber;
    } else {
      this.dealerSeat = this.getNextActiveSeat(this.dealerSeat);
    }

    if (activePlayers.length === 2) {
      // Heads-up rules: Dealer is Small Blind, other player is Big Blind
      this.smallBlindSeat = this.dealerSeat;
      this.bigBlindSeat = this.getNextActiveSeat(this.dealerSeat);
    } else {
      this.smallBlindSeat = this.getNextActiveSeat(this.dealerSeat);
      this.bigBlindSeat = this.getNextActiveSeat(this.smallBlindSeat);
    }
  }

  /**
   * Automatically post blinds and table ante
   */
  private postBlindsAndAntes(): void {
    // 1. Ante from all active players if configured
    if (this.config.ante > 0) {
      for (const player of this.getActivePlayersWithChips()) {
        const anteAmount = Math.min(player.chips, this.config.ante);
        player.chips -= anteAmount;
        player.totalHandContribution += anteAmount;
        if (player.chips === 0) player.isAllIn = true;

        this.recordAction(player.seatNumber, 'POST_ANTE', anteAmount);
      }
    }

    // 2. Small Blind
    const sbPlayer = this.seats[this.smallBlindSeat]!;
    const sbAmount = Math.min(sbPlayer.chips, this.config.smallBlind);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    sbPlayer.roundContribution = sbAmount;
    sbPlayer.totalHandContribution += sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;
    this.recordAction(this.smallBlindSeat, 'POST_SB', sbAmount);

    // 3. Big Blind
    const bbPlayer = this.seats[this.bigBlindSeat]!;
    const bbAmount = Math.min(bbPlayer.chips, this.config.bigBlind);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    bbPlayer.roundContribution = bbAmount;
    bbPlayer.totalHandContribution += bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
    this.recordAction(this.bigBlindSeat, 'POST_BB', bbAmount);

    this.currentHighestBet = Math.max(sbAmount, bbAmount);
    this.lastRaiseDifference = this.config.bigBlind;
    this.minRaiseAmount = this.currentHighestBet + this.lastRaiseDifference;
  }

  /**
   * Determine valid actions available to a player
   */
  public getValidActions(seatNumber: number): ValidAction[] {
    const player = this.seats[seatNumber];
    if (!player || player.isFolded || player.isAllIn || this.currentTurnSeat !== seatNumber) {
      return [];
    }

    const actions: ValidAction[] = [{ action: 'FOLD' }];
    const callDiff = this.currentHighestBet - player.currentBet;

    // Check vs Call
    if (callDiff === 0) {
      actions.push({ action: 'CHECK' });
    } else {
      const callAmount = Math.min(player.chips, callDiff);
      actions.push({ action: 'CALL', callAmount });
    }

    // Bet vs Raise
    if (player.chips > callDiff) {
      const isBet = this.currentHighestBet === 0;
      const actionType: ActionType = isBet ? 'BET' : 'RAISE';
      const minAmount = Math.min(
        player.chips + player.currentBet,
        isBet ? this.config.bigBlind : this.minRaiseAmount
      );
      const maxAmount = player.chips + player.currentBet;

      actions.push({
        action: actionType,
        minAmount,
        maxAmount,
      });
    }

    // All-in is always available if chips remain
    if (player.chips > 0) {
      actions.push({
        action: 'ALL_IN',
        minAmount: player.chips + player.currentBet,
        maxAmount: player.chips + player.currentBet,
      });
    }

    return actions;
  }

  /**
   * Processes a validated player action
   */
  public processAction(seatNumber: number, action: ActionType, amount: number = 0): void {
    if (this.currentTurnSeat !== seatNumber) {
      throw new Error(`Out of turn: Seat ${seatNumber} attempted action but it is Seat ${this.currentTurnSeat}'s turn`);
    }

    const player = this.seats[seatNumber];
    if (!player) throw new Error(`No player in seat ${seatNumber}`);

    const validActions = this.getValidActions(seatNumber);
    const isValid = validActions.some(v => v.action === action);
    if (!isValid) {
      throw new Error(`Action ${action} is illegal for seat ${seatNumber}`);
    }

    player.hasActedInRound = true;

    switch (action) {
      case 'FOLD': {
        player.isFolded = true;
        this.recordAction(seatNumber, 'FOLD', 0);
        break;
      }

      case 'CHECK': {
        if (player.currentBet !== this.currentHighestBet) {
          throw new Error('Cannot check: Current bet does not match highest bet');
        }
        this.recordAction(seatNumber, 'CHECK', 0);
        break;
      }

      case 'CALL': {
        const toCall = Math.min(player.chips, this.currentHighestBet - player.currentBet);
        player.chips -= toCall;
        player.currentBet += toCall;
        player.roundContribution += toCall;
        player.totalHandContribution += toCall;
        if (player.chips === 0) player.isAllIn = true;
        this.recordAction(seatNumber, 'CALL', toCall);
        break;
      }

      case 'BET':
      case 'RAISE': {
        const targetTotalBet = amount;
        const additionalChips = targetTotalBet - player.currentBet;
        if (additionalChips > player.chips) {
          throw new Error(`Insufficient chips for raise to ${amount}`);
        }

        const raiseDiff = targetTotalBet - this.currentHighestBet;
        if (raiseDiff >= this.lastRaiseDifference) {
          this.lastRaiseDifference = raiseDiff;
        }

        player.chips -= additionalChips;
        player.currentBet = targetTotalBet;
        player.roundContribution += additionalChips;
        player.totalHandContribution += additionalChips;
        this.currentHighestBet = targetTotalBet;
        this.minRaiseAmount = this.currentHighestBet + this.lastRaiseDifference;

        if (player.chips === 0) player.isAllIn = true;

        // When someone raises, all other active players must act again
        for (const s of this.seats) {
          if (s && s.seatNumber !== seatNumber && !s.isFolded && !s.isAllIn) {
            s.hasActedInRound = false;
          }
        }

        this.recordAction(seatNumber, action, additionalChips);
        break;
      }

      case 'ALL_IN': {
        const allInTotal = player.chips + player.currentBet;
        const chipsToPut = player.chips;

        if (allInTotal > this.currentHighestBet) {
          const raiseDiff = allInTotal - this.currentHighestBet;
          if (raiseDiff >= this.lastRaiseDifference) {
            this.lastRaiseDifference = raiseDiff;
            // Full raise re-opens action for others
            for (const s of this.seats) {
              if (s && s.seatNumber !== seatNumber && !s.isFolded && !s.isAllIn) {
                s.hasActedInRound = false;
              }
            }
          }
          this.currentHighestBet = allInTotal;
          this.minRaiseAmount = this.currentHighestBet + this.lastRaiseDifference;
        }

        player.chips = 0;
        player.currentBet = allInTotal;
        player.roundContribution += chipsToPut;
        player.totalHandContribution += chipsToPut;
        player.isAllIn = true;

        this.recordAction(seatNumber, 'ALL_IN', chipsToPut);
        break;
      }

      default:
        throw new Error(`Unhandled action type: ${action}`);
    }

    // Check if only one player remains uncontested (everyone else folded)
    const nonFolded = this.seats.filter((s): s is PlayerSeat => s !== null && !s.isFolded);
    if (nonFolded.length === 1) {
      this.resolveSinglePlayerWin(nonFolded[0]);
      return;
    }

    // Check if betting round has concluded
    if (this.isBettingRoundComplete()) {
      this.advanceStage();
    } else {
      this.currentTurnSeat = this.getNextTurnSeat();
    }
  }

  /**
   * Checks whether the current betting round has finished
   */
  private isBettingRoundComplete(): boolean {
    const activeContenders = this.seats.filter(
      (s): s is PlayerSeat => s !== null && !s.isFolded && !s.isAllIn
    );

    // If 0 or 1 player has chips left to bet, no further betting can occur
    if (activeContenders.length <= 1) {
      // Check if that 1 player has called or checked
      if (activeContenders.length === 1) {
        const p = activeContenders[0];
        if (p.currentBet === this.currentHighestBet && p.hasActedInRound) {
          return true;
        }
        return false;
      }
      return true;
    }

    // All active players must have acted AND their currentBet must equal currentHighestBet
    return activeContenders.every(
      p => p.hasActedInRound && p.currentBet === this.currentHighestBet
    );
  }

  /**
   * Advances the game stage (FLOP, TURN, RIVER, SHOWDOWN)
   */
  private advanceStage(): void {
    // Reset round bets
    for (const s of this.seats) {
      if (s) {
        s.currentBet = 0;
        s.hasActedInRound = false;
      }
    }
    this.currentHighestBet = 0;
    this.lastRaiseDifference = this.config.bigBlind;
    this.minRaiseAmount = this.config.bigBlind;

    // Check if 2 or more players are still in, but all or all-but-one are all-in
    const activeWithChips = this.seats.filter(
      (s): s is PlayerSeat => s !== null && !s.isFolded && !s.isAllIn
    );

    if (this.stage === HandStage.PREFLOP) {
      this.stage = HandStage.FLOP;
      this.deckIndex++; // Burn card
      this.communityCards.push(
        this.deck[this.deckIndex++],
        this.deck[this.deckIndex++],
        this.deck[this.deckIndex++]
      );
    } else if (this.stage === HandStage.FLOP) {
      this.stage = HandStage.TURN;
      this.deckIndex++; // Burn card
      this.communityCards.push(this.deck[this.deckIndex++]);
    } else if (this.stage === HandStage.TURN) {
      this.stage = HandStage.RIVER;
      this.deckIndex++; // Burn card
      this.communityCards.push(this.deck[this.deckIndex++]);
    } else if (this.stage === HandStage.RIVER) {
      this.resolveShowdown();
      return;
    }

    // If 0 or 1 active players with chips can bet, run out the rest of the board to showdown
    if (activeWithChips.length <= 1) {
      while (this.communityCards.length < 5) {
        this.deckIndex++; // Burn card
        this.communityCards.push(this.deck[this.deckIndex++]);
      }
      this.resolveShowdown();
      return;
    }

    // Action starts from first active player to the left of the button
    this.currentTurnSeat = this.getNextActiveSeat(this.dealerSeat);
  }

  /**
   * Resolves hand when only 1 player did not fold
   */
  private resolveSinglePlayerWin(winner: PlayerSeat): void {
    const contributions = this.buildContributions();
    const { refundSeat, refundAmount, adjustedContributions } =
      SidePotCalculator.handleUncalledBets(contributions);

    if (refundSeat !== undefined && refundAmount > 0) {
      const refundPlayer = this.seats[refundSeat]!;
      refundPlayer.chips += refundAmount;
    }

    const totalPot = adjustedContributions.reduce((sum, c) => sum + c.totalContributed, 0);
    winner.chips += totalPot;

    this.lastHandResult = {
      handId: `${this.config.tableId}_${this.handNumber}`,
      tableId: this.config.tableId,
      communityCards: this.communityCards,
      pots: [
        {
          potIndex: 0,
          amount: totalPot,
          eligibleSeatNumbers: [winner.seatNumber],
          winningSeats: [winner.seatNumber],
          payoutPerWinner: totalPot,
          remainderChips: 0,
        },
      ],
      totalPot,
      winners: [
        {
          seatNumber: winner.seatNumber,
          userId: winner.userId,
          chipsWon: totalPot,
        },
      ],
      revealedHoleCards: [],
      serverSeed: this.currentCommitment!.serverSeed,
      serverSeedHash: this.currentCommitment!.serverSeedHash,
      clientSeed: this.currentCommitment!.clientSeed,
      nonce: this.currentCommitment!.nonce,
    };

    this.stage = HandStage.COMPLETED;
    this.currentTurnSeat = null;
  }

  /**
   * Resolves standard showdown with 7-card evaluator and side pots
   */
  private resolveShowdown(): void {
    this.stage = HandStage.SHOWDOWN;
    const contributions = this.buildContributions();

    // 1. Return uncalled bet excess
    const { refundSeat, refundAmount, adjustedContributions } =
      SidePotCalculator.handleUncalledBets(contributions);

    if (refundSeat !== undefined && refundAmount > 0) {
      const refundPlayer = this.seats[refundSeat]!;
      refundPlayer.chips += refundAmount;
    }

    // 2. Evaluate hands for all non-folded players
    for (const playerContrib of adjustedContributions) {
      if (!playerContrib.isFolded) {
        const seat = this.seats[playerContrib.seatNumber]!;
        const allCards = [...seat.holeCards, ...this.communityCards];
        playerContrib.handEvaluation = HandEvaluator.evaluate(allCards);
      }
    }

    // 3. Build side pots
    const calculatedPots = SidePotCalculator.calculatePots(adjustedContributions);

    // 4. Distribute pots
    const seatOrder = this.seats.filter((s): s is PlayerSeat => s !== null).map(s => s.seatNumber);
    const { awards, updatedPots } = SidePotCalculator.distributePots(
      calculatedPots,
      adjustedContributions,
      this.dealerSeat,
      seatOrder
    );

    // 5. Credit chips to winners
    const winnersAggregated: Record<number, { chipsWon: number; evaluation?: any }> = {};
    for (const award of awards) {
      const seat = this.seats[award.seatNumber]!;
      seat.chips += award.chipsWon;
      if (!winnersAggregated[award.seatNumber]) {
        winnersAggregated[award.seatNumber] = { chipsWon: 0 };
      }
      winnersAggregated[award.seatNumber].chipsWon += award.chipsWon;
    }

    const totalPot = updatedPots.reduce((sum, p) => sum + p.amount, 0);

    // Revealed hole cards for showdown players
    const revealed = adjustedContributions
      .filter(c => !c.isFolded)
      .map(c => {
        const s = this.seats[c.seatNumber]!;
        return {
          seatNumber: s.seatNumber,
          userId: s.userId,
          cards: s.holeCards,
          handDescription: c.handEvaluation?.description || '',
        };
      });

    this.lastHandResult = {
      handId: `${this.config.tableId}_${this.handNumber}`,
      tableId: this.config.tableId,
      communityCards: this.communityCards,
      pots: updatedPots,
      totalPot,
      winners: Object.entries(winnersAggregated).map(([seatStr, data]) => {
        const seatNum = parseInt(seatStr, 10);
        const seat = this.seats[seatNum]!;
        const contrib = adjustedContributions.find(c => c.seatNumber === seatNum);
        return {
          seatNumber: seatNum,
          userId: seat.userId,
          chipsWon: data.chipsWon,
          handEvaluation: contrib?.handEvaluation,
          winningCards: contrib?.handEvaluation?.bestFiveCards,
        };
      }),
      revealedHoleCards: revealed,
      serverSeed: this.currentCommitment!.serverSeed,
      serverSeedHash: this.currentCommitment!.serverSeedHash,
      clientSeed: this.currentCommitment!.clientSeed,
      nonce: this.currentCommitment!.nonce,
    };

    this.stage = HandStage.COMPLETED;
    this.currentTurnSeat = null;
  }

  private buildContributions(): PlayerContribution[] {
    return this.seats
      .filter((s): s is PlayerSeat => s !== null)
      .map(s => ({
        seatNumber: s.seatNumber,
        userId: s.userId,
        totalContributed: s.totalHandContribution,
        isFolded: s.isFolded,
      }));
  }

  private getNextTurnSeat(): number {
    return this.getNextActiveSeat(this.currentTurnSeat!);
  }

  private getNextActiveSeat(fromSeat: number): number {
    for (let i = 1; i <= this.config.maxSeats; i++) {
      const nextSeat = (fromSeat + i) % this.config.maxSeats;
      const player = this.seats[nextSeat];
      if (player && !player.isFolded && !player.isAllIn && player.chips > 0) {
        return nextSeat;
      }
    }
    return fromSeat;
  }

  private recordAction(seatNumber: number, action: ActionType, amount: number): void {
    const player = this.seats[seatNumber]!;
    const pot = this.seats
      .filter((s): s is PlayerSeat => s !== null)
      .reduce((sum, s) => sum + s.totalHandContribution, 0);

    this.actionHistory.push({
      seq: this.actionHistory.length + 1,
      stage: this.stage,
      seatNumber,
      userId: player.userId,
      action,
      amount,
      potAfter: pot,
      playerChipsAfter: player.chips,
      timestamp: Date.now(),
    });
  }
}
