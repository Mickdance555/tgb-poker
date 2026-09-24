import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TableEngine } from '../core/pokerEngine.js';
import { TGBLedger } from '../core/ledger.js';
import { TournamentEngine } from '../core/tournament.js';
import { ProvablyFairRNG } from '../core/csprng.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const PUBLIC_DIR = path.resolve('public');

// In-Memory state for quick demonstration & live play
const tables = new Map<string, TableEngine>();
const userLedgers = new Map<string, any[]>();
const userBalances = new Map<string, number>();

// Initialize default table
const defaultTable = new TableEngine({
  tableId: 'table_daily_mtt_01',
  tournamentId: 'mtt_001',
  maxSeats: 6,
  smallBlind: 25,
  bigBlind: 50,
  ante: 0,
  actionTimeoutSeconds: 20,
});

// Seed default table with AI bots
defaultTable.sitPlayer(0, 'user_hero', 'Hero (You)', 5000);
defaultTable.sitPlayer(1, 'bot_viper', 'Viper (TAG)', 5000);
defaultTable.sitPlayer(2, 'bot_bluffmaster', 'BluffMaster (LAG)', 5000);
defaultTable.sitPlayer(3, 'bot_rock', 'The Rock (NIT)', 5000);
defaultTable.sitPlayer(4, 'bot_fish', 'CallingStation (FISH)', 5000);
defaultTable.sitPlayer(5, 'bot_gto', 'GTO_Bot (PRO)', 5000);

tables.set(defaultTable.config.tableId, defaultTable);

// Server definition
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // 1. API Endpoints
  if (url.pathname === '/api/v1/tournaments') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: [
          {
            id: 'mtt_001',
            title: '#001 Daily Standard MTT',
            type: 'DAILY_STANDARD',
            buyIn: 500,
            prizePool: 50000,
            startingChips: 5000,
            currentPlayers: 82,
            maxPlayers: 100,
            status: 'REGISTRATION',
            scheduledAt: new Date(Date.now() + 1800000).toISOString(),
          },
          {
            id: 'mtt_002',
            title: '#002 Sunday Major Championship',
            type: 'SUNDAY_MAJOR',
            buyIn: 2500,
            prizePool: 500000,
            startingChips: 15000,
            currentPlayers: 340,
            maxPlayers: 1000,
            status: 'REGISTRATION',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'mtt_003',
            title: '#003 Turbo Knockout Bounty',
            type: 'TURBO',
            buyIn: 300,
            prizePool: 25000,
            startingChips: 3000,
            currentPlayers: 48,
            maxPlayers: 64,
            status: 'RUNNING',
            scheduledAt: new Date(Date.now() - 600000).toISOString(),
          },
          {
            id: 'mtt_004',
            title: '#004 Academy Freeroll',
            type: 'DAILY_MICRO',
            buyIn: 0,
            prizePool: 5000,
            startingChips: 2000,
            currentPlayers: 95,
            maxPlayers: 100,
            status: 'REGISTRATION',
            scheduledAt: new Date(Date.now() + 900000).toISOString(),
          },
        ],
      })
    );
    return;
  }

  if (url.pathname === '/api/v1/wallet/balance') {
    const userId = url.searchParams.get('userId') || 'user_hero';
    const balance = userBalances.get(userId) ?? 12500;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { userId, balance } }));
    return;
  }

  if (url.pathname === '/api/v1/verify/provably-fair' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const result = ProvablyFairRNG.verifyProvablyFair({
          serverSeed: payload.serverSeed,
          serverSeedHash: payload.serverSeedHash,
          salt: payload.salt,
          clientSeed: payload.clientSeed || '0000000000000000',
          nonce: payload.nonce || 1,
          expectedDeckIndices: payload.expectedDeckIndices || [],
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2. Static File Serving for Frontend
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[TGB Poker Engine] HTTP & Static Server running at http://localhost:${PORT}`);
});
