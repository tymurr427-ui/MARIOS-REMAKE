// Ekrany menu: showScreen, ranking, statystyki, ustawienia audio, wybor poziomu (renderLevels).
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  // ---------- SCREENS ----------
  const menuScreen = document.getElementById('menuScreen');
  const shopScreen = document.getElementById('shopScreen');
  const gameScreen = document.getElementById('gameScreen');
  const levelScreen = document.getElementById('levelScreen');
  const settingsScreen = document.getElementById('settingsScreen');
  const statsScreen = document.getElementById('statsScreen');
  const editorScreen = document.getElementById('editorScreen');
  const myLevelsScreen = document.getElementById('myLevelsScreen');
  const workshopScreen = document.getElementById('workshopScreen');
  const speedrunScreen = document.getElementById('speedrunScreen');
  const rankingScreen = document.getElementById('rankingScreen');

  let gamePlaying = false;
  const mpChoiceScreen = document.getElementById('mpChoiceScreen');
  const mpLobbyScreen = document.getElementById('mpLobbyScreen');

  function showScreen(name){
    if(name !== 'shop') stopPreviewLoop();
    menuScreen.classList.add('hidden');
    shopScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    levelScreen.classList.add('hidden');
    settingsScreen.classList.add('hidden');
    statsScreen.classList.add('hidden');
    editorScreen.classList.add('hidden');
    myLevelsScreen.classList.add('hidden');
    workshopScreen.classList.add('hidden');
    speedrunScreen.classList.add('hidden');
    rankingScreen.classList.add('hidden');
    mpChoiceScreen.classList.add('hidden');
    mpLobbyScreen.classList.add('hidden');
    if(name==='menu') menuScreen.classList.remove('hidden');
    if(name==='shop') shopScreen.classList.remove('hidden');
    if(name==='game') gameScreen.classList.remove('hidden');
    if(name==='levels') levelScreen.classList.remove('hidden');
    if(name==='settings') settingsScreen.classList.remove('hidden');
    if(name==='stats') statsScreen.classList.remove('hidden');
    if(name==='editor'){ editorScreen.classList.remove('hidden'); redrawEditor(); }
    if(name==='myLevels'){ myLevelsScreen.classList.remove('hidden'); renderMyLevels(); renderAdminBuiltInLevels(); }
    if(name==='workshop'){ workshopScreen.classList.remove('hidden'); renderWorkshop(); }
    if(name==='speedrun'){ speedrunScreen.classList.remove('hidden'); renderSpeedrunBoard(); }
    if(name==='ranking'){ rankingScreen.classList.remove('hidden'); renderRanking(); }
    if(name==='mpChoice') mpChoiceScreen.classList.remove('hidden');
    if(name==='mpLobby') mpLobbyScreen.classList.remove('hidden');
    document.getElementById('menuCoins').textContent = state.wallet;
    document.getElementById('shopCoins').textContent = state.wallet;
    document.getElementById('globalAuthBadge').style.display = (name==='game') ? 'none' : 'block';
    document.getElementById('createLevelCorner').style.display = (name==='menu') ? 'block' : 'none';   // skroty tylko w menu glownym
    document.getElementById('myLevelsCorner').style.display = (name==='menu') ? 'block' : 'none';   // skroty tylko w menu glownym
    document.getElementById('workshopCorner').style.display = (name==='menu') ? 'block' : 'none';   // skroty tylko w menu glownym
    gamePlaying = (name === 'game');
  }

  // licznik czasu gry (co sekunde, tylko podczas aktywnej rozgrywki)
  setInterval(() => {
    if(gamePlaying && !levelDone){
      state.playtimeSeconds++;
    }
  }, 1000);
  // okresowy autosave (co 20 sek) - zeby czas gry tez sie zapisywal na biezaco
  setInterval(() => { if(currentUser) saveProfile(); }, 20000);

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // ---------- RANKING GRACZY ----------
  const RANK_SORTS = [
    { key:'wallet',             label:'🪙 Monety' },
    { key:'playtime_seconds',   label:'⏱ Czas gry' },
    { key:'total_coins_earned', label:'💰 Zarobione' },
    { key:'enemies_killed',     label:'👾 Wrogowie' },
    { key:'bosses_killed',      label:'👹 Bossowie' },
    { key:'unlocked_level',     label:'🗺 Poziom' },
  ];
  let rankingSort = 'wallet';
  let rankingReq = 0;

  function fmtNum(n){ return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtHM(sec){
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h + 'h ' + String(m).padStart(2,'0') + 'm';
  }
  function myRankValue(key){
    return ({ wallet: state.wallet, playtime_seconds: state.playtimeSeconds, total_coins_earned: state.totalCoinsEarned,
              enemies_killed: state.enemiesKilled, bosses_killed: state.bossesKilled, unlocked_level: state.unlockedLevel })[key] || 0;
  }

  async function renderRanking(){
    const sortsEl = document.getElementById('rankSorts');
    const panel = document.getElementById('rankPanel');
    const meNote = document.getElementById('rankMeNote');
    sortsEl.innerHTML = '';
    RANK_SORTS.forEach(o => {
      const b = document.createElement('button');
      b.className = 'rank-sort-btn' + (o.key === rankingSort ? ' active' : '');
      b.textContent = o.label;
      b.onclick = () => { rankingSort = o.key; renderRanking(); };
      sortsEl.appendChild(b);
    });
    meNote.textContent = '';
    if(!sb){
      panel.innerHTML = '<div class="rank-empty">Ranking niedostępny bez konta (Supabase).</div>';
      return;
    }
    const req = ++rankingReq;
    panel.innerHTML = '<div class="rank-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('profiles')
      .select('id,display_name,wallet,playtime_seconds,total_coins_earned,enemies_killed,bosses_killed,unlocked_level')
      .order(rankingSort, { ascending:false, nullsFirst:false })
      .limit(50);
    if(req !== rankingReq) return; // przyszla nowsza prosba (ktos zmienil sortowanie)
    if(error){
      panel.innerHTML = '<div class="rank-empty">' + escapeHtml('⚠ Błąd wczytywania: ' + (error.message || error)) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="rank-empty">Brak wyników.</div>';
      return;
    }
    const fmts = {
      wallet:             v => fmtNum(v),
      playtime_seconds:   v => fmtHM(v),
      total_coins_earned: v => fmtNum(v),
      enemies_killed:     v => fmtNum(v),
      bosses_killed:      v => fmtNum(v),
      unlocked_level:     v => (Math.min((v || 0) + 1, LEVELS.length)) + '/' + LEVELS.length,
    };
    const fmt = fmts[rankingSort];
    const colLabel = (RANK_SORTS.find(o => o.key === rankingSort) || {}).label || '';
    const medals = ['🥇','🥈','🥉'];
    let html = `<div class="rank-head"><span>#</span><span>Gracz</span><span class="num sorted">${colLabel}</span></div>`;
    html += data.map((row, i) => {
      const isMe = currentUser && row.id === currentUser.id;
      const name = escapeHtml(row.display_name || 'Gracz');
      const pos = i < 3 ? `<span class="rank-medal">${medals[i]}</span>` : (i + 1) + '.';
      return `<div class="rank-row${isMe ? ' me' : ''}"><span class="pos">${pos}</span><span class="nm">${name}</span><span class="num sorted">${fmt(row[rankingSort])}</span></div>`;
    }).join('');
    panel.innerHTML = html;

    // moje miejsce (nawet jesli nie ma mnie w top 50)
    if(currentUser){
      const { count, error: cErr } = await sb.from('profiles')
        .select('id', { count:'exact', head:true })
        .gt(rankingSort, myRankValue(rankingSort));
      if(req === rankingReq && !cErr && count !== null){
        meNote.textContent = 'Twoje miejsce: #' + (count + 1);
      }
    }
  }

  document.getElementById('btnPlay').onclick = () => { showScreen('game'); startLevel(state.unlockedLevel); };
  document.getElementById('btnShop').onclick = () => { showScreen('shop'); renderShop(); };
  document.getElementById('btnBack').onclick = () => showScreen('menu');
  document.getElementById('btnLevels').onclick = () => { showScreen('levels'); renderLevels(); };
  document.getElementById('btnLevelsBack').onclick = () => showScreen('menu');
  document.getElementById('btnRanking').onclick = () => showScreen('ranking');
  document.getElementById('btnRankingBack').onclick = () => showScreen('menu');
  document.getElementById('btnSettings').onclick = () => showScreen('settings');
  document.getElementById('btnSettingsBack').onclick = () => showScreen('menu');
  document.getElementById('btnStatsBack').onclick = () => showScreen('menu');

  function formatPlaytime(totalSeconds){
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h}h ${m}m ${s}s`;
  }

  const MAX_CUSTOM_LEVELS = 15;

  async function renderStats(){
    const panel = document.getElementById('statsPanel');
    panel.innerHTML = `
      <div class="stats-row"><span>🪙 Aktualne monety</span><b>${state.wallet}</b></div>
      <div class="stats-row"><span>💰 Łącznie zarobione monety</span><b>${state.totalCoinsEarned}</b></div>
      <div class="stats-row"><span>🛒 Wydane monety</span><b>${state.totalSpent}</b></div>
      <div class="stats-row"><span>⏱ Dokładny czas gry</span><b>${formatPlaytime(state.playtimeSeconds)}</b></div>
      <div class="stats-row"><span>💀 Liczba śmierci</span><b>${state.deathCount}</b></div>
      <div class="stats-row"><span>👾 Zabici przeciwnicy</span><b>${state.enemiesKilled}</b></div>
      <div class="stats-row"><span>👹 Pokonani bossowie</span><b>${state.bossesKilled}</b></div>
      <div class="stats-row"><span>👕 Posiadane skiny</span><b>${state.ownedSkins.length} / ${SKINS.length}</b></div>
      <div class="stats-row"><span>🚩 Posiadane trailsy</span><b>${state.ownedTrails.length} / ${TRAILS.length}</b></div>
      <div class="stats-row"><span>🛠️ Stworzone poziomy</span><b id="statsLevelsCount">...</b></div>
    `;
    const countEl = document.getElementById('statsLevelsCount');
    if(!sb || !currentUser){
      countEl.textContent = '0 / ' + MAX_CUSTOM_LEVELS;
      return;
    }
    const { count, error } = await sb.from('custom_levels')
      .select('*', { count:'exact', head:true })
      .eq('creator_id', currentUser.id);
    countEl.textContent = (error ? '?' : (count||0)) + ' / ' + MAX_CUSTOM_LEVELS;
  }

  document.getElementById('btnMultiplayer').onclick = () => {
    document.getElementById('mpError').textContent = '';
    document.getElementById('mpCodeInput').value = '';
    document.getElementById('mpNickInput').value = state.displayName || '';
    showScreen('mpChoice');
  };
  document.getElementById('btnMpChoiceBack').onclick = () => showScreen('menu');
  document.getElementById('btnMpCreate').onclick = () => {
    if(!getMpNickname()){
      document.getElementById('mpError').textContent = 'Wpisz swój nick.';
      return;
    }
    createMpLobby();
  };
  document.getElementById('btnMpJoin').onclick = () => {
    const code = document.getElementById('mpCodeInput').value.trim().toUpperCase();
    if(code.length !== 5){
      document.getElementById('mpError').textContent = 'Kod ma 5 znaków, np. AB3XQ.';
      return;
    }
    joinMpLobby(code);
  };
  document.getElementById('mpCodeInput').oninput = (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  };
  document.getElementById('btnMpStart').onclick = async () => {
    if(!isHost || !mpConnected) return;
    const customCode = document.getElementById('mpCustomCodeInput').value.trim().toUpperCase();
    if(customCode){
      document.getElementById('mpLobbyStatus').textContent = 'Wczytywanie poziomu własnego...';
      const res = await loadCustomLevelByCode(customCode);
      if(res.error){
        document.getElementById('mpLobbyStatus').textContent = '⚠ ' + res.error;
        return;
      }
      broadcastEvent('game_start', { customData: res.data });
      startMultiplayerGame(res.data);
    } else {
      broadcastEvent('game_start', {});
      startMultiplayerGame();
    }
  };
  document.getElementById('btnMpCancel').onclick = () => {
    leaveMultiplayer();
    showScreen('menu');
  };
  document.getElementById('pauseBtn').onclick = () => {
    cancelAnimationFrame(rafId);
    leaveMultiplayer();
    if(editorTesting){
      editorTesting = false;
      showScreen('editor');
    } else {
      showScreen('menu');
    }
  };
  document.getElementById('fsBtn').onclick = () => {
    const el = document.getElementById('wrap');
    if(!document.fullscreenElement){ el.requestFullscreen && el.requestFullscreen(); }
    else { document.exitFullscreen && document.exitFullscreen(); }
  };

  function updateMuteLabels(){
    const on = AudioEngine.isOn();
    document.getElementById('btnMuteMenu').textContent = on ? '🔊 WŁĄCZONA' : '🔇 WYŁĄCZONA';
    document.getElementById('muteBtn').textContent = on ? '🔊' : '🔇';
  }
  document.getElementById('btnMuteMenu').onclick = () => {
    AudioEngine.toggleMusic();
    state.musicOn = AudioEngine.isOn();
    updateMuteLabels();
    saveProfile();
  };
  document.getElementById('muteBtn').onclick = () => {
    AudioEngine.toggleMusic();
    state.musicOn = AudioEngine.isOn();
    updateMuteLabels();
    saveProfile();
  };

  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  volumeSlider.oninput = () => {
    const pct = Number(volumeSlider.value);
    volumeValue.textContent = pct + '%';
    state.volumeUI = pct;
    AudioEngine.setVolume(pct / 100 * 0.5);
    AudioEngine.ensureCtx();
    saveProfile();
  };

  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.onclick = () => {
      state.graphicsQuality = btn.dataset.q;
      setGraphicsQuality(state.graphicsQuality);
      updateSettingsUI();
      saveProfile();
    };
  });


  function renderLevels(){
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const locked = i > state.unlockedLevel;
      const card = document.createElement('div');
      card.className = 'level-card' + (locked ? ' locked':'');
      card.innerHTML = `<span class="num">${i+1}</span><span class="lbl">${locked ? '🔒 zablokowany' : escapeHtml(lvl().name)}</span>`;
      if(!locked){
        card.onclick = () => { showScreen('game'); startLevel(i); };
      }
      grid.appendChild(card);
    });
  }
