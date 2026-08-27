// Variables globales
let destinos = [];
let inicioViaje = null;
let tramoActual = 0;

// --- AUTENTICACIÓN ---
document.getElementById('tabLogin').addEventListener('click', () => {
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
  document.getElementById('tabLogin').classList.add('text-accent', 'bg-white/10');
  document.getElementById('tabRegistro').classList.remove('text-accent', 'bg-white/10');
  document.getElementById('tabRegistro').classList.add('text-white/60');
  document.getElementById('authMessage').innerText = '';
});

document.getElementById('tabRegistro').addEventListener('click', () => {
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('tabRegistro').classList.add('text-accent', 'bg-white/10');
  document.getElementById('tabLogin').classList.remove('text-accent', 'bg-white/10');
  document.getElementById('tabLogin').classList.add('text-white/60');
  document.getElementById('authMessage').innerText = '';
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const msg = document.getElementById('authMessage');
  msg.innerText = "Creando cuenta...";
  msg.className = "text-center text-sm mt-4 font-bold text-blue-300";

  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nombre, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarApp(data.usuario.nombre);
    } else {
      msg.innerText = data.error;
      msg.className = "text-center text-sm mt-4 font-bold text-red-300";
    }
  } catch (err) {
    msg.innerText = "Error de conexión.";
  }
});

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('authMessage');
  msg.innerText = "Ingresando...";
  msg.className = "text-center text-sm mt-4 font-bold text-blue-300";

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarApp(data.usuario.nombre);
    } else {
      msg.innerText = data.error;
      msg.className = "text-center text-sm mt-4 font-bold text-red-300";
    }
  } catch (err) {
    msg.innerText = "Error de conexión.";
  }
});

function mostrarApp(nombre) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userName').innerText = `¡Hola, ${nombre}! 👋`;
  cargarDestinos();
}

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  location.reload();
});

document.getElementById('btnPromo').addEventListener('click', async () => {
  const codigo = document.getElementById('promo').value;
  const msg = document.getElementById('promoMessage');
  const res = await fetch('/api/validar-promo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ codigo })
  });
  const data = await res.json();
  if (data.valido) {
    msg.innerText = data.mensaje;
    msg.className = "text-xs text-center mt-2 font-bold text-green-600";
  } else {
    msg.innerText = data.mensaje;
    msg.className = "text-xs text-center mt-2 font-bold text-red-600";
  }
});

// --- RECORDAR SESIÓN ---
window.addEventListener('load', async () => {
  try {
    const res = await fetch('/api/yo', { credentials: 'include' });
    const data = await res.json();
    if (data.ok) mostrarApp(data.nombre);
  } catch (err) {
    console.log('No hay sesión activa');
  }
});

// --- 🤖 DESTINOS CON IA (OCR REAL) ---

async function cargarDestinos() {
  try {
    const res = await fetch('/api/destinos', { credentials: 'include' });
    destinos = await res.json();
    renderLista();
  } catch (err) {
    console.error('Error al cargar destinos:', err);
  }
}

// AQUÍ ESTÁ LA MAGIA: Leer imagen con Tesseract.js
document.getElementById('fileImg').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const btn = document.getElementById('btnCargar');
  const textoOriginal = btn.innerText;
  
  // 1. Mostrar estado de carga
  btn.innerText = "🤖 La IA está leyendo la imagen...";
  btn.disabled = true;
  btn.classList.add('opacity-75', 'cursor-not-allowed');

  try {
    // 2. Ejecutar Tesseract.js en español
    const { data: { text } } = await Tesseract.recognize(file, 'spa', {
      logger: m => console.log(m) // Muestra el progreso en la consola (F12)
    });

    // 3. Procesar el texto: separar por líneas y limpiar
    const lineas = text.split('\n')
      .map(linea => linea.trim()) // Quitar espacios al inicio/final
      .filter(linea => linea.length > 5); // Ignorar líneas muy cortas (ruido)

    if (lineas.length === 0) {
      alert("No se pudo detectar texto claro en la imagen. Intentá con una foto más nítida.");
    } else {
      // 4. Guardar cada línea como un destino en la base de datos
      for (const direccion of lineas) {
        await fetch('/api/destinos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ direccion: direccion })
        });
      }
      alert(`¡Éxito! La IA detectó ${lineas.length} direcciones.`);
      await cargarDestinos(); // Recargar la lista
    }
  } catch (error) {
    console.error("Error en OCR:", error);
    alert("Hubo un error al procesar la imagen.");
  } finally {
    // 5. Restaurar el botón
    btn.innerText = textoOriginal;
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
    e.target.value = ''; // Limpiar el input para poder subir la misma foto de nuevo si se quiere
  }
});

function renderLista() {
  const lista = document.getElementById('lista');
  lista.innerHTML = "";
  if (destinos.length === 0) {
    lista.innerHTML = '<li class="text-center text-gray-400 py-4">No hay destinos. Cargá una foto para empezar.</li>';
    document.getElementById('btnViaje').classList.add('hidden');
    document.getElementById('count').innerText = 0;
    return;
  }
  
  destinos.forEach((dir, i) => {
    setTimeout(() => {
      lista.innerHTML += `
        <li class="flex gap-2 border-b py-2 items-center">
          <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">🏠</span>
          <div class="flex-1">
            <b>${dir.direccion}</b><br>
            <span class="text-xs text-green-600">${dir.distancia} km • ~${dir.tiempo} min</span>
          </div>
          <button onclick="borrarDestino(${dir.id})" class="text-red-500 text-xs px-2 hover:bg-red-50 rounded">🗑️</button>
        </li>`;
    }, i * 80);
  });
  
  document.getElementById('count').innerText = destinos.length;
  document.getElementById('btnViaje').classList.remove('hidden');
  inicioViaje = inicioViaje || new Date();
}

window.borrarDestino = async (id) => {
  await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' });
  await cargarDestinos();
};

document.getElementById('btnViaje').addEventListener('click', () => {
  const tramo = destinos.slice(tramoActual, tramoActual + 10);
  if (tramo.length === 0) {
    document.getElementById('stats').classList.remove('hidden');
    document.getElementById('statHoras').innerText = ((new Date() - inicioViaje) / 3600000).toFixed(1);
    document.getElementById('statKm').innerText = (tramoActual * 0.9).toFixed(1);
    document.getElementById('statEntregas').innerText = tramoActual;
    return;
  }
  const origin = "General Rodriguez, Buenos Aires";
  const destination = tramo[tramo.length - 1].direccion;
  const waypoints = tramo.slice(0, -1).map(d => d.direccion).join('|');
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
  window.open(url, "_blank");
  tramoActual += 10;
  const siguiente = tramoActual + 10;
  document.getElementById('btnViaje').innerText = tramoActual < destinos.length
    ? `SIGUIENTE TRAMO (${tramoActual + 1} a ${Math.min(siguiente, destinos.length)})`
    : "VER ESTADISTICAS FINALES";
});

async function abrirCamara() {
  const video = document.getElementById('camara');
  video.classList.remove('hidden');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
  } catch (err) {
    alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
  }
}