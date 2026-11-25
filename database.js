const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fecha_registro: { type: Date, default: Date.now },
  cuenta_activa: { type: Number, default: 1 },
  fecha_vencimiento: { type: Date, default: null },
  // NUEVO - REFERIDOS: 5% por amigo que paga, tope 30%, tope 500 sistema
  codigoReferido: { type: String, unique: true, sparse: true },
  referidoPor: { type: String, default: null },
  descuentoReferido: { type: Number, default: 0 },
  referidosQuePagaron: { type: Number, default: 0 },
  premioReferidoEntregado: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

const destinoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  direccion: { type: String, required: true },
  distancia: { type: String, default: '0.0' },
  tiempo: { type: Number, default: 0 },
  completado: { type: Boolean, default: false },
  fecha_creacion: { type: Date, default: Date.now }
});

const Destino = mongoose.model('Destino', destinoSchema);

// NUEVO - Generar código único tipo ALBERT1234
function generarCodigoReferido(nombre, email) {
  const base = (nombre || email || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'USER';
  const num = Math.floor(1000 + Math.random() * 9000);
  return base + num;
}

async function generarCodigoUnico(nombre, email) {
  for (let i = 0; i < 10; i++) {
    const codigo = generarCodigoReferido(nombre, email);
    const existe = await User.findOne({ codigoReferido: codigo });
    if (!existe) return codigo;
  }
  // Si por casualidad chocó 10 veces, agregar timestamp
  return (nombre || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) + Date.now().toString().slice(-4);
}

// NUEVO - Asegurar que un usuario viejo tenga código
async function asegurarCodigoReferido(user) {
  if (!user) return user;
  if (!user.codigoReferido) {
    user.codigoReferido = await generarCodigoUnico(user.nombre, user.email);
    await user.save().catch(()=>{});
  }
  return user;
}

async function registrarUsuario(nombre, email, password, codigoReferidoInvitacion = null) {
  const existe = await User.findOne({ email });
  if (existe) throw new Error('Email ya registrado');
  const passHash = await bcrypt.hash(password, 10);
  const fechaVenc = new Date();
  fechaVenc.setDate(fechaVenc.getDate() + 7); 
  const miCodigo = await generarCodigoUnico(nombre, email);
  // No permitir auto-referido ni código igual al propio
  let referidoPor = null;
  if (codigoReferidoInvitacion) {
    const limpio = String(codigoReferidoInvitacion).trim().toUpperCase();
    if (limpio && limpio !== miCodigo) {
      const invitador = await User.findOne({ codigoReferido: limpio });
      if (invitador) referidoPor = limpio;
    }
  }
  const u = new User({ 
    nombre, email, password: passHash, cuenta_activa: 1, fecha_vencimiento: fechaVenc,
    codigoReferido: miCodigo, referidoPor, descuentoReferido: 0, referidosQuePagaron: 0, premioReferidoEntregado: false
  });
  await u.save();
  return { 
    id: u._id, nombre: u.nombre, email: u.email, fecha_vencimiento: u.fecha_vencimiento,
    codigoReferido: u.codigoReferido, descuentoReferido: 0, referidosQuePagaron: 0, referidoPor: u.referidoPor
  };
}

async function loginUsuario(email, password) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email o contraseña incorrectos');
  if (user.cuenta_activa === 0) throw new Error('Tu cuenta fue cancelada. Contactá soporte.');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Email o contraseña incorrectos');
  await asegurarCodigoReferido(user);
  return { 
    id: user._id, nombre: user.nombre, email: user.email, fecha_vencimiento: user.fecha_vencimiento,
    codigoReferido: user.codigoReferido, descuentoReferido: user.descuentoReferido || 0,
    referidosQuePagaron: user.referidosQuePagaron || 0, referidoPor: user.referidoPor || null
  };
}

async function actualizarVencimiento(userId, diasExtra) {
  const user = await User.findById(userId);
  if (!user) throw new Error('Usuario no encontrado');
  let nuevaFecha = user.fecha_vencimiento && user.fecha_vencimiento > new Date() ? new Date(user.fecha_vencimiento) : new Date();
  nuevaFecha.setDate(nuevaFecha.getDate() + diasExtra);
  user.fecha_vencimiento = nuevaFecha;
  user.cuenta_activa = 1;
  await user.save();
  return { fecha_vencimiento: user.fecha_vencimiento };
}

