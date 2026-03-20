const STORAGE_KEY = 'newriver_sessions_v2';
const API_KEY_STORAGE = 'newriver_api_key';
const LOAD_MSGS = ['Warming up the drills...','Picking the right exercises...','Building your session plan...','Writing your pre-session form...','Adding coaching cues...','Almost ready...'];
const FOCUS_CLASSES = { Attacking:'sel-atk', Defending:'sel-def', Possession:'sel-pos', Transition:'sel-tra' };
const BORDER_COLORS = { warm:'#f6ad55', tech:'#63b3ed', game:'#fc8181', scrim:'#b794f4', cool:'#f6ad55' };
const BADGE_CLASSES = { Attacking:'badge-atk', Defending:'badge-def', Possession:'badge-pos', Transition:'badge-tra' };

let loadInterval = null;
let currentPlan = null;
let currentPreForm = null;

// ── Init ──
window.onload = () => {
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  const k = localStorage.getItem(API_KEY_STORAGE) || '';
  if (k) document.getElementById('apiKeyInput').value = k;
  else showView('apikey');
  updateSavedCount();
};

// ── View management ──
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (name === 'saved') renderSaved();
}

// ── Tab management ──
function switchTab(tab) {
  document.getElementById('tab-plan').classList.toggle('active', tab === 'plan');
  document.getElementById('tab-form').classList.toggle('active', tab === 'form');
  document.getElementById('result-plan').style.display = tab === 'plan' ? 'block' : 'none';
  document.getElementById('result-form').style.display = tab === 'form' ? 'block' : 'none';
}

// ── Pill selection ──
function selectPill(el, group) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach(p => {
    p.className = 'pill';
  });
  const cls = group === 'focus' ? (FOCUS_CLASSES[el.dataset.val] || 'sel-green') : 'sel-green';
  el.className = 'pill ' + cls;
}

function getSelected(group) {
  const el = document.querySelector(`[data-group="${group}"].pill.sel-atk, [data-group="${group}"].pill.sel-def, [data-group="${group}"].pill.sel-pos, [data-group="${group}"].pill.sel-tra, [data-group="${group}"].pill.sel-green`);
  return el ? el.dataset.val : '';
}

// ── API Key ──
function toggleKeyVis() {
  const inp = document.getElementById('apiKeyInput');
  const btn = document.querySelector('.key-toggle');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}
function saveApiKey() {
  const k = document.getElementById('apiKeyInput').value.trim();
  const err = document.getElementById('keyError');
  if (!k.startsWith('sk-')) { err.style.display='block'; err.textContent="Key should start with 'sk-'. Please check and try again."; return; }
  localStorage.setItem(API_KEY_STORAGE, k);
  err.style.display = 'none';
  showView('form');
}

// ── Loading ──
function startLoading() {
  showView('loading');
  let i = 0;
  document.getElementById('loadMsg').textContent = LOAD_MSGS[0];
  loadInterval = setInterval(() => {
    i = (i + 1) % LOAD_MSGS.length;
    document.getElementById('loadMsg').textContent = LOAD_MSGS[i];
  }, 1800);
}
function stopLoading() { clearInterval(loadInterval); }

// ── Saved sessions ──
function updateSavedCount() {
  const s = getSaved();
  document.getElementById('savedCount').textContent = s.length > 0 ? s.length : '';
}
function getSaved() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveSession(plan, meta) {
  const entry = { id: Date.now(), date: meta.date, age: meta.age, focus: meta.focus, coach: meta.coach, title: plan.sessionTitle, plan, meta };
  const updated = [entry, ...getSaved()].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  updateSavedCount();
}
function deleteSession(id) {
  const updated = getSaved().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  updateSavedCount();
  renderSaved();
}
function renderSaved() {
  const list = document.getElementById('savedList');
  const sessions = getSaved();
  if (!sessions.length) { list.innerHTML = '<div class="card" style="text-align:center;color:#9ca3af;padding:40px">No saved sessions yet.</div>'; return; }
  list.innerHTML = sessions.map(s => {
    const bc = BADGE_CLASSES[s.focus] || 'badge-green';
    return `<div class="saved-card">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${esc(s.title)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            <span class="badge badge-gray">📅 ${esc(s.date)}</span>
            <span class="badge badge-gray">👥 ${esc(s.age)}</span>
            ${s.coach ? `<span class="badge badge-gray">🧑‍🏫 ${esc(s.coach)}</span>` : ''}
            <span class="badge ${bc}">${esc(s.focus)}</span>
          </div>
        </div>
        <button onclick="deleteSession(${s.id})" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:1.1rem;padding:4px">🗑</button>
      </div>
      <button class="btn-primary" onclick="loadSaved(${s.id})">View Session →</button>
    </div>`;
  }).join('');
}
function loadSaved(id) {
  const s = getSaved().find(x => x.id === id);
  if (!s) return;
  currentPlan = s.plan;
  currentPreForm = null;
  renderPlan(s.plan);
  document.getElementById('result-form').innerHTML = '<div class="card" style="text-align:center;color:#9ca3af;padding:40px">Pre-session form only available for newly generated sessions.</div>';
  switchTab('plan');
  showView('result');
}

