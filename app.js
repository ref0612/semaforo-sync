// Inicialización de botones y carga inicial
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-not-processed').addEventListener('click', () => fetchAndRender('not_processed'));
  document.getElementById('btn-failed').addEventListener('click', () => fetchAndRender('failed'));
  document.getElementById('btn-synced').addEventListener('click', () => fetchAndRender('synced'));
  document.getElementById('btn-resync').addEventListener('click', () => {
    // Aquí puedes agregar la lógica de resync si aplica
    alert('Funcionalidad de resync aún no implementada');
  });
  // Carga inicial (opcional: puedes dejar vacío o cargar un estado por defecto)
  // fetchAndRender('not_processed');
});
// Variables globales necesarias
const tableContainer = document.getElementById('table-container');
const API_BASE = 'https://gds.kupos.com/api/v2/konnect_gds_sync?';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjkiLCJzY3AiOiJ1c2VyIiwiYXVkIjpudWxsLCJpYXQiOjE3NTYxNTMyOTIsImV4cCI6MTc3MTkzMTc2OCwianRpIjoiZTRhMWI4YmEtNjZjOC00N2Q1LWIyOWQtNWQ3ZWYxNmNjYTJhIn0.MFXifUXdvxIWNhGE3tpO8bARU2tJEAGvW_OOmZY2svQ',
  'Referer': 'https://gdsdashboard.kupos.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"'
};
let lastAudits = [];
// Alias para compatibilidad con fetchAndRender
function renderTable(data) {
  renderGroupedByTravelName(data);
}
// Renderizar tabla agrupada por travel_name (operador)
function renderGroupedByTravelName(data) {
  if (!Array.isArray(data) || data.length === 0) {
    tableContainer.innerHTML = '<div class="empty">No hay datos para mostrar.</div>';
    return;
  }
  // Agrupar por travel_name
  const groups = {};
  data.forEach(item => {
    const name = item.travel_name || 'Sin operador';
    if (!groups[name]) groups[name] = [];
    groups[name].push(item);
  });
  let html = '<table><thead><tr>' +
    '<th>Operador</th>' +
    '<th>Cantidad</th>' +
    '<th>Primer ID</th>' +
    '<th>Primer Fecha</th>' +
    '<th>Acciones</th>' +
    '</tr></thead><tbody>';
  Object.keys(groups).forEach((name, idx) => {
    const arr = groups[name];
    const detailId = `detalle-${idx}`;
    html += `<tr>
      <td>${name}</td>
      <td>${arr.length}</td>
      <td>${arr[0].id}</td>
      <td>${arr[0].travel_date || ''}</td>
      <td><button class="btn-detalle" data-target="${detailId}">Ver detalle</button></td>
    </tr>`;
    // Fila de detalle oculta con paginación y tabla de todos los campos
    if (arr.length > 0) {
      const columns = Object.keys(arr[0]);
      html += `<tr id="${detailId}" style="display:none;background:#f9f9f9;"><td colspan="5">`;
      html += `<div style="padding:10px 0;overflow-x:auto; border:1px solid #d1d5db; border-radius:8px; background:#f3f6fa; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <b>Detalle de registros agrupados:</b><br>`;
      html += `<table class="detalle-table" style="width:100%;font-size:13px;"><thead><tr>`;
      columns.forEach(col => { html += `<th>${col}</th>`; });
      html += '<th>Acciones</th></tr></thead><tbody id="tbody-'+detailId+'">';
      // Solo se renderiza la primera página, el resto se hace por JS
      arr.slice(0,20).forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
          let val = row[col];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          html += `<td>${val !== undefined ? val : ''}</td>`;
        });
        // Botón Resync por registro
        html += `<td><button class='btn-resync-row' data-id='${row.id}'>Resync</button></td>`;
        html += '</tr>';
      });
      html += `</tbody></table>`;
      // Paginación debajo de la tabla
      html += `<div class=\"pagination-controls\" id=\"pagination-${detailId}\" style=\"margin:8px 0 0 0; text-align:right;\"></div>`;
      html += `</div></td></tr>`;
    }
  });
  html += '</tbody></table>';
  tableContainer.innerHTML = html;
  // Eventos para mostrar/ocultar detalle y paginación
  document.querySelectorAll('.btn-detalle').forEach(btn => {
        btn.addEventListener('click', function() {
          const target = document.getElementById(this.getAttribute('data-target'));
          if (target.style.display === 'none') {
            target.style.display = '';
            this.classList.add('active');
            this.textContent = 'Ocultar detalle';
          } else {
            target.style.display = 'none';
            this.classList.remove('active');
            this.textContent = 'Ver detalle';
          }
        });
      });
  // Paginación para cada grupo
  Object.keys(groups).forEach((name, idx) => {
    const arr = groups[name];
    if (arr.length > 20) {
      const detailId = `detalle-${idx}`;
      const totalPages = Math.ceil(arr.length/20);
      const pagDiv = document.getElementById('pagination-'+detailId);
      if (pagDiv) {
        let pagHtml = '';
        for(let p=1;p<=totalPages;p++) {
          pagHtml += `<button class='btn-page' data-detail='${detailId}' data-page='${p}' style='margin-left:2px;'>${p}</button>`;
        }
        pagDiv.innerHTML = pagHtml;
      }
    }
  });
  // Evento de paginación
  document.querySelectorAll('.btn-page').forEach(btn => {
    btn.addEventListener('click', function() {
      const detailId = this.getAttribute('data-detail');
      const page = parseInt(this.getAttribute('data-page'));
      // Buscar el grupo correspondiente
      const name = Object.keys(groups)[parseInt(detailId.replace('detalle-',''))];
      const arr = groups[name];
      const columns = Object.keys(arr[0]);
      const tbody = document.getElementById('tbody-'+detailId);
      tbody.innerHTML = '';
      arr.slice((page-1)*20, page*20).forEach(row => {
        let tr = '<tr>';
        columns.forEach(col => {
          let val = row[col];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          tr += `<td>${val !== undefined ? val : ''}</td>`;
        });
        tr += `<td><button class='btn-resync-row' data-id='${row.id}'>Resync</button></td>`;
        tr += '</tr>';
        tbody.innerHTML += tr;
      });
    });
  });
}

