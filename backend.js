require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference } = require('mercadopago');

// Importar funciones de base de datos
const { 
  registrarUsuario, loginUsuario, obtenerDestinosDeUsuario, agregarDestino, 
  borrarDestino, borrarDestinosDeUsuario, actualizarContrasena, 
  buscarUsuarioPorEmail, cancelarSuscripcionUsuario, actualizarVencimiento
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
//  INICIALIZACIÓN DE SERVICIOS
// ==========================================

// Inicializar Mercado Pago con credenciales de Producción
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
console.log('🔑 Token MP cargado:', process.env.MP_ACCESS_TOKEN ? 'OK (' + process.env.MP_ACCESS_TOKEN.substring(0,8) + '...)' : '⚠️ FALTA TOKEN');

// Inicializar Resend para emails
const resend = new Resend(process.env.RESEND_API_KEY);
const codigosVerificacion = new Map(); // Almacena códigos temporalmente en memoria

// Conectar a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Middlewares
app.use(cors({ 
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000', 'https://rutaflex-app.onrender.com'], 
  credentials: true 
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({ 
  secret: 'rutaflex_secret_super_seguro_2026', 
  resave: false, 
  saveUninitialized: false, 
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', secure: false } 
}));

// ==========================================
// 🛡️ MIDDLEWARES DE SEGURIDAD
// ==========================================

function usuarioLogueado(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Debes iniciar sesión' });
}

function suscripcionVigente(req, res, next) {
  const user = req.session.user;
  if (!user || !user.fecha_vencimiento || new Date(user.fecha_vencimiento) < new Date()) {
    return res.status(403).json({ error: 'Suscripción vencida. Renová tu plan.', vencido: true });
  }
  next();
}

// ==========================================
//  RUTAS DE MERCADO PAGO
// ==========================================

// Crear preferencia de pago
app.post('/api/crear-preferencia-pago', usuarioLogueado, async (req, res) => {
  try {
    const { plan } = req.body;
    let precio, titulo, diasExtra;
    
    if (plan === 'mensual') {
      precio = 14990; 
      titulo = 'RUTAFLEX - Plan Mensual'; 
      diasExtra = 30;
    } else {
      precio = 4990; 
      titulo = 'RUTAFLEX - Plan Semanal'; 
      diasExtra = 7;
    }

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [
          { 
            id: `rutaflex_${plan}_${req.session.userId}`, 
            title: titulo, 
            quantity: 1, 
            currency_id: 'ARS', 
            unit_price: precio 
          }
        ],
        payer: {
          email: req.session.user.email,
          name: req.session.nombre
        },
        back_urls: {
          success: 'https://rutaflex-app.onrender.com/',
          failure: 'https://rutaflex-app.onrender.com/',
          pending: 'https://rutaflex-app.onrender.com/'
        },
        auto_return: 'approved',
        notification_url: 'https://rutaflex-app.onrender.com/api/webhook-mp',
        external_reference: req.session.userId.toString() // ID del usuario para identificarlo después
      }
    });
    
    console.log(`💳 Preferencia creada para usuario ${req.session.userId}: ${result.id}`);
    res.json({ ok: true, init_point: result.init_point });
    
  } catch (err) {
    console.error('Error creando preferencia:', err);
    res.status(500).json({ error: 'Error al generar link de pago' });
  }
});

