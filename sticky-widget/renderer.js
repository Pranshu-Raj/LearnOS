// Material Design Focus Widget Renderer - Multimodal Vision & Mobile QR Code Support

let topicsData = [];
let activeTopicIndex = -1;

// Timer State
let timerSeconds = 25 * 60;
let timerInitialSeconds = 25 * 60;
let timerInterval = null;
let isTimerRunning = false;

// DOM Elements
const topicTitleEl = document.getElementById('topic-title');
const topicBadgeEl = document.getElementById('topic-badge');
const paceChipEl = document.getElementById('pace-chip');
const topicEstimateEl = document.getElementById('topic-estimate');
const progressFillEl = document.getElementById('progress-fill');
const progressTextEl = document.getElementById('progress-text');
const tasksListEl = document.getElementById('tasks-list');
const reviewDueCountEl = document.getElementById('review-due-count');

const timerDisplayEl = document.getElementById('timer-display');
const timerToggleBtn = document.getElementById('timer-toggle-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const timerAddBtn = document.getElementById('timer-add-btn');
const logTimeBtn = document.getElementById('log-time-btn');

const navTasksBtn = document.getElementById('nav-tasks-btn');
const navTimerBtn = document.getElementById('nav-timer-btn');
const tasksPane = document.getElementById('tasks-pane');
const timerPane = document.getElementById('timer-pane');

const ratingModal = document.getElementById('rating-modal');
const rateSolidBtn = document.getElementById('rate-solid-btn');
const rateShakyBtn = document.getElementById('rate-shaky-btn');

const qrModal = document.getElementById('qr-modal');
const qrBtn = document.getElementById('qr-btn');
const closeQrBtn = document.getElementById('close-qr-btn');

const replanBtn = document.getElementById('replan-btn');
const refreshBtn = document.getElementById('refresh-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

// Window Controls
closeBtn.addEventListener('click', () => window.widgetAPI.closeApp());
minimizeBtn.addEventListener('click', () => window.widgetAPI.minimizeApp());
refreshBtn.addEventListener('click', () => loadVaultData());

// QR Code Modal Controls
qrBtn.addEventListener('click', async () => {
  qrModal.classList.remove('hidden');
  try {
    const res = await fetch('http://127.0.0.1:5000/status');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('qr-url-text').innerText = data.upload_url;
      document.getElementById('qr-img').src = 'qr_code.png?' + Date.now();
    }
  } catch (e) {
    document.getElementById('qr-url-text').innerText = 'Start mobile_server.py first!';
  }
});
closeQrBtn.addEventListener('click', () => {
  qrModal.classList.add('hidden');
});

replanBtn.addEventListener('click', async () => {
  topicTitleEl.innerText = "🤖 Re-planning schedule with AI...";
  replanBtn.disabled = true;
  try {
    const res = await window.widgetAPI.triggerReplan();
    if (res.status === 'success') {
      await loadVaultData();
    } else {
      alert(`Re-plan error: ${res.error || 'Failed to connect'}`);
    }
  } catch (e) {
    console.error("Re-plan failed:", e);
  } finally {
    replanBtn.disabled = false;
  }
});

// Drag and Drop Image Handler for Daily Planner Photos
document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp')) {
      topicTitleEl.innerText = "📷 Processing daily planner image...";
      try {
        const res = await window.widgetAPI.parsePlannerImage(file.path);
        if (res.status === 'success') {
          await loadVaultData();
        } else {
          alert(`Image Ingestion Error: ${res.error || 'Failed to parse planner'}`);
        }
      } catch (err) {
        console.error("Image parsing failed:", err);
      }
    }
  }
});

// Navigation Tabs
navTasksBtn.addEventListener('click', () => switchTab('tasks'));
navTimerBtn.addEventListener('click', () => switchTab('timer'));

function switchTab(tab) {
  if (tab === 'tasks') {
    navTasksBtn.classList.add('active');
    navTimerBtn.classList.remove('active');
    tasksPane.classList.remove('hidden');
    timerPane.classList.add('hidden');
  } else {
    navTimerBtn.classList.add('active');
    navTasksBtn.classList.remove('active');
    timerPane.classList.remove('hidden');
    tasksPane.classList.add('hidden');
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Web Audio API Synthesizers for Timer Sounds
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) audioCtx = new AudioCtxClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Physical Mechanical Pomodoro Ring Sound (Metallic Bell Chime)
function playPomodoroRing() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const ringDelays = [0, 0.14, 0.28, 0.42, 0.56];

  ringDelays.forEach((delay) => {
    setTimeout(() => {
      const now = ctx.currentTime;
      const harmonics = [1568, 2093, 3136];

      harmonics.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const initialGain = idx === 0 ? 0.35 : 0.15;
        gain.gain.setValueAtTime(initialGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (idx === 0 ? 0.9 : 0.45));

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.9);
      });
    }, delay * 1000);
  });
}

