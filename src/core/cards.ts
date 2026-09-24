import { Card, Rank, Suit } from './types.js';

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const RANK_NAMES: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

export const RANK_CHARS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export const SUIT_NAMES: Record<Suit, string> = {
  s: 'Spades',
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
};

/**
 * Standard 52-card deck ordered 0..51
 */
export const FULL_DECK: Card[] = [];

for (let rIdx = 0; rIdx < RANKS.length; rIdx++) {
  for (let sIdx = 0; sIdx < SUITS.length; sIdx++) {
    const rank = RANKS[rIdx];
    const suit = SUITS[sIdx];
    const code = `${RANK_CHARS[rank]}${suit}`;
    const index = rIdx * 4 + sIdx;
    FULL_DECK.push({ rank, suit, code, index });
  }
}

/**
 * Parse card code like "Ah", "Kd", "Ts", "2c" to Card
 */
export function parseCard(code: string): Card {
  const normalized = code.trim();
  if (normalized.length !== 2) {
    throw new Error(`Invalid card code: ${code}`);
  }
  const rChar = normalized[0].toUpperCase();
  const suit = normalized[1].toLowerCase() as Suit;

  if (!SUITS.includes(suit)) {
    throw new Error(`Invalid suit in card code: ${code}`);
  }

  let rank: Rank;
  if (rChar === 'A') rank = 14;
  else if (rChar === 'K') rank = 13;
  else if (rChar === 'Q') rank = 12;
  else if (rChar === 'J') rank = 11;
  else if (rChar === 'T') rank = 10;
  else {
    const num = parseInt(rChar, 10);
    if (isNaN(num) || num < 2 || num > 9) {
      throw new Error(`Invalid rank in card code: ${code}`);
    }
    rank = num as Rank;
  }

  const found = FULL_DECK.find(c => c.rank === rank && c.suit === suit);
  if (!found) {
    throw new Error(`Card not found in standard deck: ${code}`);
  }
  return found;
}

export function parseCards(codes: string[]): Card[] {
  return codes.map(parseCard);
}

export function cardFromIndex(index: number): Card {
  if (index < 0 || index >= 52) {
    throw new Error(`Card index out of range 0..51: ${index}`);
  }
  return FULL_DECK[index];
}
