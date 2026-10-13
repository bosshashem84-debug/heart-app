// تطبيق القلب ❤️ - مع محرك البحث الذكي (Autocomplete) والتحديث الفوري

const CLOUD_PREFIX = 'heartapp_v2_';
const DIRECTORY_TOPIC = 'heartapp_v2_global_directory';

// Audio
class SoundFX {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  send() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }
  receive() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [440, 660, 880].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.3, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch (e) {}
  }
}
const sounds = new SoundFX();

// Cookie helpers for persistent iOS storage
function setCookie(name, val) {
  document.cookie = `${name}=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// App State
const state = {
  username: localStorage.getItem('ha_uname') || getCookie('ha_uname') || null,
  friends: JSON.parse(localStorage.getItem('ha_friends_list') || '[]'),
  requests: JSON.parse(localStorage.getItem('ha_reqs_list') || '[]'),
  knownUsers: new Set(JSON.parse(localStorage.getItem('ha_known_users') || '["mohammed", "mariam", "mahmoud", "majdi", "muna", "ahmed", "sara", "fahad", "khalid"]')),
  sent: parseInt(localStorage.getItem('ha_sent') || '0', 10),
  received: parseInt(localStorage.getItem('ha_rcvd') || '0', 10),
  processedIds: new Set(JSON.parse(localStorage.getItem('ha_msg_ids') || '[]')),
  currentTab: 'heart',
  eventSource: null,
  pollTimer: null
};

// Migrate old single friend if exists
const oldSingleFriend = localStorage.getItem('ha_friend') || getCookie('ha_friend');
if (oldSingleFriend && !state.friends.includes(oldSingleFriend)) {
  state.friends.push(oldSingleFriend);
}

function saveState() {
  if (state.username) {
    localStorage.setItem('ha_uname', state.username);
    setCookie('ha_uname', state.username);
    state.knownUsers.add(state.username);
  } else {
    localStorage.removeItem('ha_uname');
    setCookie('ha_uname', '');
  }

  localStorage.setItem('ha_friends_list', JSON.stringify(state.friends));
  localStorage.setItem('ha_reqs_list', JSON.stringify(state.requests));
  localStorage.setItem('ha_known_users', JSON.stringify(Array.from(state.knownUsers)));
  localStorage.setItem('ha_sent', state.sent);
  localStorage.setItem('ha_rcvd', state.received);

  const ids = Array.from(state.processedIds).slice(-60);
  localStorage.setItem('ha_msg_ids', JSON.stringify(ids));
}

function getTopic(uname) {
  return CLOUD_PREFIX + uname.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
}

// Cloud Connection
function initCloud() {
  if (!state.username) return;

  const topic = getTopic(state.username);
  const dot = document.getElementById('cloudDot');
  if (dot) dot.className = 'cloud-dot connecting';

  if (state.eventSource) state.eventSource.close();

  try {
    state.eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
    state.eventSource.onopen = () => {
      if (dot) dot.className = 'cloud-dot';
    };
    state.eventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'message') {
          if (msg.id && state.processedIds.has(msg.id)) return;
          if (msg.id) state.processedIds.add(msg.id);
          handleCloudMessage(JSON.parse(msg.message));
        }
      } catch (err) {}
    };
    state.eventSource.onerror = () => {
      if (dot) dot.className = 'cloud-dot connecting';
    };
  } catch (err) {}

  pollCloud();
  announceToDirectory();
  pollDirectory();

  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    pollCloud();
    pollDirectory();
  }, 10000);
}

async function pollCloud() {
  if (!state.username) return;
  const topic = getTopic(state.username);
  try {
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=12h`);
    if (!res.ok) return;
    const txt = await res.text();
    const lines = txt.trim().split('\n');
    for (const l of lines) {
      if (!l.trim()) continue;
      try {
        const msg = JSON.parse(l);
        if (msg.event === 'message') {
          if (msg.id && state.processedIds.has(msg.id)) continue;
          if (msg.id) state.processedIds.add(msg.id);
          handleCloudMessage(JSON.parse(msg.message));
        }
      } catch (err) {}
    }
    saveState();
  } catch (err) {}
}

