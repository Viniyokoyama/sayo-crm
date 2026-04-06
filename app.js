// ═══════════════════════════════════════════════════════════════
// SAYO CRM – app.js  (SPA Router + CRUD Frontend)
// ═══════════════════════════════════════════════════════════════
let currentUser = null;

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupModals();
  setupNavigation();
  setupSidebarToggle();
  setupTabSwitching();
  setupNotifications();
  setupSettings();

  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        currentUser = data.user;
        updateUserUI(data.user);
        enterApp();
        loadDashboardStats();
      }
    }
  } catch (e) {
    console.log("Sem sessão ativa.");
  }
});

// ─── GOOGLE LOGIN CALLBACK ────────────────────────────────────────────────────
window.handleGoogleLogin = async function (response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      updateUserUI(data.user);
      enterApp();
      loadDashboardStats();
    } else {
      showAlert(data.error || 'Falha no login');
    }
  } catch (e) {
    showAlert('Erro de conexão com o servidor.');
  }
};

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function updateUserUI(user) {
  const n = document.getElementById('sidebarName');
  const sa = document.getElementById('sidebarAvatar');
  const ta = document.getElementById('topbarAvatar');
  const al = document.getElementById('adminLabel');
  const an = document.getElementById('adminNav');
  const ur = document.getElementById('userRole');

  if (n) n.textContent = user.name || user.email;
  if (ur) ur.textContent = user.role;
  const initials = (user.name || user.email).substring(0, 2).toUpperCase();
  const img = user.picture ? `<img src="${user.picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials;
  if (sa) sa.innerHTML = img;
  if (ta) ta.innerHTML = img;

  if (user.role === 'ADMIN') {
    if (al) al.style.display = 'block';
    if (an) an.style.display = 'flex';
  }
}

function enterApp() {
  const ls = document.getElementById('loginScreen');
  if (ls) {
    ls.style.opacity = '0';
    ls.style.transition = 'opacity 0.5s ease';
    setTimeout(() => ls.classList.add('hidden'), 500);
  }
}

function showAlert(msg, type = 'error') {
  const container = document.getElementById('toastContainer');
  if (!container) return alert(msg);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ─── SIDEBAR TOGGLE ───────────────────────────────────────────────────────────
function setupSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (main) main.classList.toggle('sidebar-collapsed');
    });
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      location.reload();
    });
  }
}

// ─── SPA NAVIGATION ───────────────────────────────────────────────────────────
function setupNavigation() {
  document.addEventListener('click', (e) => {
    const item = e.target.closest('[data-page]');
    if (!item) return;
    e.preventDefault();
    navigateTo(item.getAttribute('data-page'));
    if (item.classList.contains('nav-item')) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    }
    const bread = document.getElementById('breadcrumb');
    if (bread && item.querySelector('.nav-label')) bread.textContent = item.querySelector('.nav-label').textContent;
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  const el = document.getElementById('page-' + page);
  if (el) { el.style.display = 'block'; el.classList.add('active'); }
  const handlers = { contacts: loadContacts, companies: loadCompanies, deals: loadDeals, pipeline: loadPipeline, activities: loadActivities, users: loadUsers, dashboard: loadDashboardStats };
  if (handlers[page]) handlers[page]();
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function setupModals() {
  document.addEventListener('click', (e) => {
    // Fechar ao clicar no overlay
    if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
    // Fechar pelo botão X
    if (e.target.closest('.modal-close') && !e.target.closest('.modal-close[onclick]')) {
      const m = e.target.closest('.modal-overlay');
      if (m) closeModal(m.id);
    }
    // Fechar pelos botões Cancelar (data-modal no footer)
    const cancelBtn = e.target.closest('[data-modal]');
    if (cancelBtn && !e.target.closest('.modal-overlay') === false) {
      // Só se for dentro de modal-footer ou topbar
      if (cancelBtn.closest('.modal-footer') || cancelBtn.closest('.topbar-right')) {
        const modal = document.getElementById(cancelBtn.getAttribute('data-modal'));
        if (modal) closeModal(modal.id);
      }
    }
    // Abrir modal pelo data-modal fora de modal
    const opener = e.target.closest('[data-modal]:not(.modal-footer [data-modal])');
    if (opener && !e.target.closest('.modal-overlay') && !opener.closest('.modal-footer')) {
      const modal = document.getElementById(opener.getAttribute('data-modal'));
      if (modal && modal.classList.contains('modal-overlay')) openModal(modal.id);
    }
  });

  // SAVE: Contact
  document.getElementById('saveContactBtn')?.addEventListener('click', saveContact);
  // SAVE: Company
  document.getElementById('saveCompanyBtn')?.addEventListener('click', saveCompany);
  // SAVE: Deal
  document.getElementById('saveDealBtn')?.addEventListener('click', saveDeal);
  // SAVE: Activity
  document.getElementById('saveActivityBtn')?.addEventListener('click', saveActivity);
  // SAVE: User
  document.getElementById('saveUserBtn')?.addEventListener('click', saveUser);

  // Quick Add buttons
  document.getElementById('newContactBtn')?.addEventListener('click', () => openNewContact());
  document.getElementById('newCompanyBtn')?.addEventListener('click', () => openModal('companyModal'));
  document.getElementById('newDealBtn')?.addEventListener('click', () => openNewDeal());
  document.getElementById('newDealBtn2')?.addEventListener('click', () => openNewDeal());
  document.getElementById('newActivityBtn')?.addEventListener('click', () => openModal('activityModal'));
  document.getElementById('newUserBtn')?.addEventListener('click', () => openModal('userModal'));
  document.getElementById('quickAddBtn')?.addEventListener('click', () => openModal('contactModal'));

  // Cancelar buttons nos modais (delegação)
  document.querySelectorAll('.modal-footer .btn-outline[data-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const modalId = btn.getAttribute('data-modal');
      closeModal(modalId);
    });
  });

  // Activity type buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Configure Pipeline
  document.getElementById('configurePipelineBtn')?.addEventListener('click', () => {
    openModal('pipelineConfigModal');
  });

  // Deal detail edit btn
  document.getElementById('dealDetailEditBtn')?.addEventListener('click', () => {
    const dealId = document.getElementById('dealDetailModal').dataset.dealId;
    if (dealId) {
      document.getElementById('dealDetailModal').classList.remove('active');
      editDeal(dealId);
    }
  });
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('active');
    m.querySelectorAll('input, textarea, select').forEach(i => { if (i.name !== 'type') i.value = ''; });
  }
}

function openNewContact() {
  document.getElementById('contactModalTitle').textContent = 'Novo Contato';
  document.getElementById('saveContactBtn').dataset.editId = '';
  // Reset tabs
  document.querySelectorAll('#contactModal .mtab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('#contactModal .mtab-content').forEach((t, i) => t.classList.toggle('active', i === 0));
  openModal('contactModal');
}

function openNewDeal() {
  const el = document.getElementById('dealModalTitle');
  if (el) el.textContent = 'Novo Negócio';
  const btn = document.getElementById('saveDealBtn');
  if (btn) btn.dataset.editId = '';
  openModal('dealModal');
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────
function setupTabSwitching() {
  // Modal tabs (.mtab → .mtab-content)
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.mtab');
    if (tab) {
      const container = tab.closest('.modal-body');
      if (!container) return;
      const tabName = tab.getAttribute('data-mtab');
      container.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.mtab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = container.querySelector(`#mtab-${tabName}`);
      if (content) content.classList.add('active');
    }

    // Email tabs
    const etab = e.target.closest('.etab');
    if (etab) {
      const page = etab.closest('.page');
      if (!page) return;
      const tabName = etab.getAttribute('data-etab');
      page.querySelectorAll('.etab').forEach(t => t.classList.remove('active'));
      page.querySelectorAll('.email-tab-content').forEach(c => c.classList.remove('active'));
      etab.classList.add('active');
      const content = page.querySelector(`#etab-${tabName}`);
      if (content) content.classList.add('active');
    }

    // Report tabs
    const rtab = e.target.closest('.rtab');
    if (rtab) {
      const page = rtab.closest('.page');
      if (!page) return;
      const tabName = rtab.getAttribute('data-rtab');
      page.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
      page.querySelectorAll('.rtab-content').forEach(c => c.classList.remove('active'));
      rtab.classList.add('active');
      const content = page.querySelector(`#rtab-${tabName}`);
      if (content) content.classList.add('active');
    }
  });
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
function setupNotifications() {
  const bell = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  if (!bell || !panel) return;

  // Estado inicial: escondido
  panel.style.display = 'none';

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    // Remover dot ao abrir
    if (!isOpen) {
      const dot = bell.querySelector('.notif-dot');
      if (dot) dot.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !bell.contains(e.target)) {
      panel.style.display = 'none';
    }
  });

  document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    showAlert('Todas notificações marcadas como lidas', 'success');
  });
}

