/**
 * TGB Poker — Core Domain Types and Data Contracts
 * Server Authoritative, Deterministic Hold'em Specification
 */

export type Suit = 's' | 'h' | 'd' | 'c'; // spades, hearts, diamonds, clubs
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export interface Card {
  rank: Rank;
  suit: Suit;
  code: string; // e.g. "Ah", "Ks", "Td", "2c"
  index: number; // 0 to 51
}

export enum HandCategory {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

export interface HandEvaluation {
  category: HandCategory;
  categoryName: string;
  score: number; // Lexicographically comparable score
  tieBreakers: number[]; // Ranks for tie-breaking
  bestFiveCards: Card[];
  description: string;
}

export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN' | 'POST_SB' | 'POST_BB' | 'POST_ANTE';

export interface ValidAction {
  action: ActionType;
  minAmount?: number;
  maxAmount?: number;
  callAmount?: number;
}

export enum HandStage {
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
  COMPLETED = 'COMPLETED',
}

export interface PlayerSeat {
  seatNumber: number;
  userId: string;
  username: string;
  chips: number;
  currentBet: number;
  roundContribution: number;
  totalHandContribution: number;
  holeCards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  hasActedInRound: boolean;
  timeBankSeconds: number;
}

export interface SidePot {
  potIndex: number;
  amount: number;
  eligibleSeatNumbers: number[];
  winningSeats: number[];
  payoutPerWinner: number;
  remainderChips: number;
}

export interface HandCommitment {
  serverSeed: string; // Revealed after hand completes
  serverSeedHash: string; // Published before deal: HMAC-SHA256(serverSeed, salt)
  clientSeed: string;
  nonce: number;
  combinedHash: string;
  shuffledDeckIndices: number[];
}

export interface ActionRecord {
  seq: number;
  stage: HandStage;
  seatNumber: number;
  userId: string;
  action: ActionType;
  amount: number;
  potAfter: number;
  playerChipsAfter: number;
  timestamp: number;
}

export interface HandResult {
  handId: string;
  tableId: string;
  communityCards: Card[];
  pots: SidePot[];
  totalPot: number;
  winners: {
    seatNumber: number;
    userId: string;
    chipsWon: number;
    handEvaluation?: HandEvaluation;
    winningCards?: Card[];
  }[];
  revealedHoleCards: {
    seatNumber: number;
    userId: string;
    cards: Card[];
    handDescription: string;
  }[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}
