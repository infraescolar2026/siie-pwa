/* ═══════════════════════════════════════════════════════
   SIIE PWA · ficha.js · v1.0.0
   ═══════════════════════════════════════════════════════ */

'use strict';

const APPS_SCRIPT_URL_FICHA = (() => {
  if (typeof CONFIG !== 'undefined') return CONFIG.APPS_SCRIPT_URL;
  return localStorage.getItem('siie_apps_script_url') || '';
})();

let edificioData = null;
let solapaActual = 'general';

const ESTADO_CONFIG = {
  critico: { cls: 'estado-critico', label: 'Crítico' },
  malo:    { cls: 'estado-malo',    label: 'Malo' },
  regular: { cls: 'estado-regular', label: 'Regular' },
  bueno:   { cls: 'estado-bueno',   label: 'Bueno' },
  optimo:  { cls: 'estado-optimo',  label: 'Óptimo' },
};

const ESTADO_INT = {
  pendiente:            { cls: 'b-neutral', label: 'Pendiente' },
  en_analisis:          { cls: 'b-neutral', label: 'En análisis' },
  aprobada:             { cls: 'b-info',    label: 'Aprobada' },
  en_ejecucion:         { cls: 'b-warn',    label: 'En ejecución' },
  finalizada:           { cls: 'b-ok',      label: 'Finalizada' },
  resuelta_con_historial:{ cls: 'b-ok',     label: 'Resuelta' },
};

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) {
    showToast('ID de edificio no especificado');
    return;
  }

  // Verificar permisos
  const user = JSON.parse(localStorage.getItem('siie_user') || '{}');
  if (user.role === 'viewer') {
    document.getElementById('fab-wrap').style.display = 'none';
    document.querySelector('.btn-accion').style.display = 'none';
  }

  await cargarEdificio(id);
});

/* ══════════════════════════════════════════════════════
   CARGA DE DATOS
══════════════════════════════════════════════════════ */
async function cargarEdificio(id) {
  // Intentar caché primero
  const cached = getCachedEdificio(id);
  if (cached) {
    edificioData = cached;
    renderEdificio();
  }

  // Cargar desde API
  try {
    const user = JSON.parse(localStorage.getItem('siie_user') || '{}');
    const url = new URL(APPS_SCRIPT_URL_FICHA);
    url.searchParams.set('action', 'edificio');
    url.searchParams.set('id', id);
    url.searchParams.set('email', user.email || '');

    const res = await fetch(url.toString());
    const result = await res.json();

    if (result.ok) {
      edificioData = result.data;
      setCachedEdificio(id, edificioData);
      renderEdificio();
    } else {
      if (!cached) showToast('Error al cargar el edificio');
    }
  } catch (e) {
    if (!cached) showToast('Sin conexión · mostrando datos cacheados');
  }
}

/* ══════════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════════ */
function renderEdificio() {
  const e = edificioData;
  if (!e) return;

  // Top bar
  document.getElementById('topbar-nombre').textContent = e.nombre || 'Edificio';

  // Header
  document.getElementById('hdr-nombre').textContent = e.nombre || '—';
  document.getElementById('hdr-meta').textContent =
    [e.delegacion, e.localidad, e.direccion].filter(Boolean).join(' · ');

  // Foto fachada
  if (e.foto_fachada) {
    const foto = document.getElementById('edificio-foto');
    foto.innerHTML = `<img src="${e.foto_fachada}" alt="Fachada">`;
  }

  // Badges
  const badges = document.getElementById('hdr-badges');
  const imp = e.impide_desarrollo_pedagogico;
  badges.innerHTML = `
    ${imp ? '<span class="badge b-danger">Impide pedagógico</span>' : '<span class="badge b-ok">Sin impacto pedagógico</span>'}
    ${e.etapa_id ? `<span class="badge b-info">${e.etapa_id}</span>` : ''}
    ${e.estado ? `<span class="badge b-neutral">${e.estado}</span>` : ''}
  `;

  // Solapa general
  renderGeneral(e);

  // Solapas bajo demanda
  renderContacto(e);
  renderSectores(e.sectores || []);
  renderIntervenciones(e.intervenciones || []);
}