// Directory Autocomplete Engine
async function announceToDirectory() {
  if (!state.username) return;
  try {
    await fetch(`https://ntfy.sh/${DIRECTORY_TOPIC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: state.username })
    });
  } catch (e) {}
}

async function pollDirectory() {
  try {
    const res = await fetch(`https://ntfy.sh/${DIRECTORY_TOPIC}/json?poll=1&since=48h`);
    if (!res.ok) return;
    const txt = await res.text();
    const lines = txt.trim().split('\n');
    for (const l of lines) {
      if (!l.trim()) continue;
      try {
        const msg = JSON.parse(l);
        if (msg.event === 'message') {
          const payload = JSON.parse(msg.message);
          if (payload.user && typeof payload.user === 'string') {
            state.knownUsers.add(payload.user.toLowerCase().trim());
          }
        }
      } catch (e) {}
    }
    saveState();
  } catch (e) {}
}

async function publishCloud(targetUname, payload) {
  const topic = getTopic(targetUname);
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Title': payload.type === 'HEART' ? '❤️ نبضة قلب جديدة' : '👋 طلب إضافة جديد'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {}
}

// Handling Events
function handleCloudMessage(data) {
  if (!data || !state.username) return;
  if (data.from && data.from.toLowerCase() === state.username.toLowerCase()) return;

  if (data.type === 'ADD_REQUEST') {
    const fromWho = data.from.toLowerCase();
    state.knownUsers.add(fromWho);
    if (!state.friends.includes(fromWho) && !state.requests.includes(fromWho)) {
      state.requests.push(fromWho);
      saveState();
      updateUI();
      sounds.receive();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      showIncomingBanner(fromWho);

      if (Notification.permission === 'granted') {
        new Notification('طلب إضافة جديد 👋', { body: `@${fromWho} يريد إضافتك في تطبيق القلب` });
      }
    }
  } else if (data.type === 'ADD_ACCEPTED') {
    const fromWho = data.from.toLowerCase();
    state.knownUsers.add(fromWho);
    if (!state.friends.includes(fromWho)) {
      state.friends.push(fromWho);
      saveState();
      updateUI();
      sounds.receive();
      showFeedback(`@${fromWho} قبل طلبك! أصبحتم أصدقاء الآن 🎉`, 'success');

      if (Notification.permission === 'granted') {
        new Notification('تم قبول الصداقة 🎉', { body: `@${fromWho} قبل طلبك وأصبح صديقك الآن!` });
      }
    }
  } else if (data.type === 'HEART') {
    state.received += 1;
    saveState();
    updateUI();
    triggerHeartOverlay(data.from);
  }
}

// UI Triggers
function showIncomingBanner(fromName) {
  const banner = document.getElementById('incomingBanner');
  const sub = document.getElementById('bannerSub');
  if (banner && sub) {
    sub.textContent = `@${fromName} يريد إضافتك كصديق`;
    banner.classList.remove('hidden');
  }
}

function hideIncomingBanner() {
  const banner = document.getElementById('incomingBanner');
  if (banner) banner.classList.add('hidden');
}

function triggerHeartOverlay(fromName) {
  sounds.receive();
  if (navigator.vibrate) navigator.vibrate([100, 60, 160]);

  const overlay = document.getElementById('receivedOverlay');
  const senderText = document.getElementById('receivedSender');
  if (overlay && senderText) {
    senderText.textContent = `@${fromName} أرسل لك قلب ❤️`;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('hidden'), 3000);
  }

  if (Notification.permission === 'granted') {
    new Notification(`❤️ @${fromName}`, { body: 'أرسل لك نبضة قلب!' });
  }
}

function spawnFloatingHeart() {
  const container = document.getElementById('floatingContainer');
  if (!container) return;
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.innerHTML = '❤️';
  const dx = Math.floor(Math.random() * 140) - 70;
  heart.style.setProperty('--dx', `${dx}px`);
  container.appendChild(heart);
  setTimeout(() => heart.remove(), 1300);
}

function showFeedback(msg, type) {
  const fb = document.getElementById('addFeedback');
  if (fb) {
    fb.textContent = msg;
    fb.className = `add-feedback ${type}`;
    fb.classList.remove('hidden');
    setTimeout(() => fb.classList.add('hidden'), 4000);
  }
}

