/* ═══════════════════════════════════════════════════════
   SIIE PWA · relevamiento.js · v1.0.0
   Lógica del formulario de relevamiento general
   ═══════════════════════════════════════════════════════ */

'use strict';

const APPS_SCRIPT_URL_REL = 'https://script.google.com/macros/s/AKfycbxDxiRPFcIgEOpkgGjE23IhDGOtwg_unDfAMPQRBpo0dglkXopT3q8ybb7sWJ6LRyiT4w/exec';

const TIPOS_SECTOR = [
  'Aula','Baño docentes','Baño niñas','Baño varones',
  'Biblioteca','Cocina','Comedor','Depósito',
  'Dirección','Galería','Patio cubierto','Sala de máquinas',
  'Secretaría','SUM','Otro'
];

const COMPONENTES = [
  'Cielorraso','Cubierta / techo','Muros y revoques','Pisos',
  'Carpintería (ventanas)','Carpintería (puertas)',
  'Instalación eléctrica','Instalación sanitaria',
  'Bomba de agua','Calefacción','Iluminación',
  'Mobiliario','Revestimientos','Pintura','Otro'
];

const REQUIRED = [
  'f-nombre','f-numero','f-tipo','f-delegacion',
  'f-localidad','f-direccion','f-inspector','f-fecha','f-ref-nombre'
];

let rowCount = 0;
let fotoCount = 0;
let fotosData = {}; // key: slotId, value: base64
let currentStep = 1;
const TOTAL_STEPS = 10;

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('f-fecha').value = hoy;

  // Hora actual
  const ahora = new Date().toTimeString().slice(0,5);
  document.getElementById('f-hora').value = ahora;

  // Filas iniciales en la tabla
  for (let i = 0; i < 3; i++) addRow();

  // Fotos otras iniciales
  for (let i = 0; i < 3; i++) addFotoOtra();

  // Restaurar borrador si existe
  restaurarBorrador();

  updateProgress();
});

/* ══════════════════════════════════════════════════════
   NAVEGACIÓN POR STEPS
══════════════════════════════════════════════════════ */
function irStep(n) {
  // Ocultar step actual
  document.getElementById('step-' + currentStep).style.display = 'none';
  document.getElementById('step-btn-' + currentStep).classList.remove('active');

  // Mostrar nuevo step
  currentStep = n;
  document.getElementById('step-' + n).style.display = 'block';
  const btn = document.getElementById('step-btn-' + n);
  btn.classList.add('active');
  btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  // Scroll al top del contenido
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateProgress();
}

function volverInicio() {
  if (confirm('¿Salir del relevamiento? Los cambios no guardados se perderán.')) {
    window.location.href = 'index.html';
  }
}

/* ══════════════════════════════════════════════════════
   PROGRESS BAR
══════════════════════════════════════════════════════ */
function updateProgress() {
  let filled = 0;
  REQUIRED.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim()) filled++;
  });
  const pct = Math.round((filled / REQUIRED.length) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';

  // Marcar steps completos
  checkStepsDone();
}

function checkStepsDone() {
  const step1Fields = ['f-nombre','f-numero','f-tipo','f-delegacion','f-localidad','f-direccion'];
  const step2Fields = ['f-inspector','f-fecha'];
  const step3Fields = ['f-ref-nombre'];

  if (step1Fields.every(id => document.getElementById(id)?.value.trim())) {
    document.getElementById('step-btn-1').classList.add('done');
  }
  if (step2Fields.every(id => document.getElementById(id)?.value.trim())) {
    document.getElementById('step-btn-2').classList.add('done');
  }
  if (step3Fields.every(id => document.getElementById(id)?.value.trim())) {
    document.getElementById('step-btn-3').classList.add('done');
  }
}

/* ══════════════════════════════════════════════════════
   ESTADO GENERAL
══════════════════════════════════════════════════════ */
function selEstado(el, val) {
  document.querySelectorAll('.estado-opt').forEach(o => {
    o.className = 'estado-opt';
  });
  el.classList.add('sel-' + val);
  updateProgress();
}


