# TGB POKER — Technical Specification & Comprehensive PRD

> **Document Version:** 1.0.0-PROD  
> **Classification:** Confidential / System Architecture & Engine Specification  
> **Target Platform:** Web App (Responsive Desktop & Mobile Browser)  
> **Core Architecture:** Server-Authoritative Real-Time MTT Poker Platform with Provably Fair CSPRNG & Double-Entry Virtual Economy Ledger

---

## 1. Executive Summary & Architectural Principles

TGB Poker is an enterprise-grade, server-authoritative tournament poker platform built around Multi-Table Tournaments (MTT), a closed-loop virtual economy (**TGB**), AI-driven poker coaching, and a provably fair cryptographic RNG foundation.

### Core Architectural Laws
1. **Absolute Server Authority:** The browser client is strictly a presentation and input capture layer. No game logic, deck shuffling, pot calculations, hand rankings, chip allocations, or prize distribution ever occurs or is trusted on the client.
2. **Double-Entry Balance & Ledger Integrity:** TGB balances cannot be modified by raw SQL `UPDATE users SET balance = balance + X`. Every delta must be committed to an immutable append-only ledger (`wallet_transactions`) with parent hash chaining and server signatures before balances are reconciled.
3. **CSPRNG & Provably Fair Commit-Reveal:** Every hand generates a cryptographic commitment (SHA-256 hash of server seed + salt) broadcast to players *before* any cards are dealt. After the hand completes, seeds are revealed, allowing players to independently verify the exact shuffle sequence.
4. **Deterministic Game Engine State Machine:** Every poker table runs an isolated deterministic finite-state machine (FSM). Given an identical seed, initial chip stacks, and sequence of player inputs, the engine will produce the exact same outcome every time.
5. **Defense-in-Depth Anti-Cheat:** Anti-collusion graph clustering, bot timing entropy analysis, chip dumping detection, and delayed spectator streams (minimum 60-second delay) ensure complete game integrity.

---

## 2. Complete Database Schema (PostgreSQL DDL)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE auth_provider_enum AS ENUM ('EMAIL', 'GOOGLE', 'FACEBOOK', 'APPLE', 'DISCORD');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION');
CREATE TYPE risk_level_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'FLAGGED_COLLUSION', 'FLAGGED_BOT');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    avatar_url TEXT DEFAULT '/avatars/default.png',
    auth_provider auth_provider_enum NOT NULL DEFAULT 'EMAIL',
    provider_id VARCHAR(255),
    status user_status_enum NOT NULL DEFAULT 'ACTIVE',
    risk_level risk_level_enum NOT NULL DEFAULT 'LOW',
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 100),
    exp BIGINT NOT NULL DEFAULT 0 CHECK (exp >= 0),
    tgb_balance NUMERIC(18, 2) NOT NULL DEFAULT 1000.00 CHECK (tgb_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_risk ON users(status, risk_level);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE ledger_tx_type AS ENUM (
    'WELCOME_BONUS',
    'TOURNAMENT_BUYIN',
    'TOURNAMENT_REBUY',
    'TOURNAMENT_ADDON',
    'TOURNAMENT_PRIZE',
    'COSMETIC_PURCHASE',
    'ACADEMY_UNLOCK',
    'ADMIN_ADJUSTMENT',
    'SEASON_REWARD',
    'COLLUSION_REVERSAL'
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tx_type ledger_tx_type NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    balance_before NUMERIC(18, 2) NOT NULL CHECK (balance_before >= 0),
    balance_after NUMERIC(18, 2) NOT NULL CHECK (balance_after >= 0),
    reference_id VARCHAR(128) NOT NULL,
    server_signature VARCHAR(255) NOT NULL,
    prev_tx_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_reference ON wallet_transactions(reference_id);

CREATE TYPE tournament_type_enum AS ENUM ('DAILY_MICRO', 'DAILY_STANDARD', 'TURBO', 'DEEP_STACK', 'KNOCKOUT', 'SUNDAY_MAJOR', 'PRIVATE_ROOM');
CREATE TYPE tournament_state_enum AS ENUM (
    'SCHEDULED',
    'REGISTRATION',
    'STARTING',
    'RUNNING',
    'HAND_FOR_HAND',
    'FINAL_TABLE',
    'COMPLETED',
    'SETTLED',
    'CANCELLED'
);

CREATE TABLE blind_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    description TEXT,
    structure_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(128) NOT NULL,
    tournament_type tournament_type_enum NOT NULL,
    state tournament_state_enum NOT NULL DEFAULT 'SCHEDULED',
    blind_structure_id UUID NOT NULL REFERENCES blind_structures(id),
    buy_in_tgb NUMERIC(18, 2) NOT NULL CHECK (buy_in_tgb >= 0),
    fee_tgb NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (fee_tgb >= 0),
    starting_chips INT NOT NULL CHECK (starting_chips >= 500),
    min_players INT NOT NULL DEFAULT 2,
    max_players INT NOT NULL DEFAULT 1000,
    current_players_count INT NOT NULL DEFAULT 0,
    prize_pool_tgb NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    guaranteed_prize_tgb NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    current_blind_level INT NOT NULL DEFAULT 1,
    blind_timer_seconds INT NOT NULL DEFAULT 600,
    level_started_at TIMESTAMPTZ,
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    actual_started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    room_password_hash VARCHAR(255),
    created_by_user UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tournaments_state ON tournaments(state, scheduled_start_at);

CREATE TYPE registration_status_enum AS ENUM ('REGISTERED', 'PLAYING', 'ELIMINATED', 'UNREGISTERED', 'DISQUALIFIED');

CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    status registration_status_enum NOT NULL DEFAULT 'REGISTERED',
    chips_balance INT NOT NULL DEFAULT 0,
    finish_position INT,
    prize_awarded_tgb NUMERIC(18, 2) DEFAULT 0.00,
    bounties_won INT NOT NULL DEFAULT 0,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    UNIQUE(tournament_id, user_id)
);

CREATE TYPE table_status_enum AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'CLOSED');

