// منوشة 💜 - تطبيق النبضات البنفسجية والبوسات الفورية
// الإصدار 8 - مع ميزة الضغط المطول (3 ثواني)، صوت البوسة، الإشعارات الفورية، وسجل البوسات

const CLOUD_PREFIX = 'manousha_app_';
const DIRECTORY_TOPIC = 'manousha_app_global_directory';

// ==========================================
// 1. Audio Engine & Kiss Sound Synthesis
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Sweet outgoing purple heart chime
  heartSent() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  // Incoming pleasant chord
  heartReceived() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.35, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.28);
      });
    } catch (e) {}
  }

  // Realistic Synthetic Kiss ("Muah! / Smack") Sound
  kiss() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;

      // 1. Lip suction & pop (pitch drop + rise)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(1700, now + 0.035);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.11);

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.9, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);

      // 2. High frequency lip-parting smack noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.Q.setValueAtTime(2.2, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.85, now + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.08);

      // 3. Trailing sweet "muah" tone
      const muah = this.ctx.createOscillator();
      const muahGain = this.ctx.createGain();
      muah.type = 'triangle';
      muah.frequency.setValueAtTime(620, now + 0.04);
      muah.frequency.exponentialRampToValueAtTime(510, now + 0.22);

      muahGain.gain.setValueAtTime(0, now);
      muahGain.gain.setValueAtTime(0.4, now + 0.04);
      muahGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

      muah.connect(muahGain);
      muahGain.connect(this.ctx.destination);
      muah.start(now + 0.04);
      muah.stop(now + 0.24);
    } catch (e) {
      console.error('Audio kiss error:', e);
    }
  }
}
const sounds = new SoundEngine();

// Play audio element from Data URL or Blob
function playVoiceAudioData(base64Audio) {
  try {
    const audio = new Audio(base64Audio);
    audio.play().catch(() => {});
  } catch (e) {}
}

// Cookie helpers for persistent iOS storage
function setCookie(name, val) {
  document.cookie = `${name}=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// ==========================================
// 2. App State
// ==========================================
const state = {
  username: localStorage.getItem('ha_uname') || getCookie('ha_uname') || null,
  friends: JSON.parse(localStorage.getItem('ha_friends_list') || '[]'),
  requests: JSON.parse(localStorage.getItem('ha_reqs_list') || '[]'),
  kisses: JSON.parse(localStorage.getItem('ha_kisses_list') || '[]'),
  knownUsers: new Set(JSON.parse(localStorage.getItem('ha_known_users') || '["manousha", "mariam", "mohammed", "mahmoud", "majdi", "muna", "ahmed", "sara", "fahad", "khalid"]')),
  sent: parseInt(localStorage.getItem('ha_sent') || '0', 10),
  received: parseInt(localStorage.getItem('ha_rcvd') || '0', 10),
  processedIds: new Set(JSON.parse(localStorage.getItem('ha_msg_ids') || '[]')),
  currentTab: 'heart',
  eventSource: null,
  pollTimer: null,
  recordedVoiceData: null
};

// Migrate single friend if stored in old format
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
  localStorage.setItem('ha_kisses_list', JSON.stringify(state.kisses.slice(-50)));
  localStorage.setItem('ha_known_users', JSON.stringify(Array.from(state.knownUsers)));
  localStorage.setItem('ha_sent', state.sent);
  localStorage.setItem('ha_rcvd', state.received);

  const ids = Array.from(state.processedIds).slice(-60);
  localStorage.setItem('ha_msg_ids', JSON.stringify(ids));
}

function getTopic(uname) {
  return `${CLOUD_PREFIX}${uname.toLowerCase().trim()}`;
}

// Active target friend
function getActiveFriend() {
  return state.friends.length > 0 ? state.friends[0] : null;
}

// ==========================================
// 3. Real-Time Cloud Engine (ntfy.sh)
// ==========================================
function startListening() {
  if (!state.username) return;
  const topic = getTopic(state.username);

  if (state.eventSource) {
    try { state.eventSource.close(); } catch (e) {}
  }

  console.log('Subscribing to topic:', topic);
  const sseUrl = `https://ntfy.sh/${topic}/sse`;
  state.eventSource = new EventSource(sseUrl);

  state.eventSource.onopen = () => {
    updateCloudStatus(true);
  };

  state.eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'message') {
        if (msg.id && state.processedIds.has(msg.id)) return;
        if (msg.id) state.processedIds.add(msg.id);
        handleRawIncoming(msg.message);
      }
    } catch (e) {}
  };

  state.eventSource.onerror = () => {
    updateCloudStatus(false);
  };

  // Immediate poll for missed messages
  pollMissedMessages();

  // Periodic poll fallback every 7 seconds
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollMissedMessages, 7000);

  // Announce user to global directory for autocomplete
  announceToDirectory();
}

