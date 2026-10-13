const STORAGE_KEY = 'xist-opportunities-v1';

const starterOpportunities = [];

let opportunities = loadOpportunities();
let activeView = 'all';
let stageFilterIndex = 0;
let toastTimer;
const stageFilters = ['All stages', 'Discover', 'Qualify', 'Follow up', 'Finalize', 'Won'];
const listElement = document.getElementById('opportunity-list');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('lead-modal');
const form = document.getElementById('lead-form');

function loadOpportunities() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn('Could not load saved opportunities.', error);
  }
  return starterOpportunities.map(item => ({ ...item }));
}

function saveOpportunities() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
  } catch (error) {
    showToast('Your browser could not save this update.');
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function stageClass(stage) {
  return `stage-${stage.toLowerCase().replace(/\s+/g, '-')}`;
}

function visibleOpportunities() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStage = stageFilters[stageFilterIndex];
  return opportunities.filter(item => {
    const matchesView = activeView === 'all' || (activeView === 'active' && item.stage !== 'Won') || (activeView === 'won' && item.stage === 'Won');
    const matchesStage = selectedStage === 'All stages' || item.stage === selectedStage;
    const matchesSearch = !query || `${item.name} ${item.company} ${item.stage} ${item.nextStep}`.toLowerCase().includes(query);
    return matchesView && matchesStage && matchesSearch;
  });
}

function renderRows() {
  const visible = visibleOpportunities();
  listElement.innerHTML = visible.map(item => `
    <tr>
      <td><div class="lead-cell"><div class="lead-avatar" style="background:${escapeHtml(item.color || '#e9eee8')};color:${escapeHtml(item.ink || '#607864')}">${escapeHtml(item.initials || item.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase())}</div><div class="lead-copy"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.company)}</span></div></div></td>
      <td><span class="stage-pill ${stageClass(item.stage)}">${escapeHtml(item.stage)}</span></td>
      <td class="value-cell">${money(item.value)}</td>
      <td><span class="next-step">${escapeHtml(item.nextStep || 'Choose a next step')}</span></td>
      <td class="row-actions"><button class="row-more" aria-label="Actions for ${escapeHtml(item.name)}" data-action="menu" data-id="${escapeHtml(item.id)}">···</button></td>
    </tr>`).join('');
  document.getElementById('empty-state').hidden = visible.length !== 0;
  document.querySelector('.pipeline-table').hidden = visible.length === 0;
  document.getElementById('showing-count').textContent = visible.length;
}

function renderFollowups() {
  const upcoming = opportunities.filter(item => item.due && item.stage !== 'Won').slice(0, 3);
  document.getElementById('followup-count').textContent = `${upcoming.length} follow-up${upcoming.length === 1 ? '' : 's'}`;
  document.getElementById('up-next-count').textContent = upcoming.length;
  const container = document.getElementById('followup-list');
  if (!upcoming.length) {
    container.innerHTML = '<div class="empty-state" style="min-height:120px"><div>✓</div><strong>You are all caught up</strong><span>New follow-ups will show up here.</span></div>';
    return;
  }
  container.innerHTML = upcoming.map(item => `
    <div class="followup-item">
      <div class="followup-date"><strong>${item.due === 'Today' ? 'Now' : item.due === 'Tomorrow' ? 'Tmr' : 'Next'}</strong><span>${item.due === 'Today' ? 'Today' : item.due === 'Tomorrow' ? 'Day' : escapeHtml(item.due)}</span></div>
      <div class="followup-copy"><strong>${escapeHtml(item.nextStep || 'Plan your next step')}</strong><span>${escapeHtml(item.name)} · ${escapeHtml(item.company)}</span></div>
      <button class="complete-button" data-action="complete" data-id="${escapeHtml(item.id)}" aria-label="Complete follow-up for ${escapeHtml(item.name)}">✓</button>
    </div>`).join('');
}

function renderMetrics() {
  const active = opportunities.filter(item => item.stage !== 'Won');
  const total = active.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  document.getElementById('pipeline-value').textContent = money(total);
  document.getElementById('active-count').textContent = active.length;
  document.getElementById('nav-count').textContent = active.length;
  document.getElementById('all-tab-count').textContent = opportunities.length;
}