// Accept / Decline / Remove
async function acceptUser(uname) {
  const target = uname.toLowerCase();
  state.requests = state.requests.filter(r => r !== target);
  if (!state.friends.includes(target)) {
    state.friends.push(target);
  }
  saveState();
  updateUI();
  hideIncomingBanner();

  await publishCloud(target, {
    type: 'ADD_ACCEPTED',
    from: state.username,
    target
  });

  showFeedback(`تم قبول @${target}! صرتوا أصدقاء الآن 🎉`, 'success');
}

function declineUser(uname) {
  const target = uname.toLowerCase();
  state.requests = state.requests.filter(r => r !== target);
  saveState();
  updateUI();
  hideIncomingBanner();
}

function removeFriend(uname) {
  if (confirm(`هل أنت متأكد من إزالة @${uname} من قائمة الأصدقاء؟`)) {
    state.friends = state.friends.filter(f => f !== uname);
    saveState();
    updateUI();
  }
}

async function sendHeartToUser(targetUname) {
  sounds.send();
  if (navigator.vibrate) navigator.vibrate(60);
  spawnFloatingHeart();

  state.sent += 1;
  saveState();
  updateUI();

  await publishCloud(targetUname, {
    type: 'HEART',
    from: state.username,
    target: targetUname,
    timestamp: Date.now()
  });

  switchTab('heart');
}

async function sendFriendRequest(target) {
  const cleanTarget = target.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  if (!cleanTarget) {
    showFeedback('اكتب اسم صديقك', 'error');
    return;
  }
  if (cleanTarget === state.username.toLowerCase()) {
    showFeedback('ما تقدر تضيف نفسك 😅', 'error');
    return;
  }

  if (!state.friends.includes(cleanTarget)) {
    state.friends.push(cleanTarget);
  }
  state.knownUsers.add(cleanTarget);
  saveState();
  updateUI();

  await publishCloud(cleanTarget, {
    type: 'ADD_REQUEST',
    from: state.username,
    target: cleanTarget
  });

  showFeedback(`تم إرسال طلب إضافة لـ @${cleanTarget} بنجاح ✅`, 'success');
}

// Switch Tabs
function switchTab(tab) {
  state.currentTab = tab;
  const tabHeart = document.getElementById('tabHeart');
  const tabFriends = document.getElementById('tabFriends');
  const viewHeart = document.getElementById('viewHeart');
  const viewFriends = document.getElementById('viewFriends');

  if (tab === 'heart') {
    tabHeart.classList.add('active');
    tabFriends.classList.remove('active');
    viewHeart.classList.remove('hidden');
    viewFriends.classList.add('hidden');
  } else {
    tabHeart.classList.remove('active');
    tabFriends.classList.add('active');
    viewHeart.classList.add('hidden');
    viewFriends.classList.remove('hidden');
  }
}

// Main UI Update
function updateUI() {
  const screenReg = document.getElementById('screenRegister');
  const screenMain = document.getElementById('screenMain');

  if (!state.username) {
    screenReg.classList.remove('hidden');
    screenMain.classList.add('hidden');
    return;
  }

  screenReg.classList.add('hidden');
  screenMain.classList.remove('hidden');

  document.getElementById('displayUsername').textContent = `@${state.username}`;
  document.getElementById('shareUnameText').textContent = `@${state.username}`;
  document.getElementById('statSent').textContent = state.sent;
  document.getElementById('statReceived').textContent = state.received;

  // Requests Badge Dot on tab
  const tabBadge = document.getElementById('tabBadge');
  if (state.requests.length > 0) {
    tabBadge.classList.remove('hidden');
  } else {
    tabBadge.classList.add('hidden');
  }

  // Active friend pill on Heart tab
  const friendPill = document.getElementById('friendPill');
  const friendPillName = document.getElementById('friendPillName');
  if (state.friends.length > 0) {
    friendPillName.textContent = `@${state.friends[state.friends.length - 1]}`;
    friendPill.classList.remove('hidden');
  } else {
    friendPill.classList.add('hidden');
  }

  renderFriendsPage();
}