async function pollMissedMessages() {
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
          handleRawIncoming(msg.message);
        }
      } catch (err) {}
    }
    saveState();
  } catch (err) {}
}

// Parse combined message formatted as: cleanText\n###{...json...}###
function handleRawIncoming(rawText) {
  if (!rawText) return;
  let parsedPayload = null;
  if (rawText.includes('###')) {
    const parts = rawText.split('###');
    if (parts.length >= 2) {
      try {
        parsedPayload = JSON.parse(parts[1]);
      } catch (e) {}
    }
  }
  if (!parsedPayload) {
    try {
      parsedPayload = JSON.parse(rawText);
    } catch (e) {}
  }

  if (parsedPayload) {
    handleCloudMessage(parsedPayload);
  }
}

// Autocomplete Engine
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

// Publish message with high priority push (priority: 5 wakes locked phones)
async function publishCloud(targetUname, payload, notifTitle, notifText, tag) {
  const topic = getTopic(targetUname);
  const cleanTitle = notifTitle || 'منوشة 💜';
  const cleanText = notifText || `@${state.username} أرسل لك نبضة بنفسجية 💜`;
  const combinedMessage = `${cleanText}\n###${JSON.stringify(payload)}###`;

  try {
    await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic,
        title: cleanTitle,
        message: combinedMessage,
        priority: 5, // Wakes locked screen, rings, vibrates!
        tags: [tag || 'purple_heart'],
        click: window.location.href
      })
    });
  } catch (err) {
    console.error('Publish cloud error:', err);
  }
}

// Trigger OS background notification via Service Worker or Web Notification
function triggerNotification(title, body, tag) {
  if (Notification.permission !== 'granted') return;

  // Try Service Worker registration first (works best when screen is locked)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title || 'منوشة 💜',
      body: body || 'نبضة قلب جديدة 💜',
      tag: tag || 'manousha-alert'
    });
  } else {
    try {
      new Notification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png'
      });
    } catch (e) {}
  }
}

// ==========================================
// 4. Inbound Event Handlers
// ==========================================
function handleCloudMessage(data) {
  if (!data || !state.username) return;
  if (data.from && data.from.toLowerCase() === state.username.toLowerCase()) return;

  if (data.type === 'ADD_REQUEST') {
    const fromWho = data.from.toLowerCase();
    state.knownUsers.add(fromWho);
    if (!state.requests.includes(fromWho)) {
      state.requests.push(fromWho);
    }
    saveState();
    updateUI();
    sounds.heartReceived();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    showIncomingBanner(fromWho);
    triggerNotification('طلب إضافة جديد 👋', `@${fromWho} يريد إضافتك في منوشة 💜`, 'manousha-req');
  } else if (data.type === 'ADD_ACCEPTED') {
    const fromWho = data.from.toLowerCase();
    state.knownUsers.add(fromWho);
    if (!state.friends.includes(fromWho)) {
      state.friends.push(fromWho);
      saveState();
      updateUI();
      sounds.heartReceived();
      showFeedback(`@${fromWho} قبل طلبك! أصبحتم أصدقاء الآن 🎉`, 'success');
      triggerNotification('تم قبول الصداقة 🎉', `@${fromWho} قبل طلبك في منوشة 💜!`, 'manousha-accept');
    }
  } else if (data.type === 'HEART') {
    state.received += 1;
    saveState();
    updateUI();
    sounds.heartReceived();
    if (navigator.vibrate) navigator.vibrate([150, 100, 150]);

    showReceivedOverlay(data.from);
    spawnFloatingHeart();
    triggerNotification('نبضة بنفسجية 💜', `@${data.from} أرسل لك نبضة قلب بنفسجية!`, 'manousha-heart');
  } else if (data.type === 'KISS') {
    // Recipient received a giant kiss!
    state.received += 1;
    const kissItem = {
      id: Date.now() + Math.random().toString(),
      from: data.from,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      audioData: data.audioData || null
    };
    state.kisses.unshift(kissItem);
    saveState();
    updateUI();

    // Play Kiss Sound
    sounds.kiss();
    if (data.audioData) {
      setTimeout(() => playVoiceAudioData(data.audioData), 400);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);

    // Show Fullscreen Giant Kiss Celebration
    showGiantKissOverlay(data.from);
    triggerNotification('بوسة عملاقة 💋', `@${data.from} أرسل لك بوسة عملاقة 💋💜!`, 'manousha-kiss');
  }
}