// 🔥 RUTA DE EMERGENCIA: Verificar pago directo (Plan B)
// Se usa cuando el usuario vuelve de MP y el webhook no llegó
app.post('/api/verificar-pago-pendiente', usuarioLogueado, async (req, res) => {
  try {
    const userId = req.session.userId.toString();
    console.log(`🔍 Verificando pagos pendientes para usuario: ${userId}`);
    
    // Buscar pagos aprobados asociados a este usuario en las últimas 24hs
    const payments = await mpClient.payment.search({ 
      options: { 
        external_reference: userId,
        sort: 'date_created',
        criteria: 'desc',
        limit: 5 // Revisamos los últimos 5 pagos por seguridad
      } 
    });
    
    if (payments.results && payments.results.length > 0) {
      // Buscamos el primer pago aprobado
      const pagoAprobado = payments.results.find(p => p.status === 'approved');
      
      if (pagoAprobado) {
        console.log(`✅ Pago encontrado: ${pagoAprobado.id} - Estado: ${pagoAprobado.status}`);
        
        // Determinar días según título del item
        const itemTitle = pagoAprobado.additional_info?.items?.[0]?.title || '';
        const diasExtra = itemTitle.includes('Mensual') ? 30 : 7;
        
        // Activar usuario en BD
        await actualizarVencimiento(userId, diasExtra);
        
        // Actualizar sesión actual
        req.session.user.fecha_vencimiento = new Date(Date.now() + diasExtra * 24 * 60 * 60 * 1000);
        
        return res.json({ ok: true, activado: true, dias: diasExtra });
      }
    }
    
    console.log('ℹ️ No se encontraron pagos aprobados recientes');
    res.json({ ok: false, activado: false });
    
  } catch (err) {
    console.error("❌ Error verificando pago directo:", err);
    res.status(500).json({ ok: false, activado: false, error: err.message });
  }
});

// Webhook para recibir notificaciones de pago (Plan A)
app.post('/api/webhook-mp', async (req, res) => {
  const { type, data } = req.body;
  console.log(`📩 Webhook recibido: Tipo=${type}, DataID=${data?.id}`);

  if (type === 'payment' || type === 'pay') {
    try {
      const paymentId = data.id;
      
      // Consultar detalles reales del pago a MP
      const mpPayment = await mpClient.payment.get({ id: paymentId });
      
      console.log(`🔍 Estado del pago ${paymentId}: ${mpPayment.status}`);
      console.log(`🆔 External Reference (UserID): ${mpPayment.external_reference}`);

      if (mpPayment.status === 'approved') {
        const userId = mpPayment.external_reference;
        
        if (userId) {
          // Determinar días extra según el título del item comprado
          const itemTitle = mpPayment.additional_info?.items?.[0]?.title || '';
          const diasExtra = itemTitle.includes('Mensual') ? 30 : 7;
          
          console.log(`⚙️ Intentando activar usuario ${userId} por ${diasExtra} días...`);
          
          // Actualizar fecha de vencimiento en la base de datos
          await actualizarVencimiento(userId, diasExtra);
          
          console.log(`✅ USUARIO ${userId} ACTIVADO EXITOSAMENTE POR WEBHOOK`);
        } else {
          console.error('❌ ERROR: El pago no tiene external_reference (UserID)');
        }
      } else {
        console.log(`⏳ Pago ${paymentId} aún no aprobado. Estado: ${mpPayment.status}`);
      }
    } catch (err) {
      console.error('❌ ERROR CRÍTICO EN WEBHOOK:', err.message);
      console.error(err);
    }
  }
  
  // Siempre responder 200 OK a Mercado Pago para evitar reintentos infinitos
  res.status(200).send('OK');
});

// ==========================================
// 👤 RUTAS DE AUTENTICACIÓN Y USUARIO
// ==========================================

app.post('/api/cancelar-suscripcion', usuarioLogueado, async (req, res) => {
  try { 
    await cancelarSuscripcionUsuario(req.session.userId); 
    res.json({ ok: true, mensaje: 'Cancelado' }); 
  } catch (err) { 
    res.status(500).json({ error: 'Error al cancelar' }); 
  }
});

app.post('/api/enviar-codigo-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Ingresá tu email' });
    
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) return res.status(404).json({ error: 'No existe cuenta con ese email' });
    
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosVerificacion.set(email, { codigo, expira: Date.now() + 10 * 60 * 1000 });

    const { error } = await resend.emails.send({
      from: 'RUTAFLEX <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Tu código de recuperación',
      html: `<div style="font-family:sans-serif; padding:20px;"><h2>RUTAFLEX</h2><p>Tu código es:</p><h1 style="color:#0A2342; letter-spacing:5px;">${codigo}</h1><p>Expira en 10 min.</p></div>`
    });
    
    if (error) return res.status(500).json({ error: 'Error al enviar email' });
    res.json({ ok: true, mensaje: 'Código enviado' });
  } catch (err) { 
    console.error('Error enviando email:', err);
    res.status(500).json({ error: 'Error del servidor' }); 
  }
});

