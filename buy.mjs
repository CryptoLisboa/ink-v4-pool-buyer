// Buy the target token with ETH through the Ink V4 router.
//   node buy.mjs amount 0.01        -> spend 0.01 ETH
//   node buy.mjs percentage 50      -> spend 50% of ETH balance (leaves gas)
// Flags: --yes/-y skip confirm, --dry quote-and-exit. Env: SLIPPAGE=0.03
import { parseEther } from 'ethers';
import {
  getProvider, loadWallet, quoteBuy, buildBuy, gasLimitFor,
  ROUTER, TOKEN, formatEther, riskBanner, confirm, parseArgs, pctOf,
} from './lib.mjs';

const { mode, value, yes, dry, slippage } = parseArgs(process.argv);
const SLIP = slippage ?? 0.03;

if (!['amount', 'percentage'].includes(mode) || value === undefined) {
  console.log('usage: node buy.mjs amount <eth> | node buy.mjs percentage <pct>   [--yes] [--dry]');
  process.exit(1);
}

const provider = await getProvider();
const { wallet, src } = loadWallet(provider);
const me = wallet.address;
const ethBal = await provider.getBalance(me);

let spend;
if (mode === 'amount') spend = parseEther(String(value));
else {
  spend = pctOf(ethBal, value);
  const reserve = parseEther('0.0003');           // keep a little ETH for gas
  if (spend > ethBal - reserve) spend = ethBal > reserve ? ethBal - reserve : 0n;
}
if (spend <= 0n) { console.error('nothing to spend'); process.exit(1); }
if (spend > ethBal) { console.error(`insufficient ETH: need ${formatEther(spend)}, have ${formatEther(ethBal)}`); process.exit(1); }

const quoted = await quoteBuy(provider, me, spend);
const minOut = quoted * BigInt(Math.floor((1 - SLIP) * 1e6)) / 1_000_000n;

console.log(JSON.stringify({
  action: 'BUY', wallet: me, key_source: src,
  spend_eth: formatEther(spend), eth_balance: formatEther(ethBal),
  quoted_token_out: formatEther(quoted), min_token_out: formatEther(minOut),
  slippage: SLIP,
}, null, 2));

if (dry) process.exit(0);
riskBanner();
if (!(await confirm(`Buy with ${formatEther(spend)} ETH on Ink?`, yes))) { console.log('cancelled.'); process.exit(0); }

const data = buildBuy(minOut, me);
const gasLimit = await gasLimitFor(provider, { from: me, to: ROUTER, value: spend, data });
const tx = await wallet.sendTransaction({ to: ROUTER, value: spend, data, gasLimit });
console.log('sent:', tx.hash);
const rc = await tx.wait();
console.log('mined block', rc.blockNumber, 'status', rc.status === 1 ? 'SUCCESS' : 'REVERTED');
console.log('explorer: https://explorer.inkonchain.com/tx/' + tx.hash);
if (rc.status !== 1) process.exit(1);
