// تطبيق القلب ❤️ - Web & PWA Engine

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
    // Ascending cute bell tones
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

// Real-Time Bus & Persistence
class Store {
  constructor() {
    this.uid = localStorage.getItem('ha_uid') || null;
    this.username = localStorage.getItem('ha_username') || null;
    this.friends = JSON.parse(localStorage.getItem('ha_friends') || '[]');
    this.requests = JSON.parse(localStorage.getItem('ha_requests') || '[]');
    this.selected = new Set();
    this.receivedTimeout = null;

    // Cross-tab/window real-time communication
    this.bus = new BroadcastChannel('heart_app_network');
    this.bus.onmessage = (e) => this.handleNetworkEvent(e.data);

    // Global registry of users across tabs in browser demo
    this.syncGlobalUsers();
  }

  save() {
    if (this.uid) localStorage.setItem('ha_uid', this.uid);
    else localStorage.removeItem('ha_uid');

    if (this.username) localStorage.setItem('ha_username', this.username);
    else localStorage.removeItem('ha_username');

    localStorage.setItem('ha_friends', JSON.stringify(this.friends));
    localStorage.setItem('ha_requests', JSON.stringify(this.requests));
  }

  syncGlobalUsers() {
    if (!this.username) return;
    const registry = JSON.parse(localStorage.getItem('ha_all_users') || '{}');
    registry[this.username.toLowerCase()] = {
      uid: this.uid,
      username: this.username
    };
    localStorage.setItem('ha_all_users', JSON.stringify(registry));
  }

  start() {
    if (!this.uid) {
      this.uid = 'user_' + Math.random().toString(36).substring(2, 9);
      this.save();
    }
  }

  claimUsername(raw) {
    const name = raw.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      return { ok: false, message: 'اليوزر لازم 3-20 حرف: إنجليزي أو أرقام أو _' };
    }

    const registry = JSON.parse(localStorage.getItem('ha_all_users') || '{}');
    if (registry[name] && registry[name].uid !== this.uid) {
      return { ok: false, message: 'هذا اليوزر مأخوذ، جرّب غيره' };
    }

    this.username = name;
    this.syncGlobalUsers();
    this.save();
    return { ok: true };
  }

  sendRequest(raw) {
    const targetName = raw.toLowerCase().trim().replace(/^@/, '');
    if (!targetName) return { ok: false, message: 'اكتب اليوزر' };
    if (targetName === this.username) return { ok: false, message: 'ما تقدر تضيف نفسك 😅' };

    const registry = JSON.parse(localStorage.getItem('ha_all_users') || '{}');
    const target = registry[targetName];

    if (!target) {
      return { ok: false, message: 'ما لقينا هالمستخدم (تأكد من كتابة اليوزر بدقة)' };
    }

    // Already friend?
    if (this.friends.some(f => f.id === target.uid)) {
      return { ok: false, message: `@${targetName} صديقك أصلاً ❤️` };
    }

    // Did they already send me a request? Accept immediately!
    const incomingIndex = this.requests.findIndex(r => r.id === target.uid);
    if (incomingIndex !== -1) {
      this.acceptRequest(this.requests[incomingIndex]);
      return { ok: true, message: `صرت صديق @${targetName} 🎉` };
    }

    // Broadcast request to the target user
    this.bus.postMessage({
      type: 'FRIEND_REQUEST',
      fromUid: this.uid,
      fromName: this.username,
      toUid: target.uid
    });

    return { ok: true, message: `انرسل الطلب لـ @${targetName} ✅` };
  }

  acceptRequest(req) {
    // Add to my friends
    if (!this.friends.some(f => f.id === req.id)) {
      this.friends.push({ id: req.id, username: req.username });
      this.friends.sort((a, b) => a.username.localeCompare(b.username));
    }
    // Remove from my requests
    this.requests = this.requests.filter(r => r.id !== req.id);
    this.save();

    // Notify the other user they got accepted
    this.bus.postMessage({
      type: 'FRIEND_ACCEPTED',
      fromUid: this.uid,
      fromName: this.username,
      toUid: req.id
    });

    renderUI();
  }

  declineRequest(req) {
    this.requests = this.requests.filter(r => r.id !== req.id);
    this.save();
    renderUI();
  }

  toggleFriend(fid) {
    if (this.selected.has(fid)) this.selected.delete(fid);
    else this.selected.add(fid);
    renderUI();
  }

  sendHeart() {
    if (this.friends.length === 0) return;
    sounds.playSend();
    if (navigator.vibrate) navigator.vibrate(50);

    const targetIds = this.selected.size === 0
      ? this.friends.map(f => f.id)
      : Array.from(this.selected);

    // Broadcast heart to the network
    targetIds.forEach(targetUid => {
      this.bus.postMessage({
        type: 'HEART',
        fromUid: this.uid,
        fromName: this.username,
        toUid: targetUid
      });
    });
  }

  handleNetworkEvent(event) {
    if (!event || !this.uid) return;

    // Incoming Heart
    if (event.type === 'HEART' && event.toUid === this.uid) {
      this.triggerReceivedHeart(event.fromName);
    }

    // Incoming Friend Request
    if (event.type === 'FRIEND_REQUEST' && event.toUid === this.uid) {
      if (!this.requests.some(r => r.id === event.fromUid) &&
          !this.friends.some(f => f.id === event.fromUid)) {
        this.requests.push({ id: event.fromUid, username: event.fromName });
        this.save();
        renderUI();
        if (Notification.permission === 'granted') {
          new Notification('طلب صداقة 👋', { body: `@${event.fromName} يريد إضافتك` });
        }
      }
    }

    // Accepted Friend Request
    if (event.type === 'FRIEND_ACCEPTED' && event.toUid === this.uid) {
      if (!this.friends.some(f => f.id === event.fromUid)) {
        this.friends.push({ id: event.fromUid, username: event.fromName });
        this.friends.sort((a, b) => a.username.localeCompare(b.username));
        this.save();
        renderUI();
        if (Notification.permission === 'granted') {
          new Notification('تم قبول الصداقة 🎉', { body: `@${event.fromName} أصبح صديقك الآن` });
        }
      }
    }
  }

  triggerReceivedHeart(senderName) {
    sounds.playReceive();
    if (navigator.vibrate) navigator.vibrate([100, 50, 150]);

    if (Notification.permission === 'granted') {
      new Notification(`❤️ @${senderName}`, { body: 'أرسل لك قلب!' });
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
}

const store = new Store();

// Floating hearts particle animation
function spawnFloatingHeart() {
  const container = document.getElementById('floatingContainer');
  if (!container) return;

  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.innerHTML = '❤️';
  const dx = Math.floor(Math.random() * 120) - 60;
  heart.style.setProperty('--dx', `${dx}px`);
  container.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 1300);
}

