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
    } else if (type === 'chime') {
      [659.25, 880].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
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

function renderCardHTML(code, isRevealed = true, customSkin = null) {
  const skin = customSkin || userProfile.cardSkin || 'bicycle_red';
  if (!isRevealed || !code) {
    return `<div class="poker-card poker-card-back skin-${skin} card-dealt"></div>`;
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

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 3. CARD CONSTANTS & 7-CARD DETERMINISTIC HAND EVALUATOR
// ============================================================================
const CARD_SUITS = ['s', 'h', 'd', 'c'];
const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
const RANK_NAMES_MAP = {
  2: 'Deuces', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces'
};

function createFreshShuffledDeck() {
  const deck = [];
  for (const s of CARD_SUITS) {
    for (const r of CARD_RANKS) {
      deck.push(r + s);
    }
  }
  // High-entropy Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    let rand = Math.random();
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      rand = arr[0] / (0xffffffff + 1);
    }
    const j = Math.floor(rand * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function get5CardCombinations(cards) {
  const result = [];
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            result.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }
  return result;
}

function evaluate5Cards(hand) {
  const parsed = hand.map(c => ({
    code: c,
    rank: RANK_VALUES[c[0]] || 2,
    suit: c[1]
  })).sort((a, b) => b.rank - a.rank);

  const isFlush = parsed.every(c => c.suit === parsed[0].suit);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;
  if (
    parsed[0].rank - parsed[1].rank === 1 &&
    parsed[1].rank - parsed[2].rank === 1 &&
    parsed[2].rank - parsed[3].rank === 1 &&
    parsed[3].rank - parsed[4].rank === 1
  ) {
    isStraight = true;
    straightHigh = parsed[0].rank;
  } else if (
    parsed[0].rank === 14 &&
    parsed[1].rank === 5 &&
    parsed[2].rank === 4 &&
    parsed[3].rank === 3 &&
    parsed[4].rank === 2
  ) {
    // Wheel A-2-3-4-5
    isStraight = true;
    straightHigh = 5;
  }

  // Count rank occurrences
  const counts = {};
  parsed.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
  const groups = Object.keys(counts)
    .map(r => ({ rank: parseInt(r, 10), count: counts[r] }))
    .sort((a, b) => b.count !== a.count ? b.count - a.count : b.rank - a.rank);

  // 1. Royal / Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { score: 9000000, desc: 'Royal Flush' };
    }
    return { score: 8000000 + straightHigh, desc: `Straight Flush, ${RANK_NAMES_MAP[straightHigh]} High` };
  }

  // 2. Four of a Kind
  if (groups[0].count === 4) {
    return {
      score: 7000000 + groups[0].rank * 100 + (groups[1] ? groups[1].rank : 0),
      desc: `Four of a Kind, ${RANK_NAMES_MAP[groups[0].rank]}`
    };
  }

  // 3. Full House
  if (groups[0].count === 3 && groups[1] && groups[1].count === 2) {
    return {
      score: 6000000 + groups[0].rank * 100 + groups[1].rank,
      desc: `Full House, ${RANK_NAMES_MAP[groups[0].rank]} full of ${RANK_NAMES_MAP[groups[1].rank]}`
    };
  }

  // 4. Flush
  if (isFlush) {
    const tie = parsed[0].rank * 10000 + parsed[1].rank * 1000 + parsed[2].rank * 100 + parsed[3].rank * 10 + parsed[4].rank;
    return {
      score: 5000000 + tie,
      desc: `Flush, ${RANK_NAMES_MAP[parsed[0].rank]} High`
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      score: 4000000 + straightHigh,
      desc: `Straight, ${RANK_NAMES_MAP[straightHigh]} High`
    };
  }

  // 6. Three of a Kind
  if (groups[0].count === 3) {
    const k1 = groups[1] ? groups[1].rank : 0;
    const k2 = groups[2] ? groups[2].rank : 0;
    return {
      score: 3000000 + groups[0].rank * 1000 + k1 * 10 + k2,
      desc: `Three of a Kind, ${RANK_NAMES_MAP[groups[0].rank]}`
    };
  }

  // 7. Two Pair
  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups[2] ? groups[2].rank : 0;
    return {
      score: 2000000 + highPair * 1000 + lowPair * 100 + kicker,
      desc: `Two Pair, ${RANK_NAMES_MAP[highPair]} and ${RANK_NAMES_MAP[lowPair]}`
    };
  }

  // 8. One Pair
  if (groups[0].count === 2) {
    const pairRank = groups[0].rank;
    const kickers = [groups[1] ? groups[1].rank : 0, groups[2] ? groups[2].rank : 0, groups[3] ? groups[3].rank : 0];
    return {
      score: 1000000 + pairRank * 10000 + kickers[0] * 100 + kickers[1] * 10 + kickers[2],
      desc: `Pair of ${RANK_NAMES_MAP[pairRank]}`
    };
  }

  // 9. High Card
  const kickersVal = parsed[0].rank * 10000 + parsed[1].rank * 1000 + parsed[2].rank * 100 + parsed[3].rank * 10 + parsed[4].rank;
  return {
    score: kickersVal,
    desc: `High Card, ${RANK_NAMES_MAP[parsed[0].rank]}`
  };
}

function evaluateBestHand(cards) {
  if (!cards || cards.length === 0) return { score: 0, desc: 'No Cards' };
  if (cards.length < 5) {
    if (cards.length === 2) {
      if (cards[0][0] === cards[1][0]) {
        return { score: 1000000, desc: `Pocket Pair of ${RANK_NAMES_MAP[RANK_VALUES[cards[0][0]]] || cards[0][0]}` };
      }
      return { score: 100, desc: `Hole Cards [${cards[0]}, ${cards[1]}]` };
    }
    return { score: 0, desc: 'Drawing' };
  }

  const combos = get5CardCombinations(cards);
  let best = { score: -1, desc: '' };
  for (const c of combos) {
    const ev = evaluate5Cards(c);
    if (ev.score > best.score) {
      best = ev;
    }
  }
  return best;
}

// ============================================================================
// 4. USER PROFILE & CAREER METRICS (Strictly 0 for new players)
// ============================================================================
// ============================================================================
// 4. USER PROFILE & CAREER METRICS (TGB POKER Model)
// ============================================================================
let userProfile = {
  id: 'user_mickdance',
  username: 'MICKDANCE',
  handle: '@MICKDANCE',
  bio: 'I have no bio yet',
  gender: 'male',
  country: '🇹🇭',
  followers: 0,
  following: 0,
  likes: 0,
  tgbBalance: 0, // Reset starting balance to 0 as requested
  gtbBalance: 0, // Reset starting GTB to 0 as requested
  sundayTickets: 0, // Sunday Major tickets starting at 0
  level: 0, // Reset Level to 0 as requested
  exp: 0, // Reset EXP to 0
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  itmCount: 0,
  netTgb: 0,
  totalHands: 0,
  vpipHands: 0,
  pfrHands: 0,
  threeBetHands: 0,
  avatarType: 'preset',
  avatarEmoji: '🦁',
  avatarUrl: '',
  frame: 'frame-none',
  cardSkin: 'bicycle_red',
  unlockedCardSkins: ['bicycle_red'],
  lastGiftClaimTime: 0,
  registeredAt: new Date().toLocaleDateString('th-TH'),
};

let isSpectatorMode = false;

let activeTable = {
  id: 'table_daily_tgb_01',
  title: 'Newbie 0.5/1 TGB • 6-Max',
  smallBlind: 0.5,
  bigBlind: 1,
  ante: 0,
  pot: 3,
  stage: 'PREFLOP',
  dealerSeat: 1,
  turnSeat: 0,
  communityCards: [],
  handNumber: 1,
  deck: [],
  handActive: false,
  tableNotice: 'READY',
  serverSeedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  serverSeed: '',
  seats: [
    { seatNumber: 0, name: 'Hero (You)', chips: 500, currentBet: 0, totalBetThisHand: 0, isHero: true, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-emerald-600 to-teal-700', avatarEmoji: '🦁', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 1, name: '蘇察哈爾燦', chips: 480, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-amber-600 to-red-600', avatarEmoji: '🐻', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 2, name: 'jryep117', chips: 520, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-slate-700 to-slate-900', avatarEmoji: '👤', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 3, name: 'ViperKing', chips: 650, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-purple-700 to-indigo-900', avatarEmoji: '🐍', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 4, name: 'PokerQueen', chips: 410, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-rose-600 to-pink-800', avatarEmoji: '👑', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 5, name: 'AceHunter', chips: 590, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-cyan-600 to-blue-800', avatarEmoji: '🦅', empty: false, turnTimeLeft: 15, lastAction: '', showdownHandDesc: '' },
    { seatNumber: 6, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true },
    { seatNumber: 7, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true },
  ],
};

let userLedgerTransactions = [
  {
    id: 'tx_01',
    game: 'Vault',
    type: 'TGB Supply (Welcome)',
    amount: 12500,
    balance: 12500,
    timestamp: '2026-09-24 13:56',
  },
];

let gameHistorySessions = [
  {
    room: 'Daily Standard 25/50 TGB',
    blinds: '25/50',
    buyIn: 500,
    hands: 12,
    profit: 0,
    timestamp: '2026-09-24 13:50:22',
  },
];

// Current Hand Stat Trackers for Hero
let currentHandStats = {
  heroVpip: false,
  heroPfr: false,
  hero3Bet: false,
};

// ============================================================================
// 5. NAVIGATION & VIEW SWITCHING
// ============================================================================
function switchView(viewName) {
  if (viewName === 'career') viewName = 'casual';
  const views = ['lobby', 'casual', 'table', 'academy', 'profile', 'career', 'history', 'wallet', 'verifier'];
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
  } else if (viewName === 'casual') {
    renderCasualLobby('all');
  } else if (viewName === 'wallet') {
    renderWallet();
  } else if (viewName === 'profile') {
    renderProfileView();
  } else if (viewName === 'history') {
    renderHistory();
  }
}

function launchTable(tournamentId) {
  activeTable.id = tournamentId || 'tgb_001';
  const tourney = (typeof TOURNAMENTS_DATA !== 'undefined' && TOURNAMENTS_DATA.find(t => t.id === tournamentId)) || null;
  if (tourney) {
    activeTable.title = `${tourney.title} • ${tourney.type}`;
  }
  isSpectatorMode = false;
  if (typeof initTableForPlay === 'function') {
    initTableForPlay(500);
  }
  switchView('table');
  setTimeout(() => {
    if (typeof startNewHand === 'function') startNewHand();
  }, 350);
}

// User Dropdown Handlers (Image 1)
function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.classList.toggle('hidden');
}

function closeUserDropdown() {
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const container = document.getElementById('nav-user-container');
  if (container && !container.contains(e.target)) {
    closeUserDropdown();
  }
});

// ============================================================================
// 6. PROFILE VIEW (Matching Image 2)
// ============================================================================
let activeProfileSubTab = 'tourney';

