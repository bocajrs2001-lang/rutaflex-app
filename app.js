let destinos = [];
let destinosDetectados = [];
let inicioViaje = null;
let tramoActual = 0;
let emailRecuperacion = ""; 
let estaVencido = false;

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
  setTimeout(() => { notificacion.style.opacity = '0'; notificacion.style.transform = 'translate(-50%, -20px)'; notificacion.style.transition = 'all 0.5s ease'; setTimeout(() => notificacion.remove(), 500); }, 3500);
}

window.addEventListener('load', async () => {
  const emailGuardado = localStorage.getItem('rutaflex_email');
  if (emailGuardado) document.getElementById('loginEmail').value = emailGuardado;
  try {
    const res = await fetch('/api/yo', { credentials: 'include' });
    const data = await res.json();
    if (data.ok) mostrarApp(data.nombre, data.fecha_vencimiento);
  } catch (err) { console.log('No hay sesión activa'); }
});

// NAVEGACIÓN Y RECUPERACIÓN
document.getElementById('tabLogin').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('authScreen'); document.getElementById('formLogin').classList.remove('hidden'); document.getElementById('formRegistro').classList.add('hidden'); document.getElementById('tabLogin').classList.add('text-accent', 'bg-white/10'); document.getElementById('tabRegistro').classList.remove('text-accent', 'bg-white/10'); document.getElementById('tabRegistro').classList.add('text-white/60'); document.getElementById('authMessage').innerText = ''; });
document.getElementById('tabRegistro').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('authScreen'); document.getElementById('formRegistro').classList.remove('hidden'); document.getElementById('formLogin').classList.add('hidden'); document.getElementById('tabRegistro').classList.add('text-accent', 'bg-white/10'); document.getElementById('tabLogin').classList.remove('text-accent', 'bg-white/10'); document.getElementById('tabLogin').classList.add('text-white/60'); document.getElementById('authMessage').innerText = ''; });
document.getElementById('btnOlvideContrasena').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('recoverStep1'); document.getElementById('recoverEmailInput').value = document.getElementById('loginEmail').value || ''; document.getElementById('recoverMsg1').innerText = ''; });
document.getElementById('btnVolverLogin1').addEventListener('click', () => ocultarTodasLasPantallasExcepto('authScreen'));
document.getElementById('btnReenviarCodigo').addEventListener('click', enviarCodigoRecuperacion);
function ocultarTodasLasPantallasExcepto(id) { ['authScreen', 'recoverStep1', 'recoverStep2', 'recoverStep3', 'appScreen'].forEach(s => document.getElementById(s).classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }

async function enviarCodigoRecuperacion() { const email = document.getElementById('recoverEmailInput').value; const msg = document.getElementById('recoverMsg1'); if (!email) { msg.innerText = "Ingresá tu email"; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; return; } msg.innerText = "Enviando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; try { const res = await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await res.json(); if (res.ok) { emailRecuperacion = email; mostrarNotificacion("📧 Código enviado", "exito"); ocultarTodasLasPantallasExcepto('recoverStep2'); document.getElementById('recoverMsg2').innerText = ''; } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } }
document.getElementById('formRecoverEmail').addEventListener('submit', async (e) => { e.preventDefault(); await enviarCodigoRecuperacion(); });
document.getElementById('formRecoverCode').addEventListener('submit', async (e) => { e.preventDefault(); const codigo = document.getElementById('recoverCodeInput').value; const msg = document.getElementById('recoverMsg2'); msg.innerText = "Verificando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; try { const res = await fetch('/api/verificar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, codigo }) }); const data = await res.json(); if (res.ok) { mostrarNotificacion("✅ Código correcto", "exito"); ocultarTodasLasPantallasExcepto('recoverStep3'); document.getElementById('recoverMsg3').innerText = ''; } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } } catch (err) { mostrarNotificacion("❌ Error", "error"); } });
document.getElementById('formNewPassword').addEventListener('submit', async (e) => { e.preventDefault(); const nuevaPassword = document.getElementById('newPasswordInput').value; const msg = document.getElementById('recoverMsg3'); msg.innerText = "Guardando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; try { const res = await fetch('/api/cambiar-contrasena-final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, nuevaPassword }) }); const data = await res.json(); if (res.ok) { mostrarNotificacion("¡Contraseña cambiada!", "exito"); setTimeout(() => { ocultarTodasLasPantallasExcepto('authScreen'); document.getElementById('loginEmail').value = emailRecuperacion; document.getElementById('loginPassword').value = ''; emailRecuperacion = ""; }, 2000); } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } } catch (err) { mostrarNotificacion("❌ Error", "error"); } });

// AUTENTICACIÓN
document.getElementById('formRegistro').addEventListener('submit', async (e) => { e.preventDefault(); const nombre = document.getElementById('regNombre').value; const email = document.getElementById('regEmail').value; const password = document.getElementById('regPassword').value; const msg = document.getElementById('authMessage'); msg.innerText = "Creando cuenta..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; try { const res = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarNotificacion("✅ ¡Cuenta creada!", "exito"); setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000); } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } });
document.getElementById('formLogin').addEventListener('submit', async (e) => { e.preventDefault(); const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value; const msg = document.getElementById('authMessage'); msg.innerText = "Ingresando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarNotificacion(`👋 ¡Bienvenido, ${data.usuario.nombre}!`, "exito"); setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000); } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } } catch (err) { mostrarNotificacion(" Error de conexión", "error"); } });

// LÓGICA PRINCIPAL DE LA APP
function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  document.getElementById('userName').innerText = `¡Hola, ${nombre}! `;
  
  const contadorEl = document.getElementById('contadorDias');
  const bannerVencido = document.getElementById('bannerVencido');
  const alertaProximo = document.getElementById('alertaProximoVencimiento');
  const seccionDestinos = document.getElementById('seccionDestinos');
  const listaContainer = document.getElementById('listaContainer');
  
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diffTime = venc - hoy;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  bannerVencido.classList.add('hidden');
  alertaProximo.classList.add('hidden');
  seccionDestinos.style.opacity = "1";
  seccionDestinos.style.pointerEvents = "auto";
  listaContainer.style.opacity = "1";
  listaContainer.style.pointerEvents = "auto";
  estaVencido = false;

  if (!fechaVencimiento || diffDays <= 0) {
    estaVencido = true;
    contadorEl.innerText = "⚠️ VENCIDO";
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-red-600 text-white";
    bannerVencido.classList.remove('hidden');
    
    seccionDestinos.style.opacity = "0.3";
    seccionDestinos.style.pointerEvents = "none";
    listaContainer.style.opacity = "0.3";
    listaContainer.style.pointerEvents = "none";
    
    document.getElementById('lista').innerHTML = '<li class="text-center text-red-500 py-4 font-bold">Renová tu plan para ver y usar tus destinos.</li>';
    document.getElementById('count').innerText = "-";
    document.getElementById('btnViaje').classList.add('hidden'); // Ocultar botón de viaje si está vencido
    mostrarNotificacion("Tu plan está vencido. Renová abajo 👇", "advertencia");

  } else if (diffDays <= 1) {
    contadorEl.innerText = `⏳ Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-yellow-500 text-[#0A2342] animate-pulse";
    alertaProximo.classList.remove('hidden');
    cargarDestinos();

  } else {
    contadorEl.innerText = `✅ Activo (${diffDays} días)`;
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-green-500 text-white";
    cargarDestinos();
  }
}

document.getElementById('btnLogout').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); mostrarNotificacion("👋 Sesión cerrada.", "info"); setTimeout(() => location.reload(), 1000); });

window.simularPago = async (plan) => {
  mostrarNotificacion("Procesando pago...", "info");
  try {
    const res = await fetch('/api/simular-pago-exitoso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan }) });
    const data = await res.json();
    if (res.ok) {
      mostrarNotificacion(`¡Plan ${plan} activado! Recargando...`, "exito");
      setTimeout(() => location.reload(), 2000);
    } else { mostrarNotificacion("Error al activar plan", "error"); }
  } catch (err) { mostrarNotificacion("Error de conexión", "error"); }
};

document.getElementById('btnCancelarSub').addEventListener('click', async () => {
  if (!confirm("¿Cancelar suscripción?")) return;
  mostrarNotificacion("Procesando...", "info");
  try {
    const res = await fetch('/api/cancelar-suscripcion', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) { mostrarNotificacion("😢 Cancelado. ¡Gracias!", "advertencia"); setTimeout(async () => { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); location.reload(); }, 3000); } 
    else { mostrarNotificacion("❌ Error: " + data.error, "error"); }
  } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); }
});

document.getElementById('btnPromo').addEventListener('click', async () => { const codigo = document.getElementById('promo').value; if (!codigo) return mostrarNotificacion("⚠️ Escribí un código.", "advertencia"); const msg = document.getElementById('promoMessage'); const res = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) }); const data = await res.json(); if (data.valido) { mostrarNotificacion(" " + data.mensaje, "exito"); msg.className = "hidden"; } else { mostrarNotificacion("❌ " + data.mensaje, "error"); msg.className = "hidden"; } });

// FUNCIONES DE LA APP
async function cargarDestinos() { if (estaVencido) return; try { const res = await fetch('/api/destinos', { credentials: 'include' }); destinos = await res.json(); renderLista(); } catch (err) { console.error('Error cargando destinos:', err); } }

document.getElementById('fileImg').addEventListener('change', async (e) => {
  if (estaVencido) { mostrarNotificacion("️ Plan vencido. Renová para usar IA.", "advertencia"); e.target.value = ''; return; }
  const file = e.target.files[0]; if (!file) return;
  const btn = document.getElementById('btnCargar'); const textoOriginal = btn.innerText;
  btn.innerText = "🤖 La IA está leyendo..."; btn.disabled = true; btn.classList.add('opacity-75', 'cursor-not-allowed');
  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js no cargó.');
    const { data: { text } } = await Tesseract.recognize(file, 'spa', { logger: m => console.log(m) });
    const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (lineas.length === 0) mostrarNotificacion("⚠️ No se detectó texto claro.", "advertencia");
    else { destinosDetectados = lineas; mostrarModalEdicion(); }
  } catch (error) { console.error(error); mostrarNotificacion("❌ Error al procesar imagen.", "error"); } 
  finally { btn.innerText = textoOriginal; btn.disabled = false; btn.classList.remove('opacity-75', 'cursor-not-allowed'); e.target.value = ''; }
});

function mostrarModalEdicion() { const contenedor = document.getElementById('contenedorInputs'); contenedor.innerHTML = ''; if (destinosDetectados.length === 0) contenedor.innerHTML = '<p class="text-center text-gray-500 py-4">Sin direcciones.</p>'; else { destinosDetectados.forEach((dir, index) => { contenedor.innerHTML += `<div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200"><span class="text-gray-400 font-bold text-sm w-6">${index + 1}.</span><input type="text" value="${dir.replace(/"/g, '&quot;')}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm text-gray-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5BA4D9] rounded"><button onclick="eliminarLinea(${index})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all">🗑️</button></div>`; }); } document.getElementById('modalEdicion').classList.remove('hidden'); }
window.eliminarLinea = (index) => { destinosDetectados.splice(index, 1); mostrarModalEdicion(); };

document.getElementById('btnGuardarEdicion').addEventListener('click', async () => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia");
  const inputs = document.querySelectorAll('.input-direccion'); const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
  if (finales.length === 0) return mostrarNotificacion("⚠️ Sin direcciones válidas.", "advertencia");
  const btn = document.getElementById('btnGuardarEdicion'); btn.innerText = "Guardando..."; btn.disabled = true;
  for (const d of finales) await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion: d }) });
  btn.innerText = "✅ Guardar Todo"; btn.disabled = false; document.getElementById('modalEdicion').classList.add('hidden');
  mostrarNotificacion(" Direcciones guardadas.", "exito"); await cargarDestinos();
});

document.getElementById('btnCancelarEdicion').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
document.getElementById('btnCerrarModal').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

function renderLista() { const lista = document.getElementById('lista'); lista.innerHTML = ""; if (destinos.length === 0) { lista.innerHTML = '<li class="text-center text-gray-400 py-4">No hay destinos. Cargá una foto.</li>'; document.getElementById('btnViaje').classList.add('hidden'); document.getElementById('count').innerText = 0; return; } destinos.forEach((dir, i) => { setTimeout(() => { lista.innerHTML += `<li class="flex gap-2 border-b py-2 items-center"><span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"></span><div class="flex-1"><b>${dir.direccion}</b><br><span class="text-xs text-green-600">${dir.distancia} km • ~${dir.tiempo} min</span></div><button onclick="borrarDestino(${dir.id})" class="text-red-500 text-xs px-2 hover:bg-red-50 rounded">🗑️</button></li>`; }, i * 80); }); document.getElementById('count').innerText = destinos.length; document.getElementById('btnViaje').classList.remove('hidden'); inicioViaje = inicioViaje || new Date(); }
window.borrarDestino = async (id) => { if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia"); await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' }); mostrarNotificacion("️ Destino eliminado.", "info"); await cargarDestinos(); };

function limpiarDireccion(direccion) { let limpia = direccion.replace(/^\d+\.\s*/, '').replace(/\[GR\]\s*/i, '').replace(/General\s+Rodríguez\s*,?\s*/gi, '').trim(); if (!/General\s+Rodríguez/i.test(limpia)) limpia += ', General Rodríguez, Buenos Aires'; return limpia; }

document.getElementById('btnViaje').addEventListener('click', () => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido. Renová para viajar.", "advertencia");
  const tramo = destinos.slice(tramoActual, tramoActual + 10);
  if (tramo.length === 0) { document.getElementById('stats').classList.remove('hidden'); document.getElementById('statHoras').innerText = ((new Date() - inicioViaje) / 3600000).toFixed(1); document.getElementById('statKm').innerText = (tramoActual * 0.9).toFixed(1); document.getElementById('statEntregas').innerText = tramoActual; return; }
  const origin = "General Rodriguez, Buenos Aires, Argentina";
  const direccionesLimpias = tramo.map(d => limpiarDireccion(d.direccion));
  let url = '';
  if (direccionesLimpias.length === 1) url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(direccionesLimpias[0])}&travelmode=driving`;
  else { const destination = direccionesLimpias[direccionesLimpias.length - 1]; const waypoints = direccionesLimpias.slice(0, -1).map(d => encodeURIComponent(d)).join('|'); url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}&travelmode=driving`; }
  mostrarNotificacion("🗺️ Abriendo Google Maps...", "info"); window.open(url, "_blank");
  tramoActual += 10; const siguiente = tramoActual + 10;
  document.getElementById('btnViaje').innerText = tramoActual < destinos.length ? `SIGUIENTE TRAMO (${tramoActual + 1} a ${Math.min(siguiente, destinos.length)})` : "🏆 VER ESTADISTICAS FINALES";
});

async function abrirCamara() {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia");
  const video = document.getElementById('camara'); video.classList.remove('hidden');
  try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); video.srcObject = stream; } 
  catch (err) { mostrarNotificacion("📷 No se pudo acceder a la cámara.", "error"); }
}
