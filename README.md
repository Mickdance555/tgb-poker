# TGB POKER — Provably Fair Real-Time MTT Platform

> **Engine & Web Application Specification:** Version 1.0.0-PROD  
> **Location:** `E:\tgb-poker`

---

## 🌟 Highlights & Implemented Features

1. **Provably Fair CSPRNG Commit-Reveal:**
   - 256-bit cryptographically secure server seeds.
   - Pre-deal commitment hash via HMAC-SHA256 broadcast before dealing hole cards.
   - Unbiased Fisher-Yates 52-card shuffle driven by entropy stream.
   - Independent verification suite allowing any player to verify every deal.
2. **Deterministic 7-Card Texas Hold'em Engine:**
   - Evaluates all 10 hand rankings (High card to Royal Flush) with kickers and wheel straight (A-2-3-4-5) support.
   - Side Pot calculation engine with uncalled bet refunds and odd chip clockwise remainder distribution.
   - Complete betting round state machine (Preflop, Flop, Turn, River, Showdown).
3. **TGB Double-Entry Ledger System:**
   - Immutable append-only audit trail (`wallet_transactions`).
   - Monotonic hash-chaining (`SHA256(prevHash + ...)`).
   - HMAC-SHA256 server signatures on all balance changes.
4. **Tournament Director (MTT Engine):**
   - Standard & Turbo blind schedules.
   - Exponential decay ICM payout matrix.
   - Table balancing algorithm maintaining $\le 1$ player delta across tables.
5. **Firebase Cloud Integration (Auth & Firestore):**
   - **Google Sign-In & Email Authentication:** 1-Click login with Google or email/password account creation.
   - **Cloud Firestore Real-Time Sync:** Player profiles, avatar, level, TGB balance, and ledger transactions synced in real-time.
   - **Custom Firebase Config UI:** Connect your own Firebase project from the web interface or `.env` file without modifying source code.
6. **Interactive Web Application (`public/`):**
   - **Tournament Lobby:** Filter and join live MTT events, Freerolls, and Turbo Bounties.
   - **Interactive Felt Poker Table:** 6-Max radial table layout, card flip animations, synthesized Web Audio sound FX (cards, chips, win chords), and raise slider with standard poker presets (Min, 2.5BB, 1/2 Pot, Pot, All-in).
   - **AI Poker Academy & Exam:** Interactive promotion exam simulations with EV differential feedback.
   - **Profile & Style Analytics:** Real VPIP, PFR, and 3-Bet radar metrics.
   - **TGB Wallet & Faucet:** Live ledger viewer and free training TGB claim button.

---

## 🔥 Firebase Setup Guide (3 Simple Steps)

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (under *Sign-in method*, enable **Google** and **Email/Password**).
3. Enable **Cloud Firestore** in test mode.
4. Copy your Web App config object into `E:\tgb-poker\public\firebase-config.js` or click the **"Sign In / Firebase"** button on the web app navbar and paste your config into the **Custom Firebase Credentials** box!

---

## 🚀 How to Run the Web Application

### Option A: Open directly in your browser (Instant Play)
Double-click or open `E:\tgb-poker\public\index.html` in Chrome, Edge, or Firefox. The built-in client engine and AI bots will start immediately with full sound effects and animations!

### Option B: Run via Node.js
```bash
cd E:\tgb-poker
npm install
node --loader ts-node/esm src/server/server.ts
```
Then navigate to `http://localhost:4000`.

### Option C: Run Unit Tests
```bash
cd E:\tgb-poker
node --test dist/tests/all.test.js
```

---

## 📁 Project Architecture & File Map

```
E:\tgb-poker/
├── package.json                   # Project scripts and dependencies
├── tsconfig.json                  # TypeScript compiler settings
├── README.md                      # Documentation & Quickstart
├── src/
│   ├── core/
│   │   ├── types.ts               # Core domain models, card suits, hand categories
│   │   ├── cards.ts               # 52-card deck definitions & string parsers
│   │   ├── csprng.ts              # Provably Fair HMAC-SHA256 & Fisher-Yates RNG
│   │   ├── evaluator.ts           # 7-card Texas Hold'em hand evaluator & kickers
│   │   ├── sidepots.ts            # Mathematical side pots & odd chip distribution
│   │   ├── pokerEngine.ts         # Deterministic Hold'em Table State Machine
│   │   ├── ledger.ts              # TGB Double-Entry Ledger & Hash Chaining
│   │   └── tournament.ts          # Blind timers, ICM Payouts & Table Balancer
│   ├── server/
│   │   └── server.ts              # HTTP API & Static Web Server
│   └── tests/
│       └── all.test.ts            # Comprehensive unit tests for all modules
└── public/
    ├── index.html                 # Modern responsive Web App (Tailwind CSS)
    ├── style.css                  # Specialized card graphics & felt table styles
    └── app.js                     # Interactive client controller & Web Audio
```
