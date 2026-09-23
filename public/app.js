// ========================================================
// ESTADO GLOBAL DEL CLIENTE
// ========================================================
let appState = {
  bathrooms: [],
  queue: [],
  users: [],
  config: { adminName: "Edward", bathroomCount: 2 },
  serverTime: Date.now(),
  clockOffset: 0,
};

let previousBathrooms = [];
let currentUser = null;
let timerInterval = null;
let soundEnabled = true;
let audioCtx = null;
let bathroomAlertLevels = {};

// ========================================================
// INICIALIZACIÓN
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSound();
  initNotifications();
  loadSavedUser();
  initFormEvents();
  connectSSE();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateAllTimers, 1000);
});

function loadSavedUser() {
  try {
    const saved = localStorage.getItem("bano_current_user");
    if (saved) currentUser = JSON.parse(saved);
  } catch (e) {
    currentUser = null;
  }
}

function initNotifications() {
  const btn = document.getElementById("btnEnableNotifications");
  const icon = document.getElementById("notifIcon");
  if (!btn) return;

  if (!("Notification" in window)) {
    btn.style.display = "none";
    return;
  }

  function updateIcon() {
    if (Notification.permission === "granted") {
      icon.textContent = "🔔";
      btn.title = "Notificaciones de escritorio activadas";
    } else {
      icon.textContent = "🔕";
      btn.title = "Activar notificaciones de escritorio para cuando sea tu turno";
    }
  }

  updateIcon();

  btn.addEventListener("click", async () => {
    try {
      const perm = await Notification.requestPermission();
      updateIcon();
      if (perm === "granted") {
        showToast("¡Notificaciones activadas! Te avisaremos cuando salgan del baño.", "success");
        triggerBrowserNotification("🚽 BañoTurnos", "Notificaciones configuradas correctamente.");
      } else {
        showToast("Notificaciones no autorizadas en este navegador.", "error");
      }
    } catch (e) {}
  });
}

function triggerBrowserNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚽</text></svg>",
      });
    }
  } catch (e) {}
}

function initTheme() {
  const themeSelect = document.getElementById("themeSelect");
  const savedTheme = localStorage.getItem("bano_theme") || "theme-clean";
  document.body.className = savedTheme;
  themeSelect.value = savedTheme;

  themeSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    document.body.className = selected;
    localStorage.setItem("bano_theme", selected);
    showToast(`Tema: ${e.target.options[e.target.selectedIndex].text}`);
  });
}

function initSound() {
  const soundBtn = document.getElementById("soundToggleBtn");
  const soundIcon = document.getElementById("soundIcon");
  const savedSound = localStorage.getItem("bano_sound");
  soundEnabled = savedSound !== "false";
  soundIcon.textContent = soundEnabled ? "🔊" : "🔇";

  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("bano_sound", soundEnabled);
    soundIcon.textContent = soundEnabled ? "🔊" : "🔇";
    showToast(soundEnabled ? "Sonidos activados 🔔" : "Sonidos silenciados 🔕");
    if (soundEnabled) playChime();
  });
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playChime() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (e) {}
}

function playTurnReadySound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.35, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.5);
    });
  } catch (e) {}
}

function playQueueAdvanceSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {}
}

function playWarningTone() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {}
}

function playUrgentAlarm() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.2, 0.4].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, now + offset);
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  } catch (e) {}
}