CREATE TABLE tournament_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    status table_status_enum NOT NULL DEFAULT 'WAITING',
    max_seats INT NOT NULL DEFAULT 9 CHECK (max_seats IN (6, 8, 9)),
    dealer_seat INT NOT NULL DEFAULT 1,
    small_blind_seat INT,
    big_blind_seat INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tournament_id, table_number)
);

CREATE TABLE table_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tournament_tables(id) ON DELETE CASCADE,
    seat_number INT NOT NULL CHECK (seat_number >= 1 AND seat_number <= 9),
    user_id UUID REFERENCES users(id),
    chips INT NOT NULL DEFAULT 0,
    is_sitting_out BOOLEAN NOT NULL DEFAULT FALSE,
    is_disconnected BOOLEAN NOT NULL DEFAULT FALSE,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(table_id, seat_number),
    UNIQUE(table_id, user_id)
);

CREATE TYPE hand_stage_enum AS ENUM ('PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'COMPLETED');

CREATE TABLE hands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tournament_tables(id),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    hand_number BIGINT NOT NULL,
    stage hand_stage_enum NOT NULL DEFAULT 'PREFLOP',
    server_seed VARCHAR(64) NOT NULL,
    server_seed_hash VARCHAR(64) NOT NULL,
    client_seed VARCHAR(64) NOT NULL DEFAULT '0000000000000000',
    nonce BIGINT NOT NULL DEFAULT 1,
    community_cards JSONB NOT NULL DEFAULT '[]',
    total_pot INT NOT NULL DEFAULT 0,
    rake_tgb NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE hand_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    seat_number INT NOT NULL,
    starting_chips INT NOT NULL,
    hole_cards JSONB NOT NULL,
    final_chips INT,
    chips_won INT NOT NULL DEFAULT 0,
    is_folded BOOLEAN NOT NULL DEFAULT FALSE,
    hand_ranking_description VARCHAR(64),
    UNIQUE(hand_id, user_id)
);

CREATE TYPE player_action_enum AS ENUM ('POST_SB', 'POST_BB', 'POST_ANTE', 'FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN');

CREATE TABLE hand_actions (
    id BIGSERIAL PRIMARY KEY,
    hand_id UUID NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
    stage hand_stage_enum NOT NULL,
    action_seq INT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    seat_number INT NOT NULL,
    action_type player_action_enum NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    pot_after INT NOT NULL,
    player_chips_after INT NOT NULL,
    time_taken_ms INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hand_actions_seq ON hand_actions(hand_id, action_seq ASC);
```

---

## 3. Provably Fair CSPRNG Commit-Reveal Scheme

Pre-Hand Commitment:
$$\text{server\_seed} = \text{crypto.randomBytes}(32).\text{toString}('hex')$$
$$\text{commitment} = \text{HMAC-SHA256}(\text{key} = \text{server\_seed}, \text{data} = \text{tournament\_id} + \text{hand\_number})$$

Deterministic Shuffling via Fisher-Yates with 256-bit cryptographically secure seed. Post-hand reveal publishes `server_seed` to allow instant player verification.
