import { API, api, clearAuth, loadAuth, saveAuth } from './api.js';

let auth = loadAuth();
let meta = { tipos_equipamento: {}, locais: {}, locais_manutencao: {} };
let bases = [];
let route = 'equipamentos';
let detailId = null;

const app = () => document.getElementById('app');

function token() {
  return auth?.token;
}

function user() {
  return auth?.user;
}

function admin() {
  return auth?.admin;
}

function isFiscal() {
  return user()?.nivel === 'fiscal';
}

function isGerente() {
  return user()?.nivel === 'gerente';
}

function setRoute(name, id = null) {
  route = name;
  detailId = id;
  const next = id ? `#/${name}/${id}` : `#/${name}`;
  // Só muda o hash — o listener hashchange chama render() uma vez (evita fetch duplo)
  if (location.hash === next) {
    render().catch(() => {});
  } else {
    location.hash = next;
  }
}

function parseHash() {
  const h = (location.hash || '#/equipamentos').replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  route = name || 'equipamentos';
  detailId = id || null;
}

async function ensureMeta() {
  if (Object.keys(meta.tipos_equipamento || {}).length) return;
  meta = await api('/meta');
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `alert ${type}`;
  el.textContent = msg;
  const host = document.querySelector('.page-content') || app();
  host.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

function shell(content, { adminMode = false } = {}) {
  const u = adminMode ? admin() : user();
  const navItems = adminMode
    ? [
        { go: 'admin-usuarios', label: 'Usuários', short: 'Users' },
        { go: 'admin-filiais', label: 'Filiais', short: 'Filiais' },
        { go: 'admin-historico', label: 'Histórico', short: 'Hist.' },
      ]
    : [
        { go: 'equipamentos', label: 'Equipamentos', short: 'Equip.', active: route === 'equipamentos' || route === 'equipamento' },
        ...(isFiscal() ? [{ go: 'cadastro', label: 'Cadastro', short: 'Cadastro' }] : []),
        ...(isGerente() ? [{ go: 'relatorios', label: 'Relatórios', short: 'Relat.' }] : []),
        ...(isGerente() ? [{ go: 'whatsapp', label: 'WhatsApp', short: 'Whats' }] : []),
        { go: 'perfil', label: 'Meu perfil', short: 'Perfil' },
      ];

  const nav = navItems
    .map((item) => {
      const active =
        item.active ||
        route === item.go ||
        (item.go === 'equipamentos' && route === 'equipamento');
      return `<a class="nav-item ${active ? 'active' : ''}" data-go="${item.go}">${item.label}</a>`;
    })
    .join('');

  const bottom = navItems
    .map((item) => {
      const active =
        item.active ||
        route === item.go ||
        (item.go === 'equipamentos' && route === 'equipamento');
      return `<a class="bottom-nav-item ${active ? 'active' : ''}" data-go="${item.go}"><span>${item.short || item.label}</span></a>`;
    })
    .join('');

  return `
  <div class="app-shell">
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-logo">M</div>
        <div>
          <h1>ManuControl</h1>
          <p class="subtitle">${adminMode ? 'Administração' : 'Limpeza urbana'}</p>
        </div>
      </div>
      <nav class="sidebar-nav">${nav}</nav>
      <div class="sidebar-footer">
        <div class="user-panel">
          <div class="user-avatar">${(u?.nome || '?')[0]}</div>
          <div class="user-info">
            <div class="name">${u?.nome || ''}</div>
            <div class="role">${adminMode ? 'Admin' : `${u?.nivel || ''} · Filial ${u?.base_codigo || ''}`}</div>
          </div>
        </div>
        <div class="sidebar-actions">
          <a href="#" id="btn-logout">Sair</a>
        </div>
      </div>
    </aside>
    <div class="app-main">
      <header class="page-topbar">
        <div class="page-topbar-left">
          <button type="button" class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
          <span class="mobile-app-title">ManuControl</span>
          ${
            !adminMode && u
              ? `<span class="filial-badge">Filial ${u.base_codigo} — ${u.base_nome}</span>`
              : ''
          }
        </div>
      </header>
      <div class="page-content">${content}</div>
      <footer class="app-footer">ManuControl</footer>
      <nav class="bottom-nav${adminMode ? ' admin-bottom-nav' : ''}" aria-label="Navegação">${bottom}
        <a class="bottom-nav-item" href="#" id="btn-logout-mobile"><span>Sair</span></a>
      </nav>
    </div>
  </div>`;
}

function bindShell() {
  const logout = (e) => {
    e.preventDefault();
    clearAuth();
    auth = null;
    render();
  };
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-logout-mobile')?.addEventListener('click', logout);
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.app-shell')?.classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.app-shell')?.classList.remove('sidebar-open');
  });
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.app-shell')?.classList.remove('sidebar-open');
      setRoute(el.getAttribute('data-go'));
    });
  });
}

async function viewLogin() {
  let loadError = '';
  try {
    if (!bases.length) {
      const data = await api('/bases');
      bases = Array.isArray(data) ? data : [];
      if (!bases.length) {
        loadError = `API não retornou filiais (base: ${API}). Defina VITE_API_URL=https://manuback.onrender.com/api na Vercel e faça Redeploy.`;
      }
    }
  } catch (err) {
    bases = [];
    loadError = `${err.message || 'Falha ao conectar na API'} (base: ${API})`;
  }
  const options = bases
    .map((b) => `<option value="${b.id}">${b.codigo} — ${b.nome}</option>`)
    .join('');
  app().innerHTML = `
    <div class="auth-shell">
      <form class="auth-card form-card" id="login-form">
        <div class="login-mobile-brand">
          <div class="brand-logo">M</div>
          <strong>ManuControl</strong>
        </div>
        <h1>ManuControl</h1>
        <p class="subtitle">Login da filial</p>
        ${loadError ? `<div class="alert error">${loadError}</div>` : ''}
        <label>Filial<select name="base_id" required ${loadError ? 'disabled' : ''}>${options || '<option value="">—</option>'}</select></label>
        <label>Usuário<input name="usuario" required autocomplete="username" /></label>
        <label>Senha<input name="senha" type="password" required autocomplete="current-password" /></label>
        <button class="btn btn-primary btn-full" type="submit" ${loadError ? 'disabled' : ''}>Entrar</button>
        <p class="auth-admin-link">Admin? <a href="#/admin-login" id="go-admin">Acesso administrativo</a></p>
      </form>
    </div>`;
  document.getElementById('go-admin')?.addEventListener('click', (e) => {
    e.preventDefault();
    setRoute('admin-login');
  });
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loadError) return;
    const fd = new FormData(e.target);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: {
          base_id: fd.get('base_id'),
          usuario: fd.get('usuario'),
          senha: fd.get('senha'),
        },
      });
      auth = { token: data.token, user: data.user };
      saveAuth(auth);
      setRoute('equipamentos');
    } catch (err) {
      alert(err.message);
    }
  });
}