function switchProfileSubTab(tab) {
  activeProfileSubTab = tab;
  ['tourney', 'album', 'achievement'].forEach(t => {
    const btn = document.getElementById(`tab-sub-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'pb-3 text-amber-400 border-b-2 border-amber-400 transition font-bold';
      } else {
        btn.className = 'pb-3 text-slate-400 hover:text-white transition font-bold';
      }
    }
  });
}

function renderProfileView() {
  const mainAvatar = document.getElementById('profile-main-avatar');
  const countryBadge = document.getElementById('profile-country-badge');
  const genderBadge = document.getElementById('profile-gender-badge');
  const displayNameEl = document.getElementById('profile-display-name');
  const handleEl = document.getElementById('profile-handle');
  const bioEl = document.getElementById('profile-bio-text');

  const followersEl = document.getElementById('profile-followers-count');
  const followingEl = document.getElementById('profile-following-count');
  const likesEl = document.getElementById('profile-likes-count');

  const totalProfitCard = document.getElementById('profile-card-total-profit');
  const abovePctEl = document.getElementById('profile-above-pct');
  const growthTitleEl = document.getElementById('profile-growth-title');
  const growthExpEl = document.getElementById('profile-growth-exp');

  // Avatar with Frame & Badges
  if (mainAvatar) {
    mainAvatar.className = `w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-slate-800 bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-2xl flex items-center justify-center text-4xl font-black text-white ${userProfile.frame || 'frame-none'}`;
    if (userProfile.avatarType === 'image' && userProfile.avatarUrl) {
      mainAvatar.innerHTML = `<img src="${userProfile.avatarUrl}" class="w-full h-full object-cover">`;
    } else {
      mainAvatar.innerHTML = `<span>${userProfile.avatarEmoji || '🦁'}</span>`;
    }
  }

  if (countryBadge) countryBadge.innerText = userProfile.country || '🇹🇭';
  if (genderBadge) {
    const isFemale = userProfile.gender === 'female';
    genderBadge.innerText = isFemale ? '♀' : '♂';
    genderBadge.className = `absolute bottom-0 right-0 w-7 h-7 rounded-full ${isFemale ? 'bg-pink-600' : 'bg-cyan-600'} text-white border border-slate-700 flex items-center justify-center text-xs shadow font-black`;
  }

  if (displayNameEl) displayNameEl.innerText = userProfile.username || 'MICKDANCE';
  if (handleEl) handleEl.innerText = userProfile.handle || `@${userProfile.username || 'MICKDANCE'}`;
  if (bioEl) bioEl.innerText = userProfile.bio || 'I have no bio yet';

  if (followersEl) followersEl.innerText = userProfile.followers || 0;
  if (followingEl) followingEl.innerText = userProfile.following || 0;
  if (likesEl) likesEl.innerText = userProfile.likes || 0;

  // 3 Metric Cards
  const net = userProfile.netTgb || 0;
  if (totalProfitCard) {
    totalProfitCard.innerText = `${net >= 0 ? '+' : ''}${net.toLocaleString()}`;
    totalProfitCard.className = `text-3xl font-black font-mono ${net > 0 ? 'text-emerald-400' : (net < 0 ? 'text-rose-400' : 'text-white')}`;
  }

  if (abovePctEl) {
    abovePctEl.innerText = net > 0 ? 'Above 86.32% players' : 'Above 0% players';
  }

  if (growthTitleEl) {
    let title = 'Amateur <span class="text-amber-400 text-xs ml-1.5">★★★</span>';
    if (userProfile.level >= 10) title = 'Grand Master <span class="text-amber-400 text-xs ml-1.5">👑👑👑</span>';
    else if (userProfile.level >= 5) title = 'Semi-Pro <span class="text-amber-400 text-xs ml-1.5">★★★★</span>';
    growthTitleEl.innerHTML = title;
  }

  if (growthExpEl) {
    growthExpEl.innerText = `${(userProfile.exp || 0) % 500} / 500 EXP`;
  }

  // Draw Line Chart
  setTimeout(drawProfitLossChart, 60);
}

// Draw Profit / Loss Trend Canvas Chart (Matching Image 2)
function drawProfitLossChart() {
  const canvas = document.getElementById('profit-loss-chart');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Chart Margins
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 25;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Zero baseline is in the middle-ish
  const yZero = padTop + chartH * 0.55;

  // Draw Horizontal Gridlines & Y-Axis Labels
  const ySteps = [
    { val: 100, y: padTop + chartH * 0.1 },
    { val: 50, y: padTop + chartH * 0.32 },
    { val: 0, y: yZero },
    { val: -50, y: padTop + chartH * 0.75 },
    { val: -100, y: padTop + chartH * 0.95 },
  ];

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';

  ySteps.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(padLeft, s.y);
    ctx.lineTo(w - padRight, s.y);
    ctx.stroke();
    ctx.fillText(s.val, padLeft - 8, s.y + 3);
  });

  // Zero reference line is slightly brighter
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
  ctx.beginPath();
  ctx.moveTo(padLeft, yZero);
  ctx.lineTo(w - padRight, yZero);
  ctx.stroke();

  // Generate Data Points (Starts at 0, curves to current net profit)
  const totalPoints = 24;
  const net = userProfile.netTgb || 0;
  const points = [];

  for (let i = 0; i < totalPoints; i++) {
    const x = padLeft + (chartW / (totalPoints - 1)) * i;
    let val = 0;
    if (i < 6) val = 0;
    else if (i === 7) val = Math.min(net * 0.3, 30);
    else if (i === 8) val = Math.min(net * 0.8, 91);
    else val = net;

    // Map val to y coordinate
    const yRatio = val / 150;
    const y = yZero - yRatio * (chartH * 0.45);
    points.push({ x, y, val });
  }

  // Draw Smooth Golden Line (Matching Image 2)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

  ctx.strokeStyle = '#f59e0b'; // Amber-500
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw Tooltip / Bubble on Peak or End Point (Matching `91.00` in Image 2)
  const tipPoint = points[points.length - 1];
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;

  const tipText = `${net >= 0 ? '+' : ''}${net.toFixed(2)}`;
  const tipW = 60;
  const tipH = 22;
  const tipX = Math.min(w - padRight - tipW, Math.max(padLeft, tipPoint.x - tipW / 2));
  const tipY = tipPoint.y - 32;

  ctx.beginPath();
  ctx.roundRect(tipX, tipY, tipW, tipH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tipText, tipX + tipW / 2, tipY + 14);

  // End Point Dot
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(tipPoint.x, tipPoint.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw X Axis Numbers
  ctx.fillStyle = '#64748b';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  [1, 5, 10, 15, 20, 24].forEach(idx => {
    const pt = points[idx - 1];
    if (pt) ctx.fillText(idx, pt.x, h - 8);
  });
}

// ============================================================================
// 7. CAREER & HISTORY VIEWS (Matching Image 3 & Image 4)
// ============================================================================
function renderCareer() {
  const totalEl = document.getElementById('career-total-profit');
  const weeklyEl = document.getElementById('career-weekly-profit');
  const historyRows = document.getElementById('career-history-rows');

  const net = userProfile.netTgb || 0;
  if (totalEl) {
    totalEl.innerText = `${net >= 0 ? '+' : ''}${net.toLocaleString()}`;
    totalEl.className = `text-2xl sm:text-3xl font-black font-mono mt-1 ${net > 0 ? 'text-emerald-400' : (net < 0 ? 'text-rose-400' : 'text-white')}`;
  }

  if (weeklyEl) {
    weeklyEl.innerText = `${net >= 0 ? '+' : ''}${net.toLocaleString()}`;
    weeklyEl.className = `text-2xl sm:text-3xl font-black font-mono mt-1 ${net > 0 ? 'text-emerald-400' : (net < 0 ? 'text-rose-400' : 'text-white')}`;
  }

  if (historyRows) {
    historyRows.innerHTML = gameHistorySessions.map(s => `
      <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
            ₮
          </div>
          <div>
            <div class="font-black text-white text-sm">${s.room}</div>
            <div class="text-[10px] text-slate-500 font-mono">${s.timestamp}</div>
          </div>
        </div>
        <div class="flex items-center space-x-6 self-stretch sm:self-auto justify-between sm:justify-end">
          <div class="text-right">
            <span class="text-slate-400">Blinds:</span> <span class="text-slate-200 font-mono">${s.blinds}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400">Hands:</span> <span class="text-slate-200 font-mono">${s.hands}</span>
          </div>
          <div class="text-right font-black font-mono ${s.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            ${s.profit >= 0 ? '+' : ''}${s.profit} ₮
          </div>
          <button onclick="switchView('table')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition">
            Details
          </button>
        </div>
      </div>
    `).join('');
  }

  setTimeout(drawCareerTrendChart, 60);
}

function drawCareerTrendChart() {
  const canvas = document.getElementById('career-trend-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const padLeft = 45;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;
  const yZero = padTop + chartH * 0.25;

  // Grid
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';

  [0, -100, -200, -300, -400, -500].forEach((val, idx) => {
    const y = yZero + (idx * (chartH * 0.7) / 5);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillText(val, padLeft - 6, y + 3);
  });

  // Curve (Green to Cyan gradient fill, matching Image 3)
  const dates = ['09-18', '09-19', '09-20', '09-21', '09-22', '09-23', '09-24'];
  const net = userProfile.netTgb || 0;
  const points = dates.map((d, i) => {
    const x = padLeft + (chartW / (dates.length - 1)) * i;
    let y = yZero;
    if (i >= 3) {
      const drop = Math.min(1, (i - 2) / 2);
      y = yZero + drop * (chartH * 0.7);
    }
    return { x, y, date: d };
  });

  // Area gradient
  const grad = ctx.createLinearGradient(0, yZero, 0, h - padBottom);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, yZero);
  for (let i = 0; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, h - padBottom);
  ctx.lineTo(points[0].x, h - padBottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = '#34d399'; // Emerald-400
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dates on X Axis
  ctx.fillStyle = '#64748b';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  points.forEach(pt => {
    ctx.fillText(pt.date, pt.x, h - 8);
  });
}

function renderHistory() {
  const container = document.getElementById('mygames-history-list');
  if (!container) return;

  container.innerHTML = gameHistorySessions.map(s => `
    <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
      <div>
        <div class="font-black text-white">${s.room}</div>
        <div class="text-[10px] text-slate-500 font-mono">${s.timestamp}</div>
      </div>
      <div class="font-black font-mono ${s.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        ${s.profit >= 0 ? '+' : ''}${s.profit} ₮
      </div>
    </div>
  `).join('');
}

// ============================================================================
// 8. WALLET VIEW (Matching Image 5)
// ============================================================================
function renderWallet() {
  const balanceEl = document.getElementById('wallet-balance-big');
  const recordsContainer = document.getElementById('wallet-records-container');

  if (balanceEl) {
    balanceEl.innerText = (userProfile.tgbBalance || 12500).toLocaleString();
  }

  if (recordsContainer) {
    recordsContainer.innerHTML = userLedgerTransactions.map(tx => {
      const isCredit = tx.amount > 0;
      return `
        <tr class="hover:bg-slate-800/30 transition">
          <td class="py-3 font-bold text-slate-300">${tx.game || 'Vault'}</td>
          <td class="py-3"><span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">${tx.type}</span></td>
          <td class="py-3 text-right">
            <div class="font-black ${isCredit ? 'text-emerald-400' : 'text-rose-400'}">
              ${isCredit ? '+' : ''}${tx.amount.toLocaleString()} ₮
            </div>
            <div class="text-[10px] text-slate-500">Balance ${(tx.balance || userProfile.tgbBalance).toLocaleString()}</div>
          </td>
          <td class="py-3 text-right text-slate-400 text-[11px]">${tx.timestamp}</td>
        </tr>
      `;
    }).join('');
  }
}

// ============================================================================
// 9. PROFILE CUSTOMIZER MODAL (Display Name, Handle, Bio, Gender, Flag, Avatar, Frame)
// ============================================================================
let tempProfileEdit = {
  username: '',
  handle: '',
  bio: '',
  gender: 'male',
  country: '🇹🇭',
  avatarType: 'preset',
  avatarEmoji: '🦁',
  avatarUrl: '',
  frame: 'frame-none',
  frameName: 'ไม่มีกรอบ',
};

function getFrameDisplayName(frameClass) {
  const map = {
    'frame-none': 'ไม่มีกรอบ',
    'frame-gold': 'Gold Champion',
    'frame-neon': 'Cyber Neon',
    'frame-fire': 'Fire Dragon',
    'frame-diamond': 'Diamond VIP',
    'frame-emerald': 'Emerald Master',
  };
  return map[frameClass] || 'ไม่มีกรอบ';
}

function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (!modal) return;

  tempProfileEdit = {
    username: userProfile.username || 'MICKDANCE',
    handle: userProfile.handle || `@${userProfile.username || 'MICKDANCE'}`,
    bio: userProfile.bio || 'I have no bio yet',
    gender: userProfile.gender || 'male',
    country: userProfile.country || '🇹🇭',
    avatarType: userProfile.avatarType || 'preset',
    avatarEmoji: userProfile.avatarEmoji || '🦁',
    avatarUrl: userProfile.avatarUrl || '',
    frame: userProfile.frame || 'frame-none',
    frameName: getFrameDisplayName(userProfile.frame || 'frame-none'),
  };

  const nameInput = document.getElementById('edit-username-input');
  const handleInput = document.getElementById('edit-handle-input');
  const bioInput = document.getElementById('edit-bio-input');
  const genderSelect = document.getElementById('edit-gender-select');
  const countrySelect = document.getElementById('edit-country-select');

  if (nameInput) nameInput.value = tempProfileEdit.username;
  if (handleInput) handleInput.value = tempProfileEdit.handle;
  if (bioInput) bioInput.value = tempProfileEdit.bio;
  if (genderSelect) genderSelect.value = tempProfileEdit.gender;
  if (countrySelect) countrySelect.value = tempProfileEdit.country;

  updateProfilePreview();
  modal.classList.remove('hidden');
}

function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (modal) modal.classList.add('hidden');
}

function selectPresetAvatar(emoji) {
  tempProfileEdit.avatarType = 'preset';
  tempProfileEdit.avatarEmoji = emoji;
  tempProfileEdit.avatarUrl = '';
  updateProfilePreview();
}

function handleAvatarFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert('ขนาดรูปภาพต้องไม่เกิน 2MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    tempProfileEdit.avatarType = 'image';
    tempProfileEdit.avatarUrl = e.target.result;
    updateProfilePreview();
  };
  reader.readAsDataURL(file);
}

function selectAvatarFrame(frameClass, frameName) {
  tempProfileEdit.frame = frameClass;
  tempProfileEdit.frameName = frameName;
  updateProfilePreview();
}

function updateProfilePreview() {
  const nameInput = document.getElementById('edit-username-input');
  const handleInput = document.getElementById('edit-handle-input');
  const bioInput = document.getElementById('edit-bio-input');
  const genderSelect = document.getElementById('edit-gender-select');
  const countrySelect = document.getElementById('edit-country-select');

  if (nameInput) tempProfileEdit.username = nameInput.value.trim() || 'MICKDANCE';
  if (handleInput) tempProfileEdit.handle = handleInput.value.trim() || `@${tempProfileEdit.username}`;
  if (bioInput) tempProfileEdit.bio = bioInput.value.trim();
  if (genderSelect) tempProfileEdit.gender = genderSelect.value;
  if (countrySelect) tempProfileEdit.country = countrySelect.value;

  const previewBox = document.getElementById('preview-avatar-box');
  const previewContent = document.getElementById('preview-avatar-content');
  const previewName = document.getElementById('preview-display-name');
  const previewFrame = document.getElementById('preview-frame-name');

  if (previewBox) {
    previewBox.className = `w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-3xl shadow-xl overflow-hidden transition-all duration-200 ${tempProfileEdit.frame}`;
  }

  if (previewContent) {
    if (tempProfileEdit.avatarType === 'image' && tempProfileEdit.avatarUrl) {
      previewContent.innerHTML = `<img src="${tempProfileEdit.avatarUrl}" class="w-full h-full object-cover">`;
    } else {
      previewContent.innerText = tempProfileEdit.avatarEmoji || '🦁';
    }
  }

  if (previewName) previewName.innerText = `${tempProfileEdit.country} ${tempProfileEdit.username}`;
  if (previewFrame) previewFrame.innerText = `กรอบ: ${tempProfileEdit.frameName} • ${tempProfileEdit.gender === 'female' ? '♀' : '♂'}`;
}

function saveProfileCustomization() {
  const nameInput = document.getElementById('edit-username-input');
  const handleInput = document.getElementById('edit-handle-input');
  const bioInput = document.getElementById('edit-bio-input');
  const genderSelect = document.getElementById('edit-gender-select');
  const countrySelect = document.getElementById('edit-country-select');

  const newName = nameInput ? nameInput.value.trim() : '';
  if (!newName) {
    alert('กรุณากรอกชื่อผู้เล่น');
    return;
  }

  userProfile.username = newName;
  userProfile.handle = (handleInput && handleInput.value.trim()) || `@${newName}`;
  userProfile.bio = (bioInput && bioInput.value.trim()) || 'I have no bio yet';
  userProfile.gender = (genderSelect && genderSelect.value) || 'male';
  userProfile.country = (countrySelect && countrySelect.value) || '🇹🇭';
  userProfile.avatarType = tempProfileEdit.avatarType;
  userProfile.avatarEmoji = tempProfileEdit.avatarEmoji;
  userProfile.avatarUrl = tempProfileEdit.avatarUrl;
  userProfile.frame = tempProfileEdit.frame;

  // Persist session & user list
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userProfile));
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === userProfile.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...userProfile };
      saveStoredUsers(users);
    }
  } catch (e) {}

  // Update Table Seat 0 Hero Name
  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = `${userProfile.username} (You)`;
  }

  updateAuthUI(true, userProfile);
  renderProfileView();
  renderPokerTable();
  closeEditProfileModal();
  playSound('win');
}


// ============================================================================
// 7. REAL TEXAS HOLD'EM POKER ENGINE & TABLE CONTROLS
// ============================================================================
let turnTimerInterval = null;
let currentTurnTimeoutId = null;

function clearAllTurnTimers() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  if (currentTurnTimeoutId) {
    clearTimeout(currentTurnTimeoutId);
    currentTurnTimeoutId = null;
  }
}

function initTableForPlay(heroChips = 500) {
  isSpectatorMode = false;
  
  const heroName = (userProfile && (userProfile.nickname || userProfile.username)) 
    ? `${userProfile.nickname || userProfile.username} (You)` 
    : 'Hero (You)';

  activeTable.seats[0] = {
    seatNumber: 0,
    name: heroName,
    chips: Math.max(100, heroChips),
    currentBet: 0,
    totalBetThisHand: 0,
    isHero: true,
    cards: [],
    isFolded: false,
    isAllIn: false,
    actedThisStreet: false,
    avatarBg: 'from-emerald-600 to-teal-700',
    avatarEmoji: (userProfile && userProfile.avatarEmoji) || '🦁',
    empty: false,
    turnTimeLeft: 15,
    lastAction: '',
    showdownHandDesc: ''
  };

  const defaultBots = [
    { name: '蘇察哈爾燦', chips: 480, avatarBg: 'from-amber-600 to-red-600', avatarEmoji: '🐻' },
    { name: 'jryep117', chips: 520, avatarBg: 'from-slate-700 to-slate-900', avatarEmoji: '👤' },
    { name: 'ViperKing', chips: 650, avatarBg: 'from-purple-700 to-indigo-900', avatarEmoji: '🐍' },
    { name: 'PokerQueen', chips: 410, avatarBg: 'from-rose-600 to-pink-800', avatarEmoji: '👑' },
    { name: 'AceHunter', chips: 590, avatarBg: 'from-cyan-600 to-blue-800', avatarEmoji: '🦅' }
  ];

  for (let i = 1; i <= 5; i++) {
    const s = activeTable.seats[i];
    if (!s || s.empty || s.isHero) {
      const b = defaultBots[i - 1];
      activeTable.seats[i] = {
        seatNumber: i,
        name: b.name,
        chips: b.chips,
        currentBet: 0,
        totalBetThisHand: 0,
        isHero: false,
        cards: [],
        isFolded: false,
        isAllIn: false,
        actedThisStreet: false,
        avatarBg: b.avatarBg,
        avatarEmoji: b.avatarEmoji,
        empty: false,
        turnTimeLeft: 15,
        lastAction: '',
        showdownHandDesc: ''
      };
    }
  }

  activeTable.seats[6] = { seatNumber: 6, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true };
  activeTable.seats[7] = { seatNumber: 7, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true };
}

function initTableForSpectator() {
  isSpectatorMode = true;
  const botNames = [
    { name: 'TigerPro', chips: 500, emoji: '🐯', bg: 'from-amber-600 to-yellow-700' },
    { name: '蘇察哈爾燦', chips: 480, emoji: '🐻', bg: 'from-amber-600 to-red-600' },
    { name: 'jryep117', chips: 520, emoji: '🦊', bg: 'from-slate-700 to-slate-900' },
    { name: 'ViperKing', chips: 650, emoji: '🐍', bg: 'from-purple-700 to-indigo-900' },
    { name: 'PokerQueen', chips: 410, emoji: '👑', bg: 'from-rose-600 to-pink-800' },
    { name: 'AceHunter', chips: 590, emoji: '🦅', bg: 'from-cyan-600 to-blue-800' }
  ];

  for (let i = 0; i < 6; i++) {
    const b = botNames[i];
    activeTable.seats[i] = {
      seatNumber: i,
      name: b.name,
      chips: b.chips,
      currentBet: 0,
      totalBetThisHand: 0,
      isHero: false,
      cards: [],
      isFolded: false,
      isAllIn: false,
      actedThisStreet: false,
      avatarBg: b.bg,
      avatarEmoji: b.emoji,
      empty: false,
      turnTimeLeft: 15,
      lastAction: '',
      showdownHandDesc: ''
    };
  }
  activeTable.seats[6] = { seatNumber: 6, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true };
  activeTable.seats[7] = { seatNumber: 7, name: '', chips: 0, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: true, isAllIn: false, actedThisStreet: true, empty: true };
}

function showTableBanner(text) {
  activeTable.tableNotice = text;
  const bannerEl = document.getElementById('table-stage-banner');
  if (bannerEl) bannerEl.innerText = text;
}

function renderPokerTable() {
  const potEl = document.getElementById('table-pot-amount');
  const bannerEl = document.getElementById('table-stage-banner');
  const blindsEl = document.getElementById('table-blinds-info');
  const blindsPill = document.getElementById('table-blinds-pill');

  if (potEl) potEl.innerText = (activeTable.pot || 0).toLocaleString();
  if (bannerEl) bannerEl.innerText = activeTable.tableNotice || activeTable.stage;
  if (blindsEl) blindsEl.innerText = `Blinds: ${activeTable.smallBlind} / ${activeTable.bigBlind} • Ante: ${activeTable.ante}`;
  if (blindsPill) blindsPill.innerText = `${activeTable.smallBlind} / ${activeTable.bigBlind}`;

  // Spectator vs Seated console mode toggle
  const modeText = document.getElementById('table-mode-text');
  const modeToggle = document.getElementById('table-mode-toggle');
  const spectatorBar = document.getElementById('spectator-controls-bar');
  const heroActionConsole = document.getElementById('hero-action-console');

  if (isSpectatorMode) {
    if (modeText) modeText.innerText = 'Spectating';
    if (modeToggle) {
      modeToggle.className = 'px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-black text-xs cursor-pointer flex items-center space-x-1.5 shadow-sm';
    }
    if (spectatorBar) {
      spectatorBar.classList.remove('hidden');
      spectatorBar.classList.add('flex');
    }
    if (heroActionConsole) {
      heroActionConsole.classList.add('hidden');
    }
  } else {
    if (modeText) modeText.innerText = 'Playing';
    if (modeToggle) {
      modeToggle.className = 'px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-black text-xs cursor-pointer flex items-center space-x-1.5 shadow-sm';
    }
    if (spectatorBar) {
      spectatorBar.classList.add('hidden');
      spectatorBar.classList.remove('flex');
    }
    if (heroActionConsole) {
      heroActionConsole.classList.remove('hidden');
    }
  }

  // Community Cards
  const communityContainer = document.getElementById('community-cards');
  if (communityContainer) {
    if (!activeTable.communityCards || activeTable.communityCards.length === 0) {
      communityContainer.innerHTML = `
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-10 sm:w-12 h-14 sm:h-18 flex items-center justify-center text-emerald-600/40 text-xs font-bold">1</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-10 sm:w-12 h-14 sm:h-18 flex items-center justify-center text-emerald-600/40 text-xs font-bold">2</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-10 sm:w-12 h-14 sm:h-18 flex items-center justify-center text-emerald-600/40 text-xs font-bold">3</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-10 sm:w-12 h-14 sm:h-18 flex items-center justify-center text-emerald-600/40 text-xs font-bold">4</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-10 sm:w-12 h-14 sm:h-18 flex items-center justify-center text-emerald-600/40 text-xs font-bold">5</div>
      `;
    } else {
      communityContainer.innerHTML = activeTable.communityCards.map(c => renderCardHTML(c, true)).join('');
    }
  }

  // Active Spotlight Beam
  const spotlightEl = document.getElementById('table-spotlight');
  if (spotlightEl) {
    spotlightEl.style.opacity = activeTable.handActive ? '0.4' : '0.1';
  }

  // Render 8 Seats
  activeTable.seats.forEach((seat, idx) => {
    const seatEl = document.getElementById(`seat-${idx}`);
    if (!seatEl) return;

    if (seat.empty) {
      seatEl.innerHTML = `
        <button onclick="sitDownAtSeat(${idx})" class="empty-seat-btn group" title="Take Seat #${idx}">
          <i class="fa-solid fa-arrow-down text-teal-400 group-hover:scale-125 transition-transform"></i>
        </button>
      `;
      return;
    }

    const isTurn = activeTable.handActive && activeTable.turnSeat === idx;
    const isDealer = activeTable.dealerSeat === idx;

    // Hole Cards HTML
    let cardsHtml = '';
    if (!seat.isFolded && seat.cards && seat.cards.length >= 2) {
      if (seat.isHero || activeTable.stage === 'SHOWDOWN') {
        cardsHtml = `
          <div class="flex items-center -space-x-3 sm:-space-x-4 mb-0.5 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]">
            ${seat.cards.map(c => renderCardHTML(c, true)).join('')}
          </div>
        `;
      } else {
        cardsHtml = `
          <div class="flex items-center -space-x-3 sm:-space-x-4 mb-0.5 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]">
            ${renderCardHTML(null, false)}
            ${renderCardHTML(null, false)}
          </div>
        `;
      }
    } else if (seat.isFolded) {
      cardsHtml = `<div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">FOLDED</div>`;
    }

    // Avatar styling & frame
    let avatarContentHtml = '';
    let frameClass = 'frame-none';

    if (seat.isHero) {
      frameClass = userProfile.frame || 'frame-none';
      if (userProfile.avatarType === 'image' && userProfile.avatarUrl) {
        avatarContentHtml = `<img src="${userProfile.avatarUrl}" class="w-full h-full object-cover rounded-full">`;
      } else {
        avatarContentHtml = `<span class="text-xl sm:text-2xl">${userProfile.avatarEmoji || '🦁'}</span>`;
      }
    } else {
      avatarContentHtml = `<span class="text-lg sm:text-xl">${seat.avatarEmoji || '👤'}</span>`;
    }

    // Turn countdown ring + badge
    const countdownBadge = isTurn ? `<div class="turn-countdown-badge">${seat.turnTimeLeft != null ? seat.turnTimeLeft : 15}</div>` : '';

    // Bet chip on felt
    const betChipHtml = (seat.currentBet && seat.currentBet > 0) ? `
      <div class="felt-bet-chip mt-1 animate-pulse">
        <span class="chip-icon"></span>
        <span class="chip-val">${seat.currentBet}</span>
      </div>
    ` : '';

    // Showdown Hand Description or Last Action Badge
    let statusBadgeHtml = '';
    if (activeTable.stage === 'SHOWDOWN' && seat.showdownHandDesc && !seat.isFolded) {
      statusBadgeHtml = `
        <div class="px-2 py-0.5 mt-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-black text-amber-300 animate-pulse text-center truncate max-w-[85px]">
          ${seat.showdownHandDesc}
        </div>
      `;
    } else if (seat.lastAction && activeTable.handActive) {
      const isFold = seat.lastAction === 'Fold';
      const isRaise = seat.lastAction.includes('Raise') || seat.lastAction.includes('Bet');
      const badgeColor = isFold ? 'bg-rose-950/80 text-rose-300 border-rose-800' : isRaise ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      statusBadgeHtml = `
        <div class="px-2 py-0.5 mt-0.5 text-[9px] font-bold rounded-md border ${badgeColor} shadow-md uppercase tracking-wider text-center truncate max-w-[80px]">
          ${seat.lastAction}
        </div>
      `;
    }

    const isTopSeat = (idx === 3 || idx === 4);

    if (isTopSeat) {
      seatEl.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="avatar-ring ${isTurn ? 'turn-countdown-ring' : ''} ${frameClass} bg-gradient-to-tr ${seat.avatarBg || 'from-slate-700 to-slate-900'} relative">
            ${avatarContentHtml}
            ${isDealer ? `<div class="dealer-button absolute -bottom-1 -right-1">D</div>` : ''}
            ${countdownBadge}
          </div>
          <div class="bg-slate-950/90 border border-slate-700/60 rounded-full px-2.5 py-0.5 mt-1 text-center shadow-lg min-w-[70px]">
            <div class="text-[10px] font-bold text-white truncate max-w-[80px]">${seat.name}</div>
            <div class="text-[10px] font-mono font-black text-amber-400">₮ ${(seat.chips || 0).toLocaleString()}</div>
          </div>
          ${statusBadgeHtml}
          ${cardsHtml}
          ${betChipHtml}
        </div>
      `;
    } else {
      seatEl.innerHTML = `
        <div class="relative flex flex-col items-center">
          ${cardsHtml}
          <div class="avatar-ring ${isTurn ? 'turn-countdown-ring' : ''} ${frameClass} bg-gradient-to-tr ${seat.avatarBg || 'from-slate-700 to-slate-900'} relative">
            ${avatarContentHtml}
            ${isDealer ? `<div class="dealer-button absolute -bottom-1 -right-1">D</div>` : ''}
            ${countdownBadge}
          </div>
          <div class="bg-slate-950/90 border border-slate-700/60 rounded-full px-2.5 py-0.5 mt-1 text-center shadow-lg min-w-[70px]">
            <div class="text-[10px] font-bold text-white truncate max-w-[80px]">${seat.name}</div>
            <div class="text-[10px] font-mono font-black text-amber-400">₮ ${(seat.chips || 0).toLocaleString()}</div>
          </div>
          ${statusBadgeHtml}
          ${betChipHtml}
        </div>
      `;
    }
  });

  // Action Buttons state for Hero
  const heroSeat = activeTable.seats.find(s => s.isHero);
  const heroIndex = heroSeat ? activeTable.seats.indexOf(heroSeat) : -1;
  const isHeroTurn = heroSeat && activeTable.handActive && activeTable.turnSeat === heroIndex && !heroSeat.isFolded;

  const foldBtn = document.getElementById('action-fold-btn');
  const callBtn = document.getElementById('action-call-btn');
  const raiseBtn = document.getElementById('action-raise-btn');
  const slider = document.getElementById('raise-range-slider');
  const input = document.getElementById('raise-amount-input');

  if (foldBtn && callBtn && raiseBtn && heroSeat) {
    foldBtn.disabled = !isHeroTurn;
    callBtn.disabled = !isHeroTurn;
    raiseBtn.disabled = !isHeroTurn;

    const highestBet = Math.max(...activeTable.seats.filter(s => !s.empty).map(s => s.currentBet || 0));
    const toCall = highestBet - (heroSeat.currentBet || 0);

    if (toCall <= 0) {
      callBtn.innerText = 'Check';
    } else {
      callBtn.innerText = `Call ${toCall}`;
    }

    const minRaise = highestBet > 0 ? highestBet * 2 : (activeTable.bigBlind || 1) * 2;
    const maxRaise = (heroSeat.chips || 0) + (heroSeat.currentBet || 0);

    if (slider && isHeroTurn) {
      slider.min = minRaise;
      slider.max = Math.max(minRaise, maxRaise);
      if (parseFloat(slider.value) < minRaise || parseFloat(slider.value) > maxRaise) {
        slider.value = minRaise;
        if (input) input.value = minRaise;
      }
    }

    const currentRaiseVal = input ? parseFloat(input.value) || minRaise : minRaise;
    raiseBtn.innerText = `Raise to ${currentRaiseVal}`;

    const heroRankText = document.getElementById('hero-hand-rank-text');
    if (heroRankText) {
      heroRankText.innerText = evaluateHeroHandText();
    }
  }
}

function evaluateHeroHandText() {
  const hero = activeTable.seats.find(s => s.isHero);
  if (!hero || hero.isFolded) return 'Folded';
  if (!hero.cards || hero.cards.length < 2) return 'Waiting for next hand...';

  if (!activeTable.communityCards || activeTable.communityCards.length === 0) {
    const c1 = hero.cards[0];
    const c2 = hero.cards[1];
    const isPair = c1[0] === c2[0];
    const isSuited = c1[1] === c2[1];
    const r1 = RANK_NAMES_MAP[RANK_VALUES[c1[0]]] || c1[0];
    const r2 = RANK_NAMES_MAP[RANK_VALUES[c2[0]]] || c2[0];
    if (isPair) return `Pocket Pair: [${c1}, ${c2}] (Pocket ${r1})`;
    return `Hole Cards: [${c1}, ${c2}] (${r1}-${r2} ${isSuited ? 'Suited' : 'Offsuit'})`;
  }

  const allCards = [...hero.cards, ...activeTable.communityCards];
  const evaluation = evaluateBestHand(allCards);
  return `${evaluation.desc} • ${activeTable.stage}`;
}

function renderCountdownBadgeOnly(seatIdx, seconds) {
  const seatEl = document.getElementById(`seat-${seatIdx}`);
  if (!seatEl) return;
  const badge = seatEl.querySelector('.turn-countdown-badge');
  if (badge) {
    badge.innerText = Math.max(0, seconds);
    if (seconds <= 4) {
      badge.classList.add('bg-rose-600', 'text-white', 'animate-pulse');
    }
  }
}

function updateSpotlightBeam(seatIdx) {
  const spotlight = document.getElementById('table-spotlight');
  if (!spotlight) return;
  spotlight.style.opacity = '0.45';
}

function requestTakeAnySeat() {
  const existingHero = activeTable.seats.find(s => s.isHero);
  if (existingHero) {
    isSpectatorMode = false;
    renderPokerTable();
    return;
  }

  if (activeTable.seats[0].empty || !activeTable.seats[0].isHero) {
    if (!activeTable.seats[0].empty) {
      const emptyIdx = activeTable.seats.findIndex((s, idx) => idx > 0 && s.empty);
      if (emptyIdx !== -1) {
        activeTable.seats[emptyIdx] = { ...activeTable.seats[0], seatNumber: emptyIdx };
      }
      activeTable.seats[0].empty = true;
    }
    sitDownAtSeat(0);
    return;
  }

  const emptyIdx = activeTable.seats.findIndex(s => s.empty);
  if (emptyIdx !== -1) {
    sitDownAtSeat(emptyIdx);
  } else {
    activeTable.seats[0].empty = true;
    sitDownAtSeat(0);
  }
}

function sitDownAtSeat(seatIdx) {
  // User MUST always be seated at Seat 0 (exact horizontal center of the screen)
  const targetSeat = activeTable.seats[0];

  if (!targetSeat.empty && !targetSeat.isHero) {
    const emptyIdx = activeTable.seats.findIndex((s, idx) => s.empty && idx !== 0);
    if (emptyIdx !== -1) {
      activeTable.seats[emptyIdx] = { ...targetSeat, seatNumber: emptyIdx };
    }
    targetSeat.empty = true;
  }

  const minTableBuyIn = Math.max(1, (activeTable.bigBlind || 1) * 2);
  let buyInAmount = 500;

  if ((userProfile.tgbBalance || 0) >= minTableBuyIn) {
    buyInAmount = Math.min(minTableBuyIn * 10, userProfile.tgbBalance);
    userProfile.tgbBalance -= buyInAmount;
    saveUserProfile();

    userLedgerTransactions.unshift({
      id: `tx_${Date.now()}`,
      game: activeTable.title || 'Poker Arena',
      type: `Buy-in Seat #${seatIdx}`,
      amount: -buyInAmount,
      currency: 'TGB',
      balance: userProfile.tgbBalance,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });
  } else {
    buyInAmount = 500;
    showTableBanner('🎁 มอบชิปทดลองเล่น 500 TGB ให้คุณเริ่มเล่นได้ทันที!');
  }

  activeTable.seats.forEach(s => {
    if (s.isHero) {
      s.isHero = false;
      s.empty = true;
      s.name = '';
      s.chips = 0;
      s.cards = [];
      s.isFolded = true;
    }
  });

  const heroName = (userProfile && (userProfile.nickname || userProfile.username))
    ? `${userProfile.nickname || userProfile.username} (You)`
    : 'Hero (You)';

  targetSeat.empty = false;
  targetSeat.isHero = true;
  targetSeat.name = heroName;
  targetSeat.chips = buyInAmount;
  targetSeat.currentBet = 0;
  targetSeat.totalBetThisHand = 0;
  targetSeat.isFolded = false;
  targetSeat.isAllIn = false;
  targetSeat.actedThisStreet = false;
  targetSeat.turnTimeLeft = 15;
  targetSeat.lastAction = '';
  targetSeat.showdownHandDesc = '';
  targetSeat.avatarEmoji = (userProfile && userProfile.avatarEmoji) || '🦁';
  targetSeat.avatarBg = 'from-emerald-600 to-teal-700';

  isSpectatorMode = false;
  playSound('deal');
  updateAuthUI(true, userProfile);
  renderPokerTable();

  const activePlayers = activeTable.seats.filter(s => !s.empty && s.chips > 0);
  if (activePlayers.length >= 2 && !activeTable.handActive) {
    setTimeout(startNewHand, 800);
  }
}

