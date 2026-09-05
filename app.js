// ==========================================
// VARIABLES GLOBALES Y ESTADO
// ==========================================
let destinos = [];
let destinosDetectados = [];
let inicioViaje = null;
let tramoActual = 0;
let emailRecuperacion = ""; 
let estaVencido = false;

// ==========================================
// UTILIDADES UI (Notificaciones y Ojito)
// ==========================================

// Función para mostrar/ocultar contraseña
window.togglePass = (inputId, icon) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    icon.innerText = "🙈"; // Mono tapándose los ojos
  } else {
    input.type = "password";
    icon.innerText = "👁️"; // Ojo normal
  }
};

// Sistema de notificaciones flotantes centradas
function mostrarNotificacion(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('notificaciones');
  const notificacion = document.createElement('div');
  
  let colores = 'bg-blue-600 text-white border-blue-500';
  if (tipo === 'exito') colores = 'bg-green-600 text-white border-green-500';
  if (tipo === 'error') colores = 'bg-red-600 text-white border-red-500';
  if (tipo === 'advertencia') colores = 'bg-yellow-400 text-black border-yellow-300';

  notificacion.className = `${colores} px-6 py-3 rounded-xl shadow-2xl font-bold text-sm text-center toast-anim pointer-events-auto border`;
  notificacion.innerText = mensaje;
  
  contenedor.appendChild(notificacion);
  
  // Animación de salida
  setTimeout(() => { 
    notificacion.style.opacity = '0'; 
    notificacion.style.transform = 'translate(-50%, -20px)'; 
    notificacion.style.transition = 'all 0.5s ease'; 
    setTimeout(() => notificacion.remove(), 500); 
  }, 4000);
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.addEventListener('load', async () => {
  // Recuperar email guardado si existe
  const emailGuardado = localStorage.getItem('rutaflex_email');
  if (emailGuardado && document.getElementById('loginEmail')) {
    document.getElementById('loginEmail').value = emailGuardado;
  }

  // Verificar sesión activa al cargar
  try {
    const res = await fetch('/api/yo', { credentials: 'include' });
    const data = await res.json();
    if (data.ok) {
      mostrarApp(data.nombre, data.fecha_vencimiento);
    }
  } catch (err) { 
    console.log('No hay sesión activa o error de conexión inicial'); 
  }
});

// ==========================================
// NAVEGACIÓN Y PANTALLAS
// ==========================================
function ocultarTodasLasPantallasExcepto(id) { 
  ['authScreen', 'recoverStep1', 'recoverStep2', 'recoverStep3', 'appScreen'].forEach(s => {
    const el = document.getElementById(s);
    if(el) el.classList.add('hidden');
  }); 
  const target = document.getElementById(id);
  if(target) target.classList.remove('hidden');
}

// Tabs Login / Registro
if(document.getElementById('tabLogin')) {
  document.getElementById('tabLogin').addEventListener('click', () => { 
    ocultarTodasLasPantallasExcepto('authScreen'); 
    document.getElementById('formLogin').classList.remove('hidden'); 
    document.getElementById('formRegistro').classList.add('hidden'); 
    document.getElementById('tabLogin').className = "flex-1 py-2 px-4 rounded-xl font-bold text-accent bg-white/10 transition-all";
    document.getElementById('tabRegistro').className = "flex-1 py-2 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
    document.getElementById('authMessage').innerText = ''; 
  });
}

if(document.getElementById('tabRegistro')) {
  document.getElementById('tabRegistro').addEventListener('click', () => { 
    ocultarTodasLasPantallasExcepto('authScreen'); 
    document.getElementById('formRegistro').classList.remove('hidden'); 
    document.getElementById('formLogin').classList.add('hidden'); 
    document.getElementById('tabRegistro').className = "flex-1 py-2 px-4 rounded-xl font-bold text-accent bg-white/10 transition-all";
    document.getElementById('tabLogin').className = "flex-1 py-2 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
    document.getElementById('authMessage').innerText = ''; 
  });
}

// Recuperación de contraseña
if(document.getElementById('btnOlvideContrasena')) {
  document.getElementById('btnOlvideContrasena').addEventListener('click', () => { 
    ocultarTodasLasPantallasExcepto('recoverStep1'); 
    if(document.getElementById('recoverEmailInput')) document.getElementById('recoverEmailInput').value = document.getElementById('loginEmail').value || ''; 
    if(document.getElementById('recoverMsg1')) document.getElementById('recoverMsg1').innerText = ''; 
  });
}

if(document.getElementById('btnVolverLogin1')) {
  document.getElementById('btnVolverLogin1').addEventListener('click', () => ocultarTodasLasPantallasExcepto('authScreen'));
}

if(document.getElementById('btnReenviarCodigo')) {
  document.getElementById('btnReenviarCodigo').addEventListener('click', enviarCodigoRecuperacion);
}

// ==========================================
// LÓGICA DE RECUPERACIÓN
// ==========================================
async function enviarCodigoRecuperacion() { 
  const emailInput = document.getElementById('recoverEmailInput');
  const msg = document.getElementById('recoverMsg1');
  if(!emailInput || !msg) return;

  const email = emailInput.value; 
  if (!email) { msg.innerText = "Ingresá tu email"; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; return; } 
  
  msg.innerText = "Enviando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
  
  try { 
    const res = await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); 
    const data = await res.json(); 
    if (res.ok) { 
      emailRecuperacion = email; 
      mostrarNotificacion("📧 Código enviado", "exito"); 
      ocultarTodasLasPantallasExcepto('recoverStep2'); 
      if(document.getElementById('recoverMsg2')) document.getElementById('recoverMsg2').innerText = ''; 
    } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
  } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } 
}

