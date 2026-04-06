require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── MIDDLEWARES ────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('.'));

// ─── AUTH MIDDLEWARES ────────────────────────────────────────────────────────
const requireAuth = async (req, res, next) => {
  const token = req.cookies.sayo_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!req.user) throw new Error("Usuário não encontrado");
    next();
  } catch (err) {
    res.status(401).json({ error: "Sessão inválida" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'ADMIN') return next();
  res.status(403).json({ error: "Acesso negado: apenas administradores." });
};

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Token ausente" });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user && email === 'viniyokoyamac@gmail.com') {
      user = await prisma.user.create({ data: { googleId, email, name, picture, role: 'ADMIN' } });
    }
    if (!user) return res.status(403).json({ error: "Acesso negado. E-mail não autorizado por um Administrador." });
    if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId, picture, name: user.name || name } });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('sayo_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, picture: user.picture, role: user.role } });
  } catch (e) {
    console.error("Auth Error:", e);
    res.status(401).json({ error: "Falha na autenticação" });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sayo_token');
  res.json({ success: true });
});

// ─── ADMIN: USERS ─────────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users);
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail obrigatório" });
  try {
    const user = await prisma.user.create({ data: { email, name, role: role || 'Vendedor' } });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "E-mail já cadastrado ou erro ao criar." });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Não é possível remover a si mesmo." });
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao deletar." });
  }
});

// ─── CONTACTS ─────────────────────────────────────────────────────────────────
app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' || req.user.role === 'Gerente' ? {} : { ownerId: req.user.id };
    const contacts = await prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, role, stage, source, score, tags, notes, companyId } = req.body;
    if (!name) return res.status(400).json({ error: "Nome obrigatório" });
    const contact = await prisma.contact.create({
      data: { name, email, phone, whatsapp, role, stage: stage || 'Lead', source, score: score || 50, tags, notes, companyId: companyId || null, ownerId: req.user.id }
    });
    res.json(contact);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, role, stage, source, score, tags, notes, companyId } = req.body;
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { name, email, phone, whatsapp, role, stage, source, score, tags, notes, companyId: companyId || null }
    });
    res.json(contact);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COMPANIES ────────────────────────────────────────────────────────────────
app.get('/api/companies', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' || req.user.role === 'Gerente' ? {} : { ownerId: req.user.id };
    const companies = await prisma.company.findMany({
      where,
      include: { _count: { select: { contacts: true, deals: true } }, owner: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/companies', requireAuth, async (req, res) => {
  try {
    const { name, cnpj, segment, size, website, phone, city, state } = req.body;
    if (!name) return res.status(400).json({ error: "Nome obrigatório" });
    const company = await prisma.company.create({
      data: { name, cnpj, segment, size, website, phone, city, state, ownerId: req.user.id }
    });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/companies/:id', requireAuth, async (req, res) => {
  try {
    const { name, cnpj, segment, size, website, phone, city, state } = req.body;
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { name, cnpj, segment, size, website, phone, city, state }
    });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/companies/:id', requireAuth, async (req, res) => {
  try {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEALS ────────────────────────────────────────────────────────────────────
app.get('/api/deals', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' || req.user.role === 'Gerente' ? {} : { ownerId: req.user.id };
    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(deals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/deals', requireAuth, async (req, res) => {
  try {
    const { name, value, stage, probability, closeDate, description, contactId, companyId } = req.body;
    if (!name) return res.status(400).json({ error: "Nome obrigatório" });
    const deal = await prisma.deal.create({
      data: {
        name, value: parseFloat(value) || 0, stage: stage || 'Prospecção',
        probability: parseInt(probability) || 50,
        closeDate: closeDate ? new Date(closeDate) : null,
        description, contactId: contactId || null, companyId: companyId || null,
        ownerId: req.user.id
      }
    });
    res.json(deal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    const { name, value, stage, probability, closeDate, description, contactId, companyId } = req.body;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        name, value: parseFloat(value) || 0, stage,
        probability: parseInt(probability) || 50,
        closeDate: closeDate ? new Date(closeDate) : null,
        description, contactId: contactId || null, companyId: companyId || null
      }
    });
    res.json(deal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ACTIVITIES ────────────────────────────────────────────────────────────────
app.get('/api/activities', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' || req.user.role === 'Gerente' ? {} : { ownerId: req.user.id };
    const activities = await prisma.activity.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' }
    });
    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/activities', requireAuth, async (req, res) => {
  try {
    const { type, title, date, notes, status } = req.body;
    if (!title || !date) return res.status(400).json({ error: "Título e data obrigatórios" });
    const activity = await prisma.activity.create({
      data: { type: type || 'tarefa', title, date: new Date(date), notes, status: status || 'pending', ownerId: req.user.id }
    });
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/activities/:id', requireAuth, async (req, res) => {
  try {
    const { type, title, date, notes, status } = req.body;
    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: { type, title, date: date ? new Date(date) : undefined, notes, status }
    });
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/activities/:id', requireAuth, async (req, res) => {
  try {
    await prisma.activity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const isManager = req.user.role === 'ADMIN' || req.user.role === 'Gerente';
    const filter = isManager ? {} : { ownerId: req.user.id };

    const [totalContacts, totalDeals, deals, pendingActivities] = await Promise.all([
      prisma.contact.count({ where: filter }),
      prisma.deal.count({ where: filter }),
      prisma.deal.findMany({ where: filter, select: { value: true, stage: true } }),
      prisma.activity.count({ where: { ...filter, status: 'pending' } }),
    ]);

    const totalRevenue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const stageCount = deals.reduce((acc, d) => { acc[d.stage] = (acc[d.stage] || 0) + 1; return acc; }, {});

    res.json({ totalContacts, totalDeals, totalRevenue, pendingActivities, stageCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SAYO CRM rodando na porta ${PORT}`));
