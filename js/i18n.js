/* ============ I18N: English (default) / Polski ============
   Zrodlem tekstow jest polski kod; warstwa tlumaczy widoczny tekst (DOM, canvas, alert/confirm)
   slownikiem + wzorcami. Jezyk zapisany w localStorage ('spb_lang'), domyslnie 'en'. */
(function(){
  var DICT_SRC = {
    // ---- menu / ogolne ----
    'ZBIERAJ MONETY • SKACZ • WYGRYWAJ':'COLLECT COINS • JUMP • WIN',
    '▶ GRAJ':'▶ PLAY','🗺 POZIOMY':'🗺 LEVELS','🛒 SKLEP':'🛒 SHOP','🏁 SPEEDRUNY':'🏁 SPEEDRUNS',
    '⚙ USTAWIENIA':'⚙ SETTINGS','🏛️ WARSZTAT':'🏛️ WORKSHOP','⬅ POWRÓT':'⬅ BACK',
    'Graj razem ze znajomymi na kilku ekranach naraz.':'Play together with friends on multiple screens at once.',
    'Twój nick':'Your nickname','np. Tymur':'e.g. Tymur','Liczba graczy':'Number of players','Jakie poziomy?':'Which levels?',
    '🗺 Normalne':'🗺 Normal','🛠️ Własny poziom':'🛠️ Custom level','kod poziomu (z Moje Poziomy)':'level code (from My Levels)',
    '🆕 STWÓRZ LOBBY':'🆕 CREATE LOBBY','Dołącz z kodem':'Join with a code','np. AB3XQ':'e.g. AB3XQ','🔗 DOŁĄCZ':'🔗 JOIN',
    'Podaj ten kod znajomym:':'Share this code with your friends:','Łączenie...':'Connecting...','Poziom własny:':'Custom level:',
    'kod poziomu':'level code','✖ ANULUJ':'✖ CANCEL','MOJE POZIOMY':'MY LEVELS','SPEEDRUNY':'SPEEDRUNS','WARSZTAT':'WORKSHOP',
    'Najpopularniejsze poziomy stworzone przez graczy.':'Most popular levels created by players.',
    // ---- edytor ----
    'Nazwa poziomu':'Level name','☀️ Dzień':'☀️ Day','🌙 Noc':'🌙 Night','🌆 Zmierzch':'🌆 Dusk','🌋 Wulkan':'🌋 Volcano',
    '❄️ Lód':'❄️ Ice','🏜️ Pustynia':'🏜️ Desert','🌌 Zorza':'🌌 Aurora','🟫 Grunt':'🟫 Ground','▬ Platforma':'▬ Platform',
    '🟢 Rura':'🟢 Pipe','🪙 Moneta':'🪙 Coin','🟣 Wróg':'🟣 Enemy','🔵 Latacz':'🔵 Flyer','🟢 Skoczek':'🟢 Jumper',
    '▲ Kolce':'▲ Spikes','↔️ Platf. (poziom)':'↔️ Platf. (horiz.)','↕️ Platf. (pion)':'↕️ Platf. (vert.)',
    '💥 Miażdżarka':'💥 Crusher','🗼 Wieżyczka':'🗼 Turret','🏁 Start gracza':'🏁 Player start','🚩 Flaga (meta)':'🚩 Flag (goal)',
    '🧹 Gumka':'🧹 Eraser',
    'Przewijaj kółkiem myszy nad canvasem albo suwakiem, żeby edytować dalsze fragmenty długiego poziomu. Kliknij i przeciągnij istniejący element (albo start/flagę), żeby go przesunąć. Shift + klik z gruntem stawia długi odcinek (1000 px).':
      'Scroll with the mouse wheel over the canvas or use the slider to edit further parts of a long level. Click and drag an existing element (or the start/flag) to move it. Shift + click with the Ground tool places a long stretch (1000 px).',
    '🗑 WYCZYŚĆ':'🗑 CLEAR','▶ TESTUJ':'▶ TEST','💾 ZAPISZ I POKAŻ KOD':'💾 SAVE & SHOW CODE',
    'Masz kod poziomu od znajomego?':'Got a level code from a friend?','▶ ZAGRAJ':'▶ PLAY',
    'Maksymalnie 40 monet na poziom!':'Maximum 40 coins per level!',
    'Wyczyścić cały poziom w edytorze? Niezapisane zmiany przepadną.':'Clear the whole level in the editor? Unsaved changes will be lost.',
    // ---- statystyki / ustawienia ----
    'STATYSTYKI':'STATS','USTAWIENIA':'SETTINGS','Muzyka':'Music','🔊 WŁĄCZONA':'🔊 ON','🔇 WYŁĄCZONA':'🔇 OFF',
    'Limit FPS':'FPS limit','BEZ LIMITU':'UNLIMITED','Licznik FPS':'FPS counter','📊 WŁĄCZONY':'📊 ON','📊 WYŁĄCZONY':'📊 OFF',
    'Fizyka gry zawsze liczy się 60 razy na sekundę, więc tempo gry jest takie samo przy każdym limicie. Więcej FPS = płynniejszy obraz, mniej FPS = mniejsze obciążenie komputera. „Bez limitu” dopasuje się do odświeżania monitora.':
      'Game physics always runs 60 times per second, so the game speed is the same at every limit. More FPS = smoother picture, fewer FPS = lower load on your computer. "Unlimited" matches your monitor refresh rate.',
    'Głośność':'Volume','Długość poziomu':'Level length','🟠 Trampolina':'🟠 Trampoline','🧱 Kruszący blok':'🧱 Crumbling block','↩ COFNIJ (Ctrl+Z)':'↩ UNDO (Ctrl+Z)',
    '↩ Nie ma czego cofać (maks. 3 cofnięcia)':'↩ Nothing to undo (max 3 undos)','Sortuj wg:':'Sort by:','🪙 Monety':'🪙 Coins','⏱ Czas gry':'⏱ Playtime','💰 Zarobione':'💰 Earned','👾 Wrogowie':'👾 Enemies','👹 Bossowie':'👹 Bosses','🗺 Poziom':'🗺 Level',
    'Ranking niedostępny bez konta (Supabase).':'Ranking unavailable without an account (Supabase).','Brak wyników.':'No results yet.','Grafika':'Graphics','Język':'Language','WYBIERZ POZIOM':'SELECT LEVEL','🔒 zablokowany':'🔒 locked',
    '🪙 Aktualne monety':'🪙 Current coins','💰 Łącznie zarobione monety':'💰 Total coins earned','🛒 Wydane monety':'🛒 Coins spent',
    '⏱ Dokładny czas gry':'⏱ Exact play time','💀 Liczba śmierci':'💀 Deaths','👾 Zabici przeciwnicy':'👾 Enemies killed',
    '👹 Pokonani bossowie':'👹 Bosses defeated','👕 Posiadane skiny':'👕 Skins owned','🚩 Posiadane trailsy':'🚩 Trails owned',
    '🛠️ Stworzone poziomy':'🛠️ Levels created',
    // ---- sklep ----
    'SKLEP':'SHOP','👕 SKINY':'👕 SKINS','🎨 PERSONALIZACJA':'🎨 CUSTOMIZATION','🔄 OBRÓĆ':'🔄 ROTATE','✅ ZAŁÓŻ':'✅ EQUIP','👕 ZAŁÓŻ':'👕 EQUIP',
    '🧢 Kolor czapki':'🧢 Hat color','🎩 Fason czapki':'🎩 Hat style','🎨 Kolor skóry':'🎨 Skin tone','🧔 Zarost':'🧔 Facial hair','❤ Dodatkowe życia:':'❤ Extra lives:',
    'Doliczane do startowych 3 żyć przy następnej grze':'Added to your starting 3 lives in the next game',
    '🪙 KUP ŻYCIE (100)':'🪙 BUY LIFE (100)','🛡 Tarcze:':'🛡 Shields:',
    'W grze naciśnij Q, by aktywować na 15 sekund - zabija każdego wroga dotykiem i chroni przed obrażeniami':
      'In game press Q to activate for 15 seconds - kills any enemy on touch and protects you from damage',
    '🪙 KUP TARCZĘ (150)':'🪙 BUY SHIELD (150)','🆓 KUP ŻYCIE (DARMOWE)':'🆓 BUY LIFE (FREE)','🆓 KUP TARCZĘ (DARMOWE)':'🆓 BUY SHIELD (FREE)',
    'ZAŁOŻONE':'EQUIPPED','✅ ZAŁOŻONE':'✅ EQUIPPED','POSIADASZ':'OWNED','🆓 DARMOWE':'🆓 FREE',
    'Poziom':'Level','⛶ PEŁNY EKRAN':'⛶ FULLSCREEN',
    // ---- skiny ----
    'Klasyczny':'Classic','Zielony Sanitariusz':'Green Medic','Chciwiec':'Greedy','Ognisty':'Fiery','Lodowy':'Icy','Pirat':'Pirate',
    'Cień':'Shadow','Królewski':'Royal','Neonowy':'Neon','Złoty VIP':'Golden VIP','Kosmiczny':'Cosmic','Wojownik':'Warrior',
    'Leśny':'Forest','Wampir':'Vampire','Plażowy':'Beach','Diamentowy':'Diamond','Samuraj':'Samurai','Toksyczny':'Toxic',
    'Faraon':'Pharaoh','Cukierkowy':'Candy',
    // ---- trails ----
    'Brak':'None','Ukraina':'Ukraine','Polska':'Poland','Litwa':'Lithuania','Łotwa':'Latvia','Niemcy':'Germany','Włochy':'Italy',
    'Szwecja':'Sweden','Japonia':'Japan','Francja':'France','Hiszpania':'Spain','Holandia':'Netherlands','Belgia':'Belgium',
    'Irlandia':'Ireland','Finlandia':'Finland','Norwegia':'Norway',
    'Dania':'Denmark','Islandia':'Iceland','Szwajcaria':'Switzerland','Czechy':'Czechia','Wielka Brytania':'United Kingdom','Kanada':'Canada',
    'Grecja':'Greece','Portugalia':'Portugal','Węgry':'Hungary','Rumunia':'Romania','Bułgaria':'Bulgaria','Turcja':'Turkey','Brazylia':'Brazil',
    'Piracka flaga':'Pirate Flag',
    // ---- personalizacja ----
    'Domyślna':'Default','Czerwona':'Red','Niebieska':'Blue','Zielona':'Green','Fioletowa':'Purple','Czarna':'Black','Różowa':'Pink',
    'Złota':'Gold','Jasna':'Light','Śniada':'Tan','Ciemna':'Dark','Blada':'Pale','Zielona (kosmita)':'Green (alien)',
    'Błękitna':'Sky blue','Miętowa':'Mint','Koralowa':'Coral','Żółta':'Yellow','Magenta':'Magenta','Indygo':'Indigo','Lawendowa':'Lavender','Brzoskwiniowa':'Peach','Łupkowa':'Slate','Leśna':'Forest green','Khaki':'Khaki','Cyjan':'Cyan','Miedziana':'Copper',
    'Pomarańczowa':'Orange','Turkusowa':'Teal','Biała':'White','Bordowa':'Maroon','Limonkowa':'Lime','Granatowa':'Navy','Brązowa':'Brown','Srebrna':'Silver',
    'Porcelanowa':'Porcelain','Piaskowa':'Sand','Miodowa':'Honey','Karmelowa':'Caramel','Mokka':'Mocha','Heban':'Ebony',
    'Bardzo ciemna':'Deep','Oliwkowa':'Olive','Szara':'Gray',
    'Czapka z daszkiem':'Baseball cap','Czapka zimowa':'Beanie','Hełm':'Hard hat','Opaska ninja':'Ninja headband','Kapelusz kowbojski':'Cowboy hat',
    'Kaszkiet':'Flat cap','Kapelusz wędkarza':'Bucket hat','Beret':'Beret','Czapeczka urodzinowa':'Party hat','Czapka ze śmigłem':'Propeller cap',
    'Kocie uszy':'Cat ears','Fez':'Fez','Czapka Mikołaja':'Santa hat','Czapka kucharska':'Chef hat','Kapelusz pirata':'Pirate hat','Sombrero':'Sombrero','Hełm wikinga':'Viking helmet',
    'Cylinder':'Top hat','Kapelusz czarodzieja':'Wizard hat','Korona':'Crown',
    'Cienkie wąsy':'Pencil mustache','Zarost 3-dniowy':'Stubble','Baki':'Sideburns','Wąsy kręcone':'Handlebar mustache','Wąsy morsa':'Walrus mustache',
    'Długa broda':'Long beard','Broda Mikołaja':'Santa beard',
    'Wąsy (domyślne)':'Mustache (default)','Gładko ogolony':'Clean shaven','Broda':'Beard','Kozia bródka':'Goatee',
    // ---- nazwy poziomow ----
    'Zielone Wzgórza':'Green Hills','Skoki nad Przepaścią':'Leaps Over the Abyss','Kamienny Labirynt':'Stone Labyrinth',
    'Wieża Chmur':'Cloud Tower','Wulkaniczna Otchłań':'Volcanic Abyss','Lodowa Twierdza':'Ice Fortress','Latający Szlak':'Flying Trail',
    'Pustynia Kolców':'Desert of Spikes','Ostateczna Próba':'Final Trial','Podniebna Forteca':'Sky Fortress','Mroczny Finał':'Dark Finale',
    'Zamarznięty Labirynt':'Frozen Labyrinth','Piaszczysta Otchłań':'Sandy Abyss','Korytarz Zagłady':'Corridor of Doom',
    'Król Kolców':'King of Spikes','Starcie z Bossem':'Boss Showdown','Strażnik Traktu':'Guardian of the Road','Długi Trakt':'Long Road',
    'Fortec Wieżyczek':'Turret Fortress','Strażnik Bastionu':'Bastion Guardian','Ostatni Bastion':'Last Bastion',
    'Wartownik Szlaku':'Trail Sentinel','Chwiejny Szlak':'Wobbly Trail','Własny Boss':'Custom Boss','Poziom własny':'Custom level',
    'Poziom bez nazwy':'Unnamed level','Nieznany gracz':'Unknown player',
    // ---- multiplayer / komunikaty ----
    'Multiplayer wymaga skonfigurowanego konta (Supabase).':'Multiplayer requires a configured account (Supabase).',
    '⚠ Nikogo tu nie ma - sprawdź kod albo poproś hosta o nowe lobby.':'⚠ Nobody is here - check the code or ask the host for a new lobby.',
    'WSPÓŁGRACZ UKOŃCZYŁ WSZYSTKIE POZIOMY!':'YOUR TEAMMATE FINISHED ALL LEVELS!','WSPÓŁGRACZ PRZESZEDŁ DALEJ!':'YOUR TEAMMATE MOVED ON!',
    'Przechodzimy razem...':'Moving on together...','WSZYSCY PRZEGRALIŚCIE - RESTART POZIOMU':'YOU ALL LOST - RESTARTING LEVEL',
    'Czekam aż host rozpocznie grę...':'Waiting for the host to start the game...','⚠ Nie udało się połączyć. Spróbuj ponownie.':'⚠ Could not connect. Please try again.',
    'Wpisz swój nick.':'Enter your nickname.','Kod ma 5 znaków, np. AB3XQ.':'The code has 5 characters, e.g. AB3XQ.',
    'Wczytywanie poziomu własnego...':'Loading custom level...','Multiplayer/poziomy własne wymagają konta (Supabase).':'Multiplayer/custom levels require an account (Supabase).',
    'Nie znaleziono poziomu o tym kodzie.':'No level found with this code.','Kod ma 5 znaków.':'The code has 5 characters.','Wczytywanie...':'Loading...',
    'NIE ŻYJESZ':'YOU ARE DEAD','Oglądasz współgraczy...':'Watching your teammates...','💀 Nie żyjesz - oglądasz współgraczy':'💀 You are dead - watching your teammates',
    // ---- konto / ranking ----
    'Konta Google: nieskonfigurowane (uzupelnij SUPABASE_URL / KEY w kodzie)':'Google accounts: not configured (fill in SUPABASE_URL / KEY in the code)',
    '🚪 WYLOGUJ':'🚪 LOG OUT','🔵 ZALOGUJ PRZEZ GOOGLE':'🔵 LOG IN WITH GOOGLE','niedostępny bez konta':'unavailable without an account','brak wynikow':'no results',
    // ---- warsztat / moje poziomy / speedruny ----
    'Warsztat wymaga skonfigurowanego konta (Supabase).':'The Workshop requires a configured account (Supabase).',
    'Nikt jeszcze nie opublikował poziomu. Stwórz pierwszy w CREATE LEVEL!':'Nobody has published a level yet. Create the first one in CREATE LEVEL!',
    'Wymaga skonfigurowanego konta (Supabase).':'Requires a configured account (Supabase).',
    'Nikt jeszcze nie ukończył tego poziomu na czas. Bądź pierwszy!':'Nobody has completed this level on time yet. Be the first!',
    '🛠️ ADMIN: EDYCJA WBUDOWANYCH POZIOMÓW':'🛠️ ADMIN: EDITING BUILT-IN LEVELS','(poprawiony)':'(edited)','✏️ EDYTUJ':'✏️ EDIT','🗑 USUŃ':'🗑 DELETE',
    'Zaloguj się przez Google, żeby zobaczyć swoje poziomy.':'Log in with Google to see your levels.',
    'Nie masz jeszcze żadnych poziomów. Kliknij 🛠️ CREATE LEVEL, żeby stworzyć pierwszy!':'You do not have any levels yet. Click 🛠️ CREATE LEVEL to create your first one!',
    'Na pewno usunąć ten poziom? Tej operacji nie da się cofnąć.':'Are you sure you want to delete this level? This cannot be undone.',
    // ---- zapis w edytorze ----
    '⚠ Dodaj chociaż jeden kawałek gruntu!':'⚠ Add at least one piece of ground!','⚠ Zapis wymaga konta (Supabase).':'⚠ Saving requires an account (Supabase).',
    '⚠ Zaloguj się przez Google, żeby zapisywać poziomy.':'⚠ Log in with Google to save levels.',
    '⚠ Dodaj chociaż jeden kawałek gruntu, zanim zapiszesz!':'⚠ Add at least one piece of ground before saving!',
    '⚠ Tylko admin może edytować wbudowane poziomy.':'⚠ Only the admin can edit built-in levels.',
    'Zapisywanie poprawki do wbudowanego poziomu...':'Saving fix to the built-in level...','Aktualizowanie...':'Updating...',
    '✅ Zaktualizowano poziom! Kod pozostaje taki sam:':'✅ Level updated! The code stays the same:','Sprawdzanie limitu...':'Checking limit...',
    'Zapisywanie...':'Saving...','✅ Zapisano! Kod poziomu:':'✅ Saved! Level code:',
    '— podaj go znajomemu, żeby zagrał na tym samym poziomie (też w multiplayer). Znajdziesz go też w "MOJE POZIOMY".':
      '— give it to a friend so they can play the same level (also in multiplayer). You can also find it in "MY LEVELS".',
    // ---- banery ----
    'POZIOM WŁASNY UKOŃCZONY!':'CUSTOM LEVEL COMPLETED!','POZIOM UKOŃCZONY!':'LEVEL COMPLETED!','UKOŃCZYLIŚCIE WSZYSTKIE POZIOMY!':'YOU FINISHED ALL LEVELS!',
    'UKOŃCZYŁEŚ WSZYSTKIE POZIOMY!':'YOU FINISHED ALL LEVELS!','PRZEGRANA - RESTART POZIOMU':'DEFEAT - RESTARTING LEVEL'
  };
  function nf(x){ return x.replace(/\uFE0F/g,''); }   // ignoruj selektor wariantu emoji
  var DICT = new Map();
  Object.keys(DICT_SRC).forEach(function(k){ DICT.set(nf(k.replace(/\s+/g,' ').trim()), DICT_SRC[k]); });

  var PATTERNS = [
    [/^⏳ Czekam na graczy\.\.\. \((\d+)\/(\d+)\)$/, '⏳ Waiting for players... ($1/$2)'],
    [/^Czekam na graczy\.\.\. \((\d+)\/(\d+)\)$/, 'Waiting for players... ($1/$2)'],
    [/^✅ (\d+)\/(\d+) graczy - możesz zaczynać!$/, '✅ $1/$2 players - you can start!'],
    [/^Łączenie z lobby (.*)$/, 'Connecting to lobby $1'],
    [/^(👥 MULTIPLAYER · .*) · ktoś zginął, gra dalej!$/, '$1 · someone died, the game goes on!'],
    [/^Waga poziomu: (.*)$/, 'Level size: $1'],
    [/^🪙 KUP ZA (\d+)$/, '🪙 BUY FOR $1'],
    [/^\+(\d+) monet zebranych$/, '+$1 coins collected'],
    [/^\+(\d+) monet$/, '+$1 coins'],
    [/^⏱ Czas: (.*)$/, '⏱ Time: $1'],
    [/^Poziom (\d+)$/, 'Level $1'],
    [/^Twoje miejsce: #(\d+)$/, 'Your rank: #$1'],
    [/^Widok: (\d+)–(\d+) \/ (\d+) px$/, 'View: $1–$2 / $3 px'],
    [/^⚠ Nie można skrócić poziomu - elementy sięgają do (\d+) px$/, '⚠ Cannot shorten the level - elements reach up to $1 px'],
    [/^↩ Cofnięto \(pozostało (\d+)\)$/, '↩ Undone ($1 left)'],
    [/^Gracz( \d+| 💀)?$/, 'Player$1'],
    [/^✅ Zalogowano: (.*)$/, '✅ Logged in: $1'],
    [/^Autor: (.*) • ▶ (\d+) razy zagrany • KOD: (.*)$/, 'Author: $1 • ▶ played $2 times • CODE: $3'],
    [/^KOD: (.*) • Waga: (.*)$/, 'CODE: $1 • Size: $2'],
    [/^✏️ Edytujesz WBUDOWANY poziom (\d+)\. Zapisz, żeby poprawka obowiązywała od razu wszystkich graczy\.$/,
      '✏️ You are editing BUILT-IN level $1. Save to apply the fix for all players immediately.'],
    [/^✏️ Edytujesz istniejący poziom \(kod (.*)\)\. Zapisz, żeby nadpisać go zmianami\.$/,
      '✏️ You are editing an existing level (code $1). Save to overwrite it with your changes.'],
    [/^Błąd usuwania: ([\s\S]*)$/, 'Delete error: $1'],
    [/^⚠ Błąd wczytywania: ([\s\S]*)$/, '⚠ Loading error: $1'],
    [/^⚠ Błąd zapisu poprawki: ([\s\S]*)$/, '⚠ Error saving fix: $1'],
    [/^⚠ Błąd aktualizacji: ([\s\S]*)$/, '⚠ Update error: $1'],
    [/^⚠ Błąd sprawdzania limitu: ([\s\S]*)$/, '⚠ Error checking limit: $1'],
    [/^⚠ Błąd zapisu: ([\s\S]*)$/, '⚠ Save error: $1'],
    [/^✅ Zapisano poprawkę do wbudowanego poziomu (\d+)! Zmiana obowiązuje od razu dla wszystkich graczy\.$/,
      '✅ Fix saved to built-in level $1! The change applies to all players immediately.'],
    [/^⚠ Masz już maksymalną liczbę poziomów \((\d+)\/(\d+)\)\. Usuń jakiś w "MOJE POZIOMY", żeby zapisać nowy\.$/,
      '⚠ You already have the maximum number of levels ($1/$2). Delete one in "MY LEVELS" to save a new one.']
  ];
  PATTERNS = PATTERNS.map(function(p){ return [new RegExp(nf(p[0].source), p[0].flags), p[1]]; });
  // "Własny: X", "3 - X", "3. X" -> tlumaczy tylko nazwe poziomu X
  var NAME_RULES = [ /^(Własny: )(.+)$/, /^(\d+ - )(.+)$/, /^(\d+\. )(.+)$/ ];
  var NAME_PREFIX = { 'Własny: ': 'Custom: ' };

  var lang = 'en';
  try { var saved = localStorage.getItem('spb_lang'); if(saved === 'pl' || saved === 'en') lang = saved; } catch(e){}

  var cache = new Map();
  function trLine(orig){
    var key = nf(orig);
    if(DICT.has(key)) return DICT.get(key);
    for(var i=0;i<PATTERNS.length;i++){
      if(PATTERNS[i][0].test(key)) return key.replace(PATTERNS[i][0], PATTERNS[i][1]);
    }
    for(var j=0;j<NAME_RULES.length;j++){
      var m = NAME_RULES[j].exec(key);
      if(m && (NAME_PREFIX[m[1]] || DICT.has(m[2]))) return (NAME_PREFIX[m[1]] || m[1]) + (DICT.has(m[2]) ? DICT.get(m[2]) : m[2]);
    }
    return orig;
  }
  function trCore(core){
    var hit = cache.get(core);
    if(hit !== undefined) return hit;
    var key = core.replace(/\s+/g,' ');
    var out = trLine(key);
    if(out === key && core.indexOf('\n') >= 0){
      out = core.split('\n').map(function(l){
        var t = l.trim(); if(!t) return l;
        var r = trLine(t.replace(/\s+/g,' '));
        return r === t ? l : l.replace(t, r);
      }).join('\n');
    } else if(out === key){ out = core; }
    if(cache.size > 4000) cache.clear();
    cache.set(core, out);
    return out;
  }
  var HAS_WORD = /[A-Za-z\u00C0-\u017F]{2}/;
  function tr(s){
    if(lang !== 'en' || typeof s !== 'string' || !HAS_WORD.test(s)) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    var core = m[2]; if(!core) return s;
    var out = trCore(core);
    return out === core ? s : m[1] + out + m[3];
  }

  // ---------- DOM ----------
  var textRec = new WeakMap();   // Text node -> {pl, en}
  var attrRec = new WeakMap();   // Element -> {attr: {pl, en}}
  var ATTRS = ['placeholder','title'];
  function doText(n){
    var v = n.nodeValue, rec = textRec.get(n);
    if(lang === 'en'){
      if(rec && rec.en === v) return;
      var en = tr(v);
      if(en !== v){ textRec.set(n, {pl:v, en:en}); n.nodeValue = en; }
    } else if(rec){
      if(rec.en === v) n.nodeValue = rec.pl;
      textRec.delete(n);
    }
  }
  function doAttr(el, a){
    if(!el.hasAttribute || !el.hasAttribute(a)) return;
    var v = el.getAttribute(a), all = attrRec.get(el) || {}, rec = all[a];
    if(lang === 'en'){
      if(rec && rec.en === v) return;
      var en = tr(v);
      if(en !== v){ all[a] = {pl:v, en:en}; attrRec.set(el, all); el.setAttribute(a, en); }
    } else if(rec){
      if(rec.en === v) el.setAttribute(a, rec.pl);
      delete all[a];
    }
  }
  function walk(root){
    if(!root) return;
    if(root.nodeType === 3){ doText(root); return; }
    if(root.nodeType !== 1) return;
    var tag = root.tagName;
    if(tag === 'SCRIPT' || tag === 'STYLE') return;
    ATTRS.forEach(function(a){ doAttr(root, a); });
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while((n = tw.nextNode())){
      if(n.nodeType === 3){
        var p = n.parentNode && n.parentNode.tagName;
        if(p !== 'SCRIPT' && p !== 'STYLE') doText(n);
      } else if(n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE'){
        ATTRS.forEach(function(a){ doAttr(n, a); });
      }
    }
  }
  var observer = new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){
      var m = muts[i];
      if(m.type === 'characterData') doText(m.target);
      else if(m.type === 'attributes') doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(walk);
    }
  });
  function startObserver(){
    observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  }

  // ---------- canvas / dialogi ----------
  var CP = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if(CP){
    ['fillText','strokeText','measureText'].forEach(function(fn){
      var orig = CP[fn];
      CP[fn] = function(text){ arguments[0] = tr(String(text)); return orig.apply(this, arguments); };
    });
  }
  ['alert','confirm','prompt'].forEach(function(fn){
    var orig = window[fn];
    window[fn] = function(msg){ arguments[0] = tr(msg == null ? msg : String(msg)); return orig.apply(window, arguments); };
  });

  function updateLangButtons(){
    document.querySelectorAll('.lang-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.lang === lang); });
  }
  function setLang(l){
    if(l !== 'en' && l !== 'pl') return;
    lang = l;
    try { localStorage.setItem('spb_lang', l); } catch(e){}
    document.documentElement.lang = l;
    cache.clear();
    walk(document.body);
    updateLangButtons();
    document.dispatchEvent(new CustomEvent('spb-lang-change', {detail:{lang:l}}));
  }

  document.documentElement.lang = lang;
  walk(document.body);
  startObserver();
  document.querySelectorAll('.lang-btn').forEach(function(b){ b.onclick = function(){ setLang(b.dataset.lang); }; });
  updateLangButtons();
  window.I18N = { tr: tr, setLang: setLang, get lang(){ return lang; } };
})();
