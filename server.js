const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "store.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Clientes SSE (Server-Sent Events)
let sseClients = [];

function broadcastUpdate() {
  const payload = JSON.stringify(getPublicStatus());
  sseClients.forEach((client) => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

// Cargar o inicializar almacenamiento
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const cleanRaw = raw.replace(/^\uFEFF/, "");
      const parsed = JSON.parse(cleanRaw);

      // Migración / verificación de estructura de baños (mínimo 2 baños por defecto)
      if (!parsed.bathrooms || !Array.isArray(parsed.bathrooms) || parsed.bathrooms.length === 0) {
        parsed.bathrooms = [
          { id: 1, name: "Baño 1", status: "free", isMaintenance: false, currentTurn: null },
          { id: 2, name: "Baño 2", status: "free", isMaintenance: false, currentTurn: null },
        ];
      }

      if (!parsed.config) {
        parsed.config = {
          adminName: "Edward",
          adminPassword: "Tunainpec19862**",
          adminToken: "tok_edward_19862",
        };
      } else {
        if (!parsed.config.adminPassword) {
          parsed.config.adminPassword = "Tunainpec19862**";
        }
        if (!parsed.config.adminToken) {
          parsed.config.adminToken = "tok_edward_19862";
        }
      }

      // Asegurar que Edward exista en la lista de usuarios
      const hasEdward = (parsed.users || []).some(
        (u) => u.name.toLowerCase() === "edward"
      );
      if (!hasEdward) {
        if (!parsed.users) parsed.users = [];
        parsed.users.push({
          id: "usr_admin_edward",
          name: "Edward",
          createdAt: Date.now(),
        });
      }

      return parsed;
    }
  } catch (err) {
    console.error("Error al leer store.json, recreando...", err);
  }

  const defaultData = {
    users: [
      { id: "usr_admin_edward", name: "Edward", createdAt: Date.now() },
      { id: "usr_1", name: "Ruben Dario", createdAt: Date.now() + 1 },
      { id: "usr_2", name: "Carlos Mendoza", createdAt: Date.now() + 2 },
      { id: "usr_3", name: "Ana Gomez", createdAt: Date.now() + 3 },
    ],
    queue: [],
    config: {
      adminName: "Edward",
      adminPassword: "Tunainpec19862**",
      adminToken: "tok_edward_19862",
    },
    bathrooms: [
      { id: 1, name: "Baño 1", status: "free", isMaintenance: false, currentTurn: null },
      { id: 2, name: "Baño 2", status: "free", isMaintenance: false, currentTurn: null },
    ],
  };
  saveData(defaultData);
  return defaultData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error al guardar store.json:", err);
  }
}

// Validar si un usuario es el administrador Edward (opcionalmente verificando token de sesión)
function isEdwardAdmin(data, userId, adminToken = null) {
  if (!userId) return false;
  const user = (data.users || []).find((u) => u.id === userId);
  if (!user || user.name.trim().toLowerCase() !== "edward") return false;
  if (adminToken && data.config?.adminToken && adminToken !== data.config.adminToken) {
    return false;
  }
  return true;
}

