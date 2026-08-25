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
  location.hash = id ? `#/${name}/${id}` : `#/${name}`;
  render();
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
  const nav = adminMode
    ? `
      <a class="nav-item ${route === 'admin-usuarios' ? 'active' : ''}" data-go="admin-usuarios">Usuários</a>
      <a class="nav-item ${route === 'admin-filiais' ? 'active' : ''}" data-go="admin-filiais">Filiais</a>
      <a class="nav-item ${route === 'admin-historico' ? 'active' : ''}" data-go="admin-historico">Histórico</a>
    `
    : `
      <a class="nav-item ${route === 'equipamentos' || route === 'equipamento' ? 'active' : ''}" data-go="equipamentos">Equipamentos</a>
      ${isFiscal() ? `<a class="nav-item ${route === 'cadastro' ? 'active' : ''}" data-go="cadastro">Cadastro</a>` : ''}
      ${isGerente() ? `<a class="nav-item ${route === 'relatorios' ? 'active' : ''}" data-go="relatorios">Relatórios</a>` : ''}
      ${isGerente() ? `<a class="nav-item ${route === 'whatsapp' ? 'active' : ''}" data-go="whatsapp">WhatsApp</a>` : ''}
      <a class="nav-item ${route === 'perfil' ? 'active' : ''}" data-go="perfil">Meu perfil</a>
    `;

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
      <footer class="app-footer">ManuControl · API + Vercel</footer>
    </div>
  </div>`;
}

function bindShell() {
  document.getElementById('btn-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAuth();
    auth = null;
    render();
  });
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.app-shell')?.classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.app-shell')?.classList.remove('sidebar-open');
  });
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
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
    <div class="auth-shell" style="min-height:100vh;display:grid;place-items:center;padding:2rem">
      <form class="auth-card form-card" id="login-form" style="width:min(420px,100%);padding:1.5rem;background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow)">
        <h1 style="font-family:var(--font-display);margin-bottom:.5rem">ManuControl</h1>
        <p class="subtitle" style="color:var(--text-muted);margin-bottom:1rem">Login da filial</p>
        ${loadError ? `<div class="alert error" style="margin-bottom:1rem;padding:.75rem;background:#fee;border-radius:8px;font-size:.9rem">${loadError}<br><small>Backend Flask não roda na Vercel — use Render. Front: <code>manufront.vercel.app</code></small></div>` : ''}
        <label>Filial<select name="base_id" required ${loadError ? 'disabled' : ''}>${options || '<option value="">—</option>'}</select></label>
        <label style="margin-top:.75rem;display:block">Usuário<input name="usuario" required autocomplete="username" /></label>
        <label style="margin-top:.75rem;display:block">Senha<input name="senha" type="password" required autocomplete="current-password" /></label>
        <button class="btn btn-primary" style="margin-top:1rem;width:100%" type="submit" ${loadError ? 'disabled' : ''}>Entrar</button>
        <p style="margin-top:1rem;font-size:.85rem;color:var(--text-muted)">Admin? <a href="#/admin-login" id="go-admin">Acesso administrativo</a></p>
        <p style="margin-top:.5rem;font-size:.8rem;color:var(--text-muted)">fiscal/gerente · senha 1234</p>
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
    <div style="min-height:100vh;display:grid;place-items:center;padding:2rem">
      <form class="form-card" id="admin-login" style="width:min(420px,100%);padding:1.5rem;background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow)">
        <h1>Admin ManuControl</h1>
        <label style="display:block;margin-top:1rem">Usuário<input name="usuario" required /></label>
        <label style="display:block;margin-top:.75rem">Senha<input name="senha" type="password" required /></label>
        <button class="btn btn-primary" style="margin-top:1rem;width:100%" type="submit">Entrar</button>
        <p style="margin-top:1rem"><a href="#/login" id="back-login">Voltar ao login de filial</a></p>
      </form>
    </div>`;
  document.getElementById('back-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    setRoute('login');
  });
  document.getElementById('admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/auth/admin/login', {
        method: 'POST',
        body: { usuario: fd.get('usuario'), senha: fd.get('senha') },
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
  await ensureMeta();
  const data = await api('/ativos?com_stats=1', { token: token() });
  const rows = data.ativos
    .map(
      (a) => `
    <tr data-id="${a.id}" class="click-row">
      <td><strong>${a.codigo}</strong><div class="tiny muted">${a.nome}</div></td>
      <td>${meta.tipos_equipamento[a.tipo] || a.tipo || '—'}</td>
      <td>${a.em_manutencao ? '<span class="badge warn">Em manutenção</span>' : '<span class="badge ok">Operacional</span>'}</td>
      <td>${meta.locais[a.local] || a.local || '—'}</td>
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
      <div class="table-wrap"><table>
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
  let pollId = null;

  const stopPoll = () => {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  };

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
      toast(r.mensagem || 'Desconectado');
      paint();
    } catch (err) {
      alert(err.message);
    }
  };

  const paint = () => {
    const steps = `
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
        <span class="badge ${passo === 'qr' ? 'warn' : 'ok'}">1. QR</span>
        <span class="badge ${passo === 'grupo' ? 'warn' : passo === 'pronto' ? 'ok' : ''}">2. Grupo</span>
        <span class="badge ${passo === 'pronto' ? 'ok' : ''}">3. Chatbot</span>
      </div>`;

    let body = '';
    if (passo === 'qr') {
      body = `
        <section class="form-card" style="padding:1.25rem;background:var(--surface);border-radius:var(--radius);max-width:520px;display:grid;gap:.75rem">
          <h2 style="margin:0">Conectar WhatsApp</h2>
          <p style="margin:0;color:var(--text-muted);font-size:.9rem">
            Clique em <strong>Gerar QR Code</strong>, escaneie no celular
            (WhatsApp → Aparelhos conectados). O token é criado automaticamente.
          </p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-primary" type="button" id="wa-start">Gerar QR Code</button>
          </div>
          <div id="wa-qr-box" style="min-height:220px;display:grid;place-items:center;background:#f8fafc;border-radius:12px;border:1px dashed var(--border)">
            ${
              qrcode
                ? `<img src="${qrcode}" alt="QR WhatsApp" style="max-width:240px;width:100%;height:auto" />`
                : '<p style="color:var(--text-muted);padding:1rem;text-align:center">Clique em Gerar QR Code</p>'
            }
          </div>
          <p id="wa-hint" style="margin:0;font-size:.85rem;color:var(--text-muted)">Aguardando geração do QR…</p>
        </section>`;
    } else if (passo === 'grupo') {
      const opts = grupos
        .map(
          (g) =>
            `<label style="display:flex;gap:.6rem;align-items:flex-start;padding:.55rem .4rem;border-bottom:1px solid var(--border)">
              <input type="radio" name="grupo" value="${g.jid}" ${g.jid === cfg.whatsapp_grupo ? 'checked' : ''}>
              <span><strong>${g.nome || g.jid}</strong><br><small style="color:var(--text-muted)">${g.jid}</small></span>
            </label>`
        )
        .join('');
      body = `
        <section class="form-card" style="padding:1.25rem;background:var(--surface);border-radius:var(--radius);max-width:560px;display:grid;gap:.75rem">
          <h2 style="margin:0">Selecionar grupo</h2>
          <p style="margin:0;color:var(--text-muted);font-size:.9rem">WhatsApp conectado. Escolha o grupo onde o chatbot vai responder.</p>
          <div id="wa-grupos" style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:10px">
            ${opts || '<p style="padding:1rem;color:var(--text-muted)">Nenhum grupo encontrado. Entre no grupo com o chip e atualize.</p>'}
          </div>
          <label style="display:flex;align-items:center;gap:.5rem">
            <input type="checkbox" id="wa-alerta" ${cfg.whatsapp_alerta ? 'checked' : ''}> Alertas ao abrir/encerrar OS neste grupo
          </label>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-primary" type="button" id="wa-save-grupo">Salvar grupo e ativar chatbot</button>
            <button class="btn btn-small" type="button" id="wa-reload-grupos">Atualizar lista</button>
            <button class="btn btn-small" type="button" id="wa-desconectar" style="color:#b91c1c">Desconectar</button>
          </div>
        </section>`;
    } else {
      body = `
        <section class="form-card" style="padding:1.25rem;background:var(--surface);border-radius:var(--radius);max-width:560px;display:grid;gap:.75rem">
          <h2 style="margin:0">Chatbot ativo</h2>
          <p style="margin:0">Grupo: <strong>${cfg.whatsapp_grupo || '—'}</strong></p>
          <p style="margin:0;color:var(--text-muted);font-size:.9rem">
            No grupo, envie <strong>código</strong>, <strong>patrimônio</strong> ou <strong>nome</strong> do equipamento.
            O bot responde com um link para <strong>abrir ou encerrar manutenção</strong>.
          </p>
          <p style="margin:0;font-size:.85rem">Comandos: <code>ajuda</code> · <code>lista</code></p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-small" type="button" id="wa-trocar-grupo">Trocar grupo</button>
            <button class="btn btn-small" type="button" id="wa-desconectar" style="color:#b91c1c">Desconectar</button>
          </div>
        </section>`;
    }

    app().innerHTML = shell(`
      <section class="detail-head">
        <h1>WhatsApp da filial</h1>
        <p class="lede">Filial ${user()?.base_codigo} — fluxo QR → grupo → chatbot</p>
      </section>
      ${steps}
      ${body}`);
    bindShell();

    document.getElementById('wa-start')?.addEventListener('click', async () => {
      const hint = document.getElementById('wa-hint');
      const box = document.getElementById('wa-qr-box');
      try {
        if (hint) hint.textContent = 'Gerando token e QR…';
        if (box) box.innerHTML = '<p style="color:var(--text-muted)">Criando sessão no WuzAPI…</p>';
        const r = await api('/filial/whatsapp/conectar', { method: 'POST', body: {}, token: token() });
        qrcode = r.qrcode || '';
        if (r.provision?.token) cfg.wuzapi_token = r.provision.token;
        // Só avança se loggedIn real — connected sozinho não basta
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
            box.innerHTML = `<p style="color:#b91c1c;padding:1rem;text-align:center">${r.mensagem || r.error || 'Não veio QR do WuzAPI'}</p>`;
          }
          return;
        }
        paint();
        if (hint) hint.textContent = r.mensagem || 'Escaneie o QR. Aguardando conexão…';
        startPoll();
      } catch (err) {
        if (hint) hint.textContent = err.message;
        if (box) {
          box.innerHTML = `<p style="color:#b91c1c;padding:1rem;text-align:center">${err.message}</p>`;
        }
        alert(err.message);
      }
    });

    document.getElementById('wa-reload-grupos')?.addEventListener('click', async () => {
      await loadGrupos();
      paint();
    });

    document.getElementById('wa-save-grupo')?.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="grupo"]:checked')?.value;
      if (!selected) {
        alert('Selecione um grupo');
        return;
      }
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
        cfg.whatsapp_alerta = document.getElementById('wa-alerta')?.checked ? 1 : 0;
        passo = 'pronto';
        toast('Chatbot ativado');
        paint();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('wa-trocar-grupo')?.addEventListener('click', async () => {
      passo = 'grupo';
      await loadGrupos();
      paint();
    });

    document.getElementById('wa-desconectar')?.addEventListener('click', doDesconectar);
  };

  const loadGrupos = async () => {
    const data = await api('/filial/whatsapp/grupos', { token: token() });
    grupos = data.grupos || [];
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

  if (passo === 'grupo') {
    try {
      await loadGrupos();
    } catch (err) {
      if (err.status === 400) {
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
  await ensureMeta();
  const d = await api(`/acesso-rapido/${detailId}`);
  const a = d.ativo || d;
  const manut = d.manutencao_aberta || null;
  const baseLabel = d.base ? `${d.base.codigo} · ${d.base.nome}` : '';
  app().innerHTML = `
    <div class="app-shell" style="max-width:720px;margin:0 auto;padding:1rem">
      <header style="margin-bottom:1rem">
        <p class="subtitle" style="margin:0">Acesso rápido WhatsApp</p>
        <h1 style="margin:.2rem 0">${a.codigo} · ${a.nome}</h1>
        <p class="lede">${baseLabel} · ${a.em_manutencao ? 'Em manutenção' : 'Operacional'}</p>
        <p style="font-size:.8rem;color:var(--text-muted)">Expira: ${d.expira_em || '—'}</p>
      </header>
      <section class="info-block" style="padding:1rem;margin-bottom:1rem;background:var(--surface);border-radius:var(--radius)">
        <p>Tipo: ${meta.tipos_equipamento[a.tipo] || a.tipo || '—'} · Local: ${meta.locais[a.local] || a.local || '—'}</p>
        <p>${a.observacoes || ''}</p>
      </section>
      ${
        a.em_manutencao
          ? `<form id="form-encerrar" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius)">
              <h2>Encerrar OS ${manut?.os_numero || a.ordem_servico || ''}</h2>
              <label>Data conclusão<input type="date" name="data_conclusao" required value="${new Date().toISOString().slice(0, 10)}"></label>
              <label>Observações<textarea name="observacoes_encerramento" required></textarea></label>
              <button class="btn btn-primary" type="submit">Encerrar manutenção</button>
            </form>`
          : `<form id="form-abrir" class="form-card" style="padding:1rem;background:var(--surface);border-radius:var(--radius)">
              <h2>Abrir manutenção</h2>
              <label>Nº OS<input name="os_numero" required></label>
              <label>Data<input type="date" name="data_abertura" required value="${new Date().toISOString().slice(0, 10)}"></label>
              <label>Responsável<input name="responsavel" value="Fiscal WhatsApp"></label>
              <label>Local<select name="local"><option value="base">Na base</option><option value="terceiros">Em terceiros</option></select></label>
              <label>Observações<textarea name="observacoes_abertura" required></textarea></label>
              <button class="btn btn-primary" type="submit">Abrir OS</button>
            </form>`
      }
    </div>`;
  document.getElementById('form-abrir')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/acesso-rapido/${detailId}/manutencao/abrir`, { method: 'POST', body });
      toast('Manutenção aberta');
      render();
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById('form-encerrar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/acesso-rapido/${detailId}/manutencao/encerrar`, { method: 'POST', body });
      toast('Manutenção encerrada');
      render();
    } catch (err) {
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
      return viewLogin();
    }
    app().innerHTML = `<div class="alert error" style="margin:2rem">${err.message}</div>`;
  }
}

export function boot() {
  window.addEventListener('hashchange', () => render());
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
    @media(max-width:860px){.stats{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  render();
}
