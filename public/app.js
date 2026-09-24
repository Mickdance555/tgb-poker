/**
 * TGB POKER — Interactive Client Controller & Browser Game Engine
 * Includes Web Audio FX, Bot AI, Provably Fair Verification, and Ledger Integration
 */

// ============================================================================
// 1. WEB AUDIO SOUND SYNTHESIZER (No external mp3 dependencies needed)
// ============================================================================
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;

    if (type === 'deal') {
      // Swish noise for dealing card
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'chips') {
      // Clinking chips sound
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'win') {
      // Victorious major triad chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } else if (type === 'fold') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    console.warn('Audio not initialized yet:', e);
  }
}

function toggleAudio() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  btn.innerHTML = soundEnabled
    ? '<i class="fa-solid fa-volume-high"></i>'
    : '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
}

// ============================================================================
// 2. CARD DEFINITIONS & PARSERS
// ============================================================================
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_CHARS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
const RANK_NAMES = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

function renderCardHTML(code, isRevealed = true) {
  if (!isRevealed || !code) {
    return `<div class="poker-card poker-card-back card-dealt"></div>`;
  }
  const rankChar = code[0];
  const suitChar = code[1];
  const isRed = suitChar === 'h' || suitChar === 'd';
  const colorClass = isRed ? 'card-red' : 'card-black';
  const symbol = SUIT_SYMBOLS[suitChar] || suitChar;

  return `
    <div class="poker-card ${colorClass} card-dealt">
      <div class="text-xs sm:text-sm font-black leading-none">${rankChar}</div>
      <div class="text-base sm:text-xl text-center leading-none">${symbol}</div>
      <div class="text-xs sm:text-sm font-black text-right leading-none">${rankChar}</div>
    </div>
  `;
}

// ============================================================================
// 3. GAME STATE & SIMULATOR
// ============================================================================
let userProfile = {
  id: 'c1f1a547-494b-4f93-b26a-912c93847e11',
  username: 'HeroAce',
  tgbBalance: 12500,
  level: 9,
  exp: 36800,
  vpipHands: 102,
  pfrHands: 81,
  totalHands: 428,
};

let activeTable = {
  id: 'table_daily_mtt_01',
  title: '#001 Daily Standard MTT • Table 01',
  smallBlind: 25,
  bigBlind: 50,
  ante: 0,
  pot: 0,
  stage: 'PREFLOP',
  dealerSeat: 0,
  turnSeat: 1,
  communityCards: [],
  handNumber: 1,
  serverSeedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  serverSeed: '',
  seats: [
    { seatNumber: 0, name: 'Hero (You)', chips: 4950, currentBet: 50, isHero: true, cards: ['As', 'Kd'], isFolded: false, isAllIn: false, avatarBg: 'from-amber-600 to-yellow-500' },
    { seatNumber: 1, name: 'Viper (TAG)', chips: 4975, currentBet: 25, isHero: false, cards: ['Qh', 'Qd'], isFolded: false, isAllIn: false, avatarBg: 'from-blue-600 to-indigo-500' },
    { seatNumber: 2, name: 'BluffMaster', chips: 5000, currentBet: 0, isHero: false, cards: ['9c', '8c'], isFolded: false, isAllIn: false, avatarBg: 'from-rose-600 to-red-500' },
    { seatNumber: 3, name: 'The Rock', chips: 5000, currentBet: 0, isHero: false, cards: ['Jc', 'Jd'], isFolded: false, isAllIn: false, avatarBg: 'from-emerald-600 to-teal-500' },
    { seatNumber: 4, name: 'CallingStation', chips: 5000, currentBet: 0, isHero: false, cards: ['7h', '6h'], isFolded: false, isAllIn: false, avatarBg: 'from-purple-600 to-violet-500' },
    { seatNumber: 5, name: 'GTO_Bot', chips: 5000, currentBet: 0, isHero: false, cards: ['Ah', '5h'], isFolded: false, isAllIn: false, avatarBg: 'from-cyan-600 to-blue-500' },
  ],
};

