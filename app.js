const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], emailRecuperacion="", estaVencido=false;

window.togglePass=(id,icon)=>{const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";icon.innerText=i.type==="text"?"🙈":"👁️"};
function mostrarNotificacion(m,t='info'){const c=document.getElementById('notificaciones');if(!c)return;const n=document.createElement('div');n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#4A9FE3]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl`;n.innerText=m;c.appendChild(n);setTimeout(()=>n.remove(),3500)}
function ocultarTodasLasPantallasExcepto(id){['authScreen','recoverStep1','recoverStep2','recoverStep3','appScreen','pegarTextoScreen','perfilScreen','payment-modal'].forEach(s=>document.getElementById(s)?.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden')}

window.abrirModalPagos=(plan,precio)=>{document.getElementById('modal-plan-texto').innerText=`Plan ${plan} - $${precio}`;document.getElementById('modal-alias-texto').innerText=CONFIG_RUTAFLEX.alias;document.getElementById('btn-wsp-pago').href=`https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;document.getElementById('btn-mp-pago').href=plan==='Semanal'?CONFIG_RUTAFLEX.linkSemanal:CONFIG_RUTAFLEX.linkMensual;document.getElementById('payment-modal').classList.remove('hidden')};
window.cerrarModalPagos=()=>document.getElementById('payment-modal').classList.add('hidden');
window.copiarAlias=()=>{navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(()=>mostrarNotificacion("✅ Alias copiado","exito"))};

window.addEventListener('load',async()=>{const e=localStorage.getItem('rutaflex_email');if(e&&document.getElementById('loginEmail'))document.getElementById('loginEmail').value=e;try{const r=await fetch('/api/yo',{credentials:'include'});const d=await r.json();if(d.ok)mostrarApp(d.nombre,d.fecha_vencimiento)}catch{}});
async function hacerLogout(){await fetch('/api/logout',{method:'POST',credentials:'include'});localStorage.removeItem('rutaflex_email');location.reload()}

document.getElementById('tabLogin')?.addEventListener('click',()=>{ocultarTodasLasPantallasExcepto('authScreen');document.getElementById('formLogin').classList.remove('hidden');document.getElementById('formRegistro').classList.add('hidden')});
document.getElementById('tabRegistro')?.addEventListener('click',()=>{ocultarTodasLasPantallasExcepto('authScreen');document.getElementById('formRegistro').classList.remove('hidden');document.getElementById('formLogin').classList.add('hidden')});
document.getElementById('btnOlvideContrasena')?.addEventListener('click',()=>ocultarTodasLasPantallasExcepto('recoverStep1'));
document.getElementById('btnVolverLogin1')?.addEventListener('click',()=>ocultarTodasLasPantallasExcepto('authScreen'));
document.getElementById('formRecoverEmail')?.addEventListener('submit',async(e)=>{e.preventDefault();const email=document.getElementById('recoverEmailInput').value;await fetch('/api/enviar-codigo-recuperacion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});emailRecuperacion=email;ocultarTodasLasPantallasExcepto('recoverStep2')});
document.getElementById('formRecoverCode')?.addEventListener('submit',async(e)=>{e.preventDefault();const codigo=document.getElementById('recoverCodeInput').value;const r=await fetch('/api/verificar-codigo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emailRecuperacion,codigo})});if(r.ok)ocultarTodasLasPantallasExcepto('recoverStep3')});
document.getElementById('formNewPassword')?.addEventListener('submit',async(e)=>{e.preventDefault();const nuevaPassword=document.getElementById('newPasswordInput').value;const r=await fetch('/api/cambiar-contrasena-final',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emailRecuperacion,nuevaPassword})});if(r.ok){mostrarNotificacion("✅ Contraseña cambiada","exito");ocultarTodasLasPantallasExcepto('authScreen')}});
document.getElementById('formRegistro')?.addEventListener('submit',async(e)=>{e.preventDefault();const nombre=document.getElementById('regNombre').value,email=document.getElementById('regEmail').value,password=document.getElementById('regPassword').value;const r=await fetch('/api/registro',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({nombre,email,password})});const d=await r.json();if(r.ok){localStorage.setItem('rutaflex_email',email);mostrarApp(d.usuario.nombre,d.usuario.fecha_vencimiento)}else{document.getElementById('authMessage').innerText=d.error}});
document.getElementById('formLogin')?.addEventListener('submit',async(e)=>{e.preventDefault();const email=document.getElementById('loginEmail').value,password=document.getElementById('loginPassword').value;const msg=document.getElementById('authMessage');msg.innerText="Conectando...";const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password})});const d=await r.json();if(r.ok){localStorage.setItem('rutaflex_email',email);mostrarApp(d.usuario.nombre,d.usuario.fecha_vencimiento)}else{msg.innerText=d.error||"Error"}});
document.getElementById('btnLogoutDropdown')?.addEventListener('click',hacerLogout);
document.getElementById('btnLogoutPerfil')?.addEventListener('click',hacerLogout);
document.getElementById('btnPromo')?.addEventListener('click',async()=>{const codigo=document.getElementById('promo').value;if(!codigo)return;const r=await fetch('/api/validar-promo',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({codigo})});const d=await r.json();mostrarNotificacion(d.mensaje,d.valido?'exito':'error')});

function mostrarApp(nombre,fechaVencimiento){
  ocultarTodasLasPantallasExcepto('appScreen');document.getElementById('userName').innerText=`¡Hola, ${nombre}! 👋`;
  const contadorEl=document.getElementById('contadorDias'),banner=document.getElementById('bannerVencido'),alerta=document.getElementById('alertaProximoVencimiento'),seccion=document.getElementById('seccionDestinos'),listaC=document.getElementById('listaContainer');
  const hoy=new Date(),venc=new Date(fechaVencimiento),diff=Math.ceil((venc-hoy)/(1000*60*60*24));
  banner.classList.add('hidden');if(alerta)alerta.classList.add('hidden');seccion.style.pointerEvents="auto";seccion.style.filter="none";listaC.style.pointerEvents="auto";listaC.style.filter="none";estaVencido=false;
  if(!fechaVencimiento||diff<=0){estaVencido=true;contadorEl.innerText="⚠️ VENCIDO";contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-red-600 text-white";banner.classList.remove('hidden');seccion.style.pointerEvents="none";listaC.style.pointerEvents="none";destinos=[];renderLista()}else if(diff<=1){contadorEl.innerText=`⏳ Vence en ${diff} día`;contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-yellow-500 text-[#0A1220]";if(alerta)alerta.classList.remove('hidden');cargarDestinos()}else{contadorEl.innerText=`✅ Activo (${diff} días)`;contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-green-500 text-white";cargarDestinos()}
}

async function cargarDestinos(){
  if(estaVencido) return;
  try{
    const r = await fetch('/api/destinos',{credentials:'include'});
    let crudos = await r.json();
    let merged = [];
    for(let i=0; i<crudos.length; i++){
      let actual = crudos[i].direccion || crudos[i].dirección || "";
      let siguiente = crudos[i+1]?.direccion || crudos[i+1]?.dirección || "";
      let actualEsLabel = actual.length < 45 && !/\d{3,4}/.test(actual) && /^(\(?\[?\d+[\]\)\.\-]?|\(?\d+\)?)?\s*[A-Za-z]/.test(actual);
      let siguienteEsDir = /\d{2,4}/.test(siguiente) && siguiente.length > 8;
      if(actualEsLabel && siguienteEsDir){
        let nombre = actual.replace(/^(\(?\[?\d+[\]\)\.\-]?|\(?\d+\)?)\s*/,'').replace(/[\(\)\[\]]/g,'').trim();
        merged.push({...crudos[i], direccion: `${nombre} - ${siguiente}`});
        i++;
      } else { merged.push(crudos[i]); }
    }
    destinos = merged;
    renderLista();
  }catch(e){ console.error(e); mostrarNotificacion("❌ Error al cargar destinos","error"); }
}

document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  const btn = document.getElementById('btnCargar'); const txt = btn.innerText;
  btn.innerText = "🤖 Leyendo..."; btn.disabled = true;
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    let lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    let agrupadas = [];
    for (let i = 0; i < lineas.length; i++) {
      let actual = lineas[i]; let siguiente = lineas[i+1] || "";
      let pareceLabel = actual.length < 40 && !/\d{3,4}/.test(actual);
      let siguienteEsDireccion = /\d{2,4}/.test(siguiente) || /(Av\.|Avda|Libertador|Rivadavia|Sarmiento|Corrientes|Santa Fe|Cabildo)/i.test(siguiente);
      if (pareceLabel && siguienteEsDireccion && siguiente.length > 8) {
        let nombreLimpio = actual.replace(/^(\(?\[?\d+[\]\)\.\-]?|\(?\d+\)?)\s*/,'').replace(/[\(\)\[\]]/g,'').trim();
        if(nombreLimpio.length<2) nombreLimpio = actual.replace(/[\(\)\[\]\d]/g,'').trim();
        agrupadas.push(`${nombreLimpio} - ${siguiente}`); i++;
      } else if (actual.length > 8) { agrupadas.push(actual); }
    }
    agrupadas = [...new Set(agrupadas)].map(l=>l.replace(/\s{2,}/g,' ').trim()).filter(l=>l.length>10);
    if (agrupadas.length === 0) return mostrarNotificacion("⚠️ No se entendió. Probá foto más de frente", "error");
    destinosDetectados = agrupadas;
    mostrarNotificacion(`✅ ${agrupadas.length} destinos detectados`, "exito");
    mostrarModalEdicion();
  } catch (err) { console.error(err); mostrarNotificacion("❌ Error leyendo imagen", "error");
  } finally { btn.innerText = txt; btn.disabled = false; e.target.value = ''; }
});

function mostrarModalEdicion(){
  const c=document.getElementById('contenedorInputs');c.innerHTML='';
  if(destinosDetectados.length===0){c.innerHTML='<p class="text-center py-4 text-gray-400">Sin direcciones</p>';}
  else{
    destinosDetectados.forEach((dir,i)=>{
      let partes = dir.split(' - '); let titulo = partes.length > 1? partes[0] : `Destino ${i+1}`; let direccion = partes.length > 1? partes.slice(1).join(' - ') : dir;
      c.innerHTML+=`<div class="flex gap-2 items-start bg-[#0A1220] p-3 rounded-xl border border-[#1E324F]"><span class="bg-[#4A9FE3] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1">${i+1}</span><div class="flex-1"><input type="text" value="${titulo.replace(/"/g,'&quot;')}" class="input-titulo w-full bg-[#121E32] border border-[#1E324F] rounded-lg px-3 py-2 text-sm font-bold text-white mb-1" placeholder="Nombre"><input type="text" value="${direccion.replace(/"/g,'&quot;')}" class="input-direccion w-full bg-[#121E32] border border-[#1E324F] rounded-lg px-3 py-2 text-sm text-white" placeholder="Dirección"></div><button onclick="eliminarLinea(${i})" class="text-red-400 p-2 hover:bg-red-500/10 rounded">🗑️</button></div>`;
    });
  }
  document.getElementById('modalEdicion').classList.remove('hidden');
}
window.eliminarLinea=i=>{destinosDetectados.splice(i,1);mostrarModalEdicion()};