// ─── SETTINGS TABS ───────────────────────────────────────────────────────────
function setupSettings() {
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-nav-item[data-stab]');
    if (!item) return;
    const tabName = item.getAttribute('data-stab');
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.stab').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    const tab = document.getElementById(`stab-${tabName}`);
    if (tab) tab.classList.add('active');
  });

  // Invite user btn na aba de usuários de configurações
  document.getElementById('inviteUserBtn')?.addEventListener('click', () => openModal('userModal'));
}

// ─── PIPELINE CONFIG ─────────────────────────────────────────────────────────
window.addPipelineStage = function() {
  const editor = document.getElementById('pipelineStagesEditor');
  if (!editor) return;
  const colors = ['#7B2FBE','#0984E3','#E17055','#FDCB6E','#00B894','#E91E8C','#5B8DEF'];
  const color = colors[editor.children.length % colors.length];
  const row = document.createElement('div');
  row.className = 'pipeline-stage-row';
  row.innerHTML = `<span class="stage-drag">⠿</span><div class="stage-color-dot" style="background:${color}"></div><input type="text" value="Nova Etapa" class="form-input" style="flex:1"><button class="btn-sm" style="background:#fff0ef;color:#e17055;border:none;border-radius:8px;padding:6px 10px;cursor:pointer" onclick="this.closest('.pipeline-stage-row').remove()">🗑️</button>`;
  editor.appendChild(row);
};