// Show incoming friend request banner
function showIncomingBanner(fromWho) {
  const banner = document.getElementById('incomingBanner');
  const bannerSub = document.getElementById('bannerSub');
  if (!banner || !bannerSub) return;
  bannerSub.textContent = `@${fromWho} يريد إضافتك في منوشة`;
  banner.classList.remove('hidden');
}

// Show normal received overlay
function showReceivedOverlay(fromWho) {
  const overlay = document.getElementById('receivedOverlay');
  const text = document.getElementById('receivedSender');
  if (!overlay || !text) return;
  text.textContent = `@${fromWho} أرسل لك نبضة بنفسجية 💜`;
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 2200);
}

// Show Giant Kiss Fullscreen Overlay
function showGiantKissOverlay(fromWho) {
  const overlay = document.getElementById('giantKissOverlay');
  const sub = document.getElementById('giantKissSub');
  if (!overlay) return;
  if (sub) sub.textContent = `من @${fromWho} لك 💜`;
  overlay.classList.remove('hidden');

  // Spawn shower of kiss emojis
  for (let i = 0; i < 16; i++) {
    setTimeout(spawnFloatingKiss, i * 80);
  }

  // Auto-dismiss after 4.5 seconds
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 4500);
}

// Spawn floating purple heart
function spawnFloatingHeart() {
  const container = document.getElementById('floatingContainer');
  if (!container) return;
  const h = document.createElement('div');
  h.className = 'floating-heart';
  h.textContent = '💜';
  const dx = (Math.random() - 0.5) * 160;
  h.style.setProperty('--dx', `${dx}px`);
  container.appendChild(h);
  setTimeout(() => h.remove(), 1400);
}

// Spawn floating kiss emoji
function spawnFloatingKiss() {
  const container = document.getElementById('floatingContainer');
  if (!container) return;
  const k = document.createElement('div');
  k.className = 'floating-heart';
  k.textContent = Math.random() > 0.4 ? '💋' : '💜';
  const dx = (Math.random() - 0.5) * 220;
  k.style.setProperty('--dx', `${dx}px`);
  container.appendChild(k);
  setTimeout(() => k.remove(), 1400);
}

// ==========================================
// 5. Sending Actions
// ==========================================
async function sendHeart() {
  const target = getActiveFriend();
  if (!target) {
    showFeedback('أضف صديقك أولاً لتتمكن من إرسال نبضات له 👥', 'error');
    return;
  }
  state.sent += 1;
  saveState();
  updateUI();
  sounds.heartSent();
  if (navigator.vibrate) navigator.vibrate(50);
  spawnFloatingHeart();

  await publishCloud(
    target,
    { type: 'HEART', from: state.username },
    'منوشة 💜',
    `@${state.username} أرسل لك نبضة بنفسجية 💜`,
    'purple_heart'
  );
}

async function sendGiantKiss() {
  const target = getActiveFriend();
  if (!target) {
    showFeedback('أضف صديقك أولاً لإرسال البوسة 👥', 'error');
    return;
  }

  state.sent += 1;
  saveState();
  updateUI();

  // Play kiss sound
  sounds.kiss();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);

  // Show local celebration
  showGiantKissOverlay('أنت');
  showFeedback(`أرسلت بوسة عملاقة لـ @${target} 💋!`, 'success');

  await publishCloud(
    target,
    { type: 'KISS', from: state.username },
    'منوشة 💜',
    `@${state.username} أرسل لك بوسة عملاقة 💋`,
    'kiss'
  );
}

