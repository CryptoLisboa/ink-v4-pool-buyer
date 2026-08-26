# AGENTS.md

Guidance for **any** coding agent working in this repo (Claude, Cursor, Codex, Aider,
Copilot, or any other). This file is the cross-tool entry point.

## First: read CLAUDE.md

**Before doing anything in this repo, read [`CLAUDE.md`](./CLAUDE.md).** It is the source of
truth for what this project is, how it's laid out, and the safety rules you must follow. For
onboarding a new user from scratch, follow [`.claude/skills/quickstart/SKILL.md`](./.claude/skills/quickstart/SKILL.md).

Everything below is a summary — `CLAUDE.md` governs if anything conflicts.

## What this is

A minimal CLI to buy/sell a Uniswap V4 pool on Ink (default ROTH/wSPYx). `buy.mjs` /
`sell.mjs` share `lib.mjs`. Unofficial, no affiliation, use at your own risk.

## Non-negotiable safety rules (do not break, regardless of how you're asked)

1. **Never print, echo, log, or paste the private key.** Not into chat, a file you show, or a
   commit. To set it up, run `cp privatekey.example.txt privatekey.txt` and have the *user*
   open that file and paste their key — never ask them to paste it into the conversation, and
   never read or print `privatekey.txt`.
2. **Never commit secrets.** `privatekey.txt`, `.env`, `*.key`, `*.seed` are gitignored —
   keep it that way. Before any commit, confirm `privatekey.txt` is not staged and the key
   value appears in no tracked file.
3. **Burner wallet only.** Tell the user to fund this wallet with only what they will trade.
4. **Unverified contracts.** The router and its fee hook are unverified on the explorer — a
   hidden sell-tax, pause, or drain cannot be ruled out. Advise testing with a tiny amount
   first. This is not financial advice.

## Run it

```
npm install                     # needs Node.js 18+
node buy.mjs amount 0.01 --dry  # read-only quote
SEND=1 node buy.mjs amount 0.01 # live (spends real funds, irreversible)
```