if(document.getElementById('formRecoverEmail')) {
  document.getElementById('formRecoverEmail').addEventListener('submit', async (e) => { e.preventDefault(); await enviarCodigoRecuperacion(); });
}

if(document.getElementById('formRecoverCode')) {
  document.getElementById('formRecoverCode').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const codigo = document.getElementById('recoverCodeInput').value; 
    const msg = document.getElementById('recoverMsg2'); 
    msg.innerText = "Verificando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
    try { 
      const res = await fetch('/api/verificar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, codigo }) }); 
      const data = await res.json(); 
      if (res.ok) { 
        mostrarNotificacion("✅ Código correcto", "exito"); 
        ocultarTodasLasPantallasExcepto('recoverStep3'); 
        if(document.getElementById('recoverMsg3')) document.getElementById('recoverMsg3').innerText = ''; 
      } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
    } catch (err) { mostrarNotificacion("❌ Error", "error"); } 
  });
}

if(document.getElementById('formNewPassword')) {
  document.getElementById('formNewPassword').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const nuevaPassword = document.getElementById('newPasswordInput').value; 
    const msg = document.getElementById('recoverMsg3'); 
    msg.innerText = "Guardando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
    try { 
      const res = await fetch('/api/cambiar-contrasena-final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, nuevaPassword }) }); 
      const data = await res.json(); 
      if (res.ok) { 
        mostrarNotificacion("¡Contraseña cambiada!", "exito"); 
        setTimeout(() => { 
          ocultarTodasLasPantallasExcepto('authScreen'); 
          if(document.getElementById('loginEmail')) document.getElementById('loginEmail').value = emailRecuperacion; 
          if(document.getElementById('loginPassword')) document.getElementById('loginPassword').value = ''; 
          emailRecuperacion = ""; 
        }, 2000); 
      } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
    } catch (err) { mostrarNotificacion(" Error", "error"); } 
  });
}

// ==========================================
// AUTENTICACIÓN (LOGIN / REGISTRO)
// ==========================================

// Registro
if(document.getElementById('formRegistro')) {
  document.getElementById('formRegistro').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const nombre = document.getElementById('regNombre').value; 
    const email = document.getElementById('regEmail').value; 
    const password = document.getElementById('regPassword').value; 
    const msg = document.getElementById('authMessage'); 
    
    msg.innerText = "Creando cuenta..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
    
    try { 
      const res = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) }); 
      const data = await res.json(); 
      if (res.ok) { 
        localStorage.setItem('rutaflex_email', email); 
        mostrarNotificacion("✅ ¡Cuenta creada!", "exito"); 
        setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000); 
      } else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
    } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } 
  });
}

// Login con Timeout para Render Free Tier
if(document.getElementById('formLogin')) {
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('authMessage');
    
    msg.innerText = "Conectando con el servidor...";
    msg.className = "text-center text-sm mt-4 font-bold text-blue-300";
    
    // Timeout de 15 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );
    
    try {
      const res = await Promise.race([
        fetch('/api/login', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          credentials: 'include', 
          body: JSON.stringify({ email, password }) 
        }),
        timeoutPromise
      ]);
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('rutaflex_email', email);
        mostrarNotificacion(`👋 ¡Bienvenido, ${data.usuario.nombre}!`, "exito");
        setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000);
      } else { 
        msg.innerText = data.error || "Email o contraseña incorrectos"; 
        msg.className = "text-center text-sm mt-4 font-bold text-red-300"; 
      }
    } catch (err) { 
      console.error("Error de login:", err);
      if (err.message === 'TIMEOUT') {
        msg.innerText = "⏳ El servidor está despertando (tarda ~40 seg). Esperá un momento y volvé a intentar.";
        msg.className = "text-center text-sm mt-4 font-bold text-yellow-300";
      } else {
        msg.innerText = "❌ Error de conexión. Verificá tu internet.";
        msg.className = "text-center text-sm mt-4 font-bold text-red-300";
      }
    }
  });
}