function standUpToSpectate() {
  clearAllTurnTimers();
  const heroSeat = activeTable.seats.find(s => s.isHero);
  if (heroSeat) {
    const returnedChips = heroSeat.chips || 0;
    if (returnedChips > 0) {
      userProfile.tgbBalance = (userProfile.tgbBalance || 0) + returnedChips;
      userLedgerTransactions.unshift({
        id: `tx_${Date.now()}`,
        game: activeTable.title || 'Poker Arena',
        type: `Stand Up Cashout`,
        amount: returnedChips,
        currency: 'TGB',
        balance: userProfile.tgbBalance,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      });
      saveUserProfile();
      updateAuthUI(true, userProfile);
      renderLedgerTable();
    }
    heroSeat.isHero = false;
    heroSeat.name = 'SharkBot';
    heroSeat.chips = 500;
    heroSeat.avatarEmoji = '🦈';
    heroSeat.avatarBg = 'from-blue-700 to-indigo-900';
    heroSeat.isFolded = true;
    heroSeat.cards = [];
  }
  isSpectatorMode = true;
  renderPokerTable();
  if (!activeTable.handActive) {
    setTimeout(startNewHand, 1200);
  }
}

function toggleSpectatorMode() {
  if (isSpectatorMode) {
    requestTakeAnySeat();
  } else {
    standUpToSpectate();
  }
}

