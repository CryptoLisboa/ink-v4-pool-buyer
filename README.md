# ink-v4-pool-buyer

Minimal command-line **buy / sell** for a Uniswap-V4 pool on **Ink** (chain 57073),
routed through the on-chain V4 router. Defaults target the **ROTH / wSPYx** pool;
point it at another Ink V4 pool with env vars.

> **Unofficial and independent.** Not affiliated with Ink, Sentry, or any token
> issuer. No warranty. See **Risks** below — the router and fee hook it calls are
> **unverified on the explorer**, and every trade spends real funds irreversibly.

## Setup

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
cp privatekey.example.txt privatekey.txt   # then paste your key into privatekey.txt
```

Use a **burner wallet** funded with only what you'll trade.

## Usage

```bash
# BUY (spend ETH)
node buy.mjs amount 0.01         # spend 0.01 ETH
node buy.mjs percentage 50       # spend 50% of ETH balance (keeps a little for gas)

# SELL (sell tokens for ETH)  — does approve, then sell
node sell.mjs amount 17000       # sell 17000 tokens
node sell.mjs percentage 100     # sell entire token balance
```

Flags: `--dry` quote and exit (sends nothing), `--yes`/`-y` skip the confirm prompt.
Each command prints a quote first, then asks you to type `yes` before broadcasting.

## Config (env vars)

| Var | Default | Meaning |
|---|---|---|
| `SLIPPAGE` | `0.03` buy / `0.05` sell | max slippage, e.g. `0.02` = 2% |
| `RPC_URL` | public Ink RPCs (tracking: none) | your own endpoint |
| `TOKEN` / `BASE` / `ROUTER` | ROTH / wSPYx / Sentry router | target a different Ink V4 pool |
| `PRIVATE_KEY` | — | key via env instead of `privatekey.txt` |

Default RPCs are public, privacy-respecting endpoints (no tracking). No personal
endpoint or API key is bundled or required.

## How it works

- **Buy** calls the router's `buy(token, base, minTokenOut, recipient)` with ETH as
  `msg.value`. The router wraps to WETH and routes ETH → WETH → … → base → **token**.
- **Sell** calls `sell(token, base, amountIn, minEthOut)` (needs an ERC-20 approval
  first), routing token → base → … → ETH back to you.
- Quotes come from a read-only `eth_call`; `minOut` is set from the quote and your
  slippage. Gas limit is set with a 2× buffer (a tight auto-estimate reverts the
  V4 unlock/callback path even though the simulation passes).

## Risks (read before using)

- **Unverified contracts.** The router and its fee hook are not verified on the
  explorer. A hidden sell-tax, transfer-lock, pause, or drain **cannot be ruled
  out**. You may be unable to sell, or sell at a large loss. Test with a tiny
  amount first.
- **Fees & impact.** ~1.5% platform + 0.5% reflection **per side**, plus price
  impact and slippage. Round-trips lose value.
- **Key handling.** Your key sits in a plaintext file. Anyone who gets it controls
  the wallet. Never commit or share it (`.gitignore` already excludes `privatekey.txt`).
- **Irreversible.** Broadcasts spend real funds and cannot be undone.

MIT-licensed code; no financial advice. Use at your own risk.