window.savePipelineConfig = function() {
  const rows = document.querySelectorAll('#pipelineStagesEditor .pipeline-stage-row input');
  const stages = Array.from(rows).map(i => i.value.trim()).filter(Boolean);
  if (stages.length === 0) return showAlert('Adicione pelo menos uma etapa', 'error');
  showAlert(`Pipeline atualizado com ${stages.length} etapas!`, 'success');
  document.getElementById('pipelineConfigModal').classList.remove('active');
  // Recarregar pipeline com novas etapas
  loadPipeline();
};

// ─── DEAL DETAIL ─────────────────────────────────────────────────────────────
function openDealDetail(deal) {
  const modal = document.getElementById('dealDetailModal');
  if (!modal) return;
  modal.dataset.dealId = deal.id;

  document.getElementById('dealDetailTitle').textContent = deal.name;

  const stageColor = { 'Prospecção': '#7B2FBE', 'Qualificação': '#0984E3', 'Proposta': '#E17055', 'Negociação': '#FDCB6E', 'Fechamento': '#00B894' };
  const color = stageColor[deal.stage] || '#999';

  document.getElementById('dealDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="info-box">
        <label>Valor do Negócio</label>
        <div class="val" style="font-size:22px;color:#7B2FBE">${formatCurrency(deal.value)}</div>
      </div>
      <div class="info-box">
        <label>Etapa</label>
        <div><span style="background:${color}22;color:${color};padding:4px 12px;border-radius:99px;font-size:13px;font-weight:700">${deal.stage}</span></div>
      </div>
      <div class="info-box">
        <label>Probabilidade</label>
        <div class="val">${deal.probability || 0}%</div>
      </div>
      <div class="info-box">
        <label>Previsão de Fechamento</label>
        <div class="val">${formatDate(deal.closeDate)}</div>
      </div>
    </div>
    ${deal.contact ? `<div class="info-box" style="margin-bottom:12px"><label>Contato</label><div class="val">👤 ${deal.contact.name}</div></div>` : ''}
    ${deal.company ? `<div class="info-box" style="margin-bottom:12px"><label>Empresa</label><div class="val">🏢 ${deal.company.name}</div></div>` : ''}
    ${deal.owner ? `<div class="info-box" style="margin-bottom:12px"><label>Responsável</label><div class="val">🧑‍💼 ${deal.owner.name}</div></div>` : ''}
    ${deal.description ? `<div class="info-box" style="margin-bottom:12px"><label>Descrição</label><div style="font-size:13px;color:#636e72;margin-top:4px">${deal.description}</div></div>` : ''}
    <div style="margin-top:20px">
      <h4 style="font-size:13px;font-weight:700;color:#636e72;margin-bottom:12px">📋 HISTÓRICO DE ATIVIDADE</h4>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px;background:#f8f9fa;border-radius:10px">
          <div style="width:30px;height:30px;background:rgba(123,47,190,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">✅</div>
          <div><div style="font-size:13px;font-weight:600">Negócio criado</div><div style="font-size:11px;color:#999">${formatDate(deal.createdAt || new Date())}</div></div>
        </div>
      </div>
    </div>
  `;
  openModal('dealDetailModal');
}
window.openDealDetail = openDealDetail;


// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return;
    const stats = await res.json();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpiLeads', stats.totalContacts.toLocaleString('pt-BR'));
    set('kpiRevenue', formatCurrency(stats.totalRevenue));
    set('kpiConv', `${stats.totalDeals} negócios`);
  } catch (e) { console.error(e); }
}

// ─── CONTACTS ─────────────────────────────────────────────────────────────────
let allContacts = [];

async function loadContacts() {
  try {
    const res = await fetch('/api/contacts');
    allContacts = await res.json();
    document.getElementById('contactsSubtitle').textContent = `${allContacts.length} contatos cadastrados`;
    renderContactsTable(allContacts);
  } catch (e) { showAlert('Erro ao carregar contatos'); }
}

function renderContactsTable(contacts) {
  const tbody = document.getElementById('contactsBody');
  if (!tbody) return;

  const stageColors = { 'Lead': '#7B2FBE', 'Qualificado': '#0984E3', 'Oportunidade': '#00B894', 'Cliente': '#00B894', 'Inativo': '#636E72' };

  tbody.innerHTML = contacts.length === 0
    ? `<tr><td colspan="11" style="text-align:center;padding:40px;color:#999">Nenhum contato cadastrado. <a href="#" onclick="openNewContact();return false;">Adicione o primeiro!</a></td></tr>`
    : contacts.map(c => `
      <tr>
        <td><input type="checkbox"></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.email || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.company?.name || '-'}</td>
        <td><span style="background:${stageColors[c.stage] || '#999'}22;color:${stageColors[c.stage] || '#999'};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">${c.stage}</span></td>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:6px;background:#eee;border-radius:3px"><div style="width:${c.score}%;height:100%;background:#7B2FBE;border-radius:3px"></div></div>${c.score}</div></td>
        <td>${c.source || '-'}</td>
        <td>${c.owner?.name || '-'}</td>
        <td>${formatDate(c.createdAt)}</td>
        <td>
          <button onclick="editContact('${c.id}')" style="border:none;background:none;cursor:pointer;color:#7B2FBE;font-size:14px">✏️</button>
          <button onclick="deleteContact('${c.id}')" style="border:none;background:none;cursor:pointer;color:#e17055;font-size:14px">🗑️</button>
        </td>
      </tr>
    `).join('');
}

async function saveContact() {
  const editId = document.getElementById('saveContactBtn').dataset.editId;
  const data = {
    name: document.getElementById('cName').value,
    email: document.getElementById('cEmail').value,
    phone: document.getElementById('cPhone').value,
    whatsapp: document.getElementById('cWhatsapp').value,
    role: document.getElementById('cRole').value,
    stage: document.getElementById('cStage').value,
    source: document.getElementById('cSource').value,
    score: parseInt(document.getElementById('cScore').value) || 50,
    tags: document.getElementById('cTags').value,
    notes: document.getElementById('cNotes').value,
  };
  if (!data.name) return showAlert('Nome é obrigatório', 'error');

  try {
    const url = editId ? `/api/contacts/${editId}` : '/api/contacts';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) {
      closeModal('contactModal');
      showAlert(editId ? 'Contato atualizado!' : 'Contato criado!', 'success');
      loadContacts();
    } else {
      const err = await res.json();
      showAlert(err.error || 'Erro ao salvar', 'error');
    }
  } catch (e) { showAlert('Erro de conexão', 'error'); }
}

async function editContact(id) {
  const contact = allContacts.find(c => c.id === id);
  if (!contact) return;
  document.getElementById('contactModalTitle').textContent = 'Editar Contato';
  document.getElementById('saveContactBtn').dataset.editId = id;
  document.getElementById('cName').value = contact.name || '';
  document.getElementById('cEmail').value = contact.email || '';
  document.getElementById('cPhone').value = contact.phone || '';
  document.getElementById('cWhatsapp').value = contact.whatsapp || '';
  document.getElementById('cRole').value = contact.role || '';
  document.getElementById('cStage').value = contact.stage || 'Lead';
  document.getElementById('cSource').value = contact.source || '';
  document.getElementById('cScore').value = contact.score || 50;
  document.getElementById('cTags').value = contact.tags || '';
  document.getElementById('cNotes').value = contact.notes || '';
  openModal('contactModal');
}

async function deleteContact(id) {
  if (!confirm('Deseja remover este contato?')) return;
  try {
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) { showAlert('Contato removido', 'success'); loadContacts(); }
  } catch (e) { showAlert('Erro ao remover', 'error'); }
}

// Contact Search
document.getElementById('contactSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderContactsTable(allContacts.filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)));
});

// ─── COMPANIES ────────────────────────────────────────────────────────────────
let allCompanies = [];

async function loadCompanies() {
  try {
    const res = await fetch('/api/companies');
    allCompanies = await res.json();
    document.getElementById('companiesSubtitle').textContent = `${allCompanies.length} empresas cadastradas`;
    renderCompaniesGrid(allCompanies);
  } catch (e) { showAlert('Erro ao carregar empresas'); }
}

function renderCompaniesGrid(companies) {
  const grid = document.getElementById('companiesGrid');
  if (!grid) return;
  grid.innerHTML = companies.length === 0
    ? `<div style="text-align:center;padding:60px;color:#999;grid-column:1/-1">Nenhuma empresa cadastrada. <a href="#" onclick="openModal('companyModal');return false;">Adicione a primeira!</a></div>`
    : companies.map(c => `
      <div class="card" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:20px;font-weight:800;margin-bottom:4px">${c.name}</div>
            <div style="font-size:12px;color:#999">${c.segment || 'Sem segmento'} · ${c.size || '-'}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="editCompany('${c.id}')" style="border:none;background:#f5f5f5;border-radius:8px;padding:6px 10px;cursor:pointer">✏️</button>
            <button onclick="deleteCompany('${c.id}')" style="border:none;background:#fff0ef;border-radius:8px;padding:6px 10px;cursor:pointer">🗑️</button>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:16px;font-size:13px;color:#636e72">
          <div>👥 ${c._count?.contacts || 0} contatos</div>
          <div>💼 ${c._count?.deals || 0} negócios</div>
        </div>
        ${c.city ? `<div style="margin-top:8px;font-size:12px;color:#999">📍 ${c.city}, ${c.state || ''}</div>` : ''}
        ${c.website ? `<a href="${c.website}" target="_blank" style="font-size:12px;color:#7B2FBE;display:block;margin-top:6px">🌐 ${c.website}</a>` : ''}
      </div>
    `).join('');
}

async function saveCompany() {
  const editId = document.getElementById('saveCompanyBtn').dataset.editId;
  const data = {
    name: document.getElementById('coName').value,
    cnpj: document.getElementById('coCNPJ').value,
    segment: document.getElementById('coSegment').value,
    size: document.getElementById('coSize').value,
    website: document.getElementById('coSite').value,
    phone: document.getElementById('coPhone').value,
    city: document.getElementById('coCity').value,
    state: document.getElementById('coState').value,
  };
  if (!data.name) return showAlert('Nome é obrigatório', 'error');
  try {
    const url = editId ? `/api/companies/${editId}` : '/api/companies';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { closeModal('companyModal'); showAlert(editId ? 'Empresa atualizada!' : 'Empresa criada!', 'success'); loadCompanies(); }
    else { const err = await res.json(); showAlert(err.error, 'error'); }
  } catch (e) { showAlert('Erro de conexão', 'error'); }
}

function editCompany(id) {
  const c = allCompanies.find(x => x.id === id);
  if (!c) return;
  document.getElementById('companyModalTitle').textContent = 'Editar Empresa';
  document.getElementById('saveCompanyBtn').dataset.editId = id;
  document.getElementById('coName').value = c.name || '';
  document.getElementById('coCNPJ').value = c.cnpj || '';
  document.getElementById('coSegment').value = c.segment || '';
  document.getElementById('coSize').value = c.size || '';
  document.getElementById('coSite').value = c.website || '';
  document.getElementById('coPhone').value = c.phone || '';
  document.getElementById('coCity').value = c.city || '';
  document.getElementById('coState').value = c.state || '';
  openModal('companyModal');
}

async function deleteCompany(id) {
  if (!confirm('Deseja remover esta empresa?')) return;
  try {
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (res.ok) { showAlert('Empresa removida', 'success'); loadCompanies(); }
  } catch (e) { showAlert('Erro ao remover', 'error'); }
}

document.getElementById('companySearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderCompaniesGrid(allCompanies.filter(c => c.name.toLowerCase().includes(q)));
});

// ─── DEALS ────────────────────────────────────────────────────────────────────
let allDeals = [];

async function loadDeals() {
  try {
    const res = await fetch('/api/deals');
    allDeals = await res.json();
    document.getElementById('dealsSubtitle').textContent = `${allDeals.length} negócios ativos`;
    renderDealsTable(allDeals);
  } catch (e) { showAlert('Erro ao carregar negócios'); }
}

function renderDealsTable(deals) {
  const tbody = document.getElementById('dealsBody');
  if (!tbody) return;
  const stageColor = { 'Prospecção': '#7B2FBE', 'Qualificação': '#0984E3', 'Proposta': '#E17055', 'Negociação': '#FDCB6E', 'Fechamento': '#00B894' };
  tbody.innerHTML = deals.length === 0
    ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:#999">Nenhum negócio cadastrado. <a href="#" onclick="openModal('dealModal');return false;">Adicione o primeiro!</a></td></tr>`
    : deals.map(d => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td>${formatCurrency(d.value)}</td>
        <td><span style="background:${stageColor[d.stage] || '#999'}22;color:${stageColor[d.stage] || '#999'};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">${d.stage}</span></td>
        <td>${d.probability}%</td>
        <td>${d.contact?.name || '-'}</td>
        <td>${d.company?.name || '-'}</td>
        <td>${d.owner?.name || '-'}</td>
        <td>${formatDate(d.closeDate)}</td>
        <td>
          <button onclick="editDeal('${d.id}')" style="border:none;background:none;cursor:pointer;color:#7B2FBE;font-size:14px">✏️</button>
          <button onclick="deleteDeal('${d.id}')" style="border:none;background:none;cursor:pointer;color:#e17055;font-size:14px">🗑️</button>
        </td>
      </tr>
    `).join('');
}

async function saveDeal() {
  const editId = document.getElementById('saveDealBtn').dataset.editId;
  const data = {
    name: document.getElementById('dName').value,
    value: document.getElementById('dValue').value,
    stage: document.getElementById('dStage').value,
    probability: document.getElementById('dProb').value,
    closeDate: document.getElementById('dCloseDate').value,
    description: document.getElementById('dDesc').value,
  };
  if (!data.name) return showAlert('Nome é obrigatório', 'error');
  try {
    const url = editId ? `/api/deals/${editId}` : '/api/deals';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { closeModal('dealModal'); showAlert(editId ? 'Negócio atualizado!' : 'Negócio criado!', 'success'); loadDeals(); loadPipeline(); }
    else { const err = await res.json(); showAlert(err.error, 'error'); }
  } catch (e) { showAlert('Erro de conexão', 'error'); }
}

function editDeal(id) {
  const d = allDeals.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dealModalTitle').textContent = 'Editar Negócio';
  document.getElementById('saveDealBtn').dataset.editId = id;
  document.getElementById('dName').value = d.name || '';
  document.getElementById('dValue').value = d.value || '';
  document.getElementById('dStage').value = d.stage || 'Prospecção';
  document.getElementById('dProb').value = d.probability || 50;
  document.getElementById('dCloseDate').value = d.closeDate ? d.closeDate.split('T')[0] : '';
  document.getElementById('dDesc').value = d.description || '';
  openModal('dealModal');
}

async function deleteDeal(id) {
  if (!confirm('Deseja remover este negócio?')) return;
  try {
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (res.ok) { showAlert('Negócio removido', 'success'); loadDeals(); loadPipeline(); }
  } catch (e) { showAlert('Erro ao remover', 'error'); }
}

// ─── PIPELINE (KANBAN) ────────────────────────────────────────────────────────
let pipelineStages = ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento'];

async function loadPipeline() {
  try {
    const res = await fetch('/api/deals');
    const deals = await res.json();
    allDeals = deals;
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    const colors = { 'Prospecção': '#7B2FBE', 'Qualificação': '#0984E3', 'Proposta': '#E17055', 'Negociação': '#FDCB6E', 'Fechamento': '#00B894' };

    board.innerHTML = pipelineStages.map(stage => {
      const stageDels = deals.filter(d => d.stage === stage);
      const stageValue = stageDels.reduce((sum, d) => sum + (d.value || 0), 0);
      const color = colors[stage] || '#7B2FBE';
      return `
        <div class="kanban-col" data-stage="${stage}" ondragover="event.preventDefault();this.querySelector('.kanban-cards').classList.add('drag-over')" ondragleave="this.querySelector('.kanban-cards').classList.remove('drag-over')" ondrop="dropDeal(event,'${stage}')">
          <div class="kanban-col-header" style="border-bottom-color:${color}">
            <span style="color:${color};font-size:13px;font-weight:700">${stage}</span>
            <span class="kanban-count" style="background:${color}22;color:${color}">${stageDels.length}</span>
          </div>
          <div style="font-size:12px;color:#999;padding:6px 16px 8px;font-weight:600">${formatCurrency(stageValue)}</div>
          <div class="kanban-cards" id="kanban-${stage.replace(/\s/g, '_')}">
            ${stageDels.map(d => `
              <div class="kanban-card" draggable="true" data-deal-id="${d.id}" ondragstart="dragDeal(event,'${d.id}')" onclick="openDealDetail(allDeals.find(x=>x.id==='${d.id}'))">
                <div class="kanban-card-title" style="font-size:13px;font-weight:600;margin-bottom:5px">${d.name}</div>
                <div class="kanban-card-value" style="font-size:15px;font-weight:800;color:${color};margin-bottom:6px">${formatCurrency(d.value)}</div>
                ${d.contact ? `<div style="font-size:12px;color:#636e72;margin-bottom:8px">👤 ${d.contact.name}</div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:11px;color:#999">${d.probability || 0}% fechamento</span>
                  <div style="display:flex;gap:4px">
                    <button onclick="event.stopPropagation();editDeal('${d.id}')" style="border:none;background:#f5f5f5;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer">✏️</button>
                    <button onclick="event.stopPropagation();deleteDeal('${d.id}')" style="border:none;background:#fff0ef;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer;color:#e17055">🗑️</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <button onclick="openNewDeal()" style="margin:8px;padding:10px;border:1.5px dashed #e0e0e0;background:none;border-radius:10px;cursor:pointer;color:#999;font-size:12.5px;width:calc(100% - 16px);font-family:inherit;transition:all 0.2s" onmouseover="this.style.borderColor='#7B2FBE';this.style.color='#7B2FBE'" onmouseout="this.style.borderColor='#e0e0e0';this.style.color='#999'">+ Novo Negócio</button>
        </div>
      `;
    }).join('');

    // Update subtitle
    const total = deals.reduce((s, d) => s + (d.value || 0), 0);
    const sub = document.getElementById('pipelineSubtitle');
    if (sub) sub.textContent = `${deals.length} negócios · ${formatCurrency(total)} no pipeline`;
  } catch (e) { showAlert('Erro ao carregar pipeline'); }
}

// Drag & Drop Pipeline
let draggingDealId = null;
function dragDeal(e, id) { draggingDealId = id; e.dataTransfer.effectAllowed = 'move'; }
async function dropDeal(e, newStage) {
  e.preventDefault();
  e.currentTarget.querySelector('.kanban-cards')?.classList.remove('drag-over');
  if (!draggingDealId) return;
  try {
    await fetch(`/api/deals/${draggingDealId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStage }) });
    showAlert(`Negócio movido para ${newStage}!`, 'success');
    loadPipeline();
  } catch (e) { showAlert('Erro ao mover negócio', 'error'); }
  draggingDealId = null;
}
window.dragDeal = dragDeal;
window.dropDeal = dropDeal;
window.openNewDeal = openNewDeal;

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────
let allActivities = [];

