import express from 'express';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import cron from 'node-cron';
import cors from 'cors';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PATH = path.resolve(__dirname, '../');
app.use(express.static(FRONTEND_PATH));
app.use(cors());
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.resolve('./sync-metrics.json');

// Configuración de las APIs a consultar
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

async function fetchAndStoreStatus(status) {
  const url = `${API_BASE}status=${status}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const audits = (data && data.data && Array.isArray(data.data.audits)) ? data.data.audits : [];
    // IDs únicos
    const uniqueIds = new Set();
    const uniqueAudits = [];
    audits.forEach(item => {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        uniqueAudits.push(item);
      }
    });
    const entry = {
      status,
      count: uniqueAudits.length,
      operatorCounts: countByOperator(uniqueAudits),
      timestamp: new Date().toISOString(),
      registros: uniqueAudits.map(item => ({
        id: item.id,
        operador: item.travel_name || 'Sin operador',
        accion: item.action || '',
        sistema: item.system || '',
        ...item
      }))
    };
    let fileData = [];
    if (fs.existsSync(DATA_FILE)) {
      try {
        fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      } catch {}
    }
    fileData.push(entry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));
    console.log(`[${entry.timestamp}] Guardado status '${status}' (${uniqueAudits.length} ids únicos)`);
  } catch (err) {
    console.error(`Error consultando status '${status}':`, err.message);
  }
}

function countByOperator(audits) {
  const counts = {};
  const seen = new Set();
  audits.forEach(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      const name = item.travel_name || 'Sin operador';
      counts[name] = (counts[name] || 0) + 1;
    }
  });
  return counts;
}

// Cron: cada 10 segundos consulta ambos endpoints y almacena los datos
cron.schedule('*/10 * * * * *', async () => {
  await fetchAndStoreStatus('not_processed');
  await fetchAndStoreStatus('failed');
});

app.use(express.json());

// Endpoint para guardar datos
app.post('/api/sync-metrics', (req, res) => {
  const newEntry = req.body;
  let data = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: 'Error leyendo el archivo de datos.' });
    }
  }
  data.push({ ...newEntry, timestamp: new Date().toISOString() });
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.status(201).json({ message: 'Guardado correctamente.' });
  } catch (e) {
    res.status(500).json({ error: 'Error guardando los datos.' });
  }
});

// Endpoint para consultar los datos
app.get('/api/sync-metrics', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({ all: [], last: null, consolidated: null });
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Última muestra
    const last = data.length > 0 ? data[data.length - 1] : null;
    // Consolidado global
    const consolidated = {
      not_processed: { count: 0, operatorCounts: {}, sistemaCounts: {} },
      failed: { count: 0, operatorCounts: {}, sistemaCounts: {} }
    };
    data.forEach(entry => {
      if (!consolidated[entry.status]) return;
      consolidated[entry.status].count += entry.count;
      // Consolidar por operador
      for (const op in entry.operatorCounts) {
        consolidated[entry.status].operatorCounts[op] = (consolidated[entry.status].operatorCounts[op] || 0) + entry.operatorCounts[op];
      }
      // Consolidar por sistema
      if (Array.isArray(entry.registros)) {
        entry.registros.forEach(r => {
          const sistema = r.sistema || 'Desconocido';
          consolidated[entry.status].sistemaCounts[sistema] = (consolidated[entry.status].sistemaCounts[sistema] || 0) + 1;
        });
      }
    });
    res.json({ all: data, last, consolidated });
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo el archivo de datos.' });
  }
});


// Endpoint para consultar el estado de la cola
app.get('/api/queue-status', async (req, res) => {
  try {
    const response = await fetch('https://gds.kupos.com/api/v2/konnect_gds_sync/get_queue_size', {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyMyIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc1NTY0ODM2OCwiZXhwIjoxNzcxNDI2ODQ0LCJqdGkiOiJhNDMzMTcxZC04NDZmLTQyZjQtYWY4Mi1hY2JhNThhZTgxMmQifQ.V_fOV0JQZzhej9DLc-CszSm8V_bRaWUIvjVrvzfYUhk',
        'if-none-match': 'W/"bcda68186620a8d4024290c11299c4de"',
        'origin': 'https://gdsdashboard.kupos.com',
        'priority': 'u=1, i',
        'referer': 'https://gdsdashboard.kupos.com/',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'Cookie': '_kp_gds_session=Z11ONS95ebhTQ1sASXKVqxpwwCvWYLHt1wgRXzP6gl9sYUESDBqI7zwksnHMINJ0w7D2Z%2BYvdkDE7mlIY8%2BXq94L4ysuLPHENjtmSVtWGT1KuHGAQv2nH8rbVwUN6T5eAuxg74sKr1SL%2BwA9Vw5AbpGS4teyYCMdVwOXgzP4QCMY1tLLaibd--GFNIcehdvzvI7dB4--qCWX%2FXtoy6BSPwi1ZAGd0A%3D%3D; _kp_gds_session=F0uTNUcnkkGTivFhs5nLVauVqfTZWzc270V%2BilwMN4kxUJ8hT%2F9vK4PRX3IISKarDnwKphlbiDqhDFo5wRaiIQLwpde26yIUeKCWf3c1XuW5R2GMWA1KX3E6Ud0gceZ5MCMp%2FbU1FdGlL4%2BIwl3KiJdIUUKhz6QMBhnXfM7PAG6sNBt6BW4Y--rS3tvb%2FFm4V%2FaUyi--4JDl6%2BxoMO5aiWZDEke0TQ%3D%3D'
      },
      method: 'GET',
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error consultando el estado de la cola', details: err.message });
  }
});


// Endpoint para limpiar la cola
app.post('/api/clear-queue', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'No se recibieron IDs para limpiar.' });
    }
    const response = await fetch('https://gds.kupos.com/api/v2/konnect_gds_sync/retrigger_cron_async', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyMyIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc1NTY0ODM2OCwiZXhwIjoxNzcxNDI2ODQ0LCJqdGkiOiJhNDMzMTcxZC04NDZmLTQyZjQtYWY4Mi1hY2JhNThhZTgxMmQifQ.V_fOV0JQZzhej9DLc-CszSm8V_bRaWUIvjVrvzfYUhk',
        'Content-Type': 'application/json',
        'Cookie': '_kp_gds_session=G26x4vCBxg3KBWqp%2BaEyaLzDLnnE6BBj%2BVJtNNFpYvzfjgAnbLIH9%2FN3%2FBWEN%2FA8y6Cvd2rAd2Xms5Ud7C%2B5wgZqop%2BBEryZyZqCkYwWT8Eno6oSMJSJMXZlMp5a90RGgzt23Qp%2FKyWvBqegooteZzXrgqCLLvYfO90NP6BBLmaYgMPgkZu4--oZHdverjA7IjVCd%2B--MEEvRYwN7t1HGQqaYZDz8A%3D%3D'
      },
      body: JSON.stringify({ ids })
    });
    const result = await response.json();
    if (response.ok) {
      res.json({ success: true, result });
    } else {
      res.status(500).json({ success: false, message: 'Error al limpiar la cola', details: result });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al limpiar la cola', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
// Endpoint seguro para obtener audits filtrados por status
app.get('/api/audits', async (req, res) => {
  const status = req.query.status;
  if (!status) return res.status(400).json({ error: 'Falta parámetro status' });
  try {
    const url = `${API_BASE}status=${status}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error('Error consultando audits');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error consultando audits', details: err.message });
  }
});

// Endpoint seguro para resync de un audit
app.post('/api/resync', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta id' });
  try {
    const response = await fetch('https://gds.kupos.com/api/v2/konnect_gds_sync/retrigger_sync', {
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
      body: JSON.stringify({ id })
    });
    const result = await response.json();
    if (response.ok) {
      res.json({ success: true, result });
    } else {
      res.status(500).json({ success: false, message: 'Error al hacer resync', details: result });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al hacer resync', details: err.message });
  }
});