// Logout
if(document.getElementById('btnLogout')) {
  document.getElementById('btnLogout').addEventListener('click', async () => { 
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }); 
    mostrarNotificacion(" Sesión cerrada.", "info"); 
    setTimeout(() => location.reload(), 1000); 
  });
}

// Cancelar Suscripción (CORREGIDO: No hace logout, solo actualiza estado)
if(document.getElementById('btnCancelarSub')) {
  document.getElementById('btnCancelarSub').addEventListener('click', async () => {
    if (!confirm("¿Estás seguro que querés cancelar tu plan? Perderás el acceso premium inmediatamente pero podrás seguir usando la app en modo básico.")) return;
    
    mostrarNotificacion("Procesando cancelación...", "info");
    
    try {
      const res = await fetch('/api/cancelar-suscripcion', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      
      if (res.ok) { 
        mostrarNotificacion("Plan cancelado. Podés volver a activarlo cuando quieras.", "advertencia"); 
        
        // Forzamos actualización visual a modo "Vencido" sin recargar ni desloguear
        setTimeout(() => {
           // Obtenemos el nombre actual del usuario si es posible, sino usamos genérico
           const nombreActual = document.getElementById('userName')?.innerText.replace('¡Hola, ', '').replace('! 👋', '') || "Usuario";
           mostrarApp(nombreActual, new Date(0)); // Fecha 0 = Vencido
        }, 1500);
        
      } else { 
        mostrarNotificacion("Error: " + data.error, "error"); 
      }
    } catch (err) { 
      mostrarNotificacion("Error de conexión al cancelar", "error"); 
    }
  });
}

// Promo Code
if(document.getElementById('btnPromo')) {
  document.getElementById('btnPromo').addEventListener('click', async () => { 
    const codigo = document.getElementById('promo').value; 
    if (!codigo) return mostrarNotificacion("⚠️ Escribí un código.", "advertencia"); 
    
    const msg = document.getElementById('promoMessage'); 
    const res = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) }); 
    const data = await res.json(); 
    
    if (data.valido) { 
      mostrarNotificacion("✨ " + data.mensaje, "exito"); 
      if(msg) msg.className = "hidden"; 
    } else { 
      mostrarNotificacion("❌ " + data.mensaje, "error"); 
      if(msg) msg.className = "hidden"; 
    } 
  });
}

// Simular Pago (Redirección a MP)
window.simularPago = async (plan) => {
  mostrarNotificacion("Generando link de pago seguro...", "info");
  try {
    const res = await fetch('/api/crear-preferencia-pago', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'include', 
      body: JSON.stringify({ plan }) 
    });
    const data = await res.json();
    if (res.ok && data.init_point) {
      mostrarNotificacion("Redirigiendo a Mercado Pago...", "info");
      window.location.href = data.init_point;
    } else {
      mostrarNotificacion("Error al generar link: " + (data.error || 'Desconocido'), "error");
    }
  } catch (err) { 
    mostrarNotificacion("Error de conexión con el servidor", "error"); 
  }
};

