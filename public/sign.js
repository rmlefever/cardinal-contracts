const params = new URLSearchParams(location.search);
const token = params.get('token');
const message = document.getElementById('message');
const signer = document.getElementById('signer');
const form = document.getElementById('signForm');
const pdfFrame = document.getElementById('pdfFrame');

const state = { payload: null, values: {} };

async function load() {
  const res = await fetch(`/api/sign/${token}`);
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.message || payload.error || 'Contract not found');
  state.payload = payload;
  state.values = payload.values || {};
  pdfFrame.src = `/uploads/${payload.template.pdf_path.split('/').pop()}`;
  renderForm();
  message.classList.add('hidden');
  signer.classList.remove('hidden');
}

function renderForm() {
  const fields = state.payload.template.fields;
  form.innerHTML = `
    <h2>${state.payload.contract.patient_name}</h2>
    ${fields.map((field) => fieldHtml(field)).join('')}
    <button type="submit">Complete Signing</button>
  `;
  fields.filter((field) => field.type === 'signature').forEach(setupSignature);
}

function fieldHtml(field) {
  const value = state.values[field.id] || '';
  if (field.type === 'signature') {
    return `<label>${field.label}<canvas class="sig-pad" data-signature="${field.id}"></canvas><button type="button" class="secondary" data-clear="${field.id}">Clear</button></label>`;
  }
  if (field.type === 'checkbox') {
    return `<label><input type="checkbox" name="${field.id}" ${value ? 'checked' : ''}>${field.label}</label>`;
  }
  return `<label>${field.label}<input name="${field.id}" type="${field.type === 'date' ? 'date' : 'text'}" value="${escapeAttr(value)}" ${field.required ? 'required' : ''}></label>`;
}

function setupSignature(field) {
  const canvas = document.querySelector(`[data-signature="${field.id}"]`);
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  let drawing = false;
  let wrote = false;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    wrote = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  window.addEventListener('pointerup', () => {
    drawing = false;
    if (wrote) state.values[field.id] = canvas.toDataURL('image/png');
  });
  document.querySelector(`[data-clear="${field.id}"]`).addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    delete state.values[field.id];
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = { ...state.values };
  for (const [key, value] of new FormData(form).entries()) values[key] = value.toString();
  form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked ? 'true' : ''; });
  const res = await fetch(`/api/sign/${token}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  const body = await res.json();
  if (!res.ok) return alert(body.message || body.error || 'Unable to complete signing');
  signer.classList.add('hidden');
  message.classList.remove('hidden');
  message.innerHTML = `<strong>Signed.</strong><br>The completed PDF has been stored.`;
});

function escapeAttr(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] || char);
}

load().catch((error) => {
  message.textContent = error.message;
  message.classList.add('error');
});
