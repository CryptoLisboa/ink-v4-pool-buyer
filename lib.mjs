// Shared helpers for the Ink V4 pool buyer/seller.
// Read-only quoting + tx building. Signs only when a script decides to send.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  Wallet, JsonRpcProvider, Interface, AbiCoder,
  formatEther, parseUnits, keccak256, toBeHex, zeroPadValue,
} from 'ethers';

export const CHAIN_ID = 57073; // Ink
// Target pool. Defaults = ROTH / wSPYx through the Sentry V4 router.
// Override any of these with env vars to point at another Ink V4 pool.
export const ROUTER = (process.env.ROUTER || '0x1b4D919149912c9781b086C8242729EE317631C8');
export const TOKEN  = (process.env.TOKEN  || '0x71cD2512aB785CB4268E2c45eE7F40aa1b412313'); // token you buy/sell
export const BASE   = (process.env.BASE   || '0xE7E553Cd128F0011777323A0b44a7b96EA1CB540'); // pool's paired base
export const BUY_SEL  = '0x11abcf9e';  // buy(token, base, minTokenOut, recipient) payable
export const SELL_SEL = '0x6fd0b140';  // sell(token, base, amountIn, minEthOut)
export const ALLOWANCE_SLOT = 6n;      // SentryTokenizedStocks: allowance mapping storage slot (for preview override)

export const coder = AbiCoder.defaultAbiCoder();

// Public RPCs, probed for full-node + state-override support. Override with RPC_URL.
// pocket is tracking:none (privacy); the inkonchain endpoints are the official
// public fallbacks. None require a key; none are personal to you.
const RPCS = (process.env.RPC_URL ? [process.env.RPC_URL] : []).concat([
  'https://ink.api.pocket.network',   // tracking: none
  'https://rpc-gel.inkonchain.com',   // official public
  'https://rpc-qnd.inkonchain.com',   // official public
]);

export async function getProvider() {
  const ZERO = '0x0000000000000000000000000000000000000000';
  let lastErr;
  for (const url of RPCS) {
    try {
      const p = new JsonRpcProvider(url, { chainId: CHAIN_ID, name: 'ink' });
      await p.getBalance(ZERO); // proves eth_getBalance works (not just eth_blockNumber)
      return p;
    } catch (e) { lastErr = e; }
  }
  throw new Error('No reachable Ink RPC. Set RPC_URL to a working endpoint. ' + (lastErr?.shortMessage || ''));
}

const here = (name) => fileURLToPath(new URL('./' + name, import.meta.url));
function looksLikeKey(s) { const t = s.trim(); return /^0x?[0-9a-fA-F]{64}$/.test(t) || t.split(/\s+/).length >= 12; }

export function loadWallet(provider) {
  let raw = process.env.PRIVATE_KEY || '';
  let src = 'PRIVATE_KEY env';
  if (!raw) {
    try { raw = readFileSync(here('privatekey.txt'), 'utf8'); src = 'privatekey.txt'; }
    catch {
      const dir = fileURLToPath(new URL('./', import.meta.url));
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.txt') || f === 'privatekey.example.txt') continue;
        try { const c = readFileSync(here(f), 'utf8'); if (looksLikeKey(c)) { raw = c; src = f; break; } } catch {}
      }
    }
  }
  raw = (raw || '').trim();
  if (!raw) throw new Error('No private key found. Put it in privatekey.txt in this folder (see privatekey.example.txt).');
  const w = /^0x?[0-9a-fA-F]{64}$/.test(raw)
    ? new Wallet(raw.startsWith('0x') ? raw : '0x' + raw)
    : Wallet.fromPhrase(raw);
  return { wallet: w.connect(provider), src };
}