// ========================================================
// EVENTOS Y FORMULARIOS
// ========================================================
function initFormEvents() {
  const formLogin = document.getElementById("formLogin");
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("inputUserName");
    const name = input.value.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ingresar");

      setCurrentUser(data.user);
      input.value = "";
      showToast(`¡Bienvenido, ${data.user.name}!`, "success");
      playChime();

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  const btnChangeUser = document.getElementById("btnChangeUser");
  btnChangeUser.addEventListener("click", () => {
    currentUser = null;
    localStorage.removeItem("bano_current_user");
    handleStateUpdate(appState);
    showToast("Has salido. Ingresa con otro nombre.");
  });

  const btnJoinQueue = document.getElementById("btnJoinQueue");
  btnJoinQueue.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al pedir turno");

      showToast(`¡Turno solicitado! Estás en la lista de espera.`, "success");
      playChime();

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  const btnCancelMyTurn = document.getElementById("btnCancelMyTurn");
  btnCancelMyTurn.addEventListener("click", async () => {
    if (!currentUser) return;
    const myTurn = (appState.queue || []).find((q) => q.userId === currentUser.id);
    if (!myTurn) return;

    try {
      const res = await fetch(`/api/queue/${myTurn.id}`, { method: "DELETE" });
      if (res.ok) showToast("Has salido de la lista de espera.");
    } catch (e) {}
  });

  const btnLeaveFromCard = document.getElementById("btnLeaveFromCard");
  if (btnLeaveFromCard) {
    btnLeaveFromCard.addEventListener("click", async () => {
      await leaveBathroom(false);
    });
  }

  const btnDismissTurnAlert = document.getElementById("btnDismissTurnAlert");
  btnDismissTurnAlert.addEventListener("click", async () => {
    const banner = document.getElementById("turnAlertBanner");
    banner.style.display = "none";
    if (currentUser) {
      await enterBathroom(currentUser.id);
    }
  });

  const btnQueueOther = document.getElementById("btnQueueOther");
  btnQueueOther.addEventListener("click", async () => {
    const select = document.getElementById("queueOtherSelect");
    const userId = select.value;
    if (!userId) {
      showToast("Selecciona el compañero", "error");
      return;
    }
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al pedir turno");

      showToast(`Turno solicitado para ${data.turn.userName}`, "success");
      select.value = "";
      playChime();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.querySelectorAll(".btn-count").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUser) return;
      const count = btn.dataset.count;
      try {
        const res = await fetch("/api/admin/bathrooms/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id, count }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cambiar cantidad");

        showToast(data.message, "success");
        playChime();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  document.querySelectorAll(".btn-test").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mins = btn.dataset.simMins;
      try {
        const res = await fetch("/api/bathroom/simulate-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: mins }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error en simulación");
        showToast(data.message, "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function enterBathroom(userId, bathroomId = null) {
  try {
    const payload = { userId };
    if (bathroomId !== null) payload.bathroomId = bathroomId;

    const res = await fetch("/api/bathroom/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al ingresar");

    const banner = document.getElementById("turnAlertBanner");
    if (banner) banner.style.display = "none";

    showToast(data.message || "¡Has ingresado al baño!", "success");
    playChime();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function leaveBathroom(force = false, bathroomId = null) {
  try {
    const payload = {
      force,
      userId: currentUser ? currentUser.id : undefined,
    };
    if (bathroomId !== null) payload.bathroomId = bathroomId;

    const res = await fetch("/api/bathroom/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al salir");

    showToast(data.message || "Baño liberado.", "success");
    playChime();
  } catch (err) {
    showToast(err.message, "error");
  }
}

window.toggleMaintenance = async function (bathroomId, currentState) {
  if (!currentUser) return;
  const nextState = !currentState;
  const actionText = nextState ? "poner en MANTENIMIENTO 🚧" : "quitar de mantenimiento y ACTIVAR 🟢";
  
  if (!confirm(`¿Deseas ${actionText} este baño?`)) return;

  try {
    const res = await fetch("/api/admin/bathrooms/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        bathroomId,
        maintenance: nextState,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en mantenimiento");

    showToast(data.message, "success");
    playChime();
  } catch (err) {
    showToast(err.message, "error");
  }
};

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem("bano_current_user", JSON.stringify(user));
  handleStateUpdate(appState);
}

function connectSSE() {
  const connStatus = document.getElementById("connStatus");

  try {
    const evtSource = new EventSource("/api/events");

    evtSource.onopen = () => {
      if (connStatus) connStatus.textContent = "🟢 Conectado en tiempo real";
    };

    evtSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        handleStateUpdate(state);
      } catch (err) {
        console.error("Error SSE:", err);
      }
    };

    evtSource.onerror = () => {
      if (connStatus) connStatus.textContent = "🟠 Reconectando...";
      evtSource.close();
      setTimeout(connectSSE, 3000);
    };
  } catch (err) {
    setInterval(fetchStatus, 2000);
  }
}

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const state = await res.json();
      handleStateUpdate(state);
    }
  } catch (e) {}
}

function handleStateUpdate(state) {
  const freedBathroom = (state.bathrooms || []).find((curr) => {
    const prev = (previousBathrooms || []).find((p) => p.id === curr.id);
    return prev && prev.currentTurn && !curr.currentTurn && !curr.isMaintenance;
  });

  appState = state;
  appState.clockOffset = Date.now() - state.serverTime;

  if (currentUser && !state.users.some((u) => u.id === currentUser.id)) {
    const match = state.users.find((u) => u.name.toLowerCase() === currentUser.name.toLowerCase());
    if (match) {
      currentUser = match;
      localStorage.setItem("bano_current_user", JSON.stringify(match));
    }
  }

  updateViewMode();
  renderLoginChips(state.users || []);
  renderOtherUserSelect(state.users || []);
  renderAdminPanel(state);
  renderBathroomsGrid(state.bathrooms || []);
  renderQueue(state.queue || []);
  updateUserQueueCard();

  if (freedBathroom && currentUser) {
    const queue = state.queue || [];
    const myPos = queue.findIndex((q) => q.userId === currentUser.id);

    if (myPos === 0) {
      playTurnReadySound();
      showTurnAlertBanner("¡ES TU TURNO!", `¡${freedBathroom.name} se ha desocupado y está disponible para ti!`);
      triggerBrowserNotification("🚽 ¡Es tu turno para el baño!", `¡${freedBathroom.name} está libre! Entra ya.`);
      showToast(`🎉 ¡ES TU TURNO! ${freedBathroom.name} está listo para ti.`, "success");
    } else if (myPos > 0) {
      playQueueAdvanceSound();
      showToast(`🚪 Alguien salió de ${freedBathroom.name}. La fila avanzó: ahora estás en el puesto #${myPos + 1}.`);
      triggerBrowserNotification("🚽 Fila de baño avanzada", `Alguien salió de ${freedBathroom.name}. Puesto #${myPos + 1}.`);
    }
  }

  previousBathrooms = (state.bathrooms || []).map((b) => ({
    id: b.id,
    currentTurn: b.currentTurn ? { ...b.currentTurn } : null,
    isMaintenance: b.isMaintenance,
  }));
}

function showTurnAlertBanner(title, message) {
  const banner = document.getElementById("turnAlertBanner");
  const titleEl = document.getElementById("turnAlertTitle");
  const msgEl = document.getElementById("turnAlertMessage");
  if (!banner || !titleEl || !msgEl) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  banner.style.display = "block";
}

function updateViewMode() {
  const viewLogin = document.getElementById("view-login");
  const viewDashboard = document.getElementById("view-dashboard");
  const sessionUserName = document.getElementById("sessionUserName");
  const adminBadge = document.getElementById("adminBadge");

  if (!currentUser) {
    viewLogin.style.display = "flex";
    viewDashboard.style.display = "none";
  } else {
    viewLogin.style.display = "none";
    viewDashboard.style.display = "block";
    if (sessionUserName) sessionUserName.textContent = currentUser.name;

    const isEdward = currentUser.name.trim().toLowerCase() === "edward";
    if (adminBadge) adminBadge.style.display = isEdward ? "inline-block" : "none";
  }
}

function renderAdminPanel(state) {
  const adminCard = document.getElementById("adminPanelCard");
  const adminCount = document.getElementById("adminCurrentCount");
  const maintList = document.getElementById("adminMaintenanceList");
  if (!adminCard) return;

  const isEdward = currentUser && currentUser.name.trim().toLowerCase() === "edward";
  if (!isEdward) {
    adminCard.style.display = "none";
    return;
  }

  adminCard.style.display = "block";
  const bathrooms = state.bathrooms || [];

  if (adminCount) adminCount.textContent = bathrooms.length;

  document.querySelectorAll(".btn-count").forEach((btn) => {
    const count = parseInt(btn.dataset.count, 10);
    if (count === bathrooms.length) {
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-outline");
    } else {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
    }
  });

  if (maintList) {
    maintList.innerHTML = bathrooms
      .map((b) => {
        const isMaint = Boolean(b.isMaintenance);
        return `
          <div class="admin-maint-item">
            <span><strong>${escapeHtml(b.name)}</strong>: ${isMaint ? '<span style="color:#b45309;">🚧 En Mantenimiento</span>' : '<span style="color:var(--success);">🟢 Operativo</span>'}</span>
            <button class="btn btn-sm ${isMaint ? 'btn-primary' : 'btn-outline-danger'}" onclick="toggleMaintenance(${b.id}, ${isMaint})">
              ${isMaint ? '🟢 Reactivar' : '🚧 Poner Mantenimiento'}
            </button>
          </div>
        `;
      })
      .join("");
  }
}

function renderBathroomsGrid(bathrooms) {
  const grid = document.getElementById("bathroomsGrid");
  const allMaintAlert = document.getElementById("allMaintenanceAlert");
  const btnJoinQueue = document.getElementById("btnJoinQueue");
  const queueHelperText = document.getElementById("queueHelperText");
  if (!grid) return;

  const allInMaintenance = bathrooms.length > 0 && bathrooms.every((b) => b.isMaintenance);

  if (allMaintAlert) {
    allMaintAlert.style.display = allInMaintenance ? "flex" : "none";
  }

  if (allInMaintenance) {
    btnJoinQueue.disabled = true;
    btnJoinQueue.textContent = "🚧 Baños en Mantenimiento";
    queueHelperText.textContent = "Todos los baños están temporalmente fuera de servicio por mantenimiento.";
  } else {
    btnJoinQueue.disabled = false;
    btnJoinQueue.textContent = "➕ Solicitar Turno / Entrar a Lista de Espera";
    queueHelperText.textContent = "Solicita tu turno en la lista de espera compartida. Te avisaremos cuando cualquier baño se desocupe.";
  }

  const queue = appState.queue || [];
  const isMeInQueue = currentUser && queue.some((q) => q.userId === currentUser.id);
  const myQueueIndex = isMeInQueue ? queue.findIndex((q) => q.userId === currentUser.id) : -1;
  const isMyTurnFirst = myQueueIndex === 0;

  grid.innerHTML = bathrooms
    .map((b) => {
      const isMaint = Boolean(b.isMaintenance);
      const isOccupied = !isMaint && Boolean(b.currentTurn);
      const isFree = !isMaint && !isOccupied;

      if (isMaint) {
        return `
          <div class="card bathroom-card" style="border: 2px dashed #f59e0b;">
            <div class="bathroom-top-header">
              <span class="bathroom-name">${escapeHtml(b.name)}</span>
              <span class="status-indicator-badge badge-maintenance">🚧 MANTENIMIENTO</span>
            </div>
            <div class="state-maintenance-box">
              <span class="maint-icon">🚧</span>
              <h4 class="maint-title">Fuera de Servicio</h4>
              <p class="maint-desc">Este baño está temporalmente en mantenimiento o limpieza. No se permiten reservas ni ingresos.</p>
            </div>
          </div>
        `;
      }

      if (isFree) {
        let actionBtnHtml = "";

        if (queue.length > 0) {
          if (isMyTurnFirst) {
            actionBtnHtml = `
              <div class="action-box">
                <button class="btn btn-primary btn-lg" onclick="enterBathroom('${currentUser.id}', ${b.id})">
                  🚪 ¡Es tu turno! Entrar a ${escapeHtml(b.name)}
                </button>
              </div>
            `;
          } else if (isMeInQueue) {
            actionBtnHtml = `
              <div class="action-box" style="margin-top: 10px;">
                <p><small>Turno reservado para ${escapeHtml(queue[0].userName)}. Si no está presente:</small></p>
                <button class="btn btn-primary btn-md" onclick="enterBathroom('${currentUser.id}', ${b.id})">
                  ⚡ Tomar Turno y Entrar a ${escapeHtml(b.name)}
                </button>
              </div>
            `;
          } else {
            actionBtnHtml = `
              <div class="action-box">
                <small class="muted-text">Turno de: <strong>${escapeHtml(queue[0].userName)}</strong></small>
              </div>
            `;
          }
        } else {
          actionBtnHtml = `
            <div class="action-box">
              <button class="btn btn-primary btn-lg" onclick="${currentUser ? `enterBathroom('${currentUser.id}', ${b.id})` : "showToast('Primero identifícate', 'error')" }">
                🚪 Entrar a ${escapeHtml(b.name)} Ya
              </button>
            </div>
          `;
        }

        return `
          <div class="card bathroom-card">
            <div class="bathroom-top-header">
              <span class="bathroom-name">${escapeHtml(b.name)}</span>
              <span class="status-indicator-badge badge-free">🟢 DISPONIBLE</span>
            </div>
            <div class="status-icon-wrapper free-glow">
              <span class="status-emoji">🟢</span>
            </div>
            <h3 class="status-title free-text">¡Libre!</h3>
            <p class="status-sub">Listo para ingresar.</p>
            ${actionBtnHtml}
          </div>
        `;
      }

      if (isOccupied) {
        const turn = b.currentTurn;
        const isMeInside = Boolean(
          currentUser && (
            turn.userId === currentUser.id ||
            (turn.userName && currentUser.name && turn.userName.toLowerCase() === currentUser.name.toLowerCase())
          )
        );

        return `
          <div class="card bathroom-card">
            <div class="bathroom-top-header">
              <span class="bathroom-name">${escapeHtml(b.name)}</span>
              <span class="status-indicator-badge badge-occupied">🔴 OCUPADO</span>
            </div>

            <div class="status-icon-wrapper occupied-glow">
              <span class="status-emoji">🔴</span>
            </div>
            <h3 class="status-title occupied-text">Ocupado</h3>

            <div class="timer-container">
              <div class="timer-label">Tiempo transcurrido:</div>
              <div class="timer-display" id="timerDisplay_${b.id}">--:--</div>
            </div>

            <div id="alertNormal_${b.id}" class="alert-box alert-normal">
              <span class="alert-icon">🔒</span>
              <div>
                <strong>Privacidad Protegida:</strong>
                <p>Alguien está adentro. Su identidad se mantiene privada.</p>
              </div>
            </div>

            <div id="alertWarning_${b.id}" class="alert-box alert-warning" style="display:none;">
              <span class="alert-icon">⚠️</span>
              <div>
                <strong>¡Lleva más de 10 minutos!</strong>
                <p>Demorando más de lo habitual. Hay personas esperando.</p>
              </div>
            </div>

            <div id="alertUrgent_${b.id}" class="alert-box alert-urgent" style="display:none;">
              <span class="alert-icon">🚨</span>
              <div>
                <strong style="color:var(--danger);">¡URGENCIA CRÍTICA (+20m)!</strong>
                <div class="revealed-name-box">
                  <span>Identidad revelada:</span>
                  <h4 id="revealedName_${b.id}">---</h4>
                </div>
                <p>Por favor sal ya del baño.</p>
              </div>
            </div>

            <div class="leave-box">
              ${
                isMeInside
                  ? `
                  <div class="user-inside-badge">
                    <span>🚽 Tú estás adentro de este baño</span>
                  </div>
                  <button class="btn btn-outline-danger btn-lg btn-block" onclick="leaveBathroom(false, ${b.id})">
                    ✅ Terminé / Salir de ${escapeHtml(b.name)}
                  </button>
                `
                  : `
                  <div class="leave-forbidden-box">
                    <span style="font-size:1.1rem; display:block; margin-bottom:4px;">🔒</span>
                    <small>Solo quien está adentro puede marcar su salida.</small>
                    <button class="btn btn-sm btn-outline-danger" style="margin-top: 8px;" onclick="promptEmergencyLeave(${b.id}, '${escapeHtml(b.name)}')">
                      🔓 ¿Ya salió y olvidó marcar? Liberar
                    </button>
                  </div>
                `
              }
            </div>

          </div>
        `;
      }
    })
    .join("");

  updateAllTimers();
}

window.promptEmergencyLeave = async function (bathroomId, name) {
  if (!confirm(`¿Confirmas que ${name} ya está desocupado físicamente y deseas marcarlo como libre?`)) return;
  await leaveBathroom(true, bathroomId);
};

function updateAllTimers() {
  const bathrooms = appState.bathrooms || [];
  const now = Date.now() - appState.clockOffset;

  bathrooms.forEach((b) => {
    if (!b.currentTurn) return;

    const elapsedSecs = Math.max(0, Math.floor((now - b.currentTurn.enteredAt) / 1000));
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;

    const timerEl = document.getElementById(`timerDisplay_${b.id}`);
    if (timerEl) {
      timerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    const alertNormal = document.getElementById(`alertNormal_${b.id}`);
    const alertWarning = document.getElementById(`alertWarning_${b.id}`);
    const alertUrgent = document.getElementById(`alertUrgent_${b.id}`);
    const revealedName = document.getElementById(`revealedName_${b.id}`);

    const lastLvl = bathroomAlertLevels[b.id] || 0;

    if (mins >= 20) {
      if (alertNormal) alertNormal.style.display = "none";
      if (alertWarning) alertWarning.style.display = "none";
      if (alertUrgent) alertUrgent.style.display = "flex";

      const name = b.currentTurn.userName || "Compañero adentro";
      if (revealedName) revealedName.textContent = name;

      if (lastLvl < 2) {
        bathroomAlertLevels[b.id] = 2;
        playUrgentAlarm();
        showToast(`🚨 ¡URGENCIA en ${b.name}! ${name} lleva más de 20 minutos adentro.`, "error");
        triggerBrowserNotification(`🚨 ${b.name} Ocupado >20m`, `${name} lleva más de 20 minutos adentro.`);
      }
    } else if (mins >= 10) {
      if (alertNormal) alertNormal.style.display = "none";
      if (alertWarning) alertWarning.style.display = "flex";
      if (alertUrgent) alertUrgent.style.display = "none";

      if (lastLvl < 1) {
        bathroomAlertLevels[b.id] = 1;
        playWarningTone();
        showToast(`⚠️ Aviso: La persona en ${b.name} lleva más de 10 minutos.`);
      }
    } else {
      if (alertNormal) alertNormal.style.display = "flex";
      if (alertWarning) alertWarning.style.display = "none";
      if (alertUrgent) alertUrgent.style.display = "none";
      bathroomAlertLevels[b.id] = 0;
    }
  });
}

function updateUserQueueCard() {
  if (!currentUser) return;
  const boxInsideBathroom = document.getElementById("boxInsideBathroom");
  const insideTitle = document.getElementById("insideBathroomTitle");
  const boxNotInQueue = document.getElementById("boxNotInQueue");
  const boxInQueue = document.getElementById("boxInQueue");
  const myQueuePos = document.getElementById("myQueuePos");

  const myBathroom = (appState.bathrooms || []).find((b) => {
    return (
      b.currentTurn &&
      (b.currentTurn.userId === currentUser.id ||
        (b.currentTurn.userName &&
          currentUser.name &&
          b.currentTurn.userName.toLowerCase() === currentUser.name.toLowerCase()))
    );
  });

  if (myBathroom) {
    if (boxInsideBathroom) boxInsideBathroom.style.display = "block";
    if (insideTitle) insideTitle.textContent = `¡Tú estás en ${myBathroom.name} ahora!`;
    if (boxNotInQueue) boxNotInQueue.style.display = "none";
    if (boxInQueue) boxInQueue.style.display = "none";
    return;
  } else {
    if (boxInsideBathroom) boxInsideBathroom.style.display = "none";
  }

  const queue = appState.queue || [];
  const myIndex = queue.findIndex((q) => q.userId === currentUser.id);

  if (myIndex >= 0) {
    if (boxNotInQueue) boxNotInQueue.style.display = "none";
    if (boxInQueue) boxInQueue.style.display = "block";
    if (myQueuePos) myQueuePos.textContent = myIndex === 0 ? "#1 (¡Siguiente en turno!)" : `#${myIndex + 1}`;
  } else {
    if (boxNotInQueue) boxNotInQueue.style.display = "block";
    if (boxInQueue) boxInQueue.style.display = "none";
  }
}

function renderQueue(queue) {
  const queueCount = document.getElementById("queueCount");
  const emptyState = document.getElementById("queueListEmpty");
  const queueList = document.getElementById("queueList");

  if (queueCount) {
    queueCount.textContent = queue.length === 1 ? "1 en espera" : `${queue.length} en espera`;
  }

  if (queue.length === 0) {
    emptyState.style.display = "block";
    queueList.style.display = "none";
    queueList.innerHTML = "";
  } else {
    emptyState.style.display = "none";
    queueList.style.display = "flex";

    queueList.innerHTML = queue
      .map((item, index) => {
        const isFirst = index === 0;
        const isMe = currentUser && item.userId === currentUser.id;
        const posText = isFirst ? "1º" : `${index + 1}º`;
        return `
          <li class="queue-item" style="${isMe ? 'border-color: var(--primary); background: var(--bg-card-hover);' : ''}">
            <div class="queue-item-left">
              <span class="queue-pos-badge ${isFirst ? 'queue-first-badge' : ''}">${posText}</span>
              <div>
                <div class="queue-user-name">${escapeHtml(item.userName)} ${isMe ? '<strong>(Tú)</strong>' : ''} ${isFirst ? '🔥' : ''}</div>
                <div class="queue-time-sub">${isFirst ? 'Siguiente en turno' : 'En lista de espera'}</div>
              </div>
            </div>
            <button class="btn-remove-turn" onclick="cancelQueueTurn('${item.id}', '${escapeHtml(item.userName)}')" title="Cancelar turno">
              ✕
            </button>
          </li>
        `;
      })
      .join("");
  }
}

window.cancelQueueTurn = async function (id, name) {
  if (!confirm(`¿Cancelar el turno de ${name}?`)) return;
  try {
    const res = await fetch(`/api/queue/${id}`, { method: "DELETE" });
    if (res.ok) showToast(`Turno de ${name} cancelado.`);
  } catch (e) {}
};

function renderLoginChips(users) {
  const container = document.getElementById("quickExistingUsers");
  const chipsBox = document.getElementById("loginUserChips");
  if (!container || !chipsBox) return;

  if (users.length === 0) {
    container.style.display = "none";
  } else {
    container.style.display = "block";
    chipsBox.innerHTML = users
      .map(
        (u) => `
        <button type="button" class="login-chip-btn" onclick="selectExistingUser('${u.id}')">
          👤 ${escapeHtml(u.name)} ${u.name.toLowerCase() === 'edward' ? '👑' : ''}
        </button>
      `
      )
      .join("");
  }
}

window.selectExistingUser = function (userId) {
  const user = (appState.users || []).find((u) => u.id === userId);
  if (user) {
    setCurrentUser(user);
    showToast(`¡Hola, ${user.name}!`, "success");
    playChime();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
};

function renderOtherUserSelect(users) {
  const select = document.getElementById("queueOtherSelect");
  if (!select) return;

  const currentVal = select.value;
  let html = `<option value="">-- Selecciona el compañero --</option>`;
  users.forEach((u) => {
    if (currentUser && u.id === currentUser.id) return;
    html += `<option value="${u.id}">${escapeHtml(u.name)}</option>`;
  });
  select.innerHTML = html;
  select.value = currentVal;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