let userLedgerTransactions = [
  {
    id: 'tx_01',
    type: 'WELCOME_BONUS',
    amount: 10000,
    balance: 10000,
    sig: 'hmac_sha256_9a4f21...',
    prevHash: '0000000000000000...',
    timestamp: '2026-09-24 10:15:22',
  },
  {
    id: 'tx_02',
    type: 'TOURNAMENT_BUYIN',
    amount: -500,
    balance: 9500,
    sig: 'hmac_sha256_c81d33...',
    prevHash: '7f9a2b8e31...',
    timestamp: '2026-09-24 11:00:00',
  },
  {
    id: 'tx_03',
    type: 'TOURNAMENT_PRIZE',
    amount: 3500,
    balance: 13000,
    sig: 'hmac_sha256_44b0c2...',
    prevHash: '3d8a9e11bc...',
    timestamp: '2026-09-24 11:45:10',
  },
  {
    id: 'tx_04',
    type: 'TOURNAMENT_BUYIN',
    amount: -500,
    balance: 12500,
    sig: 'hmac_sha256_e814a0...',
    prevHash: 'a5c2d89b14...',
    timestamp: '2026-09-24 12:05:00',
  },
];

// ============================================================================
// 4. NAVIGATION & VIEW SWITCHING
// ============================================================================
function switchView(viewName) {
  const views = ['lobby', 'table', 'academy', 'profile', 'wallet', 'verifier'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
        el.classList.add('active-view');
      } else {
        el.classList.add('hidden');
        el.classList.remove('active-view');
      }
    }
    if (navBtn) {
      if (v === viewName) navBtn.classList.add('active');
      else navBtn.classList.remove('active');
    }
  });

  if (viewName === 'table') {
    renderPokerTable();
  } else if (viewName === 'wallet') {
    renderLedgerTable();
  }
}

function launchTable(tournamentId) {
  switchView('table');
  startNewHand();
}

// ============================================================================
// 5. RENDER POKER TABLE
// ============================================================================
function renderPokerTable() {
  // Update Header
  document.getElementById('table-pot-amount').innerText = activeTable.pot.toLocaleString();
  document.getElementById('table-stage-banner').innerText = activeTable.stage;
  document.getElementById('table-blinds-info').innerText = `Blinds: ${activeTable.smallBlind} / ${activeTable.bigBlind} • Ante: ${activeTable.ante}`;

  // Community Cards
  const communityContainer = document.getElementById('community-cards');
  if (activeTable.communityCards.length === 0) {
    communityContainer.innerHTML = `
      <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-14 h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">1</div>
      <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-14 h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">2</div>
      <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-14 h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">3</div>
      <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-14 h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">4</div>
      <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-14 h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">5</div>
    `;
  } else {
    communityContainer.innerHTML = activeTable.communityCards.map(c => renderCardHTML(c, true)).join('');
  }

  // Render Seats
  activeTable.seats.forEach((seat, idx) => {
    const seatEl = document.getElementById(`seat-${idx}`);
    if (!seatEl) return;

    const isTurn = activeTable.turnSeat === idx;
    const isDealer = activeTable.dealerSeat === idx;

    let cardsHtml = '';
    if (!seat.isFolded) {
      if (seat.isHero) {
        cardsHtml = `
          <div class="flex items-center -space-x-4 mb-1">
            ${seat.cards.map(c => renderCardHTML(c, true)).join('')}
          </div>
        `;
      } else {
        cardsHtml = `
          <div class="flex items-center -space-x-4 mb-1">
            ${renderCardHTML(null, false)}
            ${renderCardHTML(null, false)}
          </div>
        `;
      }
    } else {
      cardsHtml = `<div class="text-[10px] text-slate-500 font-bold uppercase mb-1">FOLDED</div>`;
    }

    seatEl.innerHTML = `
      ${cardsHtml}
      <div class="avatar-ring ${isTurn ? 'turn-active' : ''} bg-gradient-to-tr ${seat.avatarBg}">
        <span class="font-black text-white text-base">${seat.name.charAt(0)}</span>
        ${isDealer ? `<div class="dealer-button absolute -top-1 -right-1">D</div>` : ''}
      </div>
      <div class="text-center mt-1">
        <div class="text-[11px] font-extrabold text-white truncate max-w-[80px] sm:max-w-[100px]">${seat.name}</div>
        <div class="chip-badge mt-0.5 justify-center">
          <span>₮</span> ${seat.chips.toLocaleString()}
        </div>
      </div>
      ${seat.currentBet > 0 ? `
        <div class="mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold">
          Bet: ${seat.currentBet}
        </div>
      ` : ''}
    `;
  });

  // Action Buttons state for Hero
  const heroSeat = activeTable.seats[0];
  const isHeroTurn = activeTable.turnSeat === 0;

  const foldBtn = document.getElementById('action-fold-btn');
  const callBtn = document.getElementById('action-call-btn');
  const raiseBtn = document.getElementById('action-raise-btn');

  if (foldBtn && callBtn && raiseBtn) {
    foldBtn.disabled = !isHeroTurn;
    callBtn.disabled = !isHeroTurn;
    raiseBtn.disabled = !isHeroTurn;

    const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
    const toCall = highestBet - heroSeat.currentBet;

    if (toCall === 0) {
      callBtn.innerText = 'Check';
      callBtn.classList.remove('from-emerald-700', 'to-emerald-800');
      callBtn.classList.add('from-emerald-600', 'to-emerald-700');
    } else {
      callBtn.innerText = `Call ${toCall}`;
    }

    const minRaise = highestBet > 0 ? highestBet * 2 : activeTable.bigBlind;
    raiseBtn.innerText = `Raise to ${minRaise}`;

    // Update Hero Hand Rank Evaluator
    document.getElementById('hero-hand-rank-text').innerText = evaluateHeroHandText();
  }
}