/* ── GENERAL ── */
function renderGeneral(e) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val) { el.textContent = val; el.classList.remove('empty'); }
    else     { el.textContent = 'Sin datos'; el.classList.add('empty'); }
  };

  // Estado
  const est = ESTADO_CONFIG[e.estado] || null;
  if (est) {
    document.getElementById('estado-dot').className = 'estado-dot ' + est.cls;
    document.getElementById('estado-texto').textContent = est.label;
  }
  const pct = e.porcentaje_funcionamiento || e.pct_funcionamiento;
  if (pct) document.getElementById('estado-pct').textContent = pct + '%';

  set('g-numero',    e.numero_establecimiento);
  set('g-tipo',      e.tipo);
  set('g-delegacion',e.delegacion);
  set('g-localidad', e.localidad);
  set('g-direccion', e.direccion);
  set('g-etapa',     e.etapa_id);
  set('g-zona',      e.zona_id);
  set('g-inspector', e.inspector_id);
  set('g-matricula', e.matricula);
  set('g-secciones', e.secciones);
  set('g-turnos',    e.turnos);
  set('g-docentes',  e.personal_docente);
}

/* ── CONTACTO ── */
function renderContacto(e) {
  document.getElementById('c-tel').textContent   = e.telefono_fijo || '—';
  document.getElementById('c-email').textContent = e.email_institucional || '—';

  const body = document.getElementById('contacto-body');
  if (e.referente_nombre || e.referente) {
    body.innerHTML = `
      <div class="field-grid fg-2">
        <div class="field-ro" style="grid-column:span 2">
          <span class="field-lbl">Nombre y cargo</span>
          <span class="field-val">${e.referente_nombre || e.referente || '—'}</span>
        </div>
        <div class="field-ro">
          <span class="field-lbl">Celular</span>
          <span class="field-val mono">${e.referente_cel || '—'}</span>
        </div>
        <div class="field-ro">
          <span class="field-lbl">Canal preferido</span>
          <span class="field-val">${e.referente_canal || '—'}</span>
        </div>
      </div>`;
  } else {
    body.innerHTML = `<div class="empty"><p>Sin referente institucional cargado</p></div>`;
  }
}

