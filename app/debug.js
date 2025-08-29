// Diagnóstico simple para debug
window.addEventListener('DOMContentLoaded', () => {
  const debug = document.createElement('pre');
  debug.id = 'debug-log';
  debug.style.background = '#222';
  debug.style.color = '#fff';
  debug.style.padding = '8px';
  debug.style.fontSize = '0.9em';
  debug.style.maxHeight = '200px';
  debug.style.overflow = 'auto';
  debug.textContent = 'Debug log:';
  document.body.appendChild(debug);
});

function logDebug(msg) {
  const debug = document.getElementById('debug-log');
  if (debug) debug.textContent += '\n' + msg;
}

// ...existing code...
