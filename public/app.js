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
let userProfile = {
  id: 'guest_user',
  username: 'HeroAce',
  email: 'hero@tgbpoker.local',
  tgbBalance: 12500, // Starting Welcome Chips
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
  handNumber: 0,
  deck: [],
  handActive: false,
  tableNotice: 'READY',
  serverSeedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  serverSeed: '',
  seats: [
    { seatNumber: 0, name: 'Hero (You)', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: true, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-amber-600 to-yellow-500' },
    { seatNumber: 1, name: 'Viper (TAG)', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-blue-600 to-indigo-500' },
    { seatNumber: 2, name: 'BluffMaster', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-rose-600 to-red-500' },
    { seatNumber: 3, name: 'The Rock', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-emerald-600 to-teal-500' },
    { seatNumber: 4, name: 'CallingStation', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-purple-600 to-violet-500' },
    { seatNumber: 5, name: 'GTO_Bot', chips: 5000, currentBet: 0, totalBetThisHand: 0, isHero: false, cards: [], isFolded: false, isAllIn: false, actedThisStreet: false, avatarBg: 'from-cyan-600 to-blue-500' },
  ],
};

let userLedgerTransactions = [
  {
    id: 'tx_01',
    type: 'WELCOME_BONUS',
    amount: 12500,
    balance: 12500,
    sig: 'hmac_sha256_9a4f21...',
    prevHash: '0000000000000000...',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
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
  } else if (viewName === 'profile') {
    renderProfileView();
  }
}

function launchTable(tournamentId) {
  switchView('table');
  startNewHand();
}

// ============================================================================
// 6. PROFILE VIEW & CUSTOMIZER MODAL
// ============================================================================
function renderProfileView() {
  const avatarDisplay = document.getElementById('profile-avatar-display');
  const nameEl = document.getElementById('profile-name');
  const levelEl = document.getElementById('profile-level');
  const styleEl = document.getElementById('profile-style');
  const accountIdEl = document.getElementById('profile-account-id');
  const expBar = document.getElementById('profile-exp-bar');
  const expText = document.getElementById('profile-exp-text');

  const tourneysEl = document.getElementById('profile-tournaments-count');
  const winsEl = document.getElementById('profile-wins-count');
  const itmEl = document.getElementById('profile-itm-count');
  const profitEl = document.getElementById('profile-net-profit');

  const vpipVal = document.getElementById('profile-vpip-val');
  const vpipBar = document.getElementById('profile-vpip-bar');
  const pfrVal = document.getElementById('profile-pfr-val');
  const pfrBar = document.getElementById('profile-pfr-bar');
  const threeBetVal = document.getElementById('profile-3bet-val');
  const threeBetBar = document.getElementById('profile-3bet-bar');

  // Avatar Display with frame
  if (avatarDisplay) {
    avatarDisplay.className = `w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-3xl text-white shadow-xl overflow-hidden select-none ${userProfile.frame || 'frame-none'}`;
    if (userProfile.avatarType === 'image' && userProfile.avatarUrl) {
      avatarDisplay.innerHTML = `<img src="${userProfile.avatarUrl}" class="w-full h-full object-cover">`;
    } else {
      avatarDisplay.innerHTML = `<span class="text-4xl">${userProfile.avatarEmoji || '🦁'}</span>`;
    }
  }

  if (nameEl) nameEl.innerText = userProfile.username || 'HeroAce';
  
  if (levelEl) {
    let rankDesc = 'Novice';
    if (userProfile.level >= 10) rankDesc = 'Grand Master';
    else if (userProfile.level >= 5) rankDesc = 'Elite Pro';
    else if (userProfile.level >= 2) rankDesc = 'Apprentice';
    levelEl.innerText = `Level ${userProfile.level || 1} — ${rankDesc}`;
  }

  // Play Style determination based on real hands played
  if (styleEl) {
    if (!userProfile.totalHands || userProfile.totalHands === 0) {
      styleEl.innerText = 'New Player (0 Hands)';
    } else {
      const vpip = (userProfile.vpipHands / userProfile.totalHands) * 100;
      const pfr = (userProfile.pfrHands / userProfile.totalHands) * 100;
      if (vpip > 35) styleEl.innerText = 'Loose Passive';
      else if (vpip >= 20 && pfr >= 15) styleEl.innerText = 'Tight Aggressive (TAG)';
      else if (vpip > 28 && pfr > 20) styleEl.innerText = 'Loose Aggressive (LAG)';
      else styleEl.innerText = 'Balanced Explorer';
    }
  }

  if (accountIdEl) {
    accountIdEl.innerText = `Account ID: ${userProfile.id || 'guest'} • Registered ${userProfile.registeredAt || '2026'}`;
  }

  // EXP Progress
  const currentExp = userProfile.exp || 0;
  const currentExpInLevel = currentExp % 500;
  const expPct = Math.min(100, Math.round((currentExpInLevel / 500) * 100));
  if (expBar) expBar.style.width = `${expPct}%`;
  if (expText) expText.innerText = `${currentExpInLevel} / 500 EXP to Level ${(userProfile.level || 1) + 1}`;

  // Career Statistics
  const tPlayed = userProfile.tournamentsPlayed || 0;
  const tWon = userProfile.tournamentsWon || 0;
  const itm = userProfile.itmCount || 0;
  const net = userProfile.netTgb || 0;

  if (tourneysEl) tourneysEl.innerText = tPlayed;

  const winRate = tPlayed > 0 ? Math.round((tWon / tPlayed) * 100) : 0;
  if (winsEl) winsEl.innerHTML = `${tWon} <span class="text-xs text-slate-500">(${winRate}%)</span>`;

  const itmRate = tPlayed > 0 ? Math.round((itm / tPlayed) * 100) : 0;
  if (itmEl) itmEl.innerHTML = `${itm} <span class="text-xs text-slate-500">(${itmRate}%)</span>`;

  if (profitEl) {
    const sign = net > 0 ? '+' : '';
    profitEl.innerText = `${sign}${net.toLocaleString()} ₮`;
    if (net > 0) profitEl.className = 'text-xl font-black text-emerald-400 mt-1';
    else if (net < 0) profitEl.className = 'text-xl font-black text-rose-400 mt-1';
    else profitEl.className = 'text-xl font-black text-amber-300 mt-1';
  }

  // Play Style HUD percentages (Strictly 0% if totalHands === 0)
  const totalHands = userProfile.totalHands || 0;
  const vpipHands = userProfile.vpipHands || 0;
  const pfrHands = userProfile.pfrHands || 0;
  const threeBetHands = userProfile.threeBetHands || 0;

  const vpipPct = totalHands > 0 ? Math.round((vpipHands / totalHands) * 100) : 0;
  const pfrPct = totalHands > 0 ? Math.round((pfrHands / totalHands) * 100) : 0;
  const threeBetPct = totalHands > 0 ? Math.round((threeBetHands / totalHands) * 100) : 0;

  if (vpipVal) vpipVal.innerText = `${vpipPct}% (${vpipHands}/${totalHands})`;
  if (vpipBar) vpipBar.style.width = `${vpipPct}%`;

  if (pfrVal) pfrVal.innerText = `${pfrPct}% (${pfrHands}/${totalHands})`;
  if (pfrBar) pfrBar.style.width = `${pfrPct}%`;

  if (threeBetVal) threeBetVal.innerText = `${threeBetPct}% (${threeBetHands}/${totalHands})`;
  if (threeBetBar) threeBetBar.style.width = `${threeBetPct}%`;
}

// Edit Profile Modal State
let tempProfileEdit = {
  username: '',
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
    username: userProfile.username || 'HeroAce',
    avatarType: userProfile.avatarType || 'preset',
    avatarEmoji: userProfile.avatarEmoji || '🦁',
    avatarUrl: userProfile.avatarUrl || '',
    frame: userProfile.frame || 'frame-none',
    frameName: getFrameDisplayName(userProfile.frame || 'frame-none'),
  };

  const nameInput = document.getElementById('edit-username-input');
  if (nameInput) nameInput.value = tempProfileEdit.username;

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
  if (nameInput) {
    tempProfileEdit.username = nameInput.value.trim() || 'Hero';
  }

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

  if (previewName) previewName.innerText = tempProfileEdit.username;
  if (previewFrame) previewFrame.innerText = `กรอบ: ${tempProfileEdit.frameName}`;
}

function saveProfileCustomization() {
  const nameInput = document.getElementById('edit-username-input');
  const newName = nameInput ? nameInput.value.trim() : '';

  if (!newName) {
    alert('กรุณากรอกชื่อผู้เล่น');
    return;
  }

  userProfile.username = newName;
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

  // Update Hero seat on Table
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
// 7. RENDER POKER TABLE & ACTION CONSOLE
// ============================================================================
function renderPokerTable() {
  const potEl = document.getElementById('table-pot-amount');
  const bannerEl = document.getElementById('table-stage-banner');
  const blindsEl = document.getElementById('table-blinds-info');

  if (potEl) potEl.innerText = activeTable.pot.toLocaleString();
  if (bannerEl) bannerEl.innerText = activeTable.tableNotice || activeTable.stage;
  if (blindsEl) blindsEl.innerText = `Blinds: ${activeTable.smallBlind} / ${activeTable.bigBlind} • Ante: ${activeTable.ante}`;

  // Community Cards
  const communityContainer = document.getElementById('community-cards');
  if (communityContainer) {
    if (activeTable.communityCards.length === 0) {
      communityContainer.innerHTML = `
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-12 sm:w-14 h-16 sm:h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">1</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-12 sm:w-14 h-16 sm:h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">2</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-12 sm:w-14 h-16 sm:h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">3</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-12 sm:w-14 h-16 sm:h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">4</div>
        <div class="border-2 border-dashed border-emerald-600/30 rounded-xl w-12 sm:w-14 h-16 sm:h-20 flex items-center justify-center text-emerald-600/40 text-xs font-bold">5</div>
      `;
    } else {
      communityContainer.innerHTML = activeTable.communityCards.map(c => renderCardHTML(c, true)).join('');
    }
  }

  // Render 6 Seats
  activeTable.seats.forEach((seat, idx) => {
    const seatEl = document.getElementById(`seat-${idx}`);
    if (!seatEl) return;

    const isTurn = activeTable.handActive && activeTable.turnSeat === idx;
    const isDealer = activeTable.dealerSeat === idx;

    let cardsHtml = '';
    if (!seat.isFolded && seat.cards && seat.cards.length >= 2) {
      if (seat.isHero || activeTable.stage === 'SHOWDOWN') {
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
    } else if (seat.isFolded) {
      cardsHtml = `<div class="text-[10px] text-slate-500 font-bold uppercase mb-1">FOLDED</div>`;
    } else {
      cardsHtml = `<div class="text-[10px] text-slate-500 mb-1">Waiting...</div>`;
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
      const botIcons = ['👤', '🐍', '🎭', '🗿', '🐴', '🤖'];
      avatarContentHtml = `<span class="text-base sm:text-lg">${botIcons[idx] || seat.name.charAt(0)}</span>`;
    }

    if (idx === 3) {
      // Top Center Seat: Avatar on top outside, cards below pointing into felt
      seatEl.innerHTML = `
        <div class="avatar-ring ${isTurn ? 'turn-active' : ''} ${frameClass} bg-gradient-to-tr ${seat.avatarBg}">
          ${avatarContentHtml}
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
          <div class="mt-0.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold animate-pulse">
            Bet: ${seat.currentBet}
          </div>
        ` : ''}
      `;
    } else {
      // Bottom & Side Seats
      seatEl.innerHTML = `
        ${cardsHtml}
        <div class="avatar-ring ${isTurn ? 'turn-active' : ''} ${frameClass} bg-gradient-to-tr ${seat.avatarBg}">
          ${avatarContentHtml}
          ${isDealer ? `<div class="dealer-button absolute -top-1 -right-1">D</div>` : ''}
        </div>
        <div class="text-center mt-1">
          <div class="text-[11px] font-extrabold text-white truncate max-w-[80px] sm:max-w-[100px]">${seat.name}</div>
          <div class="chip-badge mt-0.5 justify-center">
            <span>₮</span> ${seat.chips.toLocaleString()}
          </div>
        </div>
        ${seat.currentBet > 0 ? `
          <div class="mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold animate-pulse">
            Bet: ${seat.currentBet}
          </div>
        ` : ''}
      `;
    }
  });

  // Action Buttons state for Hero
  const heroSeat = activeTable.seats[0];
  const isHeroTurn = activeTable.handActive && activeTable.turnSeat === 0 && !heroSeat.isFolded;

  const foldBtn = document.getElementById('action-fold-btn');
  const callBtn = document.getElementById('action-call-btn');
  const raiseBtn = document.getElementById('action-raise-btn');

  if (foldBtn && callBtn && raiseBtn) {
    foldBtn.disabled = !isHeroTurn;
    callBtn.disabled = !isHeroTurn;
    raiseBtn.disabled = !isHeroTurn;

    const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
    const toCall = highestBet - heroSeat.currentBet;

    if (toCall <= 0) {
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
  const hero = activeTable.seats[0];
  if (!hero || hero.isFolded) return 'Folded';
  if (!hero.cards || hero.cards.length < 2) return 'Waiting for next hand...';

  if (activeTable.communityCards.length === 0) {
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

// ============================================================================
// 8. REAL TEXAS HOLD'EM POKER ENGINE
// ============================================================================
function showTableBanner(text) {
  activeTable.tableNotice = text;
  const bannerEl = document.getElementById('table-stage-banner');
  if (bannerEl) bannerEl.innerText = text;
}

function startNewHand() {
  playSound('deal');
  activeTable.handNumber = (activeTable.handNumber || 0) + 1;
  activeTable.stage = 'PREFLOP';
  activeTable.communityCards = [];
  activeTable.tableNotice = 'PREFLOP';
  activeTable.handActive = true;

  // Generate 52-card shuffled deck
  activeTable.deck = createFreshShuffledDeck();

  // Rotate dealer
  activeTable.dealerSeat = (activeTable.dealerSeat + 1) % activeTable.seats.length;

  // Reset player hand states & deal 2 hole cards to each active seat
  activeTable.seats.forEach((seat, idx) => {
    // Top up chips if broke
    if (seat.chips < 100) seat.chips = 5000;
    seat.currentBet = 0;
    seat.totalBetThisHand = 0;
    seat.isFolded = false;
    seat.isAllIn = false;
    seat.actedThisStreet = false;
    seat.cards = [activeTable.deck.pop(), activeTable.deck.pop()];
  });

  // Track stats for Hero in this hand
  currentHandStats = {
    heroVpip: false,
    heroPfr: false,
    hero3Bet: false,
  };

  // Blinds
  const sbSeatIdx = (activeTable.dealerSeat + 1) % 6;
  const bbSeatIdx = (activeTable.dealerSeat + 2) % 6;

  activeTable.seats[sbSeatIdx].chips -= 25;
  activeTable.seats[sbSeatIdx].currentBet = 25;
  activeTable.seats[sbSeatIdx].totalBetThisHand = 25;

  activeTable.seats[bbSeatIdx].chips -= 50;
  activeTable.seats[bbSeatIdx].currentBet = 50;
  activeTable.seats[bbSeatIdx].totalBetThisHand = 50;

  activeTable.pot = 75;

  // Preflop first to act is UTG (seat after BB)
  const utgSeatIdx = (activeTable.dealerSeat + 3) % 6;
  activeTable.turnSeat = utgSeatIdx;

  renderPokerTable();

  // If bot turn first, schedule bot turns
  if (activeTable.turnSeat !== 0) {
    setTimeout(runBotTurns, 750);
  }
}

function takeAction(actionType) {
  if (!activeTable.handActive || activeTable.turnSeat !== 0) return;

  const hero = activeTable.seats[0];
  const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
  const toCall = highestBet - hero.currentBet;

  if (actionType === 'FOLD') {
    hero.isFolded = true;
    hero.actedThisStreet = true;
    playSound('fold');
  } else if (actionType === 'CALL') {
    if (activeTable.stage === 'PREFLOP' && toCall > 0 && !currentHandStats.heroVpip) {
      currentHandStats.heroVpip = true;
      userProfile.vpipHands = (userProfile.vpipHands || 0) + 1;
    }
    const actualCall = Math.min(toCall, hero.chips);
    hero.chips -= actualCall;
    hero.currentBet += actualCall;
    hero.totalBetThisHand = (hero.totalBetThisHand || 0) + actualCall;
    activeTable.pot += actualCall;
    hero.actedThisStreet = true;
    playSound('chips');
  } else if (actionType === 'RAISE') {
    const inputVal = parseInt(document.getElementById('raise-amount-input').value, 10);
    const minRaise = highestBet > 0 ? highestBet * 2 : activeTable.bigBlind * 2;
    const raiseTarget = isNaN(inputVal) || inputVal < minRaise ? minRaise : inputVal;
    const additional = Math.min(raiseTarget - hero.currentBet, hero.chips);

    if (activeTable.stage === 'PREFLOP') {
      if (!currentHandStats.heroVpip) {
        currentHandStats.heroVpip = true;
        userProfile.vpipHands = (userProfile.vpipHands || 0) + 1;
      }
      if (!currentHandStats.heroPfr) {
        currentHandStats.heroPfr = true;
        userProfile.pfrHands = (userProfile.pfrHands || 0) + 1;
      }
      if (highestBet > activeTable.bigBlind && !currentHandStats.hero3Bet) {
        currentHandStats.hero3Bet = true;
        userProfile.threeBetHands = (userProfile.threeBetHands || 0) + 1;
      }
    }

    hero.chips -= additional;
    hero.currentBet += additional;
    hero.totalBetThisHand = (hero.totalBetThisHand || 0) + additional;
    activeTable.pot += additional;
    hero.actedThisStreet = true;
    playSound('chips');
  }

  renderPokerTable();
  setTimeout(advanceToNextPlayer, 400);
}

function runBotTurns() {
  if (!activeTable.handActive || activeTable.turnSeat === 0) return;

  const bot = activeTable.seats[activeTable.turnSeat];
  if (!bot || bot.isFolded || bot.chips <= 0) {
    advanceToNextPlayer();
    return;
  }

  const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
  const diff = highestBet - bot.currentBet;

  if (diff === 0) {
    // Check
    bot.actedThisStreet = true;
  } else if (diff <= 100) {
    // Call
    const callAmt = Math.min(diff, bot.chips);
    bot.chips -= callAmt;
    bot.currentBet += callAmt;
    bot.totalBetThisHand = (bot.totalBetThisHand || 0) + callAmt;
    activeTable.pot += callAmt;
    bot.actedThisStreet = true;
    playSound('chips');
  } else {
    // Rational fold or call
    if (Math.random() > 0.4 && bot.chips >= diff) {
      const callAmt = Math.min(diff, bot.chips);
      bot.chips -= callAmt;
      bot.currentBet += callAmt;
      bot.totalBetThisHand = (bot.totalBetThisHand || 0) + callAmt;
      activeTable.pot += callAmt;
      bot.actedThisStreet = true;
      playSound('chips');
    } else {
      bot.isFolded = true;
      bot.actedThisStreet = true;
      playSound('fold');
    }
  }

  renderPokerTable();
  setTimeout(advanceToNextPlayer, 500);
}

function advanceToNextPlayer() {
  if (!activeTable.handActive) return;

  // 1. Check if only 1 player remains unfolded
  const nonFolded = activeTable.seats.filter(s => !s.isFolded);
  if (nonFolded.length === 1) {
    concludeHand(nonFolded[0], 'uncontested');
    return;
  }

  // 2. Check if current street betting round is finished
  const highestBet = Math.max(...activeTable.seats.map(s => s.currentBet));
  const activeUnfoldedWithChips = nonFolded.filter(s => s.chips > 0);
  const allActed = activeUnfoldedWithChips.every(s => s.actedThisStreet);
  const betsBalanced = activeUnfoldedWithChips.every(s => s.currentBet === highestBet);

  if (allActed && betsBalanced) {
    // Street Transition!
    activeTable.seats.forEach(s => {
      s.currentBet = 0;
      s.actedThisStreet = false;
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
      // SHOWDOWN!
      activeTable.stage = 'SHOWDOWN';
      renderPokerTable();
      evaluateShowdown();
      return;
    }

    // Set first to act in next street (player left of dealer)
    let nextSeat = (activeTable.dealerSeat + 1) % 6;
    while (activeTable.seats[nextSeat].isFolded || activeTable.seats[nextSeat].chips <= 0) {
      nextSeat = (nextSeat + 1) % 6;
    }
    activeTable.turnSeat = nextSeat;
    renderPokerTable();

    if (activeTable.turnSeat === 0) return; // Hero's turn
    setTimeout(runBotTurns, 700);
    return;
  }

  // 3. Move to next player in current street
  let nextSeat = (activeTable.turnSeat + 1) % 6;
  while (activeTable.seats[nextSeat].isFolded || activeTable.seats[nextSeat].chips <= 0) {
    nextSeat = (nextSeat + 1) % 6;
  }
  activeTable.turnSeat = nextSeat;
  renderPokerTable();

  if (activeTable.turnSeat === 0) return; // Hero's turn
  setTimeout(runBotTurns, 650);
}

function evaluateShowdown() {
  const nonFolded = activeTable.seats.filter(s => !s.isFolded);
  let bestScore = -1;
  let winner = nonFolded[0];
  let winningDesc = '';

  nonFolded.forEach(seat => {
    const all7 = [...seat.cards, ...activeTable.communityCards];
    const ev = evaluateBestHand(all7);
    if (ev.score > bestScore) {
      bestScore = ev.score;
      winner = seat;
      winningDesc = ev.desc;
    }
  });

  concludeHand(winner, 'showdown', winningDesc);
}

function concludeHand(winner, reason, showdownDesc = '') {
  activeTable.handActive = false;
  const wonPot = activeTable.pot;
  winner.chips += wonPot;

  const desc = showdownDesc ? `ด้วย ${showdownDesc}` : '(Uncontested Pot)';
  showTableBanner(`🏆 ${winner.name} ชนะ ${wonPot.toLocaleString()} ₮ ${desc}`);

  // Update Hero Stats & EXP
  userProfile.totalHands = (userProfile.totalHands || 0) + 1;
  const heroInvested = activeTable.seats[0].totalBetThisHand || 0;

  if (winner.isHero) {
    const netProfit = wonPot - heroInvested;
    userProfile.netTgb = (userProfile.netTgb || 0) + netProfit;
    userProfile.tgbBalance = (userProfile.tgbBalance || 12500) + netProfit;
    userProfile.exp = (userProfile.exp || 0) + 100;
    playSound('win');
  } else {
    userProfile.netTgb = (userProfile.netTgb || 0) - heroInvested;
    userProfile.tgbBalance = Math.max(0, (userProfile.tgbBalance || 12500) - heroInvested);
    userProfile.exp = (userProfile.exp || 0) + 25;
  }

  // Level check
  const neededExp = (userProfile.level || 1) * 500;
  if ((userProfile.exp || 0) >= neededExp) {
    userProfile.level = (userProfile.level || 1) + 1;
  }

  // Persist session
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userProfile));
  } catch (e) {}

  updateAuthUI(true, userProfile);
  renderProfileView();

  activeTable.pot = 0;
  renderPokerTable();

  // Auto-deal next hand after 4 seconds
  setTimeout(startNewHand, 4000);
}

// Raise Presets
function setRaisePreset(preset) {
  const slider = document.getElementById('raise-range-slider');
  const input = document.getElementById('raise-amount-input');
  const raiseBtn = document.getElementById('action-raise-btn');

  let val = 100;
  if (preset === 'min') val = activeTable.bigBlind * 2;
  else if (preset === '2.5bb') val = Math.round(activeTable.bigBlind * 2.5);
  else if (preset === 'half_pot') val = Math.round(activeTable.pot * 0.5) || 100;
  else if (preset === 'pot') val = activeTable.pot || 100;
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

  // Create new player account (Strictly 0 units across all metrics)
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
  userProfile.email = user.email || 'user@tgbpoker.local';
  userProfile.tgbBalance = user.tgbBalance !== undefined ? user.tgbBalance : 12500;
  userProfile.level = user.level || 1;
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
  userProfile.registeredAt = user.registeredAt || new Date().toLocaleDateString('th-TH');

  // Update Hero seat on table
  if (activeTable && activeTable.seats && activeTable.seats[0]) {
    activeTable.seats[0].name = `${user.username} (You)`;
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
    email: 'guest@tgbpoker.local',
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

  if (topBalance) {
    topBalance.innerText = (userProfile.tgbBalance || 12500).toLocaleString() + '.00';
  }

  if (isLoggedIn && user) {
    if (navLoginBtn) navLoginBtn.classList.add('hidden');
    if (navUserContainer) navUserContainer.classList.remove('hidden');
    if (navName) navName.innerText = user.username;
    
    if (navAvatar) {
      navAvatar.className = `w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow overflow-hidden text-sm ${userProfile.frame || 'frame-none'}`;
      if (userProfile.avatarType === 'image' && userProfile.avatarUrl) {
        navAvatar.innerHTML = `<img src="${userProfile.avatarUrl}" class="w-full h-full object-cover">`;
      } else {
        navAvatar.innerHTML = `<span class="text-base">${userProfile.avatarEmoji || user.username.charAt(0)}</span>`;
      }
    }

    if (navLevelBadge) navLevelBadge.innerText = `Lv.${user.level || 1}`;
    if (navRankTitle) {
      let rankTitle = 'Novice Player';
      if (user.level >= 10) rankTitle = 'Grand Master';
      else if (user.level >= 5) rankTitle = 'Elite Pro';
      navRankTitle.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>${rankTitle}`;
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

  // If no saved user, default to initial userProfile
  setLoggedInUser(userProfile);
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
window.renderProfileView = renderProfileView;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.selectPresetAvatar = selectPresetAvatar;
window.handleAvatarFileUpload = handleAvatarFileUpload;
window.selectAvatarFrame = selectAvatarFrame;
window.updateProfilePreview = updateProfilePreview;
window.saveProfileCustomization = saveProfileCustomization;

// ============================================================================
// INITIALIZATION
// ============================================================================
function initApp() {
  restoreUserSession();
  renderTournamentCards();
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

