```
██████╗  ██████╗ ██╗  ██╗███████╗██████╗
██╔══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗
██████╔╝██║   ██║█████╔╝ █████╗  ██████╔╝
██╔═══╝ ██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗
██║     ╚██████╔╝██║  ██╗███████╗██║  ██║
╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

███████╗███████╗████████╗████████╗██╗     ███████╗██████╗
██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝██║     ██╔════╝██╔══██╗
███████╗█████╗     ██║      ██║   ██║     █████╗  ██████╔╝
╚════██║██╔══╝     ██║      ██║   ██║     ██╔══╝  ██╔══██╗
███████║███████╗   ██║      ██║   ███████╗███████╗██║  ██║
╚══════╝╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚══════╝╚═╝  ╚═╝
```

<div align="center">

♠ &nbsp; ♥ &nbsp; ♣ &nbsp; ♦

**End-of-night poker settlement + shared Hall of Fame for your crew.**  
No spreadsheets. No arguments. No asking who owes who.

[![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-222?style=flat-square&logo=github)](https://pages.github.com)
[![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![No Framework](https://img.shields.io/badge/framework-none-gold?style=flat-square)](.)

</div>

---

## What it does

Built for a weekly home game. One person runs the settler, everyone can see the leaderboard.

```
┌─────────────────────┐      ┌──────────────────────────────┐
│      SETTLER        │      │       HALL OF FAME           │
│                     │      │                              │
│  Set chip → $ rate  │      │  🥇 Biggest Winner           │
│  Add players        │  →   │  💀 Biggest Loser            │
│  Enter buy-ins      │ save │  🎮 Most Games Played        │
│  Enter final chips  │      │  🐟 Biggest Fish             │
│  Hit Settle Up      │      │                              │
│  Confirm & Save     │      │  Full leaderboard + SQL      │
│                     │      │  stats table + session log   │
└─────────────────────┘      └──────────────────────────────┘
```

---

## Features

**Settlement**
- Configurable chip → real money conversion rate
- Optimal payment graph — minimises the number of transfers needed to clear all debts
- Confirm before saving so dodgy numbers don't sneak into the leaderboard
- Share or copy results to your group chat instantly

**Hall of Fame** *(shared — everyone sees the same data)*
- Stat cards: Biggest Winner, Biggest Loser, Most Games, Biggest Fish
- Leaderboard sortable by Total $, Games Played, or Win Rate
- Raw SQL stats table — games, wins, losses, win %, total earnings, avg per game
- Session history — last 15 nights with each player's result

**Mobile-first**
- Swipe left to remove a player card
- Home screen installable (iOS PWA)
- Haptic feedback on key actions

---

## Setup

> Takes about 5 minutes. Everything is free.

### 1 — Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free tier is plenty)
2. **New project** → give it a name → set a DB password → wait ~1 min

### 2 — Run the schema

1. Supabase dashboard → **SQL Editor → New Query**
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**

This creates three tables and a stats view:

```
sessions ──────────────────────────────────────────────────
  id          bigserial   PK
  played_at   timestamptz

session_results ───────────────────────────────────────────
  id            bigserial   PK
  session_id    bigint      FK → sessions.id (cascade delete)
  player_name   text
  buy_in_chips  numeric
  final_chips   numeric
  net_real      numeric     ← real $ won/lost after conversion

transactions ──────────────────────────────────────────────
  id          bigserial   PK
  session_id  bigint      FK → sessions.id (cascade delete)
  from_player text
  to_player   text
  amount      numeric

player_stats (VIEW) ───────────────────────────────────────
  player_name, games_played, total_winnings,
  wins, losses, avg_per_game, win_rate_pct
```

### 3 — Add credentials to `config.js`

Supabase dashboard → **Settings → API** → copy Project URL and anon key:

```js
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5c...';
```

> The anon key is safe to commit — it's public-facing and protected by Row Level Security policies.

### 4 — Push to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/poker-settler.git
git push -u origin main
```

Then in your repo: **Settings → Pages → Branch: main → / (root) → Save**

Live at: `https://YOUR_USERNAME.github.io/poker-settler`  
Send that link to your crew — they'll all see the same Hall of Fame.

---

## File structure

```
poker-settler/
├── index.html              app shell, tabs, layout
├── styles.css              full styling (casino felt theme)
├── script.js               game logic + Supabase integration
├── config.js               ← paste your credentials here
├── supabase_schema.sql     run once in Supabase SQL editor
├── apple-touch-icon.png    iOS home screen icon
└── README.md
```

---

## How the algorithm works

After chips are converted to real money each player has a net amount — positive means they won, negative means they lost. The algorithm settles all debts in the fewest possible transactions:

```
1. Split players into WINNERS (net > 0) and LOSERS (net < 0)
2. Sort both lists largest first
3. Pair the biggest loser with the biggest winner
4. Transfer the smaller of the two amounts
5. Remove whoever is now settled, repeat until done
```

Seven players who'd normally need up to 21 transfers between them typically settle in 4–6.

---

## Resetting the database

**Wipe all data, keep the schema** (what the in-app Clear button does):
```sql
DELETE FROM sessions;
```

**Nuke everything and start fresh:**
```sql
DROP TABLE IF EXISTS player_stats    CASCADE;
DROP TABLE IF EXISTS transactions    CASCADE;
DROP TABLE IF EXISTS session_results CASCADE;
DROP TABLE IF EXISTS sessions        CASCADE;
```
Then re-run `supabase_schema.sql`.

---

<div align="center">

♠ &nbsp; ♥ &nbsp; ♣ &nbsp; ♦

*Built for the boys. May your river cards always be kind.*

</div>