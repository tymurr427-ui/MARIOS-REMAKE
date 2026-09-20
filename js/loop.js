// draw(), limit FPS + licznik, staly krok fizyki 60/s z interpolacja, glowna petla.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  function draw(){
    if(!levelDone && !mpChannel){
      runElapsedMs = performance.now() - levelStartTime;
      const tEl = document.getElementById('hudTimer');
      if(tEl){ const ts2 = formatRunTime(runElapsedMs); if(tEl.textContent !== ts2) tEl.textContent = ts2; }
    }
    drawBackground();
    drawPlatforms();
    drawMovers();
    drawHazards();
    drawCrushers();
    drawCoins();
    drawTurrets();
    drawProjectiles();
    drawEnemies();
    drawFlag();
    drawCheckpoint();
    if(mpChannel) drawRemotePlayer();
    if(!player.spectating){
      drawPlayerFlag();
      drawPlayer();
    }
  }

  // ---------- LIMIT FPS + LICZNIK ----------
  // Fizyka liczy sie zawsze 60 razy/s (stały krok), a obraz jest rysowany z interpolacja w tempie monitora -
  // dzieki temu gra ma to samo tempo na 60/144/240 Hz i jest plynna.
  let fpsLimit = 0;                  // limit RYSOWANIA: 60 | 144 | 0 (bez limitu = odswiezanie monitora)
  try { const v = localStorage.getItem('spb_fps'); if(v === '60' || v === '144' || v === '0') fpsLimit = Number(v); } catch(e){}
  let fpsCounterOn = true;
  try { fpsCounterOn = localStorage.getItem('spb_showfps') !== '0'; } catch(e){}
  let fpsNext = 0, fpsFrames = 0, fpsStamp = 0;

  // true = w tej klatce przeglada trzeba zrobic update+draw (harmonogram co 1000/limit ms, tolerancja 1.5 ms)
  function fpsGate(ts){
    if(!fpsLimit) return true;
    const interval = 1000 / fpsLimit;
    if(!fpsNext || ts - fpsNext > interval * 2) fpsNext = ts;   // pierwszy raz albo duze opoznienie (karta w tle)
    if(ts + 1.5 < fpsNext) return false;
    fpsNext += interval;
    return true;
  }
  function fpsTick(ts){
    fpsFrames++;
    if(!fpsStamp) fpsStamp = ts;
    const d = ts - fpsStamp;
    if(d >= 500){
      const el = document.getElementById('hudFps');
      if(el) el.textContent = Math.round(fpsFrames * 1000 / d);
      fpsFrames = 0; fpsStamp = ts;
    }
  }
  function applyFpsUI(){
    document.querySelectorAll('.fps-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.fps) === fpsLimit));
    const pill = document.getElementById('hudFpsPill');
    if(pill) pill.classList.toggle('hidden', !fpsCounterOn);
    const tb = document.getElementById('btnFpsCounter');
    if(tb) tb.textContent = fpsCounterOn ? '📊 WŁĄCZONY' : '📊 WYŁĄCZONY';
  }
  document.querySelectorAll('.fps-btn').forEach(b => {
    b.onclick = () => {
      fpsLimit = Number(b.dataset.fps);
      fpsNext = 0; fpsFrames = 0; fpsStamp = 0;
      try { localStorage.setItem('spb_fps', String(fpsLimit)); } catch(e){}
      applyFpsUI();
    };
  });
  document.getElementById('btnFpsCounter').onclick = () => {
    fpsCounterOn = !fpsCounterOn;
    try { localStorage.setItem('spb_showfps', fpsCounterOn ? '1' : '0'); } catch(e){}
    applyFpsUI();
  };
  applyFpsUI();

  // ---------- STALY KROK FIZYKI (60/s) + INTERPOLACJA OBRAZU ----------
  const TICK_MS = 1000 / 60;
  let simAcc = 0, simLast = 0;
  const interpList = [];   // plaska lista: obiekt, poprzednie x, poprzednie y, ...
  const interpCur = [];
  function snapshotForInterp(){
    interpList.length = 0;
    const add = o => { if(o && typeof o.x === 'number') interpList.push(o, o.x, o.y === undefined ? 0 : o.y); };
    add(player); add(camera);
    if(level){
      if(level.enemies) level.enemies.forEach(add);
      if(level.movers) level.movers.forEach(add);
      if(level.crushers) level.crushers.forEach(add);
      if(level.projectiles) level.projectiles.forEach(add);
    }
  }
  function drawInterpolated(alpha){
    const n = interpList.length;
    let j = 0;
    for(let i = 0; i < n; i += 3){
      const o = interpList[i];
      interpCur[j++] = o.x; interpCur[j++] = o.y;
      const dx = o.x - interpList[i+1], dy = (o.y === undefined ? 0 : o.y) - interpList[i+2];
      // duze skoki (respawn, teleport) rysujemy bez interpolacji
      if(Math.abs(dx) < 150 && Math.abs(dy) < 150){
        o.x = interpList[i+1] + dx * alpha;
        if(o.y !== undefined) o.y = interpList[i+2] + dy * alpha;
      }
    }
    try { draw(); }
    finally {
      j = 0;
      for(let i = 0; i < n; i += 3){
        const o = interpList[i];
        o.x = interpCur[j++]; const cy = interpCur[j++];
        if(o.y !== undefined) o.y = cy;
      }
    }
  }

  function loop(ts){
    const t = (ts !== undefined) ? ts : performance.now();
    if(!simLast) simLast = t;
    if(fpsGate(t)){
      let dtm = t - simLast; simLast = t;
      if(dtm > 100) dtm = 100;          // po powrocie z innej karty nie nadganiamy calych sekund
      simAcc += dtm;
      let steps = 0;
      while(simAcc >= TICK_MS && steps < 5 && !levelDone){
        snapshotForInterp();
        update();
        simAcc -= TICK_MS; steps++;
      }
      if(steps >= 5) simAcc = 0;
      drawInterpolated(Math.min(1, simAcc / TICK_MS));
      fpsTick(t);
    }
    if(!levelDone){
      rafId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafId);
    }
  }

  // init
  resizeCanvas();
  updateAuthUI();
  showScreen('menu');
  volumeSlider.value = Math.round(AudioEngine.getVolume() / 0.5 * 100);
  volumeValue.textContent = volumeSlider.value + '%';
  updateSettingsUI();

  if(sb){
    loadBuiltInOverrides();
    sb.auth.getSession().then(({data}) => {
      if(data.session){
        currentUser = data.session.user;
        loadProfile(currentUser).then(() => { updateAuthUI(); showScreen('menu'); });
      }
    });
    sb.auth.onAuthStateChange((_event, session) => {
      const wasSignedIn = !!currentUser;
      currentUser = session ? session.user : null;
      if(currentUser){
        loadProfile(currentUser).then(() => {
          updateAuthUI();
          // tylko przy faktycznym, pierwszym zalogowaniu wracamy do menu -
          // Supabase odswieza sesje (np. po powrocie do karty) i wywoluje
          // ten event tez wtedy, kiedy user juz byl zalogowany - to nie moze
          // wyrzucac go z edytora/gry z powrotem do menu
          if(!wasSignedIn) showScreen('menu');
        });
      } else {
        updateAuthUI();
      }
    });
  }
