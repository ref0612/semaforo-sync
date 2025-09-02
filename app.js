// Detecta entorno y define la URL base de la API
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? ''
  : 'https://semaforo-sync.onrender.com';
// Inicialización de botones y carga inicial
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-not-processed').addEventListener('click', () => fetchAndRender('not_processed'));
  document.getElementById('btn-failed').addEventListener('click', () => fetchAndRender('failed'));
  document.getElementById('btn-synced').addEventListener('click', () => fetchAndRender('synced'));
  // Carga inicial (opcional)
  // fetchAndRender('not_processed');
});

const tableContainer = document.getElementById('table-container');
let lastAudits = [];

// Alias para compatibilidad con fetchAndRender
function renderTable(data) {
  renderGroupedByTravelName(data);
}

// Renderizar tabla agrupada por travel_name (operador)
function renderGroupedByTravelName(data) {
  if (!Array.isArray(data) || data.length === 0) {
    tableContainer.innerHTML = '<div class="empty">Nothing to show.</div>';
    return;
  }
  // Agrupar por travel_name
  const groups = {};
  data.forEach(item => {
    const name = item.travel_name || 'Sin operador';
    if (!groups[name]) groups[name] = [];
    groups[name].push(item);
  });
  // Ordenar los grupos de mayor a menor cantidad
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  let html = '<table><thead><tr>' +
    '<th>Operador</th>' +
    '<th>Quantity</th>' +
    '<th>Actions</th>' +
    '</tr></thead><tbody>';
  sortedGroups.forEach(([name, arr], idx) => {
    const detailId = `detalle-${idx}`;
    html += `<tr>
      <td>${name}</td>
      <td>${arr.length}</td>
      <td><button class="btn-detalle" data-target="${detailId}">View Detail</button></td>
    </tr>`;
    // Fila de detalle oculta con paginación y tabla de todos los campos
    if (arr.length > 0) {
      const columns = Object.keys(arr[0]);
      html += `<tr id="${detailId}" style="display:none;background:#f9f9f9;"><td colspan="3">`;
      html += `<div style="padding:10px 0;overflow-x:auto; border:1px solid #d1d5db; border-radius:8px; background:#f3f6fa; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <b>Detalle de registros agrupados:</b><br>`;
      html += `<table class="detalle-table" style="width:100%;font-size:13px;"><thead><tr>`;
      columns.forEach(col => { html += `<th>${col}</th>`; });
      html += '<th>Actions</th></tr></thead><tbody id="tbody-'+detailId+'">';
      arr.slice(0,20).forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
          let val = row[col];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          html += `<td>${val !== undefined ? val : ''}</td>`;
        });
        html += `<td><button class='btn-resync-row' data-id='${row.id}'>Resync</button></td>`;
        html += '</tr>';
      });
      html += `</tbody></table>`;
      html += `<div class="pagination-controls" id="pagination-${detailId}" style="margin:8px 0 0 0; text-align:right;"></div>`;
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
        this.textContent = 'Hide Details';
      } else {
        target.style.display = 'none';
        this.classList.remove('active');
        this.textContent = 'View Details';
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
  const res = await fetch(`${API_BASE_URL}/api/resync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) })
      });
      if (res.ok) {
        // Remover la fila del DOM
        const tr = btn.closest('tr');
        const tbody = tr.parentElement;
        tr.remove();
        if (tbody.children.length === 0) {
          const detailId = tbody.id.replace('tbody-', '');
          const detailRow = document.getElementById(detailId);
          if (detailRow) detailRow.parentElement.removeChild(detailRow);
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
  const url = `${API_BASE_URL}/api/audits?status=${status}`;
  const res = await fetch(url);
    if (res.status === 304) {
      tableContainer.innerHTML = '<div class="empty">No hay cambios (304 Not Modified)</div>';
      return;
    }
    if (!res.ok) throw new Error('Error al obtener datos');
    const data = await res.json();
    if (data && data.data && Array.isArray(data.data.audits)) {
      lastAudits = data.data.audits;
      document.getElementById('record-counter').textContent = `Records Found: ${lastAudits.length}`;
      renderTable(lastAudits);
    } else {
      lastAudits = [];
      document.getElementById('record-counter').textContent = 'Records Found: 0';
      renderTable([]);
    }
  } catch (err) {
    tableContainer.innerHTML = `<div class="error">${err.message}</div>`;
  }
}