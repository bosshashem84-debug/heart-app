// تطبيق القلب ❤️ - النسخة المبسطة المباشرة (Simple & Persistent Cloud)

const CLOUD_PREFIX = 'heartapp_v2_';

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
  friend: localStorage.getItem('ha_friend') || getCookie('ha_friend') || null,
  sent: parseInt(localStorage.getItem('ha_sent') || '0', 10),
  received: parseInt(localStorage.getItem('ha_rcvd') || '0', 10),
  pendingRequestFrom: null,
  processedIds: new Set(JSON.parse(localStorage.getItem('ha_msg_ids') || '[]')),
  eventSource: null,
  pollTimer: null
};

function saveState() {
  if (state.username) {
    localStorage.setItem('ha_uname', state.username);
    setCookie('ha_uname', state.username);
  } else {
    localStorage.removeItem('ha_uname');
    setCookie('ha_uname', '');
  }

  if (state.friend) {
    localStorage.setItem('ha_friend', state.friend);
    setCookie('ha_friend', state.friend);
  } else {
    localStorage.removeItem('ha_friend');
    setCookie('ha_friend', '');
  }

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
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollCloud, 10000);
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
    // Show prominent banner on screen
    state.pendingRequestFrom = data.from;
    showIncomingBanner(data.from);
    sounds.receive();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    if (Notification.permission === 'granted') {
      new Notification('طلب إضافة جديد 👋', { body: `@${data.from} يريد إضافتك في تطبيق القلب` });
    }
  } else if (data.type === 'ADD_ACCEPTED') {
    state.friend = data.from;
    saveState();
    updateUI();
    sounds.receive();
    showFeedback(`@${data.from} قبل طلبك! أصبحتم أصدقاء الآن 🎉`, 'success');

    if (Notification.permission === 'granted') {
      new Notification('تم قبول الصداقة 🎉', { body: `@${data.from} قبل طلبك وأصبح صديقك الآن!` });
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
  state.pendingRequestFrom = null;
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
  document.getElementById('statSent').textContent = state.sent;
  document.getElementById('statReceived').textContent = state.received;

  const friendPill = document.getElementById('friendPill');
  const friendPillName = document.getElementById('friendPillName');
  if (state.friend) {
    friendPillName.textContent = `@${state.friend}`;
    friendPill.classList.remove('hidden');
  } else {
    friendPill.classList.add('hidden');
  }
}

// DOM Setup
window.addEventListener('DOMContentLoaded', () => {
  updateUI();
  if (state.username) initCloud();

  // Save Name (First-Time Only)
  document.getElementById('btnSaveUser').onclick = () => {
    const raw = document.getElementById('regInput').value.trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const err = document.getElementById('regError');

    if (clean.length < 2) {
      err.textContent = 'اكتب اسم إنجليزي أو حروف وأرقام واضحة';
      err.classList.remove('hidden');
      return;
    }

    err.classList.add('hidden');
    state.username = clean;
    saveState();
    updateUI();
    initCloud();
  };

  // Add Friend
  document.getElementById('btnAddFriend').onclick = async () => {
    const input = document.getElementById('inputFriendName');
    const target = input.value.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

    if (!target) {
      showFeedback('اكتب اسم صديقك', 'error');
      return;
    }
    if (target === state.username.toLowerCase()) {
      showFeedback('ما تقدر تضيف نفسك 😅', 'error');
      return;
    }

    // Set as my current friend target
    state.friend = target;
    saveState();
    updateUI();
    input.value = '';

    // Send add notification to them
    await publishCloud(target, {
      type: 'ADD_REQUEST',
      from: state.username,
      target
    });

    showFeedback(`تم إرسال طلب إضافة لـ @${target} بنجاح ✅`, 'success');
  };

  // Accept Incoming Request
  document.getElementById('btnAcceptReq').onclick = async () => {
    if (state.pendingRequestFrom) {
      const fromWho = state.pendingRequestFrom;
      state.friend = fromWho;
      saveState();
      updateUI();
      hideIncomingBanner();

      await publishCloud(fromWho, {
        type: 'ADD_ACCEPTED',
        from: state.username,
        target: fromWho
      });

      showFeedback(`تم قبول @${fromWho}! صرتوا أصدقاء الآن 🎉`, 'success');
    }
  };

  // Decline Incoming Request
  document.getElementById('btnDeclineReq').onclick = () => {
    hideIncomingBanner();
  };

  // Tap Heart Button
  document.getElementById('heartBtn').onclick = async () => {
    if (!state.friend) {
      showFeedback('اكتب اسم صديقك أولاً في الخانة بالأعلى 👆', 'error');
      return;
    }

    sounds.send();
    if (navigator.vibrate) navigator.vibrate(60);
    spawnFloatingHeart();

    state.sent += 1;
    saveState();
    updateUI();

    await publishCloud(state.friend, {
      type: 'HEART',
      from: state.username,
      target: state.friend,
      timestamp: Date.now()
    });
  };

  // Reset / Change Name
  document.getElementById('btnResetAccount').onclick = () => {
    if (confirm('هل تريد تغيير اسمك أو تسجيل الخروج؟')) {
      if (state.eventSource) state.eventSource.close();
      if (state.pollTimer) clearInterval(state.pollTimer);
      state.username = null;
      state.friend = null;
      state.sent = 0;
      state.received = 0;
      saveState();
      updateUI();
    }
  };

  // Re-poll on visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollCloud();
    }
  });

  // Request notifications
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => { Notification.requestPermission(); }, 2000);
  }
});
