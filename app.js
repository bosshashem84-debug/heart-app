// تطبيق القلب ❤️ - Web Cloud Real-Time Engine (PWA)

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
  }
  playReceive() {
    this.init();
    if (!this.ctx) return;
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
    this.selected = new Set();
    this.receivedTimeout = null;
    this.mqttClient = null;
    this.cloudConnected = false;

    // Cross-tab fallback bus
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
  }

  initCloud() {
    if (typeof mqtt === 'undefined') return;

    const clientId = 'ha_' + Math.random().toString(16).substring(2, 10);
    // Public secure MQTT over WebSocket brokers (SSL 8084)
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';

    this.setCloudStatus('connecting');

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000
      });

      this.mqttClient.on('connect', () => {
        this.cloudConnected = true;
        this.setCloudStatus('connected');
        if (this.username) {
          this.subscribeToUserTopic(this.username);
        }
      });

      this.mqttClient.on('reconnect', () => {
        this.setCloudStatus('connecting');
      });

      this.mqttClient.on('offline', () => {
        this.cloudConnected = false;
        this.setCloudStatus('disconnected');
      });

      this.mqttClient.on('error', (err) => {
        console.log('Cloud note:', err);
        this.setCloudStatus('connecting');
      });

      this.mqttClient.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.handleIncomingMessage(data);
        } catch (e) {
          console.error('Invalid payload:', e);
        }
      });
    } catch (e) {
      console.log('MQTT init:', e);
    }
  }

  setCloudStatus(status) {
    const dot = document.getElementById('cloudStatusDot');
    if (!dot) return;
    dot.className = `cloud-dot ${status}`;
    if (status === 'connected') dot.title = 'متصل بالسحابة الحية 🟢 (يعمل بين كل الهواتف)';
    else if (status === 'connecting') dot.title = 'جاري الاتصال بالسحابة 🟡';
    else dot.title = 'غير متصل بالسحابة 🔴';
  }

  subscribeToUserTopic(uname) {
    if (!this.mqttClient || !this.cloudConnected) return;
    const topic = `heartapp_v1/inbox/${uname.toLowerCase()}`;
    this.mqttClient.subscribe(topic, { qos: 1 });
  }

  publishCloud(targetUsername, payload) {
    const topic = `heartapp_v1/inbox/${targetUsername.toLowerCase()}`;
    const jsonStr = JSON.stringify(payload);

    // Send through Cloud MQTT
    if (this.mqttClient && this.cloudConnected) {
      this.mqttClient.publish(topic, jsonStr, { qos: 1 });
    }
    // Also broadcast to local bus (same device fallback)
    this.bus.postMessage(payload);
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

    if (this.cloudConnected) {
      this.subscribeToUserTopic(name);
    }

    return { ok: true };
  }

  sendRequest(raw) {
    const target = raw.toLowerCase().trim().replace(/^@/, '');
    if (!target) return { ok: false, message: 'اكتب اسم المستخدم' };
    if (target === this.username) return { ok: false, message: 'ما تقدر تضيف نفسك 😅' };

    if (this.friends.some(f => f.username.toLowerCase() === target)) {
      return { ok: false, message: `@${target} صديقك أصلاً ❤️` };
    }

    // Check if they already sent a request to me
    const existingReq = this.requests.find(r => r.username.toLowerCase() === target);
    if (existingReq) {
      this.acceptRequest(existingReq);
      return { ok: true, message: `صرت صديق @${target} 🎉` };
    }

    // Send Request through Cloud
    this.publishCloud(target, {
      type: 'FRIEND_REQUEST',
      from: this.username,
      fromUid: this.uid,
      target
    });

    return { ok: true, message: `انرسل الطلب لـ @${target} عبر السحابة ✅` };
  }

  acceptRequest(req) {
    if (!this.friends.some(f => f.username.toLowerCase() === req.username.toLowerCase())) {
      this.friends.push({ id: req.id || req.username, username: req.username });
      this.friends.sort((a, b) => a.username.localeCompare(b.username));
    }
    this.requests = this.requests.filter(r => r.username.toLowerCase() !== req.username.toLowerCase());
    this.save();

    // Notify the other user via Cloud
    this.publishCloud(req.username, {
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

  sendHeart() {
    if (this.friends.length === 0) return;
    sounds.playSend();
    if (navigator.vibrate) navigator.vibrate(60);

    const targets = this.selected.size === 0
      ? this.friends.map(f => f.username)
      : Array.from(this.selected);

    // Increment my sent counter
    this.stats.sent += targets.length;
    this.stats.total += targets.length;
    this.save();
    updateStatsDisplay();

    // Transmit heart to each target via Cloud
    targets.forEach(targetName => {
      this.publishCloud(targetName, {
        type: 'HEART',
        from: this.username,
        fromUid: this.uid,
        target: targetName,
        timestamp: Date.now()
      });
    });
  }

  handleIncomingMessage(data) {
    if (!data || !this.username) return;

    // Filter only messages addressed to me
    if (data.target && data.target.toLowerCase() !== this.username.toLowerCase()) {
      return;
    }
    // Prevent self-loop
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
    this.uid = null;
    this.username = null;
    this.friends = [];
    this.requests = [];
    this.selected.clear();
    this.save();
    renderUI();
  }

  deleteAccount() {
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

  btnSendRequest.onclick = () => {
    const res = store.sendRequest(addFriendInput.value);
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

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission();
    }, 2000);
  }
});

function openFriendsModal() {
  document.getElementById('friendsModalBackdrop').classList.add('active');
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
