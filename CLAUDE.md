# CLAUDE.md — ink-v4-pool-buyer

Minimal CLI to **buy/sell a Uniswap V4 pool on Ink** (chain 57073). Defaults target the
**ROTH / wSPYx** pool through the on-chain Sentry V4 router; override with env vars to point
at another Ink V4 pool. **Unofficial. Not affiliated with any project. Use at your own risk.**

## Files

| File | Role |
|---|---|
| `buy.mjs` | buy the token with ETH — `node buy.mjs amount <eth>` or `percentage <pct>` |
| `sell.mjs` | sell the token for ETH — `node sell.mjs amount <tokens>` or `percentage <pct>` |
| `lib.mjs` | shared: RPC, key loading, quote, gas buffer, risk banner, confirm |
| `privatekey.txt` | **the user's burner key — gitignored, never committed** |
| `privatekey.example.txt` | placeholder showing the format |

## Setup (what a new user needs)

1. Node.js 18+ installed.
2. `npm install` (pulls `ethers`).
3. A **burner** private key in `privatekey.txt` (copy from `privatekey.example.txt`).

Then: `node buy.mjs amount 0.01` — it quotes, asks the user to type `yes`, then broadcasts.
Add `--dry` to quote without sending; `--yes` to skip the prompt.

For a beginner who has nothing installed, use the **`quickstart` skill** in
`.claude/skills/quickstart/` — it walks them through OS-specific install, key placement,
and a first dry-run.

## Safety rules for any agent working in this repo

These are hard rules. Follow them exactly.

- **Never print, echo, log, or paste the private key.** Not into chat, not into a file you
  show, not into a commit. To set it up, `cp privatekey.example.txt privatekey.txt` and tell
  the user to open that file and paste their key — never ask them to paste the key into chat.
- **Never commit secrets.** `privatekey.txt`, `.env`, `*.key` are gitignored — keep it that
  way. Before any commit, confirm `privatekey.txt` is not staged and the key value is in no
  tracked file.
- **Burner only.** Tell the user to fund this wallet with only what they will trade.
- **Unverified contracts.** The router and its fee hook are unverified on the explorer — a
  hidden sell-tax, pause, or drain cannot be ruled out. Advise testing with a tiny amount
  first. This is not financial advice.

## Config (env vars)

`SLIPPAGE` (default 0.03 buy / 0.05 sell), `RPC_URL` (defaults to public tracking:none Ink
RPCs), `TOKEN` / `BASE` / `ROUTER` (retarget the pool), `PRIVATE_KEY` (key via env instead of
the file). No keyed or personal RPC is bundled.
