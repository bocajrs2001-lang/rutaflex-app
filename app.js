let destinos = [];
let destinosDetectados = [];
let inicioViaje = null;
let tramoActual = 0;

function mostrarNotificacion(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('notificaciones');
  const notificacion = document.createElement('div');
  
  let colores = 'bg-blue-600 text-white';
  if (tipo === 'exito') colores = 'bg-green-600 text-white';
  if (tipo === 'error') colores = 'bg-red-600 text-white';
  if (tipo === 'advertencia') colores = 'bg-yellow-400 text-black';

  notificacion.className = `${colores} px-4 py-3 rounded-xl shadow-2xl font-bold text-sm text-center toast-anim pointer-events-auto border border-white/10`;
  notificacion.innerText = mensaje;
  
  contenedor.appendChild(notificacion);
  
  setTimeout(() => {
    notificacion.style.opacity = '0';
    notificacion.style.transform = 'translate(-50%, -20px)';
    notificacion.style.transition = 'all 0.5s ease';
    setTimeout(() => notificacion.remove(), 500);
  }, 3500);
}

// Cargar email guardado al iniciar
window.addEventListener('load', async () => {
  const emailGuardado = localStorage.getItem('rutaflex_email');
  if (emailGuardado) {
    document.getElementById('loginEmail').value = emailGuardado;
  }
  
  try {
    const res = await fetch('/api/yo', { credentials: 'include' });
    const data = await res.json();
    if (data.ok) mostrarApp(data.nombre);
  } catch (err) { console.log('No hay sesión activa'); }
});

document.getElementById('tabLogin').addEventListener('click', () => {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('recoverScreen').classList.add('hidden');
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
  document.getElementById('tabLogin').classList.add('text-accent', 'bg-white/10');
  document.getElementById('tabRegistro').classList.remove('text-accent', 'bg-white/10');
  document.getElementById('tabRegistro').classList.add('text-white/60');
  document.getElementById('authMessage').innerText = '';
});

document.getElementById('tabRegistro').addEventListener('click', () => {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('recoverScreen').classList.add('hidden');
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('tabRegistro').classList.add('text-accent', 'bg-white/10');
  document.getElementById('tabLogin').classList.remove('text-accent', 'bg-white/10');
  document.getElementById('tabLogin').classList.add('text-white/60');
  document.getElementById('authMessage').innerText = '';
});

document.getElementById('btnOlvideContrasena').addEventListener('click', () => {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('recoverScreen').classList.remove('hidden');
  document.getElementById('recoverMessage').innerText = '';
});

document.getElementById('btnVolverLogin').addEventListener('click', () => {
  document.getElementById('recoverScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
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
    const res = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('rutaflex_email', email);
      mostrarNotificacion("✅ ¡Cuenta creada con éxito!", "exito");
      setTimeout(() => mostrarApp(data.usuario.nombre), 1000);
    } else { 
      msg.innerText = data.error; 
      msg.className = "text-center text-sm mt-4 font-bold text-red-300"; 
    }
  } catch (err) { 
    mostrarNotificacion("❌ Error de conexión con el servidor.", "error"); 
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
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('rutaflex_email', email);
      mostrarNotificacion(`👋 ¡Bienvenido de nuevo, ${data.usuario.nombre}!`, "exito");
      setTimeout(() => mostrarApp(data.usuario.nombre), 1000);
    } else { 
      msg.innerText = data.error; 
      msg.className = "text-center text-sm mt-4 font-bold text-red-300"; 
    }
  } catch (err) { 
    mostrarNotificacion("❌ Error de conexión con el servidor.", "error"); 
  }
});

document.getElementById('formRecuperar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('recoverEmail').value;
  const nuevaPassword = document.getElementById('recoverPassword').value;
  const msg = document.getElementById('recoverMessage');
  msg.innerText = "Actualizando contraseña...";
  msg.className = "text-center text-sm mt-4 font-bold text-blue-300";

  try {
    const res = await fetch('/api/recuperar-contrasena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, nuevaPassword }) });
    const data = await res.json();
    if (res.ok) {
      mostrarNotificacion("✅ " + data.mensaje, "exito");
      setTimeout(() => {
        document.getElementById('recoverScreen').classList.add('hidden');
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = '';
      }, 2000);
    } else { 
      msg.innerText = data.error; 
      msg.className = "text-center text-sm mt-4 font-bold text-red-300"; 
    }
  } catch (err) { 
    mostrarNotificacion("❌ Error de conexión con el servidor.", "error"); 
  }
});

function mostrarApp(nombre) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('recoverScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userName').innerText = `¡Hola, ${nombre}! `;
  cargarDestinos();
}

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  mostrarNotificacion("👋 Sesión cerrada correctamente.", "info");
  setTimeout(() => location.reload(), 1000);
});

document.getElementById('btnPromo').addEventListener('click', async () => {
  const codigo = document.getElementById('promo').value;
  if (!codigo) return mostrarNotificacion("️ Escribí un código primero.", "advertencia");
  
  const msg = document.getElementById('promoMessage');
  const res = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) });
  const data = await res.json();
  
  if (data.valido) { 
    mostrarNotificacion("🎉 " + data.mensaje, "exito"); 
    msg.className = "hidden"; 
  } else { 
    mostrarNotificacion("❌ " + data.mensaje, "error"); 
    msg.className = "hidden"; 
  }
});

async function cargarDestinos() {
  try {
    const res = await fetch('/api/destinos', { credentials: 'include' });
    destinos = await res.json();
    renderLista();
  } catch (err) { console.error('Error al cargar destinos:', err); }
}