/* ── SECTORES ── */
function renderSectores(sectores) {
  document.getElementById('sectores-count').textContent = sectores.length;
  const body = document.getElementById('sectores-body');

  if (!sectores.length) {
    body.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
      <p>No hay sectores cargados aún</p></div>`;
    return;
  }

  body.innerHTML = sectores.map(s => `
    <div class="sector-item">
      <div class="sector-icon">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div class="sector-info">
        <div class="sector-nombre">${s.tipo_sector || s.tipo || '—'} · ${s.identificador || ''}</div>
        <div class="sector-meta">${s.planta || ''} ${s.en_uso === 'S' || s.en_uso === true ? '· En uso' : '· Sin uso'}</div>
      </div>
      ${s.en_uso === 'S' || s.en_uso === true
        ? '<span class="badge b-ok">En uso</span>'
        : '<span class="badge b-neutral">Sin uso</span>'}
    </div>`).join('');
}

/* ── RELEVAMIENTOS ── */
function renderRelevamientos(relevamientos) {
  document.getElementById('rel-count').textContent = relevamientos.length;
  const body = document.getElementById('relevamientos-body');

  if (!relevamientos.length) {
    body.innerHTML = `<div class="card"><div class="empty"><p>Sin relevamientos cargados</p></div></div>`;
    return;
  }

  body.innerHTML = `<div class="card">${relevamientos.map(r => `
    <div class="rel-item">
      <div class="rel-header">
        <span class="rel-fecha">${formatDate(r.fecha)}</span>
        <span class="badge ${r.tipo_relevamiento === 'general' ? 'b-info' : 'b-neutral'}">
          ${r.tipo_relevamiento === 'general' ? 'Relevamiento general' : 'Inspección'}
        </span>
      </div>
      <div class="rel-inspector">Inspector: ${r.inspector_id || '—'}</div>
      ${r.observaciones_generales ? `<div style="font-size:12px;color:var(--gray-400);margin-top:4px;">${r.observaciones_generales}</div>` : ''}
    </div>`).join('')}</div>`;
}

/* ── INTERVENCIONES ── */
function renderIntervenciones(intervenciones) {
  document.getElementById('int-count').textContent = intervenciones.length;
  const body = document.getElementById('intervenciones-body');

  if (!intervenciones.length) {
    body.innerHTML = `<div class="card"><div class="empty"><p>Sin intervenciones registradas</p></div></div>`;
    return;
  }

  body.innerHTML = `<div class="card">${intervenciones.map(i => {
    const est = ESTADO_INT[i.estado] || { cls: 'b-neutral', label: i.estado || '—' };
    return `
      <div class="int-item">
        <div class="int-header">
          <span class="int-comp">${i.componente || '—'}</span>
          <span class="badge ${est.cls}">${est.label}</span>
          ${i.impide_desarrollo_pedagogico ? '<span class="badge b-danger">Impide</span>' : ''}
        </div>
        <div class="int-sector">${i.sector_id || ''} · ${i.tipo_intervencion || ''}</div>
        <div class="int-fecha">${formatDate(i.fecha_creacion)}</div>
        ${i.descripcion_tecnica ? `<div style="font-size:12px;color:var(--gray-500);margin-top:4px;">${i.descripcion_tecnica}</div>` : ''}
      </div>`;
  }).join('')}</div>`;
}

/* ── HISTORIAL ── */
function renderHistorial(historial) {
  document.getElementById('hist-count').textContent = historial.length;
  const body = document.getElementById('historial-body');

  if (!historial.length) {
    body.innerHTML = `<div class="empty"><p>Sin historial registrado</p></div>`;
    return;
  }

  body.innerHTML = historial.map((h, i) => `
    <div class="hist-item">
      <div class="hist-line">
        <div class="hist-dot ${h.evolucion || ''}"></div>
        ${i < historial.length - 1 ? '<div class="hist-connector"></div>' : ''}
      </div>
      <div class="hist-body">
        <div class="hist-titulo">${h.estado_nuevo || h.observaciones?.slice(0,40) || '—'}</div>
        <div class="hist-meta">${formatDate(h.fecha)} · ${h.inspector_id || '—'}</div>
        ${h.observaciones ? `<div class="hist-obs">${h.observaciones}</div>` : ''}
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════
   NAVEGACIÓN SOLAPAS
══════════════════════════════════════════════════════ */
function irSolapa(nombre) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.solapa').forEach(s => s.classList.remove('active'));

  document.getElementById('tab-' + nombre).classList.add('active');
  document.getElementById('sol-' + nombre).classList.add('active');
  solapaActual = nombre;

  // Cargar datos bajo demanda
  if (nombre === 'relevamientos' && edificioData) {
    cargarRelevamientosEdificio();
  }
  if (nombre === 'historial' && edificioData) {
    cargarHistorialEdificio();
  }
}

async function cargarRelevamientosEdificio() {
  if (!edificioData) return;
  try {
    const user = JSON.parse(localStorage.getItem('siie_user') || '{}');
    const url = new URL(APPS_SCRIPT_URL_FICHA);
    url.searchParams.set('action', 'relevamientos_edificio');
    url.searchParams.set('id', edificioData.id_edificio);
    url.searchParams.set('email', user.email || '');

    const res = await fetch(url.toString());
    const result = await res.json();
    if (result.ok) renderRelevamientos(result.data || []);
  } catch (e) {
    renderRelevamientos([]);
  }
}

async function cargarHistorialEdificio() {
  if (!edificioData) return;
  try {
    const user = JSON.parse(localStorage.getItem('siie_user') || '{}');
    const url = new URL(APPS_SCRIPT_URL_FICHA);
    url.searchParams.set('action', 'historial_edificio');
    url.searchParams.set('id', edificioData.id_edificio);
    url.searchParams.set('email', user.email || '');

    const res = await fetch(url.toString());
    const result = await res.json();
    if (result.ok) renderHistorial(result.data || []);
  } catch (e) {
    renderHistorial([]);
  }
}

/* ══════════════════════════════════════════════════════
   ACCIONES
══════════════════════════════════════════════════════ */
function nuevaInspeccion() {
  const id = new URLSearchParams(location.search).get('id');
  window.location.href = `inspeccion.html?edificio_id=${id}&nombre=${encodeURIComponent(edificioData?.nombre || '')}`;
}

function nuevoRelevamiento() {
  window.location.href = 'relevamiento.html';
}

/* ══════════════════════════════════════════════════════
   CACHÉ
══════════════════════════════════════════════════════ */
function setCachedEdificio(id, data) {
  localStorage.setItem('siie_edificio_' + id, JSON.stringify({ data, ts: Date.now() }));
}

function getCachedEdificio(id) {
  try {
    const raw = localStorage.getItem('siie_edificio_' + id);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 10 * 60 * 1000) return null; // 10 min TTL
    return data;
  } catch { return null; }
}

/* ══════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════ */
function formatDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return val; }
}

function showToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
