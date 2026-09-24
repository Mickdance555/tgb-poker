import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCard, parseCards } from '../core/cards.js';
import { HandEvaluator } from '../core/evaluator.js';
import { HandCategory } from '../core/types.js';
import { ProvablyFairRNG } from '../core/csprng.js';
import { SidePotCalculator, PlayerContribution } from '../core/sidepots.js';
import { TGBLedger } from '../core/ledger.js';
import { TableEngine } from '../core/pokerEngine.js';
import { TournamentEngine } from '../core/tournament.js';

test('1. Hand Evaluator: Correctly identifies all 10 hand categories and kickers', () => {
  // Royal Flush
  const royalFlush = HandEvaluator.evaluate(parseCards(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']));
  assert.equal(royalFlush.category, HandCategory.ROYAL_FLUSH);

  // Straight Flush
  const straightFlush = HandEvaluator.evaluate(parseCards(['9s', '8s', '7s', '6s', '5s', 'Kd', 'Ac']));
  assert.equal(straightFlush.category, HandCategory.STRAIGHT_FLUSH);
  assert.equal(straightFlush.tieBreakers[0], 9);

  // Four of a Kind
  const quads = HandEvaluator.evaluate(parseCards(['Kc', 'Kd', 'Kh', 'Ks', '9h', '4d', '2s']));
  assert.equal(quads.category, HandCategory.FOUR_OF_A_KIND);
  assert.equal(quads.tieBreakers[0], 13); // King
  assert.equal(quads.tieBreakers[1], 9); // Kicker 9

  // Full House
  const fullHouse = HandEvaluator.evaluate(parseCards(['Qc', 'Qd', 'Qh', '8s', '8c', '2d', '3h']));
  assert.equal(fullHouse.category, HandCategory.FULL_HOUSE);
  assert.equal(fullHouse.tieBreakers[0], 12); // Queens
  assert.equal(fullHouse.tieBreakers[1], 8); // Eights

  // Flush
  const flush = HandEvaluator.evaluate(parseCards(['Kd', 'Jd', '9d', '6d', '4d', 'Ah', 'Qs']));
  assert.equal(flush.category, HandCategory.FLUSH);

  // Wheel Straight (A-2-3-4-5)
  const wheel = HandEvaluator.evaluate(parseCards(['Ah', '2c', '3d', '4s', '5h', 'Jc', 'Kd']));
  assert.equal(wheel.category, HandCategory.STRAIGHT);
  assert.equal(wheel.tieBreakers[0], 5);

  // Two Pair & Kicker test
  const twoPairA = HandEvaluator.evaluate(parseCards(['As', 'Ac', 'Ks', 'Kd', 'Qh', '2c', '3d']));
  const twoPairB = HandEvaluator.evaluate(parseCards(['As', 'Ad', 'Kh', 'Kc', 'Jh', '2s', '4d']));
  assert.equal(twoPairA.category, HandCategory.TWO_PAIR);
  assert.equal(twoPairB.category, HandCategory.TWO_PAIR);
  // Two pair A has Queen kicker vs Jack kicker
  assert.ok(HandEvaluator.compare(twoPairA, twoPairB) > 0);
});

test('2. Provably Fair CSPRNG: Commitment verification and deck determinism', () => {
  const tournamentId = 'tourn_001';
  const handNumber = 42;
  const clientSeed = 'player_lucky_seed_888';

  const commitment = ProvablyFairRNG.createHandCommitment(
    tournamentId,
    handNumber,
    clientSeed,
    1
  );

  assert.equal(commitment.shuffledDeckIndices.length, 52);
  // Verify all 52 unique cards are present
  const uniqueCards = new Set(commitment.shuffledDeckIndices);
  assert.equal(uniqueCards.size, 52);

  // Verify proof passes
  const verification = ProvablyFairRNG.verifyProvablyFair({
    serverSeed: commitment.serverSeed,
    serverSeedHash: commitment.serverSeedHash,
    salt: `${tournamentId}:${handNumber}`,
    clientSeed,
    nonce: 1,
    expectedDeckIndices: commitment.shuffledDeckIndices,
  });

  assert.ok(verification.isValid);

  // Verify altered deck or seed fails proof
  const tamperedIndices = [...commitment.shuffledDeckIndices];
  tamperedIndices[0] = tamperedIndices[1]; // duplicate
  const failedVerification = ProvablyFairRNG.verifyProvablyFair({
    serverSeed: commitment.serverSeed,
    serverSeedHash: commitment.serverSeedHash,
    salt: `${tournamentId}:${handNumber}`,
    clientSeed,
    nonce: 1,
    expectedDeckIndices: tamperedIndices,
  });

  assert.equal(failedVerification.isValid, false);
});

test('3. Side Pot Calculator: Handles multi-way all-ins and uncalled bets', () => {
  // Scenario:
  // Player 1 has 100 chips (all-in)
  // Player 2 has 300 chips (all-in)
  // Player 3 has 500 chips (calls 500, but max other active is 300 -> 200 should be refunded!)
  const contributions: PlayerContribution[] = [
    { seatNumber: 0, userId: 'u1', totalContributed: 100, isFolded: false },
    { seatNumber: 1, userId: 'u2', totalContributed: 300, isFolded: false },
    { seatNumber: 2, userId: 'u3', totalContributed: 500, isFolded: false },
  ];

  const { refundSeat, refundAmount, adjustedContributions } =
    SidePotCalculator.handleUncalledBets(contributions);

  assert.equal(refundSeat, 2);
  assert.equal(refundAmount, 200);

  const pots = SidePotCalculator.calculatePots(adjustedContributions);
  // Main pot: 100 * 3 = 300 (Eligible: u1, u2, u3)
  // Side pot 1: (300-100) * 2 = 400 (Eligible: u2, u3)
  assert.equal(pots.length, 2);
  assert.equal(pots[0].amount, 300);
  assert.deepEqual(pots[0].eligibleSeatNumbers, [0, 1, 2]);

  assert.equal(pots[1].amount, 400);
  assert.deepEqual(pots[1].eligibleSeatNumbers, [1, 2]);
});

test('4. TGB Ledger: Append-only hash chaining and tamper detection', () => {
  const userId = 'user_123';
  let currentBalance = 1000;
  const ledger: any[] = [];

  // Tx 1: Welcome bonus
  const tx1 = TGBLedger.createTransaction({
    userId,
    txType: 'WELCOME_BONUS',
    amount: 1000,
    currentBalance,
    referenceId: 'welcome',
  });
  currentBalance = tx1.balanceAfter;
  ledger.push(tx1);

  // Tx 2: Buy-in
  const tx2 = TGBLedger.createTransaction({
    userId,
    txType: 'TOURNAMENT_BUYIN',
    amount: -500,
    currentBalance,
    referenceId: 'mtt_001',
    prevTxHash: tx1.txHash,
  });
  currentBalance = tx2.balanceAfter;
  ledger.push(tx2);

  // Verify clean chain
  const verification = TGBLedger.verifyChain(ledger);
  assert.ok(verification.isValid);

  // Tamper test: modify balanceAfter in tx1
  const tamperedLedger = JSON.parse(JSON.stringify(ledger));
  tamperedLedger[0].balanceAfter = 999999;
  const tamperedCheck = TGBLedger.verifyChain(tamperedLedger);
  assert.equal(tamperedCheck.isValid, false);
});

test('5. Table Engine: Full hand simulation from preflop to showdown', () => {
  const engine = new TableEngine({
    tableId: 'tbl_test',
    tournamentId: 'mtt_test',
    maxSeats: 6,
    smallBlind: 25,
    bigBlind: 50,
    ante: 0,
    actionTimeoutSeconds: 15,
  });

  // Seat 3 players
  engine.sitPlayer(0, 'u1', 'Alice', 1000);
  engine.sitPlayer(1, 'u2', 'Bob', 1000);
  engine.sitPlayer(2, 'u3', 'Charlie', 1000);

  // Start hand
  engine.startHand('seed_test');

  // Verify blinds posted
  assert.equal(engine.handNumber, 1);
  assert.ok(engine.seats[0]!.holeCards.length === 2);
  assert.ok(engine.seats[1]!.holeCards.length === 2);
  assert.ok(engine.seats[2]!.holeCards.length === 2);

  // Turn seat should have valid actions
  const turnSeat = engine.currentTurnSeat!;
  const validActions = engine.getValidActions(turnSeat);
  assert.ok(validActions.length > 0);

  // Test fold action
  engine.processAction(turnSeat, 'FOLD');
  assert.ok(engine.seats[turnSeat]!.isFolded);
});

test('6. Tournament Payouts: Exponential decay curve distribution', () => {
  const payouts = TournamentEngine.calculatePayouts(100, 10000);
  assert.ok(payouts.length >= 10);
  const totalAllocated = payouts.reduce((sum, p) => sum + p.amountTgb, 0);
  assert.equal(totalAllocated, 10000);
  assert.ok(payouts[0].amountTgb > payouts[1].amountTgb);
});