async function loadActivities() {
  try {
    const res = await fetch('/api/activities');
    allActivities = await res.json();
    renderActivities(allActivities);
    const badge = document.getElementById('activitiesBadge');
    if (badge) badge.textContent = allActivities.filter(a => a.status === 'pending').length;
  } catch (e) { showAlert('Erro ao carregar atividades'); }
}

function renderActivities(activities) {
  const container = document.getElementById('activitySections');
  if (!container) return;

  const today = new Date().toDateString();
  const pending = activities.filter(a => a.status === 'pending');
  const done = activities.filter(a => a.status === 'done');

  const icons = { tarefa: '📋', ligacao: '📞', reuniao: '🗓️', email: '✉️', whatsapp: '💬' };

  const renderList = (acts) => acts.length === 0 ? '<p style="color:#999;font-size:13px;padding:12px 0">Nenhuma atividade aqui</p>' : acts.map(a => `
    <div class="card" style="padding:16px;margin-bottom:12px;display:flex;gap:16px;align-items:flex-start">
      <div style="font-size:24px">${icons[a.type] || '📋'}</div>
      <div style="flex:1">
        <div style="font-weight:600;margin-bottom:4px">${a.title}</div>
        <div style="font-size:12px;color:#999">${formatDate(a.date)} · ${a.owner?.name || '-'}</div>
        ${a.notes ? `<div style="font-size:13px;color:#636e72;margin-top:6px">${a.notes}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${a.status === 'pending' ? `<button onclick="completeActivity('${a.id}')" style="border:none;background:#edfdf9;color:#00b894;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px">✅ Concluir</button>` : '<span style="font-size:12px;color:#00b894">✅ Feito</span>'}
        <button onclick="deleteActivity('${a.id}')" style="border:none;background:#fff0ef;color:#e17055;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px">🗑️</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <h3 style="margin-bottom:12px;font-size:14px;color:#636e72">⏳ PENDENTES (${pending.length})</h3>
    ${renderList(pending)}
    <h3 style="margin:24px 0 12px;font-size:14px;color:#636e72">✅ CONCLUÍDAS (${done.length})</h3>
    ${renderList(done)}
  `;
}

async function saveActivity() {
  const activeType = document.querySelector('.type-btn.active')?.dataset.type || 'tarefa';
  const data = {
    type: activeType,
    title: document.getElementById('aTitle').value,
    date: document.getElementById('aDate').value,
    notes: document.getElementById('aNotes').value,
  };
  if (!data.title || !data.date) return showAlert('Título e data são obrigatórios', 'error');
  try {
    const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) { closeModal('activityModal'); showAlert('Atividade criada!', 'success'); loadActivities(); }
    else { const err = await res.json(); showAlert(err.error, 'error'); }
  } catch (e) { showAlert('Erro de conexão', 'error'); }
}

async function completeActivity(id) {
  try {
    await fetch(`/api/activities/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) });
    showAlert('Atividade concluída!', 'success');
    loadActivities();
  } catch (e) { showAlert('Erro', 'error'); }
}