async function viewAdminLogin() {
  app().innerHTML = `
    <div class="auth-shell">
      <form class="auth-card form-card" id="admin-login">
        <div class="login-mobile-brand">
          <div class="brand-logo">M</div>
          <strong>ManuControl</strong>
        </div>
        <h1>Admin ManuControl</h1>
        <p class="subtitle">Acesso administrativo</p>
        <label>Usuário<input name="usuario" required autocomplete="username" value="admin" /></label>
        <label>Senha<input name="senha" type="password" required autocomplete="current-password" /></label>
        <button class="btn btn-primary btn-full" type="submit">Entrar</button>
        <p class="auth-admin-link"><a href="#/login" id="back-login">Voltar ao login de filial</a></p>
      </form>
    </div>`;
  document.getElementById('back-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    setRoute('login');
  });
  document.getElementById('admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const usuario = String(fd.get('usuario') || '').trim();
    const senha = String(fd.get('senha') || '').trim();
    try {
      const data = await api('/auth/admin/login', {
        method: 'POST',
        body: { usuario, senha },
      });
      auth = { token: data.token, admin: data.admin };
      saveAuth(auth);
      setRoute('admin-usuarios');
    } catch (err) {
      alert(err.message);
    }
  });
}

async function viewEquipamentos() {
  app().innerHTML = shell(`<p style="color:var(--text-muted);padding:1rem">Carregando equipamentos…</p>`);
  bindShell();
  const [_, data] = await Promise.all([
    ensureMeta(),
    api('/ativos?com_stats=1', { token: token() }),
  ]);
  const rows = data.ativos
    .map(
      (a) => `
    <tr data-id="${a.id}" class="click-row${a.em_manutencao ? ' row-manutencao' : ''}">
      <td data-label="Código"><strong>${a.codigo}</strong><div class="tiny muted">${a.nome}</div></td>
      <td data-label="Tipo">${meta.tipos_equipamento[a.tipo] || a.tipo || '—'}</td>
      <td data-label="Status">${a.em_manutencao ? '<span class="badge warn">Em manutenção</span>' : '<span class="badge ok">Operacional</span>'}</td>
      <td data-label="Local">${meta.locais[a.local] || a.local || '—'}</td>
    </tr>`
    )
    .join('');
  app().innerHTML = shell(`
    <section class="detail-head">
      <h1>Equipamentos</h1>
      <p class="lede">${data.total_operacional} operacionais · ${data.total_manutencao} em manutenção</p>
    </section>
    <section class="stats">
      <div class="stat"><span class="stat-label">Total</span><strong>${data.total}</strong></div>
      <div class="stat"><span class="stat-label">Operacional</span><strong>${data.pct_operacional}%</strong></div>
      <div class="stat"><span class="stat-label">Manutenção</span><strong>${data.pct_manutencao}%</strong></div>
    </section>
    <section class="table-panel">
      <div class="table-wrap"><table id="tabela-ativos">
        <thead><tr><th>Código</th><th>Tipo</th><th>Status</th><th>Local</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Nenhum equipamento</td></tr>'}</tbody>
      </table></div>
    </section>`);
  bindShell();
  document.querySelectorAll('.click-row').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => setRoute('equipamento', tr.dataset.id));
  });
}