// ==========================================
// LÓGICA PRINCIPAL DE LA APP (DASHBOARD)
// ==========================================
function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  const userNameEl = document.getElementById('userName');
  if(userNameEl) userNameEl.innerText = `¡Hola, ${nombre}! 👋`;
  
  const contadorEl = document.getElementById('contadorDias');
  const bannerVencido = document.getElementById('bannerVencido');
  const alertaProximo = document.getElementById('alertaProximoVencimiento');
  const seccionDestinos = document.getElementById('seccionDestinos');
  const listaContainer = document.getElementById('listaContainer');
  
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diffTime = venc - hoy;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  // Resetear estados visuales
  if(bannerVencido) bannerVencido.classList.add('hidden');
  if(alertaProximo) alertaProximo.classList.add('hidden');
  if(seccionDestinos) {
    seccionDestinos.style.opacity = "1";
    seccionDestinos.style.pointerEvents = "auto";
  }
  if(listaContainer) {
    listaContainer.style.opacity = "1";
    listaContainer.style.pointerEvents = "auto";
  }
  estaVencido = false;

  if (!fechaVencimiento || diffDays <= 0) {
    // CASO VENCIDO
    estaVencido = true;
    if(contadorEl) {
      contadorEl.innerText = "⚠️ VENCIDO";
      contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-red-600 text-white";
    }
    if(bannerVencido) bannerVencido.classList.remove('hidden');
    
    if(seccionDestinos) {
      seccionDestinos.style.opacity = "0.3";
      seccionDestinos.style.pointerEvents = "none";
    }
    if(listaContainer) {
      listaContainer.style.opacity = "0.3";
      listaContainer.style.pointerEvents = "none";
    }
    
    const lista = document.getElementById('lista');
    if(lista) lista.innerHTML = '<li class="text-center text-red-500 py-4 font-bold">Renová tu plan para ver y usar tus destinos.</li>';
    const count = document.getElementById('count');
    if(count) count.innerText = "-";
    const btnViaje = document.getElementById('btnViaje');
    if(btnViaje) btnViaje.classList.add('hidden');
    
    mostrarNotificacion("Tu plan está vencido. Renová abajo 👇", "advertencia");

  } else if (diffDays <= 1) {
    // CASO POR VENCER
    if(contadorEl) {
      contadorEl.innerText = `⏳ Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
      contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-yellow-500 text-[#0A2342] animate-pulse";
    }
    if(alertaProximo) alertaProximo.classList.remove('hidden');
    cargarDestinos();

  } else {
    // CASO ACTIVO
    if(contadorEl) {
      contadorEl.innerText = `✅ Activo (${diffDays} días)`;
      contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-green-500 text-white";
    }
    cargarDestinos();
  }
}

// ==========================================
// GESTIÓN DE DESTINOS E IA
// ==========================================
async function cargarDestinos() { 
  if (estaVencido) return; 
  try { 
    const res = await fetch('/api/destinos', { credentials: 'include' }); 
    destinos = await res.json(); 
    renderLista(); 
  } catch (err) { console.error('Error cargando destinos:', err); } 
}

// Procesamiento de Imagen con Tesseract
if(document.getElementById('fileImg')) {
  document.getElementById('fileImg').addEventListener('change', async (e) => {
    if (estaVencido) { mostrarNotificacion("⚠️ Plan vencido. Renová para usar IA.", "advertencia"); e.target.value = ''; return; }
    const file = e.target.files[0]; if (!file) return;
    
    const btn = document.getElementById('btnCargar'); 
    const textoOriginal = btn ? btn.innerText : "";
    if(btn) {
        btn.innerText = "🤖 La IA está leyendo..."; 
        btn.disabled = true; 
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    }
    
    try {
      if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js no cargó.');
      const { data: { text } } = await Tesseract.recognize(file, 'spa', { logger: m => console.log(m) });
      const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      
      if (lineas.length === 0) mostrarNotificacion("️ No se detectó texto claro.", "advertencia");
      else { destinosDetectados = lineas; mostrarModalEdicion(); }
    } catch (error) { console.error(error); mostrarNotificacion(" Error al procesar imagen.", "error"); } 
    finally { 
        if(btn) {
            btn.innerText = textoOriginal; 
            btn.disabled = false; 
            btn.classList.remove('opacity-75', 'cursor-not-allowed'); 
        }
        e.target.value = ''; 
    }
  });
}

// Modal de Edición de Direcciones
function mostrarModalEdicion() { 
  const contenedor = document.getElementById('contenedorInputs'); 
  if(!contenedor) return;
  
  contenedor.innerHTML = ''; 
  if (destinosDetectados.length === 0) {
    contenedor.innerHTML = '<p class="text-center text-gray-500 py-4">Sin direcciones detectadas.</p>';
  } else { 
    destinosDetectados.forEach((dir, index) => { 
      contenedor.innerHTML += `<div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
        <span class="text-gray-400 font-bold text-sm w-6">${index + 1}.</span>
        <input type="text" value="${dir.replace(/"/g, '&quot;')}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm text-gray-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5BA4D9] rounded">
        <button onclick="eliminarLinea(${index})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all">🗑️</button>
      </div>`; 
    }); 
  } 
  const modal = document.getElementById('modalEdicion');
  if(modal) modal.classList.remove('hidden'); 
}

window.eliminarLinea = (index) => { destinosDetectados.splice(index, 1); mostrarModalEdicion(); };

// Guardar Direcciones Editadas
if(document.getElementById('btnGuardarEdicion')) {
  document.getElementById('btnGuardarEdicion').addEventListener('click', async () => {
    if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia");
    const inputs = document.querySelectorAll('.input-direccion'); 
    const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
    
    if (finales.length === 0) return mostrarNotificacion("⚠️ Sin direcciones válidas.", "advertencia");
    
    const btn = document.getElementById('btnGuardarEdicion'); 
    const originalText = btn.innerText;
    btn.innerText = "Guardando..."; btn.disabled = true;
    
    try {
        for (const d of finales) {
            await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion: d }) }); 
        }
        mostrarNotificacion("✨ Direcciones guardadas.", "exito"); 
        await cargarDestinos();
    } catch(err) {
        mostrarNotificacion("Error al guardar", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false; 
        const modal = document.getElementById('modalEdicion');
        if(modal) modal.classList.add('hidden');
    }
  });
}

// Cerrar Modal
if(document.getElementById('btnCancelarEdicion')) document.getElementById('btnCancelarEdicion').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
if(document.getElementById('btnCerrarModal')) document.getElementById('btnCerrarModal').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

// Renderizar Lista de Destinos
function renderLista() { 
  const lista = document.getElementById('lista'); 
  if(!lista) return;
  
  lista.innerHTML = ""; 
  if (destinos.length === 0) { 
    lista.innerHTML = '<li class="text-center text-gray-400 py-4">No hay destinos. Cargá una foto.</li>'; 
    const btnViaje = document.getElementById('btnViaje');
    if(btnViaje) btnViaje.classList.add('hidden'); 
    const count = document.getElementById('count');
    if(count) count.innerText = 0; 
    return; 
  } 
  
  destinos.forEach((dir, i) => { 
    setTimeout(() => { 
      lista.innerHTML += `<li class="flex gap-2 border-b py-2 items-center bg-white/50 p-2 rounded-lg">
        <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">🏠</span>
        <div class="flex-1 min-w-0"><b class="block truncate">${dir.direccion}</b><span class="text-xs text-green-600">${dir.distancia} km • ~${dir.tiempo} min</span></div>
        <button onclick="borrarDestino('${dir._id}')" class="text-red-500 text-xs px-2 hover:bg-red-50 rounded flex-shrink-0">🗑️</button>
      </li>`; 
    }, i * 50); 
  }); 
  
  const count = document.getElementById('count');
  if(count) count.innerText = destinos.length; 
  
  const btnViaje = document.getElementById('btnViaje');
  if(btnViaje) {
      btnViaje.classList.remove('hidden'); 
      inicioViaje = inicioViaje || new Date(); 
  }
}

// Borrar Destino Individual
window.borrarDestino = async (id) => { 
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia"); 
  await fetch(`/api/destinos/${id}`, { method: 'DELETE', credentials: 'include' }); 
  mostrarNotificacion("🗑️ Destino eliminado.", "info"); 
  await cargarDestinos(); 
};

// Limpiar dirección para Google Maps
function limpiarDireccion(direccion) { 
  let limpia = direccion.replace(/^\d+\.\s*/, '').replace(/\[GR\]\s*/i, '').replace(/General\s+Rodríguez\s*,?\s*/gi, '').trim(); 
  if (!/General\s+Rodríguez/i.test(limpia)) limpia += ', General Rodríguez, Buenos Aires'; 
  return limpia; 
}

// Iniciar Viaje (Google Maps)
if(document.getElementById('btnViaje')) {
  document.getElementById('btnViaje').addEventListener('click', () => {
    if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido. Renová para viajar.", "advertencia");
    const tramo = destinos.slice(tramoActual, tramoActual + 10);
    
    if (tramo.length === 0) { 
      const stats = document.getElementById('stats');
      if(stats) {
          stats.classList.remove('hidden'); 
          const statHoras = document.getElementById('statHoras');
          const statKm = document.getElementById('statKm');
          const statEntregas = document.getElementById('statEntregas');
          
          if(statHoras) statHoras.innerText = ((new Date() - inicioViaje) / 3600000).toFixed(1); 
          if(statKm) statKm.innerText = (tramoActual * 0.9).toFixed(1); 
          if(statEntregas) statEntregas.innerText = tramoActual; 
      }
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
    const btnViaje = document.getElementById('btnViaje');
    if(btnViaje) {
        btnViaje.innerText = tramoActual < destinos.length ? `SIGUIENTE TRAMO (${tramoActual + 1} a ${Math.min(siguiente, destinos.length)})` : " VER ESTADISTICAS FINALES";
    }
  });
}

// Abrir Cámara
async function abrirCamara() {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia");
  const video = document.getElementById('camara'); 
  if(video) {
      video.classList.remove('hidden');
      try { 
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); 
        video.srcObject = stream; 
      } catch (err) { mostrarNotificacion("📷 No se pudo acceder a la cámara.", "error"); }
  }
}