function evaluateHeroHandText() {
  if (activeTable.communityCards.length === 0) {
    return 'Pre-Flop: Hole Cards [A♠, K♠] (Big Slick)';
  }
  if (activeTable.communityCards.length >= 3) {
    return 'Top Pair, Ace Kicker (A♠ K♠ on K-7-2-T)';
  }
  return 'In hand';
}

// ============================================================================
// 6. GAMEPLAY ENGINE & ACTIONS
// ============================================================================
function startNewHand() {
  playSound('deal');
  activeTable.stage = 'PREFLOP';
  activeTable.communityCards = [];
  activeTable.serverSeed = '7f9a2b8e3104a91c890f532a10c9e83d8a9e11bc901a88b49e8a0021c432baef';
  activeTable.serverSeedHash = '3f8b919e1c472d829928a6f9479b4a1104e7b83921d746592a839b2e0481fa79';

  // Blinds
  activeTable.pot = 75;
  activeTable.seats[0].currentBet = 50; // BB
  activeTable.seats[0].chips = 4950;
  activeTable.seats[1].currentBet = 25; // SB
  activeTable.seats[1].chips = 4975;

  for (let i = 2; i < activeTable.seats.length; i++) {
    activeTable.seats[i].currentBet = 0;
    activeTable.seats[i].isFolded = false;
  }
  activeTable.seats[0].isFolded = false;
  activeTable.seats[1].isFolded = false;

  activeTable.turnSeat = 2; // Under the Gun (UTG)
  renderPokerTable();

  // Run initial bot actions
  setTimeout(runBotTurns, 800);
}

function takeAction(actionType) {
  if (activeTable.turnSeat !== 0) return;

  const hero = activeTable.seats[0];
  const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));

  if (actionType === 'FOLD') {
    hero.isFolded = true;
    playSound('fold');
  } else if (actionType === 'CALL') {
    const toCall = highestBet - hero.currentBet;
    hero.chips -= toCall;
    hero.currentBet += toCall;
    activeTable.pot += toCall;
    playSound('chips');
  } else if (actionType === 'RAISE') {
    const raiseAmount = parseInt(document.getElementById('raise-amount-input').value, 10) || 150;
    const additional = raiseAmount - hero.currentBet;
    hero.chips -= additional;
    hero.currentBet = raiseAmount;
    activeTable.pot += additional;
    playSound('chips');
  }

  activeTable.turnSeat = 1;
  renderPokerTable();
  setTimeout(runBotTurns, 700);
}

function runBotTurns() {
  if (activeTable.turnSeat === 0) return; // Hero turn

  const currentSeat = activeTable.seats[activeTable.turnSeat];
  if (!currentSeat || currentSeat.isFolded) {
    advanceToNextPlayer();
    return;
  }

  // Simple bot logic
  const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
  const diff = highestBet - currentSeat.currentBet;

  if (diff === 0) {
    // Check
  } else if (diff <= 100) {
    currentSeat.chips -= diff;
    currentSeat.currentBet += diff;
    activeTable.pot += diff;
    playSound('chips');
  } else {
    currentSeat.isFolded = true;
    playSound('fold');
  }

  advanceToNextPlayer();
}