function playTimerTick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400, now);

  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.02);
}

// Spaced Repetition Interval Calculator (+1, +3, +7, +16, +35)
function calculateSpacedRepetition(currentCount = 0, rating = 'solid') {
  const INTERVAL_SEQ = [1, 3, 7, 16, 35];
  const today = new Date();
  let nextCount = 1;
  let intervalDays = 1;

  if (rating === 'solid') {
    nextCount = currentCount + 1;
    if (nextCount <= INTERVAL_SEQ.length) {
      intervalDays = INTERVAL_SEQ[nextCount - 1];
    } else {
      intervalDays = INTERVAL_SEQ[INTERVAL_SEQ.length - 1] * Math.pow(2, nextCount - INTERVAL_SEQ.length);
    }
  } else {
    nextCount = 1;
    intervalDays = 1;
  }

  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + intervalDays);

  const pad = n => String(n).padStart(2, '0');
  const formatDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    last_reviewed: formatDate(today),
    next_review_due: formatDate(dueDate),
    review_count: nextCount,
    interval_days: intervalDays,
    ease_rating: rating
  };
}

// Load Vault Data
async function loadVaultData() {
  topicTitleEl.innerText = "Loading topics...";
  topicsData = await window.widgetAPI.getVaultTopics();

  if (topicsData.length === 0) {
    topicTitleEl.innerText = "No topics found in TestVault/Topics";
    topicBadgeEl.innerText = "Empty";
    progressFillEl.style.width = "0%";
    progressTextEl.innerText = "0 / 0 topics";
    tasksListEl.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant); font-size: 12px; text-align: center; padding: 20px 0;">Snap a photo on phone via QR code or run mobile_server.py</p>';
    return;
  }

  // Today's date string YYYY-MM-DD
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Find due reviews
  const dueReviews = topicsData.filter(t => {
    return t.fm.status === 'done' && t.fm.next_review_due && t.fm.next_review_due <= todayStr;
  });

  if (dueReviews.length > 0) {
    reviewDueCountEl.innerText = `🔄 ${dueReviews.length} Review Due`;
    reviewDueCountEl.classList.remove('hidden');
  } else {
    reviewDueCountEl.classList.add('hidden');
  }

  // Calculate velocity metrics
  const doneTopics = topicsData.filter(t => t.fm.status === 'done');
  let totalEst = 0;
  let totalAct = 0;

  doneTopics.forEach(t => {
    totalEst += (t.fm.estimated_minutes || 0);
    totalAct += (t.fm.actual_minutes || 0);
  });

  const velocityRatio = totalEst > 0 ? (totalAct / totalEst).toFixed(2) : '1.0';
  paceChipEl.innerHTML = `<span class="material-symbols-outlined chip-icon">speed</span> ${velocityRatio}x Pace`;

  // Calculate vault progress
  const totalCount = topicsData.length;
  const doneCount = doneTopics.length;
  const progressPercent = Math.round((doneCount / totalCount) * 100);

  progressFillEl.style.width = `${progressPercent}%`;
  progressTextEl.innerText = `${doneCount} / ${totalCount} done`;

  // Prioritize active topic
  if (dueReviews.length > 0) {
    activeTopicIndex = topicsData.indexOf(dueReviews[0]);
  } else {
    activeTopicIndex = topicsData.findIndex(t => t.fm.status !== 'done');
    if (activeTopicIndex === -1) {
      activeTopicIndex = 0;
    }
  }

  renderActiveTopic();
}

function renderActiveTopic() {
  const active = topicsData[activeTopicIndex];
  if (!active) return;

  topicTitleEl.innerText = active.fm.topic || active.filename;
  
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isReviewDue = active.fm.status === 'done' && active.fm.next_review_due && active.fm.next_review_due <= todayStr;

  // Status Badge
  if (isReviewDue) {
    topicBadgeEl.innerText = 'Review Due 🔄';
    topicBadgeEl.style.background = 'rgba(255, 152, 0, 0.25)';
    topicBadgeEl.style.color = '#FF9800';
  } else if (active.fm.status === 'done') {
    topicBadgeEl.innerText = 'Completed ✓';
    topicBadgeEl.style.background = 'rgba(168, 199, 250, 0.2)';
    topicBadgeEl.style.color = '#A8C7FA';
  } else if (active.fm.status === 'in-progress') {
    topicBadgeEl.innerText = 'In Progress';
    topicBadgeEl.style.background = 'rgba(208, 188, 255, 0.2)';
    topicBadgeEl.style.color = '#D0BCFF';
  } else {
    topicBadgeEl.innerText = 'Not Started';
    topicBadgeEl.style.background = 'rgba(255, 255, 255, 0.1)';
    topicBadgeEl.style.color = '#E3E3E3';
  }

  // Estimate Chip
  const est = active.fm.estimated_minutes || 25;
  topicEstimateEl.innerHTML = `<span class="material-symbols-outlined chip-icon">schedule</span> ${est} min`;

  if (!isTimerRunning && timerSeconds === timerInitialSeconds) {
    timerSeconds = est * 60;
    timerInitialSeconds = est * 60;
    timerDisplayEl.innerText = formatTime(timerSeconds);
  }

  // Render Tasks List
  tasksListEl.innerHTML = '';
  if (active.tasks && active.tasks.length > 0) {
    active.tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = `task-item ${task.done ? 'checked' : ''}`;
      item.innerHTML = `
        <div class="material-checkbox">
          <span class="material-symbols-outlined">check</span>
        </div>
        <span class="task-label">${task.text}</span>
      `;

      item.addEventListener('click', async () => {
        task.done = !task.done;
        item.classList.toggle('checked', task.done);

        playTimerTick();

        const allDone = active.tasks.every(t => t.done);
        const newStatus = allDone ? 'done' : 'in-progress';
        
        await window.widgetAPI.updateTopicFrontmatter(active.filename, { status: newStatus });
        loadVaultData();
      });

      tasksListEl.appendChild(item);
    });
  } else {
    tasksListEl.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant); font-size: 12px; text-align: center; padding: 16px 0;">No task sub-items listed in file.</p>';
  }
}

