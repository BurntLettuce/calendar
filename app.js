(function(){
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MOOD_LEVELS = ['calm','restless','anxious','distressed','breaking'];
  const MOOD_LABEL = {calm:"Calm",restless:"Restless",anxious:"Anxious",distressed:"Distressed",breaking:"Breaking"};
  const PAGE_EPOCH_YEAR = 2026; // Page 1 = January 2026
  const PAGE_EPOCH_MONTH = 0;

  let view = new Date();
  view.setDate(1);
  let entries = {}; // { "YYYY-M-D": [ {id,title,time,note} ] }
  let selectedDateKey = null;
  let storageReady = false;

  const grid = document.getElementById('grid');
  const monthLabel = document.getElementById('monthLabel');
  const pageLabel = document.getElementById('pageLabel');
  const pageJump = document.getElementById('pageJump');
  const pageInput = document.getElementById('pageInput');
  const pageGoBtn = document.getElementById('pageGoBtn');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const ledgerDrawer = document.getElementById('ledgerDrawer');
  const bookOverlay = document.getElementById('bookOverlay');
  const dayViewBackdrop = document.getElementById('dayViewBackdrop');
  const timelineOverlay = document.getElementById('timelineOverlay');
  const timelineWeekday = document.getElementById('timelineWeekday');
  const timelineDate = document.getElementById('timelineDate');
  const timelineTrackWrap = document.getElementById('timelineTrackWrap');
  const timelineTrack = document.getElementById('timelineTrack');
  const timelineUntimed = document.getElementById('timelineUntimed');
  const entriesList = document.getElementById('entriesList');
  const panelDate = document.getElementById('panelDate');
  const panelWeekday = document.getElementById('panelWeekday');
  const chapterTag = document.getElementById('chapterTag');
  const bookDateLabel = document.getElementById('bookDateLabel');
  const openAddBtn = document.getElementById('openAddBtn');
  const addForm = document.getElementById('addForm');
  const titleInput = document.getElementById('titleInput');
  const startTimeInput = document.getElementById('startTimeInput');
  const endTimeInput = document.getElementById('endTimeInput');
  const noteInput = document.getElementById('noteInput');
  const authBtn = document.getElementById('authBtn');
  const authPanel = document.getElementById('authPanel');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authError = document.getElementById('authError');
  let currentUser = null;

  function dateKey(y,m,d){ return y+'-'+m+'-'+d; }
  function todayKey(){ const t=new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()); }

  function minutesFromTime(t){
    if(!t) return null;
    const [h,m] = t.split(':').map(Number);
    return h*60+m;
  }
  function formatTime12(t){
    if(!t) return '';
    const [h,m] = t.split(':').map(Number);
    const period = h>=12 ? 'PM' : 'AM';
    let hh = h%12; if(hh===0) hh=12;
    return hh+':'+String(m).padStart(2,'0')+' '+period;
  }
  function formatTimeRange(entry){
    if(entry.startTime && entry.endTime) return formatTime12(entry.startTime)+'\u2013'+formatTime12(entry.endTime);
    if(entry.startTime) return formatTime12(entry.startTime);
    if(entry.endTime) return 'Ends '+formatTime12(entry.endTime);
    return '';
  }

  // nth weekday of a month (weekday: 0=Sun..6=Sat, n: 1st..5th occurrence)
  function nthWeekdayOfMonth(year, month, weekday, n){
    const firstDow = new Date(year, month, 1).getDay();
    return 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  }
  // last occurrence of a weekday in a month
  function lastWeekdayOfMonth(year, month, weekday){
    const lastDate = new Date(year, month + 1, 0);
    const lastDow = lastDate.getDay();
    return lastDate.getDate() - ((lastDow - weekday + 7) % 7);
  }

  // the 11 US federal holidays, by observed rule (month is 0-indexed)
  // returns { name, note } for a holiday date, or null
  function getHolidayInfo(y, m, d){
    if(m===0 && d===1) return { name:"New Year's Day", note:"The old year is closed and sealed; a fresh page opens." };
    if(m===0 && d===nthWeekdayOfMonth(y,0,1,3)) return { name:"Martin Luther King Jr. Day", note:"A day set aside to honor Dr. King's life and his work for civil rights." };
    if(m===1 && d===nthWeekdayOfMonth(y,1,1,3)) return { name:"Washington's Birthday", note:"Also observed as Presidents' Day, honoring the nation's presidents." };
    if(m===4 && d===lastWeekdayOfMonth(y,4,1)) return { name:"Memorial Day", note:"A remembrance for those who died in military service." };
    if(m===5 && d===19) return { name:"Juneteenth", note:"Marks the end of slavery in the United States." };
    if(m===6 && d===4) return { name:"Independence Day", note:"Marks the adoption of the Declaration of Independence in 1776." };
    if(m===8 && d===nthWeekdayOfMonth(y,8,1,1)) return { name:"Labor Day", note:"A tribute to the contributions of workers." };
    if(m===9 && d===nthWeekdayOfMonth(y,9,1,2)) return { name:"Columbus Day", note:"Marks Christopher Columbus's arrival in the Americas in 1492." };
    if(m===10 && d===11) return { name:"Veterans Day", note:"Honors all who have served in the armed forces." };
    if(m===10 && d===nthWeekdayOfMonth(y,10,4,4)) return { name:"Thanksgiving Day", note:"A day of gathering and gratitude." };
    if(m===11 && d===25) return { name:"Christmas Day", note:"A day of rest and celebration, marked across the calendar." };
    return null;
  }

  // emotion rises the more events are bound to a single day — 0 events is calm (no mood), then escalates
  function moodForCount(count){
    if(count<=0) return null;
    return MOOD_LEVELS[Math.min(count,MOOD_LEVELS.length)-1];
  }

  function pageNumberFor(y,m){
    return (y - PAGE_EPOCH_YEAR) * 12 + (m - PAGE_EPOCH_MONTH) + 1;
  }

  function dateForPage(pageNum){
    const totalMonths = pageNum - 1; // months offset from Jan 2026
    const year = PAGE_EPOCH_YEAR + Math.floor(totalMonths / 12);
    const month = ((totalMonths % 12) + 12) % 12;
    return { year, month };
  }

  function toRoman(num){
    const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let n = num, out='';
    for(const [val,sym] of map){ while(n>=val){ out+=sym; n-=val; } }
    return out || 'I';
  }

  function loadEntries(){
    window.__ghostDB.subscribe((liveEntries)=>{
      entries = liveEntries;
      storageReady = true;
      render();
      if(selectedDateKey){ renderEntries(); renderTimeline(); }
    });
  }

  async function saveEntries(){
    try{
      await window.__ghostDB.save(entries);
    }catch(e){ /* user was already alerted inside save() */ }
  }

  function spawnWisps(){
    for(let i=0;i<7;i++){
      const w = document.createElement('div');
      w.className='wisp';
      const size = 60 + Math.random()*140;
      w.style.width = size+'px';
      w.style.height = size+'px';
      w.style.left = (Math.random()*100)+'vw';
      w.style.top = (60+Math.random()*40)+'vh';
      w.style.animationDuration = (18+Math.random()*22)+'s';
      w.style.animationDelay = (Math.random()*20)+'s';
      document.body.appendChild(w);
    }
  }

  function spawnSteam(){
    for(let i=0;i<6;i++){
      const s = document.createElement('div');
      s.className='steam';
      const width = 50 + Math.random()*70;
      const height = width * (2.6 + Math.random()*1.2);
      s.style.width = width+'px';
      s.style.height = height+'px';
      s.style.left = (5 + Math.random()*90)+'vw';
      s.style.animationDuration = (14+Math.random()*10)+'s';
      s.style.animationDelay = (Math.random()*16)+'s';
      document.body.appendChild(s);
    }
  }

  const LEAF_VARIANTS = ['leaf-distressed','leaf-anxious','leaf-breaking'];
  let currentSeason = null;
  let leafTimer = null;
  let snowTimer = null;

  function seasonForMonth(m){
    if(m===8 || m===9 || m===10) return 'fall';
    if(m===11 || m===0 || m===1) return 'winter';
    if(m===2 || m===3 || m===4) return 'spring';
    return 'summer';
  }

  function spawnLeaf(){
    const l = document.createElement('div');
    const size = 10 + Math.random()*10;
    l.className = 'leaf ' + LEAF_VARIANTS[Math.floor(Math.random()*LEAF_VARIANTS.length)];
    l.style.width = size+'px';
    l.style.height = size+'px';
    l.style.left = (Math.random()*100)+'vw';
    l.style.animationDuration = (9+Math.random()*8)+'s';
    l.addEventListener('animationend', ()=> l.remove());
    document.body.appendChild(l);
  }

  function spawnSnowflake(){
    const s = document.createElement('div');
    const size = 3 + Math.random()*5;
    s.className = 'snowflake';
    s.style.width = size+'px';
    s.style.height = size+'px';
    s.style.left = (Math.random()*100)+'vw';
    s.style.animationDuration = (10+Math.random()*10)+'s';
    s.addEventListener('animationend', ()=> s.remove());
    document.body.appendChild(s);
  }

  // start/stop only control whether NEW particles spawn — anything already
  // falling keeps falling and removes itself naturally when its animation ends
  function startLeaves(){
    if(leafTimer) return;
    for(let i=0;i<10;i++) setTimeout(spawnLeaf, Math.random()*3000);
    leafTimer = setInterval(spawnLeaf, 650);
  }
  function stopLeaves(){
    if(leafTimer){ clearInterval(leafTimer); leafTimer = null; }
  }
  function startSnow(){
    if(snowTimer) return;
    for(let i=0;i<14;i++) setTimeout(spawnSnowflake, Math.random()*3000);
    snowTimer = setInterval(spawnSnowflake, 320);
  }
  function stopSnow(){
    if(snowTimer){ clearInterval(snowTimer); snowTimer = null; }
  }

  function applySeason(){
    const season = seasonForMonth(view.getMonth());
    if(season === currentSeason) return;
    currentSeason = season;
    stopLeaves();
    stopSnow();
    if(season === 'fall') startLeaves();
    else if(season === 'winter') startSnow();
  }

  function render(){
    const y = view.getFullYear();
    const m = view.getMonth();
    applySeason();
    monthLabel.innerHTML = MONTHS[m] + ' <span class="year">' + y + '</span>';
    const pageNum = pageNumberFor(y, m);
    pageLabel.textContent = 'Page ' + pageNum;
    pageInput.value = pageNum;

    const firstDow = new Date(y,m,1).getDay();
    const daysInMonth = new Date(y,m+1,0).getDate();
    const daysInPrevMonth = new Date(y,m,0).getDate();
    const tKey = todayKey();

    grid.innerHTML = '';
    const totalCells = Math.ceil((firstDow + daysInMonth)/7)*7;

    for(let i=0;i<totalCells;i++){
      const dayNum = i - firstDow + 1;
      let cellY=y, cellM=m, cellD, muted=false;

      if(dayNum < 1){
        cellD = daysInPrevMonth + dayNum;
        cellM = m-1; if(cellM<0){cellM=11; cellY=y-1;}
        muted = true;
      } else if(dayNum > daysInMonth){
        cellD = dayNum - daysInMonth;
        cellM = m+1; if(cellM>11){cellM=0; cellY=y+1;}
        muted = true;
      } else {
        cellD = dayNum;
      }

      const key = dateKey(cellY,cellM,cellD);
      const dayEntries = entries[key] || [];
      const mood = moodForCount(dayEntries.length);
      const holidayInfo = getHolidayInfo(cellY, cellM, cellD);
      const holiday = !!holidayInfo;

      const btn = document.createElement('button');
      btn.className = 'day' + (muted ? ' muted' : '') + (key===tKey ? ' today' : '') + (mood ? ' mood-'+mood : '') + (holiday ? ' holiday' : '');
      btn.setAttribute('aria-label', MONTHS[cellM]+' '+cellD+', '+cellY + (holiday ? ', federal holiday: '+holidayInfo.name : '') + (mood ? ', emotion level '+MOOD_LABEL[mood] : ''));

      const num = document.createElement('div');
      num.className='num';
      num.textContent = cellD;
      btn.appendChild(num);

      if(dayEntries.length){
        const row = document.createElement('div');
        row.className='mood-row';

        const dot = document.createElement('span');
        dot.className='mood-dot '+mood;
        row.appendChild(dot);

        const count = document.createElement('span');
        count.className='event-count';
        count.textContent = dayEntries.length + (dayEntries.length===1 ? ' event' : ' events');
        row.appendChild(count);

        btn.appendChild(row);

        const preview = document.createElement('div');
        preview.className='entry-preview';
        preview.textContent = dayEntries[0].title;
        btn.appendChild(preview);
      } else if(holiday){
        const preview = document.createElement('div');
        preview.className='entry-preview holiday-preview';
        preview.textContent = holidayInfo.name;
        btn.appendChild(preview);
      }

      btn.addEventListener('click', ()=> openDay(key, cellY, cellM, cellD));
      grid.appendChild(btn);
    }
  }

  function openDay(key, y, m, d){
    selectedDateKey = key;

    const weekday = WEEKDAYS[new Date(y,m,d).getDay()];
    const dateText = MONTHS[m] + ' ' + d + ', ' + y;
    panelWeekday.textContent = weekday;
    panelDate.textContent = dateText;
    bookDateLabel.textContent = weekday + ', ' + dateText;
    timelineWeekday.textContent = weekday;
    timelineDate.textContent = dateText;

    renderEntries();
    renderTimeline();

    drawerOverlay.classList.add('open');
    timelineOverlay.classList.add('open');
    updateDayViewBackdrop();
  }

  function anyDayViewOpen(){
    return bookOverlay.classList.contains('open') || drawerOverlay.classList.contains('open') || timelineOverlay.classList.contains('open');
  }

  // the shared backdrop stays up as long as the drawer or timeline is open,
  // and it's what blocks interaction with the calendar underneath
  function updateDayViewBackdrop(){
    const shouldShow = drawerOverlay.classList.contains('open') || timelineOverlay.classList.contains('open');
    dayViewBackdrop.classList.toggle('open', shouldShow);
  }

  function closeDrawer(){
    drawerOverlay.classList.remove('open');
    updateDayViewBackdrop();
    if(!anyDayViewOpen()) selectedDateKey = null;
  }

  function closeTimeline(){
    timelineOverlay.classList.remove('open');
    updateDayViewBackdrop();
    if(!anyDayViewOpen()) selectedDateKey = null;
  }

  function closeAllDayViews(){
    drawerOverlay.classList.remove('open');
    timelineOverlay.classList.remove('open');
    updateDayViewBackdrop();
    if(!anyDayViewOpen()) selectedDateKey = null;
  }

  function openAddForm(){
    titleInput.value=''; startTimeInput.value=''; endTimeInput.value=''; noteInput.value='';
    bookOverlay.classList.add('open');
    setTimeout(()=>titleInput.focus(), 300);
  }

  function closeAddForm(){
    bookOverlay.classList.remove('open');
    if(!anyDayViewOpen()) selectedDateKey = null;
  }

  function renderTimeline(){
    const list = entries[selectedDateKey] || [];
    const [hy, hm, hd] = selectedDateKey.split('-').map(Number);
    const holidayInfo = getHolidayInfo(hy, hm, hd);

    timelineTrack.innerHTML = '';
    for(let h=0; h<24; h++){
      const row = document.createElement('div');
      row.className = 'timeline-hour';
      row.style.top = (h*48)+'px';
      const label = document.createElement('div');
      label.className='hour-label';
      label.textContent = h===0 ? '12 AM' : h<12 ? h+' AM' : h===12 ? '12 PM' : (h-12)+' PM';
      row.appendChild(label);
      timelineTrack.appendChild(row);
    }

    if(holidayInfo){
      const block = document.createElement('div');
      block.className = 'timeline-event holiday-event';
      block.style.top = '2px';
      block.style.height = '40px';
      const title = document.createElement('div'); title.className='t-title'; title.textContent = holidayInfo.name;
      const time = document.createElement('div'); time.className='t-time'; time.textContent = 'Federal Holiday';
      block.appendChild(title); block.appendChild(time);
      timelineTrack.appendChild(block);
    }

    const untimed = [];
    const timed = [];
    list.forEach(entry=>{
      if(minutesFromTime(entry.startTime)===null) untimed.push(entry);
      else timed.push(entry);
    });

    timed.forEach(entry=>{
      const startMin = minutesFromTime(entry.startTime);
      let endMin = minutesFromTime(entry.endTime);
      if(endMin===null || endMin<=startMin) endMin = startMin+30; // no valid end time given — fall back to a 30-minute block
      const top = (startMin/60)*48;
      const height = Math.max(((endMin-startMin)/60)*48, 18);

      const block = document.createElement('div');
      block.className = 'timeline-event';
      block.style.top = top+'px';
      block.style.height = height+'px';

      const title = document.createElement('div');
      title.className='t-title';
      title.textContent = entry.title;
      block.appendChild(title);

      const time = document.createElement('div');
      time.className='t-time';
      time.textContent = formatTimeRange(entry);
      block.appendChild(time);

      timelineTrack.appendChild(block);
    });

    timelineUntimed.innerHTML = '';
    if(untimed.length){
      const heading = document.createElement('div');
      heading.className='untimed-title';
      heading.textContent = 'Untimed';
      timelineUntimed.appendChild(heading);
      untimed.forEach(entry=>{
        const item = document.createElement('div');
        item.className='untimed-item';
        item.textContent = entry.title;
        timelineUntimed.appendChild(item);
      });
    }

    requestAnimationFrame(()=>{
      let scrollTarget = 7*48;
      if(timed.length){
        const earliest = Math.min(...timed.map(e=>minutesFromTime(e.startTime)));
        scrollTarget = Math.max(0, (earliest/60)*48 - 48);
      }
      timelineTrackWrap.scrollTop = scrollTarget;
    });
  }

  function renderEntries(){
    const list = entries[selectedDateKey] || [];
    const mood = moodForCount(list.length);
    const [hy, hm, hd] = selectedDateKey.split('-').map(Number);
    const holidayInfo = getHolidayInfo(hy, hm, hd);

    chapterTag.innerHTML = mood
      ? '<span class="mood-dot '+mood+'"></span>' + list.length + (list.length===1 ? ' event bound · emotion ' : ' events bound · emotion ') + MOOD_LABEL[mood]
      : 'No events bound yet';

    entriesList.innerHTML='';

    if(holidayInfo){
      const card = document.createElement('div');
      card.className = 'entry-card holiday-card';

      const main = document.createElement('div');
      main.className='entry-main';

      const title = document.createElement('div');
      title.className='title';
      title.textContent = holidayInfo.name;
      main.appendChild(title);

      const meta = document.createElement('div');
      meta.className='time';
      meta.innerHTML = '<span class="event-num">Federal Holiday</span>';
      main.appendChild(meta);

      const note = document.createElement('div');
      note.className='note';
      note.textContent = holidayInfo.note;
      main.appendChild(note);

      card.appendChild(main);
      entriesList.appendChild(card);
    }

    if(!list.length){
      const empty = document.createElement('div');
      empty.className='empty-note';
      empty.textContent = holidayInfo ? 'No further events bound. The rest of the chapter waits.' : 'Waiting for plans.';
      entriesList.appendChild(empty);
      return;
    }
    const sorted = [...list].sort((a,b)=> (a.startTime||'99:99').localeCompare(b.startTime||'99:99'));
    sorted.forEach((entry, idx)=>{
      const pageMood = MOOD_LEVELS[Math.min(idx+1, MOOD_LEVELS.length)-1];

      const card = document.createElement('div');
      card.className = 'entry-card ' + pageMood;

      const main = document.createElement('div');
      main.className='entry-main';

      const title = document.createElement('div');
      title.className='title';
      title.textContent = entry.title;
      main.appendChild(title);

      const meta = document.createElement('div');
      meta.className='time';
      meta.innerHTML = '<span class="event-num">Event ' + toRoman(idx+1) + '</span>' + (formatTimeRange(entry) ? '  ·  ' + formatTimeRange(entry) : '');
      main.appendChild(meta);

      if(entry.note){
        const note = document.createElement('div');
        note.className='note';
        note.textContent = entry.note;
        main.appendChild(note);
      }
      card.appendChild(main);

      const del = document.createElement('button');
      del.className='del-btn';
      del.setAttribute('aria-label','Remove entry');
      del.innerHTML = '&#10005;';
      del.addEventListener('click', ()=> deleteEntry(entry.id));
      card.appendChild(del);

      entriesList.appendChild(card);
    });
  }

  function deleteEntry(id){
    const list = entries[selectedDateKey] || [];
    entries[selectedDateKey] = list.filter(e=>e.id!==id);
    if(entries[selectedDateKey].length===0) delete entries[selectedDateKey];
    saveEntries();
    renderEntries();
    renderTimeline();
    render();
  }

  addForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = titleInput.value.trim();
    if(!title || !selectedDateKey) return;

    const entry = {
      id: Date.now()+'-'+Math.random().toString(36).slice(2,7),
      title,
      startTime: startTimeInput.value || '',
      endTime: endTimeInput.value || '',
      note: noteInput.value.trim()
    };
    if(!entries[selectedDateKey]) entries[selectedDateKey] = [];
    entries[selectedDateKey].push(entry);
    saveEntries();
    renderEntries();
    renderTimeline();
    render();

    closeAddForm();
  });

  openAddBtn.addEventListener('click', openAddForm);
  document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
  document.getElementById('closeBookBtn').addEventListener('click', closeAddForm);
  document.getElementById('closeTimelineBtn').addEventListener('click', closeTimeline);

  dayViewBackdrop.addEventListener('click', closeAllDayViews);
  bookOverlay.addEventListener('click', (e)=>{ if(e.target===bookOverlay) closeAddForm(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key!=='Escape') return;
    if(bookOverlay.classList.contains('open')) closeAddForm();
    else if(timelineOverlay.classList.contains('open') || drawerOverlay.classList.contains('open')) closeAllDayViews();
  });

  document.getElementById('prevBtn').addEventListener('click', ()=>{ view.setMonth(view.getMonth()-1); render(); });
  document.getElementById('nextBtn').addEventListener('click', ()=>{ view.setMonth(view.getMonth()+1); render(); });
  document.getElementById('todayBtn').addEventListener('click', ()=>{ view = new Date(); view.setDate(1); render(); });

  function openPageJump(){
    pageJump.classList.add('open');
    pageLabel.classList.add('active');
    pageInput.focus();
    pageInput.select();
  }
  function closePageJump(){
    pageJump.classList.remove('open');
    pageLabel.classList.remove('active');
  }
  function goToPage(){
    const n = parseInt(pageInput.value, 10);
    if(Number.isNaN(n)) return;
    const { year, month } = dateForPage(n);
    view = new Date(year, month, 1);
    render();
    closePageJump();
  }

  pageLabel.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(pageJump.classList.contains('open')) closePageJump();
    else openPageJump();
  });
  pageGoBtn.addEventListener('click', goToPage);
  pageInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); goToPage(); } });
  document.addEventListener('click', (e)=>{
    if(pageJump.classList.contains('open') && !pageJump.contains(e.target) && e.target!==pageLabel){
      closePageJump();
    }
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && pageJump.classList.contains('open')) closePageJump(); });

  function closeAuthPanel(){ authPanel.classList.remove('open'); authError.textContent=''; }

  authBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(currentUser){
      window.__ghostAuth.signOut();
    }else{
      authPanel.classList.toggle('open');
      if(authPanel.classList.contains('open')) authEmail.focus();
    }
  });

  async function submitSignIn(){
    authError.textContent = '';
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if(!email || !password) return;
    try{
      await window.__ghostAuth.signIn(email, password);
      authEmail.value=''; authPassword.value='';
      closeAuthPanel();
    }catch(err){
      authError.textContent = 'Sign-in failed. Check your email and password.';
    }
  }
  authSubmitBtn.addEventListener('click', submitSignIn);
  authPassword.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); submitSignIn(); } });
  authEmail.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); submitSignIn(); } });

  document.addEventListener('click', (e)=>{
    if(authPanel.classList.contains('open') && !authPanel.contains(e.target) && e.target!==authBtn){
      closeAuthPanel();
    }
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && authPanel.classList.contains('open')) closeAuthPanel(); });

  window.__ghostAuth.onChange((user)=>{
    currentUser = user;
    authBtn.textContent = user ? 'Sign out' : 'Sign in';
    if(user) closeAuthPanel();
  });

  spawnWisps();
  spawnSteam();
  loadEntries();
})();