function renderFriendsPage() {
  // 1. Pending Requests Section
  const secReq = document.getElementById('sectionRequests');
  const reqList = document.getElementById('requestsList');
  if (state.requests.length === 0) {
    secReq.classList.add('hidden');
  } else {
    secReq.classList.remove('hidden');
    reqList.innerHTML = '';
    state.requests.forEach(uname => {
      const row = document.createElement('div');
      row.className = 'friend-row';
      row.innerHTML = `
        <span class="friend-name">@${uname}</span>
        <div style="display:flex; gap:8px;">
          <button class="btn-accept" style="padding:6px 14px; font-size:0.85rem;">قبول ✓</button>
          <button class="btn-decline" style="padding:6px 10px; font-size:0.85rem;">✕</button>
        </div>
      `;
      row.querySelector('.btn-accept').onclick = () => acceptUser(uname);
      row.querySelector('.btn-decline').onclick = () => declineUser(uname);
      reqList.appendChild(row);
    });
  }

  // 2. Confirmed Friends Section
  const friendsCountBadge = document.getElementById('friendsCountBadge');
  const friendsList = document.getElementById('friendsList');
  const emptyMsg = document.getElementById('emptyFriendsMsg');

  friendsCountBadge.textContent = state.friends.length;

  if (state.friends.length === 0) {
    emptyMsg.classList.remove('hidden');
    friendsList.innerHTML = '';
  } else {
    emptyMsg.classList.add('hidden');
    friendsList.innerHTML = '';
    state.friends.forEach(uname => {
      const row = document.createElement('div');
      row.className = 'friend-row';
      row.innerHTML = `
        <span class="friend-name">
          <span style="color:#FF2D55">❤️</span>
          <span>@${uname}</span>
        </span>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-send-mini">إرسال قلب ❤️</button>
          <button class="btn-text" style="color:#FF3B30; font-size:0.75rem; padding:4px;">إزالة</button>
        </div>
      `;
      row.querySelector('.btn-send-mini').onclick = () => sendHeartToUser(uname);
      row.querySelector('.btn-text').onclick = () => removeFriend(uname);
      friendsList.appendChild(row);
    });
  }
}