// Formatear estado público con reglas de privacidad por cada baño
function getPublicStatus() {
  const data = loadData();
  const now = Date.now();

  const formattedBathrooms = (data.bathrooms || []).map((b) => {
    let occupiedInfo = null;

    if (b.currentTurn) {
      const elapsedSeconds = Math.max(0, Math.floor((now - b.currentTurn.enteredAt) / 1000));
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);

      // Reglas de privacidad:
      // 0 a 9.99 min: Privacidad total
      // 10 a 19.99 min: Advertencia de tiempo
      // 20+ min: Alerta crítica y revelación pública de nombre
      const isWarning = elapsedMinutes >= 10 && elapsedMinutes < 20;
      const isUrgent = elapsedMinutes >= 20;

      occupiedInfo = {
        id: b.currentTurn.id,
        userId: b.currentTurn.userId,
        enteredAt: b.currentTurn.enteredAt,
        elapsedSeconds,
        elapsedMinutes,
        warningLevel: isUrgent ? 2 : isWarning ? 1 : 0,
        isWarning,
        isUrgent,
        userName: isUrgent ? b.currentTurn.userName : null,
        alias: isUrgent ? b.currentTurn.userName : "Persona Anónima 🔒",
      };
    }

    let status = "free";
    if (b.isMaintenance) {
      status = "maintenance";
    } else if (b.currentTurn) {
      status = "occupied";
    }

    return {
      id: b.id,
      name: b.name,
      status,
      isMaintenance: Boolean(b.isMaintenance),
      currentTurn: occupiedInfo,
    };
  });

  return {
    bathrooms: formattedBathrooms,
    queue: data.queue || [],
    users: (data.users || []).sort((a, b) => a.name.localeCompare(b.name)),
    config: {
      adminName: "Edward",
      bathroomCount: formattedBathrooms.length,
    },
    serverTime: now,
  };
}

