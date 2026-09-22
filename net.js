// Supabase (klient, logowanie) i multiplayer (lobby, Realtime Broadcast/Presence).
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
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
