import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

const state = { clinics: [], templates: [], selected: null, pdf: null, page: 1, fields: [], scale: 1.2 };
const $ = (id) => document.getElementById(id);

$('adminToken').value = localStorage.getItem('cardinalAdminToken') || '';
$('adminToken').addEventListener('change', async () => {
  localStorage.setItem('cardinalAdminToken', $('adminToken').value);
  await loadClinics();
  await loadTemplates();
});

function headers() {
  return { Authorization: `Bearer ${$('adminToken').value}`, 'Content-Type': 'application/json' };
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || res.statusText);
  return body;
}

document.querySelectorAll('.nav button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav button').forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    ['templates', 'send', 'contracts'].forEach((id) => $(id).classList.toggle('hidden', id !== button.dataset.tab));
    if (button.dataset.tab === 'contracts') loadContracts();
    if (button.dataset.tab === 'send') loadTemplates();
  });
});

async function loadClinics() {
  state.clinics = await api('/api/clinics', { headers: headers() });
  const options = state.clinics.map((clinic) => `<option value="${clinic.id}">${clinic.name}</option>`).join('');
  $('clinicFilter').innerHTML = options;
  $('uploadClinic').innerHTML = options;
  $('sendClinic').innerHTML = options;
  $('clinicFilter').value = 'clinic_cardinal';
  $('uploadClinic').value = $('clinicFilter').value;
  $('sendClinic').value = $('clinicFilter').value;
}

function selectedClinicId() {
  return $('clinicFilter').value || state.clinics[0]?.id || '';
}

async function loadTemplates() {
  const clinicId = selectedClinicId();
  state.templates = await api(`/api/templates?clinicId=${encodeURIComponent(clinicId)}`, { headers: headers() });
  $('templateList').innerHTML = state.templates.map((t) => `
    <div class="row">
      <div><strong>${t.name}</strong><br><span class="muted">${t.fields.length} fields</span></div>
      <div><span class="status">${t.status}</span> <button class="secondary" data-edit="${t.id}">Edit</button></div>
    </div>
  `).join('') || '<p class="muted">No templates yet.</p>';

  $('templateSelect').innerHTML = state.templates.filter((t) => t.status === 'active')
    .map((t) => `<option value="${t.id}">${t.name}</option>`).join('');

  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openDesigner(button.dataset.edit)));
}

$('clinicFilter').addEventListener('change', async () => {
  $('uploadClinic').value = selectedClinicId();
  $('sendClinic').value = selectedClinicId();
  await loadTemplates();
  await loadContracts();
});

$('sendClinic').addEventListener('change', async () => {
  $('clinicFilter').value = $('sendClinic').value;
  await loadTemplates();
});

$('uploadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const res = await fetch('/api/templates/upload', { method: 'POST', headers: { Authorization: `Bearer ${$('adminToken').value}` }, body: form });
  if (!res.ok) return alert(await res.text());
  const template = await res.json();
  await loadTemplates();
  openDesigner(template.id);
});

async function openDesigner(id) {
  state.selected = state.templates.find((t) => t.id === id);
  state.fields = structuredClone(state.selected.fields);
  state.page = Math.max(1, state.fields[0]?.page || 1);
  $('designer').classList.remove('hidden');
  $('designerTitle').textContent = state.selected.name;
  state.pdf = await pdfjsLib.getDocument(`/uploads/${state.selected.pdf_path.split('/').pop()}`).promise;
  renderPage();
}

async function renderPage() {
  const page = await state.pdf.getPage(state.page);
  const viewport = page.getViewport({ scale: state.scale });
  const canvas = $('pdfCanvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  renderFields();
}

function renderFields() {
  document.querySelectorAll('.field-box').forEach((node) => node.remove());
  const stage = $('pdfStage');
  const canvas = $('pdfCanvas');
  for (const field of state.fields.filter((f) => f.page === state.page)) {
    const box = document.createElement('div');
    box.className = `field-box ${field.type}`;
    box.style.left = `${field.x * canvas.width}px`;
    box.style.top = `${field.y * canvas.height}px`;
    box.style.width = `${field.w * canvas.width}px`;
    box.style.height = `${field.h * canvas.height}px`;
    box.innerHTML = `<span class="field-label">${field.label}</span>`;
    box.addEventListener('pointerdown', (event) => dragField(event, field));
    stage.appendChild(box);
  }
  $('fieldList').innerHTML = state.fields.map((field) => `
    <div class="row">
      <div><strong>${field.label}</strong><br><span class="muted">Page ${field.page} · ${field.type}</span></div>
      <button class="secondary" data-delete="${field.id}">Remove</button>
    </div>
  `).join('');
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => {
    state.fields = state.fields.filter((field) => field.id !== button.dataset.delete);
    renderFields();
  }));
}

function dragField(event, field) {
  const canvas = $('pdfCanvas');
  const startX = event.clientX;
  const startY = event.clientY;
  const initial = { x: field.x, y: field.y };
  event.currentTarget.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    field.x = Math.max(0, Math.min(0.98, initial.x + (moveEvent.clientX - startX) / canvas.width));
    field.y = Math.max(0, Math.min(0.98, initial.y + (moveEvent.clientY - startY) / canvas.height));
    renderFields();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

$('addField').addEventListener('click', (event) => {
  event.preventDefault();
  const type = $('fieldType').value;
  state.fields.push({
    id: `fld_${crypto.randomUUID().slice(0, 8)}`,
    label: $('fieldLabel').value,
    type,
    required: true,
    source: $('fieldSource').value,
    page: state.page,
    x: 0.28,
    y: 0.72,
    w: type === 'signature' ? 0.34 : 0.28,
    h: type === 'signature' ? 0.06 : 0.032
  });
  renderFields();
});

$('prevPage').addEventListener('click', (event) => {
  event.preventDefault();
  state.page = Math.max(1, state.page - 1);
  renderPage();
});

$('nextPage').addEventListener('click', (event) => {
  event.preventDefault();
  state.page = Math.min(state.pdf.numPages, state.page + 1);
  renderPage();
});

$('saveFields').addEventListener('click', async (event) => {
  event.preventDefault();
  await api(`/api/templates/${state.selected.id}/fields`, { method: 'PUT', headers: headers(), body: JSON.stringify({ fields: state.fields, status: 'active' }) });
  await loadTemplates();
  alert('Template activated.');
});

$('sendForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const result = await api('/api/contracts', { method: 'POST', headers: headers(), body: JSON.stringify(values) });
  $('sendResult').classList.remove('hidden');
  $('sendResult').innerHTML = `<strong>Contract created.</strong><br><a href="${result.signingUrl}" target="_blank">${result.signingUrl}</a><br><span class="muted">Email sent: ${result.email.sent ? 'yes' : 'no'}</span>`;
});

async function loadContracts() {
  const rows = await api(`/api/contracts?clinicId=${encodeURIComponent(selectedClinicId())}`, { headers: headers() });
  $('contractList').innerHTML = rows.map((row) => `
    <div class="row">
      <div><strong>${row.patient_name}</strong><br><span class="muted">${row.payer_email} · ${row.patient_record_id || 'No patient ID'}</span></div>
      <div><span class="status">${row.status}</span>${row.signed_pdf_path ? ` <a href="/storage/${row.signed_pdf_path.split('/').pop()}" target="_blank">PDF</a>` : ''}</div>
    </div>
  `).join('') || '<p class="muted">No contracts yet.</p>';
}

loadClinics().then(loadTemplates).catch((error) => {
  $('templateList').innerHTML = `<p class="error">${error.message}</p>`;
});