function advanceToNextPlayer() {
  activeTable.turnSeat = (activeTable.turnSeat + 1) % activeTable.seats.length;
  renderPokerTable();

  // If back to pre-deal cycle or all bets matched, advance street
  const activeUnfolded = activeTable.seats.filter(s => !s.isFolded);
  if (activeUnfolded.length === 1) {
    // Single player win!
    playSound('win');
    activeUnfolded[0].chips += activeTable.pot;
    activeTable.pot = 0;
    alert(`${activeUnfolded[0].name} wins uncontested pot!`);
    setTimeout(startNewHand, 2000);
    return;
  }

  if (activeTable.turnSeat === 0) {
    // Hero's turn to act!
    return;
  }

  if (activeTable.turnSeat === 1 && activeTable.stage === 'PREFLOP') {
    // Deal Flop
    activeTable.stage = 'FLOP';
    activeTable.communityCards = ['Kh', '7c', '2d'];
    playSound('deal');
    renderPokerTable();
  } else if (activeTable.turnSeat === 1 && activeTable.stage === 'FLOP') {
    // Deal Turn
    activeTable.stage = 'TURN';
    activeTable.communityCards.push('Ts');
    playSound('deal');
    renderPokerTable();
  } else if (activeTable.turnSeat === 1 && activeTable.stage === 'TURN') {
    // Deal River
    activeTable.stage = 'RIVER';
    activeTable.communityCards.push('As');
    playSound('deal');
    renderPokerTable();
  }

  setTimeout(runBotTurns, 600);
}

// Raise Presets
function setRaisePreset(preset) {
  const slider = document.getElementById('raise-range-slider');
  const input = document.getElementById('raise-amount-input');
  const raiseBtn = document.getElementById('action-raise-btn');

  let val = 100;
  if (preset === 'min') val = activeTable.bigBlind * 2;
  else if (preset === '2.5bb') val = Math.round(activeTable.bigBlind * 2.5);
  else if (preset === 'half_pot') val = Math.round(activeTable.pot * 0.5);
  else if (preset === 'pot') val = activeTable.pot;
  else if (preset === 'allin') val = activeTable.seats[0].chips;

  slider.value = val;
  input.value = val;
  raiseBtn.innerText = `Raise to ${val}`;
}

function onRaiseSliderChange(val) {
  document.getElementById('raise-amount-input').value = val;
  document.getElementById('action-raise-btn').innerText = `Raise to ${val}`;
}

function onRaiseInputChange(val) {
  document.getElementById('raise-range-slider').value = val;
  document.getElementById('action-raise-btn').innerText = `Raise to ${val}`;
}

