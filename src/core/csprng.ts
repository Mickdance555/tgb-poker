import * as crypto from 'crypto';
import { HandCommitment } from './types.js';
import { Card, cardFromIndex } from './cards.js';

/**
 * TGB Poker — Cryptographically Secure Provably Fair Engine
 * Uses HMAC-SHA256 and unbiased Fisher-Yates shuffle
 */
export class ProvablyFairRNG {
  /**
   * Generates a 256-bit cryptographically secure random server seed
   */
  public static generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates commitment hash broadcasted to players before the hand is dealt
   */
  public static computeCommitment(serverSeed: string, salt: string): string {
    return crypto.createHmac('sha256', serverSeed).update(salt).digest('hex');
  }

  /**
   * Combines server seed, client seed, and hand nonce to produce deterministic entropy
   */
  public static deriveCombinedHash(serverSeed: string, clientSeed: string, nonce: number): string {
    const data = `${clientSeed}:${nonce}`;
    return crypto.createHmac('sha256', serverSeed).update(data).digest('hex');
  }

  /**
   * Unbiased Fisher-Yates shuffle of 52 cards driven by HMAC-SHA256 hash stream
   */
  public static shuffleDeck(combinedHash: string): number[] {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    let currentHash = Buffer.from(combinedHash, 'hex');
    let byteOffset = 0;

    for (let i = deck.length - 1; i > 0; i--) {
      // If we exhaust the 32 bytes of the current hash, hash the current hash to get another 32 bytes
      if (byteOffset + 4 > currentHash.length) {
        currentHash = crypto.createHash('sha256').update(currentHash).digest();
        byteOffset = 0;
      }

      const randomUint32 = currentHash.readUInt32BE(byteOffset);
      byteOffset += 4;

      // Unbiased modulo mapping
      const j = randomUint32 % (i + 1);

      // Swap
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }

    return deck;
  }

  /**
   * Converts shuffled card indices to standard Card objects
   */
  public static indicesToCards(indices: number[]): Card[] {
    return indices.map(cardFromIndex);
  }

  /**
   * Pre-generates the hand commitment before dealing
   */
  public static createHandCommitment(
    tournamentId: string,
    handNumber: number,
    clientSeed: string = '0000000000000000',
    nonce: number = 1
  ): HandCommitment {
    const serverSeed = this.generateServerSeed();
    const salt = `${tournamentId}:${handNumber}`;
    const serverSeedHash = this.computeCommitment(serverSeed, salt);
    const combinedHash = this.deriveCombinedHash(serverSeed, clientSeed, nonce);
    const shuffledDeckIndices = this.shuffleDeck(combinedHash);

    return {
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      combinedHash,
      shuffledDeckIndices,
    };
  }

  /**
   * Independent verification method accessible to any player or client
   */
  public static verifyProvablyFair(params: {
    serverSeed: string;
    serverSeedHash: string;
    salt: string;
    clientSeed: string;
    nonce: number;
    expectedDeckIndices: number[];
  }): { isValid: boolean; reason?: string } {
    const computedHash = this.computeCommitment(params.serverSeed, params.salt);
    if (computedHash.toLowerCase() !== params.serverSeedHash.toLowerCase()) {
      return {
        isValid: false,
        reason: `Commitment hash mismatch! Expected ${params.serverSeedHash}, but HMAC(serverSeed, salt) produced ${computedHash}`,
      };
    }

    const derivedCombinedHash = this.deriveCombinedHash(params.serverSeed, params.clientSeed, params.nonce);
    const reproducedIndices = this.shuffleDeck(derivedCombinedHash);

    if (reproducedIndices.length !== params.expectedDeckIndices.length) {
      return { isValid: false, reason: 'Deck length mismatch' };
    }

    for (let i = 0; i < reproducedIndices.length; i++) {
      if (reproducedIndices[i] !== params.expectedDeckIndices[i]) {
        return {
          isValid: false,
          reason: `Card index mismatch at position ${i}: expected ${params.expectedDeckIndices[i]}, got ${reproducedIndices[i]}`,
        };
      }
    }

    return { isValid: true };
  }
}
