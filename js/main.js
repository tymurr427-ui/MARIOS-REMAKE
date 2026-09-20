(function(){
  // ---------- SUPABASE (konta Google + zapis postepu) ----------
  // 1. Zaloz darmowy projekt na https://supabase.com
  // 2. Wklej ponizej swoj Project URL i "anon public" key (Settings -> API)
  // 3. Wlacz logowanie Google: Authentication -> Providers -> Google
  // 4. Ustaw Site URL / Redirect URL na adres, pod ktorym hostujesz ten plik (Netlify/Vercel/GitHub Pages)
  // 5. Odpal ponizszy SQL w Supabase -> SQL Editor (tabela + zabezpieczenia RLS):
  //
  //   create table public.profiles (
  //     id uuid references auth.users on delete cascade primary key,
  //     wallet integer default 0,
  //     owned_skins jsonb default '["classic"]'::jsonb,
  //     equipped_skin text default 'classic',
  //     unlocked_level integer default 0,
  //     updated_at timestamptz default now()
  //   );
  //   alter table public.profiles enable row level security;
  //   create policy "select own" on public.profiles for select using (auth.uid() = id);
  //   create policy "update own" on public.profiles for update using (auth.uid() = id);
  //   create policy "insert own" on public.profiles for insert with check (auth.uid() = id);
  //
  //   -- Nowe kolumny licznikow zabitych wrogow/bossow (jesli profiles juz istnieje):
  //   alter table public.profiles add column if not exists enemies_killed integer default 0;
  //   alter table public.profiles add column if not exists bosses_killed integer default 0;
  //
  //   -- WARSZTAT: licznik popularnosci poziomow wlasnych (jesli custom_levels juz istnieje):
  //   alter table public.custom_levels add column if not exists plays integer default 0;
  //   -- publiczny odczyt (potrzebny do przegladania warsztatu) - pomin blad "already exists" jesli juz masz taka polityke:
  //   create policy "public read levels" on public.custom_levels for select using (true);
  //   -- bezpieczne zwiekszanie licznika bez otwierania pelnego dostepu do UPDATE calej tabeli:
  //   create or replace function public.increment_level_plays(p_code text)
  //   returns void language sql security definer as $$
  //     update public.custom_levels set plays = plays + 1 where code = p_code;
  //   $$;
  //   grant execute on function public.increment_level_plays(text) to anon, authenticated;
  //
  //   -- ADMIN: tabela poprawek do wbudowanych poziomow (tylko tymurr427@gmail.com moze je zapisywac):
  //   create table public.level_overrides (
  //     level_index integer primary key,
  //     level_data jsonb not null,
  //     updated_by uuid references auth.users(id),
  //     updated_at timestamptz default now()
  //   );
  //   alter table public.level_overrides enable row level security;
  //   create policy "public read overrides" on public.level_overrides for select using (true);
  //   create policy "only admin writes overrides" on public.level_overrides for all
  //     using (auth.jwt() ->> 'email' = 'tymurr427@gmail.com')
  //     with check (auth.jwt() ->> 'email' = 'tymurr427@gmail.com');
  //
  //   -- PERSONALIZACJA: nowe kolumny w profiles (czapka / kolor skory / zarost):
  //   alter table public.profiles add column if not exists owned_hats text[] default array['default'];
  //   alter table public.profiles add column if not exists equipped_hat text default 'default';
  //   alter table public.profiles add column if not exists owned_skin_tones text[] default array['default'];
  //   alter table public.profiles add column if not exists equipped_skin_tone text default 'default';
  //   alter table public.profiles add column if not exists owned_facial_hair text[] default array['mustache'];
  //   alter table public.profiles add column if not exists equipped_facial_hair text default 'mustache';
  //
  //   -- Tabela najlepszych czasow (speedrun) per uzytkownik+poziom:
  //   create table public.level_times (
  //     user_id uuid references auth.users(id) on delete cascade,
  //     level_index integer not null,
  //     display_name text,
  //     time_ms integer not null,
  //     updated_at timestamptz default now(),
  //     primary key (user_id, level_index)
  //   );
  //   alter table public.level_times enable row level security;
  //   create policy "public read times" on public.level_times for select using (true);
  //   create policy "insert own time" on public.level_times for insert with check (auth.uid() = user_id);
  //   create policy "update own time" on public.level_times for update using (auth.uid() = user_id);
  //
  const SUPABASE_URL = 'https://fbijztkbisfdtodfwudo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_16EaCUKwWvnbl4OGXmIH2Q_EVlgIsGD';
  const supabaseReady = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
  const sb = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  let currentUser = null;
  let builtInOverrides = {}; // level_index -> level_data (poprawki admina do wbudowanych poziomow)

  async function loadBuiltInOverrides(){
    if(!sb) return;
    try {
      const { data, error } = await sb.from('level_overrides').select('level_index,level_data');
      if(error || !data) return;
      builtInOverrides = {};
      data.forEach(r => { builtInOverrides[r.level_index] = r.level_data; });
    } catch(e){ /* ciche niepowodzenie - gra dziala dalej na oryginalnych poziomach */ }
  }
  let saveTimer = null;

  // ---------- MULTIPLAYER (Supabase Realtime: Broadcast + Presence) ----------
  const myId = 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  let mpChannel = null;
  let mpCode = '';
  let isHost = false;
  let mpConnected = false;
  let remotePlayers = {};       // mapa: id gracza -> {data, display:{x,y}, lastSeen, dead, name}
  let mpMaxPlayers = 2;          // wybrana liczba graczy (informacyjnie, nie twardy limit)
  let mpJoinDeadTimeout = null;  // timer ostrzegajacy ze dolaczasz do pustego/martwego lobby
  let mpRestarting = false;     // zabezpieczenie przed podwojnym restartem
  let mpBroadcastTimer = 0;
  let mpNickname = '';
  let mpGameStarted = false;

  function generateLobbyCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez znakow latwych do pomylenia
    let out = '';
    for(let i=0;i<5;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  window.addEventListener('pagehide', () => {
    if(mpChannel){ try { sb.removeChannel(mpChannel); } catch(e){} }
  });

  function leaveMultiplayer(){
    if(mpChannel){
      try { sb.removeChannel(mpChannel); } catch(e){}
    }
    mpChannel = null;
    mpConnected = false;
    isHost = false;
    mpCode = '';
    mpGameStarted = false;
    remotePlayers = {};
    clearTimeout(mpJoinDeadTimeout);
    document.getElementById('mpHudPill').classList.add('hidden');
    document.getElementById('btnMpStart').style.display = 'none';
  }

  function renderLobbyPlayers(){
    const st = mpChannel.presenceState();
    const entries = Object.values(st).map(arr => arr[0]);
    entries.sort((a,b) => (b.isHost?1:0) - (a.isHost?1:0));
    const box = document.getElementById('lobbyPlayers');
    let html = entries.map(p => `<div class="lobby-player-row">🎮 ${escapeHtml(p.name||'Gracz')}${p.isHost ? '<span class="host-tag">HOST</span>' : ''}</div>`).join('');
    if(entries.length < mpMaxPlayers){
      html += `<div class="lobby-player-row waiting">⏳ Czekam na graczy... (${entries.length}/${mpMaxPlayers})</div>`;
    }
    box.innerHTML = html;
    return entries.length;
  }

  function setupMpChannel(code, hosting){
    if(!sb){
      document.getElementById('mpError').textContent = 'Multiplayer wymaga skonfigurowanego konta (Supabase).';
      return;
    }
    if(mpChannel){ try{ sb.removeChannel(mpChannel); }catch(e){} }
    mpCode = code;
    isHost = hosting;
    mpConnected = false;
    mpGameStarted = false;
    remotePlayers = {};

    mpChannel = sb.channel('mp-' + code, { config: { presence: { key: myId }, broadcast: { self: false } } });

    clearTimeout(mpJoinDeadTimeout);
    if(!hosting){
      mpJoinDeadTimeout = setTimeout(() => {
        const st = mpChannel ? mpChannel.presenceState() : {};
        const count = Object.keys(st).length;
        if(count < 2){
          const statusEl = document.getElementById('mpLobbyStatus');
          if(statusEl) statusEl.textContent = '⚠ Nikogo tu nie ma - sprawdź kod albo poproś hosta o nowe lobby.';
        }
      }, 10000);
    }

    mpChannel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      const rp = remotePlayers[payload.from] || (remotePlayers[payload.from] = { display:null, dead:false });
      rp.data = payload;
      rp.lastSeen = Date.now();
    });

    mpChannel.on('broadcast', { event: 'coin' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      if(level && level.coins && level.coins[payload.idx]){
        level.coins[payload.idx].taken = true;
      }
    });

    mpChannel.on('broadcast', { event: 'enemy_dead' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      if(level && level.enemies && level.enemies[payload.idx]){
        level.enemies[payload.idx].alive = false;
        if(level.enemies[payload.idx].type === 'boss'){
          document.getElementById('bossHudPill').classList.add('hidden');
        }
      }
    });

    mpChannel.on('broadcast', { event: 'boss_hit' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      if(level && level.enemies && level.enemies[payload.idx]){
        const boss = level.enemies[payload.idx];
        boss.hp = payload.hp;
        boss.hitTimer = 40;
        updateBossHud(boss);
      }
    });

    mpChannel.on('broadcast', { event: 'level_advance' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      mpRestarting = false;
      Object.values(remotePlayers).forEach(rp => rp.dead = false);
      if(payload.idx === null){
        showBanner('WSPÓŁGRACZ UKOŃCZYŁ WSZYSTKIE POZIOMY!', () => { leaveMultiplayer(); showScreen('menu'); });
      } else {
        levelDone = true;
        showBanner('WSPÓŁGRACZ PRZESZEDŁ DALEJ!\nPrzechodzimy razem...', () => startLevel(payload.idx));
      }
    });

    mpChannel.on('broadcast', { event: 'player_dead' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      const rp = remotePlayers[payload.from] || (remotePlayers[payload.from] = { display:null, dead:false });
      rp.dead = true;
      const allRemoteDead = Object.values(remotePlayers).every(p => p.dead);
      if(player.spectating && allRemoteDead && !mpRestarting){
        mpRestarting = true;
        broadcastEvent('level_advance', { idx: currentLevelIndex });
        showBanner('WSZYSCY PRZEGRALIŚCIE - RESTART POZIOMU', () => startLevel(currentLevelIndex));
      } else if(!player.spectating){
        document.getElementById('mpHudPill').textContent = '👥 MULTIPLAYER · ' + mpCode + ' · ktoś zginął, gra dalej!';
      }
    });

    mpChannel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      if(!payload || payload.from === myId) return;
      if(!mpGameStarted){
        mpConnected = true;
        startMultiplayerGame(payload.customData || null);
      }
    });

    mpChannel.on('presence', { event: 'sync' }, () => {
      const st = mpChannel.presenceState();
      const entries = Object.values(st).map(arr => arr[0]);
      const hostEntry = entries.find(p => p.isHost);
      if(!isHost && hostEntry && hostEntry.maxPlayers) mpMaxPlayers = hostEntry.maxPlayers;
      const count = renderLobbyPlayers();
      if(count >= 2) clearTimeout(mpJoinDeadTimeout);
      const statusEl = document.getElementById('mpLobbyStatus');
      const startBtn = document.getElementById('btnMpStart');
      if(count >= 2){
        mpConnected = true;
        if(isHost){
          statusEl.textContent = `✅ ${count}/${mpMaxPlayers} graczy - możesz zaczynać!`;
          startBtn.style.display = 'inline-block';
        } else {
          statusEl.textContent = 'Czekam aż host rozpocznie grę...';
          startBtn.style.display = 'none';
        }
      } else {
        mpConnected = false;
        statusEl.textContent = isHost ? `Czekam na graczy... (${count}/${mpMaxPlayers})` : ('Łączenie z lobby ' + code + '...');
        startBtn.style.display = 'none';
      }
    });

    mpChannel.subscribe(async (status) => {
      if(status === 'SUBSCRIBED'){
        await mpChannel.track({ name: mpNickname, isHost, maxPlayers: isHost ? mpMaxPlayers : undefined });
      } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
        const statusEl = document.getElementById('mpLobbyStatus');
        if(statusEl) statusEl.textContent = '⚠ Nie udało się połączyć. Spróbuj ponownie.';
      }
    });
  }

  function getMpNickname(){
    const val = document.getElementById('mpNickInput').value.trim();
    return (val || state.displayName || 'Gracz').slice(0, 14);
  }

  let mpSelectedMaxPlayers = 2;
  let mpSelectedLevelType = 'normal';

  document.querySelectorAll('#mpPlayerCountRow .mp-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#mpPlayerCountRow .mp-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mpSelectedMaxPlayers = Number(btn.dataset.count);
    };
  });
  document.querySelectorAll('#mpLevelTypeRow .mp-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#mpLevelTypeRow .mp-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mpSelectedLevelType = btn.dataset.type;
      document.getElementById('mpCreateCustomCodeInput').classList.toggle('hidden', mpSelectedLevelType !== 'custom');
    };
  });

  function createMpLobby(){
    mpNickname = getMpNickname();
    mpMaxPlayers = mpSelectedMaxPlayers;
    const code = generateLobbyCode();
    document.getElementById('mpLobbyCodeBox').classList.remove('hidden');
    document.getElementById('mpLobbyCode').textContent = code;
    document.getElementById('mpLobbyStatus').textContent = `Czekam na graczy... (1/${mpMaxPlayers})`;
    document.getElementById('lobbyPlayers').innerHTML = '';
    const customBox = document.getElementById('mpCustomLevelBox');
    if(mpSelectedLevelType === 'custom'){
      customBox.classList.remove('hidden');
      document.getElementById('mpCustomCodeInput').value = document.getElementById('mpCreateCustomCodeInput').value.trim().toUpperCase();
    } else {
      customBox.classList.add('hidden');
      document.getElementById('mpCustomCodeInput').value = '';
    }
    showScreen('mpLobby');
    setupMpChannel(code, true);
  }

  function joinMpLobby(code){
    mpNickname = getMpNickname();
    mpMaxPlayers = 2; // dolaczajacy nie zna jeszcze wyboru hosta - zaktualizuje sie po synchronizacji lobby
    document.getElementById('mpLobbyCodeBox').classList.add('hidden');
    document.getElementById('mpLobbyStatus').textContent = 'Łączenie z lobby ' + code + '...';
    document.getElementById('lobbyPlayers').innerHTML = '';
    document.getElementById('mpCustomLevelBox').classList.add('hidden');
    showScreen('mpLobby');
    setupMpChannel(code, false);
  }

  function startMultiplayerGame(customData){
    mpGameStarted = true;
    showScreen('game');
    if(customData){
      startLevel('custom', customData);
    } else {
      startLevel(0); // multiplayer bez wskazanego kodu startuje na 1. wbudowanym poziomie
    }
    document.getElementById('mpHudPill').classList.remove('hidden');
    document.getElementById('mpHudPill').textContent = '👥 MULTIPLAYER · ' + mpCode;
  }

  function broadcastEvent(event, data){
    if(!mpChannel || !mpConnected) return;
    mpChannel.send({ type: 'broadcast', event, payload: { from: myId, ...data } });
  }

  function broadcastOwnState(){
    if(!mpChannel || !mpConnected) return;
    const now = performance.now();
    if(now - mpBroadcastTimer < 33) return; // ~30x/sek (bylo 20x/sek - za rzadko, dawalo wrazenie laga)
    mpBroadcastTimer = now;
    mpChannel.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        from: myId,
        name: mpNickname || state.displayName || 'Gracz 2',
        skin: state.equippedSkin,
        trail: state.equippedTrail,
        hat: state.equippedHat,
        hatStyle: state.equippedHatStyle,
        skinTone: state.equippedSkinTone,
        facialHair: state.equippedFacialHair,
        x: player.x, y: player.y,
        facing: player.facing,
        onGround: player.onGround,
        vx: player.vx,
      }
    });
  }

  function drawRemotePlayer(){
    const now = Date.now();
    for(const id in remotePlayers){
      const rp = remotePlayers[id];
      if(!rp.data || now - rp.lastSeen > 4000){ rp.display = null; continue; }
      // przewidywanie pozycji (dead reckoning): miedzy pakietami kontynuujemy ruch
      // wedlug ostatniej znanej predkosci, zamiast zamrazac postac az przyjdzie kolejny pakiet
      const elapsedSec = Math.min(0.25, (now - rp.lastSeen) / 1000);
      const predictedX = rp.data.x + (rp.data.vx||0) * elapsedSec * 60;
      const predictedY = rp.data.y;
      if(!rp.display){
        rp.display = { x: predictedX, y: predictedY };
      } else {
        const dist = Math.hypot(predictedX - rp.display.x, predictedY - rp.display.y);
        if(dist > 400){
          rp.display.x = predictedX;
          rp.display.y = predictedY;
        } else {
          rp.display.x += (predictedX - rp.display.x) * 0.35;
          rp.display.y += (predictedY - rp.display.y) * 0.35;
        }
      }
      const sk = SKINS.find(s => s.id === rp.data.skin) || SKINS[0];
      const rx = rp.display.x - camera.x;
      const ry = rp.display.y;
      if(rx < -60 || rx > W+60) continue;
      const scale = 38/40;
      const airborne = !rp.data.onGround;
      drawFlagAt(rx, ry, 38, 54, rp.data.facing, rp.data.vx||0, rp.data.onGround, rp.data.trail);
      ctx.save();
      ctx.globalAlpha = rp.dead ? 0.4 : 0.92;
      ctx.translate(rx + 19, ry + 28*scale);
      ctx.scale((rp.data.facing||1)*scale, scale);
      ctx.translate(-20, -28);
      drawCharacterSprite(ctx, getEffectiveColors(sk.colors, rp.data.hat, rp.data.skinTone), 0, airborne, gfxQuality===0, gfxQuality>=2, false, rp.data.facialHair, rp.data.hatStyle);
      ctx.restore();

      // imie nad postacia, rysowane wprost na canvasie (dziala dla dowolnej liczby graczy)
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      const label = (rp.data.name || 'Gracz') + (rp.dead ? ' 💀' : '');
      const labelW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(rx+19-labelW/2-6, ry-24, labelW+12, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, rx+19, ry-11);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }


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
      if(data.display_name) state.displayName = data.display_name;
      else await sb.from('profiles').update({ display_name: state.displayName }).eq('id', user.id);
    }
    applySettingsFromState();
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
      await sb.from('profiles').upsert({
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
        updated_at: new Date().toISOString(),
      });
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

  let previewSkinId = state.equippedSkin;
  let previewFacing = 1;
  let previewRaf = null;
  let previewT = 0;

  function drawThumb(canvas, colors){
    const tctx = canvas.getContext('2d');
    tctx.clearRect(0,0,canvas.width,canvas.height);
    const scale = canvas.width/50;
    tctx.save();
    tctx.translate(canvas.width/2, 4);
    tctx.scale(scale, scale);
    tctx.translate(-20, 0);
    drawCharacterSprite(tctx, colors, 0, false, false, true, false);
    tctx.restore();
  }

  function renderPreviewFrame(){
    const canvas = document.getElementById('previewCanvas');
    if(!canvas) return;
    const pctx = canvas.getContext('2d');
    pctx.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const bob = Math.sin(previewT) * 2;
    previewT += 0.06;
    const scale = 3.0;
    pctx.save();
    pctx.translate(canvas.width/2, 72);
    pctx.scale(previewFacing*scale, scale);
    pctx.translate(-20, 0);
    drawCharacterSprite(pctx, getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone), bob, false, false, true, true, state.equippedFacialHair, state.equippedHatStyle);
    pctx.restore();
    const cc = document.getElementById('customPreviewCanvas');
    const cSec = document.getElementById('customizeSection');
    if(cc && cSec && !cSec.classList.contains('hidden')){
      const cctx = cc.getContext('2d');
      cctx.clearRect(0,0,cc.width,cc.height);
      const csk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
      const cs = 4.2;
      cctx.save();
      cctx.translate(cc.width/2, 108);
      cctx.scale(previewFacing*cs, cs);
      cctx.translate(-20, 0);
      drawCharacterSprite(cctx, getEffectiveColors(csk.colors, state.equippedHat, state.equippedSkinTone), bob, false, false, true, true, state.equippedFacialHair, state.equippedHatStyle);
      cctx.restore();
    }
    previewRaf = requestAnimationFrame(renderPreviewFrame);
  }
  function startPreviewLoop(){
    cancelAnimationFrame(previewRaf);
    renderPreviewFrame();
  }
  function stopPreviewLoop(){
    cancelAnimationFrame(previewRaf);
  }

  document.getElementById('btnRotate').onclick = () => { previewFacing *= -1; };
  document.getElementById('btnRotate2').onclick = () => { previewFacing *= -1; };

  function updateBuyEquipButton(){
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const owned = state.ownedSkins.includes(sk.id);
    const equipped = state.equippedSkin === sk.id;
    const btn = document.getElementById('btnBuyEquip');
    if(!btn) return;
    if(equipped){
      btn.textContent = '✅ ZAŁOŻONE';
      btn.disabled = true;
    } else if(owned){
      btn.textContent = '👕 ZAŁÓŻ';
      btn.disabled = false;
    } else {
      btn.textContent = `🪙 KUP ZA ${sk.price}`;
      btn.disabled = state.wallet < sk.price;
    }
  }

  document.getElementById('btnBuyEquip').onclick = () => {
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const owned = state.ownedSkins.includes(sk.id);
    if(owned){
      state.equippedSkin = sk.id;
      renderShop();
      saveProfile();
    } else if(state.wallet >= sk.price){
      state.wallet -= sk.price;
      state.totalSpent += sk.price;
      state.ownedSkins.push(sk.id);
      state.equippedSkin = sk.id;
      renderShop();
      saveProfile();
    }
  };

  function isTester(){
    return !!(currentUser && currentUser.email === 'tymurr427@gmail.com');
  }

  document.getElementById('btnBuyLife').onclick = () => {
    if(isTester()){
      state.extraLives += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    } else if(state.wallet >= 100){
      state.wallet -= 100;
      state.totalSpent += 100;
      state.extraLives += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    }
  };

  document.getElementById('btnBuyShield').onclick = () => {
    if(isTester()){
      state.shields += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    } else if(state.wallet >= 150){
      state.wallet -= 150;
      state.totalSpent += 150;
      state.shields += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    }
  };

  function renderShop(){
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    SKINS.forEach(sk => {
      const owned = state.ownedSkins.includes(sk.id);
      const equipped = state.equippedSkin === sk.id;
      const previewed = previewSkinId === sk.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (equipped ? ' selected':'') + (previewed && !equipped ? ' previewed':'') + (!owned && state.wallet < sk.price ? ' locked':'');
      card.innerHTML = `
        <canvas class="skin-thumb" width="70" height="90"></canvas>
        <div class="skin-name">${sk.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="skin-price">🪙 ${sk.price}</div>`}
      `;
      card.onclick = () => {
        previewSkinId = sk.id;
        document.getElementById('previewName').textContent = sk.name;
        renderShop();
      };
      grid.appendChild(card);
      drawThumb(card.querySelector('.skin-thumb'), sk.colors);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
    const previewSk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    document.getElementById('previewName').textContent = previewSk.name;
    updateBuyEquipButton();
    startPreviewLoop();
    document.getElementById('extraLivesCount').textContent = state.extraLives;
    const buyLifeBtn = document.getElementById('btnBuyLife');
    document.getElementById('shieldsCount').textContent = state.shields;
    const buyShieldBtn = document.getElementById('btnBuyShield');
    if(isTester()){
      buyLifeBtn.disabled = false;
      buyLifeBtn.textContent = '🆓 KUP ŻYCIE (DARMOWE)';
      buyShieldBtn.disabled = false;
      buyShieldBtn.textContent = '🆓 KUP TARCZĘ (DARMOWE)';
    } else {
      buyLifeBtn.disabled = state.wallet < 100;
      buyLifeBtn.textContent = '🪙 KUP ŻYCIE (100)';
      buyShieldBtn.disabled = state.wallet < 150;
      buyShieldBtn.textContent = '🪙 KUP TARCZĘ (150)';
    }
    renderTrails();
  }

  function renderTrails(){
    const grid = document.getElementById('trailsGrid');
    if(!grid) return;
    grid.innerHTML = '';
    TRAILS.forEach(tr => {
      const owned = state.ownedTrails.includes(tr.id);
      const equipped = state.equippedTrail === tr.id;
      const afford = isTester() || state.wallet >= tr.price;
      const card = document.createElement('div');
      card.className = 'trail-card' + (equipped ? ' selected':'') + (!owned && !afford ? ' locked':'');
      card.innerHTML = `
        <div class="trail-preview-strip"></div>
        <div class="trail-name">${tr.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="trail-price">${isTester() ? '🆓 DARMOWE' : '🪙 ' + tr.price}</div>`}
      `;
      const strip = card.querySelector('.trail-preview-strip');
      if(tr.id === 'none'){
        strip.style.background = 'rgba(255,255,255,.06)';
      } else {
        const cv = document.createElement('canvas');
        cv.width = 160; cv.height = 56;
        cv.style.cssText = 'width:100%;height:100%;display:block;';
        strip.appendChild(cv);
        const tg = cv.getContext('2d');
        tg.scale(2, 2);
        drawMiniFlag(40, 14, 80, 28, tr.id, tr.colors, tg);   // ta sama funkcja co w grze
      }
      card.onclick = () => {
        if(owned){
          state.equippedTrail = tr.id;
          renderTrails();
          saveProfile();
        } else if(afford){
          if(!isTester()){
            state.wallet -= tr.price;
            state.totalSpent += tr.price;
          }
          state.ownedTrails.push(tr.id);
          state.equippedTrail = tr.id;
          renderTrails();
          saveProfile();
          AudioEngine.sfxCoin();
        }
      };
      grid.appendChild(card);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
  }

  function renderCustomizeGrid(gridId, items, ownedArrName, equippedFieldName, previewFn, compact){
    const grid = document.getElementById(gridId);
    if(!grid) return;
    grid.innerHTML = '';
    grid.classList.toggle('compact', !!compact);
    items.forEach(it => {
      const owned = state[ownedArrName].includes(it.id);
      const equipped = state[equippedFieldName] === it.id;
      const afford = isTester() || state.wallet >= it.price;
      const card = document.createElement('div');
      card.className = 'trail-card' + (compact ? ' compact' : '') + (equipped ? ' selected':'') + (!owned && !afford ? ' locked':'');
      if(compact) card.title = it.name;
      card.innerHTML = `
        ${previewFn(it)}
        <div class="trail-name">${it.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="trail-price">${isTester() ? '🆓 DARMOWE' : '🪙 ' + it.price}</div>`}
      `;
      card.onclick = () => {
        if(owned){
          state[equippedFieldName] = it.id;
          renderCustomize();
          saveProfile();
        } else if(afford){
          if(!isTester()){ state.wallet -= it.price; state.totalSpent += it.price; }
          state[ownedArrName].push(it.id);
          state[equippedFieldName] = it.id;
          renderCustomize();
          saveProfile();
          AudioEngine.sfxCoin();
        }
      };
      grid.appendChild(card);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
  }

  function renderCustomize(){
    renderCustomizeGrid('hatStylesGrid', HAT_STYLES, 'ownedHatStyles', 'equippedHatStyle',
      (it) => `<canvas class="facial-thumb" data-hat="${it.id}" width="96" height="96"></canvas>`, true);
    document.querySelectorAll('#hatStylesGrid canvas.facial-thumb').forEach(cv => drawHatThumb(cv, cv.dataset.hat));
    renderCustomizeGrid('hatsGrid', HATS, 'ownedHats', 'equippedHat',
      (it) => `<div class="customize-swatch" style="background:${it.color || 'linear-gradient(45deg,#999,#ccc)'};"></div>`, true);
    renderCustomizeGrid('skinTonesGrid', SKIN_TONES, 'ownedSkinTones', 'equippedSkinTone',
      (it) => `<div class="customize-swatch" style="background:${it.color || 'linear-gradient(45deg,#999,#ccc)'};"></div>`, true);
    renderCustomizeGrid('facialHairGrid', FACIAL_HAIR, 'ownedFacialHair', 'equippedFacialHair',
      (it) => `<canvas class="facial-thumb" data-fh="${it.id}" width="96" height="96"></canvas>`, true);
    document.querySelectorAll('#facialHairGrid canvas.facial-thumb').forEach(cv => drawFacialThumb(cv, cv.dataset.fh));
  }

  // miniaturka czapki: wycinek postaci z glowa (ten sam rysunek co w grze)
  function drawHatThumb(canvas, styleId){
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    const colors = getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
    const sc = canvas.width / 40;
    c.save();
    c.translate(canvas.width/2, canvas.height/2);
    c.scale(sc, sc);
    c.translate(-20, 7);
    drawCharacterSprite(c, colors, 0, false, true, false, false, state.equippedFacialHair, styleId);
    c.restore();
  }

  // miniaturka twarzy z prawdziwym zarostem (ten sam rysunek co w grze)
  function drawFacialThumb(canvas, fh){
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    const colors = getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
    const sc = canvas.width / 34;
    c.save();
    c.translate(canvas.width/2, canvas.height/2);
    c.scale(sc, sc);
    c.translate(-21, -17);
    drawCharacterSprite(c, colors, 0, false, true, false, false, fh, state.equippedHatStyle);
    c.restore();
  }

  function showShopTab(tab){
    const tabs = { skins:'tabSkins', trails:'tabTrails', customize:'tabCustomize' };
    const sections = { skins:'skinsSection', trails:'trailsSection', customize:'customizeSection' };
    Object.keys(tabs).forEach(k => {
      document.getElementById(tabs[k]).classList.toggle('active', k===tab);
      document.getElementById(sections[k]).classList.toggle('hidden', k!==tab);
    });
    if(tab === 'customize') renderCustomize();
  }
  document.getElementById('tabSkins').onclick = () => showShopTab('skins');
  document.getElementById('tabTrails').onclick = () => showShopTab('trails');
  document.getElementById('tabCustomize').onclick = () => showShopTab('customize');

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

  // ---------- AUDIO (wlasna, syntezowana muzyka - bez zadnych cudzych nagran) ----------
  const AudioEngine = (function(){
    let ctx, masterGain;
    let musicOn = true;
    let melodyTimer = null;
    let melodyIndex = 0;
    let volume = 0.28; // 0..0.5 (glosnosc bazowa)

    // prosta, oryginalna melodyjka w stylu chiptune (nuty w Hz, dlugosc w sek; 0 = pauza)
    const MELODY = [
      [523,0.2],[0,0.05],[523,0.2],[0,0.05],[659,0.2],[0,0.05],[523,0.2],[0,0.05],
      [784,0.4],[0,0.15],[698,0.4],[0,0.15],
      [659,0.2],[0,0.05],[587,0.2],[0,0.05],[523,0.4],[0,0.2],
      [440,0.2],[0,0.05],[523,0.2],[0,0.05],[587,0.4],[0,0.3],
    ];

    function ensureCtx(){
      if(!ctx){
        ctx = new (window.AudioContext||window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(ctx.destination);
      }
      if(ctx.state === 'suspended') ctx.resume();
    }

    function tone(freq, delay, dur, type, vol){
      if(!ctx || freq<=0) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      o.connect(g); g.connect(masterGain);
      const t0 = ctx.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime((vol!==undefined?vol:0.4), t0+0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.start(t0);
      o.stop(t0+dur+0.02);
    }

    function scheduleMusic(){
      if(!musicOn) return;
      ensureCtx();
      clearTimeout(melodyTimer);
      function step(){
        if(!musicOn) return;
        const [freq,dur] = MELODY[melodyIndex % MELODY.length];
        if(freq>0) tone(freq, 0, dur*0.85, 'triangle', 0.22);
        melodyIndex++;
        melodyTimer = setTimeout(step, dur*1000);
      }
      step();
    }
    function stopMusic(){ clearTimeout(melodyTimer); melodyTimer = null; }
    function toggleMusic(){
      musicOn = !musicOn;
      if(musicOn) scheduleMusic(); else stopMusic();
      return musicOn;
    }
    function setVolume(v){
      volume = Math.max(0, Math.min(0.5, v));
      if(masterGain) masterGain.gain.value = volume;
    }
    function getVolume(){ return volume; }

    return {
      ensureCtx,
      startIfNeeded(){ ensureCtx(); if(musicOn && !melodyTimer) scheduleMusic(); },
      sfxJump(){ ensureCtx(); tone(600,0,0.08,'square',0.3); tone(880,0.05,0.1,'square',0.25); },
      sfxCoin(){ ensureCtx(); tone(988,0,0.07,'square',0.3); tone(1318,0.06,0.12,'square',0.3); },
      sfxStomp(){ ensureCtx(); tone(150,0,0.14,'square',0.35); },
      sfxHurt(){ ensureCtx(); tone(300,0,0.1,'sawtooth',0.3); tone(180,0.1,0.22,'sawtooth',0.3); },
      sfxWin(){ ensureCtx(); [523,659,784,1046].forEach((f,i)=>tone(f,i*0.13,0.18,'square',0.3)); },
      sfxLose(){ ensureCtx(); [392,349,311,262].forEach((f,i)=>tone(f,i*0.16,0.22,'sawtooth',0.3)); },
      toggleMusic,
      setVolume,
      getVolume,
      isOn(){ return musicOn; }
    };
  })();

  // odblokuj audio przy pierwszej interakcji uzytkownika (wymog przegladarek)
  document.addEventListener('click', function initAudioOnce(){
    AudioEngine.startIfNeeded();
    document.removeEventListener('click', initAudioOnce);
  });

  // ---------- EDYTOR POZIOMÓW ----------
  let editorLevelW = 6000;   // dlugosc edytowanego poziomu (px), wybierana w pasku narzedzi
  const EDITOR_LENGTH_DEFAULT = 6000, EDITOR_LENGTH_MIN = 1500, EDITOR_LENGTH_MAX = 30000;
  const EDITOR_LEVEL_H = 720;
  const editorCanvas = document.getElementById('editorCanvas');
  const editorCtx = editorCanvas.getContext('2d');
  const editorScale = editorCanvas.height / EDITOR_LEVEL_H;
  const EDITOR_GROUND_Y = EDITOR_LEVEL_H - 60;
  const EDITOR_VIEW_W = editorCanvas.width / editorScale;

  let editorTool = 'ground';
  let editorTesting = false;
  let editorElements = []; // {kind, x, y, w, enemyType, axis}
  let editorSpawn = { x:40, y:EDITOR_GROUND_Y-54 };
  let editorFlag = { x:editorLevelW-150, y:EDITOR_GROUND_Y-220 };
  let editorCheckpoint = null; // nieedytowalny w UI - tylko zachowywany przy edycji poziomow ktore juz go maja (np. wbudowany poziom 16)
  let editorScrollX = 0;
  let editorEditingCode = null; // null = nowy poziom; ustawiony = edytujemy/nadpisujemy istniejacy zapisany poziom

  const editorScrollRange = document.getElementById('editorScrollRange');
  editorScrollRange.max = Math.max(0, editorLevelW - EDITOR_VIEW_W);
  function editorSetScroll(x){
    editorScrollX = Math.max(0, Math.min(editorLevelW - EDITOR_VIEW_W, x));
    editorScrollRange.value = editorScrollX;
    redrawEditor();
  }
  // ---- dlugosc poziomu ----
  const editorLengthSelect = document.getElementById('editorLengthSelect');
  function editorEnsureLengthOption(w){
    const opts = [...editorLengthSelect.options];
    if(opts.some(o => Number(o.value) === w)) return;
    const o = document.createElement('option');
    o.value = String(w); o.textContent = '📏 ' + w + ' px';
    const after = opts.find(x => Number(x.value) > w);
    editorLengthSelect.insertBefore(o, after || null);
  }
  function editorApplyLength(w){
    editorLevelW = w;
    editorEnsureLengthOption(w);
    editorLengthSelect.value = String(w);
    editorScrollRange.max = Math.max(0, w - EDITOR_VIEW_W);
  }
  // jak daleko siegaja elementy poziomu (bez flagi, jesli stoi na domyslnym koncu)
  function editorContentMaxX(excludeFlag){
    let m = editorSpawn.x + 40;
    if(editorFlag && !excludeFlag) m = Math.max(m, editorFlag.x + 20);
    if(editorCheckpoint) m = Math.max(m, editorCheckpoint.x + 20);
    editorElements.forEach(el => { m = Math.max(m, el.x + (el.w || 40) + (el.kind === 'mover' && el.axis !== 'y' ? (el.range || 60) : 0)); });
    return m;
  }
  editorLengthSelect.onchange = () => {
    const w = Number(editorLengthSelect.value), old = editorLevelW;
    const flagAtEnd = editorFlag && Math.abs(editorFlag.x - (old - 150)) < 1;
    const need = editorContentMaxX(flagAtEnd);
    if(w < need + 150){
      editorLengthSelect.value = String(old);
      editorFlashLimitWarning('Nie można skrócić poziomu - elementy sięgają do ' + Math.round(need) + ' px');
      return;
    }
    if(flagAtEnd) editorFlag.x = w - 150;   // flaga zostaje na koncu poziomu
    editorApplyLength(w);
    editorUndoStack = [];                   // zmiana dlugosci zeruje historie cofania
    editorSetScroll(editorScrollX);
  };
  editorScrollRange.oninput = () => editorSetScroll(Number(editorScrollRange.value));
  document.getElementById('btnEditorScrollLeft').onclick = () => editorSetScroll(editorScrollX - 300);
  document.getElementById('btnEditorScrollRight').onclick = () => editorSetScroll(editorScrollX + 300);
  editorCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    editorSetScroll(editorScrollX + (e.deltaY || e.deltaX));
  }, { passive:false });

  function editorSnap(v, grid){ return Math.round(v/grid)*grid; }

  function editorBgPreviewColors(bg){
    if(bg==='night') return {sky1:'#0b1233', sky2:'#1c2a5e', hill:'#152a4a'};
    if(bg==='dusk') return {sky1:'#8a4a8f', sky2:'#e0764f', hill:'#3d2352'};
    if(bg==='volcano') return {sky1:'#3a0e0e', sky2:'#b8451c', hill:'#2a0a0a'};
    if(bg==='ice') return {sky1:'#bfe9ff', sky2:'#eaf7ff', hill:'#6fb8d8'};
    if(bg==='desert') return {sky1:'#ffdca0', sky2:'#ffb877', hill:'#c9862f'};
    if(bg==='aurora') return {sky1:'#0a1a2e', sky2:'#123d3a', hill:'#0a2e28'};
    return {sky1:'#5c94fc', sky2:'#a8d8ff', hill:'#3fae4a'};
  }

  function redrawEditor(){
    const weightEl = document.getElementById('editorWeightHint');
    if(weightEl){
      const bytes = new Blob([JSON.stringify(collectEditorData())]).size;
      weightEl.textContent = 'Waga poziomu: ' + formatBytes(bytes);
    }
    const posEl = document.getElementById('editorPosHint');
    if(posEl) posEl.textContent = 'Widok: ' + Math.round(editorScrollX) + '–' + Math.round(Math.min(editorLevelW, editorScrollX + EDITOR_VIEW_W)) + ' / ' + editorLevelW + ' px';
    const c = editorBgPreviewColors(document.getElementById('editorBgSelect').value);
    const grad = editorCtx.createLinearGradient(0,0,0,editorCanvas.height);
    grad.addColorStop(0, c.sky1); grad.addColorStop(1, c.sky2);
    editorCtx.fillStyle = grad;
    editorCtx.fillRect(0,0,editorCanvas.width, editorCanvas.height);

    // linia gruntu (poziom, na ktorym stoja bloki ziemi)
    editorCtx.strokeStyle = 'rgba(255,255,255,.3)';
    editorCtx.setLineDash([6,4]);
    editorCtx.beginPath();
    editorCtx.moveTo(0, EDITOR_GROUND_Y*editorScale);
    editorCtx.lineTo(editorCanvas.width, EDITOR_GROUND_Y*editorScale);
    editorCtx.stroke();
    editorCtx.setLineDash([]);

    for(const el of editorElements){
      const ex = (el.x-editorScrollX)*editorScale;
      const refY = el.kind==='crusher' ? el.topY : el.y;
      const ey = refY*editorScale;
      if(ex < -100 || ex > editorCanvas.width+100) continue;
      editorCtx.save();
      if(el.kind==='ground'){
        editorCtx.fillStyle = '#8a5a2b';
        editorCtx.fillRect(ex, ey, el.w*editorScale, (editorCanvas.height-ey));
        editorCtx.fillStyle = '#3fae4a';
        editorCtx.fillRect(ex, ey, el.w*editorScale, 4);
      } else if(el.kind==='platform' && el.isTrampoline){
        const pw = el.w*editorScale;
        editorCtx.fillStyle = '#7a4a1e';
        editorCtx.fillRect(ex, ey+7, pw, 4);
        editorCtx.fillStyle = '#ff5f6d';
        editorCtx.fillRect(ex, ey, pw, 8);
        editorCtx.strokeStyle = '#c0392b'; editorCtx.lineWidth = 1.5;
        for(let sx=5; sx<pw-3; sx+=10){ editorCtx.beginPath(); editorCtx.moveTo(ex+sx, ey+8); editorCtx.lineTo(ex+sx+5, ey); editorCtx.stroke(); }
      } else if(el.kind==='platform' && el.isCrumbler){
        const pw = el.w*editorScale;
        editorCtx.fillStyle = '#a06a3e';
        editorCtx.fillRect(ex, ey, pw, 10);
        editorCtx.strokeStyle = '#5a3a1e'; editorCtx.lineWidth = 1.5;
        for(let cx2=0; cx2<pw; cx2+=16) editorCtx.strokeRect(ex+cx2, ey, Math.min(16, pw-cx2), 10);
      } else if(el.kind==='platform'){
        editorCtx.fillStyle = '#c96a2e';
        editorCtx.fillRect(ex, ey, el.w*editorScale, 10);
      } else if(el.kind==='pipe'){
        editorCtx.fillStyle = '#1e9e46';
        editorCtx.fillRect(ex, (EDITOR_GROUND_Y-60)*editorScale, el.w*editorScale, 60*editorScale);
      } else if(el.kind==='coin'){
        editorCtx.fillStyle = '#ffd23f';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 5, 0, Math.PI*2); editorCtx.fill();
      } else if(el.kind==='enemy'){
        editorCtx.fillStyle = el.enemyType==='flyer' ? '#4f9fe0' : el.enemyType==='jumper' ? '#4fc463' : '#a655d6';
        const rangeCol = 'rgba(255,110,110,.55)';
        editorCtx.strokeStyle = rangeCol;
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        if(el.enemyType === 'flyer'){
          const rx = 100*editorScale, ry = 35*editorScale;
          editorCtx.beginPath();
          editorCtx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI*2);
          editorCtx.stroke();
        } else if(el.enemyType === 'jumper'){
          editorCtx.beginPath();
          editorCtx.moveTo(ex, ey);
          editorCtx.lineTo(ex, ey - 70*editorScale);
          editorCtx.stroke();
        } else {
          const rx = 90*editorScale;
          editorCtx.beginPath();
          editorCtx.moveTo(ex-rx, ey);
          editorCtx.lineTo(ex+rx, ey);
          editorCtx.stroke();
        }
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = el.enemyType==='flyer' ? '#4f9fe0' : el.enemyType==='jumper' ? '#4fc463' : '#a655d6';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 7, 0, Math.PI*2); editorCtx.fill();
      } else if(el.kind==='hazard'){
        editorCtx.fillStyle = '#c0c5cb';
        editorCtx.beginPath();
        editorCtx.moveTo(ex, EDITOR_GROUND_Y*editorScale);
        editorCtx.lineTo(ex+el.w*editorScale/2, EDITOR_GROUND_Y*editorScale-14);
        editorCtx.lineTo(ex+el.w*editorScale, EDITOR_GROUND_Y*editorScale);
        editorCtx.fill();
      } else if(el.kind==='mover'){
        const range = (el.range||60) * editorScale;
        editorCtx.strokeStyle = 'rgba(201,165,245,.7)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath();
        if(el.axis === 'y'){
          editorCtx.moveTo(ex, ey-range);
          editorCtx.lineTo(ex, ey+range);
        } else {
          editorCtx.moveTo(ex-range, ey);
          editorCtx.lineTo(ex+range, ey);
        }
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        // duchy skrajnych pozycji
        editorCtx.fillStyle = 'rgba(201,165,245,.35)';
        if(el.axis === 'y'){
          editorCtx.fillRect(ex-20, ey-range-4, 40, 8);
          editorCtx.fillRect(ex-20, ey+range-4, 40, 8);
        } else {
          editorCtx.fillRect(ex-range-20, ey-4, 40, 8);
          editorCtx.fillRect(ex+range-20, ey-4, 40, 8);
        }
        // platforma na pozycji startowej
        editorCtx.fillStyle = '#c9a5f5';
        editorCtx.fillRect(ex-20, ey-4, 40, 8);
        editorCtx.strokeStyle = '#6a3fae';
        editorCtx.lineWidth = 1;
        editorCtx.strokeRect(ex-20, ey-4, 40, 8);
        editorCtx.font = 'bold 11px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillStyle = '#fff';
        editorCtx.fillText(el.axis === 'y' ? '↕' : '↔', ex, ey+3);
        editorCtx.textAlign='left';
      } else if(el.kind==='crusher'){
        const bottomEy = (el.bottomY!==undefined ? el.bottomY : EDITOR_GROUND_Y-55) * editorScale;
        editorCtx.strokeStyle = 'rgba(80,60,30,.9)';
        editorCtx.lineWidth = 2;
        editorCtx.beginPath(); editorCtx.moveTo(ex,0); editorCtx.lineTo(ex,ey); editorCtx.stroke();
        editorCtx.strokeStyle = 'rgba(231,76,60,.6)';
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath(); editorCtx.moveTo(ex,ey); editorCtx.lineTo(ex,bottomEy); editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = 'rgba(231,76,60,.3)';
        editorCtx.fillRect(ex-18, bottomEy-18, 36, 36);
        editorCtx.fillStyle = '#3a3f47';
        editorCtx.fillRect(ex-18, ey-18, 36, 36);
        editorCtx.strokeStyle = '#000';
        editorCtx.lineWidth = 2;
        editorCtx.strokeRect(ex-18, ey-18, 36, 36);
        editorCtx.fillStyle = '#e74c3c';
        editorCtx.fillRect(ex-18, ey+9, 36, 9);
        editorCtx.font = 'bold 16px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillStyle = '#fff';
        editorCtx.fillText('💥', ex, ey+6);
        editorCtx.textAlign='left';
      } else if(el.kind==='turret'){
        const dirSign = el.dir>=0 ? 1 : -1;
        const rangeLen = 420*editorScale;
        editorCtx.strokeStyle = 'rgba(255,204,77,.6)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([5,4]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex, ey);
        editorCtx.lineTo(ex + dirSign*rangeLen, ey);
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex+dirSign*rangeLen, ey-6);
        editorCtx.lineTo(ex+dirSign*rangeLen+dirSign*10, ey);
        editorCtx.lineTo(ex+dirSign*rangeLen, ey+6);
        editorCtx.fillStyle = 'rgba(255,204,77,.8)';
        editorCtx.fill();
        editorCtx.fillStyle = '#556070';
        editorCtx.fillRect(ex-11, ey-11, 22, 22);
        editorCtx.fillStyle = '#ffcc4d';
        editorCtx.fillRect(el.dir>=0 ? ex : ex-16, ey-3, 16, 6);
      } else if(el.kind==='boss'){
        const rx = 200*editorScale;
        editorCtx.strokeStyle = 'rgba(192,57,43,.6)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex-rx, ey);
        editorCtx.lineTo(ex+rx, ey);
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = 'rgba(192,57,43,.3)';
        editorCtx.fillRect(ex-rx-16, ey-16, 32, 32);
        editorCtx.fillRect(ex+rx-16, ey-16, 32, 32);
        editorCtx.fillStyle = '#c0392b';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 16, 0, Math.PI*2); editorCtx.fill();
        editorCtx.font = 'bold 14px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillText('👹', ex, ey+5);
        editorCtx.textAlign='left';
      }
      editorCtx.restore();
    }

    // start gracza
    editorCtx.fillStyle = '#e74c3c';
    editorCtx.beginPath(); editorCtx.arc((editorSpawn.x-editorScrollX)*editorScale, editorSpawn.y*editorScale, 8, 0, Math.PI*2); editorCtx.fill();
    editorCtx.fillStyle = '#fff'; editorCtx.font = 'bold 9px sans-serif';
    editorCtx.fillText('START', (editorSpawn.x-editorScrollX)*editorScale-14, editorSpawn.y*editorScale-12);

    // checkpoint (slupek stoi na y, wysokosc 220 - jak w grze)
    if(editorCheckpoint){
      const cpx = (editorCheckpoint.x-editorScrollX)*editorScale, cpy = editorCheckpoint.y*editorScale;
      editorCtx.fillStyle = '#b8bcc6';
      editorCtx.fillRect(cpx, cpy-220*editorScale, 2, 220*editorScale);
      editorCtx.fillStyle = '#2ecc71';
      editorCtx.beginPath();
      editorCtx.moveTo(cpx+2, cpy-220*editorScale+4); editorCtx.lineTo(cpx+16, cpy-220*editorScale+10); editorCtx.lineTo(cpx+2, cpy-220*editorScale+16);
      editorCtx.fill();
      editorCtx.fillStyle = '#fff'; editorCtx.font = 'bold 9px sans-serif';
      editorCtx.fillText('CHECKPOINT', cpx-22, cpy-220*editorScale-4);
    }

    // flaga
    if(editorFlag){
      editorCtx.fillStyle = '#e74c3c';
      const fx = (editorFlag.x-editorScrollX)*editorScale, fy = editorFlag.y*editorScale;
      editorCtx.fillRect(fx, fy, 2, 220*editorScale);
      editorCtx.beginPath();
      editorCtx.moveTo(fx+2, fy+4); editorCtx.lineTo(fx+16, fy+10); editorCtx.lineTo(fx+2, fy+16);
      editorCtx.fill();
    }
  }

  // ---------- COFANIE (Ctrl+Z, maks. 3 kroki) ----------
  const EDITOR_UNDO_MAX = 3;
  let editorUndoStack = [];   // zserializowane stany "przed zmiana"
  function editorSnapshotJSON(){
    return JSON.stringify({ els: editorElements, spawn: editorSpawn, flag: editorFlag, cp: editorCheckpoint });
  }
  function editorPushUndo(beforeJSON){
    editorUndoStack.push(beforeJSON);
    if(editorUndoStack.length > EDITOR_UNDO_MAX) editorUndoStack.shift();
  }
  function editorUndoFlash(msg, color){
    const el = document.getElementById('editorSaveResult');
    if(!el) return;
    el.textContent = msg;
    el.style.color = color || '';
    clearTimeout(editorLimitWarnTimeout);
    editorLimitWarnTimeout = setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 1800);
  }
  function editorUndo(){
    if(editorUndoStack.length === 0){
      editorUndoFlash('↩ Nie ma czego cofać (maks. 3 cofnięcia)', '#ffd23f');
      return;
    }
    const st = JSON.parse(editorUndoStack.pop());
    editorElements = st.els;
    editorSpawn = st.spawn;
    editorFlag = st.flag;
    editorCheckpoint = st.cp;
    editorDrag = null;
    redrawEditor();
    editorUndoFlash('↩ Cofnięto (pozostało ' + editorUndoStack.length + ')', '#9be7a2');
  }
  window.addEventListener('keydown', (e) => {
    if(!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyZ') return;
    if(editorScreen.classList.contains('hidden')) return;
    const t = e.target && e.target.tagName;
    if(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return; // w polach tekstowych zostaje zwykle cofanie tekstu
    e.preventDefault();
    editorUndo();
  });

  let editorLimitWarnTimeout = null;
  function editorFlashLimitWarning(msg){
    const el = document.getElementById('editorSaveResult');
    if(!el) return;
    el.textContent = '⚠ ' + msg;
    el.style.color = '#ff6b6b';
    clearTimeout(editorLimitWarnTimeout);
    editorLimitWarnTimeout = setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 2000);
  }

  // odleglosc punktu od slupka checkpointa (odcinek od y-220 do y)
  function editorCheckpointDist(levelX, levelY){
    const top = editorCheckpoint.y - 220, bot = editorCheckpoint.y;
    const dy = levelY < top ? top - levelY : (levelY > bot ? levelY - bot : 0);
    return Math.hypot(editorCheckpoint.x - levelX, dy);
  }

  let editorShiftHeld = false;   // ustawiane przy kliknieciu (Shift + klik = dlugi odcinek gruntu)
  // odleglosc punktu od elementu; dla elementow o szerokosci liczymy do najblizszego punktu na ich dlugosci
  function editorEraseDist(el, levelX, levelY){
    const ey = el.y!==undefined ? el.y : (el.kind==='crusher' ? el.topY : levelY);
    let dx = el.x - levelX;
    if(el.w !== undefined && (el.kind==='ground' || el.kind==='platform' || el.kind==='pipe' || el.kind==='hazard')){
      dx = levelX < el.x ? el.x - levelX : (levelX > el.x + el.w ? levelX - (el.x + el.w) : 0);
    }
    return Math.hypot(dx, ey - levelY);
  }

  function editorPlaceAt(levelX, levelY){
    if(editorTool === 'erase'){
      let bestIdx = -1, bestDist = 9999;
      editorElements.forEach((el,i) => {
        const d = editorEraseDist(el, levelX, levelY);
        if(d < bestDist){ bestDist = d; bestIdx = i; }
      });
      const dCp = editorCheckpoint ? editorCheckpointDist(levelX, levelY) : 9999;
      if(dCp < bestDist && dCp < 120){ editorCheckpoint = null; }
      else if(bestIdx >= 0 && bestDist < 120) editorElements.splice(bestIdx,1);
      redrawEditor();
      return;
    }
    if(editorTool === 'spawn'){ editorSpawn = {x:levelX, y:levelY}; redrawEditor(); return; }
    if(editorTool === 'flag'){ editorFlag = {x:levelX, y:levelY}; redrawEditor(); return; }
    if(editorTool === 'checkpoint'){ editorCheckpoint = {x:levelX, y:EDITOR_GROUND_Y}; redrawEditor(); return; }
    if(editorTool === 'ground'){ editorElements.push({kind:'ground', x:levelX, y:EDITOR_GROUND_Y, w: editorShiftHeld ? 1000 : 200}); }
    else if(editorTool === 'platform'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:22}); }
    else if(editorTool === 'trampoline'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:20, isTrampoline:true}); }
    else if(editorTool === 'crumbler'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:20, isCrumbler:true}); }
    else if(editorTool === 'pipe'){ editorElements.push({kind:'pipe', x:levelX, w:46, h:60}); }
    else if(editorTool === 'coin'){
      const coinCount = editorElements.filter(e=>e.kind==='coin').length;
      if(coinCount >= 40){
        editorFlashLimitWarning('Maksymalnie 40 monet na poziom!');
        return;
      }
      editorElements.push({kind:'coin', x:levelX, y:levelY});
    }
    else if(editorTool === 'walker'){ editorElements.push({kind:'enemy', enemyType:'walker', x:levelX, y:levelY}); }
    else if(editorTool === 'flyer'){ editorElements.push({kind:'enemy', enemyType:'flyer', x:levelX, y:levelY}); }
    else if(editorTool === 'jumper'){ editorElements.push({kind:'enemy', enemyType:'jumper', x:levelX, y:levelY}); }
    else if(editorTool === 'hazard'){ editorElements.push({kind:'hazard', x:levelX, w:40}); }
    else if(editorTool === 'mover'){ editorElements.push({kind:'mover', x:levelX, y:levelY, axis:'x', range:60}); }
    else if(editorTool === 'mover_y'){ editorElements.push({kind:'mover', x:levelX, y:levelY, axis:'y', range:110}); }
    else if(editorTool === 'crusher'){ editorElements.push({kind:'crusher', x:levelX, w:50, h:50, topY:80, bottomY:EDITOR_GROUND_Y-55, speed:1.0, t:0}); }
    else if(editorTool === 'turret'){
      const dir = levelX < editorLevelW/2 ? 1 : -1;
      editorElements.push({kind:'turret', x:levelX, y:EDITOR_GROUND_Y-90, dir, interval:245});
    }
    else if(editorTool === 'boss'){
      const existing = editorElements.findIndex(e=>e.kind==='boss');
      if(existing >= 0) editorElements.splice(existing,1);
      editorElements.push({kind:'boss', x:levelX, y:EDITOR_GROUND_Y-90});
    }
    redrawEditor();
  }

  function editorPointFromEvent(e){
    const rect = editorCanvas.getBoundingClientRect();
    const cx = (e.clientX-rect.left) * (editorCanvas.width/rect.width);
    const cy = (e.clientY-rect.top) * (editorCanvas.height/rect.height);
    return { levelX: cx/editorScale + editorScrollX, levelY: cy/editorScale };
  }

  function editorFindDraggable(levelX, levelY){
    let best = null, bestDist = 90;
    const dSpawn = Math.hypot(editorSpawn.x-levelX, editorSpawn.y-levelY);
    if(dSpawn < bestDist){ bestDist = dSpawn; best = {kind:'spawn'}; }
    if(editorFlag){
      const dFlag = Math.hypot(editorFlag.x-levelX, editorFlag.y-levelY);
      if(dFlag < bestDist){ bestDist = dFlag; best = {kind:'flag'}; }
    }
    if(editorCheckpoint){
      const dCp = editorCheckpointDist(levelX, levelY);
      if(dCp < bestDist){ bestDist = dCp; best = {kind:'checkpoint'}; }
    }
    for(let i=editorElements.length-1;i>=0;i--){
      const el = editorElements[i];
      const ey = el.y!==undefined ? el.y : (el.kind==='crusher' ? el.topY : levelY);
      const d = Math.hypot(el.x-levelX, ey-levelY);
      if(d < bestDist){ bestDist = d; best = {kind:'element', el}; }
    }
    return best;
  }

  let editorDrag = null;
  let editorDragMoved = false;
  let editorSuppressClick = false;

  let editorDragBefore = null;
  editorCanvas.addEventListener('mousedown', (e) => {
    const {levelX, levelY} = editorPointFromEvent(e);
    editorDragMoved = false;
    editorDrag = editorFindDraggable(levelX, levelY);
    editorDragBefore = editorDrag ? editorSnapshotJSON() : null;
  });

  window.addEventListener('mousemove', (e) => {
    if(!editorDrag) return;
    editorDragMoved = true;
    const {levelX, levelY} = editorPointFromEvent(e);
    const sx = editorSnap(levelX, 20), sy = editorSnap(levelY, 20);
    if(editorDrag.kind === 'spawn'){ editorSpawn.x = Math.max(0, sx); editorSpawn.y = sy; }
    else if(editorDrag.kind === 'flag'){ editorFlag.x = Math.max(0, sx); editorFlag.y = sy; }
    else if(editorDrag.kind === 'checkpoint'){ editorCheckpoint.x = Math.max(0, sx); }
    else if(editorDrag.kind === 'element'){
      editorDrag.el.x = Math.max(0, sx);
      if(editorDrag.el.kind === 'crusher'){
        const range = editorDrag.el.bottomY - editorDrag.el.topY;
        editorDrag.el.topY = Math.max(20, sy);
        editorDrag.el.bottomY = editorDrag.el.topY + range;
      } else if(editorDrag.el.y !== undefined){
        editorDrag.el.y = sy;
      }
    }
    redrawEditor();
  });

  window.addEventListener('mouseup', () => {
    if(editorDrag && editorDragMoved){
      editorSuppressClick = true;
      if(editorDragBefore !== null && editorDragBefore !== editorSnapshotJSON()) editorPushUndo(editorDragBefore);
    }
    editorDrag = null;
    editorDragBefore = null;
  });

  editorCanvas.addEventListener('click', (e) => {
    if(editorSuppressClick){ editorSuppressClick = false; return; }
    const {levelX, levelY} = editorPointFromEvent(e);
    const before = editorSnapshotJSON();
    editorShiftHeld = !!e.shiftKey;
    editorPlaceAt(editorSnap(levelX, 20), editorSnap(levelY, 20));
    editorShiftHeld = false;
    if(editorSnapshotJSON() !== before) editorPushUndo(before);   // tylko gdy cos sie realnie zmienilo
  });
  document.getElementById('btnEditorUndo').onclick = editorUndo;

  document.querySelectorAll('.editor-tool').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.editor-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorTool = btn.dataset.tool;
    };
  });

  document.getElementById('createLevelCorner').onclick = () => {
    showScreen('editor');
  };
  document.getElementById('btnEditorBack').onclick = () => showScreen('menu');
  function editorResetBlank(){
    editorUndoStack = [];
    editorEditingCode = null;
    editorElements = [];
    editorApplyLength(EDITOR_LENGTH_DEFAULT);
    editorSpawn = { x:40, y:EDITOR_GROUND_Y-54 };
    editorFlag = { x:editorLevelW-150, y:EDITOR_GROUND_Y-220 };
    editorCheckpoint = null;
    document.getElementById('editorLevelName').value = '';
    document.getElementById('editorSaveResult').textContent = '';
    editorSetScroll(0);
    redrawEditor();
  };
  document.getElementById('editorBgSelect').onchange = redrawEditor;
  document.getElementById('btnEditorClear').onclick = () => {
    if(!confirm('Wyczyścić cały poziom w edytorze? Niezapisane zmiany przepadną.')) return;
    editorResetBlank();
  };

  document.getElementById('myLevelsCorner').onclick = () => showScreen('myLevels');
  document.getElementById('btnMyLevelsBack').onclick = () => showScreen('menu');

  document.getElementById('workshopCorner').onclick = () => showScreen('workshop');
  document.getElementById('btnWorkshopBack').onclick = () => showScreen('menu');

  async function renderWorkshop(){
    const panel = document.getElementById('workshopPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Warsztat wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('custom_levels')
      .select('code,creator_name,level_data,plays')
      .order('plays', { ascending:false })
      .limit(30);
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nikt jeszcze nie opublikował poziomu. Stwórz pierwszy w CREATE LEVEL!</div>';
      return;
    }
    panel.innerHTML = data.map((row,i) => {
      const medal = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : (i+1)+'.';
      const name = escapeHtml((row.level_data && row.level_data.name) || 'Poziom bez nazwy');
      const author = escapeHtml(row.creator_name || 'Nieznany gracz');
      return `
      <div class="my-level-row">
        <div class="my-level-info">
          <div class="my-level-name">${medal} ${name}</div>
          <div class="my-level-code">Autor: ${author} • ▶ ${row.plays||0} razy zagrany • KOD: ${row.code}</div>
        </div>
        <div class="my-level-actions">
          <button class="my-level-btn play" data-code="${row.code}">▶ GRAJ</button>
        </div>
      </div>
    `;
    }).join('');

    panel.querySelectorAll('.my-level-btn.play').forEach(btn => {
      btn.onclick = async () => {
        const res = await loadCustomLevelByCode(btn.dataset.code);
        if(res.error){ alert(res.error); return; }
        showScreen('game');
        startLevel('custom', res.data);
      };
    });
  }

  document.getElementById('btnSpeedrun').onclick = () => showScreen('speedrun');
  document.getElementById('btnSpeedrunBack').onclick = () => showScreen('menu');
  document.getElementById('speedrunLevelSelect').onchange = renderSpeedrunBoard;

  function ensureSpeedrunSelectOptions(){
    const sel = document.getElementById('speedrunLevelSelect');
    if(sel.options.length === LEVELS.length) return;
    sel.innerHTML = LEVELS.map((_,i) => `<option value="${i}">Poziom ${i+1}</option>`).join('');
  }

  async function renderSpeedrunBoard(){
    ensureSpeedrunSelectOptions();
    const sel = document.getElementById('speedrunLevelSelect');
    const levelIndex = Number(sel.value || 0);
    const panel = document.getElementById('speedrunPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('level_times')
      .select('display_name,time_ms')
      .eq('level_index', levelIndex)
      .order('time_ms', { ascending:true })
      .limit(10);
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nikt jeszcze nie ukończył tego poziomu na czas. Bądź pierwszy!</div>';
      return;
    }
    panel.innerHTML = data.map((row,i) => {
      const name = escapeHtml(row.display_name || 'Gracz');
      const isMe = currentUser && row.display_name === state.displayName;
      const medal = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : (i+1)+'.';
      return `<div class="my-level-row"${isMe ? ' style="color:#ffd23f;font-weight:bold;"' : ''}>
        <div class="my-level-info">
          <div class="my-level-name">${medal} ${name}</div>
        </div>
        <div class="my-level-actions"><span class="my-level-code">⏱ ${formatRunTime(row.time_ms)}</span></div>
      </div>`;
    }).join('');
  }

  async function saveSpeedrunTime(levelIndex, timeMs){
    if(!sb || !currentUser) return;
    try {
      const { data: existing } = await sb.from('level_times')
        .select('time_ms')
        .eq('user_id', currentUser.id)
        .eq('level_index', levelIndex)
        .maybeSingle();
      if(existing && existing.time_ms <= timeMs) return; // stary czas juz jest lepszy lub taki sam
      await sb.from('level_times').upsert({
        user_id: currentUser.id,
        level_index: levelIndex,
        display_name: state.displayName,
        time_ms: Math.round(timeMs),
      }, { onConflict: 'user_id,level_index' });
    } catch(e){ /* ciche niepowodzenie - nie przerywaj rozgrywki */ }
  }

  function formatBytes(n){
    if(n < 1024) return n + ' B';
    return (n/1024).toFixed(1) + ' KB';
  }

  function builtInLevelToEditorData(index){
    // jesli juz istnieje zapisana poprawka, jest ona JUZ w formacie edytora
    // (bo to dokladnie to, co zapisal collectEditorData przy poprzednim zapisie) -
    // uzywamy jej wprost, bez ponownej konwersji z formatu "surowego" poziomu gry,
    // bo to psulo m.in. grunt (ktory w formacie edytora jest osobnym polem "grounds",
    // a nie plaskim platforms z flaga isGround jak w surowym poziomie gry)
    if(builtInOverrides[index]) return JSON.parse(JSON.stringify(builtInOverrides[index]));

    const raw = (LEVELS[index])();
    const grounds = (raw.platforms||[]).filter(p=>p.isGround).map(p=>({x:p.x, y:p.y, w:p.w}));
    const plats = (raw.platforms||[]).filter(p=>!p.isGround).map(p=>({x:p.x, y:p.y, w:p.w, h:p.h, isTrampoline:p.isTrampoline, isCrumbler:p.isCrumbler}));
    const pipes = (raw.pipes||[]).map(p=>({x:p.x, w:p.w, h:p.h}));
    const coins = (raw.coins||[]).map(c=>({x:c.x, y:c.y}));
    const bossEnemy = (raw.enemies||[]).find(e=>e.type==='boss');
    const enemies = (raw.enemies||[]).filter(e=>e.type!=='boss').map(e=>({x:e.x, y:e.y, enemyType: e.type || 'walker'}));
    const hazards = (raw.hazards||[]).map(h=>({x:h.x, w:h.w}));
    const movers = (raw.movers||[]).map(m=>({x:m.baseX!==undefined?m.baseX:m.x, y:m.baseY!==undefined?m.baseY:m.y, axis:m.axis, range:m.range}));
    const crushers = (raw.crushers||[]).map(c=>({x:c.x, w:c.w, h:c.h, topY:c.topY, bottomY:c.bottomY, speed:c.speed, t:c.t}));
    const shooters = (raw.shooters||[]).map(s=>({x:s.x, y:s.y, dir:s.dir, interval:s.interval}));
    return {
      name: raw.name, bg: raw.bg || 'day', width: raw.width || 2000,
      grounds, platforms: plats, pipes, coins, enemies, hazards, movers, crushers, shooters,
      boss: bossEnemy ? {x:bossEnemy.x, y:bossEnemy.y} : null,
      flag: raw.flag ? {x:raw.flag.x, y:raw.flag.y} : null,
      checkpoint: raw.checkpoint ? {x:raw.checkpoint.x, y:raw.checkpoint.y} : null,
      spawn: {x:40, y:GROUND_Y-54},
    };
  }

  function loadLevelDataIntoEditor(code, data){
    editorUndoStack = [];
    editorEditingCode = code;
    editorElements = [];
    const loadedW = Math.round(Number(data.width));
    editorApplyLength((loadedW >= EDITOR_LENGTH_MIN && loadedW <= EDITOR_LENGTH_MAX) ? loadedW : EDITOR_LENGTH_DEFAULT);
    (data.grounds||[]).forEach(g => editorElements.push({kind:'ground', x:g.x, y: g.y!==undefined ? g.y : EDITOR_GROUND_Y, w:g.w}));
    const isBuiltinLoad = String(code).startsWith('BUILTIN:');
    (data.platforms||[]).forEach(p => {
      let px = p.x, pw = p.w;
      // wbudowane poziomy: waskie platformy poszerzamy do MIN_PLATFORM_W (jak w grze), zeby edytor pokazywal to samo
      if(isBuiltinLoad && p.h < 40 && pw < MIN_PLATFORM_W){ px -= (MIN_PLATFORM_W - pw)/2; pw = MIN_PLATFORM_W; }
      editorElements.push({kind:'platform', x:px, y:p.y, w:pw, h:p.h, isTrampoline:p.isTrampoline, isCrumbler:p.isCrumbler});
    });
    (data.pipes||[]).forEach(p => editorElements.push({kind:'pipe', x:p.x, w:p.w, h:p.h}));
    (data.coins||[]).forEach(c => editorElements.push({kind:'coin', x:c.x, y:c.y}));
    (data.enemies||[]).forEach(e => editorElements.push({kind:'enemy', x:e.x, y:e.y, enemyType:e.enemyType}));
    (data.hazards||[]).forEach(h => editorElements.push({kind:'hazard', x:h.x, w:h.w}));
    (data.movers||[]).forEach(m => editorElements.push({kind:'mover', x:m.x, y:m.y, axis:m.axis||'x', range:m.range || (m.axis==='y' ? 110 : 60)}));
    (data.crushers||[]).forEach(c => editorElements.push({kind:'crusher', x:c.x, w:c.w, h:c.h, topY:c.topY, bottomY:c.bottomY, speed:c.speed, t:c.t}));
    (data.shooters||[]).forEach(s => editorElements.push({kind:'turret', x:s.x, y:s.y, dir:s.dir, interval:s.interval}));
    if(data.boss) editorElements.push({kind:'boss', x:data.boss.x, y:data.boss.y});
    editorCheckpoint = data.checkpoint ? {x:data.checkpoint.x, y:data.checkpoint.y} : null;
    editorSpawn = data.spawn ? {x:data.spawn.x, y:data.spawn.y} : {x:40, y:EDITOR_GROUND_Y-54};
    editorFlag = data.flag ? {x:data.flag.x, y:data.flag.y} : {x:editorLevelW-150, y:EDITOR_GROUND_Y-220};
    document.getElementById('editorLevelName').value = data.name || '';
    document.getElementById('editorBgSelect').value = data.bg || 'day';
    document.getElementById('editorSaveResult').textContent = String(code).startsWith('BUILTIN:')
      ? `✏️ Edytujesz WBUDOWANY poziom ${Number(String(code).split(':')[1])+1}. Zapisz, żeby poprawka obowiązywała od razu wszystkich graczy.`
      : `✏️ Edytujesz istniejący poziom (kod ${code}). Zapisz, żeby nadpisać go zmianami.`;
    editorSetScroll(0);
    redrawEditor();
  }

  function renderAdminBuiltInLevels(){
    const panel = document.getElementById('adminLevelsPanel');
    if(!isTester()){ panel.innerHTML = ''; return; }
    panel.innerHTML = `<div class="my-levels-empty" style="padding:6px 20px;color:#ffd23f;font-weight:bold;">🛠️ ADMIN: EDYCJA WBUDOWANYCH POZIOMÓW</div>` +
      LEVELS.map((lvlFn, i) => {
        const overridden = !!builtInOverrides[i];
        const name = (builtInOverrides[i] ? builtInOverrides[i].name : lvlFn().name) || ('Poziom ' + (i+1));
        return `
        <div class="my-level-row">
          <div class="my-level-info">
            <div class="my-level-name">${i+1}. ${escapeHtml(name)}${overridden ? ' <span style="color:#2ecc71;">(poprawiony)</span>' : ''}</div>
          </div>
          <div class="my-level-actions">
            <button class="my-level-btn edit" data-idx="${i}">✏️ EDYTUJ</button>
          </div>
        </div>`;
      }).join('');
    panel.querySelectorAll('.my-level-btn.edit').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const data = builtInLevelToEditorData(idx);
        loadLevelDataIntoEditor('BUILTIN:' + idx, data);
        showScreen('editor');
      };
    });
  }

  async function renderMyLevels(){
    const panel = document.getElementById('myLevelsPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    if(!currentUser){
      panel.innerHTML = '<div class="my-levels-empty">Zaloguj się przez Google, żeby zobaczyć swoje poziomy.</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('custom_levels')
      .select('code, level_data, created_at')
      .eq('creator_id', currentUser.id)
      .order('created_at', { ascending:false });
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nie masz jeszcze żadnych poziomów. Kliknij 🛠️ CREATE LEVEL, żeby stworzyć pierwszy!</div>';
      return;
    }
    panel.innerHTML = data.map(row => {
      const sizeBytes = new Blob([JSON.stringify(row.level_data)]).size;
      return `
      <div class="my-level-row">
        <div class="my-level-info">
          <div class="my-level-name">${escapeHtml(row.level_data.name || 'Poziom bez nazwy')}</div>
          <div class="my-level-code">KOD: ${row.code} • Waga: ${formatBytes(sizeBytes)}</div>
        </div>
        <div class="my-level-actions">
          <button class="my-level-btn play" data-code="${row.code}">▶ GRAJ</button>
          <button class="my-level-btn edit" data-code="${row.code}">✏️ EDYTUJ</button>
          <button class="my-level-btn delete" data-code="${row.code}">🗑 USUŃ</button>
        </div>
      </div>
    `;
    }).join('');

    panel.querySelectorAll('.my-level-btn.play').forEach(btn => {
      btn.onclick = async () => {
        const res = await loadCustomLevelByCode(btn.dataset.code);
        if(res.error){ alert(res.error); return; }
        showScreen('game');
        startLevel('custom', res.data);
      };
    });
    panel.querySelectorAll('.my-level-btn.edit').forEach(btn => {
      btn.onclick = () => {
        const row = data.find(r => r.code === btn.dataset.code);
        if(!row) return;
        loadLevelDataIntoEditor(row.code, row.level_data);
        showScreen('editor');
      };
    });
    panel.querySelectorAll('.my-level-btn.delete').forEach(btn => {
      btn.onclick = async () => {
        if(!confirm('Na pewno usunąć ten poziom? Tej operacji nie da się cofnąć.')) return;
        const { error } = await sb.from('custom_levels').delete().eq('code', btn.dataset.code).eq('creator_id', currentUser.id);
        if(error){ alert('Błąd usuwania: ' + error.message); return; }
        renderMyLevels();
      };
    });
  }

  function collectEditorData(){
    const grounds = editorElements.filter(e=>e.kind==='ground').map(e=>({x:e.x,y:e.y,w:e.w}));
    const platforms = editorElements.filter(e=>e.kind==='platform').map(e=>({x:e.x,y:e.y,w:e.w,h:e.h,isTrampoline:e.isTrampoline,isCrumbler:e.isCrumbler}));
    const pipes = editorElements.filter(e=>e.kind==='pipe').map(e=>({x:e.x,w:e.w,h:e.h}));
    const coins = editorElements.filter(e=>e.kind==='coin').map(e=>({x:e.x,y:e.y}));
    const enemies = editorElements.filter(e=>e.kind==='enemy').map(e=>({x:e.x,y:e.y,enemyType:e.enemyType}));
    const hazards = editorElements.filter(e=>e.kind==='hazard').map(e=>({x:e.x,w:e.w}));
    const movers = editorElements.filter(e=>e.kind==='mover').map(e=>({x:e.x,y:e.y,axis:e.axis,range:e.range}));
    const crushers = editorElements.filter(e=>e.kind==='crusher').map(e=>({x:e.x,w:e.w,h:e.h,topY:e.topY,bottomY:e.bottomY,speed:e.speed,t:e.t}));
    const shooters = editorElements.filter(e=>e.kind==='turret').map(e=>({x:e.x,y:e.y,dir:e.dir,interval:e.interval}));
    const bossEl = editorElements.find(e=>e.kind==='boss');
    return {
      name: document.getElementById('editorLevelName').value.trim() || 'Poziom bez nazwy',
      bg: document.getElementById('editorBgSelect').value,
      width: editorLevelW,
      grounds, platforms, pipes, coins, enemies, hazards, movers, crushers, shooters,
      boss: bossEl ? {x:bossEl.x, y:bossEl.y} : null,
      flag: editorFlag, spawn: editorSpawn, checkpoint: editorCheckpoint,
    };
  }

  document.getElementById('btnEditorTest').onclick = () => {
    const data = collectEditorData();
    if(data.grounds.length === 0){
      document.getElementById('editorSaveResult').textContent = '⚠ Dodaj chociaż jeden kawałek gruntu!';
      return;
    }
    editorTesting = true;
    showScreen('game');
    startLevel('custom', data);
  };

  document.getElementById('btnEditorSave').onclick = async () => {
    const resultEl = document.getElementById('editorSaveResult');
    if(!sb){ resultEl.textContent = '⚠ Zapis wymaga konta (Supabase).'; return; }
    if(!currentUser){ resultEl.textContent = '⚠ Zaloguj się przez Google, żeby zapisywać poziomy.'; return; }
    const data = collectEditorData();
    if(data.grounds.length === 0){
      resultEl.textContent = '⚠ Dodaj chociaż jeden kawałek gruntu, zanim zapiszesz!';
      return;
    }
    if(editorEditingCode && String(editorEditingCode).startsWith('BUILTIN:')){
      if(!isTester()){ resultEl.textContent = '⚠ Tylko admin może edytować wbudowane poziomy.'; return; }
      const levelIndex = Number(String(editorEditingCode).split(':')[1]);
      resultEl.textContent = 'Zapisywanie poprawki do wbudowanego poziomu...';
      const { error } = await sb.from('level_overrides').upsert({
        level_index: levelIndex, level_data: data, updated_by: currentUser.id,
      }, { onConflict: 'level_index' });
      if(error){
        resultEl.textContent = '⚠ Błąd zapisu poprawki: ' + error.message;
        return;
      }
      builtInOverrides[levelIndex] = data;
      resultEl.innerHTML = `✅ Zapisano poprawkę do wbudowanego poziomu ${levelIndex+1}! Zmiana obowiązuje od razu dla wszystkich graczy.`;
      return;
    }
    if(editorEditingCode){
      resultEl.textContent = 'Aktualizowanie...';
      const { error } = await sb.from('custom_levels')
        .update({ level_data: data })
        .eq('code', editorEditingCode)
        .eq('creator_id', currentUser.id);
      if(error){
        resultEl.textContent = '⚠ Błąd aktualizacji: ' + error.message;
        return;
      }
      resultEl.innerHTML = `✅ Zaktualizowano poziom! Kod pozostaje taki sam: <b style="font-size:20px;letter-spacing:4px;">${editorEditingCode}</b>`;
      return;
    }
    resultEl.textContent = 'Sprawdzanie limitu...';
    const { count, error: countError } = await sb.from('custom_levels')
      .select('*', { count:'exact', head:true })
      .eq('creator_id', currentUser.id);
    if(countError){ resultEl.textContent = '⚠ Błąd sprawdzania limitu: ' + countError.message; return; }
    if((count||0) >= MAX_CUSTOM_LEVELS){
      resultEl.textContent = `⚠ Masz już maksymalną liczbę poziomów (${MAX_CUSTOM_LEVELS}/${MAX_CUSTOM_LEVELS}). Usuń jakiś w "MOJE POZIOMY", żeby zapisać nowy.`;
      return;
    }
    resultEl.textContent = 'Zapisywanie...';
    const code = generateLobbyCode();
    const { error } = await sb.from('custom_levels').insert({
      code, creator_name: state.displayName || 'Gracz', creator_id: currentUser.id, level_data: data
    });
    if(error){
      resultEl.textContent = '⚠ Błąd zapisu: ' + error.message;
      return;
    }
    editorEditingCode = code;
    resultEl.innerHTML = `✅ Zapisano! Kod poziomu: <b style="font-size:20px;letter-spacing:4px;">${code}</b> — podaj go znajomemu, żeby zagrał na tym samym poziomie (też w multiplayer). Znajdziesz go też w "MOJE POZIOMY".`;
  };

  async function loadCustomLevelByCode(code){
    if(!sb) return { error: 'Multiplayer/poziomy własne wymagają konta (Supabase).' };
    const { data, error } = await sb.from('custom_levels').select('level_data').eq('code', code).single();
    if(error || !data) return { error: 'Nie znaleziono poziomu o tym kodzie.' };
    sb.rpc('increment_level_plays', { p_code: code }).then(()=>{}, ()=>{}); // licznik popularnosci - "fire and forget"
    return { data: data.level_data };
  }

  document.getElementById('btnEditorLoadCode').onclick = async () => {
    const code = document.getElementById('editorLoadCodeInput').value.trim().toUpperCase();
    const errEl = document.getElementById('editorLoadError');
    if(code.length !== 5){ errEl.textContent = 'Kod ma 5 znaków.'; return; }
    errEl.textContent = 'Wczytywanie...';
    const res = await loadCustomLevelByCode(code);
    if(res.error){ errEl.textContent = '⚠ ' + res.error; return; }
    errEl.textContent = '';
    showScreen('game');
    startLevel('custom', res.data);
  };

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
      e.animT = (e.animT||0) + 0.09;

      if(e.type === 'flyer'){
        e.x += e.vx;
        if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
        if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
        e.y = e.baseY + Math.sin(e.animT*0.6) * (e.amp||30);
      } else if(e.type === 'jumper'){
        const hop = Math.abs(Math.sin(e.animT*0.25));
        e.y = e.baseY - hop*(e.jumpHeight||70);
      } else if(e.type === 'boss'){
        e.x += e.vx;
        if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
        if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
        e.y = e.baseY + Math.sin(e.animT*0.8) * 12;
        if(e.hitTimer > 0) e.hitTimer--;
      } else {
        e.x += e.vx;
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
  const WALK_MAX = 2.21; // 2.6 * 0.85 (chod o 15% wolniejszy)
  const RUN_MAX = 4.5; // 5.0 * 0.9 (bieg o 10% wolniejszy)
  const ACCEL = 0.32;
  const DECEL_GROUND = 0.36;
  const DECEL_AIR = 0.16;
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
        e.animT = (e.animT||0) + 0.09;
        if(e.type === 'flyer'){
          e.x += e.vx;
          if(e.x < e.minX){ e.x = e.minX; e.vx = Math.abs(e.vx); }
          if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
          e.y = e.baseY + Math.sin(e.animT*0.6) * (e.amp||30);
        } else if(e.type === 'jumper'){
          const hop = Math.abs(Math.sin(e.animT*0.25));
          e.y = e.baseY - hop*(e.jumpHeight||70);
        } else {
          e.x += e.vx;
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

  function skinColors(){
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    return getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
  }

  function getEffectiveColors(baseColors, hatId, skinToneId){
    const hat = HATS.find(h=>h.id===hatId);
    const tone = SKIN_TONES.find(s=>s.id===skinToneId);
    return {
      hat: (hat && hat.color) ? hat.color : baseColors.hat,
      shirt: baseColors.shirt,
      overalls: baseColors.overalls,
      skin: (tone && tone.color) ? tone.color : baseColors.skin,
    };
  }

  function drawCharacterSprite(targetCtx, c, bob, airborne, flat, shine, sparkle, facialHair, hatStyle){
    const tctx = targetCtx;
    // ---- cien pod stopami ----
    if(!flat){
      tctx.fillStyle = 'rgba(0,0,0,.22)';
      tctx.beginPath();
      tctx.ellipse(20, 57, 15, 4, 0, 0, Math.PI*2);
      tctx.fill();
    }

    if(airborne){
      // ---- buty (podkurczone, skok) ----
      if(flat){ tctx.fillStyle = '#6b4118'; }
      else {
        const shoeGrad = tctx.createRadialGradient(13,44,2,13,46,10);
        shoeGrad.addColorStop(0,'#a9713a'); shoeGrad.addColorStop(1,'#6b4118');
        tctx.fillStyle = shoeGrad;
      }
      tctx.beginPath(); tctx.ellipse(13, 46, 8, 5.5, -0.3, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.ellipse(27, 46, 8, 5.5, 0.3, 0, Math.PI*2); tctx.fill();

      // ---- nogi podkurczone ----
      tctx.fillStyle = flat ? c.overalls : shade(c.overalls, -18);
      roundRectOn(tctx, 7, 36, 12, 12, 4); tctx.fill();
      roundRectOn(tctx, 21, 36, 12, 12, 4); tctx.fill();
    } else {
      // ---- buty ----
      if(flat){ tctx.fillStyle = '#6b4118'; }
      else {
        const shoeGrad = tctx.createRadialGradient(13,50,2,13,52,10);
        shoeGrad.addColorStop(0,'#a9713a'); shoeGrad.addColorStop(1,'#6b4118');
        tctx.fillStyle = shoeGrad;
      }
      tctx.beginPath(); tctx.ellipse(12, 52+bob, 9, 6, 0, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.ellipse(28, 52-bob, 9, 6, 0, 0, Math.PI*2); tctx.fill();

      // ---- nogi (overall) ----
      tctx.fillStyle = flat ? c.overalls : shade(c.overalls, -18);
      roundRectOn(tctx, 6, 38, 12, 16+bob, 4); tctx.fill();
      roundRectOn(tctx, 22, 38, 12, 16-bob, 4); tctx.fill();
    }

    // ---- tulow / kombinezon ----
    if(flat){ tctx.fillStyle = c.overalls; }
    else {
      const bodyGrad = tctx.createLinearGradient(4,20,36,44);
      bodyGrad.addColorStop(0, shade(c.overalls, 18));
      bodyGrad.addColorStop(1, shade(c.overalls, -12));
      tctx.fillStyle = bodyGrad;
    }
    roundRectOn(tctx, 4, 22, 32, 22, 8); tctx.fill();

    // szelki
    tctx.fillStyle = shade(c.overalls, -12);
    roundRectOn(tctx, 10, 15, 7, 10, 3); tctx.fill();
    roundRectOn(tctx, 23, 15, 7, 10, 3); tctx.fill();

    // guziki
    tctx.fillStyle = '#ffd23f';
    tctx.beginPath(); tctx.arc(13, 26, 2.6, 0, Math.PI*2); tctx.fill();
    tctx.beginPath(); tctx.arc(27, 26, 2.6, 0, Math.PI*2); tctx.fill();

    if(airborne){
      // ---- rece uniesione w gore (skok) ----
      tctx.fillStyle = flat ? c.shirt : (() => {
        const g = tctx.createLinearGradient(-4,0,4,20);
        g.addColorStop(0, shade(c.shirt,16)); g.addColorStop(1, shade(c.shirt,-10));
        return g;
      })();
      tctx.save();
      tctx.translate(3, 20); tctx.rotate(-0.55);
      roundRectOn(tctx, -5, -18, 10, 20, 5); tctx.fill();
      tctx.restore();
      tctx.save();
      tctx.translate(37, 20); tctx.rotate(0.55);
      roundRectOn(tctx, -5, -18, 10, 20, 5); tctx.fill();
      tctx.restore();

      // rekawiczki uniesione
      if(flat){ tctx.fillStyle = '#e8e8e8'; }
      else {
        const gloveGrad = tctx.createRadialGradient(1,0,1,1,0,7);
        gloveGrad.addColorStop(0,'#ffffff'); gloveGrad.addColorStop(1,'#d8d8d8');
        tctx.fillStyle = gloveGrad;
      }
      tctx.beginPath(); tctx.arc(-3, -1, 6.5, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.arc(43, -1, 6.5, 0, Math.PI*2); tctx.fill();
    } else {
      // ---- rece / rekawy ----
      if(flat){ tctx.fillStyle = c.shirt; }
      else {
        const sleeveGrad = tctx.createLinearGradient(-4,16,4,34);
        sleeveGrad.addColorStop(0, shade(c.shirt,16));
        sleeveGrad.addColorStop(1, shade(c.shirt,-10));
        tctx.fillStyle = sleeveGrad;
      }
      roundRectOn(tctx, -3, 17, 10, 20, 5); tctx.fill();
      roundRectOn(tctx, 33, 17, 10, 20, 5); tctx.fill();

      // rekawiczki
      if(flat){ tctx.fillStyle = '#e8e8e8'; }
      else {
        const gloveGrad = tctx.createRadialGradient(1,36,1,1,36,7);
        gloveGrad.addColorStop(0,'#ffffff'); gloveGrad.addColorStop(1,'#d8d8d8');
        tctx.fillStyle = gloveGrad;
      }
      tctx.beginPath(); tctx.arc(2, 36-bob*1.5, 6.5, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.arc(38, 36+bob*1.5, 6.5, 0, Math.PI*2); tctx.fill();
    }

    // ---- koszula pod szyja ----
    tctx.fillStyle = flat ? c.shirt : shade(c.shirt, 6);
    roundRectOn(tctx, 6, 16, 28, 9, 4); tctx.fill();

    // ---- glowa ----
    if(flat){ tctx.fillStyle = c.skin; }
    else {
      const headGrad = tctx.createRadialGradient(15,10,2,20,14,16);
      headGrad.addColorStop(0, shade(c.skin, 20));
      headGrad.addColorStop(1, shade(c.skin, -8));
      tctx.fillStyle = headGrad;
    }
    tctx.beginPath(); tctx.ellipse(20, 12, 13, 12, 0, 0, Math.PI*2); tctx.fill();

    // uszy
    tctx.fillStyle = shade(c.skin, -6);
    tctx.beginPath(); tctx.ellipse(8, 13, 3, 4, 0, 0, Math.PI*2); tctx.fill();

    // brwi - osobna nad kazdym okiem, lekko opadajace ku nosowi (przyjazny wyraz)
    tctx.strokeStyle = '#3a2a1a';
    tctx.lineWidth = 2;
    tctx.lineCap = 'round';
    if(airborne){
      tctx.beginPath(); tctx.moveTo(17.5, 3.6); tctx.quadraticCurveTo(21, 1.8, 25, 2.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(26.5, 2.4); tctx.quadraticCurveTo(29.5, 1.8, 32, 3.4); tctx.stroke();
    } else {
      tctx.beginPath(); tctx.moveTo(17.5, 5.2); tctx.quadraticCurveTo(21, 3.6, 25, 4.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(26.5, 4.4); tctx.quadraticCurveTo(29.5, 3.6, 32, 5.2); tctx.stroke();
    }

    // oczy - dwa, male i blisko siebie (widok lekko z ukosa); zrenice patrza w prawo, w skoku szerzej otwarte
    const eyeY = airborne ? 9.6 : 10.4;
    const eyeH = airborne ? 3.6 : 3.0;
    // blizsze oko
    tctx.fillStyle = '#fff';
    tctx.beginPath(); tctx.ellipse(21.8, eyeY, 2.5, eyeH, 0, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#2e6bd6';
    tctx.beginPath(); tctx.arc(22.5, eyeY + 0.3, 1.5, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#111';
    tctx.beginPath(); tctx.arc(22.9, eyeY + 0.3, 0.8, 0, Math.PI*2); tctx.fill();
    // dalsze oko (troche mniejsze)
    tctx.fillStyle = '#fff';
    tctx.beginPath(); tctx.ellipse(28.4, eyeY, 2.2, eyeH - 0.2, 0, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#2e6bd6';
    tctx.beginPath(); tctx.arc(29.0, eyeY + 0.3, 1.3, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#111';
    tctx.beginPath(); tctx.arc(29.4, eyeY + 0.3, 0.7, 0, Math.PI*2); tctx.fill();

    // nos: maly, w kolorze skory, z lekkim cieniem od dolu (bez rozowej poswiaty)
    if(!flat){
      tctx.fillStyle = shade(c.skin, -14);
      tctx.beginPath(); tctx.ellipse(25.3, 16.5, 3.1, 2.5, 0, 0, Math.PI*2); tctx.fill();
    }
    tctx.fillStyle = c.skin;
    tctx.beginPath(); tctx.ellipse(25.3, 15.7, 3.1, 2.5, 0, 0, Math.PI*2); tctx.fill();

    // ---- zarost (wasy / broda / kozia brodka / brak) ----
    const fh = facialHair || 'mustache';
    tctx.fillStyle = '#3a2a1a';
    if(fh === 'mustache'){
      tctx.beginPath();
      tctx.moveTo(18, 17);
      tctx.quadraticCurveTo(24, 14, 30, 17.5);
      tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
    } else if(fh === 'beard'){
      tctx.beginPath();
      tctx.moveTo(8.5, 11.5); tctx.quadraticCurveTo(12, 15, 19, 16.6); tctx.quadraticCurveTo(24.5, 14.6, 30.3, 16.8); tctx.quadraticCurveTo(33, 15.2, 33, 11.5);
      tctx.bezierCurveTo(34, 21, 28.5, 27.5, 20.7, 27.5); tctx.bezierCurveTo(12.5, 27.5, 7.5, 21, 8.5, 11.5);
      tctx.closePath(); tctx.fill();
    } else if(fh === 'goatee'){
      tctx.beginPath();
      tctx.moveTo(18, 17);
      tctx.quadraticCurveTo(24, 14, 30, 17.5);
      tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
      tctx.beginPath();
      tctx.ellipse(24, 21, 4, 4.5, 0, 0, Math.PI*2);
      tctx.fill();
    }
    else if(fh === 'pencil'){
      tctx.strokeStyle = '#3a2a1a'; tctx.lineWidth = 1.4; tctx.lineCap = 'round';
      tctx.beginPath(); tctx.moveTo(19, 17.4); tctx.quadraticCurveTo(24, 15.7, 30, 17.7); tctx.stroke();
    } else if(fh === 'stubble'){
      tctx.fillStyle = 'rgba(58,42,26,.5)';
      for(let i = 0; i < 130; i++){
        const r1 = Math.abs((Math.sin(i*12.9898)*43758.5453) % 1), r2 = Math.abs((Math.sin(i*78.233)*12345.6789) % 1);
        const dx = 11.5 + r1*20.5, dy = 15.5 + r2*9;
        if(((dx-20)/13)**2 + ((dy-12)/12)**2 <= 0.85){ tctx.beginPath(); tctx.arc(dx, dy, 0.5, 0, Math.PI*2); tctx.fill(); }
      }
    } else if(fh === 'sideburns'){
      // baki: waski pas od ucha wzdluz szczeki + wasy
      tctx.beginPath();
      tctx.moveTo(8.8, 8.5); tctx.quadraticCurveTo(9, 17, 14.5, 20.2); tctx.lineTo(15.2, 18.2); tctx.quadraticCurveTo(12, 16, 12.2, 8.5);
      tctx.closePath(); tctx.fill();
      tctx.beginPath();
      tctx.moveTo(18, 17); tctx.quadraticCurveTo(24, 14, 30, 17.5); tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
    } else if(fh === 'handlebar'){
      tctx.strokeStyle = '#3a2a1a'; tctx.lineWidth = 3; tctx.lineCap = 'round';
      tctx.beginPath(); tctx.moveTo(18.5, 17.6); tctx.quadraticCurveTo(24, 15, 29.5, 17.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(18.5, 17.6); tctx.quadraticCurveTo(15, 19.5, 14.5, 15.5); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(29.5, 17.6); tctx.quadraticCurveTo(33.5, 19.5, 33.5, 15.5); tctx.stroke();
    } else if(fh === 'walrus'){
      tctx.beginPath();
      tctx.moveTo(16.5, 16.5); tctx.quadraticCurveTo(24, 12.5, 31.5, 16.5);
      tctx.quadraticCurveTo(33.5, 21.5, 28, 21.5); tctx.quadraticCurveTo(24, 18.5, 20, 21.5);
      tctx.quadraticCurveTo(14.5, 21.5, 16.5, 16.5);
      tctx.fill();
    } else if(fh === 'vandyke'){
      tctx.beginPath();
      tctx.moveTo(18.5, 17); tctx.quadraticCurveTo(24, 14.5, 29.5, 17.3); tctx.quadraticCurveTo(24, 19.6, 18.5, 17);
      tctx.fill();
      tctx.beginPath();
      tctx.moveTo(21, 19.8); tctx.quadraticCurveTo(24, 21.5, 27, 19.8); tctx.lineTo(24, 28); tctx.closePath();
      tctx.fill();
    } else if(fh === 'fullbeard' || fh === 'santa'){
      const santa = (fh === 'santa');
      tctx.fillStyle = santa ? '#f4f4f4' : '#3a2a1a';
      tctx.beginPath();
      tctx.moveTo(8.5, 11.5); tctx.quadraticCurveTo(12, 15, 19, 16.6); tctx.quadraticCurveTo(24.5, 14.6, 30.3, 16.8); tctx.quadraticCurveTo(33, 15.2, 33, 11.5);
      if(santa){
        tctx.bezierCurveTo(35, 26, 29, 35, 20.7, 35); tctx.bezierCurveTo(12.5, 35, 6.5, 26, 8.5, 11.5);
      } else {
        tctx.bezierCurveTo(34.5, 24, 28, 31, 20.7, 37); tctx.bezierCurveTo(13.5, 31, 7, 24, 8.5, 11.5);
      }
      tctx.closePath(); tctx.fill();
      if(santa){ tctx.strokeStyle = 'rgba(0,0,0,.3)'; tctx.lineWidth = 0.9; tctx.stroke(); }
    }
    // 'none' - nic nie rysujemy (gladko ogolony)

    // ---- czapka (fason wybierany w personalizacji) ----
    drawHatStyle(tctx, c, hatStyle || 'cap', flat);

    // HIGH+: polysk na czapce i kombinezonie (dodaje "blasku")
    if(shine && !flat){
      tctx.save();
      tctx.globalAlpha = 0.25;
      tctx.fillStyle = '#ffffff';
      tctx.beginPath();
      tctx.ellipse(11, 0, 7, 3, -0.4, 0, Math.PI*2);
      tctx.fill();
      tctx.beginPath();
      tctx.ellipse(11, 28, 6, 10, -0.3, 0, Math.PI*2);
      tctx.fill();
      tctx.restore();
      // delikatna obwodka wokol glowy (rim light)
      tctx.strokeStyle = 'rgba(255,255,255,.35)';
      tctx.lineWidth = 1;
      tctx.beginPath(); tctx.ellipse(20, 12, 13, 12, 0, -2.4, -0.6); tctx.stroke();
    }

    // ULTRA: iskierki
    if(sparkle){
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.004;
      drawSparkle(tctx, 34, -2, 4.5 + Math.sin(t)*1.8, t);
      drawSparkle(tctx, -1, 30, 3.6 + Math.cos(t*1.3)*1.5, t*1.4);
      drawSparkle(tctx, 39, 30, 3.2 + Math.sin(t*1.6)*1.4, t*1.7);
    }
  }

  function drawHatStyle(t, c, style, flat){
    const raised = (style === 'tophat' || style === 'cowboy' || style === 'wizard' || style === 'helmet' || style === 'sombrero' || style === 'bucket');
    if(raised){ t.save(); t.translate(0, -2); }   // szerokie rondo siedzi wyzej na czole, oczy zostaja widoczne
    const grad = (x0, y0, x1, y1) => {
      if(flat) return c.hat;
      const g = t.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, shade(c.hat, 22)); g.addColorStop(1, shade(c.hat, -10));
      return g;
    };
    if(style === 'tophat'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 18.5, 3.4, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(9, -20, 31, 3); roundRectOn(t, 9, -20, 22, 23, 3); t.fill();
      t.fillStyle = shade(c.hat, -48); t.fillRect(9, -3, 22, 5.5);
    } else if(style === 'beanie'){
      t.fillStyle = grad(6, -10, 34, 4);
      t.beginPath(); t.ellipse(20, 3, 14.5, 13, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -18); roundRectOn(t, 5.5, 0, 29, 6, 3); t.fill();
      t.strokeStyle = 'rgba(0,0,0,.2)'; t.lineWidth = 1;
      for(let x = 8; x < 34; x += 4){ t.beginPath(); t.moveTo(x, 0.8); t.lineTo(x, 5.2); t.stroke(); }
      t.fillStyle = '#fff'; t.beginPath(); t.arc(20, -10.5, 4.6, 0, Math.PI*2); t.fill();
      t.fillStyle = 'rgba(0,0,0,.12)'; t.beginPath(); t.arc(21.4, -9.4, 2.6, 0, Math.PI*2); t.fill();
    } else if(style === 'cowboy'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 20, 4.2, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(10, -12, 30, 3);
      t.beginPath();
      t.moveTo(10, 2.5); t.lineTo(11, -8); t.quadraticCurveTo(15, -13, 20, -7.5);
      t.quadraticCurveTo(25, -13, 29, -8); t.lineTo(30, 2.5); t.closePath(); t.fill();
      t.fillStyle = '#4a2f16'; t.fillRect(10.4, -2, 19.2, 3.6);
    } else if(style === 'crown'){
      const g = flat ? '#ffd23f' : (() => { const q = t.createLinearGradient(8, -13, 32, 5); q.addColorStop(0, '#ffe680'); q.addColorStop(1, '#d9a000'); return q; })();
      t.fillStyle = g;
      t.beginPath();
      t.moveTo(8, 4); t.lineTo(8, -10); t.lineTo(14, -3); t.lineTo(20, -13); t.lineTo(26, -3); t.lineTo(32, -10); t.lineTo(32, 4); t.closePath(); t.fill();
      t.fillStyle = '#e0a800'; t.fillRect(8, -1, 24, 5.5);
      t.fillStyle = c.hat;
      [14, 20, 26].forEach(x => { t.beginPath(); t.arc(x, 1.6, 1.7, 0, Math.PI*2); t.fill(); });
      t.fillStyle = '#fff';
      [[8, -10], [20, -13], [32, -10]].forEach(p => { t.beginPath(); t.arc(p[0], p[1], 1.7, 0, Math.PI*2); t.fill(); });
    } else if(style === 'wizard'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 3, 19.5, 3.7, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(5, -24, 35, 3);
      t.beginPath(); t.moveTo(5, 3); t.quadraticCurveTo(16, -3, 19, -24); t.quadraticCurveTo(30, -15, 35, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -40); t.fillRect(7.5, -1.2, 25, 3.2);
      drawSparkle(t, 17, -9, 2.6, 0.3);
      drawSparkle(t, 25, -3, 2.0, 0.6);
    } else if(style === 'helmet'){
      t.fillStyle = grad(5, -9, 35, 4);
      t.beginPath(); t.ellipse(20, 4, 15, 12.5, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -16); roundRectOn(t, 3, 3, 34, 4.4, 2); t.fill();
      t.fillStyle = shade(c.hat, 12); roundRectOn(t, 17, -9, 6, 12, 2); t.fill();
    } else if(style === 'headband'){
      t.fillStyle = shade(c.hat, -10);
      t.beginPath(); t.moveTo(7.5, 3); t.lineTo(-1, -0.5); t.lineTo(2.5, 4.6); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(7.5, 5); t.lineTo(-2, 8.5); t.lineTo(3.5, 9); t.closePath(); t.fill();
      t.fillStyle = grad(6, 1, 34, 7); roundRectOn(t, 6.5, 1, 27, 5.6, 2.8); t.fill();
      t.fillStyle = '#cfd6df'; roundRectOn(t, 22, 1.8, 8, 4, 1); t.fill();
    } else if(style === 'flatcap'){
      t.fillStyle = grad(6, -8, 34, 4);
      t.beginPath(); t.moveTo(6, 3); t.quadraticCurveTo(5, -9, 20, -9); t.quadraticCurveTo(35, -9, 34.5, 1.5); t.quadraticCurveTo(20, 4.5, 6, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -18);
      t.beginPath(); t.ellipse(31.5, 3.2, 7.5, 2.6, 0.12, 0, Math.PI*2); t.fill();
      t.fillStyle = shade(c.hat, -28); t.beginPath(); t.arc(20, -8.6, 1.4, 0, Math.PI*2); t.fill();
    } else if(style === 'bucket'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 3.5, 17.5, 3.4, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(8, -9, 32, 3);
      t.beginPath(); t.moveTo(8, 3.5); t.lineTo(10, -8); t.quadraticCurveTo(20, -11.5, 30, -8); t.lineTo(32, 3.5); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -32); t.fillRect(8.5, -1.5, 23, 2.6);
      t.strokeStyle = 'rgba(0,0,0,.18)'; t.lineWidth = 0.8;
      t.beginPath(); t.moveTo(9.4, -4.5); t.lineTo(30.6, -4.5); t.stroke();
    } else if(style === 'beret'){
      t.save(); t.translate(19, -1.5); t.rotate(-0.16);
      t.fillStyle = grad(-15, -7, 15, 7);
      t.beginPath(); t.ellipse(0, 0, 15.5, 7.2, 0, 0, Math.PI*2); t.fill();
      t.restore();
      t.fillStyle = shade(c.hat, -32); t.beginPath(); t.arc(20.2, -8, 1.5, 0, Math.PI*2); t.fill();
    } else if(style === 'party'){
      t.fillStyle = grad(11, -20, 29, 2);
      t.beginPath(); t.moveTo(11, 2); t.lineTo(20, -20); t.lineTo(29, 2); t.closePath(); t.fill();
      [['#fff', 17.2, -3], ['#ffd23f', 22.4, -7.5], ['#5ec8ff', 19.6, -12.4], ['#fff', 23.4, -1.2]].forEach(d => { t.fillStyle = d[0]; t.beginPath(); t.arc(d[1], d[2], 1.15, 0, Math.PI*2); t.fill(); });
      t.fillStyle = '#ffd23f'; t.beginPath(); t.arc(20, -20.5, 2.6, 0, Math.PI*2); t.fill();
    } else if(style === 'propeller'){
      t.fillStyle = grad(6, -10, 34, 4);
      t.beginPath(); t.ellipse(20, 3, 14.5, 13, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -18); roundRectOn(t, 5.5, 0, 29, 5, 2.5); t.fill();
      t.strokeStyle = 'rgba(0,0,0,.2)'; t.lineWidth = 0.9;
      [[10, 0], [20, 0], [30, 0]].forEach(q => { t.beginPath(); t.moveTo(20, -9.8); t.quadraticCurveTo((20 + q[0]) / 2 + (q[0] < 20 ? -2 : q[0] > 20 ? 2 : 0), -4, q[0], q[1]); t.stroke(); });
      t.fillStyle = '#555'; t.fillRect(19, -12.5, 2, 3.2);
      t.save(); t.translate(20, -13.4); t.rotate(-0.12);
      t.fillStyle = '#ffd23f'; t.beginPath(); t.ellipse(-6, 0, 6, 1.6, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = '#5ec8ff'; t.beginPath(); t.ellipse(6, 0, 6, 1.6, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = '#333'; t.beginPath(); t.arc(0, 0, 1.7, 0, Math.PI*2); t.fill();
      t.restore();
    } else if(style === 'catears'){
      t.fillStyle = c.hat;
      t.beginPath(); t.moveTo(8.5, 3.5); t.lineTo(7.5, -9.5); t.lineTo(17.5, 1); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(31.5, 3.5); t.lineTo(32.5, -9.5); t.lineTo(22.5, 1); t.closePath(); t.fill();
      t.fillStyle = '#ffb3c7';
      t.beginPath(); t.moveTo(10, 1.4); t.lineTo(9.4, -5.6); t.lineTo(14.4, 0); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(30, 1.4); t.lineTo(30.6, -5.6); t.lineTo(25.6, 0); t.closePath(); t.fill();
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.6, 1.8); t.fill();
    } else if(style === 'fez'){
      t.fillStyle = grad(10, -12, 30, 3);
      t.beginPath(); t.moveTo(9.5, 3); t.lineTo(12, -11); t.lineTo(28, -11); t.lineTo(30.5, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -22); t.beginPath(); t.ellipse(20, -11, 8, 1.9, 0, 0, Math.PI*2); t.fill();
      t.strokeStyle = '#ffd23f'; t.lineWidth = 1.4; t.lineCap = 'round';
      t.beginPath(); t.moveTo(22, -11); t.quadraticCurveTo(32, -13, 31.5, -3.5); t.stroke();
      t.fillStyle = '#ffd23f'; t.beginPath(); t.arc(31.5, -2.4, 1.7, 0, Math.PI*2); t.fill();
    } else if(style === 'santa'){
      t.fillStyle = grad(6, -15, 34, 4);
      t.beginPath(); t.moveTo(6, 3); t.quadraticCurveTo(9, -14, 24, -14); t.quadraticCurveTo(34, -13, 37, -1); t.lineTo(33, 3); t.closePath(); t.fill();
      t.fillStyle = '#f7f7f7'; roundRectOn(t, 5, 0, 30, 6, 3); t.fill();
      t.beginPath(); t.arc(37.5, -0.5, 3.6, 0, Math.PI*2); t.fill();
    } else if(style === 'chef'){
      t.fillStyle = flat ? '#f4f4f4' : (() => { const q = t.createLinearGradient(8, -16, 32, 4); q.addColorStop(0, '#ffffff'); q.addColorStop(1, '#dcdfe6'); return q; })();
      [[12.5, -8, 6.6], [20, -11.5, 7.8], [27.5, -8, 6.6]].forEach(q => { t.beginPath(); t.arc(q[0], q[1], q[2], 0, Math.PI*2); t.fill(); });
      roundRectOn(t, 9, -8, 22, 12, 3); t.fill();
      t.fillStyle = c.hat; t.fillRect(9, 0, 22, 4.6);
    } else if(style === 'pirate'){
      t.fillStyle = grad(2, -9, 38, 4);
      t.beginPath(); t.moveTo(1.5, 4.5); t.quadraticCurveTo(5, -8, 20, -9.5); t.quadraticCurveTo(35, -8, 38.5, 4.5);
      t.quadraticCurveTo(30, 0.6, 20, 2.4); t.quadraticCurveTo(10, 0.6, 1.5, 4.5); t.closePath(); t.fill();
      t.strokeStyle = '#e0b030'; t.lineWidth = 1.3;
      t.beginPath(); t.moveTo(2.4, 3.6); t.quadraticCurveTo(10, 0.4, 20, 2); t.quadraticCurveTo(30, 0.4, 37.6, 3.6); t.stroke();
      t.fillStyle = '#f2f2f2'; t.beginPath(); t.arc(20, -4.2, 2.6, 0, Math.PI*2); t.fill();
      t.fillRect(18.6, -2.4, 2.8, 2);
      t.fillStyle = shade(c.hat, -60);
      t.beginPath(); t.arc(18.9, -4.6, 0.65, 0, Math.PI*2); t.fill(); t.beginPath(); t.arc(21.1, -4.6, 0.65, 0, Math.PI*2); t.fill();
    } else if(style === 'sombrero'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 24.5, 4.7, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(11, -14, 29, 3);
      t.beginPath(); t.moveTo(11, 2.5); t.quadraticCurveTo(11.5, -12, 20, -14.5); t.quadraticCurveTo(28.5, -12, 29, 2.5); t.closePath(); t.fill();
      t.fillStyle = '#ffd23f'; t.fillRect(11, -1.6, 18, 3.4);
      t.fillStyle = shade(c.hat, -40);
      for(let x = 13; x < 29; x += 4){ t.beginPath(); t.arc(x, 0.1, 0.9, 0, Math.PI*2); t.fill(); }
    } else if(style === 'viking'){
      t.fillStyle = '#f2e6c8'; t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = 0.8;
      t.beginPath(); t.moveTo(7, -1); t.quadraticCurveTo(-4, -3, -3.5, -16); t.quadraticCurveTo(0, -8.5, 10, -4.5); t.closePath(); t.fill(); t.stroke();
      t.beginPath(); t.moveTo(33, -1); t.quadraticCurveTo(44, -3, 43.5, -16); t.quadraticCurveTo(40, -8.5, 30, -4.5); t.closePath(); t.fill(); t.stroke();
      t.fillStyle = flat ? '#aab2bd' : (() => { const q = t.createLinearGradient(6, -9, 34, 4); q.addColorStop(0, '#dfe4ea'); q.addColorStop(1, '#8f98a4'); return q; })();
      t.beginPath(); t.ellipse(20, 3, 14.5, 12.5, 0, Math.PI, 0); t.fill();
      t.fillStyle = c.hat; roundRectOn(t, 5.5, 0, 29, 5, 2); t.fill();
      t.fillStyle = '#eee';
      [9.5, 15, 20, 25, 30.5].forEach(x => { t.beginPath(); t.arc(x, 2.5, 0.8, 0, Math.PI*2); t.fill(); });
    } else {
      // 'cap' - klasyczna czapka z daszkiem
      t.fillStyle = grad(4, -6, 34, 10);
      roundRectOn(t, 5, -5, 28, 13, 7); t.fill();
      t.fillStyle = shade(c.hat, -14);
      t.beginPath(); t.ellipse(11, 8, 9, 3.4, -0.15, 0, Math.PI*2); t.fill();
      t.fillStyle = '#fff';
      t.beginPath(); t.arc(19, 1, 4.6, 0, Math.PI*2); t.fill();
    }
    if(raised) t.restore();
  }

  function drawSparkle(tctx, x, y, r, rot){
    tctx.save();
    tctx.translate(x,y);
    tctx.rotate(rot);
    tctx.fillStyle = 'rgba(255,255,255,.85)';
    tctx.beginPath();
    tctx.moveTo(0,-r); tctx.lineTo(r*0.25,-r*0.25);
    tctx.lineTo(r,0); tctx.lineTo(r*0.25,r*0.25);
    tctx.lineTo(0,r); tctx.lineTo(-r*0.25,r*0.25);
    tctx.lineTo(-r,0); tctx.lineTo(-r*0.25,-r*0.25);
    tctx.closePath();
    tctx.fill();
    tctx.restore();
  }

  function roundRectOn(tctx, x,y,w,h,r){
    tctx.beginPath();
    tctx.moveTo(x+r,y);
    tctx.arcTo(x+w,y,x+w,y+h,r);
    tctx.arcTo(x+w,y+h,x,y+h,r);
    tctx.arcTo(x,y+h,x,y,r);
    tctx.arcTo(x,y,x+w,y,r);
    tctx.closePath();
  }
  function roundRect(x,y,w,h,r){ roundRectOn(ctx,x,y,w,h,r); }

  function drawPlayer(){
    const c = skinColors();
    const px = player.x - camera.x;
    const py = player.y;
    // sprite zaprojektowany w lokalnym ukladzie: szer ~40, wys ~56 (0,0 = czubek czapki)
    const scale = player.w/40;
    const airborne = !player.onGround;
    const bob = player.onGround ? Math.sin(player.animT)*1.5 : 0;
    const flat = gfxQuality === 0;
    const running = player.onGround && Math.abs(player.vx) > 3.5;
    const shine = gfxQuality >= 2;
    const sparkle = gfxQuality >= 3;
    // brak obrotu w powietrzu - postac ma wlasna, zaprojektowana poze skoku
    // (podkurczone nogi + uniesione rece w drawCharacterSprite), bez kolowrotka

    // HIGH/ULTRA: wyrazna, zawsze widoczna aura wokol postaci (latwo widoczna roznica vs LOW)
    if(gfxQuality >= 2){
      ctx.save();
      const auraR = gfxQuality >= 3 ? 34 : 22;
      const pulse = gfxQuality >= 3 ? (0.75 + Math.sin((timeAlive||0)*0.08)*0.25) : 1;
      const aura = ctx.createRadialGradient(px+player.w/2, py+player.h/2, 4, px+player.w/2, py+player.h/2, auraR*pulse);
      aura.addColorStop(0, gfxQuality>=3 ? 'rgba(255,225,120,.45)' : 'rgba(255,255,255,.18)');
      aura.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(px+player.w/2, py+player.h/2, auraR*pulse, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ULTRA: smugi predkosci przy biegu
    if(gfxQuality >= 3 && running){
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      for(let i=1;i<=3;i++){
        const trailX = px + player.w/2 - player.facing*i*10;
        ctx.beginPath();
        ctx.ellipse(trailX, py+player.h*0.6, 10-i*2, 5, 0, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    // (usunieto smuge wirowania - byla powiazana z kolowrotkiem, ktorego juz nie ma)

    // TARCZA: pulsujacy niebieski babelek ochronny (widoczny niezaleznie od jakosci grafiki)
    if(player.shieldActive){
      ctx.save();
      const pulse = 0.6 + Math.sin((timeAlive||0)*0.3)*0.4;
      ctx.strokeStyle = `rgba(120,210,255,${0.5+pulse*0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(px+player.w/2, py+player.h/2, player.w*0.85+pulse*3, player.h*0.62+pulse*3, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.fillStyle = `rgba(120,210,255,${0.08+pulse*0.08})`;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    // HIGH+: miekki cien/poswiata pod postacia
    if(gfxQuality >= 2){
      ctx.shadowColor = airborne && gfxQuality>=3 ? 'rgba(255,230,120,.75)' : 'rgba(0,0,0,.35)';
      ctx.shadowBlur = airborne && gfxQuality>=3 ? 22 : 10;
      ctx.shadowOffsetY = 3;
    }
    ctx.translate(px + player.w/2, py + 28*scale);
    ctx.scale(player.facing*scale, scale);
    ctx.translate(-20, -28);
    drawCharacterSprite(ctx, c, bob, airborne, flat, shine, sparkle, state.equippedFacialHair, state.equippedHatStyle);
    ctx.restore();
  }

  function shade(hex, percent){
    const num = parseInt(hex.replace('#',''),16);
    let r = (num>>16) + Math.round(255*percent/100);
    let g = ((num>>8)&0xff) + Math.round(255*percent/100);
    let b = (num&0xff) + Math.round(255*percent/100);
    r = Math.max(0,Math.min(255,r));
    g = Math.max(0,Math.min(255,g));
    b = Math.max(0,Math.min(255,b));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function bgColors(){
    if(level.bg==='night') return {sky1:'#0b1233', sky2:'#1c2a5e', hill:'#152a4a', sun:'#dfe7ff'};
    if(level.bg==='dusk') return {sky1:'#8a4a8f', sky2:'#e0764f', hill:'#3d2352', sun:'#ffdca0'};
    if(level.bg==='volcano') return {sky1:'#3a0e0e', sky2:'#b8451c', hill:'#2a0a0a', sun:'#ff8a3d'};
    if(level.bg==='ice') return {sky1:'#bfe9ff', sky2:'#eaf7ff', hill:'#6fb8d8', sun:'#ffffff'};
    if(level.bg==='desert') return {sky1:'#ffdca0', sky2:'#ffb877', hill:'#c9862f', sun:'#fff2c9'};
    if(level.bg==='aurora') return {sky1:'#0a1a2e', sky2:'#123d3a', hill:'#0a2e28', sun:'#9dffcf'};
    return {sky1:'#5c94fc', sky2:'#a8d8ff', hill:'#3fae4a', sun:'#fff7c2'};
  }

  function drawBackground(){
    const bc = bgColors();

    if(gfxQuality === 0){
      // LOW: plaskie tlo, bez gradientu, bez chmur/slonca, minimalne wzgorza
      ctx.fillStyle = bc.sky2;
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = bc.hill;
      for(let i=0;i<3;i++){
        const hx = ((i*420 - camera.x*0.5) % (level.width+420) + level.width+420) % (level.width+420) - 210;
        ctx.beginPath();
        ctx.arc(hx, GROUND_Y+30, 90, Math.PI, 0);
        ctx.fill();
      }
      return;
    }

    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, bc.sky1);
    grad.addColorStop(1, bc.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // HIGH+: gwiazdki na niebie nocnym
    if(gfxQuality >= 2 && (level.bg==='night' || level.bg==='volcano' || level.bg==='aurora')){
      for(let i=0;i<40;i++){
        const sx = (i*137) % W;
        const sy = (i*71) % (H*0.5);
        const twinkle = 0.4 + 0.4*Math.abs(Math.sin((timeAlive||0)*0.03 + i));
        ctx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    // ULTRA: falujaca zorza polarna na niebie (tylko motyw 'aurora')
    if(gfxQuality >= 2 && level.bg==='aurora'){
      ctx.save();
      ctx.globalAlpha = 0.25;
      for(let band=0; band<2; band++){
        ctx.beginPath();
        const baseY = 60 + band*50;
        ctx.moveTo(0, baseY);
        for(let bx=0; bx<=W; bx+=40){
          const wy = baseY + Math.sin((timeAlive||0)*0.02 + bx*0.01 + band*2) * 22;
          ctx.lineTo(bx, wy);
        }
        ctx.lineTo(W, baseY+90); ctx.lineTo(0, baseY+90);
        ctx.closePath();
        ctx.fillStyle = band===0 ? '#3dffb0' : '#8a5cff';
        ctx.fill();
      }
      ctx.restore();
    }

    // HIGH+: aureola wokol slonca
    if(gfxQuality >= 2){
      ctx.save();
      ctx.globalAlpha = 0.35;
      const sunGlow = ctx.createRadialGradient(W*0.82,H*0.16,10,W*0.82,H*0.16,60);
      sunGlow.addColorStop(0, bc.sun);
      sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath(); ctx.arc(W*0.82, H*0.16, 60, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // ULTRA: delikatne promienie slonca (obracajace sie powoli)
    if(gfxQuality >= 3){
      ctx.save();
      ctx.translate(W*0.82, H*0.16);
      ctx.rotate((timeAlive||0)*0.002);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff';
      for(let i=0;i<8;i++){
        ctx.rotate(Math.PI/4);
        ctx.fillRect(-3, 0, 6, 140);
      }
      ctx.restore();
    }

    ctx.fillStyle = bc.sun;
    ctx.beginPath(); ctx.arc(W*0.82, H*0.16, 34, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const cloudCount = gfxQuality >= 2 ? 8 : 6;
    for(let i=0;i<cloudCount;i++){
      const cx = ((i*300 - camera.x*0.3) % (level.width+300) + level.width+300) % (level.width+300) - 150;
      const bob = gfxQuality >= 2 ? Math.sin((timeAlive||0)*0.01 + i)*4 : 0;
      drawCloud(cx, H*0.15 + (i%2)*30 + bob);
    }
    ctx.fillStyle = bc.hill;
    for(let i=0;i<8;i++){
      const hx = ((i*260 - camera.x*0.5) % (level.width+260) + level.width+260) % (level.width+260) - 130;
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y+30, 90, Math.PI, 0);
      ctx.fill();
    }

    // ULTRA: delikatna winieta po brzegach ekranu
    if(gfxQuality >= 3){
      const vg = ctx.createRadialGradient(W/2,H/2,H*0.4,W/2,H/2,H*0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0,0,W,H);
    }
  }
  function drawCloud(x,y){
    ctx.beginPath();
    ctx.arc(x,y,18,0,Math.PI*2);
    ctx.arc(x+20,y-8,14,0,Math.PI*2);
    ctx.arc(x+36,y,18,0,Math.PI*2);
    ctx.fill();
  }

  function drawPlatforms(){
    for(const p of level.platforms){
      const x = p.x - camera.x;
      if(x+p.w < 0 || x > W) continue;
      if(p.isTrampoline){
        if(p.bounceAnim > 0) p.bounceAnim--;
        const squash = p.bounceAnim > 0 ? p.bounceAnim/10 : 0;
        ctx.save();
        if(gfxQuality >= 1){
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+5, p.w/2.2, 4, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = '#7a4a1e';
        ctx.fillRect(x, p.y+p.h-6, p.w, 6);
        ctx.fillStyle = '#ff5f6d';
        ctx.fillRect(x, p.y + squash*6, p.w, p.h-6-squash*6);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        for(let sx=6; sx<p.w-3; sx+=12) { ctx.beginPath(); ctx.moveTo(x+sx, p.y+p.h-6); ctx.lineTo(x+sx+6, p.y+squash*6); ctx.stroke(); }
        ctx.restore();
        continue;
      }
      if(p.isCrumbler){
        if(p.state === 'gone') continue;
        const shakeX = p.state === 'shaking' ? (Math.random()*4-2) : 0;
        ctx.save();
        ctx.globalAlpha = p.state === 'shaking' ? (0.5 + Math.sin((p.timer||0)*0.9)*0.3) : 1;
        ctx.fillStyle = p.state === 'shaking' ? '#8a5a3a' : '#a06a3e';
        ctx.fillRect(x+shakeX, p.y, p.w, p.h);
        ctx.strokeStyle = '#5a3a1e';
        ctx.lineWidth = 2;
        for(let cx=0; cx<p.w; cx+=18) ctx.strokeRect(x+shakeX+cx, p.y, Math.min(18,p.w-cx), p.h);
        ctx.restore();
        continue;
      }
      if(p.isGround){
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, p.y, p.w, H-p.y+10);
        ctx.fillStyle = '#3fae4a';
        ctx.fillRect(x, p.y, p.w, 10);
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.15)';
          ctx.fillRect(x, p.y, p.w, 2);
        }
      } else {
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+5, p.w/2.2, 4, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = '#c96a2e';
        ctx.fillRect(x, p.y, p.w, p.h);
        if(gfxQuality >= 1){
          ctx.strokeStyle = '#7a3d15';
          ctx.lineWidth = 2;
          for(let bx=0; bx<p.w; bx+=22) ctx.strokeRect(x+bx, p.y, Math.min(22, p.w-bx), p.h);
        }
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(x, p.y, p.w, 2);
        }
      }
    }
    for(const p of level.pipes){
      const x = p.x - camera.x;
      if(x+p.w < 0 || x > W) continue;
      ctx.fillStyle = '#1e9e46';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#2ecc57';
      ctx.fillRect(x-4, p.y, p.w+8, 12);
      if(gfxQuality >= 2){
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.fillRect(x+4, p.y+14, 4, p.h-16);
      }
    }
  }

  let cachedCoinGradient = null;
  function getCoinGradient(){
    if(!cachedCoinGradient){
      const grad = ctx.createRadialGradient(-3,-3,1,0,0,10);
      grad.addColorStop(0,'#fff6c9');
      grad.addColorStop(0.5,'#ffd23f');
      grad.addColorStop(1,'#c8860a');
      cachedCoinGradient = grad;
    }
    return cachedCoinGradient;
  }

  function drawCoins(){
    for(const c of level.coins){
      if(c.taken) continue;
      const x = c.x - camera.x;
      if(x < -20 || x > W+20) continue;
      const squish = Math.abs(Math.cos(c.t));
      ctx.save();
      ctx.translate(x, c.y);
      ctx.scale(squish*0.9+0.15, 1);

      if(gfxQuality >= 3){
        ctx.save();
        ctx.shadowColor = 'rgba(255,210,63,.9)';
        ctx.shadowBlur = 10;
      }

      if(gfxQuality === 0){
        ctx.fillStyle = '#ffd23f';
      } else {
        ctx.fillStyle = getCoinGradient();
      }
      ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#8a5a00';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if(gfxQuality >= 3) ctx.restore();

      // HIGH+: iskierka
      if(gfxQuality >= 2){
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.ellipse(-3,-3,2,3.5,0.6,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFlag(){
    const x = level.flag.x - camera.x;
    ctx.fillStyle = '#ccc';
    ctx.fillRect(x, level.flag.y, 6, level.flag.h);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(x+6, level.flag.y+6);
    ctx.lineTo(x+34, level.flag.y+16);
    ctx.lineTo(x+6, level.flag.y+26);
    ctx.fill();
  }

  function drawCheckpoint(){
    if(!level.checkpoint) return;
    const x = level.checkpoint.x - camera.x;
    if(x < -40 || x > W+40) return;
    const y = level.checkpoint.y;
    const active = levelCheckpointReached;
    ctx.save();
    ctx.fillStyle = active ? '#ccc' : '#8a8f99';
    ctx.fillRect(x, y-220, 5, 220);
    ctx.fillStyle = active ? '#2ecc71' : '#556070';
    ctx.beginPath();
    ctx.moveTo(x+5, y-214);
    ctx.lineTo(x+30, y-206);
    ctx.lineTo(x+5, y-198);
    ctx.fill();
    if(active){
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x+2, y-215, 4, 0, Math.PI*2);
      ctx.fillStyle = '#2ecc71';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(e, x){
    const cx = x + e.w/2, cy = e.y + e.h/2;
    const flash = e.hitTimer > 0 && Math.floor(e.hitTimer/4)%2===0;
    const bob = Math.sin((e.animT||0)*0.8) * 4;

    // cien
    if(gfxQuality >= 1){
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, e.y+e.h+10, e.w*0.55, 8, 0, 0, Math.PI*2); ctx.fill();
    }

    // nogi
    ctx.fillStyle = '#3a0a1a';
    ctx.beginPath(); ctx.ellipse(cx-e.w*0.28, e.y+e.h-6+bob*0.3, e.w*0.16, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+e.w*0.28, e.y+e.h-6-bob*0.3, e.w*0.16, 10, 0, 0, Math.PI*2); ctx.fill();

    // cialo
    if(flash){
      ctx.fillStyle = '#ffffff';
    } else if(gfxQuality === 0){
      ctx.fillStyle = '#8a1a3a';
    } else {
      const grad = ctx.createRadialGradient(cx-e.w*0.25, cy-e.h*0.3, 4, cx, cy, e.w*0.75);
      grad.addColorStop(0, '#e05a8a');
      grad.addColorStop(0.5, '#a8225a');
      grad.addColorStop(1, '#5a0e2e');
      ctx.fillStyle = grad;
    }
    ctx.beginPath(); ctx.ellipse(cx, cy+bob*0.4, e.w*0.55, e.h*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3a0a1a'; ctx.lineWidth = 3; ctx.stroke();

    // kolce na grzbiecie
    ctx.fillStyle = '#3a0a1a';
    for(let i=-2;i<=2;i++){
      ctx.beginPath();
      ctx.moveTo(cx+i*14-6, cy-e.h*0.35+bob*0.4);
      ctx.lineTo(cx+i*14, cy-e.h*0.7+bob*0.4);
      ctx.lineTo(cx+i*14+6, cy-e.h*0.35+bob*0.4);
      ctx.fill();
    }

    // korona
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx-22, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx-14, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx-4, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx+4, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx+14, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx+22, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx+22, cy-e.h*0.4+bob*0.4);
    ctx.lineTo(cx-22, cy-e.h*0.4+bob*0.4);
    ctx.fill();

    // oczy wsciekle
    const eyeShift = (e.vx>=0?1:-1)*3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx-16+eyeShift, cy+bob*0.4, 8, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+16+eyeShift, cy+bob*0.4, 8, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(cx-16+eyeShift*1.6, cy+2+bob*0.4, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+16+eyeShift*1.6, cy+2+bob*0.4, 4, 0, Math.PI*2); ctx.fill();

    // zebiska
    ctx.fillStyle = '#fff';
    for(let i=-1;i<=1;i+=2){
      ctx.beginPath();
      ctx.moveTo(cx+i*8-4, cy+e.h*0.28+bob*0.4);
      ctx.lineTo(cx+i*8, cy+e.h*0.42+bob*0.4);
      ctx.lineTo(cx+i*8+4, cy+e.h*0.28+bob*0.4);
      ctx.fill();
    }
  }

  function drawCrushers(){
    if(!level.crushers) return;
    for(const c of level.crushers){
      const x = c.x - camera.x;
      if(x+c.w < 0 || x > W) continue;
      // lancuch/tłok od gory
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x+c.w/2-4, c.topY-40, 8, c.y-(c.topY-40));
      // blok z kolcami
      const grad = gfxQuality===0 ? null : ctx.createLinearGradient(x, c.y, x, c.y+c.h);
      if(grad){ grad.addColorStop(0,'#c0c5cb'); grad.addColorStop(1,'#7a828a'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(x, c.y, c.w, c.h);
      ctx.fillStyle = '#4a4e54';
      for(let i=0;i<c.w;i+=14){
        ctx.beginPath();
        ctx.moveTo(x+i, c.y+c.h);
        ctx.lineTo(x+i+7, c.y+c.h+12);
        ctx.lineTo(x+i+14, c.y+c.h);
        ctx.fill();
      }
    }
  }

  function drawTurrets(){
    if(!level.shooters) return;
    for(const s of level.shooters){
      const x = s.x - camera.x;
      if(x < -40 || x > W+40) continue;
      const dir = s.dir || 1;
      ctx.save();
      const grad = gfxQuality===0 ? null : ctx.createLinearGradient(x-16, s.y-16, x-16, s.y+16);
      if(grad){ grad.addColorStop(0,'#7d8694'); grad.addColorStop(1,'#454c56'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#5a626e';
      ctx.fillRect(x-16, s.y-16, 32, 32);
      ctx.fillStyle = '#2e333a';
      ctx.fillRect(x-16, s.y-16, 32, 6);
      ctx.fillRect(x-16, s.y+10, 32, 6);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(dir>=0 ? x+8 : x-28, s.y-5, 20, 10);
      ctx.fillStyle = '#ffcc4d';
      ctx.beginPath(); ctx.arc(x, s.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawProjectiles(){
    if(!level.projectiles) return;
    for(const p of level.projectiles){
      const x = p.x - camera.x;
      if(x < -30 || x > W+30) continue;
      if(gfxQuality >= 2){
        ctx.save();
        ctx.shadowColor = 'rgba(255,120,40,.9)';
        ctx.shadowBlur = 10;
      }
      const grad = gfxQuality===0 ? null : ctx.createRadialGradient(x-2,p.y-2,1,x,p.y,9);
      if(grad){ grad.addColorStop(0,'#fff2b0'); grad.addColorStop(0.5,'#ff8a3d'); grad.addColorStop(1,'#c0390a'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(x, p.y, 8, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2) ctx.restore();
    }
  }

  function drawHazards(){
    if(!level.hazards) return;
    for(const h of level.hazards){
      const x = h.x - camera.x;
      if(x+h.w < 0 || x > W) continue;
      const spikeW = 12;
      const n = Math.max(1, Math.round(h.w / spikeW));
      const grad = ctx.createLinearGradient(x, h.y, x, h.y+h.h);
      grad.addColorStop(0, '#e8e8e8');
      grad.addColorStop(1, '#8a8f96');
      ctx.fillStyle = gfxQuality === 0 ? '#a0a5ab' : grad;
      for(let i=0;i<n;i++){
        const sx = x + i*(h.w/n);
        ctx.beginPath();
        ctx.moveTo(sx, h.y+h.h);
        ctx.lineTo(sx + h.w/n/2, h.y);
        ctx.lineTo(sx + h.w/n, h.y+h.h);
        ctx.closePath();
        ctx.fill();
      }
      if(gfxQuality >= 2){
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.lineWidth = 1;
        for(let i=0;i<n;i++){
          const sx = x + i*(h.w/n);
          ctx.beginPath();
          ctx.moveTo(sx, h.y+h.h);
          ctx.lineTo(sx + h.w/n/2, h.y);
          ctx.lineTo(sx + h.w/n, h.y+h.h);
          ctx.stroke();
        }
      }
    }
  }

  function drawMovers(){
    if(!level.movers) return;
    for(const m of level.movers){
      const x = m.x - camera.x;
      if(x+m.w < 0 || x > W) continue;
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.beginPath(); ctx.ellipse(x+m.w/2, m.y+m.h+6, m.w/2, 4, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#8a5ac9';
      ctx.fillRect(x, m.y, m.w, m.h);
      ctx.fillStyle = '#c9a5f5';
      ctx.fillRect(x, m.y, m.w, 5);
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#4a2a70';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, m.y, m.w, m.h);
      }
      if(gfxQuality >= 3){
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x+4, m.y+2, m.w-8, 2);
      }
    }
  }

  function drawEnemies(){
    for(const e of level.enemies){
      if(!e.alive) continue;
      const x = e.x - camera.x;
      if(x+e.w < 0 || x > W) continue;
      if(e.type === 'boss'){ drawBoss(e, x); continue; }
      const walkBob = Math.sin(e.animT||0) * 2.2;
      const squash = 1 + Math.sin((e.animT||0)*2) * 0.03;
      const cx = x + e.w/2, cy = e.y + e.h/2 + walkBob*0.4;
      const bodyW = (e.w/2) * squash;
      const bodyH = (e.h/2) / squash;
      const facing = e.vx >= 0 ? 1 : -1;
      const palette = e.type==='flyer'
        ? {flat:'#3d8fd6', light:'#a8d4f7', mid:'#4f9fe0', dark:'#1e5a99', stroke:'#123a66', spike:'#1e5a99', leg:'#123a66'}
        : e.type==='jumper'
        ? {flat:'#3fae52', light:'#c8f0c8', mid:'#4fc463', dark:'#1e7a2e', stroke:'#124a1a', spike:'#1e7a2e', leg:'#124a1a'}
        : {flat:'#8a4bc7', light:'#d69bf0', mid:'#a655d6', dark:'#5e2680', stroke:'#3a1554', spike:'#4a1f66', leg:'#2c1140'};

      // cien pod nim
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(cx, e.y+e.h+5, e.w/2, 4.5, 0, 0, Math.PI*2); ctx.fill();
      }

      // ULTRA: pulsujaca aura + drobinki (kolor zgodny z typem wroga)
      if(gfxQuality >= 3){
        const pulse = 0.5 + Math.sin((e.animT||0)*1.5)*0.5;
        ctx.save();
        ctx.globalAlpha = 0.28 + pulse*0.18;
        ctx.fillStyle = palette.mid;
        ctx.beginPath(); ctx.ellipse(cx, cy, bodyW*1.8, bodyH*1.8, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        for(let i=0;i<3;i++){
          const pt = ((e.animT||0)*0.6 + i*2.1) % 6.28;
          const px2 = cx + Math.cos(pt)*(bodyW*1.9);
          const py2 = cy + Math.sin(pt)*(bodyH*1.9);
          ctx.fillStyle = palette.light;
          ctx.beginPath(); ctx.arc(px2, py2, 2.2, 0, Math.PI*2); ctx.fill();
        }
      }

      // skrzydla latacza (rysowane pod cialem, przed nozkami)
      if(e.type === 'flyer'){
        const wingFlap = Math.sin((e.animT||0)*3)*0.6;
        ctx.fillStyle = gfxQuality===0 ? '#5aa0e0' : 'rgba(140,195,245,.85)';
        ctx.save(); ctx.translate(cx-bodyW*0.85, cy-4); ctx.rotate(wingFlap);
        ctx.beginPath(); ctx.ellipse(0,0, bodyW*0.85, bodyH*0.45, 0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(cx+bodyW*0.85, cy-4); ctx.rotate(-wingFlap);
        ctx.beginPath(); ctx.ellipse(0,0, bodyW*0.85, bodyH*0.45, 0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // nozki (przebieranie) - latacz ich nie ma, skoczek ma sprezyste odnoze
      if(e.type === 'flyer'){
        // brak nog - unosi sie w powietrzu
      } else if(e.type === 'jumper'){
        ctx.strokeStyle = palette.leg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0;i<3;i++){
          const yy = e.y+e.h-2 - i*4;
          ctx.moveTo(cx-6, yy); ctx.lineTo(cx+6, yy-3);
        }
        ctx.stroke();
      } else {
        const stepA = Math.sin(e.animT||0);
        ctx.fillStyle = palette.spike;
        ctx.beginPath(); ctx.ellipse(cx-9, e.y+e.h-3+stepA*2, 6.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+9, e.y+e.h-3-stepA*2, 6.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = palette.leg;
        ctx.beginPath(); ctx.ellipse(cx-9, e.y+e.h+stepA*2, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+9, e.y+e.h-stepA*2, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
      }

      // grzbiet kolcow
      ctx.fillStyle = palette.spike;
      for(let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(cx+i*7-4, cy-bodyH*0.75);
        ctx.lineTo(cx+i*7, cy-bodyH*1.15);
        ctx.lineTo(cx+i*7+4, cy-bodyH*0.75);
        ctx.fill();
      }

      // cialo
      if(gfxQuality === 0){
        ctx.fillStyle = palette.flat;
      } else {
        const grad = ctx.createRadialGradient(cx-bodyW*0.35, cy-bodyH*0.4, 2, cx, cy, bodyW*1.15);
        grad.addColorStop(0, palette.light);
        grad.addColorStop(0.45, palette.mid);
        grad.addColorStop(1, palette.dark);
        ctx.fillStyle = grad;
      }
      ctx.beginPath(); ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if(gfxQuality >= 1){
        // jasny brzuch
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.ellipse(cx, cy+bodyH*0.35, bodyW*0.6, bodyH*0.45, 0, 0, Math.PI*2); ctx.fill();

        // cetki
        ctx.fillStyle = 'rgba(60,20,80,.35)';
        ctx.beginPath(); ctx.ellipse(cx-bodyW*0.5, cy+bodyH*0.1, 3, 2.4, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+bodyW*0.4, cy-bodyH*0.25, 2.6, 2, 0, 0, Math.PI*2); ctx.fill();
      }

      // brwi wkurzone (zwrocone w strone ruchu)
      ctx.strokeStyle = '#2c1440';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      const browShift = facing*2;
      ctx.beginPath(); ctx.moveTo(cx-11+browShift, cy-bodyH*0.55); ctx.lineTo(cx-3+browShift, cy-bodyH*0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+11+browShift, cy-bodyH*0.55); ctx.lineTo(cx+3+browShift, cy-bodyH*0.15); ctx.stroke();

      // oczy (patrzace w strone ruchu)
      const eyeShift = facing*1.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx-6+eyeShift, cy+bodyH*0.05, 4.3, 5.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+6+eyeShift, cy+bodyH*0.05, 4.3, 5.2, 0, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2){
        ctx.save();
        ctx.shadowColor = 'rgba(255,60,60,.9)';
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath(); ctx.arc(cx-6+eyeShift*1.6, cy+bodyH*0.08, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6+eyeShift*1.6, cy+bodyH*0.08, 2.2, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2) ctx.restore();
      ctx.fillStyle = '#1a0d28';
      ctx.beginPath(); ctx.arc(cx-6+eyeShift*1.6, cy+bodyH*0.08, 0.9, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6+eyeShift*1.6, cy+bodyH*0.08, 0.9, 0, Math.PI*2); ctx.fill();

      // zabawne zebki
      if(gfxQuality >= 1){
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx-5, cy+bodyH*0.55);
        ctx.lineTo(cx-2, cy+bodyH*0.42);
        ctx.lineTo(cx+1, cy+bodyH*0.55);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx+2, cy+bodyH*0.55);
        ctx.lineTo(cx+5, cy+bodyH*0.42);
        ctx.lineTo(cx+8, cy+bodyH*0.55);
        ctx.fill();
      }
    }
  }

  function drawMiniFlag(px, py, w, h, id, colors, targetCtx){
    const g = targetCtx || ctx;   // domyslnie glowny canvas gry; sklep podaje wlasny canvas miniaturki
    const c = colors;
    const x0 = -w/2, y0 = -h/2;
    g.save();
    g.translate(px, py);
    // cień/obrys dla czytelności na dowolnym tle
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x0-1, y0-1, w+2, h+2);
    switch(id){
      case 'ukraine':
      case 'poland':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/2);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/2, w, h/2);
        break;
      case 'lithuania':
      case 'germany':
      case 'austria':
      case 'netherlands':
      case 'hungary':
      case 'bulgaria':
      case 'estonia':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/3);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/3, w, h/3);
        g.fillStyle = c[2]; g.fillRect(x0, y0+2*h/3, w, h/3);
        break;
      case 'latvia':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h*0.4);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h*0.4, w, h*0.2);
        g.fillStyle = c[2]; g.fillRect(x0, y0+h*0.6, w, h*0.4);
        break;
      case 'spain':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h*0.25);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h*0.25, w, h*0.5);
        g.fillStyle = c[0]; g.fillRect(x0, y0+h*0.75, w, h*0.25);
        break;
      case 'italy':
      case 'france':
      case 'belgium':
      case 'ireland':
      case 'romania':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w/3, h);
        g.fillStyle = c[1]; g.fillRect(x0+w/3, y0, w/3, h);
        g.fillStyle = c[2]; g.fillRect(x0+2*w/3, y0, w/3, h);
        break;
      case 'sweden':
      case 'finland':
      case 'denmark':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.fillRect(x0 + w*0.3, y0, w*0.14, h);
        g.fillRect(x0, y0 + h*0.38, w, h*0.24);
        break;
      case 'japan':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.beginPath(); g.arc(0, 0, h*0.32, 0, Math.PI*2); g.fill();
        break;
      case 'usa': {
        g.fillStyle = c[2]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        for(let i=0;i<5;i++){ if(i%2===0) g.fillRect(x0, y0 + i*h/5, w, h/5); }
        const cantonW = w*0.46, cantonH = h*0.58;
        g.fillStyle = c[0];
        g.fillRect(x0, y0, cantonW, cantonH);
        g.fillStyle = '#ffffff';
        const starsX = 4, starsY = 3, starR = Math.max(0.6, cantonH/starsY*0.16);
        for(let sy=0; sy<starsY; sy++){
          for(let sx=0; sx<starsX; sx++){
            const sxp = x0 + cantonW*(sx+0.5)/starsX;
            const syp = y0 + cantonH*(sy+0.5)/starsY;
            g.beginPath();
            g.arc(sxp, syp, starR, 0, Math.PI*2);
            g.fill();
          }
        }
        break;
      }
      case 'norway':
      case 'iceland': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.fillRect(x0 + w*0.26, y0, w*0.2, h);
        g.fillRect(x0, y0 + h*0.33, w, h*0.34);
        g.fillStyle = c[2];
        g.fillRect(x0 + w*0.31, y0, w*0.1, h);
        g.fillRect(x0, y0 + h*0.42, w, h*0.16);
        break;
      }
      case 'switzerland': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        const sz = h*0.68, th = sz*0.34;
        g.fillRect(-th/2, -sz/2, th, sz);
        g.fillRect(-sz/2, -th/2, sz, th);
        break;
      }
      case 'czechia':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/2);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/2, w, h/2);
        g.fillStyle = c[2];
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w*0.5, 0); g.lineTo(x0, y0+h); g.closePath(); g.fill();
        break;
      case 'uk': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.save();
        g.beginPath(); g.rect(x0, y0, w, h); g.clip();
        g.strokeStyle = c[1]; g.lineWidth = h*0.26;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0+w, y0+h); g.moveTo(x0+w, y0); g.lineTo(x0, y0+h); g.stroke();
        g.strokeStyle = c[2]; g.lineWidth = h*0.09;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0+w, y0+h); g.moveTo(x0+w, y0); g.lineTo(x0, y0+h); g.stroke();
        g.restore();
        g.fillStyle = c[1];
        g.fillRect(-h*0.17, y0, h*0.34, h); g.fillRect(x0, y0 + h*0.33, w, h*0.34);
        g.fillStyle = c[2];
        g.fillRect(-h*0.1, y0, h*0.2, h); g.fillRect(x0, y0 + h*0.4, w, h*0.2);
        break;
      }
      case 'canada': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1]; g.fillRect(x0 + w*0.25, y0, w*0.5, h);
        g.fillStyle = c[0];
        const lr = h*0.42;
        const leaf = [[0,-1],[.2,-.55],[.5,-.65],[.4,-.2],[.85,-.3],[.65,.05],[.9,.2],[.45,.35],[.5,.5],[.08,.4],[.06,.95],[-.06,.95],[-.08,.4],[-.5,.5],[-.45,.35],[-.9,.2],[-.65,.05],[-.85,-.3],[-.4,-.2],[-.5,-.65],[-.2,-.55]];
        g.beginPath();
        leaf.forEach((q,i) => { const lx = q[0]*lr*0.95, ly = q[1]*lr; if(i) g.lineTo(lx,ly); else g.moveTo(lx,ly); });
        g.closePath(); g.fill();
        break;
      }
      case 'greece': {
        for(let i=0;i<9;i++){ g.fillStyle = (i%2===0) ? c[0] : c[1]; g.fillRect(x0, y0 + i*h/9, w, h/9 + 0.5); }
        const cs = h*5/9;
        g.fillStyle = c[0]; g.fillRect(x0, y0, cs, cs);
        g.fillStyle = c[1];
        g.fillRect(x0 + cs*0.4, y0, cs*0.2, cs); g.fillRect(x0, y0 + cs*0.4, cs, cs*0.2);
        break;
      }
      case 'portugal': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w*0.4, h);
        g.fillStyle = c[1]; g.fillRect(x0 + w*0.4, y0, w*0.6, h);
        const ex = x0 + w*0.4;
        g.fillStyle = c[2]; g.beginPath(); g.arc(ex, 0, h*0.26, 0, Math.PI*2); g.fill();
        g.fillStyle = c[1]; g.beginPath(); g.arc(ex, 0, h*0.15, 0, Math.PI*2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, 0, h*0.06, 0, Math.PI*2); g.fill();
        break;
      }
      case 'turkey': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1]; g.beginPath(); g.arc(x0 + w*0.36, 0, h*0.3, 0, Math.PI*2); g.fill();
        g.fillStyle = c[0]; g.beginPath(); g.arc(x0 + w*0.42, 0, h*0.24, 0, Math.PI*2); g.fill();
        g.fillStyle = c[1];
        g.beginPath();
        for(let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5, rr = (i%2===0) ? h*0.14 : h*0.056;
          const sx2 = x0 + w*0.58 + Math.cos(ang)*rr, sy2 = Math.sin(ang)*rr;
          if(i) g.lineTo(sx2, sy2); else g.moveTo(sx2, sy2);
        }
        g.closePath(); g.fill();
        break;
      }
      case 'brazil': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.beginPath(); g.moveTo(0, y0 + h*0.1); g.lineTo(x0 + w*0.9, 0); g.lineTo(0, y0 + h*0.9); g.lineTo(x0 + w*0.1, 0); g.closePath(); g.fill();
        g.fillStyle = c[2]; g.beginPath(); g.arc(0, 0, h*0.24, 0, Math.PI*2); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.8, h*0.05);
        g.beginPath(); g.arc(0, h*0.06, h*0.2, Math.PI*1.15, Math.PI*1.85); g.stroke();
        break;
      }
      case 'pirate': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.strokeStyle = c[1]; g.lineWidth = Math.max(1, h*0.09); g.lineCap = 'round';
        g.beginPath(); g.moveTo(-h*0.42, -h*0.34); g.lineTo(h*0.42, h*0.34); g.moveTo(h*0.42, -h*0.34); g.lineTo(-h*0.42, h*0.34); g.stroke();
        g.fillStyle = c[1];
        g.beginPath(); g.arc(0, -h*0.04, h*0.24, 0, Math.PI*2); g.fill();
        g.fillRect(-h*0.12, h*0.1, h*0.24, h*0.17);
        g.fillStyle = c[0];
        g.beginPath(); g.arc(-h*0.09, -h*0.06, h*0.06, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc(h*0.09, -h*0.06, h*0.06, 0, Math.PI*2); g.fill();
        break;
      }
      default: {
        const bw = w / c.length;
        c.forEach((col,i)=>{ g.fillStyle = col; g.fillRect(x0+i*bw, y0, bw, h); });
      }
    }
    g.restore();
  }

  function drawFlagAt(px, py, w, h, facing, vx, onGround, trailId){
    if(!trailId || trailId === 'none') return;
    const trail = TRAILS.find(t => t.id === trailId);
    if(!trail) return;

    const dir = -(facing || 1); // flaga powiewa w strone przeciwna do kierunku patrzenia
    const poleX = px + (facing >= 0 ? 4 : w - 4);
    const poleY = py + h*0.24;
    const L = 44, Hh = 22;
    const N = 10;
    const moving = Math.abs(vx) > 0.3 || !onGround;
    const running = onGround && Math.abs(vx) > 3.5;
    const speedFactor = running ? 1.7 : 1;
    const t = (timeAlive||0) * 0.16 * speedFactor;
    const ampMax = moving ? 5 : 2;

    const topPts = [], botPts = [];
    for(let i=0;i<=N;i++){
      const f = i/N;
      const x = poleX + dir*L*f;
      const wave = Math.sin(t + f*4.2) * ampMax * f;
      const shrink = Hh/2*(1 - f*0.1);
      topPts.push({x, y: poleY + wave - shrink});
      botPts.push({x, y: poleY + wave + shrink});
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(50,38,22,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX, poleY - Hh*0.75);
    ctx.lineTo(poleX, poleY + Hh*0.75);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    for(const p of topPts) ctx.lineTo(p.x, p.y);
    for(let i=botPts.length-1;i>=0;i--) ctx.lineTo(botPts[i].x, botPts[i].y);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 4;
    drawMiniFlag(poleX + dir*L/2, poleY, L, Hh, trail.id, trail.colors);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayerFlag(){
    drawFlagAt(player.x - camera.x, player.y, player.w, player.h, player.facing, player.vx, player.onGround, state.equippedTrail);
  }

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
})();
