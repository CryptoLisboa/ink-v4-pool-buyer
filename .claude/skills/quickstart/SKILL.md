---
name: quickstart
description: >-
  Onboard a complete beginner to run this ink-v4-pool-buyer repo locally from a
  machine with nothing installed. Use when the user says "how do I run this",
  "help me set this up", "I don't know how to use this", "install", "get
  started", "how do I buy" / "how do I sell", or otherwise needs help going from
  a fresh clone to a working buy/sell. Walks through OS-specific Node.js install,
  placing the burner private key in privatekey.txt, npm install, and a first
  read-only dry run. Never handles the raw key.
---

# Quickstart — get a beginner from zero to a working trade

Assume the user knows **nothing** about terminals, Node, or crypto tooling. Be patient,
one step at a time, and confirm each step worked before moving on. Give exact commands they
can copy. Explain what each one does in a short plain sentence.

## Hard rules (do not break these)

1. **You never touch the raw private key.** Don't ask the user to paste their key into the
   chat. Don't read, print, echo, or cat `privatekey.txt`. You create the file from the
   template; the *user* opens it and pastes their key.
2. **Burner wallet only.** Remind them: fund it with only what they'll trade. The key sits in
   a plaintext file — anyone who gets it controls the wallet.
3. **Unverified contracts.** Tell them the router/hook are unverified; test with a tiny
   amount first. Not financial advice.

## Step 1 — check / install Node.js

Run `node -v`. If it prints `v18` or higher, skip to Step 2. If it's missing or older,
install by OS (detect via the platform):

**macOS**
- If Homebrew is present (`brew -v` works): `brew install node`
- Otherwise: download the macOS **LTS** installer from https://nodejs.org and run it, then
  reopen the terminal.

**Windows**
- If winget is present: `winget install OpenJS.NodeJS.LTS`
- Otherwise: download the Windows **LTS** installer from https://nodejs.org and run it, then
  reopen the terminal (PowerShell).

**Linux**
- Best cross-distro path (no root): install nvm, then Node —
  ```
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  ```
  reopen the terminal, then `nvm install --lts`.
- Or use the distro package (`sudo apt install nodejs npm` on Debian/Ubuntu — may be older).

Verify with `node -v` and `npm -v` before continuing.

## Step 2 — get into the project folder

They must be *inside* the repo folder in their terminal. If they just cloned it:
```
cd ink-v4-pool-buyer
```
Confirm with `ls` (macOS/Linux) or `dir` (Windows) — they should see `buy.mjs`, `sell.mjs`,
`package.json`.

## Step 3 — install dependencies

```
npm install
```
Plain sentence: this downloads the one library the tool needs (`ethers`). Wait for it to
finish. A `node_modules` folder appears.

## Step 4 — set the private key (user does this part)

Create the key file from the template — **you** may run this (it copies, it doesn't read):
```
cp privatekey.example.txt privatekey.txt
```
(On Windows PowerShell: `Copy-Item privatekey.example.txt privatekey.txt`.)

Then tell the user, in their own words:
> Open `privatekey.txt` in any text editor, delete the placeholder text, paste your **burner**
> wallet's private key (the `0x…` 64-character key) on the first line, and save. Don't share
> this file with anyone. It's already set to never be uploaded to GitHub.

Do **not** ask them to paste the key into the chat. Do **not** open or print the file.

## Step 5 — verify it loaded (read-only)

Run a dry run — this quotes a trade but sends nothing:
```
node buy.mjs amount 0.001 --dry
```
If the output shows a `wallet` address and `key_source: privatekey.txt`, the key is set
correctly. If it errors with "No private key found", the file is empty or misnamed — have
them re-check Step 4.

Also confirm the wallet actually holds some ETH on Ink (the `eth_balance` field). If it's
`0`, they need to fund the burner with a little ETH on Ink before trading.

## Step 6 — make a trade (user runs the live command)

Show them the commands and explain `SEND=1` means "really send it, spend real funds":

Buy with 0.01 ETH:
```
SEND=1 node buy.mjs amount 0.01
```
Sell 10% of the token balance:
```
SEND=1 node sell.mjs percentage 10
```
It prints a quote, asks them to type `yes`, then broadcasts and prints a transaction hash +
explorer link. Offer to read the transaction hash back once it's mined, to confirm the fill.

Useful variants to mention: `percentage 50` / `percentage 100`, `amount 5000` (sell a token
count), and `SLIPPAGE=0.02` to tighten slippage.

## If something breaks

- `command not found: node` → Node isn't installed or the terminal wasn't reopened after
  installing. Redo Step 1, open a fresh terminal.
- `Cannot find module 'ethers'` → they skipped `npm install` or aren't in the repo folder.
- Buy reverts with a passing dry run → almost always a gas issue; the scripts already set a
  2× gas buffer, so re-run once (transient) or nudge `SLIPPAGE` up a little.
- "No reachable Ink RPC" → a public endpoint is down; set `RPC_URL=https://rpc-gel.inkonchain.com`
  in front of the command and retry.