async function sendVoiceKiss(base64Audio) {
  const target = getActiveFriend();
  if (!target) {
    showFeedback('أضف صديقك أولاً لإرسال البوسة 👥', 'error');
    return;
  }

  state.sent += 1;
  saveState();
  updateUI();

  sounds.kiss();
  showFeedback(`تم إرسال البوسة بصوتك لـ @${target} 🚀!`, 'success');

  await publishCloud(
    target,
    { type: 'KISS', from: state.username, audioData: base64Audio },
    'منوشة 💜',
    `@${state.username} أرسل لك بوسة بصوته الحقيقي 💋🎙️`,
    'kiss'
  );
}

// ==========================================
// 6. 3-Second Long Press Controller
// ==========================================
let holdStartTime = 0;
let holdAnimFrame = null;
let isLongPressTriggered = false;
const HOLD_DURATION = 3000; // 3 seconds
const CIRCLE_CIRCUMFERENCE = 741.4; // 2 * PI * 118

function setupHeartLongPress() {
  const heartBtn = document.getElementById('heartBtn');
  const circle = document.getElementById('chargeProgressCircle');
  const promptText = document.getElementById('heartPromptText');
  if (!heartBtn || !circle) return;

  function onHoldStart(e) {
    if (e.type === 'touchstart' && e.touches.length > 1) return;
    sounds.init();
    holdStartTime = Date.now();
    isLongPressTriggered = false;
    heartBtn.classList.add('charging');
    if (promptText) {
      promptText.classList.add('charging-prompt');
      promptText.textContent = 'جاري شحن البوسة... 💋 (3ث)';
    }

    function animateProgress() {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min(elapsed / HOLD_DURATION, 1.0);
      const remainingSeconds = Math.ceil((HOLD_DURATION - elapsed) / 1000);

      // Update ring offset
      circle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

      // Smooth scale heart from 1 to 1.35
      const currentScale = 1 + progress * 0.35;
      heartBtn.style.transform = `scale(${currentScale})`;

      if (promptText && remainingSeconds > 0) {
        promptText.textContent = `جاري شحن البوسة... 💋 (${remainingSeconds}ث)`;
      }

      if (progress >= 1.0) {
        // Full 3 seconds completed!
        isLongPressTriggered = true;
        resetHold();
        sendGiantKiss();
        return;
      }

      holdAnimFrame = requestAnimationFrame(animateProgress);
    }

    holdAnimFrame = requestAnimationFrame(animateProgress);
  }

  function onHoldEnd() {
    if (isLongPressTriggered) return;
    const elapsed = Date.now() - holdStartTime;
    resetHold();

    // If released quickly (normal tap), fire standard heart
    if (elapsed < 500 && elapsed > 20) {
      sendHeart();
    }
  }

  function resetHold() {
    if (holdAnimFrame) cancelAnimationFrame(holdAnimFrame);
    heartBtn.classList.remove('charging');
    heartBtn.style.transform = 'scale(1)';
    circle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
    if (promptText) {
      promptText.classList.remove('charging-prompt');
      promptText.textContent = 'اضغط لنبضة بنفسجية 💜 • علّق 3 ثواني لبوسة عملاقة 💋';
    }
  }

  // Touch Events
  heartBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onHoldStart(e);
  }, { passive: false });

  heartBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    onHoldEnd();
  }, { passive: false });

  heartBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    resetHold();
  }, { passive: false });

  // Mouse Events (Desktop testing)
  heartBtn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    onHoldStart(e);
  });
  heartBtn.addEventListener('mouseup', onHoldEnd);
  heartBtn.addEventListener('mouseleave', resetHold);
  heartBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ==========================================
// 7. Voice Kiss Recorder Engine
// ==========================================
let mediaRecorder = null;
let audioChunks = [];
let voiceTimerInterval = null;

