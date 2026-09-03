document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('authMessage');
  
  msg.innerText = "Conectando con el servidor...";
  msg.className = "text-center text-sm mt-4 font-bold text-blue-300";
  
  // Crear un timeout de 15 segundos para avisar si Render está dormido
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT')), 15000)
  );
  
  try {
    // Competencia entre la petición real y el timeout
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
      msg.innerText = " Error de conexión. Verificá tu internet.";
      msg.className = "text-center text-sm mt-4 font-bold text-red-300";
    }
  }
});
