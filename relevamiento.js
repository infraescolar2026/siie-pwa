/* ═══════════════════════════════════════════════════════
   SIIE PWA · relevamiento.js · v1.0.0
   Lógica del formulario de relevamiento general
   ═══════════════════════════════════════════════════════ */

'use strict';

const APPS_SCRIPT_URL_REL = 'https://script.google.com/macros/s/AKfycbxDxiRPFcIgEOpkgGjE23IhDGOtwg_unDfAMPQRBpo0dglkXopT3q8ybb7sWJ6LRyiT4w/exec';

const TIPOS_SECTOR = [
  'Aula','Baño niñas','Baño varones','Baño docentes',
  'Comedor','Cocina','Dirección','Secretaría',
  'Biblioteca','SUM','Patio cubierto','Galería',
  'Sala de máquinas','Depósito','Otro'
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

  // Fotos iniciales de problemas
  for (let i = 0; i < 4; i++) addFotoSlot();

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
    <td class="col-uso">
      <select style="text-align:center;">${makeOpts(['S','N'])}</select>
    </td>
    <td class="col-comp">
      <select>${makeOpts(COMPONENTES)}</select>
    </td>
    <td><textarea rows="2" placeholder="Describir el problema…"></textarea></td>
    <td class="col-cant"><input type="number" min="0" style="text-align:center;"></td>
    <td class="col-pct"><input type="text" placeholder="__%" style="text-align:center;"></td>
    <td class="col-imp">
      <select id="imp-sel-${n}" onchange="checkImpRow(${n})" style="text-align:center;font-weight:600;">
        <option value=""></option>
        <option value="N">N</option>
        <option value="S">S</option>
      </select>
    </td>
    <td class="col-int">
      <select style="text-align:center;">
        <option value=""></option>
        <option value="N">N</option>
        <option value="S">S</option>
      </select>
    </td>
    <td class="col-del">
      <button class="btn-del" onclick="delRow(${n})" title="Eliminar">×</button>
    </td>
  `;
  document.getElementById('sector-tbody').appendChild(tr);
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
  document.querySelectorAll('#sector-tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('input,select,textarea');
    if (cells.length < 10) return;
    sectores.push({
      tipo:                 cells[0]?.value || '',
      identificador:        cells[1]?.value || '',
      planta:               cells[2]?.value || '',
      en_uso:               cells[3]?.value || '',
      componente:           cells[4]?.value || '',
      problema:             cells[5]?.value || '',
      total:                cells[6]?.value || '',
      pct_func:             cells[7]?.value || '',
      impide:               cells[8]?.value || '',
      requiere_intervencion:cells[9]?.value || '',
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
      matricula:        document.getElementById('f-matricula')?.value || '',
      secciones:        document.getElementById('f-secciones')?.value || '',
      turnos:           document.getElementById('f-turnos')?.value || '',
      docentes:         document.getElementById('f-docentes')?.value || '',
      referente_nombre: document.getElementById('f-ref-nombre')?.value || '',
      referente_cel:    document.getElementById('f-ref-cel')?.value || '',
      referente_canal:  document.getElementById('f-ref-canal')?.value || '',
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

  // Sin conexión → guardar como borrador pendiente de sync
  if (!navigator.onLine) {
    const key = 'siie_borrador_' + Date.now();
    localStorage.setItem(key, JSON.stringify(data));
    showToast('Sin conexión · guardado para sincronizar al reconectar', 4000);
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    return;
  }

  // Con conexión → enviar
  showOverlay('Enviando relevamiento…');

  try {
    const url = new URL(APPS_SCRIPT_URL_REL);
    url.searchParams.set('action', 'sync_relevamiento');
    url.searchParams.set('email', data.email);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.ok) {
      // Limpiar borrador
      localStorage.removeItem('siie_borrador_ultimo');
      hideOverlay();
      showToast('Relevamiento enviado correctamente');
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } else {
      throw new Error(result.error || 'Error al guardar');
    }
  } catch (err) {
    hideOverlay();
    // Guardar localmente como fallback
    const key = 'siie_borrador_fallback_' + Date.now();
    localStorage.setItem(key, JSON.stringify(data));
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