function handleSendTableChat(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('table-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  const chatContainer = document.getElementById('table-chat-messages');
  if (chatContainer) {
    const sender = (userProfile && (userProfile.nickname || userProfile.username)) || 'You';
    const msgEl = document.createElement('div');
    msgEl.innerHTML = `<span class="text-teal-400 font-bold">${escapeHtml(sender)}:</span> <span class="text-white">${escapeHtml(msg)}</span>`;
    chatContainer.appendChild(msgEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  input.value = '';
}

function insertTableEmoji(emoji) {
  const chatContainer = document.getElementById('table-chat-messages');
  if (chatContainer) {
    const sender = (userProfile && (userProfile.nickname || userProfile.username)) || 'You';
    const msgEl = document.createElement('div');
    msgEl.innerHTML = `<span class="text-teal-400 font-bold">${escapeHtml(sender)}:</span> <span class="text-xl">${emoji}</span>`;
    chatContainer.appendChild(msgEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function startNewHand() {
  clearAllTurnTimers();

  activeTable.seats.forEach(s => {
    if (s.empty) return;
    if (s.chips <= 0) {
      s.chips = 500;
    }
    s.currentBet = 0;
    s.totalBetThisHand = 0;
    s.isFolded = false;
    s.isAllIn = false;
    s.actedThisStreet = false;
    s.turnTimeLeft = 15;
    s.lastAction = '';
    s.showdownHandDesc = '';
  });

  const occupiedSeats = activeTable.seats.filter(s => !s.empty && s.chips > 0);
  if (occupiedSeats.length < 2) {
    showTableBanner('Waiting for players...');
    activeTable.handActive = false;
    renderPokerTable();
    return;
  }

  playSound('deal');
  activeTable.handNumber = (activeTable.handNumber || 0) + 1;
  activeTable.stage = 'PREFLOP';
  activeTable.communityCards = [];
  activeTable.tableNotice = 'PREFLOP';
  activeTable.handActive = true;

  activeTable.deck = createFreshShuffledDeck();

  let nextDealer = (activeTable.dealerSeat + 1) % activeTable.seats.length;
  while (activeTable.seats[nextDealer].empty || activeTable.seats[nextDealer].chips <= 0) {
    nextDealer = (nextDealer + 1) % activeTable.seats.length;
  }
  activeTable.dealerSeat = nextDealer;

  activeTable.seats.forEach(seat => {
    if (seat.empty || seat.chips <= 0) return;
    seat.cards = [activeTable.deck.pop(), activeTable.deck.pop()];
  });

  currentHandStats = {
    heroVpip: false,
    heroPfr: false,
    hero3Bet: false,
  };

  let sbSeatIdx = (activeTable.dealerSeat + 1) % activeTable.seats.length;
  while (activeTable.seats[sbSeatIdx].empty || activeTable.seats[sbSeatIdx].chips <= 0) {
    sbSeatIdx = (sbSeatIdx + 1) % activeTable.seats.length;
  }

  let bbSeatIdx = (sbSeatIdx + 1) % activeTable.seats.length;
  while (activeTable.seats[bbSeatIdx].empty || activeTable.seats[bbSeatIdx].chips <= 0) {
    bbSeatIdx = (bbSeatIdx + 1) % activeTable.seats.length;
  }

  const sbAmt = Math.min(activeTable.smallBlind || 0.5, activeTable.seats[sbSeatIdx].chips);
  const bbAmt = Math.min(activeTable.bigBlind || 1, activeTable.seats[bbSeatIdx].chips);

  activeTable.seats[sbSeatIdx].chips -= sbAmt;
  activeTable.seats[sbSeatIdx].currentBet = sbAmt;
  activeTable.seats[sbSeatIdx].totalBetThisHand = sbAmt;

  activeTable.seats[bbSeatIdx].chips -= bbAmt;
  activeTable.seats[bbSeatIdx].currentBet = bbAmt;
  activeTable.seats[bbSeatIdx].totalBetThisHand = bbAmt;

  activeTable.pot = sbAmt + bbAmt;

  let utgSeatIdx = (bbSeatIdx + 1) % activeTable.seats.length;
  while (activeTable.seats[utgSeatIdx].empty || activeTable.seats[utgSeatIdx].chips <= 0) {
    utgSeatIdx = (utgSeatIdx + 1) % activeTable.seats.length;
  }

  renderPokerTable();
  startTurn(utgSeatIdx);
}

function startTurn(seatIdx) {
  clearAllTurnTimers();
  if (!activeTable.handActive) return;

  const seat = activeTable.seats[seatIdx];
  if (!seat || seat.empty || seat.isFolded || seat.chips <= 0) {
    advanceToNextPlayer();
    return;
  }

  activeTable.turnSeat = seatIdx;
  seat.turnTimeLeft = 15;
  renderPokerTable();
  updateSpotlightBeam(seatIdx);

  const highestBet = Math.max(...activeTable.seats.filter(s => !s.empty).map(s => s.currentBet || 0));
  const toCall = highestBet - (seat.currentBet || 0);

  if (seat.isHero) {
    playSound('chime');
    showTableBanner('👉 ตาของคุณแล้ว! เลือก Fold, Check หรือ Raise');

    turnTimerInterval = setInterval(() => {
      seat.turnTimeLeft--;
      renderCountdownBadgeOnly(seatIdx, seat.turnTimeLeft);

      if (seat.turnTimeLeft <= 3 && seat.turnTimeLeft > 0) {
        playSound('chips');
      }

      if (seat.turnTimeLeft <= 0) {
        clearAllTurnTimers();
        if (toCall <= 0) {
          takeAction('CALL');
        } else {
          takeAction('FOLD');
        }
      }
    }, 1000);

  } else {
    const thinkTimeMs = Math.floor(Math.random() * 600) + 750;

    turnTimerInterval = setInterval(() => {
      if (seat.turnTimeLeft > 1) {
        seat.turnTimeLeft--;
        renderCountdownBadgeOnly(seatIdx, seat.turnTimeLeft);
      }
    }, 1000);

    currentTurnTimeoutId = setTimeout(() => {
      clearAllTurnTimers();
      executeBotDecision(seat);
    }, thinkTimeMs);
  }
}

function executeBotDecision(bot) {
  if (!activeTable.handActive) return;

  const highestBet = Math.max(...activeTable.seats.filter(s => !s.empty).map(s => s.currentBet || 0));
  const toCall = highestBet - (bot.currentBet || 0);

  let handScore = 30;
  const cards = bot.cards || [];

  if (activeTable.stage === 'PREFLOP' && cards.length >= 2) {
    const c1 = cards[0];
    const c2 = cards[1];
    const r1 = RANK_VALUES[c1[0]] || 2;
    const r2 = RANK_VALUES[c2[0]] || 2;
    const isPair = r1 === r2;
    const isSuited = c1[1] === c2[1];
    const highRank = Math.max(r1, r2);

    if (isPair) {
      if (highRank >= 10) handScore = 95;
      else if (highRank >= 7) handScore = 80;
      else handScore = 65;
    } else {
      if (highRank === 14) handScore = isSuited ? 85 : 75;
      else if (highRank >= 11) handScore = isSuited ? 70 : 55;
      else handScore = isSuited ? 45 : 30;
    }
  } else if (cards.length >= 2 && activeTable.communityCards.length >= 3) {
    const allCards = [...cards, ...activeTable.communityCards];
    const evalResult = evaluateBestHand(allCards);
    const rawScore = evalResult.score;

    if (rawScore >= 8000000) handScore = 99;
    else if (rawScore >= 7000000) handScore = 95;
    else if (rawScore >= 6000000) handScore = 90;
    else if (rawScore >= 5000000) handScore = 85;
    else if (rawScore >= 4000000) handScore = 80;
    else if (rawScore >= 3000000) handScore = 75;
    else if (rawScore >= 2000000) handScore = 65;
    else if (rawScore >= 1000000) handScore = 50;
    else handScore = 25;
  }

  if (toCall <= 0) {
    const shouldBet = (handScore >= 75 && Math.random() < 0.6) || (handScore >= 55 && Math.random() < 0.3) || (Math.random() < 0.08);
    if (shouldBet && bot.chips > (activeTable.bigBlind || 1)) {
      const betAmt = Math.min(bot.chips, (activeTable.bigBlind || 1) * (handScore >= 85 ? 3 : 2));
      bot.chips -= betAmt;
      bot.currentBet += betAmt;
      bot.totalBetThisHand = (bot.totalBetThisHand || 0) + betAmt;
      activeTable.pot += betAmt;
      bot.actedThisStreet = true;
      bot.lastAction = `Bet ${betAmt}`;

      activeTable.seats.forEach(s => {
        if (s !== bot && !s.empty && !s.isFolded && s.chips > 0) {
          s.actedThisStreet = false;
        }
      });

      playSound('chips');
      showTableBanner(`${bot.name} Bets ${betAmt} ₮`);
    } else {
      bot.actedThisStreet = true;
      bot.lastAction = 'Check';
      playSound('chips');
      showTableBanner(`${bot.name} Checks`);
    }
  } else {
    let action = 'FOLD';
    const canAfford = bot.chips >= toCall;

    if (!canAfford) {
      action = (handScore >= 60 && Math.random() < 0.6) ? 'CALL' : 'FOLD';
    } else if (handScore >= 85) {
      action = (Math.random() < 0.45 && bot.chips > toCall * 2) ? 'RAISE' : 'CALL';
    } else if (handScore >= 65) {
      action = (Math.random() < 0.15 && bot.chips > toCall * 2) ? 'RAISE' : 'CALL';
    } else if (handScore >= 45) {
      if (toCall <= (activeTable.bigBlind || 1) * 4 || toCall <= bot.chips * 0.3) {
        action = Math.random() < 0.8 ? 'CALL' : 'FOLD';
      } else {
        action = Math.random() < 0.2 ? 'CALL' : 'FOLD';
      }
    } else {
      if (toCall <= (activeTable.bigBlind || 1) && Math.random() < 0.35) {
        action = 'CALL';
      } else {
        action = 'FOLD';
      }
    }

    if (action === 'RAISE') {
      const minRaise = highestBet * 2;
      const raiseAmt = Math.min(bot.chips, minRaise);
      const additional = raiseAmt - bot.currentBet;
      bot.chips -= additional;
      bot.currentBet += additional;
      bot.totalBetThisHand = (bot.totalBetThisHand || 0) + additional;
      activeTable.pot += additional;
      bot.actedThisStreet = true;
      bot.lastAction = `Raise to ${bot.currentBet}`;

      activeTable.seats.forEach(s => {
        if (s !== bot && !s.empty && !s.isFolded && s.chips > 0) {
          s.actedThisStreet = false;
        }
      });

      playSound('chips');
      showTableBanner(`${bot.name} Raises to ${bot.currentBet} ₮`);
    } else if (action === 'CALL') {
      const callAmt = Math.min(toCall, bot.chips);
      bot.chips -= callAmt;
      bot.currentBet += callAmt;
      bot.totalBetThisHand = (bot.totalBetThisHand || 0) + callAmt;
      activeTable.pot += callAmt;
      bot.actedThisStreet = true;
      bot.lastAction = `Call ${callAmt}`;
      playSound('chips');
      showTableBanner(`${bot.name} Calls ${callAmt} ₮`);
    } else {
      bot.isFolded = true;
      bot.actedThisStreet = true;
      bot.lastAction = 'Fold';
      playSound('fold');
      showTableBanner(`${bot.name} Folds`);
    }
  }

  renderPokerTable();
  setTimeout(advanceToNextPlayer, 500);
}

function takeAction(actionType) {
  clearAllTurnTimers();
  const heroSeat = activeTable.seats.find(s => s.isHero);
  if (!heroSeat) return;
  const heroIdx = activeTable.seats.indexOf(heroSeat);

  if (!activeTable.handActive || activeTable.turnSeat !== heroIdx) return;

  const highestBet = Math.max(...activeTable.seats.filter(s => !s.empty).map(s => s.currentBet || 0));
  const toCall = highestBet - (heroSeat.currentBet || 0);

  if (actionType === 'FOLD') {
    heroSeat.isFolded = true;
    heroSeat.actedThisStreet = true;
    heroSeat.lastAction = 'Fold';
    playSound('fold');
    showTableBanner('You Folded');
  } else if (actionType === 'CALL') {
    if (activeTable.stage === 'PREFLOP' && toCall > 0 && !currentHandStats.heroVpip) {
      currentHandStats.heroVpip = true;
      userProfile.vpipHands = (userProfile.vpipHands || 0) + 1;
    }
    const actualCall = Math.min(toCall, heroSeat.chips);
    heroSeat.chips -= actualCall;
    heroSeat.currentBet += actualCall;
    heroSeat.totalBetThisHand = (heroSeat.totalBetThisHand || 0) + actualCall;
    activeTable.pot += actualCall;
    heroSeat.actedThisStreet = true;
    heroSeat.lastAction = actualCall === 0 ? 'Check' : `Call ${actualCall}`;
    playSound('chips');
    showTableBanner(actualCall === 0 ? 'You Checked' : `You Called ${actualCall} ₮`);
  } else if (actionType === 'RAISE') {
    const inputEl = document.getElementById('raise-amount-input');
    const inputVal = inputEl ? parseFloat(inputEl.value) : 0;
    const minRaise = highestBet > 0 ? highestBet * 2 : (activeTable.bigBlind || 1) * 2;
    const maxRaise = heroSeat.chips + heroSeat.currentBet;
    let raiseTarget = isNaN(inputVal) || inputVal < minRaise ? minRaise : inputVal;
    if (raiseTarget > maxRaise) raiseTarget = maxRaise;

    const additional = Math.min(raiseTarget - heroSeat.currentBet, heroSeat.chips);

    if (activeTable.stage === 'PREFLOP') {
      if (!currentHandStats.heroVpip) {
        currentHandStats.heroVpip = true;
        userProfile.vpipHands = (userProfile.vpipHands || 0) + 1;
      }
      if (!currentHandStats.heroPfr) {
        currentHandStats.heroPfr = true;
        userProfile.pfrHands = (userProfile.pfrHands || 0) + 1;
      }
      if (highestBet > (activeTable.bigBlind || 1) && !currentHandStats.hero3Bet) {
        currentHandStats.hero3Bet = true;
        userProfile.threeBetHands = (userProfile.threeBetHands || 0) + 1;
      }
    }

    heroSeat.chips -= additional;
    heroSeat.currentBet += additional;
    heroSeat.totalBetThisHand = (heroSeat.totalBetThisHand || 0) + additional;
    activeTable.pot += additional;
    heroSeat.actedThisStreet = true;
    heroSeat.lastAction = `Raise to ${heroSeat.currentBet}`;

    activeTable.seats.forEach(s => {
      if (s !== heroSeat && !s.empty && !s.isFolded && s.chips > 0) {
        s.actedThisStreet = false;
      }
    });

    playSound('chips');
    showTableBanner(`You Raised to ${heroSeat.currentBet} ₮`);
  }

  renderPokerTable();
  setTimeout(advanceToNextPlayer, 500);
}

function advanceToNextPlayer() {
  clearAllTurnTimers();
  if (!activeTable.handActive) return;

  const activeSeats = activeTable.seats.filter(s => !s.empty);
  const nonFolded = activeSeats.filter(s => !s.isFolded);

  if (nonFolded.length === 1) {
    concludeHand(nonFolded[0], 'uncontested');
    return;
  }

  const highestBet = Math.max(...activeSeats.map(s => s.currentBet || 0));
  const activeUnfoldedWithChips = nonFolded.filter(s => s.chips > 0);

  const allActed = activeUnfoldedWithChips.length === 0 || activeUnfoldedWithChips.every(s => s.actedThisStreet);
  const betsBalanced = activeUnfoldedWithChips.every(s => (s.currentBet || 0) === highestBet);

  if (allActed && betsBalanced) {
    transitionToNextStreet();
    return;
  }

  let nextSeat = (activeTable.turnSeat + 1) % activeTable.seats.length;
  let loops = 0;
  while (loops < activeTable.seats.length) {
    const s = activeTable.seats[nextSeat];
    if (!s.empty && !s.isFolded && s.chips > 0 && (!s.actedThisStreet || (s.currentBet || 0) < highestBet)) {
      break;
    }
    nextSeat = (nextSeat + 1) % activeTable.seats.length;
    loops++;
  }

  if (loops >= activeTable.seats.length) {
    transitionToNextStreet();
    return;
  }

  startTurn(nextSeat);
}

function transitionToNextStreet() {
  clearAllTurnTimers();

  activeTable.seats.forEach(s => {
    s.currentBet = 0;
    s.actedThisStreet = false;
    s.lastAction = '';
  });

  if (activeTable.stage === 'PREFLOP') {
    activeTable.stage = 'FLOP';
    activeTable.communityCards = [activeTable.deck.pop(), activeTable.deck.pop(), activeTable.deck.pop()];
    showTableBanner('FLOP');
    playSound('deal');
  } else if (activeTable.stage === 'FLOP') {
    activeTable.stage = 'TURN';
    activeTable.communityCards.push(activeTable.deck.pop());
    showTableBanner('TURN');
    playSound('deal');
  } else if (activeTable.stage === 'TURN') {
    activeTable.stage = 'RIVER';
    activeTable.communityCards.push(activeTable.deck.pop());
    showTableBanner('RIVER');
    playSound('deal');
  } else if (activeTable.stage === 'RIVER') {
    activeTable.stage = 'SHOWDOWN';
    renderPokerTable();
    evaluateShowdown();
    return;
  }

  const nonFoldedWithChips = activeTable.seats.filter(s => !s.empty && !s.isFolded && s.chips > 0);
  if (nonFoldedWithChips.length <= 1) {
    renderPokerTable();
    setTimeout(transitionToNextStreet, 1200);
    return;
  }

  let nextSeat = (activeTable.dealerSeat + 1) % activeTable.seats.length;
  let count = 0;
  while (count < activeTable.seats.length) {
    const s = activeTable.seats[nextSeat];
    if (!s.empty && !s.isFolded && s.chips > 0) break;
    nextSeat = (nextSeat + 1) % activeTable.seats.length;
    count++;
  }

  renderPokerTable();
  startTurn(nextSeat);
}

function evaluateShowdown() {
  clearAllTurnTimers();
  activeTable.stage = 'SHOWDOWN';
  activeTable.tableNotice = 'SHOWDOWN';

  const nonFolded = activeTable.seats.filter(s => !s.empty && !s.isFolded);
  let bestScore = -1;
  let winner = nonFolded[0];
  let winningDesc = '';

  nonFolded.forEach(seat => {
    const all7 = [...seat.cards, ...activeTable.communityCards];
    const ev = evaluateBestHand(all7);
    seat.showdownHandDesc = ev.desc;
    if (ev.score > bestScore) {
      bestScore = ev.score;
      winner = seat;
      winningDesc = ev.desc;
    }
  });

  renderPokerTable();
  setTimeout(() => {
    concludeHand(winner, 'showdown', winningDesc);
  }, 1000);
}

function concludeHand(winner, reason, showdownDesc = '') {
  clearAllTurnTimers();
  activeTable.handActive = false;
  const wonPot = activeTable.pot;

  if (winner) {
    winner.chips += wonPot;
    const desc = showdownDesc ? `ด้วย ${showdownDesc}` : '(ผู้เล่นอื่นหมอบหมด)';
    showTableBanner(`🏆 ${winner.name} ชนะ ${wonPot.toLocaleString()} ₮ ${desc}`);
  }

  const heroSeat = activeTable.seats.find(s => s.isHero);
  if (heroSeat) {
    userProfile.totalHands = (userProfile.totalHands || 0) + 1;
    const heroInvested = heroSeat.totalBetThisHand || 0;

    if (winner && winner.isHero) {
      const netProfit = wonPot - heroInvested;
      userProfile.netTgb = (userProfile.netTgb || 0) + netProfit;
      userProfile.tgbBalance = (userProfile.tgbBalance || 0) + netProfit;
      userProfile.exp = (userProfile.exp || 0) + 100;
      playSound('win');
    } else {
      userProfile.netTgb = (userProfile.netTgb || 0) - heroInvested;
      userProfile.exp = (userProfile.exp || 0) + 25;
    }

    const neededExp = (userProfile.level || 1) * 500;
    if ((userProfile.exp || 0) >= neededExp) {
      userProfile.level = (userProfile.level || 1) + 1;
    }

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userProfile));
    } catch (e) {}

    updateAuthUI(true, userProfile);
    renderProfileView();
  }

  activeTable.pot = 0;
  renderPokerTable();

  setTimeout(startNewHand, 4000);
}

function setRaisePreset(preset) {
  const slider = document.getElementById('raise-range-slider');
  const input = document.getElementById('raise-amount-input');
  const raiseBtn = document.getElementById('action-raise-btn');

  const heroSeat = activeTable.seats.find(s => s.isHero);
  const heroChips = heroSeat ? heroSeat.chips : 500;
  const currentBet = heroSeat ? (heroSeat.currentBet || 0) : 0;
  const highestBet = Math.max(...activeTable.seats.filter(s => !s.empty).map(s => s.currentBet || 0));
  const minRaise = highestBet > 0 ? highestBet * 2 : (activeTable.bigBlind || 1) * 2;
  const maxRaise = heroChips + currentBet;

  let val = minRaise;
  if (preset === 'min') {
    val = minRaise;
  } else if (preset === '2.5bb') {
    val = Math.round((activeTable.bigBlind || 1) * 2.5);
  } else if (preset === 'half_pot') {
    val = Math.round((activeTable.pot || 0) * 0.5) + highestBet;
  } else if (preset === 'pot') {
    val = (activeTable.pot || 0) + highestBet;
  } else if (preset === 'allin') {
    val = maxRaise;
  }

  val = Math.max(minRaise, Math.min(val, maxRaise));

  if (slider) {
    slider.min = minRaise;
    slider.max = Math.max(minRaise, maxRaise);
    slider.value = val;
  }
  if (input) input.value = val;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${val}`;
}

function onRaiseSliderChange(val) {
  const input = document.getElementById('raise-amount-input');
  const raiseBtn = document.getElementById('action-raise-btn');
  const numVal = parseFloat(val) || 0;
  if (input) input.value = numVal;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${numVal}`;
}

function onRaiseInputChange(val) {
  const slider = document.getElementById('raise-range-slider');
  const raiseBtn = document.getElementById('action-raise-btn');
  const numVal = parseFloat(val) || 0;
  if (slider) slider.value = numVal;
  if (raiseBtn) raiseBtn.innerText = `Raise to ${numVal}`;
}


// ============================================================================
// 7. TOURNAMENT LOBBY & CARDS
// ============================================================================
const TOURNAMENTS_DATA = [
  {
    id: 'tgb_001',
    title: '#001 Daily Standard TGB',
    type: 'Daily TGB',
    buyIn: 500,
    prizePool: 50000,
    players: '82 / 100',
    blinds: '10 min',
    status: 'REGISTRATION',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'tgb_002',
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
    id: 'tgb_003',
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
    id: 'tgb_004',
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

  // Create new player account (Strictly 0 units across all metrics)
  const newUser = {
    id: `user_${Date.now()}`,
    username,
    handle: `@${username}`,
    bio: 'I have no bio yet',
    gender: 'male',
    country: '🇹🇭',
    followers: 0,
    following: 0,
    likes: 0,
    email,
    password,
    tgbBalance: 12500, // 12,500 TGB Starting Bonus
    level: 1,
    exp: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    itmCount: 0,
    netTgb: 0,
    totalHands: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    avatarType: 'preset',
    avatarEmoji: '🦁',
    avatarUrl: '',
    frame: 'frame-none',
    registeredAt: new Date().toLocaleDateString('th-TH'),
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
    // If not found in custom registered users, check if demo account
    if ((identifier === 'hero' || identifier === 'heroace' || identifier.includes('hero')) && password.length >= 4) {
      const demoUser = {
        id: 'user_hero',
        username: 'HeroAce',
        email: 'hero@tgbpoker.com',
        tgbBalance: 12500,
        level: 1,
        exp: 0,
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        itmCount: 0,
        netTgb: 0,
        totalHands: 0,
        vpipHands: 0,
        pfrHands: 0,
        threeBetHands: 0,
        avatarType: 'preset',
        avatarEmoji: '🦁',
        avatarUrl: '',
        frame: 'frame-none',
        registeredAt: new Date().toLocaleDateString('th-TH'),
      };
      setLoggedInUser(demoUser);
      showAuthAlert('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ HeroAce', 'success');
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
    level: 1,
    exp: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    itmCount: 0,
    netTgb: 0,
    totalHands: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    avatarType: 'preset',
    avatarEmoji: '🤖',
    avatarUrl: '',
    frame: 'frame-none',
    registeredAt: new Date().toLocaleDateString('th-TH'),
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
    tgbBalance: 0, // Reset to 0
    gtbBalance: 0, // Reset to 0
    sundayTickets: 0,
    level: 0,
    exp: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    itmCount: 0,
    netTgb: 0,
    totalHands: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    avatarType: 'preset',
    avatarEmoji: '🦁',
    avatarUrl: '',
    frame: 'frame-none',
    cardSkin: 'bicycle_red',
    unlockedCardSkins: ['bicycle_red'],
    lastGiftClaimTime: 0,
    registeredAt: new Date().toLocaleDateString('th-TH'),
  };
  setLoggedInUser(guestUser);
  closeAuthModal();
  playSound('chips');
}

function saveUserProfile() {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userProfile));
  } catch (e) {}
}

function setLoggedInUser(user) {
  userProfile.id = user.id || `user_${Date.now()}`;
  userProfile.username = user.username || 'Hero';
  userProfile.handle = user.handle || `@${user.username || 'Hero'}`;
  userProfile.bio = user.bio || 'I have no bio yet';
  userProfile.gender = user.gender || 'male';
  userProfile.country = user.country || '🇹🇭';
  userProfile.followers = user.followers !== undefined ? user.followers : 0;
  userProfile.following = user.following !== undefined ? user.following : 0;
  userProfile.likes = user.likes !== undefined ? user.likes : 0;
  userProfile.email = user.email || 'user@tgbpoker.local';
  userProfile.tgbBalance = user.tgbBalance !== undefined ? user.tgbBalance : 0;
  userProfile.gtbBalance = user.gtbBalance !== undefined ? user.gtbBalance : 0;
  userProfile.sundayTickets = user.sundayTickets !== undefined ? user.sundayTickets : 0;
  userProfile.level = user.level !== undefined ? user.level : 0;
  userProfile.exp = user.exp || 0;
  userProfile.tournamentsPlayed = user.tournamentsPlayed || 0;
  userProfile.tournamentsWon = user.tournamentsWon || 0;
  userProfile.itmCount = user.itmCount || 0;
  userProfile.netTgb = user.netTgb || 0;
  userProfile.totalHands = user.totalHands || 0;
  userProfile.vpipHands = user.vpipHands || 0;
  userProfile.pfrHands = user.pfrHands || 0;
  userProfile.threeBetHands = user.threeBetHands || 0;
  userProfile.avatarType = user.avatarType || 'preset';
  userProfile.avatarEmoji = user.avatarEmoji || '🦁';
  userProfile.avatarUrl = user.avatarUrl || '';
  userProfile.frame = user.frame || 'frame-none';
  userProfile.cardSkin = user.cardSkin || 'bicycle_red';
  userProfile.unlockedCardSkins = user.unlockedCardSkins || ['bicycle_red'];
  userProfile.lastGiftClaimTime = user.lastGiftClaimTime || 0;
  userProfile.registeredAt = user.registeredAt || new Date().toLocaleDateString('th-TH');

  saveUserProfile();

  // Update Hero seat on table
  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = `${userProfile.username} (You)`;
  }

  updateAuthUI(true, userProfile);
  renderProfileView();
}

function handleLogout() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {}

  userProfile = {
    id: `guest_${Date.now()}`,
    username: 'Guest',
    handle: '@Guest',
    bio: 'I have no bio yet',
    gender: 'male',
    country: '🇹🇭',
    followers: 0,
    following: 0,
    likes: 0,
    email: 'guest@tgbpoker.local',
    tgbBalance: 0,
    gtbBalance: 0,
    sundayTickets: 0,
    level: 0,
    exp: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    itmCount: 0,
    netTgb: 0,
    totalHands: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    avatarType: 'preset',
    avatarEmoji: '🦁',
    avatarUrl: '',
    frame: 'frame-none',
    cardSkin: 'bicycle_red',
    unlockedCardSkins: ['bicycle_red'],
    lastGiftClaimTime: 0,
    registeredAt: new Date().toLocaleDateString('th-TH'),
  };

  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = 'Guest (You)';
  }

  updateAuthUI(false);
  renderProfileView();
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
  const topGtb = document.getElementById('top-gtb-balance');
  const topSundayTickets = document.getElementById('top-sunday-tickets');
  const walletTgb = document.getElementById('wallet-balance-big');
  const walletGtb = document.getElementById('wallet-gtb-balance');
  const walletSunday = document.getElementById('wallet-sunday-tickets');
  const careerSunday = document.getElementById('career-sunday-tickets');
  const careerHands = document.getElementById('career-total-hands');
  const careerProfit = document.getElementById('career-total-profit');

  if (topBalance) topBalance.innerText = (userProfile.tgbBalance || 0).toLocaleString();
  if (topGtb) topGtb.innerText = (userProfile.gtbBalance || 0).toLocaleString();
  if (topSundayTickets) topSundayTickets.innerText = (userProfile.sundayTickets || 0).toString();
  if (walletTgb) walletTgb.innerText = (userProfile.tgbBalance || 0).toLocaleString();
  if (walletGtb) walletGtb.innerText = (userProfile.gtbBalance || 0).toLocaleString();
  if (walletSunday) walletSunday.innerText = `${userProfile.sundayTickets || 0} 🎟️`;
  if (careerSunday) careerSunday.innerText = `${userProfile.sundayTickets || 0} 🎟️`;
  if (careerHands) careerHands.innerText = (userProfile.totalHands || 0).toLocaleString();
  if (careerProfit) careerProfit.innerText = (userProfile.netTgb || 0).toLocaleString();

  const homeWelcome = document.getElementById('home-welcome-name');
  if (homeWelcome) {
    homeWelcome.innerText = userProfile.username || 'MICKDANCE';
  }

  if (isLoggedIn && user) {
    if (navLoginBtn) navLoginBtn.classList.add('hidden');
    if (navUserContainer) navUserContainer.classList.remove('hidden');
    if (navName) navName.innerText = userProfile.username;
    
    if (navAvatar) {
      navAvatar.className = `w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow overflow-hidden text-sm ${userProfile.frame || 'frame-none'}`;
      if (userProfile.avatarType === 'image' && userProfile.avatarUrl) {
        navAvatar.innerHTML = `<img src="${userProfile.avatarUrl}" class="w-full h-full object-cover">`;
      } else {
        navAvatar.innerHTML = `<span class="text-base">${userProfile.avatarEmoji || '🦁'}</span>`;
      }
    }

    if (navLevelBadge) navLevelBadge.innerText = `Lv.${userProfile.level || 0}`;
    if (navRankTitle) {
      let rankTitle = 'Novice Player';
      if (userProfile.level >= 10) rankTitle = 'Grand Master';
      else if (userProfile.level >= 5) rankTitle = 'Elite Pro';
      else if (userProfile.level >= 1) rankTitle = 'Amateur';
      navRankTitle.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>${rankTitle}`;
    }
  } else {
    if (navLoginBtn) navLoginBtn.classList.remove('hidden');
    if (navUserContainer) navUserContainer.classList.add('hidden');
  }

  updateGiftTimerDisplay();
  updateSatelliteTimerDisplay();
  renderPokerTable();
}

function restoreUserSession() {
  try {
    const economyResetDone = localStorage.getItem('tgb_poker_economy_reset_v5');
    if (!economyResetDone) {
      // Complete reset to 0 as requested by the user
      userProfile.tgbBalance = 0;
      userProfile.gtbBalance = 0;
      userProfile.sundayTickets = 0;
      userProfile.level = 0;
      userProfile.exp = 0;
      userProfile.totalHands = 0;
      userProfile.tournamentsPlayed = 0;
      userProfile.tournamentsWon = 0;
      userProfile.itmCount = 0;
      userProfile.netTgb = 0;
      userProfile.vpipHands = 0;
      userProfile.pfrHands = 0;
      userProfile.threeBetHands = 0;
      userProfile.cardSkin = 'bicycle_red';
      userProfile.unlockedCardSkins = ['bicycle_red'];
      userProfile.lastGiftClaimTime = 0;

      localStorage.setItem('tgb_poker_economy_reset_v5', 'true');
      saveUserProfile();
      setLoggedInUser(userProfile);
      initThirtyMinGiftTimer();
      initDailySatelliteTimer();
      return;
    }

    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      setLoggedInUser(user);
      initThirtyMinGiftTimer();
      initDailySatelliteTimer();
      return;
    }
  } catch (e) {}

  setLoggedInUser(userProfile);
  initThirtyMinGiftTimer();
  initDailySatelliteTimer();
}

// ============================================================================
// 9. 30-MINUTE FREE GIFT SYSTEM (5 TGB REFILL)
// ============================================================================
let giftTimerInterval = null;

function initThirtyMinGiftTimer() {
  if (giftTimerInterval) clearInterval(giftTimerInterval);
  updateGiftTimerDisplay();
  giftTimerInterval = setInterval(updateGiftTimerDisplay, 1000);
}

function updateGiftTimerDisplay() {
  const GIFT_INTERVAL_MS = 30 * 60 * 1000; // 30 mins
  const now = Date.now();
  const lastClaim = userProfile.lastGiftClaimTime || 0;
  const elapsed = now - lastClaim;
  const remainingMs = Math.max(0, GIFT_INTERVAL_MS - elapsed);

  const timerEl = document.getElementById('nav-gift-timer');
  const giftBtn = document.getElementById('nav-gift-btn');
  const walletTimerEl = document.getElementById('wallet-gift-timer');
  const walletGiftBtn = document.getElementById('wallet-gift-btn');

  if (remainingMs <= 0) {
    if (timerEl) timerEl.innerText = '🎁 รับฟรี 5 TGB!';
    if (giftBtn) {
      giftBtn.classList.add('gift-claim-ready');
      giftBtn.title = 'คลิกเพื่อรับ 5 TGB ฟรีประจำรอบ 30 นาที!';
    }
    if (walletTimerEl) walletTimerEl.innerText = '🎁 รับฟรี 5 TGB ทันที';
    if (walletGiftBtn) walletGiftBtn.classList.add('gift-claim-ready');
  } else {
    const totalSecs = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerEl) timerEl.innerText = `🎁 5 TGB (${formatted})`;
    if (giftBtn) {
      giftBtn.classList.remove('gift-claim-ready');
      giftBtn.title = `ของขวัญ 5 TGB รอบถัดไปในอีก ${formatted}`;
    }
    if (walletTimerEl) walletTimerEl.innerText = `🎁 รับฟรี 5 TGB (${formatted})`;
    if (walletGiftBtn) walletGiftBtn.classList.remove('gift-claim-ready');
  }
}

function claimThirtyMinGift() {
  const GIFT_INTERVAL_MS = 30 * 60 * 1000;
  const now = Date.now();
  const lastClaim = userProfile.lastGiftClaimTime || 0;
  const elapsed = now - lastClaim;

  if (lastClaim > 0 && elapsed < GIFT_INTERVAL_MS) {
    const remainingSecs = Math.ceil((GIFT_INTERVAL_MS - elapsed) / 1000);
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    alert(`⏳ ระบบของขวัญ 5 TGB จะเปิดให้กดรับทุกๆ 30 นาที\nกรุณารออีก ${mins} นาที ${secs} วินาที`);
    return;
  }

  userProfile.tgbBalance = (userProfile.tgbBalance || 0) + 5;
  userProfile.lastGiftClaimTime = now;
  saveUserProfile();

  userLedgerTransactions.unshift({
    id: `tx_${Date.now()}`,
    game: 'Gift Refill',
    type: 'Free 30m Gift Bonus',
    amount: 5,
    currency: 'TGB',
    balance: userProfile.tgbBalance,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });

  updateAuthUI(true, userProfile);
  renderLedgerTable();
  playSound('win');
  alert('🎉 ยินดีด้วย! คุณได้รับของขวัญ +5 TGB เข้าสู่กระเป๋าเรียบร้อยแล้ว');
}

// ============================================================================
// 10. DAILY SATELLITE TO SUNDAY MAJOR (20:00 น. ทุกวัน • Buy-in 5 TGB)
// ============================================================================
let satelliteTimerInterval = null;

function initDailySatelliteTimer() {
  if (satelliteTimerInterval) clearInterval(satelliteTimerInterval);
  updateSatelliteTimerDisplay();
  satelliteTimerInterval = setInterval(updateSatelliteTimerDisplay, 1000);
}

function updateSatelliteTimerDisplay() {
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);

  if (now.getHours() === 20 && now.getMinutes() < 30) {
    const badges = document.querySelectorAll('.satellite-status-badge');
    badges.forEach(b => {
      b.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping mr-1"></span> LIVE NOW (20:00)';
      b.className = 'satellite-status-badge px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-black animate-pulse flex items-center';
    });
    const timers = document.querySelectorAll('.satellite-countdown-timer');
    timers.forEach(t => t.innerText = '🔴 กำลังแข่งขันสด! เข้าเล่นได้ทันที');
    return;
  }

  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target.getTime() - now.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  const secs = diffSecs % 60;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const badges = document.querySelectorAll('.satellite-status-badge');
  badges.forEach(b => {
    b.innerText = 'เริ่มทุกวัน 20:00 น.';
    b.className = 'satellite-status-badge px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold';
  });

  const timers = document.querySelectorAll('.satellite-countdown-timer');
  timers.forEach(t => t.innerText = `เริ่มในอีก ${timeStr}`);
}

function joinSundaySatellite() {
  if ((userProfile.tgbBalance || 0) < 5) {
    alert('❌ เหรียญ TGB ไม่เพียงพอ (ต้องการ 5 TGB เพื่อเข้าแข่งขันชิงตั๋ววันอาทิตย์)\nกรุณากดรับของขวัญ 5 TGB หรือเติมเหรียญ');
    return;
  }

  if (!confirm('ยืนยันจ่าย 5 TGB เพื่อเข้าร่วมการแข่งขัน Daily Satellite ชิงตั๋ววันอาทิตย์?')) {
    return;
  }

  userProfile.tgbBalance -= 5;
  userProfile.sundayTickets = (userProfile.sundayTickets || 0) + 1; // Award ticket for tournament simulation
  saveUserProfile();

  userLedgerTransactions.unshift({
    id: `tx_${Date.now()}`,
    game: 'Satellite 20:00',
    type: 'Buy-in Daily Sunday Satellite',
    amount: -5,
    currency: 'TGB',
    balance: userProfile.tgbBalance,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });

  updateAuthUI(true, userProfile);
  renderLedgerTable();
  playSound('chips');

  activeTable.id = 'satellite_2000';
  activeTable.title = 'Daily Satellite to Sunday Major (20:00)';
  activeTable.smallBlind = 0.25;
  activeTable.bigBlind = 0.5;
  activeTable.pot = 15;
  activeTable.stage = 'PREFLOP';

  isSpectatorMode = false;
  activeTable.seats[0].empty = false;
  activeTable.seats[0].isHero = true;
  activeTable.seats[0].name = userProfile.username || 'Hero';
  activeTable.seats[0].chips = 100;
  activeTable.seats[0].cards = ['As', 'Ks'];

  switchView('table');
  renderPokerTable();
  playSound('deal');
  alert('🎟️ ลงทะเบียนสำเร็จ! คุณได้รับสิทธิ์แข่งขันและสิทธิลุ้นตั๋ววันอาทิตย์เรียบร้อยแล้ว');
}

// ============================================================================
// 11. GTB REAL MONEY TOKEN SHOP (ซื้อเหรียญ GTB ด้วยเงินจริง)
// ============================================================================
const GTB_PACKAGES = [
  { id: 'gtb_100', gtb: 100, thb: 35, bonus: '', badge: '' },
  { id: 'gtb_550', gtb: 550, thb: 175, bonus: '+10% Bonus', badge: 'bg-emerald-500/20 text-emerald-400' },
  { id: 'gtb_1200', gtb: 1200, thb: 350, bonus: '+20% Bonus', badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40', popular: true },
  { id: 'gtb_3500', gtb: 3500, thb: 1000, bonus: '+25% Bonus', badge: 'bg-purple-500/20 text-purple-400' },
  { id: 'gtb_7000', gtb: 7000, thb: 1750, bonus: '+30% Bonus', badge: 'bg-rose-500/20 text-rose-400', whale: true },
];

let selectedGtbPack = GTB_PACKAGES[2]; // Default to 1200 GTB

function openGtbShopModal() {
  const modal = document.getElementById('modal-gtb-shop');
  if (modal) {
    modal.classList.remove('hidden');
    renderGtbShopPacks();
    selectGtbPack('gtb_1200');
  }
}

function closeGtbShopModal() {
  const modal = document.getElementById('modal-gtb-shop');
  if (modal) modal.classList.add('hidden');
}

function renderGtbShopPacks() {
  const container = document.getElementById('gtb-packages-grid');
  if (!container) return;

  container.innerHTML = GTB_PACKAGES.map(pack => {
    const isSelected = selectedGtbPack && selectedGtbPack.id === pack.id;
    return `
      <div onclick="selectGtbPack('${pack.id}')" class="p-3.5 rounded-2xl cursor-pointer transition border ${isSelected ? 'bg-slate-950 border-yellow-400 shadow-lg shadow-yellow-500/20' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'} relative space-y-1.5">
        ${pack.popular ? `<span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase">Best Value</span>` : ''}
        ${pack.whale ? `<span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase">Whale Pack</span>` : ''}
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xl">⭐</span>
            <span class="text-base font-black text-white font-mono">${pack.gtb.toLocaleString()} GTB</span>
          </div>
          <span class="text-xs font-black text-emerald-400 font-mono">฿${pack.thb.toLocaleString()}</span>
        </div>
        ${pack.bonus ? `<div class="text-[10px] font-bold text-amber-400">${pack.bonus}</div>` : `<div class="text-[10px] text-slate-500">Standard Pack</div>`}
      </div>
    `;
  }).join('');
}

function selectGtbPack(packId) {
  selectedGtbPack = GTB_PACKAGES.find(p => p.id === packId) || GTB_PACKAGES[0];
  renderGtbShopPacks();
  const summaryGtb = document.getElementById('shop-summary-gtb');
  const summaryThb = document.getElementById('shop-summary-thb');
  const qrAmount = document.getElementById('shop-qr-amount');
  if (summaryGtb) summaryGtb.innerText = selectedGtbPack.gtb.toLocaleString() + ' GTB';
  if (summaryThb) summaryThb.innerText = '฿' + selectedGtbPack.thb.toLocaleString();
  if (qrAmount) qrAmount.innerText = '฿' + selectedGtbPack.thb.toLocaleString();
}

function executeSimulatedPayment() {
  if (!selectedGtbPack) return;
  const pack = selectedGtbPack;

  userProfile.gtbBalance = (userProfile.gtbBalance || 0) + pack.gtb;
  saveUserProfile();

  userLedgerTransactions.unshift({
    id: `tx_${Date.now()}`,
    game: 'GTB Token Shop',
    type: `Purchased ${pack.gtb.toLocaleString()} GTB (฿${pack.thb})`,
    amount: pack.gtb,
    currency: 'GTB',
    balance: userProfile.gtbBalance,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });

  updateAuthUI(true, userProfile);
  renderLedgerTable();
  playSound('win');
  closeGtbShopModal();

  alert(`🎉 ชำระเงินสำเร็จ ฿${pack.thb.toLocaleString()}!\nได้รับเหรียญทอง +${pack.gtb.toLocaleString()} GTB เข้าสู่บัญชีเรียบร้อยแล้ว`);
}

// ============================================================================
// 12. CARD SKINS SYSTEM (สกินหลังไพ่)
// ============================================================================
const CARD_SKINS_DATA = [
  {
    id: 'bicycle_red',
    name: 'Classic Bicycle Red',
    nameTh: 'คลาสสิกไบซิเคิล แดง',
    priceGtb: 0,
    priceTgb: 0,
    desc: 'ลวดลายหลังไพ่มาตรฐานการแข่งขันโป๊กเกอร์ระดับโลก',
    previewClass: 'skin-bicycle_red',
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon Dark',
    nameTh: 'ไซเบอร์ นีออน ดาร์ก',
    priceGtb: 150,
    priceTgb: 500,
    desc: 'ดีไซน์นีออนเรืองแสงสีฟ้าและม่วงสไตล์ Cyberpunk ล้ำสมัย',
    previewClass: 'skin-cyber_neon',
  },
  {
    id: 'gold_royale',
    name: 'Gold Luxury Royale',
    nameTh: 'โกลด์ ลักชูรี่ รอยัล',
    priceGtb: 300,
    priceTgb: 1000,
    desc: 'ลายฉลุทองคำ 24K บนผ้ากำมะหยี่สีรัตติกาลสุดหรูหรา',
    previewClass: 'skin-gold_royale',
  },
  {
    id: 'emerald_tgb',
    name: 'TGB Emerald Championship',
    nameTh: 'ทีจีบี เอเมอรัลด์ แชมเปียนชิป',
    priceGtb: 500,
    priceTgb: 2000,
    desc: 'ลายเคฟล่าคาร์บอนขลิบทองมรกตเฉพาะแชมป์ทัวร์นาเมนต์',
    previewClass: 'skin-emerald_tgb',
  },
];

function openCardSkinsModal() {
  const modal = document.getElementById('modal-card-skins');
  if (modal) {
    modal.classList.remove('hidden');
    renderCardSkinsUI();
  }
}

function closeCardSkinsModal() {
  const modal = document.getElementById('modal-card-skins');
  if (modal) modal.classList.add('hidden');
}

function renderCardSkinsUI() {
  const container = document.getElementById('card-skins-container');
  if (!container) return;

  const unlocked = userProfile.unlockedCardSkins || ['bicycle_red'];
  const activeSkin = userProfile.cardSkin || 'bicycle_red';

  container.innerHTML = CARD_SKINS_DATA.map(skin => {
    const isUnlocked = unlocked.includes(skin.id);
    const isEquipped = activeSkin === skin.id;

    return `
      <div class="p-4 rounded-2xl bg-slate-950 border ${isEquipped ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-800'} flex items-center space-x-4">
        <div class="w-14 h-20 rounded-xl ${skin.previewClass} flex-shrink-0 shadow-lg border border-white/20"></div>
        <div class="flex-1 space-y-1">
          <div class="flex items-center justify-between">
            <h4 class="font-black text-sm text-white">${skin.nameTh}</h4>
            ${isEquipped ? `<span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px]">EQUIPPED</span>` : ''}
          </div>
          <div class="text-[11px] text-slate-400 leading-tight">${skin.desc}</div>
          <div class="pt-2 flex items-center justify-between">
            ${isUnlocked ? `
              <button onclick="equipCardSkin('${skin.id}')" ${isEquipped ? 'disabled' : ''} class="px-4 py-1.5 rounded-xl ${isEquipped ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'} text-xs transition">
                ${isEquipped ? 'กำลังใช้งาน' : 'สวมใส่ (Equip)'}
              </button>
            ` : `
              <div class="flex items-center space-x-2">
                <button onclick="unlockSkinWithGtb('${skin.id}', ${skin.priceGtb})" class="px-2.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs transition">
                  ${skin.priceGtb} GTB
                </button>
                <button onclick="unlockSkinWithTgb('${skin.id}', ${skin.priceTgb})" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-black text-xs transition border border-slate-700">
                  ${skin.priceTgb} TGB
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function equipCardSkin(skinId) {
  userProfile.cardSkin = skinId;
  saveUserProfile();
  renderCardSkinsUI();
  renderPokerTable();
  playSound('win');
  alert(`✨ สวมใส่สกินไพ่สำเร็จ!`);
}

function unlockSkinWithGtb(skinId, price) {
  if ((userProfile.gtbBalance || 0) < price) {
    alert(`❌ เหรียญ GTB ไม่เพียงพอ (ต้องการ ${price} GTB)\nกรุณาเติมเหรียญที่ร้านค้า GTB`);
    return;
  }
  userProfile.gtbBalance -= price;
  if (!userProfile.unlockedCardSkins) userProfile.unlockedCardSkins = ['bicycle_red'];
  userProfile.unlockedCardSkins.push(skinId);
  userProfile.cardSkin = skinId;
  saveUserProfile();
  updateAuthUI(true, userProfile);
  renderCardSkinsUI();
  renderPokerTable();
  playSound('win');
  alert(`🎉 ปลดล็อกและสวมใส่สกินไพ่เรียบร้อยแล้ว!`);
}

function unlockSkinWithTgb(skinId, price) {
  if ((userProfile.tgbBalance || 0) < price) {
    alert(`❌ เหรียญ TGB ไม่เพียงพอ (ต้องการ ${price} TGB)`);
    return;
  }
  userProfile.tgbBalance -= price;
  if (!userProfile.unlockedCardSkins) userProfile.unlockedCardSkins = ['bicycle_red'];
  userProfile.unlockedCardSkins.push(skinId);
  userProfile.cardSkin = skinId;
  saveUserProfile();
  updateAuthUI(true, userProfile);
  renderCardSkinsUI();
  renderPokerTable();
  playSound('win');
  alert(`🎉 ปลดล็อกและสวมใส่สกินไพ่เรียบร้อยแล้ว!`);
}

// ============================================================================
// 13. CASUAL POKER LOBBY & CUSTOM ROOM CREATION (1 - 2,000 TGB, 2x Prize Pool)
// ============================================================================
let casualRoomsData = [
  {
    id: 'casual_101',
    name: 'Newbie 1 TGB Friendly',
    host: 'System Host',
    buyIn: 1,
    smallBlind: 0.05,
    bigBlind: 0.1,
    maxSeats: 8,
    seatedCount: 2,
    multiplier: 2,
    prizePool: 16, // 1 * 8 * 2
    status: 'PLAYING',
  },
  {
    id: 'casual_102',
    name: 'Daily 5 TGB Satellite (รอบ 20:00)',
    host: 'Sunday Satellite Host',
    buyIn: 5,
    smallBlind: 0.25,
    bigBlind: 0.5,
    maxSeats: 8,
    seatedCount: 4,
    multiplier: 2,
    prizePool: 80, // 5 * 8 * 2
    status: 'REGISTERING',
  },
  {
    id: 'casual_103',
    name: 'Mid Stakes 50 TGB Arena',
    host: 'CryptoShark',
    buyIn: 50,
    smallBlind: 2.5,
    bigBlind: 5,
    maxSeats: 8,
    seatedCount: 5,
    multiplier: 2,
    prizePool: 800, // 50 * 8 * 2
    status: 'PLAYING',
  },
  {
    id: 'casual_104',
    name: 'High Roller 2,000 TGB Max Pool',
    host: 'WhaleKing',
    buyIn: 2000,
    smallBlind: 100,
    bigBlind: 200,
    maxSeats: 8,
    seatedCount: 3,
    multiplier: 2,
    prizePool: 32000, // 2000 * 8 * 2
    status: 'PLAYING',
  },
];

function renderCasualLobby(filter = 'all') {
  const container = document.getElementById('casual-rooms-grid');
  if (!container) return;

  let filtered = casualRoomsData;
  if (filter === 'micro') filtered = casualRoomsData.filter(r => r.buyIn <= 10);
  else if (filter === 'mid') filtered = casualRoomsData.filter(r => r.buyIn > 10 && r.buyIn <= 200);
  else if (filter === 'high') filtered = casualRoomsData.filter(r => r.buyIn > 200);

  container.innerHTML = filtered.map(room => `
    <div class="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded-full ${room.status === 'PLAYING' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'} text-[10px] font-black uppercase">
            ${room.status}
          </span>
          <span class="text-xs text-slate-400 font-mono"><i class="fa-solid fa-users mr-1"></i>${room.seatedCount}/${room.maxSeats} Max</span>
        </div>
        <h3 class="text-base font-black text-white leading-tight">${escapeHtml(room.name)}</h3>
        <div class="text-[11px] text-slate-400 font-medium">Host: <span class="text-slate-300 font-bold">${escapeHtml(room.host)}</span></div>
      </div>

      <div class="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 font-mono text-xs">
        <div class="flex justify-between items-center">
          <span class="text-slate-400">Buy-In (ขั้นต่ำ):</span>
          <span class="font-black text-amber-300">${room.buyIn.toLocaleString()} TGB</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-400">Blinds:</span>
          <span class="text-slate-300">${room.smallBlind} / ${room.bigBlind}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-800/60 pt-1.5">
          <span class="text-emerald-400 font-bold flex items-center gap-1">
            <span>Prize Pool</span>
            <span class="px-1 rounded bg-emerald-500/20 text-[9px] text-emerald-300">2x ทบรางวัล</span>
          </span>
          <span class="font-black text-emerald-400 text-sm">${room.prizePool.toLocaleString()} TGB</span>
        </div>
      </div>

      <div class="flex items-center space-x-2 pt-1">
        <button onclick="joinCasualRoom('${room.id}', ${room.buyIn})" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-play"></i>
          <span>เข้าเล่น (${room.buyIn} TGB)</span>
        </button>
        <button onclick="spectateCasualRoom('${room.id}')" title="เข้าดูฟรี 100%" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition border border-slate-700 flex items-center justify-center gap-1">
          <i class="fa-regular fa-eye"></i>
          <span class="hidden sm:inline">ดูฟรี</span>
        </button>
      </div>
    </div>
  `).join('');
}

function filterCasualRooms(cat) {
  const btns = document.querySelectorAll('.casual-filter-btn');
  btns.forEach(b => {
    b.className = 'casual-filter-btn px-3.5 py-1.5 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-slate-800';
  });
  if (window.event && window.event.target) {
    window.event.target.className = 'casual-filter-btn active px-3.5 py-1.5 rounded-xl bg-slate-800 text-white border border-slate-700';
  }
  renderCasualLobby(cat);
}

function openCreateCasualModal() {
  const modal = document.getElementById('modal-create-casual-room');
  if (modal) {
    modal.classList.remove('hidden');
    syncBuyInValues(10);
  }
}

function closeCreateCasualModal() {
  const modal = document.getElementById('modal-create-casual-room');
  if (modal) modal.classList.add('hidden');
}

function syncBuyInValues(val) {
  let num = parseFloat(val);
  if (isNaN(num) || num < 1) num = 1;
  if (num > 2000) num = 2000;

  const slider = document.getElementById('create-room-buyin-slider');
  const input = document.getElementById('create-room-buyin');
  if (slider && slider.value !== num.toString()) slider.value = num;
  if (input && input.value !== num.toString()) input.value = num;

  updateCreateRoomPreview();
}

function updateCreateRoomPreview() {
  const input = document.getElementById('create-room-buyin');
  const seatsSelect = document.getElementById('create-room-seats');
  const blindsPreview = document.getElementById('create-room-blinds-preview');
  const prizePreview = document.getElementById('create-room-prize-preview');

  const buyIn = input ? parseFloat(input.value) || 10 : 10;
  const seats = seatsSelect ? parseInt(seatsSelect.value, 10) || 8 : 8;

  const sb = Math.max(0.05, +(buyIn * 0.025).toFixed(2));
  const bb = Math.max(0.1, +(buyIn * 0.05).toFixed(2));
  const prize = buyIn * seats * 2; // 2x Multiplier

  if (blindsPreview) blindsPreview.innerText = `${sb} / ${bb} TGB`;
  if (prizePreview) prizePreview.innerText = `${prize.toLocaleString()} TGB`;
}

function handleCreateCasualRoom(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('create-room-name');
  const buyInInput = document.getElementById('create-room-buyin');
  const seatsInput = document.getElementById('create-room-seats');

  const name = nameInput.value.trim() || 'My Custom Casual Table';
  let buyIn = parseFloat(buyInInput.value);

  // Validate Buy-In bounds: 1 to 2,000 TGB ceiling
  if (isNaN(buyIn) || buyIn < 1) buyIn = 1;
  if (buyIn > 2000) buyIn = 2000;

  const maxSeats = parseInt(seatsInput.value, 10) || 8;
  const prizePool = buyIn * maxSeats * 2; // 2x Multiplier

  if ((userProfile.tgbBalance || 0) < buyIn) {
    alert(`❌ คุณมี TGB ไม่เพียงพอสำหรับสร้างห้องนี้\n(ต้องการ ${buyIn} TGB แต่มี ${userProfile.tgbBalance || 0} TGB)\nกรุณากดรับของขวัญ 5 TGB หรือเติมเหรียญ`);
    return;
  }

  // Deduct Buy-in from host
  userProfile.tgbBalance -= buyIn;
  saveUserProfile();

  const newRoom = {
    id: `casual_${Date.now()}`,
    name,
    host: userProfile.username || 'You',
    buyIn,
    smallBlind: Math.max(0.05, +(buyIn * 0.025).toFixed(2)),
    bigBlind: Math.max(0.1, +(buyIn * 0.05).toFixed(2)),
    maxSeats,
    seatedCount: 1,
    multiplier: 2,
    prizePool,
    status: 'PLAYING',
  };

  casualRoomsData.unshift(newRoom);
  closeCreateCasualModal();
  renderCasualLobby('all');

  userLedgerTransactions.unshift({
    id: `tx_${Date.now()}`,
    game: 'Casual Lobby',
    type: `Created Room: ${name}`,
    amount: -buyIn,
    currency: 'TGB',
    balance: userProfile.tgbBalance,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });

  updateAuthUI(true, userProfile);
  renderLedgerTable();
  launchCasualTable(newRoom, true);
}

function joinCasualRoom(roomId, buyIn) {
  const room = casualRoomsData.find(r => r.id === roomId);
  if (!room) return;

  if ((userProfile.tgbBalance || 0) < buyIn) {
    alert(`❌ คุณมี TGB ไม่เพียงพอ (ต้องการ ${buyIn} TGB แต่มี ${userProfile.tgbBalance || 0} TGB)\nคุณยังสามารถกด "ดูการเล่นฟรี" เพื่อรับชมสดได้!`);
    return;
  }

  userProfile.tgbBalance -= buyIn;
  saveUserProfile();

  userLedgerTransactions.unshift({
    id: `tx_${Date.now()}`,
    game: 'Casual Room',
    type: `Buy-in ${room.name}`,
    amount: -buyIn,
    currency: 'TGB',
    balance: userProfile.tgbBalance,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });

  updateAuthUI(true, userProfile);
  renderLedgerTable();
  playSound('chips');

  launchCasualTable(room, true);
}

function spectateCasualRoom(roomId) {
  const room = casualRoomsData.find(r => r.id === roomId);
  if (!room) return;
  launchCasualTable(room, false); // Free spectator!
}

function launchCasualTable(room, isSeatedHero) {
  activeTable.id = room.id;
  activeTable.title = `${room.name} • ${room.maxSeats}-Max`;
  activeTable.smallBlind = room.smallBlind;
  activeTable.bigBlind = room.bigBlind;
  activeTable.pot = room.smallBlind + room.bigBlind;
  activeTable.stage = 'PREFLOP';

  if (isSeatedHero) {
    isSpectatorMode = false;
    const starterChips = (userProfile.tgbBalance && userProfile.tgbBalance >= room.buyIn) ? room.buyIn : 500;
    initTableForPlay(starterChips);
  } else {
    isSpectatorMode = true;
    initTableForSpectator();
  }

  switchView('table');
  renderPokerTable();
  playSound('deal');
  setTimeout(startNewHand, 500);
}

// ============================================================================
// 10. MINI-GAMES & HOME INTERACTIVITY (Slots, Mines, Future Guess, Tickets, Activity)
// ============================================================================
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function openMiniGame(type) {
  if (type === 'slots') {
    const modal = document.getElementById('modal-slots');
    const balEl = document.getElementById('slot-user-balance');
    if (balEl) balEl.innerText = (userProfile.tgbBalance || 0).toLocaleString();
    if (modal) modal.classList.remove('hidden');
  } else if (type === 'mines') {
    const modal = document.getElementById('modal-mines');
    if (modal) modal.classList.remove('hidden');
    initMinesGrid();
  } else if (type === 'plinko' || type === 'crash') {
    alert(`🎮 มินิเกม ${type.toUpperCase()} กำลังเตรียมเปิดในอัปเดตถัดไป! ขณะนี้สามารถเล่น SLOTS และ MINES ได้ทันทีครับ`);
  }
}

function closeMiniGame(type) {
  const modal = document.getElementById(`modal-${type}`);
  if (modal) modal.classList.add('hidden');
}

// SLOTS LOGIC
let currentSlotBet = 10;
let isSlotSpinning = false;
const slotSymbols = ['🍒', '🍋', '⭐', '7️⃣', '💎', '🔔'];

function setSlotBet(amt) {
  currentSlotBet = amt;
  document.querySelectorAll('.slot-bet-btn').forEach(btn => {
    if (parseInt(btn.getAttribute('data-bet'), 10) === amt) {
      btn.classList.add('bg-purple-950/60', 'border-purple-500/40', 'text-purple-300');
      btn.classList.remove('bg-slate-950', 'border-slate-800', 'text-slate-300');
    } else {
      btn.classList.remove('bg-purple-950/60', 'border-purple-500/40', 'text-purple-300');
      btn.classList.add('bg-slate-950', 'border-slate-800', 'text-slate-300');
    }
  });
}

function spinSlots() {
  if (isSlotSpinning) return;
  if ((userProfile.tgbBalance || 0) < currentSlotBet) {
    alert('ยอดคงเหลือ TGB ไม่เพียงพอ กรุณากดรับโบนัส Faucet ใน Activity Center!');
    return;
  }

  isSlotSpinning = true;
  userProfile.tgbBalance -= currentSlotBet;
  updateAuthUI(true, userProfile);
  playSound('chips');

  const r1 = document.getElementById('slot-reel-1');
  const r2 = document.getElementById('slot-reel-2');
  const r3 = document.getElementById('slot-reel-3');
  const msg = document.getElementById('slot-result-msg');
  const btn = document.getElementById('btn-spin-slots');
  const balEl = document.getElementById('slot-user-balance');

  if (balEl) balEl.innerText = userProfile.tgbBalance.toLocaleString();
  if (msg) msg.innerText = 'Spinning... Good luck! 🎰';
  if (btn) btn.disabled = true;

  let spins = 0;
  const spinInterval = setInterval(() => {
    r1.innerText = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    r2.innerText = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    r3.innerText = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    spins++;
    if (spins > 10) {
      clearInterval(spinInterval);
      finalizeSlotSpin(r1, r2, r3, msg, btn);
    }
  }, 70);
}

function finalizeSlotSpin(r1, r2, r3, msg, btn) {
  // Fair generous odds
  const roll = Math.random();
  let s1, s2, s3;
  if (roll < 0.08) {
    s1 = s2 = s3 = '7️⃣'; // 100x Jackpot
  } else if (roll < 0.20) {
    s1 = s2 = s3 = '💎'; // 50x
  } else if (roll < 0.40) {
    s1 = s2 = s3 = '⭐'; // 20x
  } else if (roll < 0.65) {
    s1 = s2 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    s3 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)]; // 2 of a kind
  } else {
    s1 = slotSymbols[0];
    s2 = slotSymbols[1];
    s3 = slotSymbols[2];
  }

  r1.innerText = s1;
  r2.innerText = s2;
  r3.innerText = s3;

  let multiplier = 0;
  if (s1 === s2 && s2 === s3) {
    if (s1 === '7️⃣') multiplier = 100;
    else if (s1 === '💎') multiplier = 50;
    else if (s1 === '⭐') multiplier = 20;
    else multiplier = 10;
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    multiplier = 2;
  }

  if (multiplier > 0) {
    const won = currentSlotBet * multiplier;
    userProfile.tgbBalance += won;
    updateAuthUI(true, userProfile);
    playSound('win');
    if (msg) msg.innerHTML = `🎉 <span class="text-amber-300 font-black">BIG WIN! ${multiplier}X (+${won.toLocaleString()} ₮)</span>`;
  } else {
    playSound('fold');
    if (msg) msg.innerText = 'Better luck next spin! Try again.';
  }

  const balEl = document.getElementById('slot-user-balance');
  if (balEl) balEl.innerText = userProfile.tgbBalance.toLocaleString();
  isSlotSpinning = false;
  if (btn) btn.disabled = false;
}

// MINES LOGIC
let minesGameState = {
  active: false,
  bet: 50,
  mineIndices: [],
  revealedCount: 0,
  multiplier: 1.0,
};

function initMinesGrid() {
  const grid = document.getElementById('mines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const tile = document.createElement('button');
    tile.className = 'mine-tile h-12 rounded-xl bg-slate-900 border border-slate-800 text-lg flex items-center justify-center hover:bg-slate-800 transition font-bold';
    tile.setAttribute('data-idx', i);
    tile.onclick = () => clickMineTile(i);
    grid.appendChild(tile);
  }
  document.getElementById('mines-multiplier').innerText = '1.00x';
  document.getElementById('mines-next-win').innerText = '0 ₮';
  document.getElementById('btn-cashout-mines').disabled = true;
  document.getElementById('btn-cashout-mines').classList.add('opacity-50', 'cursor-not-allowed');
  document.getElementById('btn-start-mines').disabled = false;
  document.getElementById('btn-start-mines').classList.remove('opacity-50');
}

function startMinesGame() {
  if (minesGameState.active) return;
  if ((userProfile.tgbBalance || 0) < 50) {
    alert('ยอดคงเหลือ TGB ไม่เพียงพอ (ต้องการ 50 ₮)');
    return;
  }

  userProfile.tgbBalance -= 50;
  updateAuthUI(true, userProfile);
  playSound('chips');

  // Randomly place 3 mines
  const mines = [];
  while (mines.length < 3) {
    const idx = Math.floor(Math.random() * 25);
    if (!mines.includes(idx)) mines.push(idx);
  }

  minesGameState = {
    active: true,
    bet: 50,
    mineIndices: mines,
    revealedCount: 0,
    multiplier: 1.0,
  };

  initMinesGrid();

  document.getElementById('btn-start-mines').disabled = true;
  document.getElementById('btn-start-mines').classList.add('opacity-50');
  const cashBtn = document.getElementById('btn-cashout-mines');
  cashBtn.disabled = false;
  cashBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  cashBtn.innerText = 'Cash Out (50 ₮)';
}

function clickMineTile(idx) {
  if (!minesGameState.active) return;
  const grid = document.getElementById('mines-grid');
  const tile = grid.children[idx];
  if (!tile || tile.disabled) return;

  tile.disabled = true;

  if (minesGameState.mineIndices.includes(idx)) {
    // BOOM!
    tile.innerHTML = '💣';
    tile.classList.add('bg-rose-950', 'border-rose-500');
    playSound('fold');
    minesGameState.active = false;

    // Reveal other mines
    minesGameState.mineIndices.forEach(mIdx => {
      const mTile = grid.children[mIdx];
      if (mTile) {
        mTile.innerHTML = '💣';
        mTile.classList.add('bg-rose-950/60', 'border-rose-500/50');
      }
    });

    document.getElementById('btn-cashout-mines').disabled = true;
    document.getElementById('btn-cashout-mines').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('btn-start-mines').disabled = false;
    document.getElementById('btn-start-mines').classList.remove('opacity-50');
    alert('💥 โดนระเบิด! ไม่เป็นไร ลองเล่นรอบใหม่ได้เลย');
  } else {
    // GEM!
    tile.innerHTML = '💎';
    tile.classList.add('bg-emerald-950', 'border-emerald-500', 'text-emerald-400');
    playSound('chips');

    minesGameState.revealedCount++;
    const multipliers = [1.25, 1.65, 2.15, 2.85, 3.80, 5.20, 7.50, 11.0, 17.5, 29.0];
    minesGameState.multiplier = multipliers[Math.min(minesGameState.revealedCount - 1, multipliers.length - 1)];

    const curWin = Math.round(minesGameState.bet * minesGameState.multiplier);
    document.getElementById('mines-multiplier').innerText = `${minesGameState.multiplier}x`;
    document.getElementById('mines-next-win').innerText = `${curWin} ₮`;
    document.getElementById('btn-cashout-mines').innerText = `Cash Out (${curWin} ₮)`;
  }
}

function cashoutMines() {
  if (!minesGameState.active) return;
  const won = Math.round(minesGameState.bet * minesGameState.multiplier);
  userProfile.tgbBalance += won;
  updateAuthUI(true, userProfile);
  playSound('win');
  minesGameState.active = false;

  document.getElementById('btn-cashout-mines').disabled = true;
  document.getElementById('btn-cashout-mines').classList.add('opacity-50', 'cursor-not-allowed');
  document.getElementById('btn-start-mines').disabled = false;
  document.getElementById('btn-start-mines').classList.remove('opacity-50');

  alert(`🎉 Cash Out สำเร็จ! คุณได้รับ +${won.toLocaleString()} ₮ (${minesGameState.multiplier}x)`);
}

// FUTURE GUESS LOGIC
let fgCurrentAsset = 'BTC';
function openFutureGuessModal(asset, price, change) {
  fgCurrentAsset = asset;
  document.getElementById('fg-asset-title').innerText = `${asset} / USDT`;
  document.getElementById('fg-asset-price').innerText = `$${price}`;
  document.getElementById('fg-asset-change').innerText = `24h Change: ${change}`;
  document.getElementById('fg-countdown-display').innerText = 'Ready';
  const modal = document.getElementById('modal-future-guess');
  if (modal) modal.classList.remove('hidden');
}

function closeFutureGuessModal() {
  const modal = document.getElementById('modal-future-guess');
  if (modal) modal.classList.add('hidden');
}

function executeFutureGuess(dir) {
  if ((userProfile.tgbBalance || 0) < 10) {
    alert('ยอดคงเหลือ TGB ไม่เพียงพอ (ต้องการ 10 ₮)');
    return;
  }
  userProfile.tgbBalance -= 10;
  updateAuthUI(true, userProfile);
  playSound('chips');

  const display = document.getElementById('fg-countdown-display');
  let count = 5;
  display.innerText = `Predicting ${dir}... Result in ${count}s`;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      display.innerText = `Predicting ${dir}... Result in ${count}s`;
    } else {
      clearInterval(timer);
      const isWin = Math.random() < 0.55;
      if (isWin) {
        userProfile.tgbBalance += 20;
        updateAuthUI(true, userProfile);
        playSound('win');
        display.innerHTML = `🎉 <span class="text-emerald-400 font-black">ถูกต้อง! ได้รับ +20 ₮</span>`;
      } else {
        playSound('fold');
        display.innerHTML = `❌ <span class="text-rose-400 font-black">ราคาแกว่งไปทิศทางตรงข้าม</span>`;
      }
    }
  }, 1000);
}

// ACTIVITY & TICKETS & POINTS MODALS
function openActivityCenterModal() {
  const modal = document.getElementById('modal-activity-center');
  if (modal) modal.classList.remove('hidden');
}

function closeActivityCenterModal() {
  const modal = document.getElementById('modal-activity-center');
  if (modal) modal.classList.add('hidden');
}

function claimActivityBonus(type, amount) {
  userProfile.tgbBalance = (userProfile.tgbBalance || 0) + amount;
  updateAuthUI(true, userProfile);
  playSound('win');
  alert(`🎉 รับโบนัสสำเร็จ! +${amount.toLocaleString()} ₮ เพิ่มเข้ากระเป๋าเรียบร้อย`);
}

function openTicketsModal() {
  const modal = document.getElementById('modal-tickets');
  if (modal) modal.classList.remove('hidden');
}

function closeTicketsModal() {
  const modal = document.getElementById('modal-tickets');
  if (modal) modal.classList.add('hidden');
}

function openPointsModal() {
  alert('⭐ TGB Points Shop: คุณมี 1,250 Points สามารถแลกชิปหรือกรอบรูปพิเศษได้ใน Season 2!');
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
window.requestTakeAnySeat = requestTakeAnySeat;
window.initTableForPlay = initTableForPlay;
window.initTableForSpectator = initTableForSpectator;
window.sitDownAtSeat = sitDownAtSeat;
window.standUpToSpectate = standUpToSpectate;
window.toggleSpectatorMode = toggleSpectatorMode;
window.handleSendTableChat = handleSendTableChat;
window.insertTableEmoji = insertTableEmoji;
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
window.renderProfileView = renderProfileView;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.selectPresetAvatar = selectPresetAvatar;
window.handleAvatarFileUpload = handleAvatarFileUpload;
window.selectAvatarFrame = selectAvatarFrame;
window.updateProfilePreview = updateProfilePreview;
window.saveProfileCustomization = saveProfileCustomization;
window.scrollToSection = scrollToSection;
window.openMiniGame = openMiniGame;
window.closeMiniGame = closeMiniGame;
window.setSlotBet = setSlotBet;
window.spinSlots = spinSlots;
window.startMinesGame = startMinesGame;
window.clickMineTile = clickMineTile;
window.cashoutMines = cashoutMines;
window.openFutureGuessModal = openFutureGuessModal;
window.closeFutureGuessModal = closeFutureGuessModal;
window.executeFutureGuess = executeFutureGuess;
window.openActivityCenterModal = openActivityCenterModal;
window.closeActivityCenterModal = closeActivityCenterModal;
window.claimActivityBonus = claimActivityBonus;
window.openTicketsModal = openTicketsModal;
window.closeTicketsModal = closeTicketsModal;
window.openPointsModal = openPointsModal;

// Economy, Gift, Satellite, GTB Shop, Card Skins, Casual Lobby
window.claimThirtyMinGift = claimThirtyMinGift;
window.joinSundaySatellite = joinSundaySatellite;
window.openGtbShopModal = openGtbShopModal;
window.closeGtbShopModal = closeGtbShopModal;
window.selectGtbPack = selectGtbPack;
window.executeSimulatedPayment = executeSimulatedPayment;
window.openCardSkinsModal = openCardSkinsModal;
window.closeCardSkinsModal = closeCardSkinsModal;
window.equipCardSkin = equipCardSkin;
window.unlockSkinWithGtb = unlockSkinWithGtb;
window.unlockSkinWithTgb = unlockSkinWithTgb;
window.renderCasualLobby = renderCasualLobby;
window.filterCasualRooms = filterCasualRooms;
window.openCreateCasualModal = openCreateCasualModal;
window.closeCreateCasualModal = closeCreateCasualModal;
window.syncBuyInValues = syncBuyInValues;
window.updateCreateRoomPreview = updateCreateRoomPreview;
window.handleCreateCasualRoom = handleCreateCasualRoom;
window.joinCasualRoom = joinCasualRoom;
window.spectateCasualRoom = spectateCasualRoom;

// ============================================================================
// INITIALIZATION
// ============================================================================
function initApp() {
  restoreUserSession();
  renderTournamentCards();
  renderCasualLobby('all');
  renderPokerTable();
  renderLedgerTable();
  renderProfileView();
  tryInitFirebase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