app.post('/api/verificar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  const datos = codigosVerificacion.get(email);
  
  if (!datos) return res.status(400).json({ error: 'Solicitá un código nuevo' });
  if (datos.codigo !== codigo) return res.status(400).json({ error: 'Código incorrecto' });
  if (Date.now() > datos.expira) { 
    codigosVerificacion.delete(email); 
    return res.status(400).json({ error: 'Código expirado' }); 
  }
  
  codigosVerificacion.delete(email);
  res.json({ ok: true });
});

app.post('/api/cambiar-contrasena-final', async (req, res) => {
  const { email, nuevaPassword } = req.body;
  
  // Validar fortaleza de contraseña
  if (!nuevaPassword || nuevaPassword.length < 8 || !/[A-Z]/.test(nuevaPassword) || !/[0-9]/.test(nuevaPassword) || !/[!@#$%^&*]/.test(nuevaPassword)) {
    return res.status(400).json({ error: 'La contraseña no cumple los requisitos de seguridad' });
  }
  
  await actualizarContrasena(email, nuevaPassword);
  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
});

app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    
    // Validar contraseña antes de registrar
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ error: 'Contraseña insegura' });
    }
    
    const usuario = await registrarUsuario(nombre, email, password);
    
    // Iniciar sesión automáticamente tras registro
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    req.session.user = usuario;
    
    res.json({ ok: true, usuario });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await loginUsuario(email, password);
    
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    req.session.user = usuario;
    
    res.json({ ok: true, usuario });
  } catch (err) { 
    res.status(401).json({ error: err.message }); 
  }
});

app.get('/api/yo', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ 
      ok: true, 
      nombre: req.session.nombre, 
      fecha_vencimiento: req.session.user.fecha_vencimiento 
    });
  } else {
    res.json({ ok: false });
  }
});

app.post('/api/logout', (req, res) => { 
  req.session.destroy(); 
  res.json({ ok: true }); 
});

app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  const { codigo } = req.body;
  if (codigo === 'RUTA94FLEX') {
    return res.json({ valido: true, mensaje: '¡Código VIP aplicado con éxito!' });
  }
  res.status(400).json({ valido: false, mensaje: 'Código inválido.' });
});

// ==========================================
// 📍 RUTAS DE DESTINOS
// ==========================================

app.post('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try {
    if (!req.body.direccion) return res.status(400).json({ error: 'Falta dirección' });
    const destino = await agregarDestino(req.session.userId, req.body.direccion);
    res.json(destino);
  } catch (err) { 
    console.error('Error agregando destino:', err);
    res.status(500).json({ error: 'Error al guardar destino' }); 
  }
});

app.get('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { 
    const destinos = await obtenerDestinosDeUsuario(req.session.userId);
    res.json(destinos); 
  } catch (err) { 
    res.status(500).json({ error: 'Error al cargar destinos' }); 
  }
});

app.delete('/api/destinos/:id', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { 
    await borrarDestino(req.params.id, req.session.userId); 
    res.json({ ok: true }); 
  } catch (err) { 
    res.status(500).json({ error: 'Error al eliminar' }); 
  }
});

app.delete('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { 
    await borrarDestinosDeUsuario(req.session.userId); 
    res.json({ ok: true }); 
  } catch (err) { 
    res.status(500).json({ error: 'Error al eliminar todos' }); 
  }
});

// Ruta principal para servir el frontend
app.get('/', (req, res) => { 
  res.sendFile(path.join(__dirname, 'index.html')); 
});

// Iniciar servidor
app.listen(PORT, () => { 
  console.log(`✅ Backend RUTAFLEX corriendo en puerto ${PORT}`); 
});
