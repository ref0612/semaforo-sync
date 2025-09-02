// --- Estado de cola: botón y lógica ---
const btnEstadoCola = document.getElementById('btn-estado-cola');
const estadoColaInfo = document.getElementById('estado-cola-info');
if (btnEstadoCola && estadoColaInfo) {
  btnEstadoCola.addEventListener('click', async () => {
    estadoColaInfo.textContent = 'Consultando estado de cola...';
    try {
  const res = await fetch('https://semaforo-sync.onrender.com/api/queue-status');
      if (!res.ok) throw new Error('Error al consultar la API');
      const data = await res.json();
      if (data && data.data && typeof data.data.total_pending_jobs === 'number') {
        estadoColaInfo.textContent = `Pendientes en la cola: ${data.data.total_pending_jobs}`;
      } else {
        estadoColaInfo.textContent = 'No se pudo obtener el estado de la cola.';
      }
    } catch (e) {
      estadoColaInfo.textContent = 'Error al consultar el estado de la cola.';
    }
  });
}

// --- Limpiar cola: botón y lógica ---
const btnLimpiarCola = document.getElementById('btn-limpiar-cola');
if (btnLimpiarCola && btnEstadoCola && estadoColaInfo) {
  btnLimpiarCola.addEventListener('click', async () => {
    btnLimpiarCola.disabled = true;
    estadoColaInfo.textContent = 'Limpiando cola...';
    try {
      // Primero obtener los IDs pendientes
  const res = await fetch('https://semaforo-sync.onrender.com/api/queue-status');
      if (!res.ok) throw new Error('Error al consultar la API de estado de cola');
      const data = await res.json();
      const ids = (data && data.data && Array.isArray(data.data.pending_audits)) ? data.data.pending_audits : [];
      if (!ids.length) {
        estadoColaInfo.textContent = 'No hay IDs pendientes para limpiar.';
        btnLimpiarCola.disabled = false;
        return;
      }
      // Llamar al backend para limpiar la cola
  const res2 = await fetch('https://semaforo-sync.onrender.com/api/clear-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const result = await res2.json();
      if (res2.ok && result.success) {
        estadoColaInfo.textContent = 'Cola limpiada correctamente.';
      } else {
        estadoColaInfo.textContent = 'No se pudo limpiar la cola.';
      }
    } catch (e) {
      estadoColaInfo.textContent = 'Error al limpiar la cola.';
    }
    btnLimpiarCola.disabled = false;
  });
}
// Lógica de pestañas
const tabDatos = document.getElementById('tab-datos');
const tabGraficos = document.getElementById('tab-graficos');
const tabContentDatos = document.getElementById('tab-content-datos');
const tabContentGraficos = document.getElementById('tab-content-graficos');

tabDatos.addEventListener('click', () => {
  tabDatos.classList.add('active');
  tabGraficos.classList.remove('active');
  tabContentDatos.style.display = '';
  tabContentGraficos.style.display = 'none';
});

tabGraficos.addEventListener('click', () => {
  tabGraficos.classList.add('active');
  tabDatos.classList.remove('active');
  tabContentDatos.style.display = 'none';
  tabContentGraficos.style.display = '';
    // No renderiza automáticamente, espera acción del usuario
});
  
  // Botón para actualizar los gráficos manualmente
  const btnActualizarGraficos = document.getElementById('btn-actualizar-graficos');
  const filtroFechaDesde = document.getElementById('filtro-fecha-desde');
  const filtroFechaHasta = document.getElementById('filtro-fecha-hasta');
  // Helper para formatear fecha a dd-mm-yyyy
  function formatDateDMY(date) {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  // Helper para parsear dd-mm-yyyy a yyyy-mm-dd
  function parseDMYtoYMD(str) {
    const [dd, mm, yyyy] = str.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  // NUEVA LÓGICA DE SELECCIÓN DE FECHA: solo calendario, siempre válido, sin escritura manual
  if (filtroFechaDesde && filtroFechaHasta) {
    const hoy = new Date();
    const hoyDMY = formatDateDMY(hoy);
    filtroFechaDesde.value = hoyDMY;
    filtroFechaHasta.value = hoyDMY;
    filtroFechaDesde.placeholder = hoyDMY;
    filtroFechaHasta.placeholder = hoyDMY;

    function showCalendar(input, calendarId) {
      return function(e) {
        e.preventDefault();
        e.stopPropagation();
        const calendarDiv = document.getElementById(calendarId);
        calendarDiv.innerHTML = '';
        calendarDiv.style.display = 'block';
        calendarDiv.style.position = 'absolute';
        calendarDiv.style.left = (input.offsetLeft) + 'px';
        calendarDiv.style.top = (input.offsetTop + input.offsetHeight + 2) + 'px';

        // Determinar mes/año/día actual del input o hoy, y forzar valor válido
        let fechaActual;
        let selectedDay = null;
        const match = input.value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        let dd, mm, yyyy;
        if (match) {
          dd = parseInt(match[1], 10);
          mm = parseInt(match[2], 10);
          yyyy = parseInt(match[3], 10);
          const diasEnMes = new Date(yyyy, mm, 0).getDate();
          if (dd > diasEnMes) dd = diasEnMes;
          fechaActual = new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`);
          // Si la fecha no es válida, usar hoy
          if (fechaActual.getFullYear() !== yyyy || fechaActual.getMonth() + 1 !== mm || fechaActual.getDate() !== dd) {
            fechaActual = new Date();
          }
          selectedDay = fechaActual.getDate();
        } else {
          fechaActual = new Date();
          selectedDay = fechaActual.getDate();
        }
        // Siempre forzar el input a un valor válido
        input.value = formatDateDMY(fechaActual);
        let mes = fechaActual.getMonth();
        let anio = fechaActual.getFullYear();


        function renderCalendar() {
          // Si el día seleccionado no existe en el mes, selecciona el último día válido
          const diasEnMes = new Date(anio, mes+1, 0).getDate();
          if (selectedDay > diasEnMes) selectedDay = diasEnMes;

          calendarDiv.innerHTML = '';
          const calendar = document.createElement('div');
          calendar.className = 'kupos-calendar_common_kupos_calendar__0k1pS';
          // Header mes/año y flechas
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.marginBottom = '8px';
          const prev = document.createElement('button');
          prev.textContent = '<';
          prev.onclick = (ev) => { ev.preventDefault(); mes--; if (mes < 0) { mes = 11; anio--; } console.log('[CALENDAR] Mes anterior:', {mes, anio}); renderCalendar(); };
          const next = document.createElement('button');
          next.textContent = '>';
          next.onclick = (ev) => { ev.preventDefault(); mes++; if (mes > 11) { mes = 0; anio++; } console.log('[CALENDAR] Mes siguiente:', {mes, anio}); renderCalendar(); };
          const label = document.createElement('span');
          label.textContent = `${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes]} ${anio}`;
          label.style.fontWeight = 'bold';
          label.style.fontSize = '1rem';
          header.appendChild(prev);
          header.appendChild(label);
          header.appendChild(next);
          calendar.appendChild(header);
          // Días de la semana
          const diasSemana = ['L','M','M','J','V','S','D'];
          const semanaRow = document.createElement('div');
          semanaRow.style.display = 'flex';
          diasSemana.forEach(dia => {
            const d = document.createElement('div');
            d.textContent = dia;
            d.style.width = '32px';
            d.style.textAlign = 'center';
            d.style.fontWeight = 'bold';
            semanaRow.appendChild(d);
          });
          calendar.appendChild(semanaRow);
          // Días del mes (CÓDIGO CORREGIDO)
          const primerDiaSemana = new Date(anio, mes, 1).getDay();
          const offset = (primerDiaSemana + 6) % 7; // Lunes = 0, Martes = 1 ... Domingo = 6
          let diaActual = 1;
          for (let fila = 0; fila < 6; fila++) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            for (let col = 0; col < 7; col++) {
              const cell = document.createElement('div');
              cell.className = 'calendar-day-cell';
              cell.style.width = '32px';
              cell.style.height = '32px';
              cell.style.textAlign = 'center';
              cell.style.lineHeight = '32px';
              cell.style.cursor = 'pointer';
              cell.style.borderRadius = '6px';
              cell.style.margin = '1px';

              // Solo procesar si estamos en un día válido del mes
              if ((fila === 0 && col >= offset) || (fila > 0 && diaActual <= diasEnMes)) {
                const dia = diaActual; // Capturamos el valor actual del día
                cell.textContent = dia;
                if (dia === selectedDay) {
                  cell.classList.add('selected'); // Clase para el día seleccionado
                }
                // Asignamos el evento de clic usando el valor capturado 'dia'
                cell.onclick = (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  selectedDay = dia; // Usamos el valor capturado 'dia'
                  const dmy = `${String(selectedDay).padStart(2, '0')}-${String(mes + 1).padStart(2, '0')}-${anio}`;
                  input.value = dmy;

                  calendarDiv.style.display = 'none';
                  renderCharts();
                };
                diaActual++; // Solo incrementamos si hemos renderizado un día
              } else {
                // Celda vacía para los días fuera del mes
                cell.textContent = '';
                cell.style.cursor = 'default';
              }
              row.appendChild(cell);
            }
            calendar.appendChild(row);
            // Si ya no quedan días por mostrar, dejamos de crear filas
            if (diaActual > diasEnMes) break;
          }
          calendarDiv.appendChild(calendar);
        }
        renderCalendar();
        // Cerrar si se hace click fuera
        function handleClickOutside(e) {
          if (!calendarDiv.contains(e.target) && e.target !== input) {
            // Al cerrar, siempre forzar el input a un valor válido del mes mostrado
            const diasEnMes = new Date(anio, mes+1, 0).getDate();
            if (selectedDay > diasEnMes) selectedDay = diasEnMes;
            input.value = `${String(selectedDay).padStart(2,'0')}-${String(mes+1).padStart(2,'0')}-${anio}`;

            calendarDiv.style.display = 'none';
            document.removeEventListener('mousedown', handleClickOutside);
          }
        }
        setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
      }
    }
    // Solo calendario, no escritura manual
    filtroFechaDesde.setAttribute('readonly', 'readonly');
    filtroFechaHasta.setAttribute('readonly', 'readonly');
    filtroFechaDesde.addEventListener('click', showCalendar(filtroFechaDesde, 'calendar-picker-desde'));
    filtroFechaHasta.addEventListener('click', showCalendar(filtroFechaHasta, 'calendar-picker-hasta'));
  }
  if (btnActualizarGraficos) {
    btnActualizarGraficos.addEventListener('click', () => {
      renderCharts();
    });
  }

// Lógica de gráficos
let charts = {};
async function renderCharts() {

  const res = await fetch('https://semaforo-sync.onrender.com/api/sync-metrics');
  const { all, last, consolidated } = await res.json();
  if (!Array.isArray(all) || all.length === 0) return;

  // Filtrar por rango de fechas seleccionadas (formato dd-mm-yyyy)
  let datosFiltrados = all;
  if (filtroFechaDesde && filtroFechaHasta && filtroFechaDesde.value && filtroFechaHasta.value) {
    const desdeYMD = parseDMYtoYMD(filtroFechaDesde.value);
    const hastaYMD = parseDMYtoYMD(filtroFechaHasta.value);
    datosFiltrados = all.filter(d => {
      const fecha = d.timestamp ? d.timestamp.split('T')[0] : '';
      return fecha >= desdeYMD && fecha <= hastaYMD;
    });
  }

  // --- Cálculo del promedio de tiempo de procesamiento por ID ---
  // Mapeo: id -> [primer timestamp, último timestamp]
  const idTiempos = {};
  datosFiltrados.forEach(entry => {
    if (Array.isArray(entry.registros)) {
      entry.registros.forEach(r => {
        if (!idTiempos[r.id]) idTiempos[r.id] = { first: entry.timestamp, last: entry.timestamp, status: entry.status };
        else idTiempos[r.id].last = entry.timestamp;
        idTiempos[r.id].status = entry.status;
      });
    }
  });
  // Solo IDs que ya no están en la última muestra de not_processed ni failed (procesados)
  const idsProcesados = Object.values(idTiempos).filter(obj => obj.status !== 'not_processed' && obj.status !== 'failed');
  // Si no hay IDs procesados, usar todos los que tengan más de un timestamp
  const tiempos = idsProcesados.length > 0 ? idsProcesados : Object.values(idTiempos).filter(obj => obj.first !== obj.last);
  const promediosMs = tiempos.map(obj => new Date(obj.last) - new Date(obj.first)).filter(ms => ms > 0);
  const promedioMs = promediosMs.length > 0 ? promediosMs.reduce((a,b) => a+b,0) / promediosMs.length : 0;
  const promedioSeg = (promedioMs/1000).toFixed(1);
  // Mostrar el promedio arriba de los gráficos
  let infoPromedio = document.getElementById('info-promedio-tiempo');
  if (!infoPromedio) {
    infoPromedio = document.createElement('div');
    infoPromedio.id = 'info-promedio-tiempo';
    infoPromedio.style = 'margin-bottom:12px;font-weight:bold;font-size:1.1rem;color:#2563eb;text-align:center;';
    document.getElementById('charts-container').parentElement.insertBefore(infoPromedio, document.getElementById('charts-container'));
  }
  infoPromedio.textContent = `⏱️ Promedio de tiempo de procesamiento por ID: ${promedioSeg} segundos`;

  // --- Gráfico 1: Flujo de registros (agrupado en intervalos de 5 minutos) ---
  // Agrupar por intervalos de 5 minutos
  function get5MinKey(date) {
    const d = new Date(date);
    d.setSeconds(0,0);
    d.setMinutes(Math.floor(d.getMinutes()/5)*5);
    return d.toISOString();
  }
  const grouped = {};
  datosFiltrados.forEach(e => {
    const key = get5MinKey(e.timestamp);
    if (!grouped[key]) grouped[key] = { not_processed: 0, failed: 0 };
    if (e.status === 'not_processed') grouped[key].not_processed += e.count;
    if (e.status === 'failed') grouped[key].failed += e.count;
  });
  const sortedKeys = Object.keys(grouped).sort();
  const flujoLabels = sortedKeys.map(k => {
    const d = new Date(k);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const flujoNotProcessed = sortedKeys.map(k => grouped[k].not_processed);
  const flujoFailed = sortedKeys.map(k => grouped[k].failed);
  const flujoCanvas = document.getElementById('chart-flujo');
  if (flujoCanvas) {
    if (charts.flujo) charts.flujo.destroy();
    charts.flujo = new Chart(flujoCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: flujoLabels,
        datasets: [
          { label: 'No procesados', data: flujoNotProcessed, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, borderWidth: 3, pointRadius: 4 },
          { label: 'Fallidos', data: flujoFailed, borderColor: '#ff6565', backgroundColor: 'rgba(255,101,101,0.1)', fill: true, borderWidth: 3, pointRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 18, weight: 'bold' } } }
        },
        scales: {
          x: { title: { display: true, text: 'Hora (intervalos de 5 min)', font: { size: 18, weight: 'bold' } }, ticks: { font: { size: 14 } } },
          y: { title: { display: true, text: 'Cantidad', font: { size: 18, weight: 'bold' } }, ticks: { font: { size: 14 } } }
        }
      }
    });
  }

  // --- Gráfico 2: Operador con más registros (solo consolidado) ---
  // Consolidado global - TABLA DE OPERADORES
  if (consolidated && consolidated.not_processed) {
    // Tomar no procesados y fallidos por operador
    const notProcessed = consolidated.not_processed.operatorCounts || {};
    const failed = (consolidated.failed && consolidated.failed.operatorCounts) ? consolidated.failed.operatorCounts : {};
    // Unir todos los operadores
    const allOps = new Set([...Object.keys(notProcessed), ...Object.keys(failed)]);
    // Construir array de operadores con ambos valores
    const opsArr = Array.from(allOps).map(op => ({
      op,
      notProcessed: notProcessed[op] || 0,
      failed: failed[op] || 0,
      total: (notProcessed[op] || 0) + (failed[op] || 0)
    }));
    // Ordenar por total descendente
    opsArr.sort((a, b) => b.total - a.total);
    let tablaOps = document.getElementById('tabla-operadores');
    if (!tablaOps) {
      tablaOps = document.createElement('table');
      tablaOps.id = 'tabla-operadores';
      tablaOps.style = 'margin:32px auto 0 auto; border-collapse:collapse; font-size:1.1rem; min-width:400px; background:#fff; box-shadow:0 2px 8px #0001; text-align:center;';
      // Wrapper centrado
      let wrapper = document.getElementById('tabla-operadores-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'tabla-operadores-wrapper';
        wrapper.style = 'width:100%; display:flex; justify-content:center; align-items:center;';
        document.getElementById('charts-container').parentElement.appendChild(wrapper);
      }
      wrapper.appendChild(tablaOps);
    }
    tablaOps.innerHTML = '';
    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr style=\"background:#fd7e14;color:#fff;\"><th style=\"padding:8px 16px;text-align:center;\">Operador</th><th style=\"padding:8px 16px;text-align:center;\">No procesados</th><th style=\"padding:8px 16px;text-align:center;\">Fallidos</th><th style=\"padding:8px 16px;text-align:center;\">Total</th></tr>`;
    tablaOps.appendChild(thead);
    // Body
    const tbody = document.createElement('tbody');
    opsArr.forEach((row, idx) => {
      tbody.innerHTML += `<tr style='background:${idx%2===0?'#f8fbff':'#fff'};'><td style='padding:6px 12px;text-align:center;'>${row.op}</td><td style='padding:6px 12px;text-align:center;'>${row.notProcessed}</td><td style='padding:6px 12px;text-align:center;color:#ff6565;'>${row.failed}</td><td style='padding:6px 12px;text-align:center;font-weight:bold;'>${row.total}</td></tr>`;
    });
    tablaOps.appendChild(tbody);
  }



  // --- Tabla de acciones (action_name) ---
  // Agrupa y cuenta por action_name y status
  let actionCounts = {};
  datosFiltrados.forEach(entry => {
    if (Array.isArray(entry.registros)) {
      entry.registros.forEach(r => {
        const action = r.action_name || 'Desconocido';
        const status = entry.status || 'unknown';
        if (!actionCounts[action]) actionCounts[action] = { processed: 0, failed: 0, not_processed: 0 };
        if (status === 'failed') actionCounts[action].failed++;
        else if (status === 'not_processed') actionCounts[action].not_processed++;
        else actionCounts[action].processed++;
      });
    }
  });
  // Ordenar por total de ocurrencias (más consultados arriba)
  const sortedActions = Object.entries(actionCounts).sort((a, b) => (b[1].processed + b[1].failed + b[1].not_processed) - (a[1].processed + a[1].failed + a[1].not_processed));
    let tabla = document.getElementById('tabla-actions');
    if (!tabla) {
      tabla = document.createElement('table');
      tabla.id = 'tabla-actions';
      tabla.style = 'margin:32px auto 0 auto; border-collapse:collapse; font-size:1.1rem; min-width:400px; background:#fff; box-shadow:0 2px 8px #0001; text-align:center;';
      const container = document.getElementById('charts-container');
      // Crea un wrapper centrado si no existe
      let wrapper = document.getElementById('tabla-actions-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'tabla-actions-wrapper';
        wrapper.style = 'width:100%; display:flex; justify-content:center; align-items:center;';
        container.parentElement.appendChild(wrapper);
      }
      wrapper.appendChild(tabla);
    }
    tabla.innerHTML = '';
    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr style="background:#ff6565;color:#fff;"><th style="padding:8px 16px;text-align:center;">Acción</th><th style="padding:8px 16px;text-align:center;">No procesados</th><th style="padding:8px 16px;text-align:center;">Fallidos</th><th style="padding:8px 16px;text-align:center;">Total</th></tr>`;
    tabla.appendChild(thead);
    // Body
    const tbody = document.createElement('tbody');
    sortedActions.forEach(([action, counts], idx) => {
      const total = counts.failed + counts.not_processed;
      tbody.innerHTML += `<tr style='background:${idx%2===0?'#f8fbff':'#fff'};'><td style='padding:6px 12px;text-align:center;'>${action}</td><td style='padding:6px 12px;text-align:center;'>${counts.not_processed}</td><td style='padding:6px 12px;text-align:center;color:#ff6565;'>${counts.failed}</td><td style='padding:6px 12px;text-align:center;font-weight:bold;'>${total}</td></tr>`;
    });
    tabla.appendChild(tbody);
}
