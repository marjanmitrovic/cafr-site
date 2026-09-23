import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const CATEGORY = 'LOCAL_UNIT';

const INITIAL_UNITS = [
  {
    name: 'Unie českých fotbalových rozhodčích LFA',
    people: ['Bude doplněno'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích RKČ',
    people: ['Bude doplněno'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích Středočeského krajského fotbalového svazu',
    people: ['Josef Váňa', 'Petr Blažej'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích Jihočeského krajského fotbalového svazu',
    people: ['Jiří Pečenka', 'Marek Peterka'],
  },
  {
    name: 'Unie českých fotbalových rozhodčích Karlovarského kraje',
    people: ['Vladimír Melničuk', 'Slavomír Kozel'],
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
  {
    name: 'Unie českých fotbalových rozhodčích Jihomoravského kraje',
    people: ['Jakub Šmíd'],
  },
];

function orderFromUrl(url) {
  const match = String(url || '').match(/local-unit:\/\/(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 9999;
}

function orderUrl(order) {
  return `local-unit://${String(Math.max(1, Number(order) || 1)).padStart(3, '0')}`;
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hierarchyRank(name) {
  const value = normalize(name);
  if (/\blfa\b|ligova fotbalova asociace/.test(value)) return 0;
  if (/\brkc\b|ridici komise.*cechy|komise pro cechy/.test(value)) return 1;
  if (/\bofs\b|okresni/.test(value)) return 3;
  return 2;
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

async function syncRequiredUnits() {
  try {
    const existing = await prisma.document.findMany({
      where: { category: CATEGORY },
      orderBy: { createdAt: 'asc' },
    });
    let addedTopUnit = false;

    const requiredTopUnits = [
      'Unie českých fotbalových rozhodčích LFA',
      'Unie českých fotbalových rozhodčích RKČ',
    ];

    for (const requiredName of requiredTopUnits) {
      const exists = existing.some((item) => normalize(item.titleCs) === normalize(requiredName));
      if (!exists) {
        const current = await prisma.document.findMany({
          where: { category: CATEGORY },
          select: { url: true },
        });
        const maxOrder = current.reduce((max, item) => {
          const order = orderFromUrl(item.url);
          return Number.isFinite(order) && order < 9999 ? Math.max(max, order) : max;
        }, 0);

        await prisma.document.create({
          data: {
            titleCs: requiredName,
            titleEn: requiredName,
            descriptionCs: 'Bude doplněno',
            descriptionEn: 'Bude doplněno',
            category: CATEGORY,
            url: orderUrl(maxOrder + 1),
            visibility: 'PUBLIC',
            status: 'DRAFT',
          },
        });
        addedTopUnit = true;
        console.log(`[LOCAL UNITS] Added ${requiredName}.`);
      }
    }

    const karlovy = existing.find((item) => /Karlovarsk/i.test(String(item.titleCs || '')));
    const karlovyName = 'Unie českých fotbalových rozhodčích Karlovarského kraje';
    const karlovyPeople = 'Vladimír Melničuk, Slavomír Kozel';

    if (karlovy) {
      if (
        karlovy.titleCs !== karlovyName ||
        karlovy.titleEn !== karlovyName ||
        karlovy.descriptionCs !== karlovyPeople ||
        karlovy.descriptionEn !== karlovyPeople
      ) {
        await prisma.document.update({
          where: { id: karlovy.id },
          data: {
            titleCs: karlovyName,
            titleEn: karlovyName,
            descriptionCs: karlovyPeople,
            descriptionEn: karlovyPeople,
          },
        });
        console.log('[LOCAL UNITS] Updated Karlovarský kraj organizational unit.');
      }
    }

    const southMoraviaName = 'Unie českých fotbalových rozhodčích Jihomoravského kraje';
    const southMoravia = existing.find((item) => /Jihomoravsk/i.test(String(item.titleCs || '')));

    if (!southMoravia) {
      const maxOrder = existing.reduce((max, item) => {
        const order = orderFromUrl(item.url);
        return Number.isFinite(order) && order < 9999 ? Math.max(max, order) : max;
      }, 0);

      await prisma.document.create({
        data: {
          titleCs: southMoraviaName,
          titleEn: southMoraviaName,
          descriptionCs: 'Jakub Šmíd',
          descriptionEn: 'Jakub Šmíd',
          category: CATEGORY,
          url: `local-unit://${String(maxOrder + 1).padStart(3, '0')}`,
          visibility: 'PUBLIC',
          status: 'DRAFT',
        },
      });
      console.log('[LOCAL UNITS] Added Jihomoravský kraj organizational unit.');
    } else if (
      southMoravia.titleCs !== southMoraviaName ||
      southMoravia.titleEn !== southMoraviaName ||
      southMoravia.descriptionCs !== 'Jakub Šmíd' ||
      southMoravia.descriptionEn !== 'Jakub Šmíd'
    ) {
      await prisma.document.update({
        where: { id: southMoravia.id },
        data: {
          titleCs: southMoraviaName,
          titleEn: southMoraviaName,
          descriptionCs: 'Jakub Šmíd',
          descriptionEn: 'Jakub Šmíd',
        },
      });
      console.log('[LOCAL UNITS] Updated Jihomoravský kraj organizational unit.');
    }

    if (addedTopUnit) {
      await applyImportanceOrder();
      console.log('[LOCAL UNITS] Applied importance order: LFA, RKČ, krajské, okresní.');
    }
  } catch (error) {
    console.error('[LOCAL UNITS] Required-unit sync failed:', error);
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
    where: {
      category: CATEGORY,
      status: { not: 'ARCHIVED' },
    },
    orderBy: { createdAt: 'asc' },
  });
  return documents.map(unitResponse).sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff !== 0) return orderDiff;
    const rankDiff = hierarchyRank(a.name) - hierarchyRank(b.name);
    return rankDiff || a.name.localeCompare(b.name, 'cs');
  });
}

async function resequenceUnits(units) {
  await Promise.all(units.map((unit, index) => (
    prisma.document.update({
      where: { id: unit.id },
      data: { url: orderUrl(index + 1) },
    })
  )));
}

async function moveUnit(id, direction) {
  const units = await listUnits();
  const index = units.findIndex((unit) => unit.id === id);
  if (index === -1) return null;

  const offset = direction === 'up' ? -1 : 1;
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= units.length) return units[index];

  const reordered = [...units];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  await resequenceUnits(reordered);
  return reordered[targetIndex];
}

async function applyImportanceOrder() {
  const units = await listUnits();
  const ranked = [...units].sort((a, b) => {
    const rankDiff = hierarchyRank(a.name) - hierarchyRank(b.name);
    return rankDiff || a.order - b.order || a.name.localeCompare(b.name, 'cs');
  });
  await resequenceUnits(ranked);
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
              url: orderUrl(nextOrder),
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

      this.patch('/api/admin/local-units/:id/order', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        const direction = String(req.body?.direction || '').toLowerCase();
        if (!['up', 'down'].includes(direction)) {
          return res.status(400).json({ error: 'Direction must be up or down' });
        }

        try {
          const unit = await moveUnit(String(req.params.id), direction);
          if (!unit) return res.status(404).json({ error: 'Local organizational unit not found' });
          return res.json({ unit, units: await listUnits() });
        } catch (error) {
          console.error('[LOCAL UNITS] Reorder failed:', error);
          return res.status(500).json({ error: 'Could not reorder local organizational unit' });
        }
      });

      this.post('/api/admin/local-units/importance-order', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        try {
          await applyImportanceOrder();
          return res.json({ ok: true, units: await listUnits() });
        } catch (error) {
          console.error('[LOCAL UNITS] Importance ordering failed:', error);
          return res.status(500).json({ error: 'Could not apply importance order' });
        }
      });

      this.delete('/api/admin/local-units/:id', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        try {
          const target = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
          if (!target || target.category !== CATEGORY || target.status === 'ARCHIVED') {
            return res.status(404).json({ error: 'Local organizational unit not found' });
          }

          await prisma.document.update({
            where: { id: target.id },
            data: {
              status: 'ARCHIVED',
              visibility: 'ADMIN_ONLY',
            },
          });
          await resequenceUnits(await listUnits());
          return res.json({ ok: true });
        } catch (error) {
          console.error('[LOCAL UNITS] Delete failed:', error);
          return res.status(500).json({ error: 'Could not delete local organizational unit' });
        }
      });
    }

    const server = originalListen.apply(this, args);
    // Do not block Express startup while Neon/Render is waking up.
    // Seed defaults and synchronize required public units in the background.
    void (async () => {
      await seedInitialUnits();
      await syncRequiredUnits();
    })();
    return server;
  };
}