async function viewEquipamento() {
  await ensureMeta();
  const d = await api(`/ativos/${detailId}`, { token: token() });
  const a = d.ativo || d;
  const manut = d.manutencao_aberta || d.manutencao || null;
  const hist = (d.manutencoes || [])
    .map(
      (m) => `<li><strong>OS ${m.os_numero}</strong> · ${m.data_abertura}${m.data_conclusao ? ` → ${m.data_conclusao}` : ' (aberta)'}</li>`
    )
    .join('');
  app().innerHTML = shell(`
    <a href="#/equipamentos" data-go="equipamentos" class="back">← Voltar</a>
    <section class="detail-head">
      <h1>${a.codigo} · ${a.nome}</h1>
      <p class="lede">${meta.tipos_equipamento[a.tipo] || a.tipo || ''} · ${a.em_manutencao ? 'Em manutenção' : 'Operacional'}</p>
    </section>
    <section class="info-block" style="padding:1rem;margin-bottom:1rem;background:var(--surface);border-radius:var(--radius)">
      <p>Patrimônio: ${a.patrimonio || '—'} · Local: ${meta.locais[a.local] || a.local || '—'}</p>
      <p>${a.observacoes || ''}</p>
    </section>
    ${
      isFiscal()
        ? a.em_manutencao
          ? `<form id="form-encerrar" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius);margin-bottom:1rem">
              <h2>Encerrar OS ${manut?.os_numero || a.ordem_servico || ''}</h2>
              <label>Data conclusão<input type="date" name="data_conclusao" required value="${new Date().toISOString().slice(0, 10)}"></label>
              <label>Observações<textarea name="observacoes_encerramento"></textarea></label>
              <button class="btn btn-primary" type="submit">Encerrar manutenção</button>
            </form>`
          : `<form id="form-abrir" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius);margin-bottom:1rem">
              <h2>Abrir manutenção</h2>
              <label>Nº OS<input name="os_numero" required></label>
              <label>Data<input type="date" name="data_abertura" required value="${new Date().toISOString().slice(0, 10)}"></label>
              <label>Responsável<input name="responsavel" value="${user()?.nome || ''}"></label>
              <label>Local<select name="local"><option value="base">Na base</option><option value="terceiros">Em terceiros</option></select></label>
              <label>Observações<textarea name="observacoes_abertura"></textarea></label>
              <button class="btn btn-primary" type="submit">Abrir OS</button>
            </form>`
        : ''
    }
    <section><h2>Histórico de OS</h2><ul>${hist || '<li>Sem manutenções</li>'}</ul></section>
  `);
  bindShell();
  document.querySelector('[data-go="equipamentos"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    setRoute('equipamentos');
  });
  document.getElementById('form-abrir')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api(`/ativos/${detailId}/manutencao/abrir`, { method: 'POST', body, token: token() });
      toast('Manutenção aberta');
      render();
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById('form-encerrar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api(`/ativos/${detailId}/manutencao/encerrar`, { method: 'POST', body, token: token() });
      toast('Manutenção encerrada');
      render();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function viewCadastro() {
  await ensureMeta();
  const data = await api('/ativos', { token: token() });
  const tipoOpts = Object.entries(meta.tipos_equipamento)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join('');
  const rows = data.ativos
    .map(
      (a) => `<tr>
      <td>${a.codigo}</td><td>${a.nome}</td>
      <td>${meta.tipos_equipamento[a.tipo] || a.tipo || '—'}</td>
      <td><button type="button" class="btn btn-small" data-edit="${a.id}">Editar</button></td>
    </tr>`
    )
    .join('');
  app().innerHTML = shell(`
    <section class="detail-head"><h1>Cadastro</h1><p class="lede">Crie, edite e importe equipamentos</p></section>
    <form id="form-novo" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius);margin-bottom:1rem;display:grid;gap:.6rem">
      <h2>Novo equipamento</h2>
      <input type="hidden" name="id" value="">
      <label>Código<input name="codigo" required></label>
      <label>Nome<input name="nome" required></label>
      <label>Tipo<select name="tipo">${tipoOpts}</select></label>
      <label>Patrimônio<input name="patrimonio"></label>
      <label>Observações<textarea name="observacoes"></textarea></label>
      <button class="btn btn-primary" type="submit">Salvar</button>
    </form>
    <form id="form-import" style="margin-bottom:1rem">
      <label>Importar CSV/XLSX<input type="file" name="file" accept=".csv,.xlsx" required></label>
      <button class="btn btn-small" type="submit">Importar</button>
      <a class="btn btn-small" href="#" id="dl-modelo">Baixar modelo</a>
    </form>
    <section class="table-panel"><div class="table-wrap"><table>
      <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div></section>`);
  bindShell();
  const form = document.getElementById('form-novo');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const id = fd.get('id');
    const body = Object.fromEntries(fd.entries());
    delete body.id;
    try {
      if (id) await api(`/ativos/${id}`, { method: 'PATCH', body, token: token() });
      else await api('/ativos', { method: 'POST', body, token: token() });
      toast('Salvo');
      render();
    } catch (err) {
      alert(err.message);
    }
  });
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = data.ativos.find((x) => String(x.id) === btn.dataset.edit);
      if (!a) return;
      form.id.value = a.id;
      form.codigo.value = a.codigo;
      form.nome.value = a.nome;
      form.tipo.value = a.tipo || 'outros';
      form.patrimonio.value = a.patrimonio || '';
      form.observacoes.value = a.observacoes || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  document.getElementById('form-import').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api('/ativos/import', { method: 'POST', formData: fd, token: token() });
      toast(`Importado: ${r.inseridos || 0} novos, ${r.atualizados || 0} atualizados`);
      render();
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById('dl-modelo')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const blob = await api('/ativos/modelo-importacao', { token: token() });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_importacao_ativos.xlsx';
      a.click();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function viewRelatorios() {
  const rel = await api('/relatorios/manutencoes', { token: token() });
  const ranking = (rel.ranking || [])
    .map(
      (r) =>
        `<tr><td>${r.codigo || r.nome}</td><td>${r.total_manutencoes || 0}</td><td>${r.tempo_medio_dias ?? '—'}</td></tr>`
    )
    .join('');
  app().innerHTML = shell(`
    <section class="detail-head"><h1>Relatórios</h1>
      <p class="lede">${rel.total_ciclos || 0} ciclos · ${rel.em_manutencao_agora || 0} abertos agora</p>
    </section>
    <div style="display:flex;gap:.5rem;margin-bottom:1rem">
      <button class="btn btn-small" id="dl-csv">Baixar CSV</button>
      <button class="btn btn-small" id="dl-pdf">Baixar PDF</button>
    </div>
    <section class="table-panel"><div class="table-wrap"><table>
      <thead><tr><th>Equipamento</th><th>Ciclos</th><th>Tempo médio (dias)</th></tr></thead>
      <tbody>${ranking || '<tr><td colspan="3">Sem dados</td></tr>'}</tbody>
    </table></div></section>`);
  bindShell();
  async function download(path, name) {
    const blob = await api(path, { token: token() });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }
  document.getElementById('dl-csv')?.addEventListener('click', () =>
    download('/relatorios/manutencoes.csv', 'manutencoes.csv').catch((e) => alert(e.message))
  );
  document.getElementById('dl-pdf')?.addEventListener('click', () =>
    download('/relatorios/manutencoes.pdf', 'relatorio.pdf').catch((e) => alert(e.message))
  );
}

async function viewPerfil() {
  app().innerHTML = shell(`
    <section class="detail-head"><h1>Meu perfil</h1>
      <p class="lede">${user()?.nome} · ${user()?.nivel} · Filial ${user()?.base_codigo}</p>
    </section>
    <form id="form-senha" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius);max-width:420px;display:grid;gap:.6rem">
      <h2>Alterar senha</h2>
      <label>Senha atual<input type="password" name="senha_atual" required></label>
      <label>Nova senha<input type="password" name="nova_senha" required></label>
      <button class="btn btn-primary" type="submit">Salvar</button>
    </form>
    ${
      isGerente()
        ? `<p style="margin-top:1.25rem"><a href="#/whatsapp" data-go="whatsapp" class="btn btn-small">Configurar WhatsApp da filial →</a></p>`
        : ''
    }`);
  bindShell();
  document.getElementById('form-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: Object.fromEntries(fd.entries()),
        token: token(),
      });
      toast('Senha alterada');
    } catch (err) {
      alert(err.message);
    }
  });
}

