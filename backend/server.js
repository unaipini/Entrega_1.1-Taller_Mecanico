/* 
 * =========================================================
 * Servidor principal - Sprint 1
 * =========================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ======================
// CONEXIÓN BASE DE DATOS
// ======================

const db = new Database(path.join(__dirname, 'taller.db'));

// ======================
// CREACIÓN DE TABLAS (SI NO EXISTEN)
// ======================

db.exec(`
CREATE TABLE IF NOT EXISTS maquina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  tipo TEXT,
  estado TEXT
);

CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  rol TEXT
);

CREATE TABLE IF NOT EXISTS incidencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descripcion TEXT,
  estado TEXT,
  id_maquina INTEGER,
  id_usuario_registra INTEGER,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS uso_maquina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_maquina INTEGER,
  id_usuario INTEGER,
  fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATETIME,
  FOREIGN KEY (id_maquina) REFERENCES maquina(id),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);
CREATE TABLE IF NOT EXISTS evento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_maquina INTEGER,
  id_usuario INTEGER,
  descripcion TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_maquina) REFERENCES maquina(id),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);
`);

// ======================
// INSERTAR DATOS INICIALES (SI ESTÁ VACÍO)
// ======================

const maquinasCount = db.prepare("SELECT COUNT(*) as total FROM maquina").get();

if (maquinasCount.total === 0) {
    db.exec(`
    INSERT INTO maquina (nombre, tipo, estado) VALUES
    ('CNC-01', 'Fresadora CNC', 'Operativa'),
    ('PR-02', 'Prensa Hidraulica', 'En mantenimiento'),
    ('EMB-03', 'Linea de Embalaje', 'Averiada');

    INSERT INTO usuario (nombre, rol) VALUES
    ('Ane Garcia', 'Tecnico'),
    ('Iker Martinez', 'Supervisor'),
    ('Leire Sanchez', 'Mantenimiento');
  `);
}

// ======================

const USUARIO_ACTUAL = {
    id: 1,
    nombre: '',
    rol: 'operario'
};

// ======================
// GET /api/maquinas
// ======================

app.get('/api/maquinas', (req, res) => {
    try {
        const maquinas = db.prepare(
            'SELECT id, nombre, tipo, estado FROM maquina ORDER BY nombre'
        ).all();

        res.json({ ok: true, data: maquinas });
    } catch (error) {
        console.error('[GET /api/maquinas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// ======================
// GET /api/usuarios
// ======================

app.get('/api/usuarios', (req, res) => {
    try {
        const usuarios = db.prepare(
            'SELECT id, nombre, rol FROM usuario ORDER BY nombre'
        ).all();

        res.json({ ok: true, data: usuarios });
    } catch (error) {
        console.error('[GET /api/usuarios]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// GET /api/incidencias/abiertas
// ======================

app.get('/api/incidencias/abiertas', (req, res) => {
    try {
        const incidencias = db.prepare(`
            SELECT 
                m.nombre AS maquina_nombre,
                m.tipo AS maquina_tipo,
                i.id AS incidencia_id,
                i.descripcion,
                i.estado,
                i.fecha,
                u.nombre AS registrado_por
            FROM incidencia i
            JOIN maquina m ON m.id = i.id_maquina
            JOIN usuario u ON u.id = i.id_usuario_registra
            WHERE i.estado IN ('Abierta', 'En Progreso')
            ORDER BY i.fecha DESC
        `).all();

        res.json({ ok: true, data: incidencias });
    } catch (error) {
        console.error('[GET /api/incidencias/abiertas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// ======================
// POST /api/incidencias
// ======================

app.post('/api/incidencias', (req, res) => {
    // 1. AHORA PEDIMOS EL id_usuario AL FRONTEND (TM-32)
    const { id_maquina, id_usuario, descripcion } = req.body;

    if (!id_maquina || !id_usuario || !descripcion || descripcion.trim() === '') {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios: máquina, usuario y descripción.' });
    }

    const descripcionLimpia = descripcion.trim();

    try {
        // --- INICIO REGLA ANTI-DUPLICADOS (Tarea de Asier - Sprint 1) ---
        const incidenciasAbiertas = db.prepare(`
            SELECT id, descripcion
            FROM incidencia
            WHERE id_maquina = ? AND estado IN ('Abierta', 'En Progreso')
        `).all(id_maquina);

        const primerasPalabras = (texto) => texto.toLowerCase().trim().split(/\s+/).slice(0, 4).join(' ');
        const claveNueva = primerasPalabras(descripcionLimpia);
        const esDuplicado = incidenciasAbiertas.some(inc => primerasPalabras(inc.descripcion) === claveNueva);

        if (esDuplicado) {
            return res.status(409).json({
                ok: false,
                mensaje: '⚠️ Ya existe una incidencia ABIERTA para esta máquina con un motivo similar.'
            });
        }
        // --- FIN REGLA ANTI-DUPLICADOS ---

        // 2. GUARDAMOS CON EL USUARIO REAL (TM-32)
        const resultado = db.prepare(`
            INSERT INTO incidencia (id_maquina, id_usuario_registra, descripcion, estado)
            VALUES (?, ?, ?, 'Abierta')
        `).run(id_maquina, id_usuario, descripcionLimpia);

        // 3. LÓGICA DE NOTIFICACIÓN (TM-35)
        // Buscamos los nombres para la alerta
        const maquinaInfo = db.prepare('SELECT nombre FROM maquina WHERE id = ?').get(id_maquina);
        const usuarioInfo = db.prepare('SELECT nombre, rol FROM usuario WHERE id = ?').get(id_usuario);
        
        // Simulamos un envío de email/notificación push en el servidor
        console.log(`\n🔔 [NOTIFICACIÓN DEL SISTEMA]`);
        console.log(`📩 Enviando aviso urgente a Supervisores...`);
        console.log(`   El operario ${usuarioInfo.nombre} ha registrado un fallo en la máquina ${maquinaInfo.nombre}.`);
        console.log(`   Motivo: "${descripcionLimpia}"\n`);

        res.status(201).json({
            ok: true,
            mensaje: `✅ Incidencia registrada. Se ha notificado a los supervisores del fallo en ${maquinaInfo.nombre}.`,
            id: resultado.lastInsertRowid
        });

    } catch (error) {
        console.error('[POST /api/incidencias]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error al guardar la incidencia.' });
    }
});


// ======================
// POST /api/uso/iniciar
// ======================

app.post('/api/uso/iniciar', (req, res) => {
    const { id_maquina, id_usuario } = req.body;

    if (!id_maquina || !id_usuario) {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios.' });
    }

    try {
        // Verificamos que no haya un uso activo
        const usoActivo = db.prepare(`
            SELECT * FROM uso_maquina
            WHERE id_maquina = ?
              AND fecha_fin IS NULL
        `).get(id_maquina);

        if (usoActivo) {
            return res.status(409).json({
                ok: false,
                mensaje: '⚠️ Esta máquina ya está en uso.'
            });
        }

        db.prepare(`
            INSERT INTO uso_maquina (id_maquina, id_usuario)
            VALUES (?, ?)
        `).run(id_maquina, id_usuario);

        res.status(201).json({
            ok: true,
            mensaje: '✅ Uso de máquina iniciado.'
        });

    } catch (error) {
        console.error('[POST /api/uso/iniciar]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// POST /api/uso/finalizar
// ======================

app.post('/api/uso/finalizar', (req, res) => {
    const { id_maquina } = req.body;

    if (!id_maquina) {
        return res.status(400).json({ ok: false, mensaje: 'ID máquina obligatorio.' });
    }

    try {
        const resultado = db.prepare(`
            UPDATE uso_maquina
            SET fecha_fin = CURRENT_TIMESTAMP
            WHERE id_maquina = ?
              AND fecha_fin IS NULL
        `).run(id_maquina);

        if (resultado.changes === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: 'No había ningún uso activo.'
            });
        }

        res.json({
            ok: true,
            mensaje: '✅ Uso finalizado.'
        });

    } catch (error) {
        console.error('[POST /api/uso/finalizar]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// GET /api/maquinas/:id/historial
// ======================

app.get('/api/maquinas/:id/historial', (req, res) => {
    const id_maquina = req.params.id;

    try {

        // Historial de uso
        const usos = db.prepare(`
            SELECT u.nombre, um.fecha_inicio, um.fecha_fin
            FROM uso_maquina um
            JOIN usuario u ON u.id = um.id_usuario
            WHERE um.id_maquina = ?
            ORDER BY um.fecha_inicio DESC
        `).all(id_maquina);

        // Incidencias de la máquina
        const incidencias = db.prepare(`
            SELECT descripcion, estado, fecha
            FROM incidencia
            WHERE id_maquina = ?
            ORDER BY fecha DESC
        `).all(id_maquina);

        res.json({
            ok: true,
            data: {
                usos,
                incidencias
            }
        });

    } catch (error) {
        console.error('[GET historial]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// POST /api/eventos
// ======================

app.post('/api/eventos', (req, res) => {
    const { id_maquina, id_usuario, descripcion } = req.body;

    if (!id_maquina || !id_usuario || !descripcion || descripcion.trim() === '') {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios.' });
    }

    try {

        // Verificamos que la máquina esté en uso
        const usoActivo = db.prepare(`
            SELECT * FROM uso_maquina
            WHERE id_maquina = ?
              AND fecha_fin IS NULL
        `).get(id_maquina);

        if (!usoActivo) {
            return res.status(400).json({
                ok: false,
                mensaje: 'La máquina no está en uso actualmente.'
            });
        }

        db.prepare(`
            INSERT INTO evento (id_maquina, id_usuario, descripcion)
            VALUES (?, ?, ?)
        `).run(id_maquina, id_usuario, descripcion.trim());

        res.status(201).json({
            ok: true,
            mensaje: '✅ Evento registrado correctamente.'
        });

    } catch (error) {
        console.error('[POST /api/eventos]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// POST /api/incidencias/:id/estado
// ======================

app.post('/api/incidencias/:id/estado', (req, res) => {
    const id = req.params.id;
    const { estado } = req.body;

    if (!['Abierta', 'En Progreso', 'Cerrada'].includes(estado)) {
        return res.status(400).json({ ok: false, mensaje: 'Estado inválido.' });
    }

    try {
        const resultado = db.prepare(`
            UPDATE incidencia
            SET estado = ?
            WHERE id = ?
        `).run(estado, id);

        if (resultado.changes === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: 'Incidencia no encontrada.'
            });
        }

        // 🔔 Si pasa a Cerrada → notificación en servidor
        if (estado === 'Cerrada') {
            const incidencia = db.prepare(`
                SELECT i.descripcion, m.nombre AS maquina_nombre
                FROM incidencia i
                JOIN maquina m ON m.id = i.id_maquina
                WHERE i.id = ?
            `).get(id);

            console.log(`\n🔧 [INCIDENCIA CERRADA]`);
            console.log(`   Máquina: ${incidencia.maquina_nombre}`);
            console.log(`   Motivo: ${incidencia.descripcion}\n`);
        }

        res.json({
            ok: true,
            mensaje: `Estado actualizado a "${estado}".`
        });

    } catch (error) {
        console.error('[POST cambiar estado]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ===================
// GET /api/metricas
// ===================
app.get('/api/metricas', (req, res) => {
    try {
        // Métrica 1: Cantidad de incidencias por estado
        const porEstado = db.prepare(`
            SELECT estado, COUNT(*) as total 
            FROM incidencia 
            GROUP BY estado
        `).all();

        // Métrica 2: Top máquinas con más incidencias
        const porMaquina = db.prepare(`
            SELECT m.nombre, COUNT(i.id) as total
            FROM maquina m
            JOIN incidencia i ON m.id = i.id_maquina
            GROUP BY m.nombre
            ORDER BY total DESC
        `).all();

        res.json({ 
            ok: true, 
            data: { porEstado, porMaquina } 
        });

    } catch (error) {
        console.error('[GET /api/metricas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener métricas.' });
    }
});

// ======================
// ARRANQUE DEL SERVIDOR
// ======================

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}/historial.html`);
});