// SSE Endpoint
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const clientObj = { id: clientId, res };
  sseClients.push(clientObj);

  res.write(`data: ${JSON.stringify(getPublicStatus())}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Obtener estado general
app.get("/api/status", (req, res) => {
  res.json(getPublicStatus());
});

// Registrar nuevo usuario o iniciar sesión
app.post("/api/users", (req, res) => {
  const { name, password } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "El nombre es requerido." });
  }

  const cleanName = name.trim();
  const data = loadData();
  const isEdward = cleanName.toLowerCase() === "edward";

  // Si es el usuario Edward, exigir contraseña
  if (isEdward) {
    if (!password) {
      return res.status(401).json({
        error: "Se requiere contraseña para el usuario administrador Edward.",
        requirePassword: true,
      });
    }

    if (password !== data.config.adminPassword) {
      return res.status(401).json({
        error: "Contraseña incorrecta para el usuario administrador Edward.",
        requirePassword: true,
      });
    }

    let edwardUser = data.users.find(
      (u) => u.name.toLowerCase() === "edward"
    );
    if (!edwardUser) {
      edwardUser = {
        id: "usr_admin_edward",
        name: "Edward",
        createdAt: Date.now(),
      };
      data.users.push(edwardUser);
      saveData(data);
      broadcastUpdate();
    }

    return res.json({
      message: "¡Bienvenido, Administrador Edward!",
      user: edwardUser,
      adminToken: data.config.adminToken,
    });
  }

  // Para cualquier otro usuario (sin contraseña)
  const existing = data.users.find(
    (u) => u.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    return res.json({ message: "El usuario ya estaba registrado.", user: existing });
  }

  const newUser = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name: cleanName,
    createdAt: Date.now(),
  };

  data.users.push(newUser);
  saveData(data);
  broadcastUpdate();

  res.status(201).json({ message: "Usuario registrado con éxito.", user: newUser });
});

// Solicitar turno (unirse a la fila)
app.post("/api/queue", (req, res) => {
  const { userId } = req.body;
  const data = loadData();

  const user = data.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado." });
  }

  // Verificar si todos los baños están en mantenimiento
  const allInMaintenance = data.bathrooms.length > 0 && data.bathrooms.every((b) => b.isMaintenance);
  if (allInMaintenance) {
    return res.status(400).json({
      error: "Todos los baños están actualmente en mantenimiento. No es posible solicitar turno.",
    });
  }

  // Verificar si ya está en la fila
  const alreadyInQueue = data.queue.some((q) => q.userId === userId);
  if (alreadyInQueue) {
    return res.status(400).json({ error: `${user.name} ya está en la lista de espera.` });
  }

  // Verificar si ya está adentro de algún baño
  const alreadyInBathroom = data.bathrooms.some(
    (b) => b.currentTurn && b.currentTurn.userId === userId
  );
  if (alreadyInBathroom) {
    return res.status(400).json({ error: `${user.name} actualmente está adentro de un baño.` });
  }

  const turnItem = {
    id: "turn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    userId: user.id,
    userName: user.name,
    requestedAt: Date.now(),
  };

  data.queue.push(turnItem);
  saveData(data);
  broadcastUpdate();

  res.status(201).json({ message: "Turno solicitado con éxito.", turn: turnItem });
});

// Cancelar turno de la fila
app.delete("/api/queue/:id", (req, res) => {
  const { id } = req.params;
  const data = loadData();
  data.queue = data.queue.filter((q) => q.id !== id);
  saveData(data);
  broadcastUpdate();
  res.json({ message: "Turno cancelado." });
});

// Entrar al baño (soporta especificar baño o asignar automáticamente uno disponible)
app.post("/api/bathroom/enter", (req, res) => {
  const { userId, bathroomId } = req.body;
  const data = loadData();

  // 1. Determinar el baño de destino
  let targetBathroom = null;
  if (bathroomId !== undefined && bathroomId !== null) {
    targetBathroom = data.bathrooms.find((b) => Number(b.id) === Number(bathroomId));
    if (!targetBathroom) {
      return res.status(404).json({ error: "El baño seleccionado no existe." });
    }
  } else {
    // Buscar el primer baño libre que no esté en mantenimiento
    targetBathroom = data.bathrooms.find((b) => !b.isMaintenance && !b.currentTurn);
  }

  if (!targetBathroom) {
    return res.status(400).json({
      error: "No hay ningún baño disponible en este momento.",
    });
  }

  if (targetBathroom.isMaintenance) {
    return res.status(400).json({
      error: `${targetBathroom.name} se encuentra en mantenimiento y no puede ser utilizado.`,
    });
  }

  if (targetBathroom.currentTurn) {
    return res.status(400).json({
      error: `${targetBathroom.name} ya se encuentra ocupado.`,
    });
  }

  // 2. Determinar qué usuario ingresa
  let user = null;

  if (data.queue.length > 0) {
    let queueIndex = -1;
    if (userId) {
      queueIndex = data.queue.findIndex((q) => q.userId === userId);
    }

    if (queueIndex >= 0) {
      // El usuario está en la fila (puede ser el 1º o alguien pendiente que toma el turno)
      const queuedItem = data.queue[queueIndex];
      user = data.users.find((u) => u.id === queuedItem.userId) || {
        id: queuedItem.userId,
        name: queuedItem.userName,
      };
      // Remover a esta persona de la fila y reordenar
      data.queue.splice(queueIndex, 1);
    } else {
      // Si no especificó userId, toma el primero de la fila
      if (!userId) {
        const first = data.queue.shift();
        user = data.users.find((u) => u.id === first.userId) || {
          id: first.userId,
          name: first.userName,
        };
      } else {
        return res.status(400).json({
          error: "Hay personas en la lista de espera. Por favor anótate en la lista primero.",
        });
      }
    }
  } else {
    // No hay fila: entra directamente
    if (!userId) {
      return res.status(400).json({ error: "Debe seleccionar un usuario para ingresar." });
    }
    user = data.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
  }

  targetBathroom.currentTurn = {
    id: "active_" + Date.now(),
    userId: user.id,
    userName: user.name,
    enteredAt: Date.now(),
  };

  saveData(data);
  broadcastUpdate();
  res.json({
    message: `Has ingresado a ${targetBathroom.name}.`,
    bathroom: targetBathroom,
  });
});

// Liberar el baño (salir)
app.post("/api/bathroom/leave", (req, res) => {
  const { userId, bathroomId, force } = req.body || {};
  const data = loadData();

  let targetBathroom = null;
  if (bathroomId !== undefined && bathroomId !== null) {
    targetBathroom = data.bathrooms.find((b) => Number(b.id) === Number(bathroomId));
  } else if (userId) {
    // Buscar el baño donde está este usuario
    targetBathroom = data.bathrooms.find(
      (b) => b.currentTurn && b.currentTurn.userId === userId
    );
  }

  if (!targetBathroom || !targetBathroom.currentTurn) {
    return res.status(400).json({ error: "El baño especificado no está ocupado." });
  }

  const reqUser = userId ? data.users.find((u) => u.id === userId) : null;
  const isTurnOwner = Boolean(
    userId &&
      (targetBathroom.currentTurn.userId === userId ||
        (reqUser &&
          targetBathroom.currentTurn.userName.toLowerCase() === reqUser.name.toLowerCase()))
  );

  // Validar exclusividad (solo quien está adentro o force si olvidó marcar)
  if (!isTurnOwner && !force) {
    return res.status(403).json({
      error: `Solo la persona que está adentro de ${targetBathroom.name} puede terminar su turno.`,
    });
  }

  const previousUser = targetBathroom.currentTurn.userName;
  targetBathroom.currentTurn = null;
  saveData(data);
  broadcastUpdate();

  res.json({ message: `${targetBathroom.name} ha sido liberado por ${previousUser}.` });
});

// ========================================================
// ENDPOINTS DE ADMINISTRACIÓN (EXCLUSIVOS PARA EDWARD)
// ========================================================

// Cambiar la cantidad de baños disponibles
app.post("/api/admin/bathrooms/count", (req, res) => {
  const { userId, count, adminToken } = req.body;
  const token = adminToken || req.headers["x-admin-token"];
  const data = loadData();

  if (!isEdwardAdmin(data, userId, token)) {
    return res.status(403).json({
      error: "Acceso denegado: Solo el administrador Edward puede modificar la cantidad de baños.",
    });
  }

  const numCount = parseInt(count, 10);
  if (isNaN(numCount) || numCount < 1 || numCount > 8) {
    return res.status(400).json({ error: "La cantidad de baños debe ser entre 1 y 8." });
  }

  const currentCount = data.bathrooms.length;

  if (numCount > currentCount) {
    // Agregar baños
    for (let i = currentCount + 1; i <= numCount; i++) {
      data.bathrooms.push({
        id: i,
        name: `Baño ${i}`,
        status: "free",
        isMaintenance: false,
        currentTurn: null,
      });
    }
  } else if (numCount < currentCount) {
    // Eliminar baños sobrantes
    data.bathrooms = data.bathrooms.slice(0, numCount);
  }

  saveData(data);
  broadcastUpdate();

  res.json({
    message: `Cantidad de baños actualizada a ${numCount}.`,
    bathrooms: data.bathrooms,
  });
});

// Poner en mantenimiento o reactivar un baño
app.post("/api/admin/bathrooms/maintenance", (req, res) => {
  const { userId, bathroomId, maintenance, adminToken } = req.body;
  const token = adminToken || req.headers["x-admin-token"];
  const data = loadData();

  if (!isEdwardAdmin(data, userId, token)) {
    return res.status(403).json({
      error: "Acceso denegado: Solo el administrador Edward puede gestionar el mantenimiento.",
    });
  }

  const targetBathroom = data.bathrooms.find((b) => Number(b.id) === Number(bathroomId));
  if (!targetBathroom) {
    return res.status(404).json({ error: "Baño no encontrado." });
  }

  targetBathroom.isMaintenance = Boolean(maintenance);
  if (targetBathroom.isMaintenance) {
    // Si estaba ocupado, se libera para entrar en mantenimiento
    targetBathroom.currentTurn = null;
  }

  saveData(data);
  broadcastUpdate();

  const msg = targetBathroom.isMaintenance
    ? `${targetBathroom.name} ha sido puesto en MANTENIMIENTO 🚧.`
    : `${targetBathroom.name} ha sido reactivado y está OPERATIVO 🟢.`;

  res.json({ message: msg, bathroom: targetBathroom });
});

// Eliminar un usuario (Solo Edward, y solo si NO está en el baño ni en lista de espera)
app.post("/api/admin/users/delete", (req, res) => {
  const { userId, targetUserId, adminToken } = req.body;
  const token = adminToken || req.headers["x-admin-token"];
  const data = loadData();

  if (!isEdwardAdmin(data, userId, token)) {
    return res.status(403).json({
      error: "Acceso denegado: Solo el administrador Edward puede eliminar usuarios.",
    });
  }

  const targetUser = (data.users || []).find((u) => u.id === targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "El usuario a eliminar no existe." });
  }

  if (targetUser.name.trim().toLowerCase() === "edward") {
    return res.status(400).json({ error: "No es posible eliminar al usuario administrador Edward." });
  }

  // 1. Validar que no esté utilizando ningún baño
  const inBathroom = (data.bathrooms || []).find(
    (b) =>
      b.currentTurn &&
      (b.currentTurn.userId === targetUserId ||
        (b.currentTurn.userName &&
          b.currentTurn.userName.toLowerCase() === targetUser.name.toLowerCase()))
  );
  if (inBathroom) {
    return res.status(400).json({
      error: `No se puede eliminar a ${targetUser.name} porque actualmente está adentro de ${inBathroom.name}. Debe salir del baño primero.`,
    });
  }

  // 2. Validar que no tenga turno pendiente en la lista de espera
  const inQueue = (data.queue || []).some(
    (q) =>
      q.userId === targetUserId ||
      (q.userName && q.userName.toLowerCase() === targetUser.name.toLowerCase())
  );
  if (inQueue) {
    return res.status(400).json({
      error: `No se puede eliminar a ${targetUser.name} porque tiene un turno pendiente en la lista de espera. Debe cancelar su turno primero.`,
    });
  }

  // Eliminar usuario
  data.users = data.users.filter((u) => u.id !== targetUserId);
  saveData(data);
  broadcastUpdate();

  res.json({
    message: `Usuario "${targetUser.name}" eliminado del sistema exitosamente.`,
    deletedUserId: targetUserId,
  });
});

// Cambiar la contraseña del administrador Edward
app.post("/api/admin/change-password", (req, res) => {
  const { userId, currentPassword, newPassword, adminToken } = req.body;
  const token = adminToken || req.headers["x-admin-token"];
  const data = loadData();

  if (!isEdwardAdmin(data, userId, token)) {
    return res.status(403).json({
      error: "Acceso denegado: Solo el administrador Edward puede cambiar la contraseña.",
    });
  }

  if (!currentPassword || currentPassword !== data.config.adminPassword) {
    return res.status(400).json({
      error: "La contraseña actual no es correcta.",
    });
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 4) {
    return res.status(400).json({
      error: "La nueva contraseña debe tener al menos 4 caracteres.",
    });
  }

  const cleanNew = newPassword.trim();
  const newToken = "tok_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  data.config.adminPassword = cleanNew;
  data.config.adminToken = newToken;
  saveData(data);

  res.json({
    message: "¡Contraseña de administrador actualizada con éxito!",
    adminToken: newToken,
  });
});

// Modo de prueba / simulación de tiempo (EXCLUSIVO PARA EL ADMINISTRADOR EDWARD)
app.post("/api/bathroom/simulate-time", (req, res) => {
  const { userId, bathroomId, minutes, adminToken } = req.body;
  const token = adminToken || req.headers["x-admin-token"];
  const data = loadData();

  if (!isEdwardAdmin(data, userId, token)) {
    return res.status(403).json({
      error: "Acceso denegado: El simulador de tiempo solo está permitido para el administrador Edward.",
    });
  }

  let target = null;
  if (bathroomId) {
    target = data.bathrooms.find((b) => Number(b.id) === Number(bathroomId));
  } else {
    // Primer baño ocupado
    target = data.bathrooms.find((b) => b.currentTurn);
  }

  if (!target || !target.currentTurn) {
    return res.status(400).json({ error: "No hay ningún baño ocupado para simular tiempo." });
  }

  const mins = Number(minutes) || 0;
  target.currentTurn.enteredAt = Date.now() - mins * 60 * 1000;
  saveData(data);
  broadcastUpdate();

  res.json({ message: `Tiempo simulado en ${target.name}: ${mins} minutos transcurridos.` });
});

app.listen(PORT, () => {
  console.log(`🚽 Servidor BañoTurnos activo en http://localhost:${PORT}`);
});
