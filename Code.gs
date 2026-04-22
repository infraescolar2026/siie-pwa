/* ═══════════════════════════════════════════════════════
   SIIE · Backend · Google Apps Script
   Archivo: Code.gs
   
   SETUP:
   1. Crear un Google Sheet con las hojas del modelo de datos
   2. Pegar este código en Apps Script (Extensions > Apps Script)
   3. Reemplazar SPREADSHEET_ID con el ID de tu Sheet
   4. Deploy > New deployment > Web App
      - Execute as: Me
      - Who has access: Anyone (la PWA verifica roles por email)
   5. Copiar la URL del deployment a CONFIG.APPS_SCRIPT_URL en app.js
   ═══════════════════════════════════════════════════════ */

/* ── CONFIGURACIÓN ── */
const SS_ID = '1gffcom4JuWABhFQ9KQscdlYWDDUYtFpPHW7VWVuBoTA'; // ID del Google Sheet
const SS = SpreadsheetApp.openById(SS_ID);

/* ── HOJAS DEL MODELO DE DATOS ── */
const HOJAS = {
  EDIFICIOS:    'edificios',
  ROLES:        'roles',
  ETAPAS:       'etapas',
  ZONAS:        'zonas',
  INSPECTORES:  'inspectores',
  SECTORES:     'sectores',
  RELEVAMIENTOS:'relevamientos',
  OBSERVACIONES:'observaciones_sector',
  FOTOS:        'fotos',
  INTERVENCIONES:'intervenciones',
  HISTORIAL:    'historial_estados',
  INCIDENCIAS:  'incidencias',
  CONTACTOS:    'contactos_institucionales',
  DATOS_INST:   'datos_institucionales',
};