document.getElementById('fileImg').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const btn = document.getElementById('btnCargar');
  const textoOriginal = btn.innerText;
  
  btn.innerText = "🤖 La IA está leyendo...";
  btn.disabled = true;
  btn.classList.add('opacity-75', 'cursor-not-allowed');

  try {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js no está cargado.');
    }
    
    const { data: { text } } = await Tesseract.recognize(file, 'spa', { logger: m => console.log(m) });
    const lineas = text.split('\n').map(linea => linea.trim()).filter(linea => linea.length > 3);

    if (lineas.length === 0) {
      mostrarNotificacion("⚠️ No se detectó texto claro. Usá una foto más nítida.", "advertencia");
    } else {
      destinosDetectados = lineas;
      mostrarModalEdicion();
    }
  } catch (error) {
    console.error('Error en OCR:', error);
    mostrarNotificacion("❌ Error al procesar la imagen. Revisá tu conexión.", "error");
  } finally {
    btn.innerText = textoOriginal;
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
    e.target.value = ''; 
  }
});

function mostrarModalEdicion() {
  const contenedor = document.getElementById('contenedorInputs');
  contenedor.innerHTML = '';
  
  if (destinosDetectados.length === 0) {
    contenedor.innerHTML = '<p class="text-center text-gray-500 py-4">No hay direcciones para editar.</p>';
  } else {
    destinosDetectados.forEach((dir, index) => {
      contenedor.innerHTML += `
        <div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
          <span class="text-gray-400 font-bold text-sm w-6">${index + 1}.</span>
          <input type="text" value="${dir.replace(/"/g, '&quot;')}" data-index="${index}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm text-gray-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5BA4D9] rounded">
          <button onclick="eliminarLinea(${index})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all">🗑️</button>
        </div>
      `;
    });
  }
  document.getElementById('modalEdicion').classList.remove('hidden');
}

window.eliminarLinea = (index) => {
  destinosDetectados.splice(index, 1);
  mostrarModalEdicion();
};

document.getElementById('btnGuardarEdicion').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('.input-direccion');
  const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);

  if (finales.length === 0) {
    mostrarNotificacion("⚠️ No hay direcciones válidas para guardar.", "advertencia");
    return;
  }

  const btn = document.getElementById('btnGuardarEdicion');
  btn.innerText = "Guardando...";
  btn.disabled = true;

  for (const direccion of finales) {
    await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion }) });
  }

  btn.innerText = "✅ Guardar Todo";
  btn.disabled = false;
  document.getElementById('modalEdicion').classList.add('hidden');
  mostrarNotificacion("📍 Direcciones guardadas correctamente.", "exito");
  await cargarDestinos();
});

document.getElementById('btnCancelarEdicion').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
document.getElementById('btnCerrarModal').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

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
          <button onclick="borrarDestino(${dir.id})" class="text-red-500 text-xs px-2 hover:bg-red-50 rounded">️</button>
        </li>`;
    }, i * 80);
  });
  
  document.getElementById('count').innerText = destinos.length;
  document.getElementById('btnViaje').classList.remove('hidden');
  inicioViaje = inicioViaje || new Date();
}

window.borrarDestino = async (id) => {
  await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' });
  mostrarNotificacion("🗑️ Destino eliminado.", "info");
  await cargarDestinos();
};

function limpiarDireccion(direccion) {
  let limpia = direccion.replace(/^\d+\.\s*/, '');
  limpia = limpia.replace(/\[GR\]\s*/i, '');
  limpia = limpia.replace(/General\s+Rodríguez\s*,?\s*/gi, '');
  limpia = limpia.trim();
  if (!/General\s+Rodríguez/i.test(limpia)) {
    limpia += ', General Rodríguez, Buenos Aires';
  }
  return limpia;
}

document.getElementById('btnViaje').addEventListener('click', () => {
  const tramo = destinos.slice(tramoActual, tramoActual + 10);
  if (tramo.length === 0) {
    document.getElementById('stats').classList.remove('hidden');
    document.getElementById('statHoras').innerText = ((new Date() - inicioViaje) / 3600000).toFixed(1);
    document.getElementById('statKm').innerText = (tramoActual * 0.9).toFixed(1);
    document.getElementById('statEntregas').innerText = tramoActual;
    return;
  }
  
  const origin = "General Rodriguez, Buenos Aires, Argentina";
  const direccionesLimpias = tramo.map(d => limpiarDireccion(d.direccion));
  
  let url = '';
  if (direccionesLimpias.length === 1) {
    url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(direccionesLimpias[0])}&travelmode=driving`;
  } else {
    const destination = direccionesLimpias[direccionesLimpias.length - 1];
    const waypoints = direccionesLimpias.slice(0, -1).map(d => encodeURIComponent(d)).join('|');
    url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}&travelmode=driving`;
  }
  
  mostrarNotificacion("🗺️ Abriendo Google Maps...", "info");
  window.open(url, "_blank");
  
  tramoActual += 10;
  const siguiente = tramoActual + 10;
  document.getElementById('btnViaje').innerText = tramoActual < destinos.length
    ? `SIGUIENTE TRAMO (${tramoActual + 1} a ${Math.min(siguiente, destinos.length)})`
    : "🏆 VER ESTADISTICAS FINALES";
});

async function abrirCamara() {
  const video = document.getElementById('camara');
  video.classList.remove('hidden');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
  } catch (err) { 
    mostrarNotificacion("📷 No se pudo acceder a la cámara.", "error"); 
  }
}
