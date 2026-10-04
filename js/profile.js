// Stan gracza (state), wczytywanie/zapis profilu w Supabase, UI logowania.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  // ---------- STATE ----------
  const state = {
    wallet: 0,
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
    unlockedLevel: 0, // index najwyzszego odblokowanego poziomu
    playtimeSeconds: 0,
    displayName: '',
    musicOn: true,
    volumeUI: 56,
    graphicsQuality: 'medium',
    extraLives: 0,
    shields: 0,
    totalCoinsEarned: 0,
    deathCount: 0,
    totalSpent: 0,
    ownedTrails: ['none'],
    equippedTrail: 'none',
    enemiesKilled: 0,
    bossesKilled: 0,
    ownedHats: ['default'],
    equippedHat: 'default',
    ownedHatStyles: ['cap'],
    equippedHatStyle: 'cap',
    ownedSkinTones: ['default'],
    equippedSkinTone: 'default',
    ownedFacialHair: ['mustache'],
    equippedFacialHair: 'mustache',
    ownedGlasses: ['none'],
    equippedGlasses: 'none',
    quests: null,   // zadania/XP/osiagniecia (quests.js), zapis w kolumnie quest_data
  };

  function nameFromUser(user){
    return (user.user_metadata && user.user_metadata.full_name) || (user.email ? user.email.split('@')[0] : 'Gracz');
  }

  async function loadProfile(user){
    state.displayName = nameFromUser(user);
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if(error && error.code === 'PGRST116'){
      // brak profilu - tworzymy nowy z domyslnymi wartosciami
      await sb.from('profiles').insert({ id: user.id, display_name: state.displayName });
      return;
    }
    if(data){
      applyProfileData(data);
      if(data.display_name) state.displayName = data.display_name;
      else await sb.from('profiles').update({ display_name: state.displayName }).eq('id', user.id);
    }
    applySettingsFromState();
    questsAfterLoad();
  }

  // wspolna logika wczytywania pol profilu z obiektu danych (uzywana przy zwyklym
  // wczytaniu profilu z Supabase ORAZ przy imporcie zapisu z pliku - ten sam ksztalt danych)
  function applyProfileData(data){
      state.wallet = data.wallet ?? 0;
      state.ownedSkins = data.owned_skins ?? ['classic'];
      state.equippedSkin = data.equipped_skin ?? 'classic';
      state.unlockedLevel = data.unlocked_level ?? 0;
      state.playtimeSeconds = data.playtime_seconds ?? 0;
      state.musicOn = data.music_on ?? true;
      state.volumeUI = data.volume ?? 56;
      state.graphicsQuality = data.graphics_quality ?? 'medium';
      state.extraLives = data.extra_lives ?? 0;
      state.shields = data.shields ?? 0;
      state.ownedTrails = data.owned_trails ?? ['none'];
      state.equippedTrail = data.equipped_trail ?? 'none';
      state.totalCoinsEarned = data.total_coins_earned ?? 0;
      state.deathCount = data.death_count ?? 0;
      state.totalSpent = data.total_spent ?? 0;
      state.enemiesKilled = data.enemies_killed ?? 0;
      state.bossesKilled = data.bosses_killed ?? 0;
      // fason czapki trzymamy w istniejacych kolumnach: 'style:<id>' w owned_hats, 'kolor:fason' w equipped_hat
      const rawHats = Array.isArray(data.owned_hats) ? data.owned_hats.map(String) : ['default'];
      state.ownedHats = rawHats.filter(x => !x.startsWith('style:'));
      if(!state.ownedHats.includes('default')) state.ownedHats.unshift('default');
      state.ownedHatStyles = ['cap', ...rawHats.filter(x => x.startsWith('style:')).map(x => x.slice(6))]
        .filter((x, i, a) => a.indexOf(x) === i && HAT_STYLES.some(h => h.id === x));
      const [eqColor, eqStyle] = String(data.equipped_hat ?? 'default').split(':');
      state.equippedHat = eqColor || 'default';
      state.equippedHatStyle = (eqStyle && state.ownedHatStyles.includes(eqStyle)) ? eqStyle : 'cap';
      state.ownedSkinTones = data.owned_skin_tones ?? ['default'];
      state.equippedSkinTone = data.equipped_skin_tone ?? 'default';
      state.ownedFacialHair = data.owned_facial_hair ?? ['mustache'];
      state.equippedFacialHair = data.equipped_facial_hair ?? 'mustache';
      state.ownedGlasses = data.owned_glasses ?? ['none'];
      state.equippedGlasses = data.equipped_glasses ?? 'none';
      state.quests = normalizeQuests(data.quest_data);
  }

  function applySettingsFromState(){
    AudioEngine.ensureCtx();
    AudioEngine.setVolume(state.volumeUI / 100 * 0.5);
    if(AudioEngine.isOn() !== state.musicOn) AudioEngine.toggleMusic();
    setGraphicsQuality(state.graphicsQuality);
    updateSettingsUI();
    updateMuteLabels();
  }

  function updateSettingsUI(){
    const vs = document.getElementById('volumeSlider');
    const vv = document.getElementById('volumeValue');
    if(vs){ vs.value = state.volumeUI; vv.textContent = state.volumeUI + '%'; }
    document.querySelectorAll('.quality-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.q === state.graphicsQuality);
    });
  }

  function buildProfileRow(){
      const row = {
        id: currentUser.id,
        wallet: state.wallet,
        owned_skins: state.ownedSkins,
        equipped_skin: state.equippedSkin,
        unlocked_level: state.unlockedLevel,
        playtime_seconds: state.playtimeSeconds,
        display_name: state.displayName,
        music_on: state.musicOn,
        volume: state.volumeUI,
        graphics_quality: state.graphicsQuality,
        extra_lives: state.extraLives,
        shields: state.shields,
        owned_trails: state.ownedTrails,
        equipped_trail: state.equippedTrail,
        total_coins_earned: state.totalCoinsEarned,
        death_count: state.deathCount,
        total_spent: state.totalSpent,
        enemies_killed: state.enemiesKilled,
        bosses_killed: state.bossesKilled,
        owned_hats: state.ownedHats.concat(state.ownedHatStyles.filter(x => x !== 'cap').map(x => 'style:' + x)),
        equipped_hat: state.equippedHat + (state.equippedHatStyle !== 'cap' ? ':' + state.equippedHatStyle : ''),
        owned_skin_tones: state.ownedSkinTones,
        equipped_skin_tone: state.equippedSkinTone,
        owned_facial_hair: state.ownedFacialHair,
        equipped_facial_hair: state.equippedFacialHair,
        owned_glasses: state.ownedGlasses,
        equipped_glasses: state.equippedGlasses,
        quest_data: state.quests,
        xp: state.quests.xp,   // kolumna-lustrzanka quest_data.xp, zeby ranking mogl sortowac po niej wprost (order() nie lubi jsonb)
        updated_at: new Date().toISOString(),
      };
      return row;
  }

  function saveProfile(){
    if(!sb || !currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const row = buildProfileRow();
      const res = await sb.from('profiles').upsert(row);
      // brak kolumny quest_data (SQL jeszcze nie odpalony) -> zapisz reszte profilu bez niej
      if(res && res.error && /quest_data/.test(res.error.message || '')){
        delete row.quest_data;
        await sb.from('profiles').upsert(row);
      }
    }, 500);
  }

  function downloadSaveFile(){
    if(!currentUser){ alert('Zaloguj się, żeby pobrać swój zapis.'); return; }
    const row = buildProfileRow();
    row.exported_at = new Date().toISOString();
    row.email = currentUser.email || null;
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `super-plumber-bros-save-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  document.getElementById('btnDownloadSave').onclick = downloadSaveFile;

  async function importSaveFile(file){
    if(!currentUser){ alert('Zaloguj się na konto, na które chcesz wczytać zapis.'); return; }
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch(e){
      alert('To nie wygląda na poprawny plik zapisu (błędny JSON).');
      return;
    }
    if(!parsed || typeof parsed !== 'object' || typeof parsed.wallet === 'undefined'){
      alert('To nie wygląda na plik zapisu z tej gry.');
      return;
    }
    const sure = confirm(
      'To NADPISZE cały obecny postęp na tym koncie (' + (currentUser.email || '') + ') danymi z pliku' +
      (parsed.email ? (' (zapisanego z konta: ' + parsed.email + ')') : '') +
      '.\n\nTej operacji nie da się cofnąć. Kontynuować?'
    );
    if(!sure) return;
    applyProfileData(parsed);
    applySettingsFromState();
    questsAfterLoad();
    // zapis bezposredni (bez debounce z saveProfile()), zeby na pewno skonczyl sie przed przeladowaniem strony
    clearTimeout(saveTimer);
    const row = buildProfileRow();
    const res = await sb.from('profiles').upsert(row);
    if(res && res.error && /quest_data/.test(res.error.message || '')){
      delete row.quest_data;
      await sb.from('profiles').upsert(row);
    } else if(res && res.error){
      alert('Nie udało się zapisać wczytanych danych: ' + res.error.message);
      return;
    }
    alert('Wczytano zapis! Strona zaraz się odświeży.');
    location.reload();
  }
  const saveFileInput = document.getElementById('saveFileInput');
  document.getElementById('btnUploadSave').onclick = () => saveFileInput.click();
  saveFileInput.onchange = () => {
    if(saveFileInput.files && saveFileInput.files[0]) importSaveFile(saveFileInput.files[0]);
    saveFileInput.value = '';
  };

  async function signInWithGoogle(){
    if(!sb) return;
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
  }
  async function signOut(){
    if(!sb) return;
    await sb.auth.signOut();
    currentUser = null;
    state.wallet = 0; state.ownedSkins = ['classic']; state.equippedSkin = 'classic'; state.unlockedLevel = 0;
    state.quests = defaultQuests();
    updateAuthUI();
    showScreen('menu');
  }

  function avatarHtml(){
    const url = currentUser && currentUser.user_metadata && currentUser.user_metadata.avatar_url;
    const letter = (currentUser && currentUser.email ? currentUser.email[0] : '?').toUpperCase();
    return (url && /^https:\/\//i.test(url))
      ? `<img src="${escapeHtml(url)}" alt="">`
      : escapeHtml(letter);
  }

  function updateAuthUI(){
    const box = document.getElementById('authBox');
    const corner = document.getElementById('globalAuthBadge');
    if(!supabaseReady){
      if(box) box.innerHTML = '<div class="auth-note">Konta Google: nieskonfigurowane (uzupelnij SUPABASE_URL / KEY w kodzie)</div>';
      if(corner) corner.innerHTML = '';
      return;
    }
    if(currentUser){
      const name = escapeHtml(currentUser.user_metadata?.full_name || currentUser.email);
      if(box){
        box.innerHTML = `
          <div class="auth-logged-pill">
            <div class="auth-avatar">${avatarHtml()}</div>
            ✅ Zalogowano: ${name}
          </div>
          <button class="menu-btn small" id="btnLogout">🚪 WYLOGUJ</button>`;
        document.getElementById('btnLogout').onclick = signOut;
      }
      if(corner){
        corner.innerHTML = `<div class="auth-corner-row"><div class="auth-logged-pill"><div class="auth-avatar">${avatarHtml()}</div>✅ ${name}</div><button class="stats-btn" id="btnStatsCorner">📊</button></div>`;
        document.getElementById('btnStatsCorner').onclick = () => { renderStats(); showScreen('stats'); };
      }
    } else {
      if(box){
        box.innerHTML = '<button class="menu-btn small" id="btnLogin">🔵 ZALOGUJ PRZEZ GOOGLE</button>';
        document.getElementById('btnLogin').onclick = signInWithGoogle;
      }
      if(corner) corner.innerHTML = '';
    }
  }