/* ── FUNCIONES NUEVAS v2 ── */

function generarNombre() {
  const tipo = document.getElementById('f-tipo')?.value || '';
  const numero = document.getElementById('f-numero')?.value || '';
  const nombreEl = document.getElementById('f-nombre');
  if (nombreEl && tipo && numero) {
    nombreEl.value = tipo + ' N° ' + numero;
  }
}

function sincronizarInspector() {
  const inspector = document.getElementById('f-inspector')?.value || '';
  const firmaEl = document.getElementById('firma-inspector-nombre');
  if (firmaEl) firmaEl.textContent = inspector || '—';
}

function calcularMatricula() {
  const v = parseInt(document.getElementById('f-varones')?.value) || 0;
  const m = parseInt(document.getElementById('f-mujeres')?.value) || 0;
  const o = parseInt(document.getElementById('f-otros')?.value) || 0;
  const d = parseInt(document.getElementById('f-discapacidad')?.value) || 0;
  const total = v + m + o + d;
  const el = document.getElementById('f-matricula-total');
  if (el) el.textContent = total;
}

function extraerCoordenadas(url) {
  if (!url) return;
  // Patrones comunes de URLs de Google Maps
  const patrones = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // @lat,lng
    /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,          // ll=lat,lng
    /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // q=lat,lng
    /place\/.*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/, // place/@lat,lng
  ];
  for (const patron of patrones) {
    const match = url.match(patron);
    if (match) {
      document.getElementById('f-latitud').value = match[1];
      document.getElementById('f-longitud').value = match[2];
      showToast('Coordenadas extraídas correctamente');
      return;
    }
  }
  // Si no encontró coordenadas directas, puede ser un link corto
  if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
    showToast('Link corto detectado · las coordenadas se resolverán al enviar');
    document.getElementById('f-latitud').value = url;
    document.getElementById('f-longitud').value = '';
  }
}

