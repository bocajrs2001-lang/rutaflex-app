const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], emailRecuperacion="", estaVencido=false;

window.togglePass=(id,icon)=>{const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";icon.innerText=i.type==="text"?"🙈":"👁️"};
function mostrarNotificacion(m,t='info'){const c=document.getElementById('notificaciones');if(!c)return;const n=document.createElement('div');n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#0A2342]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl toast-anim`;n.innerText=m;c.appendChild(n);setTimeout(()=>n.remove(),3500)}
function ocultarTodasLasPantallasExcepto(id){['authScreen','recoverStep1','recoverStep2','recoverStep3','appScreen','perfilScreen','payment-modal'].forEach(s=>document.getElementById(s)?.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden')}
window.abrirModalPagos=(plan,precio)=>{document.getElementById('modal-plan-texto').innerText=`Plan ${plan} - $${precio}`;document.getElementById('modal-alias-texto').innerText=CONFIG_RUTAFLEX.alias;document.getElementById('btn-wsp-pago').href=`https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;document.getElementById('btn-mp-pago').href=plan==='Semanal'?CONFIG_RUTAFLEX.linkSemanal:CONFIG_RUTAFLEX.linkMensual;document.getElementById('payment-modal').classList.remove('hidden')};
window.cerrarModalPagos=()=>document.getElementById('payment-modal').classList.add('hidden');
window.copiarAlias=()=>{navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(()=>mostrarNotificacion("✅ Alias copiado","exito"))};

window.addEventListener('load',async()=>{
  const e=localStorage.getItem('rutaflex_email');if(e&&document.getElementById('loginEmail'))document.getElementById('loginEmail').value=e;
  try{const r=await fetch('/api/yo',{credentials:'include'});const d=await r.json();if(d.ok)mostrarApp(d.nombre,d.fecha_vencimiento)}catch{}
});
async function hacerLogout(){await fetch('/api/logout',{method:'POST',credentials:'include'});localStorage.removeItem('rutaflex_email');location.reload()}

// AUTH
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
  if(!fechaVencimiento||diff<=0){estaVencido=true;contadorEl.innerText="⚠️ VENCIDO";contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-red-600 text-white";banner.classList.remove('hidden');seccion.style.pointerEvents="none";listaC.style.pointerEvents="none";destinos=[];renderLista()}else if(diff<=1){contadorEl.innerText=`⏳ Vence en ${diff} día`;contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-yellow-500 text-[#0A2342]";if(alerta)alerta.classList.remove('hidden');cargarDestinos()}else{contadorEl.innerText=`✅ Activo (${diff} días)`;contadorEl.className="text-xs font-bold mt-1 px-2 py-1 rounded-full bg-green-500 text-white";cargarDestinos()}
}
async function cargarDestinos(){if(estaVencido)return;try{const r=await fetch('/api/destinos',{credentials:'include'});destinos=await r.json();renderLista()}catch{mostrarNotificacion("❌ Error al cargar destinos","error")}}

// --- OCR CON FIX DE AGRUPACIÓN INTELIGENTE ---
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0];
  if (!file) return;
  const btn = document.getElementById('btnCargar');
  const textoOriginal = btn.innerText;
  btn.innerText = "🤖 Leyendo imagen...";
  btn.disabled = true;
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    let lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    console.log('OCR crudo:', lineas);

    let agrupadas = [];
    for (let i = 0; i < lineas.length; i++) {
      let actual = lineas[i];
      let siguiente = lineas[i+1] || "";

      // Detecta si es nombre tipo "(13) Planetario" o "[14) Bellas Artes" o "15. Congreso"
      let esNombreCorto = actual.length < 45 &&!/(Av\.|Avda|Libertador|Rivadavia|Sarmiento|Corrientes|Santa Fe|Cabildo)\s+\d+/i.test(actual);
      let pareceLabel = /^(\(?\[?\d+[\]\)\.\-]?|\(\d+\))\s*/.test(actual) || /^(Planetario|Bellas Artes|Congreso|Recoleta|Palermo|Obelisco|Casa Rosada|Caminito)/i.test(actual);
      let siguienteEsDireccion = /(Av\.|Avda|Libertador|Rivadavia|Sarmiento|Alcor[a-z]+|Corrientes|Callao|Cabildo)/i.test(siguiente) || /\d{3,4}/.test(siguiente);

      // Caso de tu foto: (13) Planetario + Av. Figueroa...
      if ((pareceLabel || esNombreCorto) && siguienteEsDireccion && siguiente.length > 8) {
        let nombreLimpio = actual.replace(/^(\(?\[?\d+[\]\)\.\-]?|\(\d+\)|\(?\d+\)?)\s*/, '').replace(/^\[|\]$/g,'').trim();
        // Si nombreLimpio quedó vacío (solo decía "13"), usamos el original limpio
        if(nombreLimpio.length < 2) nombreLimpio = actual.replace(/[\(\)\[\]\d]/g,'').trim();
        agrupadas.push(`${nombreLimpio} - ${siguiente}`);
        i++;
      } else {
        // Filtrar basura
        if(actual.length > 8 &&!/^(imagen|foto|qr|cámara|página)/i.test(actual)){
          agrupadas.push(actual);
        }
      }
    }

    // Limpieza final
    agrupadas = [...new Set(agrupadas)].map(l=>l.replace(/\s{2,}/g,' ').trim()).filter(l=>l.length>10);

    if (agrupadas.length === 0) {
      mostrarNotificacion("⚠️ No se detectaron direcciones claras", "error");
      return;
    }

    destinosDetectados = agrupadas;
    mostrarNotificacion(`✅ ${agrupadas.length} destinos reales detectados`, "exito");
    mostrarModalEdicion();

  } catch (err) {
    console.error(err);
    mostrarNotificacion("❌ Error OCR: " + err.message, "error");
  } finally {
    btn.innerText = textoOriginal;
    btn.disabled = false;
    e.target.value = '';
  }
});

function mostrarModalEdicion(){
  const c=document.getElementById('contenedorInputs');c.innerHTML='';
  if(destinosDetectados.length===0){c.innerHTML='<p class="text-center py-4 text-gray-400">Sin direcciones</p>';}
  else{
    destinosDetectados.forEach((dir,i)=>{
      // Separamos para mostrar lindo: "Planetario - Av. Figueroa..."
      let partes = dir.split(' - ');
      let titulo = partes.length > 1? partes[0] : `Destino ${i+1}`;
      let direccion = partes.length > 1? partes.slice(1).join(' - ') : dir;

      c.innerHTML+=`
      <div class="flex gap-2 items-start bg-gray-50 p-3 rounded-xl border">
        <span class="bg-[#0A2342] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1">${i+1}</span>
        <div class="flex-1">
          <input type="text" value="${titulo.replace(/"/g,'&quot;')}" class="input-titulo w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-[#0A2342] mb-1" placeholder="Nombre del lugar">
          <input type="text" value="${direccion.replace(/"/g,'&quot;')}" class="input-direccion w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Dirección">
        </div>
        <button onclick="eliminarLinea(${i})" class="text-red-500 p-2 mt-1">🗑️</button>
      </div>`;
    });
  }
  document.getElementById('modalEdicion').classList.remove('hidden');
}

window.eliminarLinea=i=>{destinosDetectados.splice(i,1);mostrarModalEdicion()};

document.getElementById('btnGuardarEdicion')?.addEventListener('click',async()=>{
  const titulos=document.querySelectorAll('.input-titulo');
  const dirs=document.querySelectorAll('.input-direccion');
  let finales=[];
  for(let i=0;i<dirs.length;i++){
    let t=titulos[i]?.value.trim() || "";
    let d=dirs[i]?.value.trim() || "";
    if(d.length>3){
      finales.push(t? `${t} - ${d}` : d);
    }
  }
  if(finales.length===0)return mostrarNotificacion("Ingresá al menos una","error");
  const btn=document.getElementById('btnGuardarEdicion');btn.innerText="💾 Guardando...";btn.disabled=true;
  try{
    for(const direccion of finales){
      await fetch('/api/destinos',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({direccion})})
    }
    mostrarNotificacion(`✅ ${finales.length} guardadas`,"exito");
    document.getElementById('modalEdicion').classList.add('hidden');
    await cargarDestinos();
  }catch{mostrarNotificacion("❌ Error al guardar","error")}
  finally{btn.innerText="✅ Guardar Todo";btn.disabled=false}
});

document.getElementById('btnCancelarEdicion')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden');destinosDetectados=[]});
document.getElementById('btnCerrarModal')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden')});

function renderLista(){
  const l=document.getElementById('lista'),ph=document.getElementById('placeholderVacio');if(!l)return;l.innerHTML="";
  if(destinos.length===0){ph.style.display='block';document.getElementById('count').innerText=0;document.getElementById('btnViaje').classList.add('hidden');return}
  ph.style.display='none';
  destinos.forEach((d,i)=>{
    const full = d.direccion||d.dirección||'';
    const partes = full.split(' - ');
    const titulo = partes.length>1? partes[0] : '';
    const dir = partes.length>1? partes.slice(1).join(' - ') : full;
    l.innerHTML+=`<li><span class="bg-[#0A2342] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">${i+1}</span><div class="flex-1 min-w-0"><b class="block truncate text-[#0A2342] text-[14px]">${titulo || dir}</b>${titulo? `<span class="block truncate text-gray-500 text-xs">${dir}</span>` : ''}<span class="text-[11px] text-green-600 font-bold">${d.distancia?d.distancia+' km':''}</span></div><button onclick="borrarDestino('${d._id}')" class="text-red-500 p-2">🗑️</button></li>`
  });
  document.getElementById('count').innerText=destinos.length;document.getElementById('btnViaje').classList.remove('hidden');
}
window.borrarDestino=async(id)=>{if(!confirm('¿Eliminar?'))return;await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'});await cargarDestinos()};

document.getElementById('btnCargar')?.addEventListener('click',()=>{destinosDetectados=[""];mostrarModalEdicion()});

document.getElementById('btnViaje')?.addEventListener('click',()=>{
  if(destinos.length===0)return;
  const base="https://www.google.com/maps/dir/?api=1";
  const dirs=destinos.map(d=>{
    const full=d.direccion||d.dirección||'';
    const partes=full.split(' - ');
    return encodeURIComponent(partes.length>1? partes.slice(1).join(' - ') : full);
  });
  const lote1=dirs.slice(0,9);
  if(lote1.length>0){
    const url=`${base}&destination=${lote1[lote1.length-1]}&waypoints=${lote1.slice(0,-1).join('|')}&travelmode=driving`;
    window.open(url,'_blank');
    mostrarNotificacion(`🚀 Ruta optimizada abierta (${destinos.length} paradas)`,"exito");
    document.getElementById('stats')?.classList.remove('hidden');
    document.getElementById('statEntregas').innerText=destinos.length;
  }
  if(dirs.length>9){setTimeout(()=>{if(confirm(`Tenés ${dirs.length} paradas. ¿Abrir tramo 10-${dirs.length}?`)){const lote2=dirs.slice(9,18);const url2=`${base}&destination=${lote2[lote2.length-1]}&waypoints=${lote2.slice(0,-1).join('|')}`;window.open(url2,'_blank')}},800);}
});

async function abrirCamara(){const v=document.getElementById('camara');v.classList.remove('hidden');try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});v.srcObject=s}catch{mostrarNotificacion("No se pudo abrir cámara","error")}}
const logoMenuBtn=document.getElementById('logoMenuBtn'),logoDropdown=document.getElementById('logoDropdown');
logoMenuBtn?.addEventListener('click',e=>{e.stopPropagation();logoDropdown.classList.toggle('hidden');logoDropdown.classList.toggle('flex')});
document.addEventListener('click',e=>{if(logoDropdown&&!logoDropdown.contains(e.target)&&!logoMenuBtn.contains(e.target)){logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex')}});
document.getElementById('btnIrPerfil')?.addEventListener('click',()=>{logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex');mostrarPerfil()});
function mostrarPerfil(){ocultarTodasLasPantallasExcepto('perfilScreen');const email=localStorage.getItem('rutaflex_email')||'usuario@rutaflex.com';document.getElementById('perfilNombre').innerText=email.split('@')[0];document.getElementById('perfilEmail').innerText=email;const estadoEl=document.getElementById('perfilEstado'),btnR=document.getElementById('btnRenovarPerfil');if(estaVencido){estadoEl.innerText="⚠️ VENCIDO";estadoEl.className="inline-block mt-4 px-5 py-1.5 rounded-full text-xs font-black bg-red-600 text-white";btnR.classList.remove('hidden')}else{estadoEl.innerText="✅ ACTIVO";estadoEl.className="inline-block mt-4 px-5 py-1.5 rounded-full text-xs font-black bg-green-500 text-white";btnR.classList.add('hidden')}}
document.getElementById('btnVolverDePerfil')?.addEventListener('click',()=>ocultarTodasLasPantallasExcepto('appScreen'));