// ── Generate ──
async function generate() {
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  if (!apiKey) { showView('apikey'); return; }

  const focus  = getSelected('focus') || 'Attacking';
  const diff   = getSelected('diff') || 'Medium';
  const coach  = document.getElementById('fCoach').value.trim();
  const loc    = document.getElementById('fLocation').value.trim();
  const date   = document.getElementById('fDate').value;
  const sesNum = document.getElementById('fSessionNum').value;
  const phase  = document.getElementById('fPhase').value;
  const days   = document.getElementById('fDaysToGame').value;
  const dur    = document.getElementById('fDuration').value;
  const topic  = document.getElementById('fTopic').value.trim();
  const age    = document.getElementById('fAge').value;
  const players= document.getElementById('fPlayers').value;
  const form   = document.getElementById('fFormation').value;
  const skill  = document.getElementById('fSkill').value;
  const notes  = document.getElementById('fNotes').value.trim();

  document.getElementById('formError').style.display = 'none';
  startLoading();

  const prompt = `You are an expert youth soccer coach (UEFA/USSF highest license). Generate a complete training session AND a completed pre-session planning form as strict JSON.

Session details:
- Coach: ${coach || 'Not specified'}
- Date: ${date}
- Location: ${loc}
- Session number this week: ${sesNum} of 3
- Training phase: ${phase}
- Duration: ${dur} minutes
- Days until next game: ${days}
- Session topic: ${topic || 'Not specified — derive from focus'}
- Age group: ${age}
- Number of players: ${players}
- Formation: ${form}
- Skill level: ${skill}
- Primary focus: ${focus}
- Drill difficulty: ${diff}
- Extra notes: ${notes || 'None'}

Club context — Newriver United Soccer:
- Developmental curriculum: improving technical and tactical abilities of the individual within a team setting
- Structured environment where training feeds into match application
- No rigid game model — sessions reflect individual development first, team application second

Rules:
- ${dur}-min plan: warm-up → 2-3 technical drills → 1 game-like activity → scrimmage (if days to game ≥ 2) → cool-down
- If days to game is 1: light session, mostly scrimmage
- All drills relate to: ${focus}
- Match ${age} and ${skill} level
- Video links — use only these real URLs (pick most relevant per drill):
  https://www.soccercoachlab.com/soccer-drills-category/${age.toLowerCase()}
  https://www.soccercoachlab.com/soccer-drills-theme/technique
  https://www.soccerdrive.com/soccer-drills/age-level/${age.toLowerCase()}
  https://mojo.sport/coachs-corner/10-best-${age.toLowerCase()}-soccer-drills/
  https://soccerxpert.com/drills/age/${age.toLowerCase()}
  https://quickstartsoccer.com/soccer-finishing-drills/

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "sessionPlan": {
    "sessionTitle": "string",
    "metaPills": ["string"],
    "coachNote": "string",
    "timeline": [{"time": "0-8", "label": "Warm-Up"}],
    "sections": [{
      "title": "🌡 Warm-Up",
      "type": "warm",
      "drills": [{
        "name": "string",
        "time": "0–8 min",
        "description": "string",
        "coachingPoints": ["string","string","string"],
        "videoUrl": "string",
        "videoLabel": "string"
      }]
    }]
  },
  "preSessionForm": {
    "sessionTopic": "string",
    "trainingObjective": "string",
    "keyPrinciples": {
      "attackingDefendingPrinciple": "string",
      "subPrinciples": ["string","string"],
      "playerActions": ["string","string","string"]
    },
    "playerLearningGoals": ["string","string","string"],
    "plannedActivities": [{"name": "string","description": "string"}],
    "coachingCues": ["string","string","string"],
    "anticipatedChallenges": "string",
    "clubValuesReflection": "string"
  }
}
Section types: warm, tech, game, scrim, cool. Generate 5-7 total drills.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    stopLoading();
    if (!res.ok) throw new Error(data.error?.message || 'API error');
    const raw = data.content.map(b => b.text || '').join('').trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    currentPlan = parsed.sessionPlan;
    currentPreForm = { ...parsed.preSessionForm, coach, date, location: loc, age, phase, formation: form };

    saveSession(currentPlan, { coach, date, age, focus, formation: form });
    renderPlan(currentPlan);
    renderPreForm(currentPreForm, currentPlan);
    switchTab('plan');
    showView('result');

  } catch (err) {
    stopLoading();
    const errEl = document.getElementById('formError');
    errEl.style.display = 'block';
    errEl.textContent = err.message;
    showView('form');
  }
}

// ── Render session plan ──
function renderPlan(plan) {
  let h = `<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:12px">${esc(plan.sessionTitle)}</h2>`;
  h += `<div class="meta-row">${(plan.metaPills||[]).map(p=>`<span class="badge badge-green">${esc(p)}</span>`).join('')}</div>`;
  if (plan.coachNote) h += `<div class="note-box"><strong style="display:block;margin-bottom:4px">📋 Coach's Note</strong>${esc(plan.coachNote)}</div>`;
  if (plan.timeline?.length) {
    h += `<div class="sec-title">⏱ Session at a Glance</div><div class="tl-wrap">`;
    h += plan.timeline.map(t=>`<div class="tl-item"><div class="tl-time">${esc(t.time)}</div><div class="tl-label">${esc(t.label)}</div></div>`).join('');
    h += `</div>`;
  }
  (plan.sections||[]).forEach(sec => {
    h += `<div class="sec-title">${esc(sec.title)}</div>`;
    (sec.drills||[]).forEach(d => {
      const bc = BORDER_COLORS[sec.type] || '#48bb78';
      h += `<div class="drill-card" style="border-left-color:${bc}">
        <div class="drill-head"><div class="drill-name">${esc(d.name)}</div><div class="drill-time">${esc(d.time)}</div></div>
        <p class="drill-desc">${esc(d.description)}</p>`;
      if (d.coachingPoints?.length) {
        h += `<div class="cp-box"><strong>🔑 Key Points</strong><ul>${d.coachingPoints.map(cp=>`<li>${esc(cp)}</li>`).join('')}</ul></div>`;
      }
      if (d.videoUrl) h += `<a class="vlink" href="${esc(d.videoUrl)}" target="_blank">▶ ${esc(d.videoLabel||'Watch Video')}</a>`;
      h += `</div>`;
    });
  });
  document.getElementById('result-plan').innerHTML = h;
}

