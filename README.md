# Super Plumber Bros

A browser-based 2D platformer built with vanilla HTML5 Canvas and JavaScript, hosted on GitHub Pages with a Supabase backend for accounts, progress, and leaderboards.

## Play

Open `index.html` in a browser, or play the live version on GitHub Pages: **MARIOS-REMAKE**.

## Features

- **Platforming action** — run, jump, collect coins, and avoid enemies and hazards (spikes, crushers, turrets, lasers, charging enemies) across a growing set of levels.
- **Built-in levels + Level Editor** — build your own levels in the in-game editor (ground, platforms, moving/one-way/ice platforms, teleporters, switches & gates, bosses, decorations, towers built upward) and share them with a short code.
- **Community levels** — browse, play, and rate levels created by other players ("Workshop"), with a leaderboard of best completion times per level.
- **Personalization / Shop** — unlock and equip skins, hats (with separate colors and styles), facial hair, skin tones, glasses, and trail effects, either by purchasing with in-game coins or by reaching a player level.
- **Quests & Achievements** — daily quests, permanent milestone quests, and a full achievements list that grant XP and coins.
- **Player progression** — an XP-based player level with a prestige system for players who reach the level cap.
- **Multiplayer** — play levels together with other connected players in real time.
- **Global leaderboard & stats** — track coins, playtime, deaths, enemies/bosses defeated, levels created, and more, sortable by category.
- **Accounts via Google sign-in** — progress is saved to your account (Supabase) and can be exported/imported as a signed save file.
- **Localization** — UI available in Polish and English.
- **Responsive HUD** — scales up automatically on large/4K displays.

## Tech stack

- **Frontend:** plain HTML5 Canvas + JavaScript (no build step, no frameworks)
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security) for profiles, custom levels, speedrun times, and the shop catalog
- **Hosting:** GitHub Pages

## Project structure

```
index.html          Main page, markup for all screens (menu, game, editor, shop, stats, ranking...)
css/styles.css       All styling, including the responsive HUD
js/
  game.js            Core game loop, physics, collisions
  render.js          Canvas rendering
  editor.js          Level editor
  levels.js          Built-in level definitions
  screens.js         Screen/menu navigation, ranking, stats rendering
  shop.js            Shop, personalization, purchases
  quests.js          Daily/permanent quests, achievements, XP & leveling
  character.js        Player character logic
  net.js             Supabase client, multiplayer networking
  profile.js         Loading/saving the player profile
  data.js            Static game data (shop items, prices, level requirements)
  audio.js           Sound effects & music
  flags.js           Feature flags / runtime flags
  loop.js            Main animation loop
  i18n.js            Translation dictionary & DOM text-node translator (PL ⇄ EN)
```

## Anti-cheat

Player progress (coins, XP, player level, owned cosmetic items, speedrun times) is validated **server-side** in Supabase using Postgres triggers and Row Level Security, not just trusted from the client:

- Coin and XP gains are rate-limited with a regenerating "budget" so a modified client can't grant itself unlimited currency or instantly max out its level.
- Stats that should only ever increase (coins earned, deaths, enemies killed, etc.) can't be decreased.
- Shop purchases are checked against a server-side price list; unlocking an item without paying (or without reaching the required level) is rejected.
- Speedrun times must be plausible and can only be improved, never faked upward or downward arbitrarily.
- Save export/import is cryptographically signed (HMAC) so an exported save file can't be hand-edited and re-imported.
- Editing official/built-in levels is restricted to the project admin account, enforced by a database policy (not just a client-side check).

## Credits

Built and maintained by tymurr427.
