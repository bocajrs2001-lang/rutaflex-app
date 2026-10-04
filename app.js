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
  icon.innerText = i.type === "text" ? "🙈" : "️";
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
    console.log('📍 Destinos cargados:', destinos);
    renderLista();
  } catch (err) {
    console.error('Error cargando destinos:', err);
    mostrarNotificacion("❌ Error al cargar destinos", "error");
  }
}

// --- OCR MEJORADO ---
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "advertencia");
  const file = e.target.files[0];
  if (!file) return;
  
  const btn = document.getElementById('btnCargar');
  const textoOriginal = btn.innerText;
  
  btn.innerText = "🤖 Leyendo imagen...";
  btn.disabled = true;
  btn.classList.add('opacity-75');
  
  try {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract no está cargado');
    }
    
    mostrarNotificacion("🔍 Procesando imagen...", "info");
    
    const { data: { text, confidence } } = await Tesseract.recognize(file, 'spa', {
      logger: m => console.log(m)
    });
    
    console.log('📝 Texto detectado:', text);
    console.log('📊 Confianza:', confidence);
    
    if (confidence < 50) {
      mostrarNotificacion("️ Baja calidad de imagen. Intentá con otra foto.", "advertencia");
    }
    
    // Limpiar y filtrar líneas de texto
    const lineas = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && !l.match(/^\d+\.?\s*$/)) // Filtrar solo números
      .filter(l => !l.match(/^(imagen|foto|qr|cámara)/i)); // Filtrar palabras de la UI
    
    console.log('📋 Líneas filtradas:', lineas);
    
    if (lineas.length === 0) {
      mostrarNotificacion("⚠️ No se detectaron direcciones. Intentá: 1) Mejor luz 2) Foto más clara 3) Texto más grande", "advertencia");
      return;
    }
    
    destinosDetectados = lineas;
    mostrarNotificacion(`✅ Se detectaron ${lineas.length} direcciones`, "exito");
    mostrarModalEdicion();
    
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    mostrarNotificacion("❌ Error al procesar: " + error.message, "error");
  } finally {
    btn.innerText = textoOriginal;
    btn.disabled = false;
    btn.classList.remove('opacity-75');
    e.target.value = '';
  }
});

function mostrarModalEdicion() {
  const c = document.getElementById('contenedorInputs');
  if (!c) return;
  c.innerHTML = '';
  
  if (destinosDetectados.length === 0) {
    c.innerHTML = '<p class="text-center text-gray-500 py-4">Sin direcciones detectadas</p>';
  } else {
    destinosDetectados.forEach((dir, i) => {
      c.innerHTML += `
        <div class="flex gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
          <span class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">${i + 1}</span>
          <input type="text" value="${dir.replace(/"/g, '&quot;')}" class="input-direccion flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Dirección ${i + 1}">
          <button onclick="eliminarLinea(${i})" class="text-red-500 hover:bg-red-50 p-2 rounded transition-colors">🗑️</button>
        </div>
      `;
    });
  }
  
  const modal = document.getElementById('modalEdicion');
  if (modal) modal.classList.remove('hidden');
}

window.eliminarLinea = i => {
  destinosDetectados.splice(i, 1);
  mostrarModalEdicion();
};

document.getElementById('btnGuardarEdicion')?.addEventListener('click', async () => {
  const inputs = document.querySelectorAll('.input-direccion');
  const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 3);
  
  if (finales.length === 0) {
    mostrarNotificacion("️ Ingresá al menos una dirección válida", "advertencia");
    return;
  }
  
  const btn = document.getElementById('btnGuardarEdicion');
  const textoOriginal = btn.innerText;
  btn.innerText = "💾 Guardando...";
  btn.disabled = true;
  
  try {
    let guardados = 0;
    for (const direccion of finales) {
      const r = await fetch('/api/destinos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ direccion })
      });
      
      if (r.ok) guardados++;
    }
    
    mostrarNotificacion(`✅ ${guardados} direcciones guardadas`, "exito");
    document.getElementById('modalEdicion').classList.add('hidden');
    await cargarDestinos();
    
  } catch (error) {
    console.error('Error guardando:', error);
    mostrarNotificacion("❌ Error al guardar", "error");
  } finally {
    btn.innerText = textoOriginal;
    btn.disabled = false;
  }
});

document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => {
  document.getElementById('modalEdicion').classList.add('hidden');
  destinosDetectados = [];
});

document.getElementById('btnCerrarModal')?.addEventListener('click', () => {
  document.getElementById('modalEdicion').classList.add('hidden');
  destinosDetectados = [];
});

function renderLista() {
  const l = document.getElementById('lista');
  const ph = document.getElementById('placeholderVacio');
  if (!l) return;
  
  l.innerHTML = "";
  
  if (destinos.length === 0) {
    ph.style.display = 'flex';
    document.getElementById('count').innerText = 0;
    document.getElementById('btnViaje').classList.add('hidden');
    return;
  }
  
  ph.style.display = 'none';
  
  destinos.forEach((d, i) => {
    // Verificar si la dirección existe
    const direccionTexto = d.direccion || d.dirección || 'Sin dirección';
    const distancia = d.distancia || 0;
    const tiempo = d.tiempo || 0;
    
    l.innerHTML += `
      <li class="flex gap-3 border-b border-gray-100 py-3 items-center bg-white/50 p-3 rounded-lg hover:bg-blue-50/50 transition-colors">
        <span class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">${i + 1}</span>
        <div class="flex-1 min-w-0">
          <b class="block truncate text-[#0A2342] font-semibold">${direccionTexto}</b>
          <span class="text-xs text-green-600 font-medium">${distancia} km • ~${tiempo} min</span>
        </div>
        <button onclick="borrarDestino('${d._id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition-colors flex-shrink-0">🗑️</button>
      </li>
    `;
  });
  
  document.getElementById('count').innerText = destinos.length;
  document.getElementById('btnViaje').classList.remove('hidden');
}

window.borrarDestino = async (id) => {
  if (!confirm('¿Eliminar esta dirección?')) return;
  
  try {
    await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' });
    mostrarNotificacion("🗑️ Dirección eliminada", "info");
    await cargarDestinos();
  } catch (error) {
    console.error('Error eliminando:', error);
    mostrarNotificacion("❌ Error al eliminar", "error");
  }
};

async function abrirCamara() {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "advertencia");
  
  const v = document.getElementById('camara');
  if (!v) return;
  
  v.classList.remove('hidden');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
    });
    v.srcObject = stream;
    mostrarNotificacion("📸 Cámara activa. Sacá una foto clara del texto.", "info");
  } catch (error) {
    console.error('Error cámara:', error);
    mostrarNotificacion(" Error: No se pudo acceder a la cámara", "error");
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