async function viewWhatsappWizard() {
  if (!isGerente()) return setRoute('equipamentos');
  let cfg = await api('/filial/whatsapp', { token: token() });
  let st = await api('/filial/whatsapp/status', { token: token() }).catch(() => ({
    loggedIn: false,
    passo: 'qr',
  }));
  // Só avança de passo se loggedIn for verdadeiro (não confundir com connected)
  let loggedIn = Boolean(st.loggedIn);
  let passo =
    loggedIn && cfg.whatsapp_grupo
      ? 'pronto'
      : loggedIn
        ? 'grupo'
        : 'qr';
  let qrcode = '';
  let grupos = [];
  let gruposErro = '';
  let pollId = null;

  const stopPoll = () => {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  };
  window.__waStopPoll = stopPoll;

  const doDesconectar = async () => {
    if (!confirm('Desconectar WhatsApp e limpar todos os dados da última conexão?')) return;
    stopPoll();
    try {
      const r = await api('/filial/whatsapp/desconectar', { method: 'POST', body: {}, token: token() });
      cfg = { ...cfg, ...r, whatsapp: '', whatsapp_grupo: '', whatsapp_alerta: 0, wuzapi_token: '' };
      loggedIn = false;
      passo = 'qr';
      qrcode = '';
      grupos = [];
      gruposErro = '';
      toast(r.mensagem || 'Desconectado');
      paint();
    } catch (err) {
      alert(err.message);
    }
  };

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const nomeGrupo = (jid) => {
    const g = grupos.find((x) => x.jid === jid);
    if (g?.nome && g.nome !== jid) return g.nome;
    if (cfg.whatsapp_grupo_nome) return cfg.whatsapp_grupo_nome;
    return jid ? 'Grupo configurado' : '—';
  };

  const paint = () => {
    const steps = `
      <div style="display:flex;gap:.45rem;margin-bottom:1.1rem;flex-wrap:wrap" aria-label="Etapas">
        <span class="badge ${passo === 'qr' ? 'warn' : 'ok'}">1 · QR</span>
        <span class="badge ${passo === 'grupo' ? 'warn' : passo === 'pronto' ? 'ok' : ''}">2 · Grupo</span>
        <span class="badge ${passo === 'pronto' ? 'ok' : ''}">3 · Chatbot</span>
      </div>`;

    let body = '';
    if (passo === 'qr') {
      body = `
        <section class="form-card" style="padding:1.35rem;background:var(--surface);border-radius:var(--radius);max-width:520px;display:grid;gap:.85rem;box-shadow:var(--shadow-sm)">
          <h2 style="margin:0;font-size:1.25rem">Conectar WhatsApp</h2>
          <p style="margin:0;color:var(--text-muted);font-size:.92rem;line-height:1.45">
            Clique em <strong>Gerar QR Code</strong> e escaneie no celular
            (WhatsApp → Aparelhos conectados).
          </p>
          <button class="btn btn-primary" type="button" id="wa-start" style="justify-self:start">Gerar QR Code</button>
          <div id="wa-qr-box" style="min-height:220px;display:grid;place-items:center;background:#f8fafc;border-radius:12px;border:1px dashed var(--border)">
            ${
              qrcode
                ? `<img src="${qrcode}" alt="QR WhatsApp" style="max-width:240px;width:100%;height:auto" />`
                : '<p style="color:var(--text-muted);padding:1rem;text-align:center;margin:0">Aguardando QR…</p>'
            }
          </div>
          <p id="wa-hint" style="margin:0;font-size:.85rem;color:var(--text-muted)">Aguardando geração do QR…</p>
        </section>`;
    } else if (passo === 'grupo') {
      const sorted = [...grupos].sort((a, b) =>
        String(a.nome || a.jid).localeCompare(String(b.nome || b.jid), 'pt', { sensitivity: 'base' })
      );
      const opts = sorted
        .map((g) => {
          const checked = g.jid === cfg.whatsapp_grupo ? 'checked' : '';
          const label = esc(g.nome && g.nome !== g.jid ? g.nome : 'Grupo sem nome');
          return `
            <label class="wa-grupo-item" style="
              display:flex;align-items:center;gap:.75rem;
              padding:.85rem 1rem;margin:0;cursor:pointer;
              border-bottom:1px solid var(--border);transition:background .15s;
            ">
              <input type="radio" name="grupo" value="${esc(g.jid)}" ${checked}
                style="width:1.1rem;height:1.1rem;accent-color:var(--primary);flex-shrink:0;margin:0">
              <span style="font-weight:600;font-size:.95rem;line-height:1.3;color:var(--text)">${label}</span>
            </label>`;
        })
        .join('');
      const emptyMsg = gruposErro
        ? `<p style="padding:1.25rem;color:#b91c1c;margin:0;font-size:.9rem">${esc(gruposErro)}</p>`
        : `<p style="padding:1.25rem;color:var(--text-muted);margin:0;font-size:.9rem">
            Nenhum grupo encontrado. Entre no grupo com este chip e atualize a lista.
          </p>`;
      body = `
        <section class="form-card" style="padding:1.35rem;background:var(--surface);border-radius:var(--radius);max-width:520px;display:grid;gap:1rem;box-shadow:var(--shadow-sm)">
          <div style="display:grid;gap:.35rem">
            <h2 style="margin:0;font-size:1.25rem">Escolher grupo</h2>
            <p style="margin:0;color:var(--text-muted);font-size:.92rem;line-height:1.45">
              Selecione o grupo onde o chatbot vai responder.
            </p>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="wa-busca-grupo" type="search" placeholder="Buscar grupo…" autocomplete="off"
              style="flex:1;margin:0;min-width:0">
            <button class="btn btn-secondary btn-small" type="button" id="wa-reload-grupos" title="Atualizar lista">Atualizar</button>
          </div>
          <div id="wa-grupos" style="
            max-height:340px;overflow:auto;border:1px solid var(--border);
            border-radius:12px;background:#fafbfc;
          ">${opts || emptyMsg}</div>
          <details style="font-size:.85rem;color:var(--text-muted)">
            <summary style="cursor:pointer">Não achou o grupo? Colar ID</summary>
            <input id="wa-grupo-manual" placeholder="12036…@g.us" autocomplete="off" style="margin-top:.55rem;width:100%">
          </details>
          <label style="display:inline-flex;align-items:center;gap:.55rem;font-size:.92rem;margin:0;cursor:pointer;width:fit-content">
            <input type="checkbox" id="wa-alerta" ${cfg.whatsapp_alerta ? 'checked' : ''}
              style="width:1.05rem;height:1.05rem;accent-color:var(--primary);margin:0;flex-shrink:0">
            <span>Receber alertas ao abrir/encerrar OS</span>
          </label>
          <div style="display:grid;gap:.55rem;margin-top:.15rem">
            <button class="btn btn-primary" type="button" id="wa-save-grupo" style="width:100%">
              Salvar e ativar chatbot
            </button>
            <button class="btn btn-ghost btn-small" type="button" id="wa-desconectar" style="color:#b91c1c;justify-self:center">
              Desconectar WhatsApp
            </button>
          </div>
        </section>`;
    } else {
      const nome = esc(nomeGrupo(cfg.whatsapp_grupo));
      body = `
        <section class="form-card" style="padding:1.35rem;background:var(--surface);border-radius:var(--radius);max-width:520px;display:grid;gap:1rem;box-shadow:var(--shadow-sm)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap">
            <div style="display:grid;gap:.3rem;min-width:0">
              <h2 style="margin:0;font-size:1.25rem">Chatbot ativo</h2>
              <p style="margin:0;color:var(--text-muted);font-size:.9rem">Respondendo neste grupo</p>
            </div>
            <span class="badge ok">Conectado</span>
          </div>
          <div style="
            display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;
            padding:1rem 1.1rem;border:1px solid var(--border);border-radius:12px;background:#f8fafc;
          ">
            <div style="min-width:0;display:grid;gap:.2rem">
              <strong style="font-size:1.05rem;line-height:1.3">${nome}</strong>
              <span style="font-size:.8rem;color:var(--text-muted)">Grupo do WhatsApp</span>
            </div>
            <button class="btn btn-secondary btn-small" type="button" id="wa-trocar-grupo" style="flex-shrink:0">
              Trocar grupo
            </button>
          </div>
          <p style="margin:0;color:var(--text-muted);font-size:.92rem;line-height:1.5">
            No grupo, envie <strong>código</strong>, <strong>patrimônio</strong> ou <strong>nome</strong> do equipamento.
            O bot responde com um link para abrir ou encerrar manutenção.
          </p>
          <p style="margin:0;font-size:.85rem;color:var(--text-muted)">Comandos: <code>ajuda</code> · <code>lista</code></p>
          <button class="btn btn-ghost btn-small" type="button" id="wa-desconectar" style="color:#b91c1c;justify-self:start">
            Desconectar WhatsApp
          </button>
        </section>`;
    }

    app().innerHTML = shell(`
      <section class="detail-head">
        <h1>WhatsApp da filial</h1>
        <p class="lede">Filial ${user()?.base_codigo} — QR → grupo → chatbot</p>
      </section>
      ${steps}
      ${body}`);
    bindShell();

    // Destaque visual no item selecionado + busca
    document.querySelectorAll('.wa-grupo-item').forEach((el) => {
      const sync = () => {
        const on = el.querySelector('input')?.checked;
        el.style.background = on ? 'rgba(5,150,105,.08)' : '';
      };
      el.addEventListener('mouseenter', () => {
        if (!el.querySelector('input')?.checked) el.style.background = 'rgba(0,0,0,.03)';
      });
      el.addEventListener('mouseleave', sync);
      el.querySelector('input')?.addEventListener('change', () => {
        document.querySelectorAll('.wa-grupo-item').forEach((x) => {
          x.style.background = x.querySelector('input')?.checked ? 'rgba(5,150,105,.08)' : '';
        });
      });
      sync();
    });

    const busca = document.getElementById('wa-busca-grupo');
    if (busca) {
      busca.addEventListener('input', () => {
        const q = busca.value.trim().toLowerCase();
        document.querySelectorAll('.wa-grupo-item').forEach((el) => {
          const text = el.textContent?.toLowerCase() || '';
          el.style.display = !q || text.includes(q) ? 'flex' : 'none';
        });
      });
    }

    document.getElementById('wa-start')?.addEventListener('click', async () => {
      const hint = document.getElementById('wa-hint');
      const box = document.getElementById('wa-qr-box');
      try {
        if (hint) hint.textContent = 'Gerando token e QR…';
        if (box) box.innerHTML = '<p style="color:var(--text-muted);margin:0">Criando sessão no WuzAPI…</p>';
        const r = await api('/filial/whatsapp/conectar', { method: 'POST', body: {}, token: token() });
        qrcode = r.qrcode || '';
        if (r.provision?.token) cfg.wuzapi_token = r.provision.token;
        if (r.loggedIn === true) {
          stopPoll();
          loggedIn = true;
          passo = 'grupo';
          await loadGrupos();
          paint();
          toast('WhatsApp já estava conectado');
          return;
        }
        if (!qrcode) {
          if (hint) hint.textContent = r.mensagem || r.error || 'QR vazio — verifique WUZAPI_ADMIN_TOKEN no Render';
          if (box) {
            box.innerHTML = `<p style="color:#b91c1c;padding:1rem;text-align:center;margin:0">${r.mensagem || r.error || 'Não veio QR do WuzAPI'}</p>`;
          }
          return;
        }
        paint();
        if (hint) hint.textContent = r.mensagem || 'Escaneie o QR. Aguardando conexão…';
        startPoll();
      } catch (err) {
        if (hint) hint.textContent = err.message;
        if (box) {
          box.innerHTML = `<p style="color:#b91c1c;padding:1rem;text-align:center;margin:0">${err.message}</p>`;
        }
        alert(err.message);
      }
    });

    document.getElementById('wa-reload-grupos')?.addEventListener('click', async () => {
      const btn = document.getElementById('wa-reload-grupos');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '…';
      }
      await loadGrupos();
      paint();
      toast(grupos.length ? `${grupos.length} grupos` : 'Lista atualizada');
    });

    document.getElementById('wa-save-grupo')?.addEventListener('click', async () => {
      const manual = document.getElementById('wa-grupo-manual')?.value?.trim() || '';
      const selected = manual || document.querySelector('input[name="grupo"]:checked')?.value;
      if (!selected) {
        alert('Selecione um grupo na lista');
        return;
      }
      const btn = document.getElementById('wa-save-grupo');
      if (btn) btn.disabled = true;
      try {
        const r = await api('/filial/whatsapp/grupo', {
          method: 'POST',
          body: {
            whatsapp_grupo: selected,
            whatsapp_alerta: document.getElementById('wa-alerta')?.checked,
          },
          token: token(),
        });
        cfg.whatsapp_grupo = r.whatsapp_grupo;
        cfg.whatsapp_grupo_nome = nomeGrupo(selected);
        cfg.whatsapp_alerta = document.getElementById('wa-alerta')?.checked ? 1 : 0;
        passo = 'pronto';
        toast('Chatbot ativado');
        paint();
      } catch (err) {
        if (btn) btn.disabled = false;
        alert(err.message);
      }
    });

    document.getElementById('wa-trocar-grupo')?.addEventListener('click', async () => {
      const btn = document.getElementById('wa-trocar-grupo');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Carregando…';
      }
      passo = 'grupo';
      await loadGrupos();
      paint();
    });

    document.getElementById('wa-desconectar')?.addEventListener('click', doDesconectar);
  };

  const loadGrupos = async () => {
    try {
      const data = await api('/filial/whatsapp/grupos', { token: token() });
      grupos = data.grupos || [];
      gruposErro = grupos.length
        ? ''
        : 'Nenhum grupo retornado pelo WhatsApp. Confirme que o chip entrou no grupo e tente Atualizar lista.';
    } catch (err) {
      grupos = [];
      gruposErro = err.message || 'Falha ao buscar grupos';
      if (err.status === 400) throw err;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollId = setInterval(async () => {
      try {
        const r = await api('/filial/whatsapp/qr', { token: token() });
        if (r.qrcode) qrcode = r.qrcode;
        if (r.loggedIn === true) {
          stopPoll();
          loggedIn = true;
          passo = 'grupo';
          await loadGrupos();
          paint();
          toast('WhatsApp conectado');
          return;
        }
        const box = document.getElementById('wa-qr-box');
        if (box && qrcode) {
          box.innerHTML = `<img src="${qrcode}" alt="QR WhatsApp" style="max-width:240px;width:100%;height:auto" />`;
        }
      } catch {
        /* ignore poll errors */
      }
    }, 3000);
  };

  if (passo === 'grupo' || passo === 'pronto') {
    try {
      await loadGrupos();
    } catch (err) {
      if (err.status === 400 && passo === 'grupo') {
        passo = 'qr';
        loggedIn = false;
      }
    }
  }
  paint();
}