// ── Render pre-session form ──
function renderPreForm(pf, plan) {
  let h = `<div class="card pf-hdr">
    <div class="pf-hdr-top">
      <div><div class="pf-club">NEWRIVER UNITED SOCCER</div><div class="pf-sub">PRE-SESSION PLANNING FORM</div></div>
      <div style="font-size:1.8rem">⚽</div>
    </div>
    <div class="pf-grid">
      ${[['Coach',pf.coach||'—'],['Team / Age Group',pf.age],['Date',pf.date],['Location',pf.location],['Training Phase',pf.phase],['Formation',pf.formation]].map(([l,v])=>`<div><div class="pf-field-label">${l}</div><div class="pf-field-val">${esc(v)}</div></div>`).join('')}
    </div>
  </div>`;

  h += pfSection('🏷 Session Topic / Title', `<p class="pf-text">${esc(pf.sessionTopic)}</p>`);
  h += pfSection('🎯 Training Objective', `<p class="pf-text">${esc(pf.trainingObjective)}</p>`);
  h += pfSection('⚙️ Key Principles & Player Actions', `
    <div style="margin-bottom:10px"><div class="pf-sub-label">Attacking/Defending Principle</div><p class="pf-text">${esc(pf.keyPrinciples?.attackingDefendingPrinciple)}</p></div>
    <div style="margin-bottom:10px"><div class="pf-sub-label">Sub-Principles</div><ul style="padding-left:16px">${(pf.keyPrinciples?.subPrinciples||[]).map(s=>`<li class="pf-text">${esc(s)}</li>`).join('')}</ul></div>
    <div><div class="pf-sub-label">Player Actions of Focus</div><ul style="padding-left:16px">${(pf.keyPrinciples?.playerActions||[]).map(a=>`<li class="pf-text">${esc(a)}</li>`).join('')}</ul></div>
  `);
  h += pfSection('📈 Player Learning Goals', `<ul style="padding-left:16px">${(pf.playerLearningGoals||[]).map(g=>`<li class="pf-text" style="margin-bottom:4px">${esc(g)}</li>`).join('')}</ul>`);
  h += pfSection('📋 Planned Activities', (pf.plannedActivities||[]).map((a,i)=>`<div style="margin-bottom:10px"><div style="font-weight:700;font-size:.84rem">${i+1}. ${esc(a.name)}</div><p class="pf-text" style="margin-top:2px">${esc(a.description)}</p></div>`).join(''));
  h += pfSection('💬 Coaching Cues / Interventions', `<ul style="padding-left:16px">${(pf.coachingCues||[]).map(c=>`<li class="pf-text" style="margin-bottom:4px">${esc(c)}</li>`).join('')}</ul>`);
  h += pfSection('⏱ Session Flow / Timing', (plan.timeline||[]).map(t=>`<div style="display:flex;gap:12px;margin-bottom:4px"><span style="font-weight:700;font-size:.82rem;min-width:60px">${esc(t.time)} min</span><span class="pf-text">${esc(t.label)}</span></div>`).join(''));
  h += pfSection('⚠️ Anticipated Challenges & Adaptations', `<p class="pf-text">${esc(pf.anticipatedChallenges)}</p>`);
  h += pfSection('🏆 Club Values & Game Model Reflection', `<p class="pf-text">${esc(pf.clubValuesReflection)}</p>`);

  document.getElementById('result-form').innerHTML = h;
}

function pfSection(title, content) {
  return `<div class="pf-section"><div class="pf-sec-title">${title}</div>${content}</div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
