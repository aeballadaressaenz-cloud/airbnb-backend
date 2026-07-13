const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');

/**
 * @swagger
 * /api/amenidades:
 *   get:
 *     summary: Listar todas las amenidades disponibles
 *     tags: [Amenidades]
 *     responses:
 *       200:
 *         description: Lista de amenidades
 *       500:
 *         description: Error del servidor
 */
router.get('/', async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .query('SELECT id_amenidad, nombre, icono, categoria FROM Amenidades ORDER BY categoria, nombre');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;