async function deleteActivity(id) {
  if (!confirm('Remover atividade?')) return;
  try {
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) { showAlert('Removida', 'success'); loadActivities(); }
  } catch (e) { showAlert('Erro', 'error'); }
}

// ─── USERS (ADMIN) ────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const users = await res.json();
    const tbody = document.getElementById('usersTableBodyContent');
    if (!tbody) return;

    const roleBadge = (role) => {
      const map = { ADMIN: 'admin', Gerente: 'gerente', Vendedor: 'vendedor' };
      return `<span class="role-badge ${map[role] || 'vendedor'}">${role}</span>`;
    };

    tbody.innerHTML = users.map(u => `
      <tr class="users-table-row">
        <td>
          <div class="user-cell">
            <div class="user-avatar" style="width:30px;height:30px;font-size:11px">
              ${u.picture ? `<img src="${u.picture}" style="width:100%;border-radius:50%">` : (u.name || u.email).substring(0,2).toUpperCase()}
            </div>
            <div class="user-info-mini"><strong>${u.name || '(Aguardando login)'}</strong></div>
          </div>
        </td>
        <td>${u.email}</td>
        <td>${roleBadge(u.role)}</td>
        <td>
          <div class="status-indicator">
            <span class="status-dot ${u.googleId ? 'active' : 'pending'}"></span>
            ${u.googleId ? 'Ativo' : 'Aguardando primeiro login'}
          </div>
        </td>
        <td>
          ${u.email !== currentUser?.email ? `<button onclick="deleteUser('${u.id}')" style="border:none;background:#fff0ef;color:#e17055;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px">Remover</button>` : '<em style="color:#999;font-size:12px">Você</em>'}
        </td>
      </tr>
    `).join('');
  } catch (e) { showAlert('Erro ao carregar usuários'); }
}