document.getElementById('btnGuardarEdicion')?.addEventListener('click',async()=>{
  const titulos=document.querySelectorAll('.input-titulo'); const dirs=document.querySelectorAll('.input-direccion'); let finales=[];
  for(let i=0;i<dirs.length;i++){let t=titulos[i]?.value.trim()||""; let d=dirs[i]?.value.trim()||""; if(d.length>3) finales.push(t?`${t} - ${d}`:d);}
  if(finales.length===0)return mostrarNotificacion("Ingresá al menos una","error");
  const btn=document.getElementById('btnGuardarEdicion');btn.innerText="💾 Guardando...";btn.disabled=true;
  try{for(const direccion of finales){await fetch('/api/destinos',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({direccion})})}mostrarNotificacion(`✅ ${finales.length} guardadas`,"exito");document.getElementById('modalEdicion').classList.add('hidden');await cargarDestinos();}catch{mostrarNotificacion("❌ Error al guardar","error")}finally{btn.innerText="✅ Guardar Todo";btn.disabled=false}
});
document.getElementById('btnCancelarEdicion')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden');destinosDetectados=[]});
document.getElementById('btnCerrarModal')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden')});

function renderLista(){
  const l=document.getElementById('lista'),ph=document.getElementById('placeholderVacio'),btnBorrar=document.getElementById('btnBorrarTodo');
  if(!l)return;l.innerHTML="";
  if(destinos.length===0){
    ph.style.display='flex';
    document.getElementById('count').innerText=0;
    document.getElementById('btnViaje').classList.add('hidden');
    if(btnBorrar) btnBorrar.classList.add('hidden');
    return;
  }
  ph.style.display='none';
  if(btnBorrar) btnBorrar.classList.remove('hidden');
  
  destinos.forEach((d,i)=>{
    const full = d.direccion||d.dirección||''; 
    const partes = full.split(' - '); 
    const titulo = partes.length>1? partes[0] : ''; 
    const dir = partes.length>1? partes.slice(1).join(' - ') : full;
    
    l.innerHTML+=`<li class="bg-[#121E32] border border-[#1E324F] border-l-[5px] border-l-[#4A9FE3] rounded-2xl p-4 flex gap-3 items-center shadow-sm mb-3">
      <span class="bg-[#4A9FE3] text-[#0A1220] rounded-full w-8 h-8 flex items-center justify-center text-xs font-black flex-shrink-0">${i+1}</span>
      <div class="flex-1 min-w-0">
        <b class="block truncate text-white text-[14px]">${titulo || dir}</b>
        ${titulo?`<span class="block truncate text-gray-400 text-xs mb-1">${dir}</span>`:''}
      </div>
      <button onclick="borrarDestino('${d._id}')" class="text-gray-400 hover:text-red-400 p-2 text-xl">✕</button>
    </li>`;
  });
  document.getElementById('count').innerText=destinos.length;
  document.getElementById('btnViaje').classList.remove('hidden');
}