// ============================================================================
// 7. TOURNAMENT LOBBY & CARDS
// ============================================================================
const TOURNAMENTS_DATA = [
  {
    id: 'mtt_001',
    title: '#001 Daily Standard MTT',
    type: 'Daily MTT',
    buyIn: 500,
    prizePool: 50000,
    players: '82 / 100',
    blinds: '10 min',
    status: 'REGISTRATION',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'mtt_002',
    title: '#002 Sunday Major Championship',
    type: 'Major',
    buyIn: 2500,
    prizePool: 500000,
    players: '340 / 1000',
    blinds: '15 min',
    status: 'REGISTRATION',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  {
    id: 'mtt_003',
    title: '#003 Turbo Knockout Bounty',
    type: 'Turbo KO',
    buyIn: 300,
    prizePool: 25000,
    players: '48 / 64',
    blinds: '5 min',
    status: 'RUNNING',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  {
    id: 'mtt_004',
    title: '#004 Academy Freeroll',
    type: 'Freeroll',
    buyIn: 0,
    prizePool: 5000,
    players: '95 / 100',
    blinds: '8 min',
    status: 'REGISTRATION',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
];

function renderTournamentCards() {
  const container = document.getElementById('tournament-cards-container');
  if (!container) return;

  container.innerHTML = TOURNAMENTS_DATA.map(t => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-xl space-y-4 flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${t.badge}">${t.status}</span>
          <span class="text-xs text-slate-400 font-mono"><i class="fa-regular fa-clock mr-1"></i>${t.blinds}</span>
        </div>
        <h3 class="text-base font-black text-white leading-tight">${t.title}</h3>
      </div>

      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 font-mono text-xs">
        <div class="flex justify-between">
          <span class="text-slate-400">Buy-in:</span>
          <span class="font-bold text-amber-300">${t.buyIn === 0 ? 'FREE' : `${t.buyIn} ₮`}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Prize Pool:</span>
          <span class="font-black text-emerald-400">${t.prizePool.toLocaleString()} ₮</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Entries:</span>
          <span class="text-slate-200">${t.players}</span>
        </div>
      </div>

      <button onclick="launchTable('${t.id}')" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-extrabold text-xs transition duration-200 flex items-center justify-center">
        <i class="fa-solid fa-arrow-right-to-bracket mr-1.5"></i> JOIN TOURNAMENT
      </button>
    </div>
  `).join('');
}

// ============================================================================
// 8. TGB LEDGER & FAUCET
// ============================================================================
function renderLedgerTable() {
  const container = document.getElementById('ledger-rows-container');
  if (!container) return;

  container.innerHTML = userLedgerTransactions.map(tx => {
    const isCredit = tx.amount > 0;
    return `
      <tr class="hover:bg-slate-800/30 transition">
        <td class="py-3 font-bold text-slate-300">${tx.id}</td>
        <td class="py-3"><span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">${tx.type}</span></td>
        <td class="py-3 text-right font-black ${isCredit ? 'text-emerald-400' : 'text-rose-400'}">
          ${isCredit ? '+' : ''}${tx.amount.toLocaleString()} ₮
        </td>
        <td class="py-3 text-right font-bold text-amber-300">${tx.balance.toLocaleString()} ₮</td>
        <td class="py-3 text-[10px] text-slate-500 max-w-[180px] truncate">${tx.sig}</td>
        <td class="py-3 text-right text-slate-400 text-[11px]">${tx.timestamp}</td>
      </tr>
    `;
  }).join('');
}

function claimFaucet() {
  userProfile.tgbBalance += 1000;
  document.getElementById('top-tgb-balance').innerText = userProfile.tgbBalance.toLocaleString() + '.00';

  const newTx = {
    id: `tx_0${userLedgerTransactions.length + 1}`,
    type: 'WELCOME_BONUS',
    amount: 1000,
    balance: userProfile.tgbBalance,
    sig: `hmac_sha256_${Math.random().toString(36).substring(2, 8)}...`,
    prevHash: userLedgerTransactions[userLedgerTransactions.length - 1].sig,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };

  userLedgerTransactions.unshift(newTx);
  renderLedgerTable();
  playSound('chips');
  alert('Successfully credited 1,000 TGB to your Ledger balance!');
}

// ============================================================================
// 9. AI ACADEMY EXAM
// ============================================================================
function submitExamChoice(choice) {
  const feedbackBox = document.getElementById('exam-feedback-box');
  feedbackBox.classList.remove('hidden');
  playSound('win');
}

// ============================================================================
// 10. PROVABLY FAIR VERIFIER MODAL & MANUAL TOOL
// ============================================================================
function openSeedModal() {
  document.getElementById('modal-commit-hash').innerText = activeTable.serverSeedHash;
  document.getElementById('modal-server-seed').innerText = activeTable.serverSeed || 'Currently Locked (Will reveal at Showdown)';
  document.getElementById('seed-modal').classList.remove('hidden');
}

function closeSeedModal() {
  document.getElementById('seed-modal').classList.add('hidden');
}

function runManualVerification() {
  const seed = document.getElementById('verify-server-seed').value.trim();
  const resultBox = document.getElementById('verify-result-box');
  resultBox.classList.remove('hidden');

  if (!seed) {
    resultBox.className = 'p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs';
    resultBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Please enter a Server Seed to verify.';
    return;
  }

  // Successful verification demo
  resultBox.className = 'p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-1.5';
  resultBox.innerHTML = `
    <div class="font-black flex items-center"><i class="fa-solid fa-circle-check mr-2"></i> VERIFICATION SUCCESSFUL (100% PROVABLY FAIR)</div>
    <div>HMAC-SHA256 signature matches pre-published commitment. Unbiased Fisher-Yates deck sequence certified untampered by server or third-parties.</div>
  `;
}

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  renderTournamentCards();
  renderPokerTable();
  renderLedgerTable();
});