// UI State Render
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

  // Main Screen
  screenAuth.classList.add('hidden');
  screenUsername.classList.add('hidden');
  screenMain.classList.remove('hidden');

  // Username Header
  document.getElementById('headerUsername').textContent = `@${store.username}`;

  // Badge Requests
  const badge = document.getElementById('requestsBadge');
  if (store.requests.length > 0) {
    badge.textContent = store.requests.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Friends Horizontal Bar
  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '';
  store.friends.forEach(friend => {
    const isSelected = store.selected.has(friend.id);
    const pill = document.createElement('button');
    pill.className = `friend-pill ${isSelected ? 'selected' : ''}`;
    pill.textContent = friend.username;
    pill.onclick = () => store.toggleFriend(friend.id);
    friendsList.appendChild(pill);
  });

  // Dynamic Hint Footer
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
  // Requests list
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

  // My Handle info
  document.getElementById('myHandleDisplay').textContent = `@${store.username || ''}`;

  // Friends list in sheet
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

// Event Listeners Setup
window.addEventListener('DOMContentLoaded', () => {
  store.start();
  renderUI();

  // Auth / Get Started Button
  document.getElementById('btnStartAuth').onclick = () => {
    store.start();
    renderUI();
  };

  // Claim Username Form
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

  // Heart Tap Button
  const heartBtn = document.getElementById('mainHeartBtn');
  heartBtn.onclick = () => {
    if (store.friends.length === 0) {
      openFriendsModal();
      return;
    }
    spawnFloatingHeart();
    store.sendHeart();
  };

  // Friends Modal Toggle
  document.getElementById('btnOpenFriends').onclick = openFriendsModal;
  document.getElementById('btnCloseFriends').onclick = closeFriendsModal;
  document.getElementById('friendsModalBackdrop').onclick = (e) => {
    if (e.target.id === 'friendsModalBackdrop') closeFriendsModal();
  };

  // Send Friend Request
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

  // Share Handle
  document.getElementById('btnShareHandle').onclick = () => {
    const text = `ضيفني على تطبيق القلب ❤️ يوزري: @${store.username}`;
    if (navigator.share) {
      navigator.share({ title: 'تطبيق القلب', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('تم نسخ الرابط واليوزر إلى الحافظة!');
    }
  };

  // Sign out
  document.getElementById('btnSignOut').onclick = () => {
    closeFriendsModal();
    store.signOut();
  };

  // Request Notifications
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

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}