async function viewAdminUsuarios() {
  if (!bases.length) {
    const data = await api('/bases');
    bases = Array.isArray(data) ? data : [];
  }
  const users = await api('/admin/usuarios', { token: token() });
  const listUsers = Array.isArray(users) ? users : [];
  const baseOpts = bases.map((b) => `<option value="${b.id}">${b.codigo}</option>`).join('');
  const rows = listUsers
    .map(
      (u) => `<tr>
      <td>${u.base_codigo || u.base_id}</td><td>${u.usuario}</td><td>${u.nome}</td><td>${u.nivel}</td>
      <td>${u.ativo ? 'Ativo' : 'Inativo'}</td>
      <td style="display:flex;gap:.35rem;flex-wrap:wrap">
        <button class="btn btn-small" data-toggle="${u.id}">${u.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-small" data-senha="${u.id}" data-login="${u.usuario}">Senha</button>
      </td>
    </tr>`
    )
    .join('');
  app().innerHTML = shell(
    `
    <section class="detail-head"><h1>Usuários</h1>
      <p class="lede">Logins ativos só na filial 01 (fiscal / gerente). Altere senhas abaixo.</p>
    </section>

    <form id="form-admin-senha" class="form-card" style="display:grid;gap:.5rem;max-width:480px;margin-bottom:1rem;padding:1rem;background:var(--surface);border-radius:var(--radius)">
      <h2 style="margin:0;font-size:1.05rem">Senha do admin</h2>
      <label>Senha atual<input type="password" name="senha_atual" required autocomplete="current-password"></label>
      <label>Nova senha<input type="password" name="nova_senha" required minlength="4" autocomplete="new-password"></label>
      <button class="btn btn-primary" type="submit">Alterar senha do admin</button>
    </form>

    <form id="form-user" style="display:grid;gap:.5rem;max-width:480px;margin-bottom:1rem;padding:1rem;background:var(--surface);border-radius:var(--radius)">
      <h2 style="margin:0;font-size:1.05rem">Novo usuário</h2>
      <select name="base_id">${baseOpts}</select>
      <input name="usuario" placeholder="login" required>
      <input name="nome" placeholder="nome" required>
      <select name="nivel"><option value="fiscal">fiscal</option><option value="gerente">gerente</option></select>
      <input name="senha" placeholder="senha" required minlength="4">
      <button class="btn btn-primary" type="submit">Criar</button>
    </form>
    <section class="table-panel"><div class="table-wrap"><table>
      <thead><tr><th>Filial</th><th>Login</th><th>Nome</th><th>Nível</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Nenhum usuário</td></tr>'}</tbody>
    </table></div></section>`,
    { adminMode: true }
  );
  bindShell();
  document.getElementById('form-admin-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('/admin/password', { method: 'POST', body, token: token() });
      toast('Senha do admin alterada');
      e.target.reset();
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById('form-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('/admin/usuarios', { method: 'POST', body, token: token() });
      toast('Usuário criado');
      render();
    } catch (err) {
      alert(err.message);
    }
  });
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/admin/usuarios/${btn.dataset.toggle}/toggle`, { method: 'POST', token: token() });
        render();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll('[data-senha]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nova = prompt(`Nova senha para ${btn.dataset.login}`);
      if (!nova) return;
      if (nova.length < 4) {
        alert('Mínimo 4 caracteres');
        return;
      }
      try {
        await api(`/admin/usuarios/${btn.dataset.senha}/senha`, {
          method: 'POST',
          body: { nova_senha: nova },
          token: token(),
        });
        toast('Senha do usuário atualizada');
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function viewAdminFiliais() {
  const list = await api('/admin/bases', { token: token() });
  const rows = (Array.isArray(list) ? list : [])
    .map(
      (b) => `<tr>
      <td>${b.codigo}</td><td>${b.nome}</td>
      <td>${b.ativa ? 'Ativa' : 'Inativa'}</td>
      <td>${b.total_ativos || 0}</td><td>${b.total_usuarios || 0}</td>
      <td style="display:flex;gap:.35rem;flex-wrap:wrap">
        <button class="btn btn-small" data-rename="${b.id}" data-nome="${b.nome}">Renomear</button>
        <button class="btn btn-small" data-del="${b.id}" data-codigo="${b.codigo}" style="color:#b91c1c">Excluir</button>
      </td>
    </tr>`
    )
    .join('');
  app().innerHTML = shell(
    `<section class="detail-head"><h1>Filiais</h1>
     <p class="lede">WhatsApp é configurado pelo gerente em Meu perfil.</p></section>
     <section class="table-panel"><div class="table-wrap"><table>
       <thead><tr><th>Código</th><th>Nome</th><th>Status</th><th>Ativos</th><th>Usuários</th><th></th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div></section>`,
    { adminMode: true }
  );
  bindShell();
  document.querySelectorAll('[data-rename]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nome = prompt('Novo nome', btn.dataset.nome);
      if (!nome) return;
      try {
        await api(`/admin/bases/${btn.dataset.rename}`, {
          method: 'PATCH',
          body: { nome },
          token: token(),
        });
        render();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (
        !confirm(
          `Excluir a filial ${btn.dataset.codigo}? Isso remove usuários, equipamentos e histórico dela.`
        )
      ) {
        return;
      }
      try {
        await api(`/admin/bases/${btn.dataset.del}`, {
          method: 'DELETE',
          token: token(),
        });
        toast('Filial excluída');
        render();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function viewAcessoRapido() {
  app().innerHTML = `
    <div class="ar-page">
      <div class="ar-card" style="padding:2rem;text-align:center;color:var(--text-muted)">Carregando…</div>
    </div>`;
  try {
    await ensureMeta();
    const d = await api(`/acesso-rapido/${detailId}`);
    paintAcessoRapido(d);
  } catch (err) {
    app().innerHTML = `
      <div class="ar-page">
        <div class="ar-card">
          <p class="ar-brand">ManuControl</p>
          <h1 class="ar-title">Link indisponível</h1>
          <p class="ar-sub">${escHtml(err.message || 'Token inválido ou expirado')}</p>
        </div>
      </div>`;
  }
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paintAcessoRapido(d) {
  const a = d.ativo || d;
  const manut = d.manutencao_aberta || a.manutencao_aberta || null;
  const emManut = Boolean(a.em_manutencao);
  const codigo = escHtml(a.codigo || '—');
  const nome = escHtml(a.nome || '');
  const tipo = escHtml(a.tipo_label || meta.tipos_equipamento[a.tipo] || a.tipo || '—');
  const local = escHtml(meta.locais[a.local] || a.local || '—');
  const patrimonio = escHtml(a.patrimonio || '—');
  const baseNome = escHtml(d.base ? `${d.base.codigo} · ${d.base.nome}` : '—');
  const obs = escHtml(a.observacoes || '');
  const hoje = new Date().toISOString().slice(0, 10);
  const expira = d.expira_em
    ? new Date(d.expira_em).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const formHtml = emManut
    ? `
      <form id="form-encerrar" class="ar-form">
        <div class="ar-form-head">
          <h2>Encerrar manutenção</h2>
          <p>OS ${escHtml(manut?.os_numero || a.ordem_servico || '—')}</p>
        </div>
        <label>Data de conclusão
          <input type="date" name="data_conclusao" required value="${hoje}">
        </label>
        <label>Observações do encerramento
          <textarea name="observacoes_encerramento" required rows="3" placeholder="Descreva o serviço realizado"></textarea>
        </label>
        <button class="btn btn-primary ar-submit" type="submit">Encerrar OS</button>
      </form>`
    : `
      <form id="form-abrir" class="ar-form">
        <div class="ar-form-head">
          <h2>Abrir manutenção</h2>
          <p>Preencha os dados da ordem de serviço</p>
        </div>
        <div class="ar-grid-2">
          <label>Nº da OS
            <input name="os_numero" required placeholder="Ex: 1234" autocomplete="off">
          </label>
          <label>Data de abertura
            <input type="date" name="data_abertura" required value="${hoje}">
          </label>
        </div>
        <label>Responsável
          <input name="responsavel" value="Fiscal WhatsApp" autocomplete="name">
        </label>
        <label>Local
          <select name="local">
            <option value="base">Na base</option>
            <option value="terceiros">Em terceiros</option>
          </select>
        </label>
        <label>Observações
          <textarea name="observacoes_abertura" required rows="3" placeholder="Motivo da manutenção"></textarea>
        </label>
        <button class="btn btn-primary ar-submit" type="submit">Abrir OS</button>
      </form>`;

  app().innerHTML = `
    <div class="ar-page">
      <div class="ar-card">
        <div class="ar-top">
          <p class="ar-brand">ManuControl</p>
          <span class="ar-badge ${emManut ? 'warn' : 'ok'}">${emManut ? 'Em manutenção' : 'Operacional'}</span>
        </div>
        <h1 class="ar-title">${codigo}</h1>
        <p class="ar-name">${nome && nome !== codigo ? nome : 'Equipamento'}</p>
        <p class="ar-sub">Acesso rápido · ${baseNome}</p>

        <div class="ar-meta">
          <div><span>Tipo</span><strong>${tipo}</strong></div>
          <div><span>Local</span><strong>${local}</strong></div>
          <div><span>Patrimônio</span><strong>${patrimonio}</strong></div>
          <div><span>Link válido até</span><strong>${escHtml(expira)}</strong></div>
        </div>
        ${obs ? `<p class="ar-obs">${obs}</p>` : ''}
        ${formHtml}
      </div>
    </div>`;

  document.getElementById('form-abrir')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/acesso-rapido/${detailId}/manutencao/abrir`, { method: 'POST', body });
      toast('Manutenção aberta');
      render();
    } catch (err) {
      if (btn) btn.disabled = false;
      alert(err.message);
    }
  });
  document.getElementById('form-encerrar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/acesso-rapido/${detailId}/manutencao/encerrar`, { method: 'POST', body });
      toast('Manutenção encerrada');
      render();
    } catch (err) {
      if (btn) btn.disabled = false;
      alert(err.message);
    }
  });
}

