/* ═══════════════════════════════════════════════════════
   SIIE PWA · app.js · v1.0.0
   Lógica principal: auth, roles, navegación, offline, sync
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── CONFIGURACIÓN ─────────────────────────────────────
   Reemplazar con los valores reales del proyecto Google.
   APPS_SCRIPT_URL: URL del Web App publicado en Apps Script.
   GOOGLE_CLIENT_ID: OAuth 2.0 client ID de Google Cloud Console.
─────────────────────────────────────────────────────── */
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxDxiRPFcIgEOpkgGjE23IhDGOtwg_unDfAMPQRBpo0dglkXopT3q8ybb7sWJ6LRyiT4w/exec',
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID.apps.googleusercontent.com',
  VERSION: '1.0.0',
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutos de caché local
};

/* ── ROLES ─────────────────────────────────────────────
   Los emails se configuran en el Apps Script (tabla roles
   en Google Sheets). Acá solo definimos las capacidades.
─────────────────────────────────────────────────────── */
const ROLES = {
  admin:     { label: 'Administrador', cls: 'role-admin' },
  inspector: { label: 'Inspector',     cls: 'role-inspector' },
  viewer:    { label: 'Visualizador',  cls: 'role-viewer' },
};

/* ── ESTADO GLOBAL ─────────────────────────────────────── */
let state = {
  user: null,          // { name, email, picture, role }
  currentPage: 'inicio',
  edificios: [],
  stats: { edificios: 0, imp: 0, int: 0, ok: 0 },
  online: navigator.onLine,
  deferredInstall: null,
};

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Timeout de seguridad: si algo falla, mostrar el login igual
  const safetyTimer = setTimeout(() => {
    hideLoading();
    showLogin();
  }, 3000);

  registerSW();
  setupOfflineDetection();
  setupInstallPrompt();
  await initAuth();
  clearTimeout(safetyTimer);
});

/* ── SERVICE WORKER ─────────────────────────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  }
}

/* ══════════════════════════════════════════════════════
   AUTENTICACIÓN GOOGLE
══════════════════════════════════════════════════════ */
async function initAuth() {
  // Intentar restaurar sesión desde localStorage
  const saved = localStorage.getItem('siie_user');
  if (saved) {
    try {
      state.user = JSON.parse(saved);
      await onUserAuthenticated();
      return;
    } catch (e) {
      localStorage.removeItem('siie_user');
    }
  }
  // Mostrar login
  hideLoading();
  showLogin();
}

function showLogin() {
  const ls = document.getElementById('loading-screen');
  const login = document.getElementById('login-screen');
  if (ls) ls.style.display = 'none';
  if (login) login.classList.remove('hidden');
}

function hideLoading() {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'none';
}

