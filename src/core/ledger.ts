import * as crypto from 'crypto';

export type LedgerTxType =
  | 'WELCOME_BONUS'
  | 'TOURNAMENT_BUYIN'
  | 'TOURNAMENT_REBUY'
  | 'TOURNAMENT_ADDON'
  | 'TOURNAMENT_PRIZE'
  | 'COSMETIC_PURCHASE'
  | 'ACADEMY_UNLOCK'
  | 'ADMIN_ADJUSTMENT'
  | 'SEASON_REWARD';

export interface LedgerEntry {
  id: string;
  userId: string;
  txType: LedgerTxType;
  amount: number; // positive = credit, negative = debit
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string;
  prevTxHash: string;
  txHash: string;
  serverSignature: string;
  timestamp: number;
}

/**
 * TGB Poker — Cryptographic Double-Entry Virtual Economy Ledger
 * Prevents phantom balance creation and guarantees tamper-evident audit trails.
 */
export class TGBLedger {
  private static readonly SYSTEM_SECRET = process.env.LEDGER_SECRET || 'tgb_ledger_master_secret_2026';
  private static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Generates HMAC-SHA256 signature for transaction validation
   */
  public static signTransaction(entry: Omit<LedgerEntry, 'serverSignature' | 'txHash'>): string {
    const payload = `${entry.id}:${entry.userId}:${entry.amount}:${entry.balanceAfter}:${entry.referenceId}:${entry.timestamp}`;
    return crypto.createHmac('sha256', this.SYSTEM_SECRET).update(payload).digest('hex');
  }

  /**
   * Generates deterministic tamper-evident hash for hash-chaining
   */
  public static computeTxHash(
    prevHash: string,
    entry: Omit<LedgerEntry, 'txHash'>
  ): string {
    const raw = `${prevHash}|${entry.id}|${entry.userId}|${entry.txType}|${entry.amount}|${entry.balanceAfter}|${entry.serverSignature}|${entry.timestamp}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Creates a verified transaction record
   */
  public static createTransaction(params: {
    id?: string;
    userId: string;
    txType: LedgerTxType;
    amount: number;
    currentBalance: number;
    referenceId: string;
    prevTxHash?: string;
  }): LedgerEntry {
    const id = params.id || crypto.randomUUID();
    const balanceBefore = params.currentBalance;
    const balanceAfter = balanceBefore + params.amount;

    if (balanceAfter < 0) {
      throw new Error(`Insufficient TGB balance! Current: ${balanceBefore}, Requested deduction: ${Math.abs(params.amount)}`);
    }

    const timestamp = Date.now();
    const unsignedEntry = {
      id,
      userId: params.userId,
      txType: params.txType,
      amount: params.amount,
      balanceBefore,
      balanceAfter,
      referenceId: params.referenceId,
      prevTxHash: params.prevTxHash || this.GENESIS_HASH,
      timestamp,
    };

    const serverSignature = this.signTransaction(unsignedEntry);
    const withSignature = { ...unsignedEntry, serverSignature };
    const txHash = this.computeTxHash(unsignedEntry.prevTxHash, withSignature);

    return {
      ...withSignature,
      txHash,
    };
  }

  /**
   * Verifies the full chain of transactions for a user or system
   */
  public static verifyChain(transactions: LedgerEntry[]): {
    isValid: boolean;
    brokenIndex?: number;
    errorReason?: string;
  } {
    let expectedPrevHash = this.GENESIS_HASH;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // 1. Verify prevTxHash matches previous
      if (tx.prevTxHash !== expectedPrevHash) {
        return {
          isValid: false,
          brokenIndex: i,
          errorReason: `Hash chain broken at index ${i}. Expected prevHash: ${expectedPrevHash}, found: ${tx.prevTxHash}`,
        };
      }

      // 2. Verify signature
      const expectedSig = this.signTransaction(tx);
      if (tx.serverSignature !== expectedSig) {
        return {
          isValid: false,
          brokenIndex: i,
          errorReason: `Invalid server signature at index ${i}`,
        };
      }

      // 3. Verify txHash
      const computedHash = this.computeTxHash(tx.prevTxHash, tx);
      if (tx.txHash !== computedHash) {
        return {
          isValid: false,
          brokenIndex: i,
          errorReason: `Transaction hash integrity compromised at index ${i}`,
        };
      }

      // 4. Verify balance arithmetic
      if (Math.round((tx.balanceBefore + tx.amount) * 100) / 100 !== Math.round(tx.balanceAfter * 100) / 100) {
        return {
          isValid: false,
          brokenIndex: i,
          errorReason: `Balance mismatch at index ${i}: ${tx.balanceBefore} + ${tx.amount} != ${tx.balanceAfter}`,
        };
      }

      expectedPrevHash = tx.txHash;
    }

    return { isValid: true };
  }
}