/* ── CORS HEADERS ── */
function setCORS(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ── ENTRY POINTS ── */
function doGet(e) {
  const action = e.parameter.action;
  const email  = e.parameter.email || '';
  let result;

  try {
    switch (action) {
      case 'auth':      result = { ok: false, error: 'Auth requiere POST' }; break;
      case 'stats':     result = getStats(email); break;
      case 'edificios': result = getEdificios(email); break;
      case 'edificio':  result = getEdificio(e.parameter.id, email); break;
      case 'etapas':    result = getEtapas(email); break;
      case 'ping':      result = { ok: true, ts: new Date().toISOString() }; break;
      default:          result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return setCORS(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch {}
  const action = e.parameter.action || body.action;
  const email  = e.parameter.email  || body.email || '';
  let result;

  try {
    switch (action) {
      case 'auth':               result = authUser(body.token, email); break;
      case 'sync_relevamiento':  result = saveRelevamiento(body, email); break;
      case 'save_inspeccion':    result = saveInspeccion(body, email); break;
      case 'save_intervencion':  result = saveIntervencion(body, email); break;
      case 'create_edificio':    result = createEdificio(body, email); break;
      case 'update_estado':      result = updateEstado(body, email); break;
      default: result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return setCORS(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

/* ══════════════════════════════════════════════════════
   AUTH: verificar email y devolver rol
══════════════════════════════════════════════════════ */
function authUser(token, email) {
  /* En producción: verificar el id_token de Google con tokeninfo.
     Para simplificar, la PWA envía el email directamente después
     de que Google Identity Services lo autentica en el cliente. */

  if (!email) return { ok: false, error: 'Email requerido' };

  const role = getRoleForEmail(email);
  if (!role) return { ok: false, error: 'Usuario sin acceso al sistema' };

  return {
    ok: true,
    user: {
      email: email,
      name: email.split('@')[0], // Se reemplaza con el nombre real de Google
      picture: null,
      role: role,
    }
  };
}

function getRoleForEmail(email) {
  try {
    const hoja = SS.getSheetByName(HOJAS.ROLES);
    if (!hoja) return null;
    const data = hoja.getDataRange().getValues();
    // Columnas: email | rol | activo
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === email && data[i][2] === true) {
        return data[i][1]; // 'admin' | 'inspector' | 'viewer'
      }
    }
    return null;
  } catch { return null; }
}

/* ── Verificar que el usuario tiene el rol mínimo requerido ── */
function requireRole(email, rolesPermitidos) {
  const role = getRoleForEmail(email);
  if (!role || !rolesPermitidos.includes(role)) {
    throw new Error('Sin permisos para esta operación');
  }
  return role;
}

/* ══════════════════════════════════════════════════════
   STATS: métricas del dashboard
══════════════════════════════════════════════════════ */
function getStats(email) {
  requireRole(email, ['admin', 'inspector', 'viewer']);

  const edificiosSheet = SS.getSheetByName(HOJAS.EDIFICIOS);
  const intSheet = SS.getSheetByName(HOJAS.INTERVENCIONES);

  const edificios = edificiosSheet
    ? Math.max(0, edificiosSheet.getLastRow() - 1)
    : 0;

  let imp = 0, intAbiertas = 0, resueltasMes = 0;

  if (intSheet && intSheet.getLastRow() > 1) {
    const data = intSheet.getDataRange().getValues();
    const headers = data[0];
    const idxEstado = headers.indexOf('estado');
    const idxImp    = headers.indexOf('impide_desarrollo_pedagogico');
    const idxFin    = headers.indexOf('fecha_fin');
    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();

    for (let i = 1; i < data.length; i++) {
      const estado = data[i][idxEstado];
      const impide = data[i][idxImp];
      const fechaFin = data[i][idxFin];

      if (impide === true || impide === 'true' || impide === 'S') imp++;
      if (['pendiente','en_analisis','aprobada','en_ejecucion'].includes(estado)) intAbiertas++;
      if (estado === 'finalizada' && fechaFin) {
        const f = new Date(fechaFin);
        if (f.getMonth() === mesActual && f.getFullYear() === anioActual) resueltasMes++;
      }
    }
  }

  return {
    ok: true,
    data: { edificios, imp, int: intAbiertas, ok: resueltasMes }
  };
}

/* ══════════════════════════════════════════════════════
   EDIFICIOS: listado y ficha
══════════════════════════════════════════════════════ */
function getEdificios(email) {
  requireRole(email, ['admin', 'inspector', 'viewer']);
  const role = getRoleForEmail(email);

  const hoja = SS.getSheetByName(HOJAS.EDIFICIOS);
  if (!hoja || hoja.getLastRow() < 2) return { ok: true, data: [] };

  const data = hoja.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  let edificios = rows
    .filter(r => r[headers.indexOf('activo')] !== false)
    .map(r => sheetRowToObject(headers, r));

  // Inspectores: filtrar solo sus edificios
  if (role === 'inspector') {
    edificios = edificios.filter(e => e.inspector_id === email || e.inspector === email);
  }

  return { ok: true, data: edificios };
}

function getEdificio(id, email) {
  requireRole(email, ['admin', 'inspector', 'viewer']);
  if (!id) return { ok: false, error: 'ID requerido' };

  const hoja = SS.getSheetByName(HOJAS.EDIFICIOS);
  if (!hoja) return { ok: false, error: 'Hoja no encontrada' };

  const data = hoja.getDataRange().getValues();
  const headers = data[0];
  const row = data.find(r => String(r[0]) === String(id));
  if (!row) return { ok: false, error: 'Edificio no encontrado' };

  const edificio = sheetRowToObject(headers, row);

  // Agregar sectores, relevamientos e intervenciones del edificio
  edificio.sectores      = getSectoresByEdificio(id);
  edificio.intervenciones = getIntervencionesByEdificio(id, 10);

  return { ok: true, data: edificio };
}

function getSectoresByEdificio(idEdificio) {
  return getRelatedRows(HOJAS.SECTORES, 'edificio_id', idEdificio);
}

function getIntervencionesByEdificio(idEdificio, limit) {
  const rows = getRelatedRows(HOJAS.INTERVENCIONES, 'edificio_id', idEdificio);
  return limit ? rows.slice(0, limit) : rows;
}

/* ══════════════════════════════════════════════════════
   RELEVAMIENTO: guardar desde PWA
══════════════════════════════════════════════════════ */
function saveRelevamiento(data, email) {
  requireRole(email, ['admin', 'inspector']);

  const id = 'REL-' + Date.now();
  const ts = new Date().toISOString();

  /* 1. Guardar relevamiento */
  appendRow(HOJAS.RELEVAMIENTOS, {
    id_relevamiento:      id,
    edificio_id:          data.gestion?.edificio_id || '',
    fecha:                data.gestion?.fecha_relevamiento || ts,
    inspector_id:         email,
    tipo_relevamiento:    'general',
    observaciones_generales: data.observaciones_generales || '',
    formulario_pdf:       '',
    plano_asociado:       '',
  });

  /* 2. Guardar sectores/observaciones */
  const sectores = data.sectores || [];
  sectores.forEach((s, i) => {
    if (!s.problema) return; // saltar filas vacías
    const idObs = 'OBS-' + Date.now() + '-' + i;
    appendRow(HOJAS.OBSERVACIONES, {
      id_observacion:              idObs,
      relevamiento_id:             id,
      sector_id:                   s.sector_id || '',
      componente:                  s.componente || '',
      problema_detectado:          s.problema || '',
      cantidad_total:              s.total || '',
      cantidad_afectada:           '',
      porcentaje_funcionamiento:   s.pct_func || '',
      prioridad_tecnica:           '',
      impide_desarrollo_pedagogico: s.impide === 'S',
      justificacion_pedagogica:    data.impacto_pedagogico?.justificacion || '',
      requiere_intervencion:       s.requiere_intervencion === 'S',
      tipo_intervencion:           '',
      observaciones:               '',
    });

    /* 3. Si requiere intervención, crearla automáticamente */
    if (s.requiere_intervencion === 'S') {
      appendRow(HOJAS.INTERVENCIONES, {
        id_intervencion:             'INT-' + Date.now() + '-' + i,
        edificio_id:                 data.gestion?.edificio_id || '',
        relevamiento_id:             id,
        observacion_id:              idObs,
        sector_id:                   s.sector_id || '',
        componente:                  s.componente || '',
        tipo_intervencion:           '',
        descripcion_tecnica:         s.problema || '',
        prioridad_tecnica:           '',
        impide_desarrollo_pedagogico: s.impide === 'S',
        estado:                      'pendiente',
        fecha_creacion:              ts,
        fecha_inicio:                '',
        fecha_fin:                   '',
        responsable_ejecucion:       '',
        validado_por_inspector:      false,
      });
    }
  });

  /* 4. Historial */
  appendRow(HOJAS.HISTORIAL, {
    id_historial:    'HIS-' + Date.now(),
    edificio_id:     data.gestion?.edificio_id || '',
    sector_id:       '',
    observacion_id:  '',
    intervencion_id: '',
    fecha:           ts,
    estado_anterior: '',
    estado_nuevo:    'relevamiento_cargado',
    evolucion:       '',
    observaciones:   'Relevamiento general cargado por ' + email,
    foto_id:         '',
    inspector_id:    email,
  });

  return { ok: true, id, message: 'Relevamiento guardado correctamente' };
}

/* ══════════════════════════════════════════════════════
   INSPECCIÓN PERIÓDICA
══════════════════════════════════════════════════════ */
function saveInspeccion(data, email) {
  requireRole(email, ['admin', 'inspector']);

  const id = 'INS-' + Date.now();
  const ts = new Date().toISOString();

  appendRow(HOJAS.RELEVAMIENTOS, {
    id_relevamiento:      id,
    edificio_id:          data.edificio_id || '',
    fecha:                data.fecha || ts,
    inspector_id:         email,
    tipo_relevamiento:    'inspeccion_semanal',
    observaciones_generales: data.observaciones || '',
    formulario_pdf:       '',
    plano_asociado:       '',
  });

  /* Historial de evolución */
  (data.evoluciones || []).forEach((ev, i) => {
    appendRow(HOJAS.HISTORIAL, {
      id_historial:    'HIS-' + Date.now() + '-' + i,
      edificio_id:     data.edificio_id || '',
      sector_id:       ev.sector_id || '',
      observacion_id:  ev.observacion_id || '',
      intervencion_id: ev.intervencion_id || '',
      fecha:           ts,
      estado_anterior: ev.estado_anterior || '',
      estado_nuevo:    ev.estado_nuevo || '',
      evolucion:       ev.evolucion || 'sin_cambios', // mejoro | empeoro | sin_cambios
      observaciones:   ev.observaciones || '',
      foto_id:         ev.foto_id || '',
      inspector_id:    email,
    });
  });

  return { ok: true, id };
}

/* ══════════════════════════════════════════════════════
   INTERVENCIÓN
══════════════════════════════════════════════════════ */
function saveIntervencion(data, email) {
  requireRole(email, ['admin', 'inspector']);

  const ts = new Date().toISOString();
  const hoja = SS.getSheetByName(HOJAS.INTERVENCIONES);
  if (!hoja) return { ok: false, error: 'Hoja intervenciones no encontrada' };

  const sheetData = hoja.getDataRange().getValues();
  const headers = sheetData[0];
  const idxId = headers.indexOf('id_intervencion');
  const idxEstado = headers.indexOf('estado');

  /* Buscar la fila de la intervención */
  for (let i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idxId]) === String(data.id)) {
      const estadoAnterior = sheetData[i][idxEstado];

      /* Actualizar estado */
      hoja.getRange(i + 1, idxEstado + 1).setValue(data.estado);
      if (data.fecha_inicio) hoja.getRange(i + 1, headers.indexOf('fecha_inicio') + 1).setValue(data.fecha_inicio);
      if (data.fecha_fin)    hoja.getRange(i + 1, headers.indexOf('fecha_fin') + 1).setValue(data.fecha_fin);
      if (data.responsable)  hoja.getRange(i + 1, headers.indexOf('responsable_ejecucion') + 1).setValue(data.responsable);

      /* Historial */
      appendRow(HOJAS.HISTORIAL, {
        id_historial:    'HIS-' + Date.now(),
        edificio_id:     data.edificio_id || '',
        sector_id:       '',
        observacion_id:  '',
        intervencion_id: data.id,
        fecha:           ts,
        estado_anterior: estadoAnterior,
        estado_nuevo:    data.estado,
        evolucion:       data.evolucion || '',
        observaciones:   data.observaciones || '',
        foto_id:         data.foto_id || '',
        inspector_id:    email,
      });

      return { ok: true };
    }
  }

  return { ok: false, error: 'Intervención no encontrada' };
}

/* ══════════════════════════════════════════════════════
   EDIFICIOS: crear
══════════════════════════════════════════════════════ */
function createEdificio(data, email) {
  requireRole(email, ['admin']);

  const id = 'ED-' + Date.now();
  appendRow(HOJAS.EDIFICIOS, {
    id_edificio:          id,
    nombre:               data.nombre || '',
    numero_establecimiento: data.numero || '',
    tipo:                 data.tipo || '',
    nivel:                data.nivel || '',
    direccion:            data.direccion || '',
    delegacion:           data.delegacion || '',
    localidad:            data.localidad || '',
    latitud:              data.latitud || '',
    longitud:             data.longitud || '',
    foto_fachada:         data.foto_fachada || '',
    etapa_id:             data.etapa_id || '',
    zona_id:              data.zona_id || '',
    inspector_id:         data.inspector_id || '',
    telefono_fijo:        data.telefono || '',
    email_institucional:  data.email || '',
    plano_implantacion:   '',
    plano_edificio:       '',
    activo:               true,
  });

  return { ok: true, id };
}

/* ══════════════════════════════════════════════════════
   ETAPAS
══════════════════════════════════════════════════════ */
function getEtapas(email) {
  requireRole(email, ['admin', 'inspector', 'viewer']);
  const rows = getRelatedRows(HOJAS.ETAPAS, null, null);
  return { ok: true, data: rows };
}

/* ══════════════════════════════════════════════════════
   UTILIDADES INTERNAS
══════════════════════════════════════════════════════ */

/* Agregar una fila a una hoja en el orden de sus headers */
function appendRow(nombreHoja, objeto) {
  const hoja = SS.getSheetByName(nombreHoja);
  if (!hoja) {
    Logger.log('Hoja no encontrada: ' + nombreHoja);
    return;
  }
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const val = objeto[h];
    return val !== undefined ? val : '';
  });
  hoja.appendRow(row);
}

/* Convertir una fila de Sheets a objeto JS usando los headers */
function sheetRowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

/* Obtener filas relacionadas por un campo */
function getRelatedRows(nombreHoja, campo, valor) {
  const hoja = SS.getSheetByName(nombreHoja);
  if (!hoja || hoja.getLastRow() < 2) return [];
  const data = hoja.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  if (!campo) return rows.map(r => sheetRowToObject(headers, r));
  return rows
    .filter(r => String(r[headers.indexOf(campo)]) === String(valor))
    .map(r => sheetRowToObject(headers, r));
}

/* ── SETUP INICIAL: crear hojas si no existen ── */
function setupSheets() {
  const estructura = {
    roles:                    ['email','rol','activo','nombre'],
    edificios:                ['id_edificio','nombre','numero_establecimiento','tipo','nivel','direccion','delegacion','localidad','latitud','longitud','foto_fachada','etapa_id','zona_id','inspector_id','telefono_fijo','email_institucional','plano_implantacion','plano_edificio','activo'],
    etapas:                   ['id_etapa','nombre','descripcion','fecha_inicio','fecha_fin','activa'],
    zonas:                    ['id_zona','etapa_id','nombre','inspector_id','descripcion'],
    inspectores:              ['id_inspector','nombre','telefono','email','cargo','activo'],
    sectores:                 ['id_sector','edificio_id','tipo_sector','identificador','planta','uso','en_uso','observaciones'],
    contactos_institucionales:['id_contacto','edificio_id','nombre','cargo','telefono_celular','email','es_referente_principal','canal_preferido'],
    datos_institucionales:    ['id_dato','edificio_id','matricula','secciones','turnos','personal_docente','auxiliares','fecha_actualizacion'],
    relevamientos:            ['id_relevamiento','edificio_id','fecha','inspector_id','tipo_relevamiento','observaciones_generales','formulario_pdf','plano_asociado'],
    observaciones_sector:     ['id_observacion','relevamiento_id','sector_id','componente','problema_detectado','cantidad_total','cantidad_afectada','porcentaje_funcionamiento','prioridad_tecnica','impide_desarrollo_pedagogico','justificacion_pedagogica','requiere_intervencion','tipo_intervencion','observaciones'],
    fotos:                    ['id_foto','edificio_id','relevamiento_id','observacion_id','intervencion_id','tipo_foto','url_drive','fecha','descripcion'],
    intervenciones:           ['id_intervencion','edificio_id','relevamiento_id','observacion_id','sector_id','componente','tipo_intervencion','descripcion_tecnica','prioridad_tecnica','impide_desarrollo_pedagogico','estado','fecha_creacion','fecha_inicio','fecha_fin','responsable_ejecucion','validado_por_inspector'],
    historial_estados:        ['id_historial','edificio_id','sector_id','observacion_id','intervencion_id','fecha','estado_anterior','estado_nuevo','evolucion','observaciones','foto_id','inspector_id'],
    incidencias:              ['id_incidencia','edificio_id','fecha','informada_por','descripcion','sector_id','vinculada_a_observacion','vinculada_a_intervencion','estado'],
  };

  Object.entries(estructura).forEach(([nombre, headers]) => {
    let hoja = SS.getSheetByName(nombre);
    if (!hoja) {
      hoja = SS.insertSheet(nombre);
      hoja.appendRow(headers);
      hoja.getRange(1, 1, 1, headers.length)
        .setBackground('#0f0f0e')
        .setFontColor('white')
        .setFontWeight('bold');
      Logger.log('Hoja creada: ' + nombre);
    }
  });

  Logger.log('Setup completo. Hojas: ' + Object.keys(estructura).join(', '));
}

/* ── ENDPOINTS ADICIONALES FASE 3 ── */

// Agregar al switch de doGet:
// case 'relevamientos_edificio': result = getRelevamientosEdificio(e.parameter.id, email); break;
// case 'historial_edificio':     result = getHistorialEdificio(e.parameter.id, email); break;

function getRelevamientosEdificio(id, email) {
  requireRole(email, ['admin','inspector','viewer']);
  if (!id) return { ok: false, error: 'ID requerido' };
  return { ok: true, data: getRelatedRows(HOJAS.RELEVAMIENTOS, 'edificio_id', id) };
}

function getHistorialEdificio(id, email) {
  requireRole(email, ['admin','inspector','viewer']);
  if (!id) return { ok: false, error: 'ID requerido' };
  var rows = getRelatedRows(HOJAS.HISTORIAL, 'edificio_id', id);
  rows.sort(function(a,b){ return new Date(b.fecha) - new Date(a.fecha); });
  return { ok: true, data: rows };
}