async function saveUser() {
  const email = document.getElementById('uEmail').value;
  const name = document.getElementById('uName').value;
  const role = document.getElementById('uRole').value;
  if (!email) return showAlert('E-mail é obrigatório', 'error');
  try {
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, role }) });
    if (res.ok) { closeModal('userModal'); showAlert('Usuário autorizado com sucesso!', 'success'); loadUsers(); }
    else { const err = await res.json(); showAlert(err.error, 'error'); }
  } catch (e) { showAlert('Erro de conexão', 'error'); }
}

window.deleteUser = async function (id) {
  if (!confirm('Remover acesso deste usuário?')) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) { showAlert('Usuário removido', 'success'); loadUsers(); }
  } catch (e) { showAlert('Erro', 'error'); }
};

// ─── EXPOSE GLOBALS for HTML onclick ─────────────────────────────────────────
window.editContact = editContact;
window.deleteContact = deleteContact;
window.editDeal = editDeal;
window.deleteDeal = deleteDeal;
window.editCompany = editCompany;
window.deleteCompany = deleteCompany;
window.completeActivity = completeActivity;
window.deleteActivity = deleteActivity;
window.openModal = openModal;
window.closeModal = closeModal;
window.navigateTo = navigateTo;
window.openNewContact = openNewContact;
window.openDealDetail = openDealDetail;
window.savePipelineConfig = savePipelineConfig;
window.addPipelineStage = addPipelineStage;
window.openNewDeal = openNewDeal;
window.openDealDetail = openDealDetail;