async function viewAdminHistorico() {
  if (!bases.length) bases = await api('/bases');
  const baseId = bases[0]?.id;
  const data = await api(`/admin/historico?base_id=${baseId}&aba=diario`, { token: token() });
  const regs = (data.registros || [])
    .map((r) => `<tr><td>${r.criado_em || ''}</td><td>${r.codigo}</td><td>${r.acao}</td><td>${r.usuario}</td></tr>`)
    .join('');
  app().innerHTML = shell(
    `<section class="detail-head"><h1>Histórico (filial ${bases[0]?.codigo || ''})</h1>
     <p class="lede">${data.total || 0} registros no dia</p></section>
     <section class="table-panel"><div class="table-wrap"><table>
       <thead><tr><th>Quando</th><th>Código</th><th>Ação</th><th>Usuário</th></tr></thead>
       <tbody>${regs || '<tr><td colspan="4">Sem registros</td></tr>'}</tbody>
     </table></div></section>`,
    { adminMode: true }
  );
  bindShell();
}

export async function render() {
  parseHash();
  // Para polling WhatsApp ao sair da tela (evita leak e re-renders)
  if (route !== 'whatsapp' && typeof window.__waStopPoll === 'function') {
    try {
      window.__waStopPoll();
    } catch {
      /* ignore */
    }
  }
  try {
    if (route === 'r' && detailId) return viewAcessoRapido();
    if (route === 'admin-login') return viewAdminLogin();
    if (route === 'login' || (!auth && !route.startsWith('admin'))) return viewLogin();
    if (auth?.admin) {
      if (route === 'admin-filiais') return viewAdminFiliais();
      if (route === 'admin-historico') return viewAdminHistorico();
      return viewAdminUsuarios();
    }
    if (!auth?.user) return viewLogin();
    if (route === 'equipamento' && detailId) return viewEquipamento();
    if (route === 'cadastro') {
      if (!isFiscal()) return setRoute('equipamentos');
      return viewCadastro();
    }
    if (route === 'relatorios') {
      if (!isGerente()) return setRoute('equipamentos');
      return viewRelatorios();
    }
    if (route === 'whatsapp') {
      if (!isGerente()) return setRoute('equipamentos');
      return viewWhatsappWizard();
    }
    if (route === 'perfil') return viewPerfil();
    return viewEquipamentos();
  } catch (err) {
    if (err.status === 401) {
      clearAuth();
      auth = null;
      if (location.hash !== '#/login' && location.hash !== '#/admin-login') {
        location.hash = '#/login';
      }
      return viewLogin();
    }
    app().innerHTML = `<div class="alert error" style="margin:2rem">${err.message}</div>`;
  }
}

