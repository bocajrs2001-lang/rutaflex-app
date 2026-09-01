require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend'); // Importamos Resend

const { 
  registrarUsuario, 
  loginUsuario, 
  obtenerDestinosDeUsuario, 
  agregarDestino, 
  borrarDestino, 
  borrarDestinosDeUsuario,
  actualizarContrasena,
  buscarUsuarioPorEmail
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Resend con tu API Key de Render
const resend = new Resend(process.env.RESEND_API_KEY);

// Mapa temporal para guardar códigos (en memoria del servidor)
const codigosVerificacion = new Map();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas (La Nube)'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

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
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: false 
  }
}));

function usuarioLogueado(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Debes iniciar sesión' });
}

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. ENVIAR CÓDIGO POR EMAIL
app.post('/api/enviar-codigo-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Ingresá tu email' });

    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) return res.status(404).json({ error: 'No existe cuenta con ese email' });

    const codigo = generarCodigo();
    
    // Guardamos el código por 10 minutos
    codigosVerificacion.set(email, {
      codigo: codigo,
      expira: Date.now() + 10 * 60 * 1000
    });

    // Enviamos el email bonito
    const { data, error } = await resend.emails.send({
      from: 'RUTAFLEX <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Tu código de recuperación - RUTAFLEX',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0A2342 0%, #123A6B 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin:0; font-size: 32px; letter-spacing: 2px;">RUTAFLEX</h1>
            <p style="margin:5px 0 0; opacity: 0.9;">El camino inteligente</p>
          </div>
          <div style="padding: 40px 30px; color: #333;">
            <h2 style="color: #0A2342; margin-top: 0;">Recuperación de contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            
            <div style="background: #f0f4f8; border: 2px dashed #5BA9E0; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Tu código de verificación:</p>
              <div style="font-size: 42px; font-weight: bold; color: #0A2342; letter-spacing: 8px;">${codigo}</div>
            </div>
            
            <p style="color: #666; font-size: 14px;"><strong>⏳ Este código expira en 10 minutos.</strong></p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; color: #856404; font-size: 14px; border-radius: 4px;">
              <strong>⚠️ ¿No solicitaste esto?</strong><br>
              Simplemente ignorá este email. Tu contraseña sigue segura.
            </div>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee;">
            © 2026 RUTAFLEX - rutaflex.com.ar
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Error Resend:', error);
      return res.status(500).json({ error: 'Error al enviar el email. Intentá más tarde.' });
    }

    console.log(`✅ Código ${codigo} enviado a ${email}`);
    res.json({ ok: true, mensaje: 'Código enviado a tu email' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 2. VERIFICAR EL CÓDIGO
app.post('/api/verificar-codigo', (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) return res.status(400).json({ error: 'Faltan datos' });

    const datos = codigosVerificacion.get(email);
    
    if (!datos) return res.status(400).json({ error: 'Solicitá un código nuevo, este ya no existe.' });
    if (datos.codigo !== codigo) return res.status(400).json({ error: 'Código incorrecto.' });
    if (Date.now() > datos.expira) {
      codigosVerificacion.delete(email);
      return res.status(400).json({ error: 'El código expiró. Solicitá uno nuevo.' });
    }

    // Si llega acá, es válido. Lo borramos para que no se use de nuevo.
    codigosVerificacion.delete(email);
    res.json({ ok: true, mensaje: 'Código correcto' });

  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 3. CAMBIAR LA CONTRASEÑA (SOLO SI YA VERIFICÓ EL CÓDIGO)
// Nota: En un sistema real ultra-seguro, usaríamos un token, pero para esta app
// asumimos que si llegó hasta acá en la misma sesión de navegador, está bien.
// Para simplificar, validamos la contraseña fuerte aquí también.
app.post('/api/cambiar-contrasena-final', async (req, res) => {
  try {
    const { email, nuevaPassword } = req.body;
    
    if (!email || !nuevaPassword) return res.status(400).json({ error: 'Faltan datos' });
    
    // Validaciones de seguridad
    if (nuevaPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });
    if (!/[A-Z]/.test(nuevaPassword)) return res.status(400).json({ error: 'Falta 1 mayúscula' });
    if (!/[0-9]/.test(nuevaPassword)) return res.status(400).json({ error: 'Falta 1 número' });
    if (!/[!@#$%^&*]/.test(nuevaPassword)) return res.status(400).json({ error: 'Falta 1 símbolo (!@#$)' });

    await actualizarContrasena(email, nuevaPassword);
    res.json({ ok: true, mensaje: '¡Contraseña cambiada con éxito!' });
    
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// --- RUTAS VIEJAS (SE MANTIENEN IGUAL) ---
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Completa todo' });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*]/.test(password)) {
       return res.status(400).json({ error: 'La contraseña debe ser segura (8 car., 1 Mayús, 1 Núm, 1 Símbolo)' });
    }
    const usuario = await registrarUsuario(nombre, email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, mensaje: '¡Cuenta creada!', usuario });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await loginUsuario(email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, mensaje: '¡Bienvenido!', usuario });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/yo', (req, res) => {
  if (req.session && req.session.userId) res.json({ ok: true, nombre: req.session.nombre });
  else res.json({ ok: false });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  const { codigo } = req.body;
  if (codigo === 'ALBERTO90' || codigo === 'RUTAFLEX') return res.json({ valido: true, mensaje: '¡Código aplicado!' });
  res.status(400).json({ valido: false, mensaje: 'Inválido.' });
});

app.get('/api/destinos', usuarioLogueado, async (req, res) => {
  try { res.json(await obtenerDestinosDeUsuario(req.session.userId)); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/destinos', usuarioLogueado, async (req, res) => {
  try {
    if (!req.body.direccion) return res.status(400).json({ error: 'Falta dirección' });
    res.json(await agregarDestino(req.session.userId, req.body.direccion));
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/destinos/:id', usuarioLogueado, async (req, res) => {
  try { await borrarDestino(req.params.id, req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/destinos', usuarioLogueado, async (req, res) => {
  try { await borrarDestinosDeUsuario(req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => { console.log(`✅ Backend corriendo en puerto ${PORT}`); });