/* Login con email + contraseña verificado contra la hoja "roles" del Sheet */
async function signIn() {
  const email = document.getElementById('login-email')?.value?.trim().toLowerCase();
  const pass  = document.getElementById('login-pass')?.value?.trim();
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-error');

  if (!email || !pass) {
    mostrarErrorLogin('Completá email y contraseña');
    return;
  }

  // Deshabilitar botón mientras carga
  btn.textContent = 'Verificando…';
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
  if (err) err.style.display = 'none';

  try {
    const res = await apiCallAuth(email, pass);

    if (res.ok) {
      state.user = res.user;
      localStorage.setItem('siie_user', JSON.stringify(state.user));
      await onUserAuthenticated();
    } else {
      mostrarErrorLogin(res.error || 'Email o contraseña incorrectos');
      btn.textContent = 'Ingresar al sistema';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  } catch (e) {
    mostrarErrorLogin('Sin conexión. Verificá tu internet e intentá de nuevo.');
    btn.textContent = 'Ingresar al sistema';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

function mostrarErrorLogin(msg) {
  const err = document.getElementById('login-error');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}

function signOut() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('siie_user');
  state.user = null;
  // Limpiar caché local sensible
  localStorage.removeItem('siie_stats_cache');
  localStorage.removeItem('siie_edificios_cache');
  location.reload();
}

/* ══════════════════════════════════════════════════════
   POST-AUTH: mostrar la app
══════════════════════════════════════════════════════ */
async function onUserAuthenticated() {
  hideLoading();

  // Ocultar login, mostrar app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('app-content').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');

  renderUserUI();
  applyRolePermissions();
  await loadInitialData();
  navigate('inicio');
}

/* ── RENDER UI DE USUARIO ───────────────────────────── */
function renderUserUI() {
  const u = state.user;
  const initials = (u.name || u.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const roleInfo = ROLES[u.role] || ROLES.viewer;

  // Top bar
  setAvatarContent('user-avatar-top', 'user-initials-top', u.picture, initials);
  const roleBadgeTop = document.getElementById('role-badge-top');
  roleBadgeTop.textContent = roleInfo.label;
  roleBadgeTop.className = 'role-badge ' + roleInfo.cls;

  // Perfil
  setAvatarContent('profile-avatar', 'profile-initials', u.picture, initials);
  document.getElementById('profile-name').textContent = u.name || u.email;
  document.getElementById('profile-email').textContent = u.email;
  const profileRoleBadge = document.getElementById('profile-role-badge');
  profileRoleBadge.textContent = roleInfo.label;
  profileRoleBadge.className = 'role-badge ' + roleInfo.cls;

  // Bienvenida
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('welcome-title').textContent = saludo + ', ' + (u.name?.split(' ')[0] || '');
}

function setAvatarContent(wrapperId, initialsId, picture, initials) {
  const wrapper = document.getElementById(wrapperId);
  const span = document.getElementById(initialsId);
  if (picture) {
    const img = document.createElement('img');
    img.src = picture;
    img.alt = 'avatar';
    if (span) span.style.display = 'none';
    wrapper.appendChild(img);
  } else {
    if (span) span.textContent = initials;
  }
}

/* ── PERMISOS POR ROL ───────────────────────────────── */
function applyRolePermissions() {
  const role = state.user?.role;

  // Menú admin solo para administradores
  if (role === 'admin') {
    document.getElementById('admin-menu').style.display = 'block';
  }

  // Tab "Cargar" solo para admin e inspector
  const navCargar = document.getElementById('nav-cargar');
  if (role === 'viewer') {
    navCargar.style.display = 'none';
  }

  // Acciones rápidas según rol
  const actionList = document.getElementById('action-list');
  const actions = getActionsForRole(role);
  actionList.innerHTML = actions.map(renderActionItem).join('');
}

function getActionsForRole(role) {
  const all = [
    { id: 'relevamiento', icon: 'check', color: 'blue', name: 'Nuevo relevamiento', desc: 'Diagnóstico inicial de un edificio', roles: ['admin','inspector'] },
    { id: 'inspeccion',   icon: 'search', color: 'green', name: 'Inspección periódica', desc: 'Seguimiento y actualización de estado', roles: ['admin','inspector'] },
    { id: 'intervencion', icon: 'tool', color: 'warn', name: 'Registrar intervención', desc: 'Fotos antes/después · ejecución', roles: ['admin','inspector'] },
    { id: 'mapa',   icon: 'map', color: 'gray', name: 'Ver mapa', desc: 'Todos los establecimientos georreferenciados', roles: ['admin','inspector','viewer'] },
    { id: 'tabla',  icon: 'list', color: 'gray', name: 'Tabla de edificios', desc: 'Buscar y filtrar establecimientos', roles: ['admin','inspector','viewer'] },
    { id: 'dashboard', icon: 'bar', color: 'blue', name: 'Dashboard', desc: 'Métricas y análisis de patrones', roles: ['admin','viewer'] },
  ];
  return all.filter(a => a.roles.includes(role));
}

const ICONS = {
  check: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
  tool: `<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  map: `<svg viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  list: `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  bar: `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
};

function renderActionItem(a) {
  return `
    <div class="action-item" onclick="navigate('${a.id}')">
      <div class="action-icon ai-${a.color}">${ICONS[a.icon]}</div>
      <div class="action-text">
        <div class="action-name">${a.name}</div>
        <div class="action-desc">${a.desc}</div>
      </div>
      <span class="action-arrow">›</span>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════════════ */
const PAGE_TITLES = {
  inicio:      'Inicio',
  mapa:        'Mapa',
  tabla:       'Establecimientos',
  cargar:      'Nueva carga',
  perfil:      'Perfil',
  relevamiento:'Relevamiento general',
  inspeccion:  'Inspección periódica',
  intervencion:'Intervención',
  dashboard:   'Dashboard',
};

function navigate(page) {
  // Páginas que son secciones del nav principal
  const mainPages = ['inicio', 'mapa', 'tabla', 'cargar', 'perfil'];

  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Mostrar la página target (si existe como div)
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  }

  // Actualizar nav
  mainPages.forEach(p => {
    const btn = document.getElementById('nav-' + p);
    if (btn) btn.classList.toggle('active', p === page);
  });

  // Título en top bar
  document.getElementById('topbar-page').textContent = PAGE_TITLES[page] || page;

  state.currentPage = page;

  // Scroll al tope
  document.getElementById('app-content').scrollTop = 0;

  // Acciones específicas por página
  if (page === 'tabla') loadEdificios();
  if (page === 'inicio') updateStats();
}

/* ══════════════════════════════════════════════════════
   DATOS: STATS E EDIFICIOS
══════════════════════════════════════════════════════ */
async function loadInitialData() {
  await Promise.all([
    loadStats(),
    cargarBorradores(),
  ]);
}

async function loadStats() {
  // Intentar desde caché primero
  const cached = getCached('siie_stats_cache');
  if (cached) {
    state.stats = cached;
    updateStats();
    return;
  }

  try {
    const res = await apiCall('stats');
    if (res.ok) {
      state.stats = res.data;
      setCache('siie_stats_cache', res.data);
      updateStats();
    }
  } catch (e) {
    // Sin conexión, usar defaults
    console.warn('Stats: sin conexión');
  }
}

function updateStats() {
  const s = state.stats;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? val : '—';
  };
  set('stat-edificios', s.edificios);
  set('stat-imp',       s.imp);
  set('stat-int',       s.int);
  set('stat-ok',        s.ok);
  set('welcome-sub',    `${s.edificios || 0} establecimiento${s.edificios !== 1 ? 's' : ''} en el sistema`);
}

async function loadEdificios() {
  const list = document.getElementById('edificios-list');
  list.innerHTML = '<div class="spinner"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div>';

  // Caché local
  const cached = getCached('siie_edificios_cache');
  if (cached) {
    state.edificios = cached;
    renderEdificios(cached);
    return;
  }

  try {
    const res = await apiCall('edificios', null, 'GET');
    if (res.ok) {
      state.edificios = res.data;
      setCache('siie_edificios_cache', res.data);
      renderEdificios(res.data);
    } else {
      list.innerHTML = '<div class="card"><div class="card-sub" style="text-align:center;padding:8px 0;">Error al cargar edificios</div></div>';
    }
  } catch (e) {
    // Offline: usar datos cacheados si existen
    const fallback = localStorage.getItem('siie_edificios_cache');
    if (fallback) {
      renderEdificios(JSON.parse(fallback).data);
    } else {
      list.innerHTML = '<div class="card"><div class="card-sub" style="text-align:center;padding:8px 0;">Sin conexión · no hay datos cacheados</div></div>';
    }
  }
}

function renderEdificios(edificios) {
  const list = document.getElementById('edificios-list');
  if (!edificios || !edificios.length) {
    list.innerHTML = '<div class="card"><div class="card-sub" style="text-align:center;padding:8px 0;">No hay edificios registrados aún</div></div>';
    return;
  }
  list.innerHTML = edificios.map(renderEdificioItem).join('');
}

function renderEdificioItem(e) {
  const impBadge = e.impide_pedagogico
    ? '<span class="badge b-danger">Impide</span>'
    : '<span class="badge b-ok">OK</span>';
  const estadoBadge = e.estado
    ? `<span class="badge b-neutral" style="font-size:10px;">${e.estado}</span>`
    : '';
  const fotoContent = e.foto_fachada
    ? `<img src="${e.foto_fachada}" alt="fachada" loading="lazy">`
    : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

  return `
    <div class="edificio-item" onclick="verEdificio('${e.id}')">
      <div class="edificio-foto">${fotoContent}</div>
      <div class="edificio-info">
        <div class="edificio-nombre">${e.nombre}</div>
        <div class="edificio-meta">${e.delegacion || ''} · Inspector: ${e.inspector || '—'}</div>
      </div>
      <div class="edificio-estado">
        ${impBadge}
        ${estadoBadge}
      </div>
    </div>`;
}

function filtrarEdificios(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderEdificios(state.edificios);
    return;
  }
  const filtrados = state.edificios.filter(e =>
    (e.nombre || '').toLowerCase().includes(q) ||
    (e.delegacion || '').toLowerCase().includes(q) ||
    (e.localidad || '').toLowerCase().includes(q)
  );
  renderEdificios(filtrados);
}

function abrirFiltros() {
  alert('Panel de filtros · próximamente\n\nFiltros: etapa · inspector · estado · impacto pedagógico');
}

function verEdificio(id) {
  window.location.href = 'ficha.html?id=' + id;
}

/* ══════════════════════════════════════════════════════
   BORRADORES OFFLINE
══════════════════════════════════════════════════════ */
function cargarBorradores() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('siie_borrador_'));
  const lista = document.getElementById('borradores-list');
  if (!keys.length) {
    lista.innerHTML = '<div class="card"><div class="card-sub" style="text-align:center;padding:8px 0;">No hay borradores guardados</div></div>';
    return;
  }
  lista.innerHTML = keys.map(k => {
    try {
      const d = JSON.parse(localStorage.getItem(k));
      return `
        <div class="card" style="cursor:pointer;" onclick="abrirBorrador('${k}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div class="card-title" style="font-size:13px;">${d.identificacion?.nombre || 'Sin nombre'}</div>
              <div class="card-sub">${d._tipo || 'Relevamiento'} · ${formatDate(d._fecha_carga)}</div>
            </div>
            <span class="badge b-warn">Borrador</span>
          </div>
        </div>`;
    } catch { return ''; }
  }).join('');
}

function abrirBorrador(key) {
  alert(`Abrir borrador: ${key}\n\nRedirige al formulario con datos precargados · próximamente`);
}

/* ══════════════════════════════════════════════════════
   API: COMUNICACIÓN CON APPS SCRIPT
══════════════════════════════════════════════════════ */
async function apiCall(endpoint, body = null, method = null) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set('action', endpoint);

  if (state.user?.email) {
    url.searchParams.set('email', state.user.email);
  }

  const options = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
  };

  if (method) options.method = method;
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url.toString(), options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* Auth via GET usando no-cors + iframe trick para evitar CORS con cuentas Gmail */
async function apiCallAuth(email, password) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set('action', 'auth');
  url.searchParams.set('email', email);
  url.searchParams.set('password', encodeURIComponent(password));
  url.searchParams.set('callback', 'siieCallback');

  return new Promise((resolve, reject) => {
    // Limpiar callback anterior
    if (window.siieCallback) delete window.siieCallback;

    // Timeout de 10 segundos
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado'));
    }, 10000);

    // Script JSONP
    const script = document.createElement('script');
    script.src = url.toString();

    window.siieCallback = (data) => {
      cleanup();
      resolve(data);
    };

    function cleanup() {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window.siieCallback;
    }

    script.onerror = () => {
      cleanup();
      reject(new Error('Error de conexión'));
    };

    document.head.appendChild(script);
  });
}

/* ══════════════════════════════════════════════════════
   CACHÉ LOCAL
══════════════════════════════════════════════════════ */
function setCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CONFIG.CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

/* ══════════════════════════════════════════════════════
   OFFLINE DETECTION
══════════════════════════════════════════════════════ */
function setupOfflineDetection() {
  const toast = document.getElementById('offline-toast');

  window.addEventListener('offline', () => {
    state.online = false;
    toast.classList.add('show');
  });

  window.addEventListener('online', () => {
    state.online = true;
    toast.classList.remove('show');
    syncPendingData();
  });

  if (!navigator.onLine) toast.classList.add('show');
}

async function syncPendingData() {
  // Buscar borradores pendientes de sync
  const pendingKeys = Object.keys(localStorage).filter(k => k.startsWith('siie_borrador_'));
  if (!pendingKeys.length) return;

  console.log(`Sincronizando ${pendingKeys.length} borradores…`);

  for (const key of pendingKeys) {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      const res = await apiCall('sync_relevamiento', data);
      if (res.ok) {
        localStorage.removeItem(key);
        console.log(`Borrador ${key} sincronizado`);
      }
    } catch (e) {
      console.warn(`Error sync ${key}:`, e);
    }
  }

  cargarBorradores();
}

/* ══════════════════════════════════════════════════════
   INSTALL PROMPT (PWA)
══════════════════════════════════════════════════════ */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstall = e;

    // Solo mostrar si el usuario no lo descartó antes
    if (!localStorage.getItem('siie_install_dismissed')) {
      document.getElementById('install-banner').classList.add('show');
    }
  });

  window.addEventListener('appinstalled', () => {
    document.getElementById('install-banner').classList.remove('show');
    state.deferredInstall = null;
  });
}

function installApp() {
  if (!state.deferredInstall) {
    // iOS: instrucciones manuales
    alert('Para instalar en iPhone:\n\n1. Tocá el botón de compartir ⬆ en Safari\n2. Seleccioná "Añadir a pantalla de inicio"\n3. Confirmá con "Añadir"');
    return;
  }
  state.deferredInstall.prompt();
  state.deferredInstall.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      document.getElementById('install-banner').classList.remove('show');
    }
    state.deferredInstall = null;
  });
}

function dismissInstall() {
  document.getElementById('install-banner').classList.remove('show');
  localStorage.setItem('siie_install_dismissed', '1');
}

/* ══════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════ */
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return iso; }
}

function verInfoSistema() {
  alert(`SIIE · Sistema Integral de Infraestructura Educativa\n\nVersión: ${CONFIG.VERSION}\nStack: PWA + Google Apps Script + Google Sheets\nHosting: GitHub Pages\n\nDesarrollado para la gestión de infraestructura pública basada en evidencia.`);
}