function render() {
  renderMetrics();
  renderRows();
  renderFollowups();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function openModal() {
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => form.elements.name.focus(), 30);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

function advanceStage(item) {
  const stages = ['Discover', 'Qualify', 'Follow up', 'Finalize', 'Won'];
  const index = stages.indexOf(item.stage);
  item.stage = stages[Math.min(index + 1, stages.length - 1)];
  if (item.stage === 'Won') item.due = '';
  saveOpportunities();
  render();
  showToast(item.stage === 'Won' ? `${item.company} finalized — nice work!` : `${item.company} moved to ${item.stage}.`);
}

function handleRowAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const item = opportunities.find(opportunity => opportunity.id === button.dataset.id);
  if (!item) return;
  const action = button.dataset.action;
  if (action === 'menu') {
    document.querySelectorAll('.row-menu').forEach(menu => menu.remove());
    const menu = document.createElement('div');
    menu.className = 'row-menu';
    menu.innerHTML = `<button data-action="advance" data-id="${escapeHtml(item.id)}">Move to next stage →</button><button data-action="won" data-id="${escapeHtml(item.id)}">Mark as won ✦</button><button class="delete-action" data-action="delete" data-id="${escapeHtml(item.id)}">Remove opportunity</button>`;
    button.parentElement.appendChild(menu);
    return;
  }
  if (action === 'complete') {
    item.due = '';
    saveOpportunities();
    render();
    showToast('Follow-up done. Keep that momentum going.');
  } else if (action === 'advance') {
    advanceStage(item);
  } else if (action === 'won') {
    item.stage = 'Won';
    item.due = '';
    saveOpportunities();
    render();
    showToast(`${item.company} finalized — nice work!`);
  } else if (action === 'delete') {
    opportunities = opportunities.filter(opportunity => opportunity.id !== item.id);
    saveOpportunities();
    render();
    showToast('Opportunity removed.');
  }
}

function addOpportunity(event) {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const company = String(data.get('company')).trim();
  const palette = [
    ['#f3e9dc', '#9c7547'], ['#e8edf5', '#637b9d'], ['#f3e8e8', '#a66d75'], ['#e7eee5', '#688263'], ['#eee8f4', '#866c9d'], ['#e7f0f0', '#5c8882']
  ];
  const [color, ink] = palette[Math.floor(Math.random() * palette.length)];
  const item = {
    id: `lead-${Date.now()}`,
    name,
    company,
    initials: name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    color,
    ink,
    stage: data.get('stage'),
    value: Number(data.get('value')),
    nextStep: String(data.get('nextStep') || '').trim() || 'Choose a next step',
    due: String(data.get('nextStep') || '').trim() ? 'Today' : ''
  };
  opportunities.unshift(item);
  saveOpportunities();
  form.reset();
  closeModal();
  activeView = 'all';
  stageFilterIndex = 0;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'all'));
  render();
  showToast(`${company} added. Your next move is ready.`);
}

document.getElementById('add-lead-button').addEventListener('click', openModal);
document.getElementById('add-another-button').addEventListener('click', openModal);
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-modal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
form.addEventListener('submit', addOpportunity);
searchInput.addEventListener('input', renderRows);
listElement.addEventListener('click', handleRowAction);
document.getElementById('followup-list').addEventListener('click', handleRowAction);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeView = tab.dataset.view;
    document.querySelectorAll('.tab').forEach(candidate => candidate.classList.toggle('active', candidate === tab));
    renderRows();
  });
});

document.getElementById('filter-button').addEventListener('click', event => {
  stageFilterIndex = (stageFilterIndex + 1) % stageFilters.length;
  event.currentTarget.title = `Filter: ${stageFilters[stageFilterIndex]}`;
  event.currentTarget.setAttribute('aria-label', `Filter by stage: ${stageFilters[stageFilterIndex]}`);
  renderRows();
  showToast(`Showing ${stageFilters[stageFilterIndex].toLowerCase()}.`);
});

document.getElementById('focus-button').addEventListener('click', () => document.getElementById('follow-ups').scrollIntoView({ behavior: 'smooth', block: 'center' }));
document.getElementById('view-pipeline').addEventListener('click', () => document.getElementById('pipeline').scrollIntoView({ behavior: 'smooth', block: 'start' }));
document.getElementById('all-followups').addEventListener('click', () => {
  activeView = 'active';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'active'));
  document.getElementById('follow-ups').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('Your active follow-ups are ready.');
});
document.getElementById('upgrade-button').addEventListener('click', () => showToast('You are already building great momentum. Pro is coming soon.'));
document.querySelectorAll('.main-nav .nav-item').forEach(link => link.addEventListener('click', () => document.getElementById('sidebar').classList.remove('open')));
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.addEventListener('click', event => {
  if (!event.target.closest('.row-actions')) document.querySelectorAll('.row-menu').forEach(menu => menu.remove());
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeModal();
    document.getElementById('sidebar').classList.remove('open');
    document.querySelectorAll('.row-menu').forEach(menu => menu.remove());
  }
});

const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
document.getElementById('today-label').textContent = today;
render();
