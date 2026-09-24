const CONFIG_RUTAFLEX = {
  whatsapp: "5491123793596",
  alias: "RUTAFLEX.MP",
  linkSemanal: "https://mpago.la/2DjaHdB",
  linkMensual: "https://mpago.la/2aNpJ1B"
};

let destinos = [];
let destinosDetectados = [];
let inicioViaje = null;
let tramoActual = 0;
let emailRecuperacion = "";
let estaVencido = false;

// --- UTILIDADES ---
window.togglePass = (id, icon) => {
  const i = document.getElementById(id);
  if (!i) return;
  i.type = i.type === "password" ? "text" : "password";
  icon.innerText = i.type === "text" ? "🙈" : "👁️";
};

function mostrarNotificacion(m, t = 'info') {
  const c = document.getElementById('notificaciones');
  if (!c) return;
  const n = document.createElement('div');
  n.className = `${t === 'exito' ? 'bg-green-600' : t === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center border toast-anim`;
  n.innerText = m;
  c.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

function ocultarTodasLasPantallasExcepto(id) {
  ['authScreen', 'recoverStep1', 'recoverStep2', 'recoverStep3', 'appScreen', 'perfilScreen', 'payment-modal'].forEach(s => {
    document.getElementById(s)?.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
}

// --- PAGOS ---
window.abrirModalPagos = (plan, precio) => {
  document.getElementById('modal-plan-texto').innerText = `Plan ${plan} - $${precio}`;
  document.getElementById('modal-alias-texto').innerText = CONFIG_RUTAFLEX.alias;
  document.getElementById('btn-wsp-pago').href = `https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;
  document.getElementById('btn-mp-pago').href = plan === 'Semanal' ? CONFIG_RUTAFLEX.linkSemanal : CONFIG_RUTAFLEX.linkMensual;
  document.getElementById('payment-modal').classList.remove('hidden');
};

window.cerrarModalPagos = () => document.getElementById('payment-modal').classList.add('hidden');

window.copiarAlias = () => {
  navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(() => mostrarNotificacion("✅ Alias copiado", "exito"));
};

// --- INICIO Y SESIÓN ---
window.addEventListener('load', async () => {
  const e = localStorage.getItem('rutaflex_email');
  if (e && document.getElementById('loginEmail')) document.getElementById('loginEmail').value = e;
  try {
    const r = await fetch('/api/yo', { credentials: 'include' });
    const d = await r.json();
    if (d.ok) mostrarApp(d.nombre, d.fecha_vencimiento);
  } catch {}
});

async function hacerLogout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  localStorage.removeItem('rutaflex_email');
  location.reload();
}

// --- EVENT LISTENERS DE AUTH ---
document.getElementById('tabLogin')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('authScreen');
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
});

document.getElementById('tabRegistro')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('authScreen');
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
});

document.getElementById('btnOlvideContrasena')?.addEventListener('click', () => ocultarTodasLasPantallasExcepto('recoverStep1'));
document.getElementById('btnVolverLogin1')?.addEventListener('click', () => ocultarTodasLasPantallasExcepto('authScreen'));

document.getElementById('btnReenviarCodigo')?.addEventListener('click', async () => {
  const email = document.getElementById('recoverEmailInput').value;
  if (!email) return;
  await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  emailRecuperacion = email;
  ocultarTodasLasPantallasExcepto('recoverStep2');
});

document.getElementById('formRecoverEmail')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('recoverEmailInput').value;
  await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  emailRecuperacion = email;
  ocultarTodasLasPantallasExcepto('recoverStep2');
});

document.getElementById('formRecoverCode')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('recoverCodeInput').value;
  const r = await fetch('/api/verificar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, codigo }) });
  if (r.ok) ocultarTodasLasPantallasExcepto('recoverStep3');
});

document.getElementById('formNewPassword')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nuevaPassword = document.getElementById('newPasswordInput').value;
  const r = await fetch('/api/cambiar-contrasena-final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, nuevaPassword }) });
  if (r.ok) {
    mostrarNotificacion("✅ Contraseña cambiada", "exito");
    ocultarTodasLasPantallasExcepto('authScreen');
  }
});

document.getElementById('formRegistro')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const r = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) });
  const d = await r.json();
  if (r.ok) {
    localStorage.setItem('rutaflex_email', email);
    mostrarApp(d.usuario.nombre, d.usuario.fecha_vencimiento);
  } else {
    document.getElementById('authMessage').innerText = d.error;
  }
});

document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('authMessage');
  msg.innerText = "Conectando...";
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
  const d = await r.json();
  if (r.ok) {
    localStorage.setItem('rutaflex_email', email);
    mostrarApp(d.usuario.nombre, d.usuario.fecha_vencimiento);
  } else {
    msg.innerText = d.error || "Error";
  }
});

document.getElementById('btnLogoutDropdown')?.addEventListener('click', hacerLogout);
document.getElementById('btnLogoutPerfil')?.addEventListener('click', hacerLogout);

document.getElementById('btnPromo')?.addEventListener('click', async () => {
  const codigo = document.getElementById('promo').value;
  if (!codigo) return;
  const r = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) });
  const d = await r.json();
  mostrarNotificacion(d.mensaje, d.valido ? 'exito' : 'error');
});

// --- LÓGICA DE LA APP ---
function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  document.getElementById('userName').innerText = `¡Hola, ${nombre}! 👋`;
  const contadorEl = document.getElementById('contadorDias');
  const banner = document.getElementById('bannerVencido');
  const alerta = document.getElementById('alertaProximoVencimiento');
  const seccion = document.getElementById('seccionDestinos');
  const listaC = document.getElementById('listaContainer');
  
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  
  banner.classList.add('hidden');
  if (alerta) alerta.classList.add('hidden');
  seccion.style.pointerEvents = "auto"; seccion.style.filter = "none";
  listaC.style.pointerEvents = "auto"; listaC.style.filter = "none";
  estaVencido = false;

  if (!fechaVencimiento || diff <= 0) {
    estaVencido = true;
    contadorEl.innerText = "⚠️ VENCIDO";
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-red-600 text-white";
    banner.classList.remove('hidden');
    seccion.style.pointerEvents = "none"; seccion.style.filter = "grayscale(0.3) opacity(0.85)";
    listaC.style.pointerEvents = "none"; listaC.style.filter = "grayscale(0.3) opacity(0.85)";
    document.getElementById('lista').innerHTML = '';
    document.getElementById('count').innerText = '0';
    document.getElementById('btnViaje').classList.add('hidden');
  } else if (diff <= 1) {
    contadorEl.innerText = `⏳ Vence en ${diff} día`;
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-yellow-500 text-[#0A2342] animate-pulse";
    if (alerta) alerta.classList.remove('hidden');
    cargarDestinos();
  } else {
    contadorEl.innerText = `✅ Activo (${diff} días)`;
    contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-green-500 text-white";
    cargarDestinos();
  }
}

async function cargarDestinos() {
  if (estaVencido) return;
  try {
    const r = await fetch('/api/destinos', { credentials: 'include' });
    destinos = await r.json();
    renderLista();
  } catch {}
}

document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "advertencia");
  const file = e.target.files[0];
  if (!file) return;
  const btn = document.getElementById('btnCargar');
  const t = btn.innerText;
  btn.innerText = "🤖 Leyendo...";
  btn.disabled = true;
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    destinosDetectados = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (destinosDetectados.length > 0) mostrarModalEdicion();
    else mostrarNotificacion("⚠️ No se detectó texto", "advertencia");
  } catch {
    mostrarNotificacion("❌ Error", "error");
  } finally {
    btn.innerText = t;
    btn.disabled = false;
    e.target.value = '';
  }
});

function mostrarModalEdicion() {
  const c = document.getElementById('contenedorInputs');
  if (!c) return;
  c.innerHTML = '';
  destinosDetectados.forEach((dir, i) => {
    c.innerHTML += `<div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border"><span class="text-gray-400 font-bold w-6">${i + 1}.</span><input type="text" value="${dir.replace(/"/g, '&quot;')}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm"><button onclick="eliminarLinea(${i})" class="text-red-500 p-2">🗑️</button></div>`;
  });
  document.getElementById('modalEdicion').classList.remove('hidden');
}

window.eliminarLinea = i => {
  destinosDetectados.splice(i, 1);
  mostrarModalEdicion();
};

document.getElementById('btnGuardarEdicion')?.addEventListener('click', async () => {
  const inputs = document.querySelectorAll('.input-direccion');
  const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v);
  if (finales.length === 0) return;
  const btn = document.getElementById('btnGuardarEdicion');
  btn.innerText = "Guardando...";
  btn.disabled = true;
  for (const d of finales) {
    await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion: d }) });
  }
  btn.innerText = "✅ Guardar Todo";
  btn.disabled = false;
  document.getElementById('modalEdicion').classList.add('hidden');
  cargarDestinos();
});

document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
document.getElementById('btnCerrarModal')?.addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

function renderLista() {
  const l = document.getElementById('lista');
  const ph = document.getElementById('placeholderVacio');
  if (!l) return;
  l.innerHTML = "";
  if (destinos.length === 0) {
    ph.style.display = 'block';
    document.getElementById('count').innerText = 0;
    document.getElementById('btnViaje').classList.add('hidden');
    return;
  }
  ph.style.display = 'none';
  destinos.forEach((d, i) => {
    l.innerHTML += `<li class="flex gap-2 border-b py-2 items-center bg-white/50 p-2 rounded-lg"><span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">${i + 1}</span><div class="flex-1"><b class="block truncate">${d.direccion}</b><span class="text-xs text-green-600">${d.distancia || 0} km</span></div><button onclick="borrarDestino('${d._id}')" class="text-red-500 text-xs">🗑️</button></li>`;
  });
  document.getElementById('count').innerText = destinos.length;
  document.getElementById('btnViaje').classList.remove('hidden');
}

window.borrarDestino = async (id) => {
  await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' });
  cargarDestinos();
};

async function abrirCamara() {
  const v = document.getElementById('camara');
  if (!v) return;
  v.classList.remove('hidden');
  try {
    v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch {
    mostrarNotificacion("📷 Error cámara", "error");
  }
}

// --- MENÚ LOGO + PERFIL ---
const logoMenuBtn = document.getElementById('logoMenuBtn');
const logoDropdown = document.getElementById('logoDropdown');

logoMenuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  logoDropdown.classList.toggle('hidden');
  logoDropdown.classList.toggle('flex');
});

document.addEventListener('click', (e) => {
  if (logoDropdown && !logoDropdown.contains(e.target) && !logoMenuBtn.contains(e.target)) {
    logoDropdown.classList.add('hidden');
    logoDropdown.classList.remove('flex');
  }
});

document.getElementById('btnIrPerfil')?.addEventListener('click', () => {
  logoDropdown.classList.add('hidden');
  logoDropdown.classList.remove('flex');
  mostrarPerfil();
});

function mostrarPerfil() {
  ocultarTodasLasPantallasExcepto('perfilScreen');
  const email = localStorage.getItem('rutaflex_email') || 'usuario@rutaflex.com';
  const nombre = email.split('@')[0];
  document.getElementById('perfilNombre').innerText = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  document.getElementById('perfilEmail').innerText = email;
  
  const estadoEl = document.getElementById('perfilEstado');
  const avatarEl = document.getElementById('perfilAvatarWrapper');
  const btnR = document.getElementById('btnRenovarPerfil');
  
  if (estaVencido) {
    estadoEl.innerText = "⚠️ VENCIDO";
    estadoEl.className = "inline-block mt-4 px-5 py-1.5 rounded-full text-[12px] font-black bg-[#ff3b30] text-white shadow-[0_0_15px_rgba(255,59,48,0.5)] animate-pulse";
    avatarEl.style.borderColor = "rgba(255,59,48,0.7)";
    avatarEl.style.boxShadow = "0 0 0 6px rgba(255,59,48,0.15)";
    btnR.classList.remove('hidden');
  } else {
    estadoEl.innerText = "✅ ACTIVO";
    estadoEl.className = "inline-block mt-4 px-5 py-1.5 rounded-full text-[12px] font-black bg-green-500 text-white";
    avatarEl.style.borderColor = "rgba(255,255,255,0.2)";
    avatarEl.style.boxShadow = "none";
    btnR.classList.add('hidden');
  }
}

document.getElementById('btnVolverDePerfil')?.addEventListener('click', () => ocultarTodasLasPantallasExcepto('appScreen'));
document.getElementById('btnRenovarPerfil')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('appScreen');
  document.getElementById('bannerVencido')?.scrollIntoView({ behavior: 'smooth' });
});

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
  });
}