window.borrarDestino=async(id)=>{if(!confirm('¿Eliminar?'))return;await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'});await cargarDestinos()};

document.getElementById('btnBorrarTodo')?.addEventListener('click', async () => {
  if(destinos.length === 0) return;
  if(!confirm(`¿Eliminar TODAS las ${destinos.length} direcciones? Esta acción no se puede deshacer.`)) return;
  const btn = document.getElementById('btnBorrarTodo');
  btn.innerText = "🗑️ Borrando..."; btn.disabled = true;
  try {
    const r = await fetch('/api/destinos', { method: 'DELETE', credentials: 'include' });
    if (r.ok) {
      mostrarNotificacion(`✅ ${destinos.length} direcciones eliminadas`, "exito");
      destinos = [];
      renderLista();
    }
  } catch (error) {
    mostrarNotificacion("❌ Error al borrar todo", "error");
  } finally {
    btn.innerText = "🗑️ Borrar todo"; btn.disabled = false;
  }
});

document.getElementById('btnCargar')?.addEventListener('click',()=>{
  destinosDetectados = [""];
  mostrarModalEdicion();
  setTimeout(()=>document.querySelector('.input-direccion')?.focus(),150);
});
document.getElementById('btnAgregarLinea')?.addEventListener('click',()=>{destinosDetectados.push(""); mostrarModalEdicion();});

// ==========================================
// 📋 MÓDULO PEGAR TEXTO (NUEVO)
// ==========================================
document.getElementById('btnPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('pegarTextoScreen');
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

document.getElementById('btnVolverPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('appScreen');
});

document.getElementById('btnReiniciarPegar')?.addEventListener('click', () => {
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

const limpiarTextoSucio = (t) => {
  return t
    .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '') // Emojis
    .replace(/\b(hola|buen dia|buenas|che|capo|dale|gracias|mañana|hoy|como estas|tarde|noche)\b/gi, '') // Saludos
    .replace(/\b\d{2,4}[- ]?\d{3,4}[- ]?\d{4}\b/g, '') // Teléfonos
    .replace(/\$\s?\d+/g, '') // Precios
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 8)
    .join('\n');
};

document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");

  document.getElementById('pegarTextoStep1').classList.add('hidden');
  document.getElementById('pegarTextoLoading').classList.remove('hidden');

  const limpio = limpiarTextoSucio(texto);
  const regex = /([A-Za-zÁÉÍÓÚáéíóúÑñ\. ]{3,}\s+\d{1,5}[A-Za-z]?)(\s*,\s*[A-Za-z ]+)?/g;
  const candidatas = [...limpio.matchAll(regex)].map(m => m[0].trim()).slice(0, 50);
  const unicas = [...new Set(candidatas)];
  
  const validadas = [];
  let descartadas = 0;

  for (const dir of unicas) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir + ', Buenos Aires, Argentina')}&limit=1`, {
        headers: { 'User-Agent': 'RutaFlexApp/1.0' }
      });
      const d = await r.json();
      if (d[0]?.importance > 0.4) {
        validadas.push({ original: dir, display: d[0].display_name, lat: d[0].lat, lon: d[0].lon });
      } else {
        descartadas++;
      }
    } catch (e) {
      descartadas++;
    }
  }

  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.remove('hidden');
  
  document.getElementById('countValidas').innerText = validadas.length;
  document.getElementById('countDescartadas').innerText = descartadas;

  const listaEl = document.getElementById('listaPegadas');
  listaEl.innerHTML = '';
  
  let mapsLinks = [];
  let wazeLinks = [];

  validadas.forEach((r, i) => {
    mapsLinks.push(encodeURIComponent(r.original));
    wazeLinks.push(encodeURIComponent(r.original));
    
    listaEl.innerHTML += `
      <div class="bg-[#121E32] rounded-xl p-3 flex gap-3 border border-[#1E324F]">
        <div class="w-7 h-7 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center flex-shrink-0">${i + 1}</div>
        <div class="min-w-0">
          <p class="font-bold text-sm text-white truncate">${r.original}</p>
          <p class="text-xs text-gray-400 truncate">${r.display}</p>
        </div>
      </div>
    `;
  });

  const mapsBase = "https://www.google.com/maps/dir/";
  const mapsUrl = mapsLinks.length > 0 ? `${mapsBase}${mapsLinks.slice(0, 10).join('/')}` : '#';
  document.getElementById('btnMapsPegadas').href = mapsUrl;

  const wazeBase = "https://www.waze.com/es-419/ul?navigate=yes&to=";
  const wazeUrl = wazeLinks.length > 0 ? `${wazeBase}${wazeLinks[0]}` : '#';
  document.getElementById('btnWazePegadas').href = wazeUrl;
});
// ==========================================

document.getElementById('btnViaje')?.addEventListener('click', async () => {
  if(destinos.length === 0) return;
  mostrarNotificacion("📍 Obteniendo tu ubicación GPS...", "info");
  if (!navigator.geolocation) return mostrarNotificacion("⚠️ Tu navegador no soporta geolocalización", "error");
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
    const origin = `${position.coords.latitude},${position.coords.longitude}`;
    const dirs = destinos.map(d => {
      const full = d.direccion || d.dirección || '';
      const partes = full.split(' - ');
      return encodeURIComponent(partes.length > 1 ? partes.slice(1).join(' - ') : full);
    });
    const CHUNK_SIZE = 8; 
    for (let i = 0; i < dirs.length; i += CHUNK_SIZE) {
      const chunk = dirs.slice(i, i + CHUNK_SIZE + 1);
      if (chunk.length === 0) break;
      const waypoints = chunk.slice(0, -1);
      const destination = chunk[chunk.length - 1];
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints.length > 0) url += `&waypoints=optimize:true|${waypoints.join('|')}`;
      window.open(url, '_blank');
      mostrarNotificacion(`🚀 Ruta optimizada desde tu ubicación`, "exito");
      if (i + CHUNK_SIZE < dirs.length) {
        await new Promise(r => setTimeout(r, 1500));
        if(!confirm(`Tenés ${dirs.length} paradas en total. ¿Abrir el siguiente tramo?`)) break;
      }
    }
    document.getElementById('stats')?.classList.remove('hidden');
    document.getElementById('statEntregas').innerText = destinos.length;
  } catch (error) {
    console.error('Error GPS:', error);
    mostrarNotificacion("⚠️ No se pudo obtener tu ubicación. Permití el acceso al GPS.", "error");
  }
});

async function abrirCamara(){const v=document.getElementById('camara');v.classList.remove('hidden');try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});v.srcObject=s}catch{mostrarNotificacion("No se pudo abrir cámara","error")}}

const logoMenuBtn=document.getElementById('logoMenuBtn'),logoDropdown=document.getElementById('logoDropdown');
logoMenuBtn?.addEventListener('click',e=>{e.stopPropagation();logoDropdown.classList.toggle('hidden');logoDropdown.classList.toggle('flex')});
document.addEventListener('click',e=>{if(logoDropdown&&!logoDropdown.contains(e.target)&&!logoMenuBtn.contains(e.target)){logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex')}});
document.getElementById('btnIrPerfil')?.addEventListener('click',()=>{logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex');mostrarPerfil()});

function mostrarPerfil(){
  ocultarTodasLasPantallasExcepto('perfilScreen');
  const email=localStorage.getItem('rutaflex_email')||'usuario@rutaflex.com';
  document.getElementById('perfilNombre').innerText=email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  document.getElementById('perfilEmail').innerText=email;
  const estadoEl=document.getElementById('perfilEstado'),btnR=document.getElementById('btnRenovarPerfil');
  if(estaVencido){estadoEl.innerText="⚠️ VENCIDO";estadoEl.className="inline-block mt-4 px-5 py-1.5 rounded-full text-xs font-black bg-red-600 text-white";btnR.classList.remove('hidden')}
  else{estadoEl.innerText="✅ ACTIVO";estadoEl.className="inline-block mt-4 px-5 py-1.5 rounded-full text-xs font-black bg-green-500 text-white";btnR.classList.add('hidden')}
}
document.getElementById('btnVolverDePerfil')?.addEventListener('click',()=>ocultarTodasLasPantallasExcepto('appScreen'));

if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>{}); }); }
