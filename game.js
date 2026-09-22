// Logika gry: canvas, budowa poziomu, wrogowie, hitboxy, fizyka gracza (update), koniec poziomu.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  // ---------- GAME ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Stala, logiczna rozdzielczosc gry - NIE zalezy od rozmiaru okna/fullscreen.
  // Dzieki temu wlaczenie pelnego ekranu (co zmienia window.innerWidth/Height)
  // nigdy nie przesuwa platform/rur/monet wzgledem ziemi.
  const W = 1280, H = 720;
  const GROUND_Y = H - 60;
  if(window.SPB_GROUND_Y !== GROUND_Y) console.error('levels.js: GROUND_Y niezgodne z main.js');
  // Tempo skoku: przy k<1 dlugosc lotu x(1/k) przy TEJ SAMEJ wysokosci skoku
  // (predkosc skoku * k, grawitacja * k^2). Zmien JUMP_TIME_K zeby dostroic (1 = jak dawniej).
  const JUMP_TIME_K = 1;   // 1 = oryginalny skok; <1 = dluzszy, wolniejszy lot (np. 0.85)
  const GRAVITY = 0.62 * JUMP_TIME_K * JUMP_TIME_K;
  let rafId;
  const QUALITY_NAMES = ['low','medium','high','ultra'];
  let gfxQuality = 1; // domyslnie 'medium'
  function setGraphicsQuality(name){
    const idx = QUALITY_NAMES.indexOf(name);
    gfxQuality = idx >= 0 ? idx : 1;
  }

  function resizeCanvas(){
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', () => { /* canvas sie tylko rozciaga w CSS, logika sie nie zmienia */ });

  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if(e.code === 'KeyQ') activateShield();
  });
  window.addEventListener('keyup', e => keys[e.code] = false);

  function activateShield(){
    if(!gamePlaying || !player || player.spectating) return;
    if(player.shieldActive) return;
    if(state.shields <= 0) return;
    state.shields--;
    player.shieldActive = true;
    player.shieldTimer = 15;
    saveProfile();
    AudioEngine.sfxWin();
  }

  let level, player, camera, runCoins, lives, levelDone, timeAlive, currentLevelIndex;
  let levelCheckpointReached = false;
  let levelStartTime = 0, runElapsedMs = 0;
  function formatRunTime(ms){
    const totalMs = Math.max(0, ms|0);
    const m = Math.floor(totalMs / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const d = Math.floor((totalMs % 1000) / 100);
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + d;
  }
  let customLevelActive = false;

  // Minimalna szerokosc platform (jak na poziomie 1): weza sie do 110 px, srodek zostaje w tym samym miejscu.
  const MIN_PLATFORM_W = 110;
  function widenPlatforms(lvl){
    (lvl.platforms||[]).forEach(p => {
      if(!p.isGround && p.h < 40 && p.w < MIN_PLATFORM_W){ p.x -= (MIN_PLATFORM_W - p.w)/2; p.w = MIN_PLATFORM_W; }
    });
    (lvl.movers||[]).forEach(m => {
      if(m.w < MIN_PLATFORM_W){
        const d = (MIN_PLATFORM_W - m.w)/2;
        m.x -= d; if(m.baseX !== undefined) m.baseX -= d;
        m.w = MIN_PLATFORM_W;
      }
    });
    return lvl;
  }
  const LEVEL_FUNCS = window.SPB_LEVEL_FUNCS;   // js/levels.js
  const LEVELS = LEVEL_FUNCS
    .map(fn => () => widenPlatforms(fn()));

  function buildLevelFromCustomData(data){
    const platforms = [];
    (data.grounds||[]).forEach(g => {
      const gy = g.y!==undefined ? g.y : GROUND_Y;
      platforms.push({x:g.x, y:gy, w:g.w, h:(GROUND_Y+200)-gy, isGround:true});
    });
    (data.platforms||[]).forEach(p => platforms.push({
      x:p.x, y:p.y, w:p.w, h:p.h,
      isTrampoline: !!p.isTrampoline, bounceAnim:0,
      isCrumbler: !!p.isCrumbler, state: p.isCrumbler ? 'idle' : undefined, timer:0,
    }));
    const pipes = (data.pipes||[]).map(p => ({x:p.x, y:GROUND_Y-p.h, w:p.w, h:p.h}));
    const coins = (data.coins||[]).map(c => ({x:c.x, y:c.y, taken:false, t:Math.random()*10}));
    const hazards = (data.hazards||[]).map(h => ({x:h.x, y:GROUND_Y-18, w:h.w, h:18}));
    const movers = (data.movers||[]).map(m => ({
      baseX:m.x, baseY:m.y, x:m.x, y:m.y, w:90, h:20,
      axis:m.axis||'x', range: m.range || (m.axis==='y' ? 110 : 60), speed: m.axis==='y' ? 0.8 : 1.0, isMover:true
    }));
    const crushers = (data.crushers||[]).map(c => ({
      x:c.x, w:c.w||50, h:c.h||50, topY:c.topY||80, bottomY:c.bottomY||GROUND_Y-55, speed:c.speed||1.0, t:c.t||0
    }));
    const shooters = (data.shooters||[]).map(s => ({ x:s.x, y:s.y, dir:s.dir||1, interval:s.interval||245 }));
    const enemies = (data.enemies||[]).map(e => {
      if(e.enemyType==='flyer') return {x:e.x, y:e.y, w:32, h:32, alive:true, type:'flyer', vx:0.5, minX:Math.max(0,e.x-100), maxX:e.x+100, baseY:e.y, amp:35};
      if(e.enemyType==='jumper') return {x:e.x, y:e.y, w:34, h:34, alive:true, type:'jumper', jumpHeight:70, baseY:e.y};
      return {x:e.x, y:e.y, w:34, h:34, alive:true, vx:0.55, minX:Math.max(0,e.x-90), maxX:e.x+90};
    });
    if(data.boss){
      enemies.push({
        x:data.boss.x, y:data.boss.y, w:90, h:90, alive:true, type:'boss',
        name:'Własny Boss', hp:6, maxHp:6, hitTimer:0,
        vx:0.9, minX:Math.max(0,data.boss.x-200), maxX:data.boss.x+200, baseY:data.boss.y, animT:0
      });
    }
    const flag = data.flag ? {x:data.flag.x, y:data.flag.y, w:14, h:220} : {x:(data.width||2000)-150, y:GROUND_Y-220, w:14, h:220};
    return {
      name: data.name || 'Poziom własny',
      platforms, pipes, coins, enemies, hazards, movers, crushers, shooters, flag,
      checkpoint: data.checkpoint ? {x:data.checkpoint.x, y:data.checkpoint.y} : null,
      width: data.width || 2000,
      bg: data.bg || 'day'
    };
  }

  function startLevel(index, customData){
    currentLevelIndex = index;
    customLevelActive = !!customData;
    const override = (!customData && builtInOverrides[index]) ? builtInOverrides[index] : null;
    level = customData ? buildLevelFromCustomData(customData) : (override ? widenPlatforms(buildLevelFromCustomData(override)) : LEVELS[index]());
    // popraw isGround po ewentualnym resize
    level.platforms.forEach(p => { if(p.y === undefined) p.y = GROUND_Y; });
    const spawn = (customData && customData.spawn) ? customData.spawn : { x:40, y:GROUND_Y-54 };
    player = {
      x:spawn.x, y:spawn.y, w:38, h:54,
      vx:0, vy:0, onGround:false, facing:1, animT:0, invuln:0, airTime:0, spectating:false, ridingMover:null,
      shieldActive:false, shieldTimer:0
    };
    camera = {x:0};
    runCoins = 0;
    lives = 3 + (state.extraLives || 0);
    if(state.extraLives > 0){
      state.extraLives = 0;
      saveProfile();
    }
    levelDone = false;
    timeAlive = 0;
    levelCheckpointReached = false;
    levelStartTime = performance.now();
    runElapsedMs = 0;
    document.getElementById('hudTimer').textContent = formatRunTime(0);
    document.getElementById('hudTimerPill').classList.toggle('hidden', !!mpChannel);
    document.getElementById('hudCoins').textContent = runCoins;
    document.getElementById('hudLives').textContent = lives;
    document.getElementById('hudLevel').textContent = customData ? ('Własny: ' + level.name) : ((index+1) + ' - ' + level.name);
    updateShieldHud();
    const boss = level.enemies.find(e => e.type === 'boss' && e.alive);
    if(boss) updateBossHud(boss);
    else document.getElementById('bossHudPill').classList.add('hidden');
    if(mpChannel){
      Object.values(remotePlayers).forEach(rp => rp.dead = false);
      mpRestarting = false;
      document.getElementById('mpHudPill').classList.remove('hidden');
      document.getElementById('mpHudPill').textContent = '👥 MULTIPLAYER · ' + mpCode;
    }
    cancelAnimationFrame(rafId);
    resizeCanvas();
    simAcc = 0; simLast = 0;
    loop();
  }

  function resetPlayerPosition(){
    if(levelCheckpointReached && level.checkpoint){
      player.x = level.checkpoint.x; player.y = level.checkpoint.y-54;
    } else {
      player.x = 40; player.y = GROUND_Y-54;
    }
    player.vx=0; player.vy=0;
    player.invuln = 60;
    player.airTime = 0;
    player.ridingMover = null;
    camera.x = Math.max(0, Math.min(player.x - W/2, level.width - W));
  }

  const hudShieldPillEl = document.getElementById('hudShieldPill');
  const hudShieldTextEl = document.getElementById('hudShieldText');
  function updateShieldHud(){
    const pill = hudShieldPillEl;
    const txt = hudShieldTextEl;
    if(!pill) return;
    if(player.shieldActive){
      pill.classList.remove('hidden');
      pill.classList.add('active');
      txt.textContent = Math.ceil(player.shieldTimer) + 's';
    } else if(state.shields > 0){
      pill.classList.remove('hidden');
      pill.classList.remove('active');
      txt.textContent = state.shields + ' (Q)';
    } else {
      pill.classList.add('hidden');
    }
  }

  function takeDamage(){
    if(player.invuln > 0 || player.shieldActive) return;
    lives--;
    document.getElementById('hudLives').textContent = lives;
    AudioEngine.sfxHurt();
    if(lives <= 0){
      state.deathCount++;
      saveProfile();
      if(mpChannel && !player.spectating){
        player.spectating = true;
        document.getElementById('hudLives').textContent = 0;
        broadcastEvent('player_dead', {});
        const allRemoteDead = Object.values(remotePlayers).every(rp => rp.dead);
        const anyoneElseConnected = Object.keys(remotePlayers).length > 0;
        if(anyoneElseConnected && allRemoteDead && !mpRestarting){
          mpRestarting = true;
          broadcastEvent('level_advance', { idx: currentLevelIndex });
          showBanner('WSZYSCY PRZEGRALIŚCIE - RESTART POZIOMU', () => startLevel(currentLevelIndex));
        } else {
          showBanner('NIE ŻYJESZ\nOglądasz współgraczy...', () => {});
          document.getElementById('mpHudPill').classList.remove('hidden');
          document.getElementById('mpHudPill').textContent = '💀 Nie żyjesz - oglądasz współgraczy';
        }
      } else if(!mpChannel){
        levelDone = true;
        finishRun(false);
      }
    } else {
      resetPlayerPosition();
    }
  }

  // ---------- HITBOXY ----------
  // Obrazenia od wrogow liczymy z MNIEJSZYCH prostokatow niz tekstury (krawedzie, rece, czapka
  // i rogi wroga juz nie zabijaja). Deptanie wroga dziala dalej na pelnych prostokatach.
  // Ustaw wszystkie wartosci na 0, zeby wrocic do starych hitboxow.
  const HURT_PLAYER = { x:6, top:6, bottom:0 };       // gracz 38x54 -> 26x48
  const HURT_ENEMY  = { x:5, top:6, bottom:2 };       // zwykly wrog 34x34 -> 24x26
  const HURT_BOSS   = { x:12, top:12, bottom:8 };     // boss 90x90 -> 66x70
  function shrinkRect(r, i){ return { x:r.x+i.x, y:r.y+i.top, w:r.w-2*i.x, h:r.h-i.top-i.bottom }; }
  function hurtOverlap(e){
    return rectsOverlap(shrinkRect(player, HURT_PLAYER), shrinkRect(e, e.type === 'boss' ? HURT_BOSS : HURT_ENEMY));
  }

  function updateEnemies(){
    level.enemies.forEach((e, idx) => {
      if(!e.alive) return;
      e.animT = (e.animT||0) + 0.09 * ENEMY_SPEED_K;

      if(e.type === 'flyer'){
        e.x += e.vx * ENEMY_SPEED_K;
        if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
        if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
        e.y = e.baseY + Math.sin(e.animT*0.6) * (e.amp||30);
      } else if(e.type === 'jumper'){
        const hop = Math.abs(Math.sin(e.animT*0.25));
        e.y = e.baseY - hop*(e.jumpHeight||70);
      } else if(e.type === 'boss'){
        e.x += e.vx * ENEMY_SPEED_K;
        if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
        if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
        e.y = e.baseY + Math.sin(e.animT*0.8) * 12;
        if(e.hitTimer > 0) e.hitTimer--;
      } else {
        e.x += e.vx * ENEMY_SPEED_K;
        if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
        if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
      }

      if(e.type === 'boss'){
        if(player.invuln <= 0 && e.hitTimer <= 0 && rectsOverlap(player, e)){
          const stomp = player.vy > 0 && (player.y + player.h - e.y) < 26;
          if(stomp || player.shieldActive){
            e.hp -= player.shieldActive ? 2 : 1;
            e.hitTimer = 40;
            player.vy = -10 * JUMP_TIME_K;
            player.invuln = 30;
            runCoins += 2;
            document.getElementById('hudCoins').textContent = runCoins;
            AudioEngine.sfxStomp();
            spawnCoinPop();
            updateBossHud(e);
            if(e.hp <= 0){
              e.alive = false;
              state.bossesKilled++;
              questEvent('kill');
              runCoins += 20;
              document.getElementById('hudCoins').textContent = runCoins;
              for(let i=0;i<10;i++) spawnCoinPop();
              AudioEngine.sfxWin();
              document.getElementById('bossHudPill').classList.add('hidden');
              broadcastEvent('enemy_dead', { idx });
            } else {
              broadcastEvent('boss_hit', { idx, hp: e.hp });
            }
          } else if(!player.shieldActive && hurtOverlap(e)){
            takeDamage();
          }
        }
        return;
      }

      if(player.shieldActive){
        if(rectsOverlap(player, e)){
          e.alive = false;
          state.enemiesKilled++;
          questEvent('kill');
          runCoins += 1;
          document.getElementById('hudCoins').textContent = runCoins;
          AudioEngine.sfxStomp();
          spawnCoinPop();
          broadcastEvent('enemy_dead', { idx });
        }
      } else if(player.invuln <= 0){
        if(rectsOverlap(player, e)){
          const stomp = player.vy > 0 && (player.y + player.h - e.y) < 20;
          if(stomp){
            e.alive = false;
            state.enemiesKilled++;
            questEvent('kill');
            player.vy = -9.5 * JUMP_TIME_K;
            player.invuln = 20;
            runCoins += 1;
            document.getElementById('hudCoins').textContent = runCoins;
            AudioEngine.sfxStomp();
            spawnCoinPop();
            broadcastEvent('enemy_dead', { idx });
          } else if(hurtOverlap(e)){
            takeDamage();
          }
        }
      }
    });
  }

  function updateBossHud(boss){
    const pill = document.getElementById('bossHudPill');
    if(!pill) return;
    pill.classList.remove('hidden');
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    document.getElementById('bossHudBar').style.width = pct + '%';
    document.getElementById('bossHudText').textContent = boss.name + ' — ' + Math.max(0,boss.hp) + '/' + boss.maxHp;
  }

  function updateHazards(){
    if(!level.hazards) return;
    if(player.invuln > 0) return;
    for(const h of level.hazards){
      if(rectsOverlap(player, h)) takeDamage();
    }
  }

  function updateCrushers(){
    if(!level.crushers) return;
    for(const c of level.crushers){
      c.t = (c.t||0) + 0.025*(c.speed||1);
      const s = (Math.sin(c.t)+1)/2; // 0..1
      c.y = c.topY + (c.bottomY - c.topY) * s;
      if(player.invuln <= 0 && !player.spectating && rectsOverlap(player, c)) takeDamage();
    }
  }

  function updateShooters(){
    if(!level.shooters) return;
    if(!level.projectiles) level.projectiles = [];
    for(const s of level.shooters){
      s.timer = (s.timer===undefined ? s.interval : s.timer) - 1;
      if(s.timer <= 0){
        s.timer = s.interval;
        level.projectiles.push({x:s.x, y:s.y, vx:(s.dir||1)*1.5, w:16, h:16, life:220});
      }
    }
    for(let i=level.projectiles.length-1;i>=0;i--){
      const p = level.projectiles[i];
      p.x += p.vx;
      p.life--;
      if(p.life <= 0 || p.x < -50 || p.x > level.width+50){
        level.projectiles.splice(i,1);
        continue;
      }
      if(player.invuln <= 0 && !player.spectating && rectsOverlap(player, p)){
        level.projectiles.splice(i,1);
        takeDamage();
      }
    }
  }

  function updateMovers(){
    if(!level.movers) return;
    for(const m of level.movers){
      const oldX = m.x, oldY = m.y;
      m.t = (m.t||0) + 0.02*(m.speed||1);
      if(m.axis === 'x') m.x = m.baseX + Math.sin(m.t)*m.range;
      else m.y = m.baseY + Math.sin(m.t)*m.range;
      m.dx = m.x - oldX;
      m.dy = m.y - oldY;
    }
  }

  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  // ---------- ORYGINALNE TEMPO MARIO ----------
  // Klasyczne NES Mario: chód ~1.5 px/klatke w jednostkach gry, bieg szybszy,
  // przyspieszenie/tarcie zamiast natychmiastowej predkosci, skok zmiennej wysokosci.
  // Tempo poziome: mnozniki predkosci (1 = tempo bazowe, 1.2 = o 20% szybciej).
  // Gracz: chod, bieg i przyspieszanie/hamowanie skaluja sie razem (ta sama "zwinnosc"). Skok pionowy bez zmian.
  const PLAYER_SPEED_K = 1.2;
  const ENEMY_SPEED_K = 1.2;   // wrogowie: ruch poziomy + tempo animacji (skoki jumperow, falowanie flyerow)
  const WALK_MAX = 2.21 * PLAYER_SPEED_K; // 2.6 * 0.85 (chod o 15% wolniejszy)
  const RUN_MAX = 4.5 * PLAYER_SPEED_K; // 5.0 * 0.9 (bieg o 10% wolniejszy)
  const ACCEL = 0.32 * PLAYER_SPEED_K;
  const DECEL_GROUND = 0.36 * PLAYER_SPEED_K;
  const DECEL_AIR = 0.16 * PLAYER_SPEED_K;
  const JUMP_VELOCITY = -13.9 * JUMP_TIME_K;
  const TRAMPOLINE_VELOCITY = -21.5 * JUMP_TIME_K; // mocne odbicie - nowa przeszkoda

  function updateCrumblers(){
    if(!level.platforms) return;
    for(const p of level.platforms){
      if(!p.isCrumbler) continue;
      if(p.state === 'shaking'){
        p.timer--;
        if(p.timer <= 0){ p.state = 'gone'; p.timer = 100; }
      } else if(p.state === 'gone'){
        p.timer--;
        if(p.timer <= 0){ p.state = 'idle'; }
      }
    }
  }
  const JUMP_CUT = 0.45; // puszczenie skoku wczesniej -> nizszy skok

  function update(){
    if(levelDone) return;
    timeAlive++;

    if(player.spectating){
      updateMovers();
      if(level.crushers) level.crushers.forEach(c => {
        c.t = (c.t||0) + 0.025*(c.speed||1);
        const s = (Math.sin(c.t)+1)/2;
        c.y = c.topY + (c.bottomY - c.topY) * s;
      });
      if(level.shooters){
        if(!level.projectiles) level.projectiles = [];
        level.shooters.forEach(s => {
          s.timer = (s.timer===undefined ? s.interval : s.timer) - 1;
          if(s.timer <= 0){ s.timer = s.interval; level.projectiles.push({x:s.x,y:s.y,vx:(s.dir||1)*1.5,w:16,h:16,life:220}); }
        });
        for(let i=level.projectiles.length-1;i>=0;i--){
          const p = level.projectiles[i];
          p.x += p.vx; p.life--;
          if(p.life<=0 || p.x<-50 || p.x>level.width+50) level.projectiles.splice(i,1);
        }
      }
      level.coins.forEach(c => { if(!c.taken) c.t += 0.15; });
      level.enemies.forEach(e => {
        if(!e.alive) return;
        e.animT = (e.animT||0) + 0.09 * ENEMY_SPEED_K;
        if(e.type === 'flyer'){
          e.x += e.vx * ENEMY_SPEED_K;
          if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
          if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
          e.y = e.baseY + Math.sin(e.animT*0.6) * (e.amp||30);
        } else if(e.type === 'jumper'){
          const hop = Math.abs(Math.sin(e.animT*0.25));
          e.y = e.baseY - hop*(e.jumpHeight||70);
        } else {
          e.x += e.vx * ENEMY_SPEED_K;
          if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
          if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
        }
      });
      const aliveRemote = Object.values(remotePlayers).find(rp => !rp.dead && rp.data);
      const followX = aliveRemote ? aliveRemote.data.x : player.x;
      camera.x = Math.max(0, Math.min(followX - W/2, level.width - W));
      return;
    }

    broadcastOwnState();

    const running = keys['ShiftLeft'] || keys['ShiftRight'];
    const maxSpeed = running ? RUN_MAX : WALK_MAX;

    if(keys['ArrowLeft']||keys['KeyA']){
      player.vx -= ACCEL * (running?1.4:1);
      if(player.vx < -maxSpeed) player.vx = -maxSpeed;
      player.facing = -1;
    } else if(keys['ArrowRight']||keys['KeyD']){
      player.vx += ACCEL * (running?1.4:1);
      if(player.vx > maxSpeed) player.vx = maxSpeed;
      player.facing = 1;
    } else {
      const dec = player.onGround ? DECEL_GROUND : DECEL_AIR;
      if(player.vx > 0){ player.vx -= dec; if(player.vx < 0) player.vx = 0; }
      else if(player.vx < 0){ player.vx += dec; if(player.vx > 0) player.vx = 0; }
    }

    const jumpHeld = keys['Space']||keys['ArrowUp']||keys['KeyW'];
    const COYOTE_FRAMES = 6; // krotki "grace period" po zejsciu z krawedzi - inaczej skok tuz przy krawedzi bywa ignorowany
    if(jumpHeld && (player.onGround || (!player.jumping && player.airTime > 0 && player.airTime <= COYOTE_FRAMES)) && !player.jumping){
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.jumping = true;
      questEvent('jump');
      AudioEngine.sfxJump();
    }
    if(!jumpHeld && player.vy < -JUMP_CUT*6){
      player.vy *= (1-JUMP_CUT*0.3);
    }
    if(player.onGround) player.jumping = false;

    player.vy += GRAVITY;
    if(player.vy > 16 * JUMP_TIME_K) player.vy = 16 * JUMP_TIME_K;

    updateMovers();
    const movers = level.movers || [];
    const solids = level.allSolids || (level.allSolids = [...level.platforms, ...level.pipes, ...movers]);

    // jesli w poprzedniej klatce gracz stal na ruchomej platformie, przenosimy go
    // razem z nia (w X i Y) ZANIM policzymy jego wlasny ruch/kolizje - inaczej przy
    // szybszym ruchu platformy (zwlaszcza w pionie) samo wykrywanie nakladania
    // "gubilo" gracza i spadal
    if(player.ridingMover && movers.includes(player.ridingMover)){
      player.x += player.ridingMover.dx;
      player.y += player.ridingMover.dy;
    }

    // ruch poziomy + kolizje
    player.x += player.vx;
    for(const p of solids){
      if(p.isCrumbler && p.state === 'gone') continue;
      if(rectsOverlap(player,p)){
        if(player.vx > 0){ player.x = p.x - player.w; player.vx = 0; }
        else if(player.vx < 0){ player.x = p.x + p.w; player.vx = 0; }
      }
    }
    if(player.x < 0){ player.x = 0; player.vx = 0; }

    // ruch pionowy + kolizje - podzielony na max ~8px kroki, zeby przy duzej
    // predkosci spadania gracz nie "przeskakiwal" (tunelowal) przez cienkie platformy
    // w jednej klatce zamiast na nich wyladowac
    player.onGround = false;
    let standingOnMover = null;
    const vyDir = player.vy > 0 ? 1 : (player.vy < 0 ? -1 : 0);
    let vyLeft = Math.abs(player.vy);
    let landed = false;
    while(vyDir !== 0 && vyLeft > 0 && !landed){
      const step = Math.min(vyLeft, 8);
      player.y += vyDir * step;
      vyLeft -= step;
      for(const p of solids){
        if(p.isCrumbler && p.state === 'gone') continue;
        if(rectsOverlap(player,p)){
          if(vyDir > 0){
            player.y = p.y - player.h;
            if(p.isTrampoline){
              player.vy = TRAMPOLINE_VELOCITY;
              player.onGround = false;
              player.jumping = true;
              AudioEngine.sfxJump();
              p.bounceAnim = 10;
            } else {
              player.onGround = true;
              player.vy = 0;
              if(p.isMover) standingOnMover = p;
              if(p.isCrumbler && p.state === 'idle'){ p.state = 'shaking'; p.timer = 75; }
            }
          } else {
            player.y = p.y + p.h;
            player.vy = 0;
          }
          landed = true;
          break;
        }
      }
    }
    player.ridingMover = standingOnMover;
    updateCrumblers();

    if(player.invuln > 0) player.invuln--;
    player.airTime = player.onGround ? 0 : player.airTime + 1;

    if(player.shieldActive){
      player.shieldTimer -= 1/60;
      if(player.shieldTimer <= 0){
        player.shieldActive = false;
        player.shieldTimer = 0;
      }
    }
    updateShieldHud();

    if(player.y > H + 150){
      takeDamage();
      if(levelDone) return;
    }

    updateEnemies();
    updateHazards();
    updateCrushers();
    updateShooters();
    if(levelDone) return;

    level.coins.forEach((c, idx) => {
      if(!c.taken){
        c.t += 0.15;
        const cb = {x:c.x-10,y:c.y-10,w:20,h:20};
        if(rectsOverlap(player, cb)){
          c.taken = true;
          runCoins++;
          questEvent('coin');
          document.getElementById('hudCoins').textContent = runCoins;
          spawnCoinPop();
          AudioEngine.sfxCoin();
          broadcastEvent('coin', { idx });
        }
      }
    });

    const activeBoss = level.enemies.find(e => e.type === 'boss' && e.alive);
    if(!activeBoss && rectsOverlap(player, level.flag)){
      levelDone = true;
      finishRun(true);
    } else if(activeBoss && rectsOverlap(player, level.flag)){
      // przypomnienie ze trzeba najpierw pokonac bossa
      player.x -= player.vx;
    }

    if(level.checkpoint && !levelCheckpointReached){
      const cp = { x:level.checkpoint.x, y:level.checkpoint.y-220, w:14, h:220 };
      if(rectsOverlap(player, cp)){
        levelCheckpointReached = true;
        AudioEngine.sfxCoin();
        spawnCoinPop();
      }
    }

    camera.x = Math.max(0, Math.min(player.x - W/2, level.width - W));
    player.animT += Math.abs(player.vx) * 0.22;
  }

  function finishRun(won){
    state.wallet += runCoins;
    state.totalCoinsEarned += runCoins;
    const timeStr = formatRunTime(runElapsedMs);
    if(won) AudioEngine.sfxWin(); else AudioEngine.sfxLose();
    if(!customLevelActive && won && currentLevelIndex === state.unlockedLevel && currentLevelIndex < LEVELS.length-1){
      state.unlockedLevel = currentLevelIndex + 1;
    }
    if(!customLevelActive && won && !mpChannel){
      saveSpeedrunTime(currentLevelIndex, runElapsedMs);
    }
    if(won && !editorTesting){
      questEvent('win');
      if(!customLevelActive && currentLevelIndex === LEVELS.length - 1) state.quests.c.beatGame++;
    }
    saveProfile();
    setTimeout(() => {
      if(customLevelActive){
        const timeSuffix = mpChannel ? '' : ('\n⏱ Czas: ' + timeStr);
        const msg = won ? ('POZIOM WŁASNY UKOŃCZONY!\n+' + runCoins + ' monet' + timeSuffix) : ('GAME OVER\n+' + runCoins + ' monet zebranych');
        showBanner(msg, () => {
          if(mpChannel) leaveMultiplayer();
          if(editorTesting){
            editorTesting = false;
            showScreen('editor');
          } else {
            showScreen('menu');
          }
        });
        return;
      }
      if(mpChannel){
        if(won){
          if(currentLevelIndex < LEVELS.length-1){
            const nextIdx = currentLevelIndex + 1;
            broadcastEvent('level_advance', { idx: nextIdx });
            showBanner('POZIOM UKOŃCZONY!\n+' + runCoins + ' monet', () => startLevel(nextIdx));
          } else {
            broadcastEvent('level_advance', { idx: null });
            showBanner('UKOŃCZYLIŚCIE WSZYSTKIE POZIOMY!\n+' + runCoins + ' monet', () => { leaveMultiplayer(); showScreen('menu'); });
          }
        } else {
          const restartIdx = currentLevelIndex;
          broadcastEvent('level_advance', { idx: restartIdx });
          showBanner('PRZEGRANA - RESTART POZIOMU\n+' + runCoins + ' monet zebranych', () => startLevel(restartIdx));
        }
        return;
      }
      if(won){
        if(currentLevelIndex < LEVELS.length-1){
          showBanner('POZIOM UKOŃCZONY!\n+' + runCoins + ' monet\n⏱ Czas: ' + timeStr, () => startLevel(currentLevelIndex+1));
        } else {
          showBanner('UKOŃCZYŁEŚ WSZYSTKIE POZIOMY!\n+' + runCoins + ' monet\n⏱ Czas: ' + timeStr, () => showScreen('menu'));
        }
      } else {
        showBanner('GAME OVER\n+' + runCoins + ' monet zebranych', () => showScreen('menu'));
      }
    }, 200);
  }

  function spawnCoinPop(){
    const icon = document.querySelector('.hud-coin-icon');
    const rect = icon.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'coin-pop';
    el.textContent = '+1';
    el.style.left = (rect.left + rect.width/2 + 20) + 'px';
    el.style.top = (rect.top - 2) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function showBanner(text, cb){
    const el = document.createElement('div');
    el.className = 'msg-banner';
    el.textContent = text;
    document.getElementById('gameScreen').appendChild(el);
    setTimeout(() => { el.remove(); cb(); }, 1700);
  }
