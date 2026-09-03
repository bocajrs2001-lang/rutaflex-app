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
