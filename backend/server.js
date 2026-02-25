/* 
 * =========================================================
 * Servidor principal - Sprint 1
 * =========================================================
 */

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const db = new Database(path.join(__dirname, 'taller.db'));

const USUARIO_ACTUAL = {
    id:     1,
    nombre: '',
    rol:    'operario'
};

// --- GET /api/maquinas ---
app.get('/api/maquinas', (req, res) => {
    try {
        const maquinas = db.prepare('SELECT id, nombre, tipo, estado FROM maquina ORDER BY nombre').all();
        res.json({ ok: true, data: maquinas });
    } catch (error) {
        console.error('[GET /api/maquinas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// --- GET /api/incidencias/abiertas ---
app.get('/api/incidencias/abiertas', (req, res) => {
    try {
        const incidencias = db.prepare(`
            SELECT m.nombre AS maquina_nombre, m.tipo AS maquina_tipo, i.id AS incidencia_id,
                   i.descripcion, i.estado, i.fecha, u.nombre AS registrado_por
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

// --- POST /api/incidencias ---
app.post('/api/incidencias', (req, res) => {
    const { id_maquina, descripcion } = req.body;

    if (!id_maquina || !descripcion || descripcion.trim() === '') {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios.' });
    }

    const descripcionLimpia = descripcion.trim();

    // TODO ASIER: Insertar aquí la regla anti-duplicados antes de guardar

    try {
        const resultado = db.prepare(`
            INSERT INTO incidencia (id_maquina, id_usuario_registra, descripcion, estado)
            VALUES (?, ?, ?, 'Abierta')
        `).run(id_maquina, USUARIO_ACTUAL.id, descripcionLimpia);

        res.status(201).json({ ok: true, mensaje: '✅ Incidencia registrada.', id: resultado.lastInsertRowid });
    } catch (error) {
        console.error('[POST /api/incidencias]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error al guardar.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
});