// Timer Logic
timerToggleBtn.addEventListener('click', () => {
  playTimerTick();
  if (isTimerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

timerResetBtn.addEventListener('click', () => {
  playTimerTick();
  pauseTimer();
  timerSeconds = timerInitialSeconds;
  timerDisplayEl.innerText = formatTime(timerSeconds);
});

timerAddBtn.addEventListener('click', () => {
  playTimerTick();
  timerSeconds += 5 * 60;
  timerDisplayEl.innerText = formatTime(timerSeconds);
});

function startTimer() {
  isTimerRunning = true;
  timerToggleBtn.innerHTML = '<span class="material-symbols-outlined fab-icon">pause</span>';
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      timerDisplayEl.innerText = formatTime(timerSeconds);
    } else {
      pauseTimer();
      playPomodoroRing();
      promptRatingModal();
    }
  }, 1000);
}

function pauseTimer() {
  isTimerRunning = false;
  timerToggleBtn.innerHTML = '<span class="material-symbols-outlined fab-icon">play_arrow</span>';
  if (timerInterval) clearInterval(timerInterval);
}

logTimeBtn.addEventListener('click', () => {
  playPomodoroRing();
  pauseTimer();
  promptRatingModal();
});

function promptRatingModal() {
  ratingModal.classList.remove('hidden');
}

rateSolidBtn.addEventListener('click', async () => {
  await completeSessionWithRating('solid');
});

rateShakyBtn.addEventListener('click', async () => {
  await completeSessionWithRating('shaky');
});

async function completeSessionWithRating(rating) {
  ratingModal.classList.add('hidden');
  const active = topicsData[activeTopicIndex];
  if (active) {
    const elapsedSeconds = timerInitialSeconds - timerSeconds;
    const elapsedMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    const currentActual = active.fm.actual_minutes || 0;
    const currentReviewCount = active.fm.review_count || 0;

    const srsMetrics = calculateSpacedRepetition(currentReviewCount, rating);

    await window.widgetAPI.updateTopicFrontmatter(active.filename, {
      actual_minutes: currentActual + elapsedMinutes,
      status: 'done',
      ...srsMetrics
    });

    // Reset timer & reload vault
    timerSeconds = 25 * 60;
    timerInitialSeconds = 25 * 60;
    timerDisplayEl.innerText = formatTime(timerSeconds);
    await loadVaultData();
    switchTab('tasks');
  }
}

// Settings Modal Controls
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingProvider = document.getElementById('setting-provider');
const settingGeminiKey = document.getElementById('setting-gemini-key');
const settingGroqKey = document.getElementById('setting-groq-key');
const settingOpenrouterKey = document.getElementById('setting-openrouter-key');

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('learnos_settings') || '{}');
  if (settingProvider && settings.visionProvider) settingProvider.value = settings.visionProvider;
  if (settingGeminiKey && settings.geminiApiKey) settingGeminiKey.value = settings.geminiApiKey;
  if (settingGroqKey && settings.groqApiKey) settingGroqKey.value = settings.groqApiKey;
  if (settingOpenrouterKey && settings.openrouterApiKey) settingOpenrouterKey.value = settings.openrouterApiKey;
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.remove('hidden');
  });
}

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    const settings = {
      visionProvider: settingProvider.value,
      geminiApiKey: settingGeminiKey.value.trim(),
      groqApiKey: settingGroqKey.value.trim(),
      openrouterApiKey: settingOpenrouterKey.value.trim()
    };
    localStorage.setItem('learnos_settings', JSON.stringify(settings));
    settingsModal.classList.add('hidden');
  });
}

// Initial Load
loadSettings();
loadVaultData();