async function buscarUsuarioPorEmail(email) { return await User.findOne({ email }); }

// NUEVO - Buscar usuario por su código de referido
async function buscarUsuarioPorCodigoReferido(codigo) {
  if (!codigo) return null;
  const user = await User.findOne({ codigoReferido: String(codigo).trim().toUpperCase() });
  if (!user) return null;
  return { id: user._id, nombre: user.nombre, email: user.email, codigoReferido: user.codigoReferido, descuentoReferido: user.descuentoReferido || 0 };
}

// NUEVO - ¿Quién invitó a este usuario que pagó?
async function obtenerReferidoPor(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  return user.referidoPor || null;
}

// NUEVO - ¿Cuántos premios de referidos ya se dieron en todo el sistema? Tope 500
async function contarReferidosTotales() {
  return await User.countDocuments({ premioReferidoEntregado: true });
}

// NUEVO - Datos de referidos para /api/yo y Perfil
async function obtenerDatosReferido(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  await asegurarCodigoReferido(user);
  return {
    codigoReferido: user.codigoReferido,
    descuentoReferido: user.descuentoReferido || 0,
    referidosQuePagaron: user.referidosQuePagaron || 0,
    premioReferidoEntregado: !!user.premioReferidoEntregado,
    referidoPor: user.referidoPor || null
  };
}

// NUEVO - Sumar 5% al invitador con tope 30%, y marcar al pagador como premiado
async function sumarDescuentoReferido(invitadorId, porcentaje, tope, pagadorId) {
  const invitador = await User.findById(invitadorId);
  if (!invitador) throw new Error('Invitador no encontrado');
  const pagador = pagadorId ? await User.findById(pagadorId) : null;
  if (pagador && pagador.premioReferidoEntregado) {
    return { ok: false, motivo: 'ya premiado', descuentoReferido: invitador.descuentoReferido || 0 };
  }
  const actual = invitador.descuentoReferido || 0;
  const nuevo = Math.min(tope, actual + (porcentaje || 5));
  const realmenteSumado = nuevo - actual;
  if (realmenteSumado > 0) {
    invitador.descuentoReferido = nuevo;
    invitador.referidosQuePagaron = (invitador.referidosQuePagaron || 0) + 1;
    await invitador.save();
  }
  if (pagador) {
    pagador.premioReferidoEntregado = true;
    await pagador.save();
  }
  return { ok: true, descuentoReferido: nuevo, sumado: realmenteSumado, referidosQuePagaron: invitador.referidosQuePagaron };
}

async function actualizarContrasena(email, nuevaPassword) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Usuario no encontrado');
  user.password = await bcrypt.hash(nuevaPassword, 10);
  await user.save();
  return { mensaje: 'Contraseña actualizada' };
}
async function cancelarSuscripcionUsuario(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('Usuario no encontrado');
  user.cuenta_activa = 0;
  await user.save();
  return { mensaje: 'Suscripción cancelada' };
}

async function obtenerDestinosDeUsuario(userId) { return await Destino.find({ userId: userId.toString() }).sort({ fecha_creacion: 1 }); }
async function agregarDestino(userId, direccion) { const d = new Destino({ userId: userId.toString(), direccion }); await d.save(); return d; }
async function borrarDestino(id, userId) { await Destino.deleteOne({ _id: id, userId: userId.toString() }); }
async function borrarDestinosDeUsuario(userId) { await Destino.deleteMany({ userId: userId.toString() }); }

module.exports = {
  registrarUsuario, loginUsuario, buscarUsuarioPorEmail, actualizarContrasena, 
  cancelarSuscripcionUsuario, obtenerDestinosDeUsuario, agregarDestino, 
  borrarDestino, borrarDestinosDeUsuario, actualizarVencimiento,
  buscarUsuarioPorCodigoReferido, obtenerReferidoPor, contarReferidosTotales,
  sumarDescuentoReferido, obtenerDatosReferido
};
