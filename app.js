// تطبيق القلب ❤️ - Web Cloud Real-Time Engine (Ultra-Reliable HTTPS & SSE)

const CLOUD_PREFIX = 'heartapp_v1_live_';

class SoundEffects {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  playSend() {
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
  playReceive() {
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

const sounds = new SoundEffects();

class Store {
  constructor() {
    this.uid = localStorage.getItem('ha_uid') || null;
    this.username = localStorage.getItem('ha_username') || null;
    this.friends = JSON.parse(localStorage.getItem('ha_friends') || '[]');
    this.requests = JSON.parse(localStorage.getItem('ha_requests') || '[]');
    this.stats = JSON.parse(localStorage.getItem('ha_stats') || '{"sent": 0, "received": 0, "total": 0}');
    this.processedMsgIds = new Set(JSON.parse(localStorage.getItem('ha_processed_ids') || '[]'));
    this.selected = new Set();
    this.receivedTimeout = null;
    this.eventSource = null;
    this.pollInterval = null;

    // Cross-tab local bus
    this.bus = new BroadcastChannel('heart_app_local_bus');
    this.bus.onmessage = (e) => this.handleIncomingMessage(e.data);

    this.initCloud();
  }

  save() {
    if (this.uid) localStorage.setItem('ha_uid', this.uid);
    else localStorage.removeItem('ha_uid');

    if (this.username) localStorage.setItem('ha_username', this.username);
    else localStorage.removeItem('ha_username');

    localStorage.setItem('ha_friends', JSON.stringify(this.friends));
    localStorage.setItem('ha_requests', JSON.stringify(this.requests));
    localStorage.setItem('ha_stats', JSON.stringify(this.stats));

    // Keep last 50 processed message IDs
    const idArr = Array.from(this.processedMsgIds).slice(-50);
    localStorage.setItem('ha_processed_ids', JSON.stringify(idArr));
  }

  getTopicForUser(uname) {
    return CLOUD_PREFIX + uname.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  initCloud() {
    if (!this.username) {
      this.setCloudStatus('connecting');
      return;
    }

    this.connectCloudStream();
    this.pollRecentMessages();

    // Auto poll every 15 seconds to ensure background delivery on mobile
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.pollRecentMessages();
    }, 15000);
  }

  connectCloudStream() {
    if (!this.username) return;
    const topic = this.getTopicForUser(this.username);

    if (this.eventSource) {
      this.eventSource.close();
    }

    this.setCloudStatus('connecting');

    try {
      this.eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);

      this.eventSource.onopen = () => {
        this.setCloudStatus('connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const msgObj = JSON.parse(event.data);
          if (msgObj.event === 'message') {
            if (msgObj.id && this.processedMsgIds.has(msgObj.id)) return;
            if (msgObj.id) this.processedMsgIds.add(msgObj.id);

            const payload = JSON.parse(msgObj.message);
            this.handleIncomingMessage(payload);
          }
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };

      this.eventSource.onerror = () => {
        this.setCloudStatus('connecting');
      };
    } catch (e) {
      console.log('EventSource note:', e);
      this.setCloudStatus('connecting');
    }
  }

  async pollRecentMessages() {
    if (!this.username) return;
    const topic = this.getTopicForUser(this.username);

    try {
      // Fetch messages sent in the last 12 hours
      const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=12h`);
      if (!res.ok) return;

      const text = await res.text();
      const lines = text.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msgObj = JSON.parse(line);
          if (msgObj.event === 'message') {
            if (msgObj.id && this.processedMsgIds.has(msgObj.id)) continue;
            if (msgObj.id) this.processedMsgIds.add(msgObj.id);

            const payload = JSON.parse(msgObj.message);
            this.handleIncomingMessage(payload);
          }
        } catch (e) {}
      }
      this.save();
    } catch (e) {
      console.log('Poll error:', e);
    }
  }

  setCloudStatus(status) {
    const dot = document.getElementById('cloudStatusDot');
    if (!dot) return;
    dot.className = `cloud-dot ${status}`;
    if (status === 'connected') dot.title = 'متصل بالسحابة الحية 🟢 (يعمل بين كل الهواتف عبر الإنترنت)';
    else if (status === 'connecting') dot.title = 'جاري الاتصال بالسحابة 🟡';
    else dot.title = 'غير متصل بالسحابة 🔴';
  }

  async publishCloud(targetUsername, payload) {
    const topic = this.getTopicForUser(targetUsername);

    // 1. Send via HTTPS to ntfy.sh (Port 443 - works everywhere)
    try {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Title': payload.type === 'HEART' ? '❤️ نبضة قلب جديدة' : '👋 طلب صداقة جديد',
          'Priority': 'urgent'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error('Publish cloud error:', e);
    }

    // 2. Also send to local broadcast bus (same-device fallback)
    try {
      this.bus.postMessage(payload);
    } catch (e) {}
  }

  start() {
    if (!this.uid) {
      this.uid = 'uid_' + Math.random().toString(36).substring(2, 9);
      this.save();
    }
  }

  claimUsername(raw) {
    const name = raw.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      return { ok: false, message: 'اليوزر لازم 3-20 حرف: إنجليزي أو أرقام أو _' };
    }

    this.username = name;
    this.save();
    this.initCloud();

    return { ok: true };
  }

  async sendRequest(raw) {
    const target = raw.toLowerCase().trim().replace(/^@/, '');
    if (!target) return { ok: false, message: 'اكتب اسم المستخدم' };
    if (target === this.username.toLowerCase()) return { ok: false, message: 'ما تقدر تضيف نفسك 😅' };

    if (this.friends.some(f => f.username.toLowerCase() === target)) {
      return { ok: false, message: `@${target} صديقك أصلاً ❤️` };
    }

    const existingReq = this.requests.find(r => r.username.toLowerCase() === target);
    if (existingReq) {
      await this.acceptRequest(existingReq);
      return { ok: true, message: `صرت صديق @${target} 🎉` };
    }

    // Send Request through Cloud
    await this.publishCloud(target, {
      type: 'FRIEND_REQUEST',
      from: this.username,
      fromUid: this.uid,
      target
    });

    return { ok: true, message: `انرسل الطلب لـ @${target} عبر السحابة ✅` };
  }

  async acceptRequest(req) {
    if (!this.friends.some(f => f.username.toLowerCase() === req.username.toLowerCase())) {
      this.friends.push({ id: req.id || req.username, username: req.username });
      this.friends.sort((a, b) => a.username.localeCompare(b.username));
    }
    this.requests = this.requests.filter(r => r.username.toLowerCase() !== req.username.toLowerCase());
    this.save();

    // Notify other user via Cloud
    await this.publishCloud(req.username, {
      type: 'FRIEND_ACCEPTED',
      from: this.username,
      fromUid: this.uid,
      target: req.username
    });

    renderUI();
  }

  declineRequest(req) {
    this.requests = this.requests.filter(r => r.username.toLowerCase() !== req.username.toLowerCase());
    this.save();
    renderUI();
  }

  toggleFriend(username) {
    if (this.selected.has(username)) this.selected.delete(username);
    else this.selected.add(username);
    renderUI();
  }

  async sendHeart() {
    if (this.friends.length === 0) return;
    sounds.playSend();
    if (navigator.vibrate) navigator.vibrate(60);

    const targets = this.selected.size === 0
      ? this.friends.map(f => f.username)
      : Array.from(this.selected);

    this.stats.sent += targets.length;
    this.stats.total += targets.length;
    this.save();
    updateStatsDisplay();

    for (const targetName of targets) {
      await this.publishCloud(targetName, {
        type: 'HEART',
        from: this.username,
        fromUid: this.uid,
        target: targetName,
        timestamp: Date.now()
      });
    }
  }

  handleIncomingMessage(data) {
    if (!data || !this.username) return;

    if (data.target && data.target.toLowerCase() !== this.username.toLowerCase()) {
      return;
    }
    if (data.from && data.from.toLowerCase() === this.username.toLowerCase()) {
      return;
    }

    if (data.type === 'HEART') {
      this.stats.received += 1;
      this.stats.total += 1;
      this.save();
      updateStatsDisplay();
      this.triggerReceivedHeart(data.from);
    } else if (data.type === 'FRIEND_REQUEST') {
      const alreadyFriend = this.friends.some(f => f.username.toLowerCase() === data.from.toLowerCase());
      const alreadyReq = this.requests.some(r => r.username.toLowerCase() === data.from.toLowerCase());
      if (!alreadyFriend && !alreadyReq) {
        this.requests.push({ id: data.fromUid || data.from, username: data.from });
        this.save();
        renderUI();
        sounds.playReceive();

        // Show friendly alert/toast
        showToast(`وصلك طلب صداقة من @${data.from} 👋`);

        if (Notification.permission === 'granted') {
          new Notification('طلب صداقة جديد 👋', { body: `@${data.from} يريد إضافتك في تطبيق القلب` });
        }
      }
    } else if (data.type === 'FRIEND_ACCEPTED') {
      if (!this.friends.some(f => f.username.toLowerCase() === data.from.toLowerCase())) {
        this.friends.push({ id: data.fromUid || data.from, username: data.from });
        this.friends.sort((a, b) => a.username.localeCompare(b.username));
        this.save();
        renderUI();
        sounds.playReceive();

        showToast(`@${data.from} قبل طلب الصداقة 🎉`);

        if (Notification.permission === 'granted') {
          new Notification('تم قبول الصداقة 🎉', { body: `@${data.from} قبل طلبك وأصبح صديقك الآن!` });
        }
      }
    }
  }

  triggerReceivedHeart(senderName) {
    sounds.playReceive();
    if (navigator.vibrate) navigator.vibrate([100, 60, 160]);

    if (Notification.permission === 'granted') {
      new Notification(`❤️ @${senderName}`, { body: 'أرسل لك نبضة قلب!' });
    }

    const overlay = document.getElementById('receivedOverlay');
    const senderText = document.getElementById('receivedSender');
    if (overlay && senderText) {
      senderText.textContent = `@${senderName} أرسل لك قلب`;
      overlay.classList.remove('hidden');

      if (this.receivedTimeout) clearTimeout(this.receivedTimeout);
      this.receivedTimeout = setTimeout(() => {
        overlay.classList.add('hidden');
      }, 3000);
    }
  }

  signOut() {
    if (this.eventSource) this.eventSource.close();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.uid = null;
    this.username = null;
    this.friends = [];
    this.requests = [];
    this.selected.clear();
    this.save();
    renderUI();
  }

  deleteAccount() {
    if (this.eventSource) this.eventSource.close();
    if (this.pollInterval) clearInterval(this.pollInterval);
    localStorage.clear();
    this.uid = null;
    this.username = null;
    this.friends = [];
    this.requests = [];
    this.stats = { sent: 0, received: 0, total: 0 };
    this.selected.clear();
    renderUI();
  }
}

const store = new Store();

function showToast(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1C1C1E;
      color: #FFF;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 700;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      z-index: 999;
      animation: popIn 0.3s ease;
      white-space: nowrap;
    `;
    document.querySelector('.app-container').appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
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

function updateStatsDisplay() {
  const s = document.getElementById('statSent');
  const r = document.getElementById('statReceived');
  const t = document.getElementById('statTotal');
  if (s) s.textContent = store.stats.sent;
  if (r) r.textContent = store.stats.received;
  if (t) t.textContent = store.stats.total;
}

function renderUI() {
  const screenAuth = document.getElementById('screenAuth');
  const screenUsername = document.getElementById('screenUsername');
  const screenMain = document.getElementById('screenMain');

  if (!store.uid) {
    screenAuth.classList.remove('hidden');
    screenUsername.classList.add('hidden');
    screenMain.classList.add('hidden');
    return;
  }

  if (!store.username) {
    screenAuth.classList.add('hidden');
    screenUsername.classList.remove('hidden');
    screenMain.classList.add('hidden');
    return;
  }

  screenAuth.classList.add('hidden');
  screenUsername.classList.add('hidden');
  screenMain.classList.remove('hidden');

  document.getElementById('headerUsername').textContent = `@${store.username}`;
  updateStatsDisplay();

  // Requests Badge
  const badge = document.getElementById('requestsBadge');
  if (store.requests.length > 0) {
    badge.textContent = store.requests.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Friends Pills Bar
  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '';
  store.friends.forEach(friend => {
    const isSelected = store.selected.has(friend.username);
    const pill = document.createElement('button');
    pill.className = `friend-pill ${isSelected ? 'selected' : ''}`;
    pill.textContent = friend.username;
    pill.onclick = () => store.toggleFriend(friend.username);
    friendsList.appendChild(pill);
  });

  // Footer Hint
  const hintText = document.getElementById('hintFooter');
  if (store.friends.length === 0) {
    hintText.textContent = 'أضف صديق عشان تقدر ترسل له قلب';
  } else if (store.selected.size === 0) {
    hintText.textContent = 'بيروح القلب لكل أصحابك — أو اختر أحد فوق';
  } else {
    hintText.textContent = `بيروح القلب للمحددين فقط (${store.selected.size})`;
  }

  renderFriendsSheet();
}

function renderFriendsSheet() {
  const reqSection = document.getElementById('requestsSection');
  const reqList = document.getElementById('requestsList');
  if (store.requests.length === 0) {
    reqSection.classList.add('hidden');
  } else {
    reqSection.classList.remove('hidden');
    reqList.innerHTML = '';
    store.requests.forEach(req => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span style="font-weight:700">@${req.username}</span>
        <div class="action-buttons">
          <button class="circle-btn accept" title="قبول">✓</button>
          <button class="circle-btn decline" title="رفض">✕</button>
        </div>
      `;
      item.querySelector('.accept').onclick = () => store.acceptRequest(req);
      item.querySelector('.decline').onclick = () => store.declineRequest(req);
      reqList.appendChild(item);
    });
  }

  document.getElementById('myHandleDisplay').textContent = `@${store.username || ''}`;

  const sheetFriendsSection = document.getElementById('sheetFriendsSection');
  const sheetFriendsList = document.getElementById('sheetFriendsList');
  if (store.friends.length === 0) {
    sheetFriendsSection.classList.add('hidden');
  } else {
    sheetFriendsSection.classList.remove('hidden');
    sheetFriendsList.innerHTML = '';
    store.friends.forEach(f => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<span style="font-weight:600">@${f.username}</span><span style="color:#FF2D55">❤️</span>`;
      sheetFriendsList.appendChild(div);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  store.start();
  renderUI();

  document.getElementById('btnStartAuth').onclick = () => {
    store.start();
    renderUI();
  };

  const usernameInput = document.getElementById('usernameInput');
  const btnClaim = document.getElementById('btnClaimUsername');
  const usernameError = document.getElementById('usernameError');

  btnClaim.onclick = () => {
    const val = usernameInput.value;
    const res = store.claimUsername(val);
    if (!res.ok) {
      usernameError.textContent = res.message;
      usernameError.classList.remove('hidden');
    } else {
      usernameError.classList.add('hidden');
      renderUI();
    }
  };

  const heartBtn = document.getElementById('mainHeartBtn');
  heartBtn.onclick = () => {
    if (store.friends.length === 0) {
      openFriendsModal();
      return;
    }
    spawnFloatingHeart();
    store.sendHeart();
  };

  document.getElementById('btnOpenFriends').onclick = openFriendsModal;
  document.getElementById('btnCloseFriends').onclick = closeFriendsModal;
  document.getElementById('friendsModalBackdrop').onclick = (e) => {
    if (e.target.id === 'friendsModalBackdrop') closeFriendsModal();
  };

  const addFriendInput = document.getElementById('addFriendInput');
  const btnSendRequest = document.getElementById('btnSendRequest');
  const addFriendStatus = document.getElementById('addFriendStatus');

  btnSendRequest.onclick = async () => {
    btnSendRequest.disabled = true;
    btnSendRequest.textContent = 'جاري الإرسال...';
    const res = await store.sendRequest(addFriendInput.value);
    btnSendRequest.disabled = false;
    btnSendRequest.textContent = 'إرسال';
    addFriendStatus.textContent = res.message;
    addFriendStatus.className = `status-msg ${res.ok ? 'success' : 'error'}`;
    addFriendStatus.classList.remove('hidden');
    if (res.ok) addFriendInput.value = '';
    renderUI();
  };

  document.getElementById('btnShareHandle').onclick = () => {
    const currentUrl = window.location.href;
    const text = `ضيفني على تطبيق القلب ❤️ يوزري: @${store.username}\nرابط التطبيق: ${currentUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'تطبيق القلب', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('تم نسخ الرابط واليوزر إلى الحافظة! أرسله لصاحبك.');
    }
  };

  document.getElementById('btnSignOut').onclick = () => {
    closeFriendsModal();
    store.signOut();
  };

  document.getElementById('btnDeleteAccount').onclick = () => {
    if (confirm('هل أنت متأكد من حذف الحساب نهائياً ومسح جميع البيانات والقلوب؟ لا يمكن التراجع عن هذا الإجراء.')) {
      closeFriendsModal();
      store.deleteAccount();
    }
  };

  // Re-poll on window focus or visibility change (when user returns to app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      store.pollRecentMessages();
    }
  });

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission();
    }, 2000);
  }
});

function openFriendsModal() {
  document.getElementById('friendsModalBackdrop').classList.add('active');
  store.pollRecentMessages(); // Refresh requests when modal opens
}
function closeFriendsModal() {
  document.getElementById('friendsModalBackdrop').classList.remove('active');
  const status = document.getElementById('addFriendStatus');
  if (status) status.classList.add('hidden');
}

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('hidden');
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnInstallApp') {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        document.getElementById('installBanner').classList.add('hidden');
      });
    }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW note:', err);
    });
  });
}