// Evento global para los botones Resync de cada registro (fuera de la función)
document.addEventListener('click', async function(e) {
  if (e.target && e.target.classList.contains('btn-resync-row')) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const res = await fetch('https://gds.kupos.com/api/v2/konnect_gds_sync/retrigger_sync', {
        method: 'POST',
        headers: {
          ...HEADERS,
          'content-type': 'application/json',
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'es-ES,es;q=0.9,en;q=0.8,gl;q=0.7',
          'origin': 'https://gdsdashboard.kupos.com',
          'priority': 'u=1, i',
          'referer': 'https://gdsdashboard.kupos.com/',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site'
        },
        body: JSON.stringify({ id: Number(id) })
      });
      if (res.ok) {
        // Remover la fila del DOM
        const tr = btn.closest('tr');
        const tbody = tr.parentElement;
        tr.remove();
        // Si no quedan filas en el tbody, ocultar el grupo completo
        if (tbody.children.length === 0) {
          // tbody id: tbody-detalle-X
          const detailId = tbody.id.replace('tbody-', '');
          // Oculta la fila de detalle
          const detailRow = document.getElementById(detailId);
          if (detailRow) detailRow.parentElement.removeChild(detailRow);
          // Oculta la fila principal del grupo
          const mainRow = document.querySelector(`button[data-target='${detailId}']`)?.closest('tr');
          if (mainRow) mainRow.parentElement.removeChild(mainRow);
        }
      } else {
        btn.textContent = 'Error';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Resync';
          btn.style.background = '';
        }, 2000);
      }
    } catch (err) {
      btn.textContent = 'Error';
      btn.style.background = '#ef4444';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Resync';
        btn.style.background = '';
      }, 2000);
    }
  }
});
// Buscar y renderizar registros por status
async function fetchAndRender(status) {
  tableContainer.innerHTML = '<div class="loading">Cargando...</div>';
  document.getElementById('record-counter').textContent = '';
  try {
  // Elimina cualquier status anterior de la URL base
  const url = `${API_BASE.replace(/([&?])status=[^&]*/g, '')}&status=${status}`;
  const res = await fetch(url, { headers: HEADERS });
    if (res.status === 304) {
      tableContainer.innerHTML = '<div class="empty">No hay cambios (304 Not Modified)</div>';
      return;
    }
    if (!res.ok) throw new Error('Error al obtener datos');
    const data = await res.json();
    if (data && data.data && Array.isArray(data.data.audits)) {
      lastAudits = data.data.audits;
      document.getElementById('record-counter').textContent = `Registros encontrados: ${lastAudits.length}`;
  renderTable(lastAudits);
    } else {
      lastAudits = [];
      document.getElementById('record-counter').textContent = 'Registros encontrados: 0';
  renderTable([]);
    }
  } catch (err) {
    tableContainer.innerHTML = `<div class="error">${err.message}</div>`;
  }
}