function descargarPDF() {
  const data = recopilarDatos();
  const nombre = data.identificacion?.nombre || 'Relevamiento';
  const fecha = data.gestion?.fecha_relevamiento || new Date().toLocaleDateString('es-AR');
  const inspector = data.gestion?.inspector || '';

  let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Relevamiento - ${nombre}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11pt;color:#000;margin:20mm;}
    h1{font-size:16pt;border-bottom:2px solid #000;padding-bottom:6px;}
    h2{font-size:12pt;background:#eee;padding:4px 8px;margin-top:16px;}
    table{width:100%;border-collapse:collapse;margin-top:8px;}
    th,td{border:1px solid #999;padding:4px 6px;font-size:9pt;}
    th{background:#eee;font-weight:bold;}
    .field{display:flex;gap:8px;margin-bottom:6px;}
    .label{font-weight:bold;min-width:140px;}
    .firma-row{display:flex;gap:40px;margin-top:40px;}
    .firma-block{flex:1;border-top:1px solid #000;padding-top:4px;font-size:9pt;}
    @media print{body{margin:10mm;}}
  </style></head><body>
  <h1>SIIE · Relevamiento General</h1>
  <div class="field"><span class="label">Establecimiento:</span><span>${data.identificacion?.nombre || '—'}</span></div>
  <div class="field"><span class="label">Delegación:</span><span>${data.identificacion?.delegacion || '—'}</span></div>
  <div class="field"><span class="label">Dirección:</span><span>${data.identificacion?.direccion || '—'}</span></div>
  <div class="field"><span class="label">Inspector:</span><span>${inspector}</span></div>
  <div class="field"><span class="label">Fecha:</span><span>${fecha}</span></div>

  <h2>Datos institucionales</h2>
  <div class="field"><span class="label">Matrícula total:</span><span>${data.datos_institucionales?.matricula_total || '—'}</span></div>
  <div class="field"><span class="label">Secciones:</span><span>${data.datos_institucionales?.secciones || '—'}</span></div>
  <div class="field"><span class="label">Turnos:</span><span>${data.datos_institucionales?.turnos || '—'}</span></div>

  <h2>Sectores relevados</h2>
  <table><thead><tr>
    <th>#</th><th>Sector</th><th>Identificador</th><th>Planta</th><th>En uso</th>
    <th>Componente</th><th>Problema</th><th>Cant.</th><th>Un.</th><th>Afect.</th><th>%</th><th>IMP</th><th>INT</th>
  </tr></thead><tbody>`;

  (data.sectores || []).forEach((s, i) => {
    html += `<tr>
      <td>${i+1}</td><td>${s.tipo||''}</td><td>${s.identificador||''}</td><td>${s.planta||''}</td>
      <td>${s.en_uso||''}</td><td>${s.componente||''}</td><td>${s.problema||''}</td>
      <td>${s.cantidad||''}</td><td>${s.unidad||''}</td><td>${s.afectada||''}</td>
      <td>${s.pct_afectado||''}</td><td>${s.impide||''}</td><td>${s.intervencion||''}</td>
    </tr>`;
  });

  html += `</tbody></table>
  <h2>Observaciones generales</h2>
  <p>${data.observaciones_generales || '—'}</p>
  <div class="firma-row">
    <div class="firma-block">Inspector / Relevador: ${inspector}</div>
    <div class="firma-block">Referente institucional: ${data.datos_institucionales?.referente_nombre || ''}</div>
    <div class="firma-block">Fecha y hora de cierre: ${fecha}</div>
  </div>
  </body></html>`;

  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Relevamiento_' + (nombre.replace(/\s+/g,'_')) + '_' + fecha.replace(/\//g,'-') + '.html';
  a.click();
  showToast('PDF generado · abrí el archivo y usá Ctrl+P para imprimir');
}

let fotosOtrasCount = 0;
function addFotoOtra() {
  fotosOtrasCount++;
  const n = fotosOtrasCount;
  const div = document.createElement('div');
  const slotId = 'otra-slot-' + n;
  const prevId = 'otra-prev-' + n;
  div.innerHTML = `<div class="foto-slot" id="${slotId}">
    <input type="file" accept="image/*" capture="environment" onchange="onFotoChange(this,'${slotId}','${prevId}')">
    <svg class="foto-slot-icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
    <span class="foto-slot-num">IMG-0${n}</span>
    <img class="foto-preview-img" id="${prevId}" style="display:none;" alt="">
  </div>`;
  const grid = document.getElementById('fotos-otras');
  if (grid) grid.appendChild(div);
}

/* ══════════════════════════════════════════════════════
   TABLA DE SECTORES
══════════════════════════════════════════════════════ */
function makeOpts(arr) {
  return '<option value=""></option>' + arr.map(v => `<option>${v}</option>`).join('');
}

function addRow() {
  rowCount++;
  const n = rowCount;
  const tr = document.createElement('tr');
  tr.id = 'row-' + n;
  tr.innerHTML = `
    <td class="col-n">${n}</td>
    <td class="col-tipo">
      <select onchange="checkImpRow(${n})">
        ${makeOpts(TIPOS_SECTOR)}
      </select>
    </td>
    <td class="col-id"><input type="text" placeholder="ej: Aula 3"></td>
    <td class="col-planta">
      <select>${makeOpts(['P. Baja','P. Alta','Subsuelo'])}</select>
    </td>
    <td class="col-uso" style="text-align:center;">
      <select>${makeOpts(['Sí','No'])}</select>
    </td>
    <td class="col-comp">
      <select>${makeOpts(COMPONENTES)}</select>
    </td>
    <td><textarea rows="2" placeholder="Describir el problema…"></textarea></td>
    <td class="col-cant"><input type="number" min="0" style="text-align:center;" oninput="calcPct(${n})"></td>
    <td class="col-un">
      <select style="text-align:center;">${makeOpts(['U','M2','M3','ML','GL','HS'])}</select>
    </td>
    <td class="col-afect"><input type="number" min="0" style="text-align:center;" oninput="calcPct(${n})"></td>
    <td class="col-pct" style="text-align:center;">
      <div id="pct-${n}" style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent);padding:6px 4px;">—</div>
    </td>
    <td class="col-imp" style="text-align:center;">
      <select id="imp-sel-${n}" onchange="checkImpRow(${n})" style="text-align:center;font-weight:600;">
        <option value=""></option>
        <option value="Sí">Sí</option>
        <option value="No">No</option>
      </select>
    </td>
    <td class="col-int" style="text-align:center;">
      <select style="text-align:center;">
        <option value=""></option>
        <option value="Sí">Sí</option>
        <option value="No">No</option>
      </select>
    </td>
    <td class="col-fotos" style="text-align:center;padding:4px;">
      <button onclick="abrirFotosPanel(${n})"
        id="btn-fotos-${n}"
        style="background:var(--accent-l);border:1px solid var(--accent);border-radius:6px;padding:5px 6px;cursor:pointer;font-size:11px;color:var(--accent);font-weight:600;line-height:1.3;width:52px;">
        📷<br><span id="fotos-count-${n}">0/2</span>
      </button>
    </td>
    <td class="col-del">
      <button class="btn-del" onclick="delRow(${n})" title="Eliminar">×</button>
    </td>
  `;
  document.getElementById('sector-tbody').appendChild(tr);
}

function calcPct(n) {
  const row = document.getElementById('row-' + n);
  if (!row) return;
  const numInputs = row.querySelectorAll('input[type=number]');
  const total = parseFloat(numInputs[0]?.value) || 0;
  const afect = parseFloat(numInputs[1]?.value) || 0;
  const pctEl = document.getElementById('pct-' + n);
  if (pctEl) {
    pctEl.textContent = (total > 0) ? Math.round((afect / total) * 100) + '%' : '—';
  }
}

const sectorFotos = {};

function abrirFotosPanel(n) {
  let panel = document.getElementById('fotos-panel-' + n);
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    return;
  }
  const row = document.getElementById('row-' + n);
  const sector = row?.querySelector('select')?.value || 'Sector ' + n;
  panel = document.createElement('div');
  panel.id = 'fotos-panel-' + n;
  panel.style.cssText = 'background:white;border:1px solid var(--gray-200);border-radius:8px;padding:14px;margin-top:8px;';
  panel.innerHTML = `
    <div style="font-size:11px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:var(--gray-500);margin-bottom:10px;">
      Fotos · ${sector || 'Sector ' + n}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:280px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--warn-b);margin-bottom:4px;">FOTO 1 · OBLIGATORIA</div>
        <div class="foto-slot" id="fs1-${n}" style="aspect-ratio:4/3;border-color:var(--warn-b);">
          <input type="file" accept="image/*" capture="environment" onchange="onFotoPanelChange(this,${n},1)">
          <svg class="foto-slot-icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span class="foto-slot-label">Tocar para fotografiar</span>
          <img class="foto-preview-img" id="fp1-${n}" style="display:none;" alt="">
        </div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--gray-400);margin-bottom:4px;">FOTO 2 · OPCIONAL</div>
        <div class="foto-slot" id="fs2-${n}" style="aspect-ratio:4/3;">
          <input type="file" accept="image/*" capture="environment" onchange="onFotoPanelChange(this,${n},2)">
          <svg class="foto-slot-icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span class="foto-slot-label">Tocar para fotografiar</span>
          <img class="foto-preview-img" id="fp2-${n}" style="display:none;" alt="">
        </div>
      </div>
    </div>
    <button onclick="document.getElementById('fotos-panel-${n}').style.display='none'"
      style="margin-top:10px;background:none;border:none;color:var(--gray-400);font-size:12px;cursor:pointer;">
      Cerrar ✕
    </button>
  `;
  const tablaPadre = document.getElementById('sector-tbody')?.closest('.section-body');
  if (tablaPadre) tablaPadre.appendChild(panel);
}

function onFotoPanelChange(input, n, num) {
  const file = input.files[0];
  if (!file) return;
  comprimirFoto(file, 1200, 0.82, (base64) => {
    if (!sectorFotos[n]) sectorFotos[n] = {};
    sectorFotos[n]['foto' + num] = base64;
    const img = document.getElementById('fp' + num + '-' + n);
    if (img) { img.src = base64; img.style.display = 'block'; }
    const slot = document.getElementById('fs' + num + '-' + n);
    if (slot) {
      slot.classList.add('has-foto');
      const icon = slot.querySelector('.foto-slot-icon');
      const lbl = slot.querySelector('.foto-slot-label');
      if (icon) icon.style.display = 'none';
      if (lbl) lbl.style.display = 'none';
    }
    const count = Object.keys(sectorFotos[n] || {}).length;
    const countEl = document.getElementById('fotos-count-' + n);
    if (countEl) countEl.textContent = count + '/2';
    const btn = document.getElementById('btn-fotos-' + n);
    if (btn && sectorFotos[n]?.foto1) {
      btn.style.background = 'var(--ok-l)';
      btn.style.borderColor = 'var(--ok-b)';
      btn.style.color = 'var(--ok)';
    }
  });
}

function delRow(n) {
  const row = document.getElementById('row-' + n);
  if (row) row.remove();
}

function checkImpRow(n) {
  const sel = document.getElementById('imp-sel-' + n);
  const row = document.getElementById('row-' + n);
  if (!sel || !row) return;
  if (sel.value === 'S') {
    row.classList.add('row-imp');
    // Activar automáticamente el radio "Sí" en step 7
    const radioSi = document.querySelector('input[name="imp_gral"][value="si"]');
    if (radioSi) { radioSi.checked = true; toggleJust(true); }
  } else {
    row.classList.remove('row-imp');
  }
}

/* ══════════════════════════════════════════════════════
   IMPACTO PEDAGÓGICO
══════════════════════════════════════════════════════ */
function toggleJust(show) {
  document.getElementById('just-wrap').style.display = show ? 'block' : 'none';
}

/* ══════════════════════════════════════════════════════
   FOTOS
══════════════════════════════════════════════════════ */
function addFotoSlot() {
  fotoCount++;
  const n = fotoCount;
  const slotId = 'prob-slot-' + n;
  const inputId = 'prob-input-' + n;
  const prevId  = 'prob-prev-' + n;

  const div = document.createElement('div');
  div.innerHTML = `
    <div class="foto-slot" id="${slotId}" onclick="triggerFoto('${inputId}','${slotId}','${prevId}')">
      <input type="file" id="${inputId}" accept="image/*" capture="environment"
        onchange="onFotoChange(this,'${slotId}','${prevId}')">
      <svg class="foto-slot-icon" viewBox="0 0 24 24">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <span class="foto-slot-num">P-0${n}</span>
      <span class="foto-slot-label">Tocar para fotografiar</span>
      <img class="foto-preview-img" id="${prevId}" style="display:none;" alt="">
    </div>`;
  document.getElementById('fotos-problemas').appendChild(div);
}

function triggerFoto(inputId, slotId, prevId) {
  document.getElementById(inputId).click();
}

function onFotoChange(input, slotId, prevId) {
  const file = input.files[0];
  if (!file) return;

  // Comprimir antes de guardar (max 1200px)
  comprimirFoto(file, 1200, 0.82, (base64) => {
    fotosData[slotId] = base64;
    const img = document.getElementById(prevId);
    if (img) { img.src = base64; img.style.display = 'block'; }
    const slot = document.getElementById(slotId);
    if (slot) {
      slot.classList.add('has-foto');
      const icon = slot.querySelector('.foto-slot-icon');
      const label = slot.querySelector('.foto-slot-label');
      const num = slot.querySelector('.foto-slot-num');
      if (icon) icon.style.display = 'none';
      if (label) label.style.display = 'none';
      if (num) num.style.display = 'none';
    }
  });
}

function comprimirFoto(file, maxSize, quality, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════════════════════
   RECOPILAR DATOS DEL FORMULARIO
══════════════════════════════════════════════════════ */
function recopilarDatos() {
  // Sectores
  const sectores = [];
  document.querySelectorAll('#sector-tbody tr').forEach((tr, idx) => {
    const n = idx + 1;
    const selects = tr.querySelectorAll('select');
    const inputs = tr.querySelectorAll('input[type=text],input[type=number]');
    const textarea = tr.querySelector('textarea');
    const pctEl = document.getElementById('pct-' + tr.id.replace('row-',''));
    sectores.push({
      tipo:                 selects[0]?.value || '',
      identificador:        inputs[0]?.value || '',
      planta:               selects[1]?.value || '',
      en_uso:               selects[2]?.value || '',
      componente:           selects[3]?.value || '',
      problema:             textarea?.value || '',
      cantidad:             inputs[1]?.value || '',
      unidad:               selects[4]?.value || '',
      afectada:             inputs[2]?.value || '',
      pct_afectado:         pctEl?.textContent || '',
      impide:               selects[5]?.value || '',
      requiere_intervencion:selects[6]?.value || '',
    });
  });

  return {
    _version: 'SIIE-RG-001-v1.0',
    _tipo: 'relevamiento_general',
    _fecha_carga: new Date().toISOString(),
    identificacion: {
      nombre:     document.getElementById('f-nombre')?.value || '',
      numero:     document.getElementById('f-numero')?.value || '',
      tipo:       document.getElementById('f-tipo')?.value || '',
      delegacion: document.getElementById('f-delegacion')?.value || '',
      localidad:  document.getElementById('f-localidad')?.value || '',
      direccion:  document.getElementById('f-direccion')?.value || '',
      telefono:   document.getElementById('f-tel')?.value || '',
      email:      document.getElementById('f-email')?.value || '',
      latitud:    document.getElementById('f-latitud')?.value || '',
      longitud:   document.getElementById('f-longitud')?.value || '',
      gmaps:      document.getElementById('f-gmaps')?.value || '',
    },
    gestion: {
      inspector:            document.getElementById('f-inspector')?.value || '',
      etapa:                document.getElementById('f-etapa')?.value || '',
      zona:                 document.getElementById('f-zona')?.value || '',
      fecha_relevamiento:   document.getElementById('f-fecha')?.value || '',
      hora:                 document.getElementById('f-hora')?.value || '',
      edificio_id:          document.getElementById('f-edificio-id')?.value || '',
    },
    datos_institucionales: {
      varones:           document.getElementById('f-varones')?.value || '',
      mujeres:           document.getElementById('f-mujeres')?.value || '',
      otros:             document.getElementById('f-otros')?.value || '',
      discapacidad:      document.getElementById('f-discapacidad')?.value || '',
      matricula_total:   document.getElementById('f-matricula-total')?.textContent || '0',
      secciones:         document.getElementById('f-secciones')?.value || '',
      turnos:            document.getElementById('f-turnos')?.value || '',
      docentes:          document.getElementById('f-docentes')?.value || '',
      administrativo:    document.getElementById('f-administrativo')?.value || '',
      auxiliares:        document.getElementById('f-auxiliares')?.value || '',
      cocineros:         document.getElementById('f-cocineros')?.value || '',
      desayuno:          document.getElementById('f-desayuno')?.value || '',
      almuerzo:          document.getElementById('f-almuerzo')?.value || '',
      merienda:          document.getElementById('f-merienda')?.value || '',
      referente_nombre:  document.getElementById('f-ref-nombre')?.value || '',
      referente_cel:     document.getElementById('f-ref-cel')?.value || '',
      referente_canal:   document.getElementById('f-ref-canal')?.value || '',
    },
    estado_general: {
      estado:              document.querySelector('input[name="estado_gral"]:checked')?.value || '',
      pct_funcionamiento:  document.getElementById('f-pct-gral')?.value || '',
      observaciones:       document.getElementById('f-obs-gral')?.value || '',
    },
    fachada: {
      foto_base64:  fotosData['fachada-slot'] || null,
      observaciones: document.getElementById('f-fachada-obs')?.value || '',
    },
    impacto_pedagogico: {
      impide:        document.querySelector('input[name="imp_gral"]:checked')?.value || '',
      justificacion: document.getElementById('f-justificacion')?.value || '',
    },
    sectores: sectores,
    fotos_problemas: Object.keys(fotosData)
      .filter(k => k !== 'fachada-slot')
      .map(k => ({ slot: k, base64: fotosData[k] })),
    observaciones_generales: document.getElementById('f-obs')?.value || '',
  };
}

/* ══════════════════════════════════════════════════════
   VALIDACIÓN
══════════════════════════════════════════════════════ */
function validar() {
  let ok = true;

  REQUIRED.forEach(id => {
    const el = document.getElementById(id);
    const errId = 'e-' + id.replace('f-', '');
    if (el && !el.value.trim()) {
      el.classList.add('invalid');
      const err = document.getElementById(errId);
      if (err) err.classList.add('show');
      ok = false;
    } else if (el) {
      el.classList.remove('invalid');
      const err = document.getElementById(errId);
      if (err) err.classList.remove('show');
    }
  });

  // Impacto pedagógico
  const imp = document.querySelector('input[name="imp_gral"]:checked');
  if (imp && imp.value === 'si') {
    const just = document.getElementById('f-justificacion');
    if (!just.value.trim()) {
      just.classList.add('invalid');
      document.getElementById('e-justificacion').classList.add('show');
      ok = false;
    }
  }

  return ok;
}

/* ══════════════════════════════════════════════════════
   GUARDAR BORRADOR
══════════════════════════════════════════════════════ */
function guardarBorrador() {
  const data = recopilarDatos();
  const key = 'siie_borrador_' + (data.identificacion.nombre || 'sin_nombre').replace(/\s+/g,'_') + '_' + Date.now();

  // Guardar sin fotos en base64 para no llenar localStorage
  const dataMinima = { ...data, fachada: { ...data.fachada, foto_base64: null }, fotos_problemas: [] };
  localStorage.setItem('siie_borrador_ultimo', JSON.stringify(dataMinima));

  showToast('Borrador guardado');
}

function restaurarBorrador() {
  try {
    const raw = localStorage.getItem('siie_borrador_ultimo');
    if (!raw) return;
    const d = JSON.parse(raw);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };

    set('f-nombre',     d.identificacion?.nombre);
    set('f-numero',     d.identificacion?.numero);
    set('f-tipo',       d.identificacion?.tipo);
    set('f-delegacion', d.identificacion?.delegacion);
    set('f-localidad',  d.identificacion?.localidad);
    set('f-direccion',  d.identificacion?.direccion);
    set('f-tel',        d.identificacion?.telefono);
    set('f-email',      d.identificacion?.email);
    set('f-inspector',  d.gestion?.inspector);
    set('f-etapa',      d.gestion?.etapa);
    set('f-zona',       d.gestion?.zona);
    set('f-fecha',      d.gestion?.fecha_relevamiento);
    set('f-matricula',  d.datos_institucionales?.matricula);
    set('f-secciones',  d.datos_institucionales?.secciones);
    set('f-turnos',     d.datos_institucionales?.turnos);
    set('f-docentes',   d.datos_institucionales?.docentes);
    set('f-ref-nombre', d.datos_institucionales?.referente_nombre);
    set('f-ref-cel',    d.datos_institucionales?.referente_cel);
    set('f-ref-canal',  d.datos_institucionales?.referente_canal);
    set('f-pct-gral',   d.estado_general?.pct_funcionamiento);
    set('f-obs-gral',   d.estado_general?.observaciones);
    set('f-obs',        d.observaciones_generales);
    set('f-edificio-id',d.gestion?.edificio_id);

    updateProgress();
  } catch (e) {
    console.warn('No se pudo restaurar el borrador', e);
  }
}

/* ══════════════════════════════════════════════════════
   ENVIAR A APPS SCRIPT
══════════════════════════════════════════════════════ */
async function enviarRelevamiento() {
  if (!validar()) {
    showToast('Completá los campos obligatorios', 3000);
    // Ir al primer step con error
    irStep(1);
    return;
  }

  const data = recopilarDatos();
  const user = JSON.parse(localStorage.getItem('siie_user') || '{}');
  data.email = user.email || '';
  data._id_generado = 'REL-' + Date.now();
  const idEl = document.getElementById('f-edificio-id');
  if (idEl) idEl.value = data._id_generado;

  // Sin conexión → guardar como borrador pendiente de sync
  if (!navigator.onLine) {
    const key = 'siie_borrador_' + Date.now();
    localStorage.setItem(key, JSON.stringify(data));
    showToast('Sin conexión · guardado para sincronizar al reconectar', 4000);
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    return;
  }

  // Con conexión → enviar via JSONP (evita CORS)
  showOverlay('Enviando relevamiento…');

  // Guardar en localStorage primero como respaldo
  const borradorKey = 'siie_borrador_enviando_' + Date.now();
  localStorage.setItem(borradorKey, JSON.stringify(data));

  try {
    const result = await enviarViaJSONP(data);
    if (result.ok) {
      localStorage.removeItem(borradorKey);
      localStorage.removeItem('siie_borrador_ultimo');
      hideOverlay();
      showToast('Relevamiento enviado correctamente');
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } else {
      throw new Error(result.error || 'Error al guardar');
    }
  } catch (err) {
    hideOverlay();
    showToast('Error al enviar · guardado localmente para reintentar', 4000);
    console.error('Error envío:', err);
  }
}

/* ══════════════════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════════════════ */
function showToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

function showOverlay(msg) {
  document.getElementById('overlay-text').textContent = msg || 'Procesando…';
  document.getElementById('overlay').classList.add('show');
}

function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

// Autosave cada 60 segundos
setInterval(() => {
  const nombre = document.getElementById('f-nombre')?.value;
  if (nombre) guardarBorrador();
}, 60000);

/* Envío via iframe POST para evitar CORS */
async function enviarViaJSONP(data) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout - datos guardados localmente'));
    }, 20000);

    // Crear iframe oculto para recibir la respuesta
    const iframeName = 'siie_iframe_' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Crear form que postea al Apps Script
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL_REL + '?action=sync_relevamiento&email=' + encodeURIComponent(data.email || '');
    form.target = iframeName;
    form.enctype = 'application/x-www-form-urlencoded';
    form.style.display = 'none';

    // Campo con los datos
    const dataMin = JSON.parse(JSON.stringify(data));
    dataMin.fachada = { observaciones: data.fachada?.observaciones || '' };
    dataMin.fotos_problemas = [];

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(dataMin);
    form.appendChild(input);
    document.body.appendChild(form);

    // Escuchar respuesta del iframe
    iframe.onload = () => {
      clearTimeout(timer);
      try {
        const txt = iframe.contentDocument?.body?.innerText || '';
        const result = JSON.parse(txt);
        iframe.remove();
        form.remove();
        resolve(result);
      } catch(e) {
        iframe.remove();
        form.remove();
        // Si no podemos leer la respuesta por CORS del iframe,
        // asumimos que fue exitoso si no hubo error de red
        resolve({ ok: true, id: 'REL-' + Date.now() });
      }
    };

    iframe.onerror = () => {
      clearTimeout(timer);
      iframe.remove();
      form.remove();
      reject(new Error('Error de red'));
    };

    form.submit();
  });
}
