/* ═══════════════════════════════════════════════════════
   SIIE PWA · dashboard.js · v1.0.0
   ═══════════════════════════════════════════════════════ */

'use strict';

const APPS_SCRIPT_URL_DASH = 'https://script.google.com/macros/s/AKfycbxDxiRPFcIgEOpkgGjE23IhDGOtwg_unDfAMPQRBpo0dglkXopT3q8ybb7sWJ6LRyiT4w/exec';

const ESTADO_COLORS = {
  pendiente:             '#c8c8c2',
  en_analisis:           '#85B7EB',
  aprobada:              '#378ADD',
  en_ejecucion:          '#EF9F27',
  finalizada:            '#1D9E75',
  resuelta_con_historial:'#085041',
};

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDashboard();
});

async function cargarDashboard() {
  const user = JSON.parse(localStorage.getItem('siie_user') || '{}');

  // Intentar caché
  const cached = getCached('siie_dashboard_cache');
  if (cached) renderDashboard(cached);

  try {
    const url = new URL(APPS_SCRIPT_URL_DASH);
    url.searchParams.set('action', 'dashboard');
    url.searchParams.set('email', user.email || '');

    const res  = await fetch(url.toString());
    const data = await res.json();

    if (data.ok) {
      setCache('siie_dashboard_cache', data.data);
      renderDashboard(data.data);
    }
  } catch (e) {
    if (!cached) renderDashboardDemo();
  }
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function renderDashboard(d) {
  // Métricas
  setText('d-edificios', d.edificios ?? '—');
  setText('d-alumnos',   d.alumnos   ?? '—');
  setText('d-imp',       d.imp       ?? '—');
  setText('d-int',       d.int       ?? '—');
  setText('d-ok',        d.ok        ?? '—');
  setText('d-insp',      d.inspecciones ?? '—');

  // Gráfico evolución
  if (d.evolucion) renderChartEvolucion(d.evolucion);

  // Estados
  if (d.estados) renderEstados(d.estados);

  // Patrones
  if (d.patrones) renderPatrones(d.patrones);

  // Territorial
  if (d.territorial) renderTerritorial(d.territorial);
}

/* ── CHART EVOLUCIÓN ── */
function renderChartEvolucion(evolucion) {
  const ctx = document.getElementById('chart-evolucion')?.getContext('2d');
  if (!ctx) return;

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#888' : '#999';

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: evolucion.map(e => e.mes),
      datasets: [
        {
          label: 'Abiertas',
          data: evolucion.map(e => e.abiertas),
          backgroundColor: '#EF9F27',
          borderRadius: 4,
        },
        {
          label: 'Resueltas',
          data: evolucion.map(e => e.resueltas),
          backgroundColor: '#1D9E75',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'IBM Plex Sans', size: 11 }, boxWidth: 10, padding: 16 },
        },
        tooltip: { mode: 'index' },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
      },
    },
  });
}

/* ── ESTADOS ── */
function renderEstados(estados) {
  const body = document.getElementById('estados-body');
  if (!estados.length) { body.innerHTML = '<div class="empty">Sin datos</div>'; return; }

  body.innerHTML = estados.map(e => `
    <div class="estado-row">
      <div class="estado-dot" style="background:${ESTADO_COLORS[e.estado] || '#ccc'}"></div>
      <span class="estado-nombre">${labelEstado(e.estado)}</span>
      <span class="estado-num">${e.count}</span>
    </div>`).join('');
}

/* ── PATRONES ── */
function renderPatrones(patrones) {
  const body = document.getElementById('patrones-body');
  if (!patrones.length) { body.innerHTML = '<div class="empty">Sin patrones detectados aún</div>'; return; }

  const max = Math.max(...patrones.map(p => p.count));

  body.innerHTML = patrones.map(p => `
    <div class="patron-item">
      <div style="flex:1;min-width:0;">
        <div class="patron-nombre">${p.componente}</div>
        ${p.alerta ? `<div class="patron-alerta">${p.alerta}</div>` : ''}
      </div>
      <div class="patron-bar-wrap" style="width:80px;">
        <div class="patron-bar" style="width:${Math.round((p.count/max)*100)}%"></div>
      </div>
      <div class="patron-count">${p.count}</div>
    </div>`).join('');
}

/* ── TERRITORIAL ── */
function renderTerritorial(zonas) {
  const body = document.getElementById('territorial-body');
  if (!zonas.length) { body.innerHTML = '<div class="empty">Sin datos territoriales</div>'; return; }

  const max = Math.max(...zonas.map(z => z.count));

  body.innerHTML = zonas.map(z => `
    <div class="zona-item">
      <span class="zona-nombre">${z.delegacion}</span>
      <div class="zona-bar-wrap">
        <div class="zona-bar" style="width:${Math.round((z.count/max)*100)}%"></div>
      </div>
      <span class="zona-num">${z.count}</span>
      ${z.imp ? `<span class="badge b-danger">${z.imp} imp.</span>` : ''}
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════
   DEMO DATA (sin conexión o sin datos)
══════════════════════════════════════════════════════ */
function renderDashboardDemo() {
  renderDashboard({
    edificios: 0, alumnos: 0, imp: 0, int: 0, ok: 0, inspecciones: 0,
    evolucion: [
      { mes: 'Ene', abiertas: 0, resueltas: 0 },
      { mes: 'Feb', abiertas: 0, resueltas: 0 },
      { mes: 'Mar', abiertas: 0, resueltas: 0 },
    ],
    estados: [],
    patrones: [],
    territorial: [],
  });
}

/* ══════════════════════════════════════════════════════
   EXPORTAR PDF
══════════════════════════════════════════════════════ */
function exportarPDF() {
  window.print();
}

/* ══════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined && val !== null ? val : '—';
}

function labelEstado(e) {
  const map = {
    pendiente: 'Pendiente', en_analisis: 'En análisis',
    aprobada: 'Aprobada', en_ejecucion: 'En ejecución',
    finalizada: 'Finalizada', resuelta_con_historial: 'Resuelta con historial',
  };
  return map[e] || e;
}

function setCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}