function setupVoiceRecorder() {
  const btnStartRecord = document.getElementById('btnStartRecord');
  const btnPlayMyVoice = document.getElementById('btnPlayMyVoice');
  const btnSendVoiceKiss = document.getElementById('btnSendVoiceKiss');
  const recordStatusText = document.getElementById('recordStatusText');
  const voiceSendSection = document.getElementById('voiceSendSection');
  if (!btnStartRecord) return;

  btnStartRecord.addEventListener('click', async () => {
    sounds.init();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          state.recordedVoiceData = reader.result;
          if (recordStatusText) recordStatusText.textContent = 'تم تسجيل البوسة بنجاح! 💋';
          if (btnPlayMyVoice) btnPlayMyVoice.classList.remove('hidden');
          if (voiceSendSection) voiceSendSection.classList.remove('hidden');
          btnStartRecord.classList.remove('recording');
          btnStartRecord.querySelector('span:last-child').textContent = 'إعادة التسجيل';
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        if (voiceTimerInterval) clearInterval(voiceTimerInterval);
      };

      mediaRecorder.start();
      btnStartRecord.classList.add('recording');
      btnStartRecord.querySelector('span:last-child').textContent = 'إيقاف ⏹';

      let secondsLeft = 3;
      if (recordStatusText) recordStatusText.textContent = `جاري التسجيل... 🔴 (${secondsLeft}ث)`;
      voiceTimerInterval = setInterval(() => {
        secondsLeft -= 1;
        if (recordStatusText) recordStatusText.textContent = `جاري التسجيل... 🔴 (${secondsLeft}ث)`;
        if (secondsLeft <= 0) {
          clearInterval(voiceTimerInterval);
          if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        }
      }, 1000);

    } catch (err) {
      if (recordStatusText) recordStatusText.textContent = 'يرجى السماح بصلاحية المايكروفون للتسجيل 🎙️';
    }
  });

  if (btnPlayMyVoice) {
    btnPlayMyVoice.addEventListener('click', () => {
      if (state.recordedVoiceData) playVoiceAudioData(state.recordedVoiceData);
    });
  }

  if (btnSendVoiceKiss) {
    btnSendVoiceKiss.addEventListener('click', () => {
      if (state.recordedVoiceData) {
        sendVoiceKiss(state.recordedVoiceData);
      }
    });
  }
}

// ==========================================
// 8. Friends Management & Autocomplete
// ==========================================
async function sendFriendRequest(targetUname) {
  const cleanTarget = targetUname.toLowerCase().trim();
  if (!cleanTarget) return;

  if (cleanTarget === state.username.toLowerCase()) {
    showFeedback('لا يمكنك إضافة نفسك!', 'error');
    return;
  }

  if (state.friends.includes(cleanTarget)) {
    showFeedback(`@${cleanTarget} مضاف في قائمة أصدقائك بالفعل!`, 'error');
    return;
  }

  state.knownUsers.add(cleanTarget);
  saveState();

  showFeedback(`تم إرسال طلب الإضافة إلى @${cleanTarget} 🎉`, 'success');
  hideSuggestions();

  await publishCloud(
    cleanTarget,
    { type: 'ADD_REQUEST', from: state.username },
    'طلب إضافة جديد 👋',
    `@${state.username} يريد إضافتك في تطبيق منوشة 💜`,
    'wave'
  );
}

async function acceptFriendRequest(fromWho) {
  const clean = fromWho.toLowerCase().trim();
  state.requests = state.requests.filter((r) => r !== clean);
  if (!state.friends.includes(clean)) {
    state.friends.push(clean);
  }
  saveState();
  updateUI();

  const banner = document.getElementById('incomingBanner');
  if (banner) banner.classList.add('hidden');

  showFeedback(`أصبح @${clean} صديقك الآن 🎉`, 'success');

  await publishCloud(
    clean,
    { type: 'ADD_ACCEPTED', from: state.username },
    'تم قبول الصداقة 🎉',
    `@${state.username} قبل طلبك وأصبح صديقك في منوشة 💜!`,
    'sparkles'
  );
}

function declineFriendRequest(fromWho) {
  const clean = fromWho.toLowerCase().trim();
  state.requests = state.requests.filter((r) => r !== clean);
  saveState();
  updateUI();
  const banner = document.getElementById('incomingBanner');
  if (banner) banner.classList.add('hidden');
}

function removeFriend(friendName) {
  state.friends = state.friends.filter((f) => f !== friendName);
  saveState();
  updateUI();
  showFeedback(`تم حذف @${friendName}`, 'success');
}

