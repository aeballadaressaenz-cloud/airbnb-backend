const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');

/**
 * @swagger
 * /api/ciudades:
 *   get:
 *     summary: Listar todas las ciudades disponibles
 *     tags: [Ciudades]
 *     responses:
 *       200:
 *         description: Lista de ciudades con su país
 *       500:
 *         description: Error del servidor
 */
router.get('/', async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT c.id_ciudad, c.nombre, c.estado_provincia,
                    p.nombre AS pais
                    FROM Ciudades c
                    JOIN Paises p ON c.id_pais = p.id_pais
                    ORDER BY p.nombre, c.nombre`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/ciudades/{id}/alojamientos:
 *   get:
 *     summary: Listar alojamientos de una ciudad específica
 *     tags: [Ciudades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la ciudad
 *     responses:
 *       200:
 *         description: Lista de alojamientos en esa ciudad
 *       500:
 *         description: Error del servidor
 */
router.get('/:id/alojamientos', async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_ciudad', sql.Int, req.params.id)
            .query('SELECT * FROM dbo.fn_AlojamientosPorCiudad(@id_ciudad)');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;