export function boot() {
  window.addEventListener('hashchange', () => {
    render().catch(() => {});
  });
  window.addEventListener('manu:auth-expired', () => {
    auth = null;
    if (location.hash !== '#/login' && !String(location.hash).includes('admin-login')) {
      location.hash = '#/login';
      render().catch(() => {});
    }
  });
  // CSS extras for badges used by SPA
  const style = document.createElement('style');
  style.textContent = `
    .badge{display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:.78rem;font-weight:600}
    .badge.ok{background:var(--success-light);color:var(--success)}
    .badge.warn{background:var(--warning-light);color:var(--warning)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;padding:.65rem 1rem;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
    .btn-primary{background:var(--primary);color:#fff}
    .btn-small{background:#fff;border:1px solid var(--border);padding:.35rem .7rem;font-size:.85rem}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin-bottom:1rem}
    .stat{background:var(--surface);border-radius:var(--radius);padding:1rem;box-shadow:var(--shadow-sm)}
    .stat-label{display:block;color:var(--text-muted);font-size:.82rem}
    .table-panel{background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm)}
    .table-wrap{overflow:auto}
    table{width:100%;border-collapse:collapse}
    th,td{text-align:left;padding:.85rem 1rem;border-bottom:1px solid var(--border);vertical-align:top}
    th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);background:#f3faf6}
    label{display:grid;gap:.35rem;font-weight:500;font-size:.92rem}
    input,select,textarea{width:100%;padding:.7rem .85rem;border:1px solid var(--border);border-radius:10px;font:inherit;background:#fff}
    .detail-head{margin:0 0 1rem}
    .detail-head h1{font-family:var(--font-display);letter-spacing:-.03em}
    .lede{color:var(--text-muted)}
    .back{color:var(--primary);font-weight:600;text-decoration:none;display:inline-block;margin-bottom:.75rem}
    .alert{padding:.85rem 1rem;border-radius:12px;margin-bottom:.75rem}
    .alert.success{background:var(--success-light);color:var(--success)}
    .alert.error{background:var(--danger-light);color:var(--danger)}
    @media(max-width:860px){.stats{grid-template-columns:1fr 1fr}.stats .stat:last-child{grid-column:1/-1}}
    @media(max-width:768px){
      .detail-head h1{font-size:1.35rem;line-height:1.2;word-break:break-word}
      .form-card,.info-block{max-width:100%!important}
      .page-content .btn{width:100%}
      .page-content .btn-small{width:auto}
      .auth-shell{min-height:100dvh;display:grid;place-items:center;padding:1rem;padding-bottom:max(1rem,env(safe-area-inset-bottom))}
      .auth-card{width:100%;max-width:420px;padding:1.35rem 1.15rem;background:var(--surface);border-radius:18px;box-shadow:var(--shadow);display:grid;gap:.75rem}
      .auth-card h1{font-family:var(--font-display);margin:0;font-size:1.45rem}
      .auth-card .subtitle{margin:0;color:var(--text-muted)}
      .auth-admin-link{margin:0;font-size:.85rem;color:var(--text-muted);text-align:center}
      .login-mobile-brand{display:flex;align-items:center;gap:.65rem}
      .login-mobile-brand .brand-logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(145deg,#34d399,#059669);color:#fff;display:grid;place-items:center;font-weight:800}
      .login-mobile-brand strong{font-family:var(--font-display);color:var(--primary)}
      .auth-card h1{display:none}
      .app-footer{display:none}
      .table-panel{overflow:visible}
    }
    @media(min-width:769px){.login-mobile-brand{display:none!important}.auth-shell{min-height:100vh;display:grid;place-items:center;padding:2rem}.auth-card{width:min(420px,100%);padding:1.5rem;background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow);display:grid;gap:.75rem}.auth-card h1{font-family:var(--font-display);margin:0}.auth-admin-link{margin:0;font-size:.85rem;color:var(--text-muted)}}
  `;
  document.head.appendChild(style);
  render();
}
