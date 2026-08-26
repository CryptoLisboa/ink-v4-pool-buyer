// Sell the target token for ETH through the Ink V4 router.
//   node sell.mjs amount 17000      -> sell 17000 tokens
//   node sell.mjs percentage 100    -> sell 100% of token balance
// Flags: --yes/-y skip confirm, --dry quote-and-exit. Env: SLIPPAGE=0.05
// A sell needs an ERC-20 approval first; this does approve -> sell.
import {
  getProvider, loadWallet, quoteSell, buildSell, gasLimitFor,
  tokenBalance, allowanceTo, erc20,
  ROUTER, TOKEN, formatEther, riskBanner, confirm, parseArgs, pctOf, toToken,
} from './lib.mjs';

const { mode, value, yes, dry, slippage } = parseArgs(process.argv);
const SLIP = slippage ?? 0.05;

if (!['amount', 'percentage'].includes(mode) || value === undefined) {
  console.log('usage: node sell.mjs amount <tokens> | node sell.mjs percentage <pct>   [--yes] [--dry]');
  process.exit(1);
}

const provider = await getProvider();
const { wallet, src } = loadWallet(provider);
const me = wallet.address;
const bal = await tokenBalance(provider, me);

let amountIn = mode === 'amount' ? toToken(value) : pctOf(bal, value);
if (amountIn > bal) amountIn = bal;             // clamp (percentage 100 == full)
if (amountIn <= 0n) { console.error('no tokens to sell'); process.exit(1); }

const quoted = await quoteSell(provider, me, amountIn);
const minOut = quoted * BigInt(Math.floor((1 - SLIP) * 1e6)) / 1_000_000n;

console.log(JSON.stringify({
  action: 'SELL', wallet: me, key_source: src,
  token_balance: formatEther(bal), selling: formatEther(amountIn),
  quoted_eth_out: formatEther(quoted), min_eth_out: formatEther(minOut),
  slippage: SLIP,
}, null, 2));

if (dry) process.exit(0);
riskBanner();
if (!(await confirm(`Sell ${formatEther(amountIn)} tokens for ~${formatEther(quoted)} ETH?`, yes))) { console.log('cancelled.'); process.exit(0); }

// 1) approve exact amount if needed
const allow = await allowanceTo(provider, me, ROUTER);
if (allow < amountIn) {
  const atx = await wallet.sendTransaction({ to: TOKEN, data: erc20.encodeFunctionData('approve', [ROUTER, amountIn]) });
  console.log('approve sent:', atx.hash);
  const arc = await atx.wait();
  console.log('approve', arc.status === 1 ? 'ok' : 'FAILED');
  if (arc.status !== 1) process.exit(1);
}

// 2) sell with gas buffer
const data = buildSell(amountIn, minOut);
const gasLimit = await gasLimitFor(provider, { from: me, to: ROUTER, value: 0n, data });
const ethBefore = await provider.getBalance(me);
const tx = await wallet.sendTransaction({ to: ROUTER, value: 0n, data, gasLimit });
console.log('sell sent:', tx.hash);
const rc = await tx.wait();
console.log('mined block', rc.blockNumber, 'status', rc.status === 1 ? 'SUCCESS' : 'REVERTED');
const ethAfter = await provider.getBalance(me);
const gasCost = rc.gasUsed * (rc.gasPrice ?? tx.gasPrice ?? 0n);
if (rc.status === 1) console.log('ETH received (net of gas):', formatEther(ethAfter - ethBefore + gasCost));
console.log('explorer: https://explorer.inkonchain.com/tx/' + tx.hash);
if (rc.status !== 1) process.exit(1);
