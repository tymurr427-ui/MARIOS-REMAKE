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
      state.quests = normalizeQuests(data.quest_data);
      if(data.display_name) state.displayName = data.display_name;
      else await sb.from('profiles').update({ display_name: state.displayName }).eq('id', user.id);
    }
    applySettingsFromState();
    questsAfterLoad();
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

  function saveProfile(){
    if(!sb || !currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
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
        quest_data: state.quests,
        xp: state.quests.xp,   // kolumna-lustrzanka quest_data.xp, zeby ranking mogl sortowac po niej wprost (order() nie lubi jsonb)
        updated_at: new Date().toISOString(),
      };
      const res = await sb.from('profiles').upsert(row);
      // brak kolumny quest_data (SQL jeszcze nie odpalony) -> zapisz reszte profilu bez niej
      if(res && res.error && /quest_data/.test(res.error.message || '')){
        delete row.quest_data;
        await sb.from('profiles').upsert(row);
      }
    }, 500);
  }

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