// Setup
window.addEventListener('DOMContentLoaded', () => {
  updateUI();
  if (state.username) initCloud();

  // Tab switching
  document.getElementById('tabHeart').onclick = () => switchTab('heart');
  document.getElementById('tabFriends').onclick = () => {
    switchTab('friends');
    pollCloud();
  };

  // Register First-Time
  document.getElementById('btnSaveUser').onclick = () => {
    const raw = document.getElementById('regInput').value.trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const err = document.getElementById('regError');

    if (clean.length < 2) {
      err.textContent = 'اكتب اسم واضح بالحروف الإنجليزية أو الأرقام';
      err.classList.remove('hidden');
      return;
    }

    err.classList.add('hidden');
    state.username = clean;
    saveState();
    updateUI();
    initCloud();
  };

  // Add Friend Input & Suggestions
  const inputFriend = document.getElementById('inputFriendName');
  const sugBox = document.getElementById('suggestionsBox');

  // Autocomplete typing listener
  inputFriend.addEventListener('input', () => {
    const val = inputFriend.value.trim().toLowerCase().replace(/^@/, '');
    if (!val) {
      sugBox.classList.add('hidden');
      return;
    }

    const matches = Array.from(state.knownUsers)
      .filter(u => u.toLowerCase().startsWith(val) && u.toLowerCase() !== state.username.toLowerCase())
      .slice(0, 6);

    if (matches.length === 0) {
      sugBox.classList.add('hidden');
      return;
    }

    sugBox.innerHTML = '';
    matches.forEach(name => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <span class="suggestion-name">
          <span style="color:#FF2D55">❤️</span>
          <span>@${name}</span>
        </span>
        <button class="btn-suggest-add">إضافة +</button>
      `;
      item.onclick = (e) => {
        e.stopPropagation();
        inputFriend.value = name;
        sugBox.classList.add('hidden');
        sendFriendRequest(name);
      };
      sugBox.appendChild(item);
    });
    sugBox.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!inputFriend.contains(e.target) && !sugBox.contains(e.target)) {
      sugBox.classList.add('hidden');
    }
  });

  document.getElementById('btnAddFriend').onclick = () => {
    const target = inputFriend.value;
    inputFriend.value = '';
    sugBox.classList.add('hidden');
    sendFriendRequest(target);
  };

  // Accept/Decline from top banner
  document.getElementById('btnAcceptReq').onclick = () => {
    if (state.requests.length > 0) {
      acceptUser(state.requests[state.requests.length - 1]);
    } else {
      hideIncomingBanner();
    }
  };
  document.getElementById('btnDeclineReq').onclick = () => {
    if (state.requests.length > 0) {
      declineUser(state.requests[state.requests.length - 1]);
    } else {
      hideIncomingBanner();
    }
  };

  // Big Heart Button
  document.getElementById('heartBtn').onclick = async () => {
    if (state.friends.length === 0) {
      showFeedback('اكتب اسم صديقك أولاً في الخانة بالأعلى 👆', 'error');
      return;
    }

    sounds.send();
    if (navigator.vibrate) navigator.vibrate(60);
    spawnFloatingHeart();

    state.sent += 1;
    saveState();
    updateUI();

    for (const friendName of state.friends) {
      await publishCloud(friendName, {
        type: 'HEART',
        from: state.username,
        target: friendName,
        timestamp: Date.now()
      });
    }
  };

  // Share My Link
  document.getElementById('btnShareMyLink').onclick = () => {
    const url = window.location.href;
    const txt = `ضيفني على تطبيق القلب ❤️ يوزري: @${state.username}\nرابط التطبيق: ${url}`;
    if (navigator.share) {
      navigator.share({ title: 'تطبيق القلب', text: txt }).catch(() => {});
    } else {
      navigator.clipboard.writeText(txt);
      alert('تم نسخ الرابط واليوزر إلى الحافظة! أرسله لأصحابك.');
    }
  };

  // Reset / Change Name
  document.getElementById('btnResetAccount').onclick = () => {
    if (confirm('هل تريد تغيير اسمك أو تسجيل الخروج؟')) {
      if (state.eventSource) state.eventSource.close();
      if (state.pollTimer) clearInterval(state.pollTimer);
      state.username = null;
      state.friends = [];
      state.requests = [];
      state.sent = 0;
      state.received = 0;
      saveState();
      updateUI();
    }
  };

  // Manual Refresh Button Handler
  document.getElementById('btnRefresh').onclick = () => triggerManualRefresh(true);

  // Pull to Refresh Touch Events
  let touchStartY = 0;
  let touchDiffY = 0;
  window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (touchStartY > 0) {
      touchDiffY = e.touches[0].clientY - touchStartY;
      if (touchDiffY > 75 && window.scrollY === 0) {
        const indicator = document.getElementById('pullRefreshIndicator');
        if (indicator) indicator.classList.remove('hidden');
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (touchDiffY > 75 && window.scrollY === 0) {
      triggerManualRefresh(false);
    } else {
      const indicator = document.getElementById('pullRefreshIndicator');
      if (indicator) indicator.classList.add('hidden');
    }
    touchStartY = 0;
    touchDiffY = 0;
  }, { passive: true });

  // Re-poll on visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollCloud();
      pollDirectory();
    }
  });

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => { Notification.requestPermission(); }, 2000);
  }
});

// Manual Refresh Engine
async function triggerManualRefresh(forceHardReload = false) {
  const btn = document.getElementById('btnRefresh');
  const indicator = document.getElementById('pullRefreshIndicator');
  if (btn) btn.classList.add('spinning');
  if (indicator) indicator.classList.remove('hidden');

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let r of registrations) {
        await r.update();
      }
    } catch (e) {}
  }

  await pollCloud();
  await pollDirectory();
  updateUI();

  setTimeout(() => {
    if (btn) btn.classList.remove('spinning');
    if (indicator) indicator.classList.add('hidden');
    showFeedback('تم تحديث البيانات بنجاح 🔄', 'success');
  }, 500);

  // Force bypass cache if requested
  if (forceHardReload && window.location.search.indexOf('v=') === -1) {
    setTimeout(() => {
      window.location.href = window.location.pathname + '?v=' + Date.now();
    }, 600);
  }
}
