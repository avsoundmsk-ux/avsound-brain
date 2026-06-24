// Frontend логика генератора Nano Banana.
const $ = (s) => document.querySelector(s);
let mode = 'generate';
let selectedFile = null;

const els = {
  prompt: $('#prompt'), genBtn: $('#genBtn'), status: $('#status'),
  resultBox: $('#resultBox'), downloadBtn: $('#downloadBtn'),
  imageInput: $('#imageInput'), thumb: $('#thumb'), dropZone: $('#dropZone'),
  historyGrid: $('#historyGrid'), modelBadge: $('#modelBadge'), uploadLabel: $('#uploadLabel'),
};

// --- табы ---
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    mode = t.dataset.mode;
    els.genBtn.textContent = mode === 'edit' ? 'Редактировать' : 'Сгенерировать';
    els.uploadLabel.textContent = mode === 'edit' ? 'Фото для редактирования (обязательно)' : 'Исходное фото (опционально)';
  });
});

// --- загрузка фото ---
function setFile(file) {
  selectedFile = file;
  if (!file) { els.thumb.classList.remove('has-img'); els.thumb.style.backgroundImage = ''; els.thumb.textContent = 'Перетащи фото или нажми'; return; }
  const url = URL.createObjectURL(file);
  els.thumb.classList.add('has-img');
  els.thumb.style.backgroundImage = `url(${url})`;
}
els.thumb.addEventListener('click', () => els.imageInput.click());
els.imageInput.addEventListener('change', (e) => setFile(e.target.files[0]));
['dragover', 'dragenter'].forEach((ev) => els.dropZone.addEventListener(ev, (e) => { e.preventDefault(); els.dropZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) => els.dropZone.addEventListener(ev, (e) => { e.preventDefault(); els.dropZone.classList.remove('dragover'); }));
els.dropZone.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });

// --- статус ---
function setStatus(text, cls = '') { els.status.className = `status ${cls}`; els.status.innerHTML = cls === 'load' ? `<span class="spinner"></span>${text}` : text; }

// --- генерация ---
els.genBtn.addEventListener('click', async () => {
  const prompt = els.prompt.value.trim();
  if (!prompt && mode === 'generate') return setStatus('Введите промпт', 'err');
  if (mode === 'edit' && !selectedFile) return setStatus('Для редактирования загрузите фото', 'err');

  els.genBtn.disabled = true;
  setStatus('Генерирую… это занимает несколько секунд', 'load');

  const fd = new FormData();
  fd.append('prompt', prompt);
  if (selectedFile) fd.append('image', selectedFile);

  try {
    const res = await fetch(`/api/${mode}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка генерации');
    showResult(data);
    setStatus('Готово ✓', 'ok');
    loadHistory();
  } catch (err) {
    setStatus(err.message, 'err');
  } finally {
    els.genBtn.disabled = false;
  }
});

function showResult(entry) {
  els.resultBox.innerHTML = `<img src="${entry.url}" alt="result" />`;
  els.downloadBtn.href = entry.url;
  els.downloadBtn.download = entry.file;
  els.downloadBtn.hidden = false;
}

// --- история ---
async function loadHistory() {
  try {
    const list = await (await fetch('/api/history')).json();
    els.historyGrid.innerHTML = list.map((e) =>
      `<div class="card" data-url="${e.url}" data-file="${e.file}"><img src="${e.url}" loading="lazy"/><span>${(e.prompt || '').slice(0, 40)}</span></div>`
    ).join('');
    els.historyGrid.querySelectorAll('.card').forEach((c) =>
      c.addEventListener('click', () => showResult({ url: c.dataset.url, file: c.dataset.file })));
  } catch { /* история не критична */ }
}

// --- init ---
(async () => {
  try {
    const cfg = await (await fetch('/api/config')).json();
    els.modelBadge.textContent = cfg.model + (cfg.hasKey ? '' : ' ⚠ нет ключа');
  } catch { els.modelBadge.textContent = '—'; }
  loadHistory();
})();
