import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const CATEGORY = 'LOCAL_UNIT';

const INITIAL_UNITS = [
  {
    name: 'Unie českých fotbalových rozhodčích Středočeského krajského fotbalového svazu',
    people: ['Josef Váňa', 'Petr Blažej'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích Jihočeského krajského fotbalového svazu',
    people: ['Jiří Pečenka', 'Marek Peterka'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích Karlovarského fotbalového svazu',
    people: ['Slavomír Kozel'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích OFS Beroun',
    people: ['Jaroslav Mázdra'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích OFS Rakovník',
    people: ['Jan Beneš', 'Josef Váňa'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích OFS Kladno',
    people: ['Daniel Asník'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích OFS Nymburk',
    people: ['Pavel Kubečka', 'Karel Nehasil'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích OFS Kolín',
    people: ['Zdeněk Tasch'],
  },
];

function orderFromUrl(url) {
  const match = String(url || '').match(/local-unit:\/\/(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 9999;
}

function unitResponse(document) {
  return {
    id: document.id,
    name: document.titleCs,
    responsiblePersons: String(document.descriptionCs || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    order: orderFromUrl(document.url),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function seedInitialUnits() {
  try {
    const count = await prisma.document.count({ where: { category: CATEGORY } });
    if (count > 0) return;

    for (let index = 0; index < INITIAL_UNITS.length; index += 1) {
      const unit = INITIAL_UNITS[index];
      await prisma.document.create({
        data: {
          titleCs: unit.name,
          titleEn: unit.name,
          descriptionCs: unit.people.join(', '),
          descriptionEn: unit.people.join(', '),
          category: CATEGORY,
          url: `local-unit://${String(index + 1).padStart(3, '0')}`,
          visibility: 'PUBLIC',
          status: 'DRAFT',
        },
      });
    }

    console.log(`[LOCAL UNITS] Seeded ${INITIAL_UNITS.length} organizational units.`);
  } catch (error) {
    console.error('[LOCAL UNITS] Initial seed failed:', error);
  }
}

async function requireAdmin(req, res) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Administrator role is required' });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

async function listUnits() {
  const documents = await prisma.document.findMany({
    where: { category: CATEGORY },
    orderBy: { createdAt: 'asc' },
  });
  return documents.map(unitResponse).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'cs'));
}

if (!express.application.__ucfrLocalUnitsInstalled) {
  express.application.__ucfrLocalUnitsInstalled = true;

  express.application.listen = function ucfrListenWithLocalUnits(...args) {
    if (!this.__ucfrLocalUnitsRoutesRegistered) {
      this.__ucfrLocalUnitsRoutesRegistered = true;

      this.get('/api/local-units', async (_req, res) => {
        try {
          res.set('Cache-Control', 'no-store');
          return res.json(await listUnits());
        } catch (error) {
          console.error('[LOCAL UNITS] Public list failed:', error);
          return res.status(500).json({ error: 'Could not load local organizational units' });
        }
      });

      this.get('/api/admin/local-units', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;
        try {
          return res.json(await listUnits());
        } catch (error) {
          console.error('[LOCAL UNITS] Admin list failed:', error);
          return res.status(500).json({ error: 'Could not load local organizational units' });
        }
      });

      this.post('/api/admin/local-units', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        const name = String(req.body?.name || '').trim();
        const people = Array.isArray(req.body?.responsiblePersons)
          ? req.body.responsiblePersons.map((value) => String(value).trim()).filter(Boolean)
          : String(req.body?.responsiblePersons || '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean);

        if (!name || !people.length) {
          return res.status(400).json({ error: 'Name and at least one responsible person are required' });
        }

        try {
          const existing = await prisma.document.findMany({
            where: { category: CATEGORY },
            select: { url: true },
          });
          const maxOrder = existing.reduce((max, item) => Math.max(max, orderFromUrl(item.url)), 0);
          const nextOrder = Number.isFinite(maxOrder) ? maxOrder + 1 : existing.length + 1;

          const document = await prisma.document.create({
            data: {
              titleCs: name,
              titleEn: name,
              descriptionCs: people.join(', '),
              descriptionEn: people.join(', '),
              category: CATEGORY,
              url: `local-unit://${String(nextOrder).padStart(3, '0')}`,
              visibility: 'PUBLIC',
              status: 'DRAFT',
              createdById: actor.id,
            },
          });

          return res.status(201).json({ unit: unitResponse(document) });
        } catch (error) {
          console.error('[LOCAL UNITS] Create failed:', error);
          return res.status(500).json({ error: 'Could not create local organizational unit' });
        }
      });

      this.delete('/api/admin/local-units/:id', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        try {
          const target = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
          if (!target || target.category !== CATEGORY) {
            return res.status(404).json({ error: 'Local organizational unit not found' });
          }

          await prisma.document.delete({ where: { id: target.id } });
          return res.json({ ok: true });
        } catch (error) {
          console.error('[LOCAL UNITS] Delete failed:', error);
          return res.status(500).json({ error: 'Could not delete local organizational unit' });
        }
      });
    }

    const server = originalListen.apply(this, args);
    // Do not block Express startup while Neon/Render is waking up.
    // Seed initial units in the background after the server is already listening.
    void seedInitialUnits();
    return server;
  };
}