export const erc20 = new Interface([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);

export const buildBuy  = (minOut, recipient) => BUY_SEL  + coder.encode(['address','address','uint256','address'],[TOKEN, BASE, minOut, recipient]).slice(2);
export const buildSell = (amountIn, minOut)  => SELL_SEL + coder.encode(['address','address','uint256','uint256'],[TOKEN, BASE, amountIn, minOut]).slice(2);

export async function read(provider, to, data) { return provider.call({ to, data }); }
export async function tokenBalance(provider, who) {
  return coder.decode(['uint256'], await read(provider, TOKEN, erc20.encodeFunctionData('balanceOf', [who])))[0];
}
export async function allowanceTo(provider, owner, spender) {
  return coder.decode(['uint256'], await read(provider, TOKEN, erc20.encodeFunctionData('allowance', [owner, spender])))[0];
}

// Static buy quote: token out for `spendWei` of ETH.
export async function quoteBuy(provider, me, spendWei) {
  const ret = await provider.call({ from: me, to: ROUTER, value: spendWei, data: buildBuy(0n, me) });
  return coder.decode(['uint256'], ret.slice(0, 66))[0];
}

// Static sell quote: ETH out for `amountIn` tokens. Uses an allowance state
// override so it can preview before any approval exists.
export async function quoteSell(provider, me, amountIn) {
  const txObj = { from: me, to: ROUTER, value: '0x0', data: buildSell(amountIn, 0n) };
  const allow = await allowanceTo(provider, me, ROUTER);
  if (allow >= amountIn) return coder.decode(['uint256'], (await provider.call(txObj)).slice(0, 66))[0];
  const inner = keccak256(coder.encode(['address','uint256'], [me, ALLOWANCE_SLOT]));
  const slot  = keccak256(coder.encode(['address','bytes32'], [ROUTER, inner]));
  const override = { [TOKEN]: { stateDiff: { [slot]: zeroPadValue(toBeHex(amountIn), 32) } } };
  const ret = await provider.send('eth_call', [txObj, 'latest', override]);
  return coder.decode(['uint256'], ret.slice(0, 66))[0];
}

// Explicit gas limit with a 2x buffer. Auto-estimate lands at ~99.9% of used
// and starves the nested V4 unlock/callback sub-call (EIP-150 63/64 rule),
// reverting a tx that eth_call says would pass. Gas on Ink is ~0.001 gwei.
export async function gasLimitFor(provider, req) {
  let g;
  try { g = (await provider.estimateGas(req)) * 2n; } catch { g = 3_000_000n; }
  return g < 2_500_000n ? 2_500_000n : g;
}

export const pctOf = (amount, pctStr) => amount * BigInt(Math.round(Number(pctStr) * 1e6)) / BigInt(100e6);
export const toToken = (v) => parseUnits(String(v), 18);
export { formatEther };

export function riskBanner() {
  console.log(`\n============================ READ THIS ============================
 Independent, UNOFFICIAL tool. Not affiliated with Ink, Sentry, or any
 token issuer. No warranty. You are solely responsible for what it does.

 * The router and fee hook it calls are UNVERIFIED on the explorer. A
   hidden sell-tax, transfer-lock, pause, or drain CANNOT be ruled out —
   you may be unable to sell, or sell at a large loss.
 * Fees observed on-chain: ~1.5% platform + 0.5% reflection per side,
   plus price impact and slippage. Round-trips lose value.
 * Your private key is read from a PLAINTEXT file in this folder. Anyone
   with that file controls the wallet. Use a BURNER funded with only what
   you will trade. Never commit, zip, or share the key file.
 * Every send is IRREVERSIBLE and spends real funds.
==================================================================\n`);
}

export async function confirm(question, autoYes) {
  if (autoYes) return true;
  const rl = createInterface({ input, output });
  const ans = (await rl.question(question + ' Type "yes" to proceed: ')).trim().toLowerCase();
  rl.close();
  return ans === 'yes' || ans === 'y';
}

export function parseArgs(argv) {
  const a = argv.slice(2);
  const flags = new Set(a.filter(x => x.startsWith('-')));
  const pos = a.filter(x => !x.startsWith('-'));
  return {
    mode: (pos[0] || '').toLowerCase(),          // "amount" | "percentage"
    value: pos[1],
    yes: flags.has('--yes') || flags.has('-y'),
    dry: flags.has('--dry'),
    slippage: process.env.SLIPPAGE ? Number(process.env.SLIPPAGE) : null,
  };
}
