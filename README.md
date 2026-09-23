# 🚽 BañoTurnos - Control de Turnos para el Baño en Tiempo Real

Una aplicación web moderna, responsiva y fácil de usar diseñada para coordinar el acceso al baño compartido en oficinas, hogares o espacios de coworking. 

Incluye respeto por la privacidad con alertas inteligentes de tiempo transcurrido, cambio dinámico de temas visuales, notificaciones de audio sintetizadas y sincronización en tiempo real entre múltiples dispositivos sin necesidad de bases de datos complejas.

---

## ✨ Características Principales

1. **👥 Registro Rápido**:
   - Ingreso sencillo con solo escribir el nombre o apodo una única vez.
   - Aparece automáticamente en el desplegable de solicitud de turno de todos los usuarios.
2. **⏳ Fila de Espera Ordenada**:
   - Solicita turno y visualiza tu posición en la cola (1º, 2º, 3º...).
   - Opción para ingresar de inmediato si no hay nadie esperando ni en el baño.
   - Posibilidad de cancelar turno si ya no es necesario ir.
3. **🔒 Reglas de Privacidad y Alertas**:
   - **0 a 9 min 59 seg**: Privacidad total ("Alguien está adentro 🔒"). Nadie puede ver quién está en el baño.
   - **10 a 19 min 59 seg**: Alerta de tiempo prolongado ("⚠️ Lleva más de 10 minutos. Por favor considera que hay compañeros esperando"). El nombre sigue anónimo.
   - **20 min en adelante**: Alerta de urgencia crítica ("🚨 ¡URGENTE! **[Nombre]** lleva más de 20 minutos adentro. ¡Por favor sal ya!"). El nombre se revela con sirena visual y sonido de aviso.
4. **🎨 4 Temas Visuales**:
   - 🧼 *Limpio & Moderno* (Blanco pulcro, esmeralda e índigo)
   - 🌙 *Noche & Neón* (Modo oscuro cyberpunk con destellos neón)
   - 🐥 *Pato de Baño* (Divertido y alegre en amarillo y tonos de agua)
   - 🏢 *Oficina Corporativa* (Sobrio y elegante en tonos pizarra y azul)
5. **🔔 Audio Integrado**:
   - Campana suave al desocuparse el baño o registrar un turno.
   - Alarma auditiva al superar los 20 minutos (se puede silenciar con un botón).
6. **⚡ Sincronización en Tiempo Real**:
   - Server-Sent Events (SSE): lo que alguien hace en su celular se actualiza al instante en la pantalla de los demás sin refrescar.
7. **🧪 Simulador Rápido**:
   - Pestaña para adelantar el tiempo a 11 o 21 minutos y probar las alertas sin tener que esperar.

---

## 🚀 Cómo Ejecutar Localmente

### Requisitos:
- Tener instalado Node.js (versión 18 o superior).

### Pasos:
1. Abre una terminal en la carpeta del proyecto.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor:
   ```bash
   npm start
   ```
4. Abre en tu navegador favorito:
   ```
   http://localhost:3000
   ```

---

## 🌐 Cómo Publicar en un Hosting GRATIS

### Opción 1: Despliegue en Render.com (Recomendado ⭐⭐⭐⭐⭐)

**Render** ofrece alojamiento web gratuito para aplicaciones Node.js:

1. Crea una cuenta gratuita en [render.com](https://render.com).
2. Sube esta carpeta a tu repositorio de GitHub (público o privado).
3. En el panel de Render, haz clic en **"New +"** y selecciona **"Web Service"**.
4. Conecta tu repositorio de GitHub recién creado.
5. Configura los siguientes campos:
   - **Name**: `bano-turnos` (o el nombre que prefieras).
   - **Region**: La más cercana a tu país (ej. Ohio / Frankfurt).
   - **Branch**: `main`.
   - **Runtime**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `npm start`.
   - **Instance Type**: `Free` ($0/mes).
6. Haz clic en **"Create Web Service"**.
7. ¡Listo! En 2 minutos Render te dará una URL pública como `https://bano-turnos.onrender.com` que podrás compartir con toda la oficina o familia.

---

### Opción 2: Despliegue en Railway.app

1. Entra a [railway.app](https://railway.app) e inicia sesión con GitHub.
2. Haz clic en **"New Project"** &rarr; **"Deploy from GitHub repo"**.
3. Selecciona el repositorio de BañoTurnos.
4. Railway detectará automáticamente Node.js y ejecutará `npm start`.
5. En la pestaña de configuración del servicio, genera un dominio público en **"Generate Domain"**.

---

### Opción 3: Despliegue sin GitHub en Glitch o Replit

Si no deseas usar Git ni GitHub:
1. Entra a [glitch.com](https://glitch.com).
2. Haz clic en **"New Project"** &rarr; **"Import from zip"** o crea un proyecto Node y pega los archivos (`server.js`, `package.json`, la carpeta `public` y `data`).
3. Glitch lo pondrá en vivo de forma instantánea con una URL permanente.

---

## 📂 Estructura del Proyecto

```
bano-turnos/
├── data/
│   └── store.json          # Datos persistidos de usuarios, cola y turno activo
├── public/
│   ├── index.html          # Interfaz de usuario (Dashboard, Fila, Registro, Temas)
│   ├── styles.css          # Estilos CSS con las variables de los 4 temas
│   └── app.js             # Lógica cliente, SSE, cronómetro y efectos sonoros
├── server.js               # Servidor Express con API REST y SSE en tiempo real
├── package.json            # Configuración y dependencias del proyecto
└── README.md               # Esta documentación
```
