// Zadania (dzienne + stale), XP, poziom gracza z nagrodami i osiagniecia.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
// Postep zapisuje sie w profilu (kolumna quest_data, jsonb); goscie maja postep tylko do konca sesji.
// Nagrody za poziomy to MONETY - przechodza przez trigger anty-cheat jak kazde inne monety.
// Tlumaczenia nazw (zadania, osiagniecia, tytuly) rejestrujemy tu przez I18N.addDict.

  // ---------- KONFIG ----------
  const XP_MAX_LEVEL = 100;
  const DAILY_COUNT = 5;
  const DAILY_BONUS_XP = 50;
  // UWAGA: krzywa XP jest powielona w SQL (spb_level_from_xp w supabase-anticheat-v3.sql) - zmieniasz tu, zmien tam.
  const xpNeed = lvl => Math.round(95 + 3.2 * (lvl - 1) + 0.055 * (lvl - 1) * (lvl - 1)); // XP z poziomu lvl na lvl+1 (do 100 lvl ~42 tys. XP, start podobny jak dawniej, koniec wyraźnie dłuższy)
  const TOTAL_XP_TO_100 = 42444;              // suma xpNeed(1..99) - staly punkt startowy prestizu (NIE przeliczac dynamicznie, zeby stary postep w prestizu sie nie przesunal przy kolejnej zmianie krzywej)
  const PRESTIGE_XP = 50000;                   // ile XP (POWYZEJ lvl 100) kosztuje jedna gwiazdka prestizu - celowo duzo, to dlugi cel koncowy
  // prestiz: NIE resetuje poziomu/xp (zeby nie psuc ekonomii/zapisu) - to czysto pochodna wartosc z xp, wiec zero zmian w Supabase.
  const levelReward = lvl => 20 + 2 * lvl + (lvl % 5 === 0 ? 50 : 0);   // monety za osiagniecie poziomu (maks. 270)
  const PLAYER_TITLES = [   // [od poziomu, PL, EN]
    [1, 'Nowicjusz', 'Novice'], [5, 'Adept', 'Apprentice'], [10, 'Wędrowiec', 'Wanderer'],
    [20, 'Poszukiwacz przygód', 'Adventurer'], [30, 'Ekspert', 'Expert'], [40, 'Weteran', 'Veteran'],
    [50, 'Mistrz', 'Master'], [60, 'Arcymistrz', 'Grandmaster'], [70, 'Czempion', 'Champion'],
    [80, 'Bohater', 'Hero'], [90, 'Legenda', 'Legend'], [100, 'Nieśmiertelny', 'Immortal'],
  ];
  // przedmioty nagrodowe (pola lvl w data.js): poziom -> lista [{kind, id, name, en, icon}]
  const LEVEL_ITEMS = {};
  [['skin', SKINS, '👕'], ['hat', HATS, '🎨'], ['style', HAT_STYLES, '🎩']].forEach(([kind, list, icon]) => {
    list.forEach(it => { if(it.lvl) (LEVEL_ITEMS[it.lvl] = LEVEL_ITEMS[it.lvl] || []).push({ kind, id:it.id, name:it.name, en:it.en, icon }); });
  });
  function grantLevelItem(it){
    const arr = it.kind === 'skin' ? state.ownedSkins : it.kind === 'hat' ? state.ownedHats : state.ownedHatStyles;
    if(!arr.includes(it.id)) arr.push(it.id);
  }
  function titleForLevel(lvl){
    let t = PLAYER_TITLES[0];
    PLAYER_TITLES.forEach(x => { if(lvl >= x[0]) t = x; });
    return t[1];
  }

  // ---------- ZADANIA DZIENNE (5 dziennie, losowane deterministycznie z daty) ----------
  const DAILY_GROUPS = [
    { ev:'coin',    icon:'🪙', fmt:'',    tiers:[{t:30,xp:20},{t:80,xp:40}],   pl:n=>`Zbierz ${n} monet`,             en:n=>`Collect ${n} coins` },
    { ev:'kill',    icon:'👾', fmt:'',    tiers:[{t:5,xp:20},{t:15,xp:40}],    pl:n=>`Pokonaj ${n} wrogów`,           en:n=>`Defeat ${n} enemies` },
    { ev:'win',     icon:'🏁', fmt:'',    tiers:[{t:1,xp:25},{t:3,xp:60}],     pl:n=>n===1?'Ukończ 1 poziom':`Ukończ ${n} poziomy`, en:n=>n===1?'Complete 1 level':`Complete ${n} levels` },
    { ev:'playSec', icon:'⏱', fmt:'min', tiers:[{t:300,xp:20},{t:900,xp:45}], pl:n=>`Graj przez ${n/60} min`,         en:n=>`Play for ${n/60} min` },
    { ev:'jump',    icon:'🦘', fmt:'',    tiers:[{t:50,xp:15},{t:150,xp:30}],  pl:n=>`Skocz ${n} razy`,              en:n=>`Jump ${n} times` },
    { ev:'runSec',  icon:'💨', fmt:'s',   tiers:[{t:30,xp:20},{t:90,xp:40}],   pl:n=>`Biegaj (Shift) przez ${n} s`,   en:n=>`Run (hold Shift) for ${n} s` },
    { ev:'boss',    icon:'👹', fmt:'',    tiers:[{t:1,xp:40},{t:2,xp:90}],     pl:n=>n===1?'Pokonaj 1 bossa':`Pokonaj ${n} bossów`, en:n=>n===1?'Defeat 1 boss':`Defeat ${n} bosses` },
    { ev:'noHit',   icon:'🛡', fmt:'',    tiers:[{t:1,xp:30},{t:2,xp:70}],     pl:n=>n===1?'Ukończ poziom bez obrażeń':`Ukończ ${n} poziomy bez obrażeń`, en:n=>n===1?'Finish a level without taking damage':`Finish ${n} levels without taking damage` },
    { ev:'death',       icon:'💀', fmt:'', tiers:[{t:2,xp:15},{t:5,xp:35}],   pl:n=>`Zgiń ${n} razy`,                          en:n=>`Die ${n} times` },
    { ev:'bounce',      icon:'🔵', fmt:'', tiers:[{t:5,xp:15},{t:15,xp:35}],  pl:n=>`Odbij się na trampolinie ${n} razy`,      en:n=>`Bounce on a trampoline ${n} times` },
    { ev:'teleport',    icon:'🌀', fmt:'', tiers:[{t:2,xp:15},{t:6,xp:35}],   pl:n=>`Użyj teleportu ${n} razy`,                en:n=>`Use a teleporter ${n} times` },
    { ev:'checkpoint',  icon:'📍', fmt:'', tiers:[{t:1,xp:15},{t:3,xp:35}],   pl:n=>`Dotrzyj do checkpointu ${n} razy`,        en:n=>`Reach a checkpoint ${n} times` },
    { ev:'buy',         icon:'🛒', fmt:'', tiers:[{t:1,xp:20},{t:3,xp:50}],   pl:n=>`Kup ${n} przedmiotów w sklepie`,          en:n=>`Buy ${n} items in the shop` },
    { ev:'shield',      icon:'🔷', fmt:'', tiers:[{t:1,xp:15},{t:3,xp:40}],   pl:n=>`Użyj tarczy (Q) ${n} razy`,               en:n=>`Use the shield (Q) ${n} times` },
    { ev:'attempt',     icon:'🔁', fmt:'', tiers:[{t:3,xp:15},{t:8,xp:35}],   pl:n=>`Rozegraj ${n} podejść do poziomu`,        en:n=>`Play ${n} level attempts` },
    { ev:'createLevel', icon:'🛠️', fmt:'', tiers:[{t:1,xp:30},{t:2,xp:65}],   pl:n=>n===1?'Stwórz i zapisz własny poziom':`Stwórz i zapisz ${n} własne poziomy`, en:n=>n===1?'Create and save a custom level':`Create and save ${n} custom levels` },
    { ev:'visitShop',     icon:'🏪', fmt:'', tiers:[{t:1,xp:10},{t:2,xp:20}], pl:n=>`Odwiedź sklep ${n} razy`,                 en:n=>`Visit the shop ${n} times` },
    { ev:'visitRanking',  icon:'📊', fmt:'', tiers:[{t:1,xp:10},{t:2,xp:20}], pl:n=>`Sprawdź ranking ${n} razy`,               en:n=>`Check the ranking ${n} times` },
    { ev:'visitStats',    icon:'📈', fmt:'', tiers:[{t:1,xp:10},{t:2,xp:20}], pl:n=>`Sprawdź statystyki ${n} razy`,            en:n=>`Check your stats ${n} times` },
    { ev:'visitEditor',   icon:'✏️', fmt:'', tiers:[{t:1,xp:10},{t:2,xp:20}], pl:n=>`Otwórz edytor poziomów ${n} razy`,        en:n=>`Open the level editor ${n} times` },
    { ev:'visitMyLevels', icon:'📁', fmt:'', tiers:[{t:1,xp:10},{t:2,xp:20}], pl:n=>`Otwórz "Moje poziomy" ${n} razy`,         en:n=>`Open "My levels" ${n} times` },
    { ev:'bossNoHit',   icon:'🐲', fmt:'', tiers:[{t:1,xp:45},{t:2,xp:100}],  pl:n=>n===1?'Pokonaj bossa bez obrażeń':`Pokonaj ${n} bossów bez obrażeń`, en:n=>n===1?'Defeat a boss without taking damage':`Defeat ${n} bosses without taking damage` },
    { ev:'fastFinish',  icon:'⚡', fmt:'', tiers:[{t:1,xp:25},{t:2,xp:55}],   pl:n=>n===1?'Ukończ poziom w mniej niż 20 s':`Ukończ ${n} poziomy w mniej niż 20 s każdy`, en:n=>n===1?'Finish a level in under 20s':`Finish ${n} levels in under 20s each` },
  ];

  function hashStr(s){ let h = 2166136261 >>> 0; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function dailySetFor(day){
    const rnd = mulberry32(hashStr('spb-daily-' + day));
    const idx = DAILY_GROUPS.map((g, i) => i);
    for(let i = idx.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
    return idx.slice(0, DAILY_COUNT).sort((a, b) => a - b).map(gi => {
      const g = DAILY_GROUPS[gi], ti = rnd() < 0.5 ? 0 : 1, tier = g.tiers[ti];
      return { id:'d_' + g.ev + '_' + ti, ev:g.ev, icon:g.icon, fmt:g.fmt, target:tier.t, xp:tier.xp, pl:g.pl(tier.t) };
    });
  }
  function todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  let dailyCacheDay = '', dailyCache = [];
  function dailySet(){
    const day = todayKey();
    if(day !== dailyCacheDay){ dailyCacheDay = day; dailyCache = dailySetFor(day); }
    return dailyCache;
  }

  // ---------- ZADANIA STALE ----------
  const PERM_QUESTS = [];
  function permDef(cat, icon, fmt, tiers, get, plf, enf){
    tiers.forEach(([t, xp]) => PERM_QUESTS.push({ id:cat + '_' + t, cat, icon, fmt, target:t, xp, get, pl:plf(t), en:enf(t) }));
  }
  permDef('coins',  '🪙', '',  [[100,30],[500,60],[2000,120],[10000,250]], () => state.totalCoinsEarned, n=>`Zarób łącznie ${n} monet`, n=>`Earn ${n} coins in total`);
  permDef('kills',  '👾', '',  [[10,30],[50,60],[200,120],[1000,250]],     () => state.enemiesKilled,   n=>`Pokonaj łącznie ${n} wrogów`, n=>`Defeat ${n} enemies in total`);
  permDef('bosses', '👹', '',  [[1,50],[5,120],[15,250]],                  () => state.bossesKilled,    n=>n===1?'Pokonaj bossa':`Pokonaj ${n} bossów`, n=>n===1?'Defeat a boss':`Defeat ${n} bosses`);
  permDef('reach',  '🗺️', '',  [[5,40],[10,80],[15,150],[19,300]],         () => Math.min(totalLevels(), state.unlockedLevel + 1), n=>`Dotrzyj do poziomu ${n}`, n=>`Reach level ${n}`);
  permDef('beat',   '🏆', '',  [[1,400]],                                  () => state.quests.c.beatGame, () => 'Ukończ wszystkie poziomy', () => 'Finish all levels');
  permDef('time',   '⏳', 'h', [[3600,60],[18000,150],[72000,700]],        () => state.playtimeSeconds, n=>`Graj łącznie ${n/3600} h`, n=>`Play for ${n/3600} h in total`);
  permDef('spent',  '🛒', '',  [[100,30],[500,80],[2000,200]],             () => state.totalSpent,      n=>`Wydaj ${n} monet w sklepie`, n=>`Spend ${n} coins in the shop`);
  permDef('skins',  '👕', '',  [[5,40],[15,100],[SKINS.length,250]],       () => state.ownedSkins.length, n=>`Posiadaj ${n} skinów`, n=>`Own ${n} skins`);
  permDef('daily',  '📅', '',  [[10,50],[50,150],[100,300]],               () => state.quests.c.dailyClaimed, n=>`Wykonaj ${n} zadań dziennych`, n=>`Complete ${n} daily quests`);
  permDef('jumps',  '🦘', '',  [[100,20],[1000,60],[5000,350]],            () => state.quests.c.jumps,  n=>`Skocz łącznie ${n} razy`, n=>`Jump ${n} times in total`);
  permDef('run',    '💨', '',  [[60,20],[600,60],[3600,150]],              () => state.quests.c.runSec, n=>`Biegaj łącznie ${n} s`, n=>`Run for ${n} s in total`);
  permDef('nohit',  '🛡',  '',  [[5,50],[20,120],[50,250]],                 () => state.quests.c.noHitWins, n=>`Ukończ ${n} poziomów bez obrażeń`, n=>`Finish ${n} levels without damage`);
  permDef('trails', '🚩', '',  [[5,40],[15,100],[TRAILS.length,250]],      () => state.ownedTrails.length,     n=>`Posiadaj ${n} flag`, n=>`Own ${n} flags`);
  permDef('hats',   '🎩', '',  [[5,30],[15,80],[HATS.length,200]],         () => state.ownedHats.length,       n=>`Posiadaj ${n} kolorów czapki`, n=>`Own ${n} hat colors`);
  permDef('facial', '🧔', '',  [[3,30],[8,80],[FACIAL_HAIR.length,200]],   () => state.ownedFacialHair.length, n=>`Posiadaj ${n} rodzajów zarostu`, n=>`Own ${n} facial hair styles`);
  permDef('glasses',    '👓', '', [[3,30],[GLASSES.length,100]],              () => state.ownedGlasses.length,        n=>`Posiadaj ${n} par okularów`, n=>`Own ${n} pairs of glasses`);
  permDef('bounce',     '🔵', '', [[50,30],[300,80],[1000,450]],              () => state.quests.c.bounces,            n=>`Odbij się na trampolinie ${n} razy łącznie`, n=>`Bounce on a trampoline ${n} times in total`);
  permDef('teleport',   '🌀', '', [[20,30],[100,80],[150,200]],               () => state.quests.c.teleports,          n=>`Użyj teleportu ${n} razy łącznie`, n=>`Use a teleporter ${n} times in total`);
  permDef('checkpoint', '📍', '', [[20,30],[100,80],[200,400]],               () => state.quests.c.checkpoints,        n=>`Dotrzyj do checkpointu ${n} razy łącznie`, n=>`Reach a checkpoint ${n} times in total`);
  permDef('buy',        '🛒', '', [[10,30],[50,100],[150,250]],               () => state.quests.c.buys,               n=>`Kup ${n} przedmiotów w sklepie łącznie`, n=>`Buy ${n} items in the shop in total`);
  permDef('shieldUse',  '🔷', '', [[5,30],[20,120],[40,350]],                 () => state.quests.c.shieldUses,         n=>`Użyj tarczy (Q) ${n} razy łącznie`, n=>`Use the shield (Q) ${n} times in total`);
  permDef('attempts',   '🔁', '', [[100,30],[500,100],[2000,550]],            () => state.quests.c.attempts,           n=>`Rozegraj ${n} podejść do poziomów łącznie`, n=>`Play ${n} level attempts in total`);
  permDef('createLvl',  '🛠️', '', [[1,30],[5,100],[20,250]],                  () => state.quests.c.levelsCreated,      n=>n===1?'Stwórz i zapisz własny poziom':`Stwórz i zapisz ${n} własnych poziomów`, n=>n===1?'Create and save a custom level':`Create and save ${n} custom levels`);
  permDef('bossClean',  '🥇', '', [[1,60],[5,170],[15,350]],                  () => state.quests.c.bossNoHitWins,      n=>n===1?'Pokonaj bossa bez obrażeń':`Pokonaj ${n} bossów bez obrażeń`, n=>n===1?'Defeat a boss without damage':`Defeat ${n} bosses without damage`);
  permDef('fastFin',    '⚡', '', [[10,60],[50,170],[150,350]],               () => state.quests.c.fastFinishes,       n=>`Ukończ ${n} poziomów w mniej niż 20 s łącznie`, n=>`Finish ${n} levels in under 20s in total`);
  permDef('deaths',     '💀', '', [[10,20],[50,60],[200,150]],                () => state.deathCount,                  n=>`Zgiń łącznie ${n} razy`, n=>`Die ${n} times in total`);
  permDef('achCount',   '🏅', '', [[10,50],[25,150],[49,400]],                () => Object.keys(state.quests.ach).length, n=>`Odblokuj ${n} osiągnięć`, n=>`Unlock ${n} achievements`);

  // ---------- OSIAGNIECIA (odblokowuja sie same) ----------
  const ACHIEVEMENTS = [];
  function ach(id, icon, pl, en, dpl, den, t, get, xp){ ACHIEVEMENTS.push({ id, icon, pl, en, dpl, den, t, get, xp: xp || 20 }); }
  const lvlReached = () => Math.min(totalLevels(), state.unlockedLevel + 1);
  ach('first_win',   '🏁', 'Pierwsze kroki',   'First Steps',   'Ukończ swój pierwszy poziom',            'Complete your first level',        1,     () => Math.max(state.unlockedLevel, state.quests.c.levelsCompleted), 20);
  ach('coins_100',   '🪙', 'Kieszonkowe',      'Pocket Money',  'Zarób łącznie 100 monet',                'Earn 100 coins in total',          100,   () => state.totalCoinsEarned, 20);
  ach('coins_1000',  '💰', 'Skarbnik',         'Treasurer',     'Zarób łącznie 1000 monet',               'Earn 1000 coins in total',         1000,  () => state.totalCoinsEarned, 60);
  ach('coins_10000', '🏦', 'Bogacz',           'Tycoon',        'Zarób łącznie 10000 monet',              'Earn 10000 coins in total',        10000, () => state.totalCoinsEarned, 320);
  ach('kill_1',      '👟', 'Pierwsze zdeptanie','First Stomp',  'Pokonaj pierwszego wroga',               'Defeat your first enemy',          1,     () => state.enemiesKilled, 20);
  ach('kill_100',    '⚔️', 'Pogromca',         'Slayer',        'Pokonaj 100 wrogów',                     'Defeat 100 enemies',               100,   () => state.enemiesKilled, 50);
  ach('kill_500',    '☠️', 'Postrach królestwa','Terror of the Kingdom', 'Pokonaj 500 wrogów',           'Defeat 500 enemies',               500,   () => state.enemiesKilled, 130);
  ach('boss_1',      '👹', 'Pogromca bossa',   'Boss Slayer',   'Pokonaj pierwszego bossa',               'Defeat your first boss',           1,     () => state.bossesKilled, 35);
  ach('boss_10',     '🐉', 'Łowca tytanów',    'Titan Hunter',  'Pokonaj 10 bossów',                      'Defeat 10 bosses',                 10,    () => state.bossesKilled, 260);
  ach('reach_10',    '🗺️', 'Podróżnik',        'Traveler',      'Dotrzyj do poziomu 10',                  'Reach level 10',                   10,    lvlReached, 50);
  ach('beat_game',   '🏆', 'Mistrz Plumber',   'Plumber Master','Ukończ wszystkie poziomy',               'Finish all levels',                1,     () => state.quests.c.beatGame, 300);
  ach('shop_first',  '🛍️', 'Pierwsze zakupy',  'First Purchase','Wydaj monety w sklepie',                 'Spend coins in the shop',          1,     () => state.totalSpent, 15);
  ach('skins_5',     '👕', 'Modniś',           'Fashionista',   'Posiadaj 5 skinów',                      'Own 5 skins',                      5,     () => state.ownedSkins.length, 25);
  ach('skins_all',   '👑', 'Kolekcjoner',      'Collector',     'Zdobądź wszystkie skiny',                'Get every skin',                   SKINS.length, () => state.ownedSkins.length, 280);
  ach('stylist',     '🎩', 'Stylista',         'Stylist',       'Kup fason czapki, zarost i trail',       'Buy a hat style, facial hair and a trail', 3,
      () => (state.ownedHatStyles.length > 1 ? 1 : 0) + (state.ownedFacialHair.length > 1 ? 1 : 0) + (state.ownedTrails.length > 1 ? 1 : 0), 45);
  ach('deaths_10',   '💀', 'Upór',             'Persistence',   'Zgiń 10 razy',                           'Die 10 times',                     10,    () => state.deathCount, 15);
  ach('deaths_50',   '🪦', 'Nie poddaję się',  'Never Give Up', 'Zgiń 50 razy',                           'Die 50 times',                     50,    () => state.deathCount, 30);
  ach('time_1h',     '⏰', 'Wciągnęło',        'Hooked',        'Graj łącznie 1 godzinę',                 'Play for 1 hour in total',         3600,  () => state.playtimeSeconds, 150);
  ach('time_10h',    '🕰️', 'Bez reszty',       'All In',        'Graj łącznie 10 godzin',                 'Play for 10 hours in total',       36000, () => state.playtimeSeconds, 450);
  ach('jumps_1000',  '🦘', 'Skoczek',          'Jumper',        'Skocz 1000 razy',                        'Jump 1000 times',                  1000,  () => state.quests.c.jumps, 130);
  ach('run_600',     '💨', 'Sprinter',         'Sprinter',      'Biegaj łącznie 10 minut',                'Run for 10 minutes in total',      600,   () => state.quests.c.runSec, 45);
  ach('plv_5',       '⭐', 'Pnący się',        'Climber',       'Osiągnij 5. poziom gracza',              'Reach player level 5',             5,     () => playerLevel(), 25);
  ach('plv_15',      '🌟', 'Doświadczony',     'Experienced',   'Osiągnij 15. poziom gracza',             'Reach player level 15',            15,    () => playerLevel(), 60);
  ach('plv_30',      '🔱', 'Ekspert',          'Expert',        'Osiągnij 30. poziom gracza',             'Reach player level 30',            30,    () => playerLevel(), 120);
  ach('plv_50',      '🎖️', 'Mistrz poziomów',  'Level Master',  'Osiągnij 50. poziom gracza',             'Reach player level 50',            50,    () => playerLevel(), 200);
  ach('plv_100',     '👑', 'Maksymalny poziom','Max Level',     'Osiągnij maksymalny poziom gracza (100)','Reach the maximum player level (100)', 100, () => playerLevel(), 400);
  ach('daily_all',   '📅', 'Perfekcjonista',   'Perfectionist', 'Wykonaj wszystkie 5 zadań dziennych jednego dnia', 'Complete all 5 daily quests in one day', 1, () => state.quests.c.dailyAllDone, 50);
  ach('quests_25',   '📋', 'Zadaniowiec',      'Taskmaster',    'Odbierz nagrodę za 25 zadań',            'Claim the reward for 25 quests',   25,    () => state.quests.c.questsClaimed, 70);
  ach('bounce_50',    '🔵', 'Trampolinowy mistrz', 'Trampoline Master', 'Odbij się na trampolinie 50 razy', 'Bounce on a trampoline 50 times', 50,  () => state.quests.c.bounces, 40);
  ach('teleport_20',  '🌀', 'Mistrz teleportacji', 'Teleport Master',   'Użyj teleportu 20 razy',           'Use a teleporter 20 times',       20,  () => state.quests.c.teleports, 40);
  ach('checkpoint_20','📍', 'Checkpointowicz',     'Checkpoint Hunter','Dotrzyj do checkpointu 20 razy',   'Reach a checkpoint 20 times',     20,  () => state.quests.c.checkpoints, 40);
  ach('buy_10',        '🛒', 'Stały klient',       'Regular Customer', 'Kup 10 przedmiotów w sklepie',     'Buy 10 items in the shop',        10,  () => state.quests.c.buys, 40);
  ach('buy_30',        '💳', 'Hazardzista zakupowy','Shopaholic',       'Kup 30 przedmiotów w sklepie',     'Buy 30 items in the shop',        30,  () => state.quests.c.buys, 100);
  ach('shield_10',     '🔷', 'Obrońca',            'Defender',          'Użyj tarczy (Q) 10 razy',          'Use the shield (Q) 10 times',     10,  () => state.quests.c.shieldUses, 40);
  ach('attempts_100',  '🔁', 'Wytrwały',           'Persistent',        'Rozegraj 100 podejść do poziomu',  'Play 100 level attempts',         100, () => state.quests.c.attempts, 70);
  ach('attempts_500',  '🔂', 'Niezłomny',          'Unyielding',        'Rozegraj 500 podejść do poziomu',  'Play 500 level attempts',         500, () => state.quests.c.attempts, 420);
  ach('createLevel_1', '🛠️', 'Twórca',             'Creator',           'Stwórz i zapisz własny poziom',    'Create and save a custom level',  1,   () => state.quests.c.levelsCreated, 35);
  ach('createLevel_10','🏗️', 'Architekt poziomów', 'Level Architect',   'Stwórz i zapisz 10 własnych poziomów', 'Create and save 10 custom levels', 10, () => state.quests.c.levelsCreated, 150);
  ach('bossNoHit_1',   '🐲', 'Czysta walka',       'Flawless Fight',    'Pokonaj bossa bez obrażeń',        'Defeat a boss without damage',    1,   () => state.quests.c.bossNoHitWins, 60);
  ach('bossNoHit_5',   '🥇', 'Perfekcyjny pogromca','Flawless Slayer',  'Pokonaj 5 bossów bez obrażeń',     'Defeat 5 bosses without damage',  5,   () => state.quests.c.bossNoHitWins, 300);
  ach('fastFinish_10', '⚡', 'Błyskawica',         'Lightning Fast',    'Ukończ 10 poziomów w mniej niż 20 s każdy', 'Finish 10 levels in under 20s each', 10, () => state.quests.c.fastFinishes, 90);
  ach('flags_10',      '🚩', 'Kolekcjoner flag',   'Flag Collector',    'Posiadaj 10 flag',                 'Own 10 flags',                    10,  () => state.ownedTrails.length, 60);
  ach('flags_all',     '🌍', 'Globtroter',         'Globetrotter',      'Zdobądź wszystkie flagi',          'Get every flag',                  TRAILS.length, () => state.ownedTrails.length, 320);
  ach('hats_all',      '🎩', 'Fryzjer',            'Hatter',            'Zdobądź wszystkie kolory czapki',  'Get every hat color',             HATS.length, () => state.ownedHats.length, 280);
  ach('facial_all',    '🧔', 'Brodacz',            'Bearded',           'Zdobądź wszystkie rodzaje zarostu','Get every facial hair style',     FACIAL_HAIR.length, () => state.ownedFacialHair.length, 150);
  ach('explorer',      '🧭', 'Odkrywca menu',      'Menu Explorer',     'Odwiedź sklep, ranking, statystyki, edytor i moje poziomy', 'Visit the shop, ranking, stats, editor and my levels', 5,
      () => (state.quests.c.visitShop>0?1:0) + (state.quests.c.visitRanking>0?1:0) + (state.quests.c.visitStats>0?1:0) + (state.quests.c.visitEditor>0?1:0) + (state.quests.c.visitMyLevels>0?1:0), 40);
  ach('coins_50000',   '💎', 'Milioner w drodze',  'On the Way to Millions', 'Zarób łącznie 50000 monet',   'Earn 50000 coins in total',       50000, () => state.totalCoinsEarned, 900);
  ach('kills_2000',    '🗡️', 'Legenda rzezi',      'Legend of Slaughter','Pokonaj 2000 wrogów',             'Defeat 2000 enemies',             2000, () => state.enemiesKilled, 480);
  ach('deaths_200',    '♻️', 'Reinkarnacja',       'Reincarnation',     'Zgiń 200 razy',                    'Die 200 times',                   200, () => state.deathCount, 60);

  // ---------- DANE ----------
  function defaultQuests(){
    return { xp:0, day:'', daily:{ prog:{}, claimed:{}, bonus:false }, permClaimed:{}, lvlClaimed:{}, ach:{}, achXp:{},
             c:{ levelsCompleted:0, beatGame:0, jumps:0, runSec:0, dailyAllDone:0, dailyClaimed:0, questsClaimed:0, noHitWins:0,
                 bounces:0, teleports:0, checkpoints:0, buys:0, shieldUses:0, attempts:0, levelsCreated:0, bossNoHitWins:0, fastFinishes:0,
                 visitShop:0, visitRanking:0, visitStats:0, visitEditor:0, visitMyLevels:0 } };
  }
  function normalizeQuests(raw){
    const d = defaultQuests();
    if(!raw || typeof raw !== 'object') return d;
    d.xp = Math.min(1e6, Math.max(0, Math.floor(Number(raw.xp) || 0)));
    d.day = String(raw.day || '');
    if(raw.daily && typeof raw.daily === 'object'){
      d.daily.prog = Object.assign({}, raw.daily.prog);
      d.daily.claimed = Object.assign({}, raw.daily.claimed);
      d.daily.bonus = !!raw.daily.bonus;
    }
    ['permClaimed', 'lvlClaimed', 'ach', 'achXp'].forEach(k => { if(raw[k] && typeof raw[k] === 'object') d[k] = Object.assign({}, raw[k]); });
    if(raw.c && typeof raw.c === 'object') Object.keys(d.c).forEach(k => { d.c[k] = Math.max(0, Math.floor(Number(raw.c[k]) || 0)); });
    return d;
  }
  state.quests = defaultQuests();

  function ensureToday(){
    const q = state.quests, t = todayKey();
    if(q.day !== t){ q.day = t; q.daily = { prog:{}, claimed:{}, bonus:false }; }
  }

  // ---------- XP / POZIOM ----------
  function levelInfo(xp){
    let lvl = 1, rem = xp;
    while(lvl < XP_MAX_LEVEL && rem >= xpNeed(lvl)){ rem -= xpNeed(lvl); lvl++; }
    const max = lvl >= XP_MAX_LEVEL;
    return { lvl, cur: max ? 0 : rem, need: max ? 0 : xpNeed(lvl), max };
  }
  function playerLevel(){ return levelInfo(state.quests.xp).lvl; }

  // ---------- PRESTIZ (po lvl 100) ----------
  function prestigeInfo(xp){
    const over = Math.max(0, xp - TOTAL_XP_TO_100);
    const stars = Math.floor(over / PRESTIGE_XP);
    return { stars, cur: over - stars * PRESTIGE_XP, need: PRESTIGE_XP };
  }
  function playerPrestige(){ return prestigeInfo(state.quests.xp).stars; }
  function prestigeBadge(stars){ return stars > 0 ? ' ' + '★'.repeat(Math.min(stars, 3)) + (stars > 3 ? '×' + stars : '') : ''; }

  function addXp(n){
    const before = playerLevel(), beforeStars = playerPrestige();
    state.quests.xp += n;
    const after = playerLevel(), afterStars = playerPrestige();
    if(after > before) questToast('⭐', 'Nowy poziom gracza!', 'LV ' + after);
    if(afterStars > beforeStars) questToast('★', 'Gwiazdka prestiżu!', prestigeBadge(afterStars).trim());
  }

  // ---------- ZDARZENIA Z GRY ----------
  let achDirty = true;
  function questEvent(ev, n){
    n = n || 1;
    ensureToday();
    const q = state.quests;
    if(ev === 'jump') q.c.jumps += n;
    else if(ev === 'runSec') q.c.runSec += n;
    else if(ev === 'win') q.c.levelsCompleted += n;
    else if(ev === 'noHit') q.c.noHitWins += n;
    else if(ev === 'bounce') q.c.bounces += n;
    else if(ev === 'teleport') q.c.teleports += n;
    else if(ev === 'checkpoint') q.c.checkpoints += n;
    else if(ev === 'buy') q.c.buys += n;
    else if(ev === 'shield') q.c.shieldUses += n;
    else if(ev === 'attempt') q.c.attempts += n;
    else if(ev === 'createLevel') q.c.levelsCreated += n;
    else if(ev === 'bossNoHit') q.c.bossNoHitWins += n;
    else if(ev === 'fastFinish') q.c.fastFinishes += n;
    else if(ev === 'visitShop') q.c.visitShop += n;
    else if(ev === 'visitRanking') q.c.visitRanking += n;
    else if(ev === 'visitStats') q.c.visitStats += n;
    else if(ev === 'visitEditor') q.c.visitEditor += n;
    else if(ev === 'visitMyLevels') q.c.visitMyLevels += n;
    dailySet().forEach(d => {
      if(d.ev === ev) q.daily.prog[d.id] = Math.min(d.target, (q.daily.prog[d.id] || 0) + n);
    });
    achDirty = true;
  }

  // licznik czasu gry i biegu (co sekunde, tylko w aktywnej rozgrywce) + sprawdzanie osiagniec
  setInterval(() => {
    if(gamePlaying && !levelDone){
      questEvent('playSec', 1);
      if((keys.ShiftLeft || keys.ShiftRight) && player && Math.abs(player.vx) > 1) questEvent('runSec', 1);
    }
    if(achDirty){ achDirty = false; checkAchievements(false); updateCorner(); }
  }, 1000);

  // ---------- OSIAGNIECIA ----------
  function achValue(a){ try { return Number(a.get()) || 0; } catch(e){ return 0; } }
  function checkAchievements(silent){
    const q = state.quests;
    let changed = false;
    const toToast = [];
    ACHIEVEMENTS.forEach(a => {
      if(!q.ach[a.id] && achValue(a) >= a.t){
        q.ach[a.id] = Date.now();
        changed = true;
        if(!silent) toToast.push(a);
      }
      // wyplaca XP za kazde odblokowane osiagniecie, ktore go jeszcze nie dostalo
      // (obejmuje tez stare osiagniecia zdobyte przed wprowadzeniem XP za osiagniecia)
      if(q.ach[a.id] && !q.achXp[a.id]){
        q.achXp[a.id] = true;
        addXp(a.xp);
        changed = true;
      }
    });
    toToast.forEach(a => questToast(a.icon, 'Osiągnięcie odblokowane! (+' + a.xp + ' XP)', a.pl));
    if(changed) saveProfile();
    return changed;
  }
  function questsAfterLoad(){
    ensureToday();
    checkAchievements(true);   // wsteczne odblokowanie bez wyskakujacych powiadomien
    updateCorner();
  }

  // ---------- ODBIERANIE ----------
  function permProgress(d){ return Math.min(d.target, Number(d.get()) || 0); }
  function claimDaily(id){
    ensureToday();
    const q = state.quests, d = dailySet().find(x => x.id === id);
    if(!d || q.daily.claimed[id] || (q.daily.prog[id] || 0) < d.target) return;
    q.daily.claimed[id] = true;
    q.c.dailyClaimed++; q.c.questsClaimed++;
    addXp(d.xp);
    if(!q.daily.bonus && dailySet().every(x => q.daily.claimed[x.id])){
      q.daily.bonus = true; q.c.dailyAllDone++;
      addXp(DAILY_BONUS_XP);
      questToast('🎉', 'Bonus dzienny!', 'Wszystkie zadania dzienne wykonane');
    }
    afterClaim();
  }
  function claimPerm(id){
    const q = state.quests, d = PERM_QUESTS.find(x => x.id === id);
    if(!d || q.permClaimed[id] || permProgress(d) < d.target) return;
    q.permClaimed[id] = true;
    q.c.questsClaimed++;
    addXp(d.xp);
    afterClaim();
  }
  function claimLevel(lvl){
    const q = state.quests;
    if(lvl < 2 || lvl > XP_MAX_LEVEL || lvl > playerLevel() || q.lvlClaimed[lvl]) return;
    const coins = levelReward(lvl);
    q.lvlClaimed[lvl] = true;
    state.wallet += coins;
    state.totalCoinsEarned += coins;
    document.getElementById('menuCoins').textContent = state.wallet;
    document.getElementById('shopCoins').textContent = state.wallet;
    questToast('🎁', 'Odebrano nagrodę!', '+' + coins + ' monet');
    (LEVEL_ITEMS[lvl] || []).forEach(it => { grantLevelItem(it); questToast(it.icon, 'Nowy przedmiot!', it.name); });
    afterClaim();
  }
  function afterClaim(){
    achDirty = true;
    checkAchievements(false);
    updateCorner();
    saveProfile();
    if(!lvlScreen.classList.contains('hidden')) renderLevelScreen();
  }

  function hasClaimable(){
    ensureToday();
    const q = state.quests;
    if(dailySet().some(d => !q.daily.claimed[d.id] && (q.daily.prog[d.id] || 0) >= d.target)) return true;
    if(PERM_QUESTS.some(d => !q.permClaimed[d.id] && permProgress(d) >= d.target)) return true;
    const pl = playerLevel();
    for(let l = 2; l <= pl; l++) if(!q.lvlClaimed[l]) return true;
    return false;
  }

  // ---------- POWIADOMIENIA ----------
  function questToast(icon, title, text){
    const stack = document.getElementById('toastStack');
    if(!stack) return;
    const el = document.createElement('div');
    el.className = 'q-toast';
    el.innerHTML = `<div class="q-toast-ico">${icon}</div><div><div class="q-toast-title">${escapeHtml(title)}</div><div class="q-toast-text">${escapeHtml(text)}</div></div>`;
    stack.appendChild(el);
    if(stack.children.length > 4) stack.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  // ---------- UI: ROG MENU ----------
  const achCorner = document.getElementById('achCorner');
  const lvlCorner = document.getElementById('lvlCorner');
  const lvlScreen = document.getElementById('lvlScreen');
  const achScreen = document.getElementById('achScreen');
  function updateCorner(){
    if(!achCorner) return;
    document.getElementById('achCornerChip').textContent = Object.keys(state.quests.ach).length + '/' + ACHIEVEMENTS.length;
    document.getElementById('lvlCornerChip').textContent = playerLevel();
    lvlCorner.classList.toggle('has-claim', hasClaimable());
  }
  let lvlTab = 'daily';
  achCorner.onclick = () => showScreen('achievements');
  lvlCorner.onclick = () => showScreen('lvl');
  document.getElementById('btnAchBack').onclick = () => showScreen('menu');
  document.getElementById('btnLvlBack').onclick = () => showScreen('menu');
  document.querySelectorAll('.q-tab-btn').forEach(b => {
    b.onclick = () => { lvlTab = b.dataset.tab; renderLevelScreen(); };
  });
  document.getElementById('qPanel').addEventListener('click', e => {
    const btn = e.target.closest('.q-claim');
    if(!btn) return;
    const kind = btn.dataset.kind, id = btn.dataset.id;
    if(kind === 'daily') claimDaily(id);
    else if(kind === 'perm') claimPerm(id);
    else if(kind === 'lvl') claimLevel(Number(id));
  });

  // ---------- UI: RENDER ----------
  function fmtVal(v, fmt){
    if(fmt === 'min') return Math.floor(v / 60);
    if(fmt === 'h') return (v / 3600).toFixed(v >= 3600 * 10 ? 0 : 1).replace(/\.0$/, '');
    return v;
  }
  function fmtTarget(t, fmt){
    if(fmt === 'min') return t / 60 + ' min';
    if(fmt === 'h') return t / 3600 + ' h';
    if(fmt === 's') return t + ' s';
    return String(t);
  }
  function guestNote(){
    const el = document.getElementById('qGuestNote');
    el.textContent = (sb && currentUser) ? '' : 'Zaloguj się przez Google, aby zapisywać postęp.';
  }
  function questRow(o){
    const pct = Math.round(Math.min(1, o.cur / o.target) * 100);
    const done = o.cur >= o.target;
    let right;
    if(o.claimed) right = '<span class="q-check">✅</span>';
    else if(done) right = `<button class="q-claim" data-kind="${o.kind}" data-id="${escapeHtml(o.id)}">ODBIERZ</button>`;
    else right = '<span class="q-lock"></span>';
    return `<div class="q-row ${o.claimed ? 'claimed' : (done ? 'ready' : '')}">
      <div class="q-ico">${o.icon}</div>
      <div class="q-mid"><div class="q-desc">${escapeHtml(o.pl)}</div><div class="q-bar"><i style="width:${pct}%"></i></div></div>
      <div class="q-num">${fmtVal(Math.min(o.cur, o.target), o.fmt)} / ${fmtTarget(o.target, o.fmt)}</div>
      <div class="q-xp">+${o.xp} XP</div>
      <div class="q-right">${right}</div>
    </div>`;
  }
  function renderHead(){
    const info = levelInfo(state.quests.xp);
    const pr = info.max ? prestigeInfo(state.quests.xp) : null;
    const pct = info.max ? Math.round(pr.cur / pr.need * 100) : Math.round(info.cur / info.need * 100);
    document.getElementById('qHead').innerHTML = `
      <div class="q-lvl-badge"><span class="q-lvl-label">POZIOM GRACZA</span><b>${info.lvl}${prestigeBadge(pr ? pr.stars : 0)}</b></div>
      <div class="q-head-mid">
        <div class="q-title-line"><span>Tytuł:</span> <b>${escapeHtml(titleForLevel(info.lvl))}</b></div>
        <div class="q-xpbar"><i style="width:${pct}%"></i></div>
        <div class="q-xp-line">${info.max
          ? `<span>PRESTIŻ ${pr.stars + 1}:</span> <b>${pr.cur} / ${pr.need}</b> <span class="q-dim">·</span> <span>Do kolejnej gwiazdki:</span> <b>${pr.need - pr.cur} XP</b>`
          : `<span>XP</span> <b>${info.cur} / ${info.need}</b> <span class="q-dim">·</span> <span>Do następnego poziomu:</span> <b>${info.need - info.cur} XP</b>`}</div>
      </div>`;
  }
  function renderDaily(){
    const q = state.quests;
    const rows = dailySet().map(d => ({ kind:'daily', id:d.id, icon:d.icon, pl:d.pl, fmt:d.fmt, target:d.target, xp:d.xp,
      cur:q.daily.prog[d.id] || 0, claimed:!!q.daily.claimed[d.id] }));
    rows.sort((a, b) => (a.claimed - b.claimed));
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.round((next - now) / 60000));
    const left = Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    const claimedAll = dailySet().every(d => q.daily.claimed[d.id]);
    return `<div class="q-info"><span>Nowe zadania za</span> <b>${left}</b></div>
      ${rows.map(questRow).join('')}
      <div class="q-row bonus ${q.daily.bonus ? 'claimed' : ''}"><div class="q-ico">🎉</div>
        <div class="q-mid"><div class="q-desc">Bonus za wszystkie 5 zadań dziennych</div></div>
        <div class="q-xp">+${DAILY_BONUS_XP} XP</div><div class="q-right">${claimedAll || q.daily.bonus ? '<span class="q-check">✅</span>' : '<span class="q-lock">🔒</span>'}</div></div>`;
  }
  function renderPerm(){
    const q = state.quests;
    const rows = PERM_QUESTS.map((d, i) => ({ kind:'perm', id:d.id, icon:d.icon, pl:d.pl, fmt:d.fmt, target:d.target, xp:d.xp,
      cur:Number(d.get()) || 0, claimed:!!q.permClaimed[d.id], i }));
    const rank = r => r.claimed ? 2 : ((r.cur >= r.target) ? 0 : 1);
    rows.sort((a, b) => rank(a) - rank(b) || a.i - b.i);
    return rows.map(questRow).join('');
  }
  function renderRewards(){
    const q = state.quests, pl = playerLevel();
    let html = '';
    for(let l = 1; l <= XP_MAX_LEVEL; l++){
      const t = PLAYER_TITLES.find(x => x[0] === l);
      const claimed = l === 1 || !!q.lvlClaimed[l], ready = !claimed && l <= pl;
      const right = claimed ? '<span class="q-check">✅</span>'
        : ready ? `<button class="q-claim" data-kind="lvl" data-id="${l}">ODBIERZ</button>` : '<span class="q-lock">🔒</span>';
      const reward = l === 1 ? '' : `<span class="q-rw-coins">🪙 ${levelReward(l)}</span>`;
      const title = t ? `<span class="q-rw-title"><span>🏷</span> <span>${escapeHtml(t[1])}</span></span>` : '';
      const items = (LEVEL_ITEMS[l] || []).map(it => `<span class="q-rw-item"><span>${it.icon}</span> <span>${escapeHtml(it.name)}</span></span>`).join('');
      html += `<div class="q-row rw ${claimed ? 'claimed' : (ready ? 'ready' : 'locked')} ${l === pl ? 'current' : ''}" data-lv="${l}">
        <div class="q-lv">LV ${l}</div><div class="q-mid q-rw-mid">${reward}${title}${items}</div><div class="q-right">${right}</div></div>`;
    }
    return html;
  }
  function renderLevelScreen(){
    ensureToday();
    renderHead();
    guestNote();
    document.querySelectorAll('.q-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === lvlTab));
    const panel = document.getElementById('qPanel');
    const keepScroll = panel.scrollTop;
    panel.innerHTML = lvlTab === 'daily' ? renderDaily() : lvlTab === 'perm' ? renderPerm() : renderRewards();
    if(lvlTab === 'rewards' && !panel.dataset.scrolled){
      const target = panel.querySelector('.q-row.ready') || panel.querySelector('.q-row.current');
      if(target) panel.scrollTop = Math.max(0, target.offsetTop - 60);
      panel.dataset.scrolled = '1';
    } else panel.scrollTop = keepScroll;
    if(lvlTab !== 'rewards') delete panel.dataset.scrolled;
  }
  function openLevelScreen(){
    delete document.getElementById('qPanel').dataset.scrolled;
    renderLevelScreen();
  }
  function renderAchievements(){
    const q = state.quests;
    const unlocked = ACHIEVEMENTS.filter(a => q.ach[a.id]).length;
    document.getElementById('achSummary').innerHTML = `<span>Odblokowane:</span> <b>${unlocked} / ${ACHIEVEMENTS.length}</b>`;
    document.getElementById('achGrid').innerHTML = ACHIEVEMENTS.map(a => {
      const on = !!q.ach[a.id];
      const cur = Math.min(a.t, achValue(a));
      const pct = Math.round(cur / a.t * 100);
      return `<div class="ach-card ${on ? 'on' : ''}">
        <div class="ach-ico">${a.icon}</div>
        <div class="ach-name">${escapeHtml(a.pl)}</div>
        <div class="ach-desc">${escapeHtml(a.dpl)}</div>
        <div class="ach-xp">+${a.xp} XP</div>
        ${on ? '<div class="ach-badge">ODBLOKOWANE</div>'
             : `<div class="q-bar"><i style="width:${pct}%"></i></div><div class="ach-prog">${cur} / ${a.t}</div>`}
      </div>`;
    }).join('');
  }

  // ---------- TLUMACZENIA (EN) ----------
  (function registerTranslations(){
    const dict = {};
    DAILY_GROUPS.forEach(g => g.tiers.forEach(t => { dict[g.pl(t.t)] = g.en(t.t); }));
    PERM_QUESTS.forEach(d => { dict[d.pl] = d.en; });
    ACHIEVEMENTS.forEach(a => { dict[a.pl] = a.en; dict[a.dpl] = a.den; });
    PLAYER_TITLES.forEach(t => { dict[t[1]] = t[2]; });
    Object.keys(LEVEL_ITEMS).forEach(l => LEVEL_ITEMS[l].forEach(it => { dict[it.name] = it.en; }));
    if(window.I18N && I18N.addDict) I18N.addDict(dict);
  })();