// Autocomplete filter
function updateSuggestions(query) {
  const box = document.getElementById('suggestionsBox');
  if (!box) return;
  const q = query.toLowerCase().trim();
  if (!q) {
    hideSuggestions();
    return;
  }

  const matches = Array.from(state.knownUsers)
    .filter((u) => u && u.length >= 2 && u !== state.username.toLowerCase() && !state.friends.includes(u) && u.includes(q))
    .slice(0, 5);

  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  box.innerHTML = '';
  matches.forEach((user) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <span class="suggestion-name">💜 @${user}</span>
      <button class="btn-suggest-add">إضافة +</button>
    `;
    item.addEventListener('click', () => {
      const input = document.getElementById('inputFriendName');
      if (input) input.value = user;
      sendFriendRequest(user);
    });
    box.appendChild(item);
  });
  box.classList.remove('hidden');
}

function hideSuggestions() {
  const box = document.getElementById('suggestionsBox');
  if (box) box.classList.add('hidden');
}

function showFeedback(msg, type) {
  const el = document.getElementById('addFeedback');
  if (!el) return;
  el.textContent = msg;
  el.className = `add-feedback ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function updateCloudStatus(connected) {
  const dot = document.getElementById('cloudDot');
  if (!dot) return;
  dot.style.background = connected ? '#10B981' : '#F59E0B';
  dot.style.boxShadow = connected ? '0 0 10px #10B981' : '0 0 10px #F59E0B';
}

// ==========================================
// 9. UI Rendering & Tab Switching
// ==========================================
function updateUI() {
  if (!state.username) {
    document.getElementById('screenRegister')?.classList.remove('hidden');
    document.getElementById('screenMain')?.classList.add('hidden');
    return;
  }

  document.getElementById('screenRegister')?.classList.add('hidden');
  document.getElementById('screenMain')?.classList.remove('hidden');

  // Username badge
  const dispName = document.getElementById('displayUsername');
  if (dispName) dispName.textContent = `@${state.username}`;

  const shareUname = document.getElementById('shareUnameText');
  if (shareUname) shareUname.textContent = `@${state.username}`;

  // Counters
  const statSent = document.getElementById('statSent');
  const statReceived = document.getElementById('statReceived');
  const statKisses = document.getElementById('statKisses');
  if (statSent) statSent.textContent = state.sent;
  if (statReceived) statReceived.textContent = state.received;
  if (statKisses) statKisses.textContent = state.kisses.length;

  // Active Friend Pill
  const pill = document.getElementById('friendPill');
  const pillName = document.getElementById('friendPillName');
  const activeFriend = getActiveFriend();
  if (activeFriend) {
    if (pill) pill.classList.remove('hidden');
    if (pillName) pillName.textContent = `@${activeFriend}`;
  } else {
    if (pill) pill.classList.add('hidden');
  }

  // Request Badge
  const tabBadge = document.getElementById('tabBadge');
  if (tabBadge) {
    tabBadge.classList.toggle('hidden', state.requests.length === 0);
  }

  // Render Friends List
  renderFriendsList();

  // Render Requests List
  renderRequestsList();

  // Render Kisses Inbox
  renderKissesInbox();
}

function renderFriendsList() {
  const container = document.getElementById('friendsList');
  const emptyMsg = document.getElementById('emptyFriendsMsg');
  const countBadge = document.getElementById('friendsCountBadge');
  if (!container) return;

  if (countBadge) countBadge.textContent = state.friends.length;

  if (state.friends.length === 0) {
    container.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');
  container.innerHTML = '';

  state.friends.forEach((friend) => {
    const card = document.createElement('div');
    card.className = 'friend-item-card';
    card.innerHTML = `
      <span class="friend-item-name">💜 @${friend}</span>
      <div class="friend-item-actions">
        <button class="btn-quick-heart" title="أرسل قلب">❤️ قلب</button>
        <button class="btn-quick-kiss" title="أرسل بوسة">💋 بوسة</button>
        <button class="btn-del-friend" title="حذف الصديق">✕</button>
      </div>
    `;

    card.querySelector('.btn-quick-heart').addEventListener('click', () => {
      sounds.heartSent();
      spawnFloatingHeart();
      publishCloud(friend, { type: 'HEART', from: state.username }, 'منوشة 💜', `@${state.username} أرسل لك نبضة بنفسجية 💜`, 'purple_heart');
      showFeedback(`أرسلت قلباً لـ @${friend} 💜`, 'success');
    });

    card.querySelector('.btn-quick-kiss').addEventListener('click', () => {
      sounds.kiss();
      showGiantKissOverlay('أنت');
      publishCloud(friend, { type: 'KISS', from: state.username }, 'منوشة 💜', `@${state.username} أرسل لك بوسة عملاقة 💋`, 'kiss');
      showFeedback(`أرسلت بوسة لـ @${friend} 💋`, 'success');
    });

    card.querySelector('.btn-del-friend').addEventListener('click', () => {
      removeFriend(friend);
    });

    container.appendChild(card);
  });
}

function renderRequestsList() {
  const section = document.getElementById('sectionRequests');
  const list = document.getElementById('requestsList');
  if (!section || !list) return;

  if (state.requests.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = '';

  state.requests.forEach((reqUser) => {
    const row = document.createElement('div');
    row.className = 'friend-item-card';
    row.innerHTML = `
      <span class="friend-item-name">👋 @${reqUser}</span>
      <div class="friend-item-actions">
        <button class="btn-accept">قبول ✓</button>
        <button class="btn-decline">✕</button>
      </div>
    `;

    row.querySelector('.btn-accept').addEventListener('click', () => acceptFriendRequest(reqUser));
    row.querySelector('.btn-decline').addEventListener('click', () => declineFriendRequest(reqUser));
    list.appendChild(row);
  });
}

function renderKissesInbox() {
  const list = document.getElementById('kissesInboxList');
  const emptyMsg = document.getElementById('emptyKissesMsg');
  const badge = document.getElementById('kissesCountBadge');
  if (!list) return;

  if (badge) badge.textContent = state.kisses.length;

  if (state.kisses.length === 0) {
    list.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');
  list.innerHTML = '';

  state.kisses.forEach((k) => {
    const item = document.createElement('div');
    item.className = 'kiss-item-card';
    item.innerHTML = `
      <div class="kiss-item-info">
        <span class="kiss-item-avatar">💋</span>
        <div class="kiss-item-meta">
          <span class="kiss-item-from">بوسة من @${k.from}</span>
          <span class="kiss-item-time">${k.time || 'الآن'}</span>
        </div>
      </div>
      <button class="btn-play-kiss-item">🔊 استماع</button>
    `;

    item.querySelector('.btn-play-kiss-item').addEventListener('click', () => {
      sounds.kiss();
      if (k.audioData) {
        setTimeout(() => playVoiceAudioData(k.audioData), 400);
      }
    });

    list.appendChild(item);
  });
}

// Switch between tabs
function switchTab(tabName) {
  state.currentTab = tabName;
  const btnHeart = document.getElementById('tabHeart');
  const btnFriends = document.getElementById('tabFriends');
  const btnKisses = document.getElementById('tabKisses');
  const viewHeart = document.getElementById('viewHeart');
  const viewFriends = document.getElementById('viewFriends');
  const viewKisses = document.getElementById('viewKisses');

  [btnHeart, btnFriends, btnKisses].forEach((b) => b?.classList.remove('active'));
  [viewHeart, viewFriends, viewKisses].forEach((v) => v?.classList.add('hidden'));

  if (tabName === 'heart') {
    btnHeart?.classList.add('active');
    viewHeart?.classList.remove('hidden');
  } else if (tabName === 'friends') {
    btnFriends?.classList.add('active');
    viewFriends?.classList.remove('hidden');
  } else if (tabName === 'kisses') {
    btnKisses?.classList.add('active');
    viewKisses?.classList.remove('hidden');
  }
}

// ==========================================
// 10. Initialization & Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=8').then((reg) => {
      console.log('SW registered:', reg.scope);
    }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  }

  // Registration Button
  document.getElementById('btnSaveUser')?.addEventListener('click', () => {
    const input = document.getElementById('regInput');
    const err = document.getElementById('regError');
    const val = input ? input.value.trim().toLowerCase() : '';

    if (!val || val.length < 2) {
      if (err) {
        err.textContent = 'يرجى كتابة اسم مكون من حرفين على الأقل';
        err.classList.remove('hidden');
      }
      return;
    }

    state.username = val;
    saveState();
    updateUI();
    startListening();
    sounds.init();
  });

  // Top Header Actions
  document.getElementById('btnResetAccount')?.addEventListener('click', () => {
    if (confirm('هل ترغب بتغيير اسم المستخدم المسجل؟')) {
      state.username = null;
      saveState();
      updateUI();
    }
  });

  // Enable Notifications Button (Lock Screen setup)
  document.getElementById('btnEnableNotifs')?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert('المتصفح لا يدعم الإشعارات مباشرة.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      alert('تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات ورنات النبضات والبوسات 🔔💜');
      triggerNotification('منوشة 💜', 'الإشعارات مفعلة وشغالة بنجاح!');
    } else {
      alert('يرجى تفعيل صلاحية الإشعارات من إعدادات المتصفح.');
    }
  });

  // Lockscreen banner dismiss
  document.getElementById('btnDismissLockscreenBanner')?.addEventListener('click', () => {
    const banner = document.getElementById('lockscreenBanner');
    if (banner) banner.classList.add('hidden');
  });

  // Refresh Button
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnRefresh');
    if (btn) btn.classList.add('spinning');
    await pollMissedMessages();
    await pollDirectory();
    updateUI();
    setTimeout(() => {
      if (btn) btn.classList.remove('spinning');
    }, 700);
  });

  // Tab Navigation Buttons
  document.getElementById('tabHeart')?.addEventListener('click', () => switchTab('heart'));
  document.getElementById('tabFriends')?.addEventListener('click', () => switchTab('friends'));
  document.getElementById('tabKisses')?.addEventListener('click', () => switchTab('kisses'));

  // Autocomplete Input
  const inputFriend = document.getElementById('inputFriendName');
  if (inputFriend) {
    inputFriend.addEventListener('input', (e) => {
      updateSuggestions(e.target.value);
    });
    inputFriend.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = inputFriend.value.trim();
        if (val) sendFriendRequest(val);
      }
    });
  }

  // Add Friend Button
  document.getElementById('btnAddFriend')?.addEventListener('click', () => {
    const input = document.getElementById('inputFriendName');
    const val = input ? input.value.trim() : '';
    if (val) sendFriendRequest(val);
  });

  // Incoming Banner Buttons
  document.getElementById('btnAcceptReq')?.addEventListener('click', () => {
    if (state.requests.length > 0) acceptFriendRequest(state.requests[0]);
  });
  document.getElementById('btnDeclineReq')?.addEventListener('click', () => {
    if (state.requests.length > 0) declineFriendRequest(state.requests[0]);
  });

  // Close Giant Kiss Overlay Button
  document.getElementById('btnCloseGiantKiss')?.addEventListener('click', () => {
    document.getElementById('giantKissOverlay')?.classList.add('hidden');
  });

  // Quick Kiss Sound Preview in Kisses tab
  document.getElementById('btnQuickKissSound')?.addEventListener('click', () => {
    sounds.kiss();
  });

  // Direct Kiss Button in Kisses tab
  document.getElementById('btnSendDirectKiss')?.addEventListener('click', () => {
    sendGiantKiss();
  });

  // Share My Link Button
  document.getElementById('btnShareMyLink')?.addEventListener('click', async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?add=${encodeURIComponent(state.username)}`;
    const shareData = {
      title: 'منوشة 💜',
      text: `أضفني على تطبيق منوشة لنتبادل القلوب والبوسات الفورية! يوزري: @${state.username}`,
      url: shareUrl
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('تم نسخ رابط الإضافة إلى الحافظة! يمكنك إرساله لأصحابك 💜');
      });
    }
  });

  // Setup Heart Long Press (3s) & Audio Engine
  setupHeartLongPress();

  // Setup Voice Kiss Recorder
  setupVoiceRecorder();

  // Check URL params for direct friend add link (e.g. ?add=user)
  const urlParams = new URLSearchParams(window.location.search);
  const addTarget = urlParams.get('add');
  if (addTarget && state.username) {
    sendFriendRequest(addTarget);
  }

  // Initial render
  updateUI();
  if (state.username) {
    startListening();
    pollDirectory();
  }
});
