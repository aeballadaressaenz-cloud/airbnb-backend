const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { verificarToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/reservas:
 *   post:
 *     summary: Realizar una reserva simulada
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_alojamiento, fecha_entrada, fecha_salida, num_huespedes]
 *             properties:
 *               id_alojamiento:
 *                 type: integer
 *               fecha_entrada:
 *                 type: string
 *                 format: date
 *               fecha_salida:
 *                 type: string
 *                 format: date
 *               num_huespedes:
 *                 type: integer
 *               notas_huesped:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reserva creada exitosamente
 *       400:
 *         description: Fechas no disponibles o error de validación
 */
router.post('/', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const { id_alojamiento, fecha_entrada, fecha_salida,
                num_huespedes, notas_huesped } = req.body;
        const result = await pool.request()
            .input('id_alojamiento', sql.Int,      id_alojamiento)
            .input('id_huesped',     sql.Int,      req.user.id)
            .input('fecha_entrada',  sql.Date,     fecha_entrada)
            .input('fecha_salida',   sql.Date,     fecha_salida)
            .input('num_huespedes',  sql.Int,      num_huespedes)
            .input('notas_huesped',  sql.NVarChar, notas_huesped || null)
            .execute('sp_RealizarReserva');
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/reservas/historial:
 *   get:
 *     summary: Ver historial de reservas del usuario logueado
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reservas del usuario
 *       401:
 *         description: Token requerido
 */
router.get('/historial', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_huesped', sql.Int, req.user.id)
            .query('SELECT * FROM vw_HistorialReservas WHERE id_huesped = @id_huesped ORDER BY fecha_creacion DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/reservas/{id}:
 *   delete:
 *     summary: Cancelar una reserva
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reserva cancelada con monto de reembolso
 *       400:
 *         description: No se puede cancelar
 */
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const { motivo } = req.body;
        const result = await pool.request()
            .input('id_reserva', sql.Int,      req.params.id)
            .input('id_usuario', sql.Int,      req.user.id)
            .input('motivo',     sql.NVarChar, motivo || null)
            .execute('sp_CancelarReserva');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/reservas/{id}/valoracion:
 *   post:
 *     summary: Agregar valoración a una reserva completada
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [calificacion]
 *             properties:
 *               calificacion:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comentario:
 *                 type: string
 *     responses:
 *       201:
 *         description: Valoración registrada
 *       400:
 *         description: Reserva no completada o ya valorada
 */
router.post('/:id/valoracion', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const { calificacion, comentario } = req.body;

        // Si la reserva ya venció y sigue como pendiente/confirmada, la marcamos completada
        // (solo si le pertenece al usuario que hace la petición)
        await pool.request()
            .input('id_reserva', sql.Int, req.params.id)
            .input('id_huesped', sql.Int, req.user.id)
            .query(`UPDATE Reservas
                    SET estado = 'completada'
                    WHERE id_reserva = @id_reserva
                      AND id_huesped = @id_huesped
                      AND fecha_salida < GETDATE()
                      AND estado IN ('pendiente', 'confirmada')`);

        const result = await pool.request()
            .input('id_reserva',   sql.Int,      req.params.id)
            .input('id_huesped',   sql.Int,      req.user.id)
            .input('calificacion', sql.TinyInt,  calificacion)
            .input('comentario',   sql.NVarChar, comentario || null)
            .execute('sp_AgregarValoracion');
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;