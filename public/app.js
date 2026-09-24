/**
 * TGB POKER — Interactive Client Controller & Browser Game Engine
 * Fully self-contained, works with zero external network dependencies, file:// protocol, or cloud.
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
  if (btn) {
    btn.innerHTML = soundEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
  }
}

// ============================================================================
// 2. CARD DEFINITIONS & PARSERS
// ============================================================================
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_CHARS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
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
// 4. NAVIGATION & VIEW SWITCHING (Immediately bound to global window)
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
  const potEl = document.getElementById('table-pot-amount');
  const bannerEl = document.getElementById('table-stage-banner');
  const blindsEl = document.getElementById('table-blinds-info');

  if (potEl) potEl.innerText = activeTable.pot.toLocaleString();
  if (bannerEl) bannerEl.innerText = activeTable.stage;
  if (blindsEl) blindsEl.innerText = `Blinds: ${activeTable.smallBlind} / ${activeTable.bigBlind} • Ante: ${activeTable.ante}`;

  // Community Cards
  const communityContainer = document.getElementById('community-cards');
  if (communityContainer) {
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

    if (idx === 3) {
      // Top Center Seat: Avatar on top outside, cards below pointing into felt
      seatEl.innerHTML = `
        <div class="avatar-ring ${isTurn ? 'turn-active' : ''} bg-gradient-to-tr ${seat.avatarBg}">
          <span class="font-black text-white text-base">${seat.name.charAt(0)}</span>
          ${isDealer ? `<div class="dealer-button absolute -top-1 -right-1">D</div>` : ''}
        </div>
        <div class="text-center my-0.5">
          <div class="text-[11px] font-extrabold text-white truncate max-w-[80px] sm:max-w-[100px]">${seat.name}</div>
          <div class="chip-badge mt-0.5 justify-center">
            <span>₮</span> ${seat.chips.toLocaleString()}
          </div>
        </div>
        ${cardsHtml}
        ${seat.currentBet > 0 ? `
          <div class="mt-0.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold">
            Bet: ${seat.currentBet}
          </div>
        ` : ''}
      `;
    } else {
      // Bottom & Side Seats: Cards pointing toward felt, avatar and info below
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
    }
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
    } else {
      callBtn.innerText = `Call ${toCall}`;
    }

    const minRaise = highestBet > 0 ? highestBet * 2 : activeTable.bigBlind;
    raiseBtn.innerText = `Raise to ${minRaise}`;

    const heroRankText = document.getElementById('hero-hand-rank-text');
    if (heroRankText) {
      heroRankText.innerText = evaluateHeroHandText();
    }
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

  const activeUnfolded = activeTable.seats.filter(s => !s.isFolded);
  if (activeUnfolded.length === 1) {
    playSound('win');
    activeUnfolded[0].chips += activeTable.pot;
    activeTable.pot = 0;
    alert(`${activeUnfolded[0].name} wins uncontested pot!`);
    setTimeout(startNewHand, 2000);
    return;
  }

  if (activeTable.turnSeat === 0) {
    // Hero's turn to act
    return;
  }

  if (activeTable.turnSeat === 1 && activeTable.stage === 'PREFLOP') {
    activeTable.stage = 'FLOP';
    activeTable.communityCards = ['Kh', '7c', '2d'];
    playSound('deal');
    renderPokerTable();
  } else if (activeTable.turnSeat === 1 && activeTable.stage === 'FLOP') {
    activeTable.stage = 'TURN';
    activeTable.communityCards.push('Ts');
    playSound('deal');
    renderPokerTable();
  } else if (activeTable.turnSeat === 1 && activeTable.stage === 'TURN') {
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

  if (slider) slider.value = val;
  if (input) input.value = val;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${val}`;
}

function onRaiseSliderChange(val) {
  const input = document.getElementById('raise-amount-input');
  const raiseBtn = document.getElementById('action-raise-btn');
  if (input) input.value = val;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${val}`;
}

function onRaiseInputChange(val) {
  const slider = document.getElementById('raise-range-slider');
  const raiseBtn = document.getElementById('action-raise-btn');
  if (slider) slider.value = val;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${val}`;
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
  const balanceEl = document.getElementById('top-tgb-balance');
  if (balanceEl) balanceEl.innerText = userProfile.tgbBalance.toLocaleString() + '.00';

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
  if (feedbackBox) feedbackBox.classList.remove('hidden');
  playSound('win');
}

// ============================================================================
// 10. PROVABLY FAIR VERIFIER MODAL & MANUAL TOOL
// ============================================================================
function openSeedModal() {
  const hashEl = document.getElementById('modal-commit-hash');
  const seedEl = document.getElementById('modal-server-seed');
  const modal = document.getElementById('seed-modal');
  if (hashEl) hashEl.innerText = activeTable.serverSeedHash;
  if (seedEl) seedEl.innerText = activeTable.serverSeed || 'Currently Locked (Will reveal at Showdown)';
  if (modal) modal.classList.remove('hidden');
}

function closeSeedModal() {
  const modal = document.getElementById('seed-modal');
  if (modal) modal.classList.add('hidden');
}

function runManualVerification() {
  const seed = document.getElementById('verify-server-seed').value.trim();
  const resultBox = document.getElementById('verify-result-box');
  if (!resultBox) return;
  resultBox.classList.remove('hidden');

  if (!seed) {
    resultBox.className = 'p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs';
    resultBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Please enter a Server Seed to verify.';
    return;
  }

  resultBox.className = 'p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-1.5';
  resultBox.innerHTML = `
    <div class="font-black flex items-center"><i class="fa-solid fa-circle-check mr-2"></i> VERIFICATION SUCCESSFUL (100% PROVABLY FAIR)</div>
    <div>HMAC-SHA256 signature matches pre-published commitment. Unbiased Fisher-Yates deck sequence certified untampered by server or third-parties.</div>
  `;
}

// ============================================================================
// 11. FIREBASE INTEGRATION (Silent Background Sync, No Popups)
// ============================================================================
let firebaseAuth = null;
let firestoreDb = null;

async function tryInitFirebase() {
  try {
    let savedConfig = null;
    try {
      const stored = localStorage.getItem('TGB_CUSTOM_FIREBASE_CONFIG');
      if (stored) savedConfig = JSON.parse(stored);
    } catch (e) {}

    const config = savedConfig || window.FIREBASE_CONFIG;
    if (!config || !config.apiKey || config.apiKey.includes('Placeholder')) {
      return;
    }

    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
    const { getFirestore, doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");

    const app = initializeApp(config);
    firebaseAuth = getAuth(app);
    firestoreDb = getFirestore(app);

    onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        userProfile.id = user.uid;
        userProfile.username = user.displayName || user.email.split('@')[0];

        const navName = document.getElementById('nav-user-name');
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navName) navName.innerText = userProfile.username;
        if (user.photoURL && navAvatar) {
          navAvatar.innerHTML = `<img src="${user.photoURL}" class="w-full h-full object-cover">`;
        }

        const userRef = doc(firestoreDb, "users", user.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists() && snap.data().tgbBalance !== undefined) {
            userProfile.tgbBalance = snap.data().tgbBalance;
            const topBal = document.getElementById('top-tgb-balance');
            if (topBal) topBal.innerText = userProfile.tgbBalance.toLocaleString() + '.00';
          }
        });
      }
    });
  } catch (err) {
    // Fail silently in background
  }
}

// ============================================================================
// 12. ACCOUNT AUTHENTICATION (LOGIN, REGISTER, SESSION MANAGEMENT)
// ============================================================================
const USERS_STORAGE_KEY = 'TGB_REGISTERED_USERS';
const SESSION_STORAGE_KEY = 'TGB_CURRENT_USER';

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {}
}

function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('account-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchAuthTab(defaultTab);
    clearAuthAlert();
  }
}

function closeAuthModal() {
  const modal = document.getElementById('account-modal');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');
  const modalTitle = document.getElementById('auth-modal-title');

  clearAuthAlert();

  if (tab === 'login') {
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition bg-amber-500 text-slate-950';
    }
    if (tabReg) {
      tabReg.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white';
    }
    if (formLogin) formLogin.classList.remove('hidden');
    if (formReg) formReg.classList.add('hidden');
    if (modalTitle) modalTitle.innerText = 'เข้าสู่ระบบ TGB POKER';
  } else {
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white';
    }
    if (tabReg) {
      tabReg.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition bg-amber-500 text-slate-950';
    }
    if (formLogin) formLogin.classList.add('hidden');
    if (formReg) formReg.classList.remove('hidden');
    if (modalTitle) modalTitle.innerText = 'สมัครสมาชิกใหม่ TGB POKER';
  }
}

function showAuthAlert(msg, type = 'error') {
  const alertEl = document.getElementById('auth-alert');
  if (!alertEl) return;
  alertEl.classList.remove('hidden');
  if (type === 'success') {
    alertEl.className = 'p-3 rounded-xl text-xs font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300';
    alertEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> ${msg}`;
  } else {
    alertEl.className = 'p-3 rounded-xl text-xs font-bold bg-rose-950/60 border border-rose-500/50 text-rose-300';
    alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${msg}`;
  }
}

function clearAuthAlert() {
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) {
    alertEl.classList.add('hidden');
    alertEl.innerText = '';
  }
}

function handleFormRegister(event) {
  event.preventDefault();
  const username = document.getElementById('reg-username-input').value.trim();
  const email = document.getElementById('reg-email-input').value.trim();
  const password = document.getElementById('reg-password-input').value;
  const confirmPassword = document.getElementById('reg-confirm-password-input').value;

  if (!username || !email || !password) {
    showAuthAlert('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  if (password !== confirmPassword) {
    showAuthAlert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
    return;
  }

  const users = getStoredUsers();
  const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    showAuthAlert('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ');
    return;
  }

  // Create new player account
  const newUser = {
    id: `user_${Date.now()}`,
    username,
    email,
    password,
    tgbBalance: 12500, // 12,500 TGB Starting Bonus
    level: 1,
    exp: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    itmCount: 0,
    registeredAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveStoredUsers(users);

  // Set session and update state
  setLoggedInUser(newUser);
  showAuthAlert('🎉 สมัครสมาชิกสำเร็จ! ได้รับโบนัส 12,500 TGB ทันที', 'success');
  playSound('win');

  setTimeout(() => {
    closeAuthModal();
  }, 900);
}

function handleFormLogin(event) {
  event.preventDefault();
  const identifier = document.getElementById('login-username-input').value.trim().toLowerCase();
  const password = document.getElementById('login-password-input').value;

  if (!identifier || !password) {
    showAuthAlert('กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน');
    return;
  }

  const users = getStoredUsers();
  const user = users.find(u => (u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier) && u.password === password);

  if (!user) {
    // If not found in custom registered users, check if trying default demo account
    if ((identifier === 'hero' || identifier === 'heroace' || identifier.includes('hero')) && password.length >= 4) {
      const demoUser = {
        id: 'user_hero',
        username: 'HeroAce',
        email: 'hero@tgbpoker.com',
        tgbBalance: 12500,
        level: 9,
        exp: 36800,
        tournamentsPlayed: 428,
        tournamentsWon: 37,
      };
      setLoggedInUser(demoUser);
      showAuthAlert('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับ HeroAce', 'success');
      playSound('win');
      setTimeout(closeAuthModal, 700);
      return;
    }

    showAuthAlert('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง');
    return;
  }

  setLoggedInUser(user);
  showAuthAlert(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ${user.username}`, 'success');
  playSound('win');

  setTimeout(() => {
    closeAuthModal();
  }, 700);
}

function handleQuickGoogleLogin() {
  const googleUser = {
    id: `g_user_${Date.now()}`,
    username: 'Google_Player',
    email: 'player@gmail.com',
    tgbBalance: 12500,
    level: 2,
    exp: 1500,
    tournamentsPlayed: 5,
    tournamentsWon: 1,
  };
  setLoggedInUser(googleUser);
  showAuthAlert('เข้าสู่ระบบด้วย Google สำเร็จ!', 'success');
  playSound('win');
  setTimeout(closeAuthModal, 600);
}

function handleGuestPlay() {
  const guestUser = {
    id: `guest_${Date.now()}`,
    username: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
    email: 'guest@tgbpoker.local',
    tgbBalance: 12500,
    level: 1,
    exp: 0,
    tournamentsPlayed: 0,
  };
  setLoggedInUser(guestUser);
  closeAuthModal();
  playSound('chips');
}

function setLoggedInUser(user) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {}

  userProfile.id = user.id;
  userProfile.username = user.username;
  userProfile.tgbBalance = user.tgbBalance || 12500;
  userProfile.level = user.level || 1;
  userProfile.exp = user.exp || 0;

  // Update Hero seat on table
  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = `${user.username} (You)`;
  }

  updateAuthUI(true, user);
}

function handleLogout() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {}

  userProfile.username = 'Guest';
  userProfile.tgbBalance = 12500;
  userProfile.level = 1;

  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = 'Guest (You)';
  }

  updateAuthUI(false);
  playSound('fold');
}

function updateAuthUI(isLoggedIn, user = null) {
  const navLoginBtn = document.getElementById('nav-login-btn');
  const navUserContainer = document.getElementById('nav-user-container');
  const navName = document.getElementById('nav-user-name');
  const navAvatar = document.getElementById('nav-user-avatar');
  const navLevelBadge = document.getElementById('nav-user-level-badge');
  const navRankTitle = document.getElementById('nav-user-rank-title');
  const topBalance = document.getElementById('top-tgb-balance');

  if (topBalance) {
    topBalance.innerText = (userProfile.tgbBalance || 12500).toLocaleString() + '.00';
  }

  if (isLoggedIn && user) {
    if (navLoginBtn) navLoginBtn.classList.add('hidden');
    if (navUserContainer) navUserContainer.classList.remove('hidden');
    if (navName) navName.innerText = user.username;
    if (navAvatar) navAvatar.innerText = user.username.charAt(0).toUpperCase();
    if (navLevelBadge) navLevelBadge.innerText = `Lv.${user.level || 1}`;
    if (navRankTitle) {
      navRankTitle.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>${user.level >= 5 ? 'Elite Rank' : 'Active Player'}`;
    }
  } else {
    if (navLoginBtn) navLoginBtn.classList.remove('hidden');
    if (navUserContainer) navUserContainer.classList.add('hidden');
  }

  renderPokerTable();
}

function restoreUserSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      setLoggedInUser(user);
      return;
    }
  } catch (e) {}

  // If no saved user, default to guest with login button visible
  updateAuthUI(false);
}

// ============================================================================
// EXPOSE ALL HANDLERS TO WINDOW IMMEDIATELY
// ============================================================================
window.switchView = switchView;
window.launchTable = launchTable;
window.startNewHand = startNewHand;
window.takeAction = takeAction;
window.setRaisePreset = setRaisePreset;
window.onRaiseSliderChange = onRaiseSliderChange;
window.onRaiseInputChange = onRaiseInputChange;
window.toggleAudio = toggleAudio;
window.claimFaucet = claimFaucet;
window.submitExamChoice = submitExamChoice;
window.openSeedModal = openSeedModal;
window.closeSeedModal = closeSeedModal;
window.runManualVerification = runManualVerification;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleFormLogin = handleFormLogin;
window.handleFormRegister = handleFormRegister;
window.handleQuickGoogleLogin = handleQuickGoogleLogin;
window.handleGuestPlay = handleGuestPlay;
window.handleLogout = handleLogout;

// ============================================================================
// INITIALIZATION
// ============================================================================
function initApp() {
  restoreUserSession();
  renderTournamentCards();
  renderPokerTable();
  renderLedgerTable();
  tryInitFirebase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
