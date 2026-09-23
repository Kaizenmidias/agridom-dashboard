const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { listDomainEvents, getDomainEvent } = require('../services/domain-event-repository');

const router = express.Router();
router.use(authenticateToken, requireCommercialAccess, requireCommercialAdmin);

router.get('/', async (req, res) => {
  try {
    res.json(await listDomainEvents({
      eventType: req.query.event_type,
      entityType: req.query.entity_type,
      entityId: req.query.entity_id,
      correlationId: req.query.correlation_id,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      pageSize: req.query.page_size,
    }));
  } catch (error) {
    console.error('Erro ao listar eventos de dominio:', error.message);
    res.status(500).json({ error: 'Nao foi possivel listar os eventos.' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'ID do evento invalido.' });
  try {
    const event = await getDomainEvent(id);
    if (!event) return res.status(404).json({ error: 'Evento nao encontrado.' });
    res.json({ event });
  } catch (error) {
    console.error('Erro ao carregar evento de dominio:', error.message);
    res.status(500).json({ error: 'Nao foi possivel carregar o evento.' });
  }
});

module.exports = router;
