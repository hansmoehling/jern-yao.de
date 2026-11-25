(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MAIL = 'info@jernyao.de';
  const L=window.JYLocale;
  const tr=text=>L.t(text);
  const showPrices = window.JY_SHOW_PRICES !== false;
  let latestStatus=null;
  const MAX_BYTES = 15 * 1024 * 1024;
  const ALLOWED = /\.(pdf|png|jpe?g|webp|step|stp|dxf|dwg)$/i;
  const CAD = /\.(step|stp|dxf|dwg)$/i;
  const requestForm = $('request-form');
  const chatForm = $('chat-form');
  const tabs = Array.from(document.querySelectorAll('[data-mode]'));
  const history = [];
  let mode = 'upload';
  let current = null;
  let requestBusy = false;
  let chatBusy = false;
  let pollTimer = null;
  let polling = false;
  let polls = 0;
  let idempotencyKey = '';
  let payloadSignature = '';
  let sentSignature = '';

  // The deployment provides only the public service URL, never credentials.
  const configuredBase = typeof window.JY_API_BASE === 'string' ? window.JY_API_BASE.trim() : '';
  let apiBase = '';
  if (configuredBase) {
    try {
      const url = new URL(configuredBase, window.location.href);
      if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
        apiBase = url.href.replace(/\/$/, '');
      }
    } catch (_) { /* Invalid configuration remains visibly unavailable. */ }
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) { const source=String(text); node.textContent = ['message-text','answer-text'].includes(className)?source:tr(source); if(!['message-text','answer-text'].includes(className))node.dataset.jySource=source; }
    if (className) node.className = className;
    return node;
  }

  function message(id, text, kind) {
    const node = $(id);
    node.textContent = tr(text || ''); node.dataset.jySource=text||'';
    node.className = 'form-message' + (kind ? ' ' + kind : '');
    node.hidden = !text;
  }

  function number(value, suffix) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString(window.JYI18N.numberLocale(L.language), { maximumFractionDigits: 2 }) + (suffix ? ' ' + suffix : '') : '';
  }

  function readable(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(', ');
    if (typeof value === 'object') return readable(value.label || value.text || value.title || value.reference || value.value || '');
    return '';
  }

  function selectMode(next, focus) {
    mode = next;
    tabs.forEach(tab => {
      const selected = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $('panel-anfrage').hidden = mode === 'chat';
    $('panel-chat').hidden = mode !== 'chat';
    $('panel-anfrage').setAttribute('aria-labelledby', mode === 'description' ? 'tab-description' : 'tab-upload');
    $('upload-area').hidden = mode === 'description';
    $('description-help').hidden = mode !== 'description';
    $('description-label').textContent = mode === 'description' ? 'Beschreiben Sie Ihr Teil' : 'Was möchten Sie uns mitgeben? Optional zur Zeichnung';
    $('description').placeholder = mode === 'description'
      ? 'Zum Beispiel: Eine Hülse mit Bund, außen Ø 12 mm, innen Ø 6 mm, Länge 25 mm. Werkstoff und weitere Anforderungen sind noch offen.'
      : 'Zum Beispiel Stückzahl, Werkstoff, gewünschter Termin oder eine Frage zum Teil.';
    if (focus) (mode === 'chat' ? $('chat-input') : mode === 'description' ? $('description') : $('file')).focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectMode(tab.dataset.mode, false));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectMode(tabs[next].dataset.mode, false);
      tabs[next].focus();
    });
  });

  function selectedFile() { return $('file').files[0] || null; }

  function fileError() {
    const file = selectedFile();
    if (!file) return '';
    if (!ALLOWED.test(file.name)) return 'Bitte wählen Sie eine PDF-, Bild- oder CAD-Datei im angegebenen Format.';
    if (!file.size) return 'Die ausgewählte Datei ist leer. Bitte wählen Sie die Zeichnung erneut aus.';
    if (file.size > MAX_BYTES) return 'Diese Datei ist größer als 15 MB. Bitte verwenden Sie eine kleinere Datei oder beschreiben Sie Ihr Teil.';
    return '';
  }

  function signature() {
    const file = selectedFile();
    return JSON.stringify({ language:L.language, email: $('email').value.trim(), name: $('name').value.trim(), firma: $('company').value.trim(), notiz: $('description').value.trim(), file: file ? [file.name, file.size, file.lastModified] : null });
  }

  function updateSubmit() {
    $('request-submit').disabled = !apiBase || requestBusy || !!fileError() || (sentSignature !== '' && sentSignature === signature());
    $('request-submit').textContent = requestBusy ? 'Anfrage wird übertragen …' : sentSignature && sentSignature === signature() ? 'Anfrage eingegangen' : 'Anfrage senden';
    $('chat-submit').disabled = !apiBase || chatBusy;
    $('chat-submit').textContent = chatBusy ? 'Antwort wird vorbereitet …' : 'Frage senden';
  }

  function updateFile() {
    const file = selectedFile();
    const error = fileError();
    $('file-summary').hidden = !file;
    $('file-name').textContent = file ? file.name + ' · ' + number(file.size / 1024 / 1024, 'MB') + (CAD.test(file.name) ? ' · CAD-Anhang für Hans Möhling' : '') : '';
    message('file-error', error, 'error');
    $('file').setAttribute('aria-invalid', String(!!error));
    updateSubmit();
  }

  $('choose-file').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change', updateFile);
  $('remove-file').addEventListener('click', () => { $('file').value = ''; updateFile(); });
  const drop = $('drop-zone');
  ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.remove('dragover');
  }));
  drop.addEventListener('drop', event => {
    if (!event.dataTransfer || !event.dataTransfer.files.length) return;
    if (event.dataTransfer.files.length !== 1) {
      message('file-error', 'Bitte laden Sie eine Datei pro Anfrage hoch. Mehrseitige Zeichnungen können Sie als eine PDF zusammenfassen.', 'error');
      return;
    }
    try { $('file').files = event.dataTransfer.files; updateFile(); }
    catch (_) { message('file-error', 'Bitte wählen Sie die Datei über die Schaltfläche aus.', 'error'); }
  });
  requestForm.addEventListener('input',()=>{$('email').setCustomValidity('');$('consent').setCustomValidity('');updateSubmit();});
  function validRequest(){
    const email=$('email').value.trim();
    $('email').setCustomValidity(tr(!email?'Bitte geben Sie Ihre E-Mail-Adresse ein.':!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Bitte geben Sie eine gültige E-Mail-Adresse ein.':''));
    $('consent').setCustomValidity($('consent').checked?'':tr('Bitte stimmen Sie der Verarbeitung Ihrer Anfrage zu.'));
    return requestForm.reportValidity() && !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && $('consent').checked;
  }

  async function api(path, options) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(apiBase + path + (path.includes('?')?'&':'?') + 'language=' + encodeURIComponent(L.language), Object.assign({}, options, { signal: controller.signal, credentials: 'omit', cache: 'no-store' }));
      let data;
      try { data = await response.json(); } catch (_) { data = null; }
      if (!response.ok) {
        const error = new Error(response.status === 503
          ? 'Der technische Dialog ist gerade nicht verfügbar. Bitte versuchen Sie es später oder schreiben Sie an ' + MAIL + '.'
          : response.status === 429
          ? 'Im Moment kommen viele Anfragen an. Bitte versuchen Sie es in wenigen Minuten erneut.'
          : response.status === 413
          ? 'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.'
          : response.status === 400 || response.status === 415 || response.status === 422
          ? 'Bitte prüfen Sie Ihre Angaben und das Dateiformat.'
          : 'Die Übertragung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.');
        error.status = response.status;
        throw error;
      }
      if (!data || typeof data !== 'object') throw new Error('Die Antwort konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Die Antwort dauert länger als erwartet. Bitte versuchen Sie es erneut; dabei verwenden wir dieselbe Anfragenkennung.');
      if (error instanceof TypeError) throw new Error('Die Verbindung konnte nicht hergestellt werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');
      throw error;
    } finally { window.clearTimeout(timer); }
  }

  function listSection(parent, title, values, className) {
    const items = Array.isArray(values) ? values.map(readable).filter(Boolean) : [];
    if (!items.length) return;
    parent.appendChild(element('h3', title));
    const list = element('ul', null, className);
    items.forEach(value => list.appendChild(element('li', value)));
    parent.appendChild(list);
  }

  function sourcesSection(parent, sources) {
    if (!Array.isArray(sources) || !sources.length) return;
    const list = element('ul', null, 'source-list');
    sources.forEach(source => {
      const label = typeof source === 'string' ? source : readable(source.label || source.id);
      if (!label) return;
      const li = element('li');
      let url = null;
      try { const candidate = new URL(source.url); if (['https:', 'http:'].includes(candidate.protocol)) url = candidate; } catch (_) { /* Plain reference is enough. */ }
      if (url) { const link = element('a', label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.appendChild(link); }
      else li.textContent = label;
      list.appendChild(li);
    });
    if (list.children.length) { parent.appendChild(element('h3', 'Grundlagen & Quellen')); parent.appendChild(list); }
  }

  function factRow(list, label, value, detail) {
    if (!value) return;
    const row = element('div');
    row.appendChild(element('dt', label));
    const originalValue = element('dd');
    originalValue.textContent = value;
    originalValue.dataset.originalText = '';
    row.appendChild(originalValue);
    if (detail && typeof detail === 'object') {
      const provenance = element('dd', null, 'small');
      const labels = [detail.assumption ? 'Annahme' : '', detail.origin].filter(Boolean);
      labels.forEach((text, index) => {
        if (index) provenance.appendChild(element('span', ' · '));
        provenance.appendChild(element('span', text));
      });
      if (detail.reference) {
        if (labels.length) provenance.appendChild(element('span', ' · '));
        const reference = element('span');
        // Translate the complete reference template before combining it with
        // provenance labels. Its quoted customer text must remain verbatim.
        reference.textContent = tr(detail.reference);
        reference.dataset.originalText = '';
        provenance.appendChild(reference);
      }
      row.appendChild(provenance);
    } else if (detail) row.appendChild(element('dd', detail, 'small'));
    list.appendChild(row);
  }

  function renderProposal(parent, proposal) {
    if (!proposal || typeof proposal !== 'object') return;
    const fieldLabels = { material: 'Werkstoff', materialState:'Lieferzustand', curveId:'Fließkurvenansatz', d0: 'Drahtdurchmesser', kD: 'Kopfdurchmesser', kSW: 'Kopfschlüsselweite', kH: 'Kopfhöhe', sD: 'Körperdurchmesser', sL: 'Körperlänge', iSW: 'Innenantrieb-Schlüsselweite', iT: 'Innenantriebstiefe', nD: 'Napfinnendurchmesser', nT: 'Napftiefe', mM: 'Gewinde-Nenndurchmesser', mSW: 'Mutternschlüsselweite', mH: 'Mutternhöhe', mLoch: 'Lochdurchmesser', mFlansch: 'Flanschdurchmesser', mFlanschH: 'Flanschhöhe', masse: 'Teilmasse', rm: 'Drahtzugfestigkeit', lStempel: 'Länge im Stempel', ko: 'Matrizenauswerferweg', pko: 'Stempelauswerferweg', matD: 'Matrizenaufnahme-Durchmesser', matL: 'Matrizenaufnahme-Länge', stD: 'Stempelaufnahme-Durchmesser', stL: 'Stempelaufnahme-Länge', stationen: 'Stationsvorgabe', zusatz: 'Zusatzstufen', ausbringung: 'Ausbringung' };
    const originLabels = { user_text: 'Ihre Beschreibung', drawing: 'Aus der Zeichnung gelesen', derived: 'Abgeleitet', assumption: 'Prozessannahme' };
    Object.assign(fieldLabels,{wirePreparation:'Vormaterial / Vorzug',rodDiameter:'Walzdraht-Ø vor dem Vorzug',d0:'Draht-Ø an der Presse',rm:'Drahtzugfestigkeit Rm an der Presse'});
    const inputValue=item=>{
      if(item.field==='materialState')return tr(item.value==='gezogen (Literaturzustand)'?'gezogen':readable(item.value));
      if(item.field==='wirePreparation')return tr({'as-supplied':'Draht im gewählten Lieferzustand','inline-drawing':'Walzdraht mit Inline-Vorzug'}[item.value]||readable(item.value));
      return readable(item.value);
    };
    const provenance = item => ({ assumption: !!item.assumption, origin: originLabels[item.origin] || '', reference: readable(item.reference) });
    const materialModel=proposal.calculation&&proposal.calculation.materialModel;
    if(materialModel){
      const curve=materialModel.selectedFlowCurve,status=proposal.calculation.materialStatus;
      const statuses={missing:'Kein belegter Fließkurvenansatz für diesen Werkstoff','state-missing':'Lieferzustand des Drahts fehlt','state-mismatch':'Lieferzustand passt nicht zur ausgewählten Fließkurve','selection-missing':'Belegten Fließkurvenansatz und Lieferzustand auswählen','temperature-mismatch':'Temperatur passt nicht zum Quellenbereich der Fließkurve','strain-outside-range':'Umformgrad außerhalb des belegten Fließkurvenbereichs'};
      let description=curve?tr(curve.approval==='proxy'?'begründete Ersatzkurve':'Literaturansatz')+' · '+tr(curve.state==='soft-annealed'?'weichgeglüht':curve.state==='cold-drawn'?'gezogen':curve.stateLabel||curve.state)+' · '+readable(curve.id):tr('Fließkurve des Lieferzustands fehlt');
      if(curve&&status?.flow!=='ready')description+=' · '+tr(statuses[status?.flow]||'Kraft noch offen');
      const basis=element('p',tr('Werkstoffmodell:')+' '+description,'small');basis.dataset.originalText='';parent.appendChild(basis);
    }
    const input = Array.isArray(proposal.input) ? proposal.input : [];
    if (input.length) {
      parent.appendChild(element('h3', 'Aus Ihren Angaben'));
      const facts = element('dl', null, 'proposal-grid');
      input.forEach(item => factRow(facts, fieldLabels[item.field] || readable(item.field), [inputValue(item), item.unit === 'count' ? '' : readable(item.unit)].filter(Boolean).join(' '), provenance(item)));
      parent.appendChild(facts);
    }
    const wire = proposal.wireDiameter;
    if (wire && wire.value != null) {
      const facts = element('dl', null, 'proposal-grid');
      factRow(facts, 'Draht-Ø an der Presse', readable(wire.value) + ' ' + readable(wire.unit || 'mm'), provenance(wire));
      parent.appendChild(facts);
    }
    if (Array.isArray(proposal.stages) && proposal.stages.length) {
      parent.appendChild(element('h3', 'Vorschlag zur Stadienfolge'));
      const list = element('ol', null, 'stage-list');
      proposal.stages.forEach((stage, index) => {
        const li = element('li');
        li.appendChild(element('strong', 'Stadium ' + readable(stage.number || index + 1) + ' · ' + readable(stage.operation)));
        const detail = [stage.force_t != null ? number(stage.force_t, 't') : 'Kraft noch offen', readable(stage.rule)].filter(Boolean).join(' · ');
        if (detail) li.appendChild(element('div', detail, 'small'));
        list.appendChild(li);
      });
      parent.appendChild(list);
    }
    if (Array.isArray(proposal.machines) && proposal.machines.length) {
      parent.appendChild(element('h3', 'Maschinen zum Konzept'));
      const machines = element('dl', null, 'proposal-grid');
      proposal.machines.forEach(machine => {
        const row = element('div');
        row.appendChild(element('dt', readable(machine.model)));
        const statusLabels = { ok: 'Passend zur Vorauswahl', knapp: 'Einzelne Punkte vertiefen', offen: 'Klärung nötig', nein: 'Grenze überschritten', suitable: 'Passend zur Vorauswahl' };
        row.appendChild(element('dd', statusLabels[machine.status] || readable(machine.status)));
        const openPoints=(machine.openPoints||[]).filter(point=>point&&typeof point.detail==='string'&&point.detail.trim());
        if(openPoints.length){
          const box=element('dd',null,'machine-open-points'),list=element('ul');
          box.appendChild(element('strong','Noch zu klären'));
          openPoints.forEach(point=>{const item=element('li');item.appendChild(element('strong',readable(point.owner)+': '));item.appendChild(element('span',point.detail));list.appendChild(item);});
          box.appendChild(list);row.appendChild(box);
        }
        const price = typeof machine.priceEUR==='number' && machine.priceEUR>0?number(machine.priceEUR, 'EUR'):'';
        if (showPrices && price) row.appendChild(element('dd', 'Richtpreis ' + price, 'small'));
        if (showPrices && Array.isArray(machine.priceRangeEUR) && machine.priceRangeEUR.length === 2) row.appendChild(element('dd', 'Preisspanne ' + machine.priceRangeEUR.map(value => number(value, 'EUR')).join(' – '), 'small'));
        if(machine.concept){const box=element('div');box.innerHTML=window.JYConcept.html(machine.concept,L.language);row.appendChild(box);}
        if (Array.isArray(machine.criteria) && machine.criteria.length) {
          const details = element('details'); details.appendChild(element('summary', 'Abgleich mit den Maschinendaten'));
          const list = element('ul', null, 'small');
          machine.criteria.forEach(criterion => list.appendChild(element('li', [readable(criterion.criterion), criterion.required != null ? 'Bedarf: ' + readable(criterion.required) : '', criterion.available != null ? 'Maschine: ' + readable(criterion.available) : '', readable(criterion.rule)].filter(Boolean).join(' · '))));
          details.appendChild(list); row.appendChild(details);
        }
        machines.appendChild(row);
      });
      parent.appendChild(machines);
    }
    listSection(parent, 'Annahmen im Konzept', proposal.assumptions);
    listSection(parent, 'Punkte für die Vertiefung', proposal.limits);
    if (Array.isArray(proposal.calculationBasis) && proposal.calculationBasis.length) {
      const details = element('details'); details.appendChild(element('summary', 'Berechnungsgrundlage'));
      const list = element('ul', null, 'small');
      proposal.calculationBasis.map(readable).filter(Boolean).forEach(value => list.appendChild(element('li', value)));
      details.appendChild(list); parent.appendChild(details);
    }
    if (Array.isArray(proposal.rules) && proposal.rules.length) {
      const details = element('details'); details.appendChild(element('summary', 'Verwendete Auslegungsregeln'));
      const list = element('ul', null, 'source-list');
      proposal.rules.forEach(rule => list.appendChild(element('li', [readable(rule.id), readable(rule.text), readable(rule.type)].filter(Boolean).join(' · '))));
      details.appendChild(list); parent.appendChild(details);
    }
  }

  function renderStatus(data) {
    latestStatus=data;
    $('response').hidden = false;
    const labels = { queued: 'Anfrage eingegangen', processing: 'Ihr Konzept wird vorbereitet', needs_info: 'Eine Rückfrage zu Ihrem Teil', ready: 'Ihr erster Konzeptvorschlag', failed: 'Die technische Auswertung ist noch offen' };
    $('response-title').textContent = labels[data.status] || 'Ihre Anfrage';
    $('result-status').textContent = 'Anfrage ' + current.id;
    const content = $('result-content'); content.replaceChildren();
    if(data.language && window.JYI18N.normalizeLanguage(data.language)!==L.language)content.appendChild(element('p',tr('Antwortsprache:')+' '+L.autonyms[window.JYI18N.normalizeLanguage(data.language)],'original-language'));
    if (typeof data.answer === 'string' && data.answer.trim()) content.appendChild(element('div', data.answer, 'answer-text'));
    else if (data.status === 'queued' || data.status === 'processing') content.appendChild(element('p', 'Ihre Unterlagen sind eingegangen. Die technische Auswertung folgt hier.'));
    else if (data.status === 'failed') content.appendChild(element('p', 'Die Anfrage bleibt erhalten. Sie können Hans Möhling unter Angabe der Anfragenummer direkt kontaktieren.'));
    renderProposal(content, data.proposal);
    listSection(content, 'Das möchten wir noch wissen', data.questions);
    sourcesSection(content, data.sources);
    const notification = { sent: 'Hans Möhling wurde per E-Mail über Ihre Anfrage informiert.', pending: 'Die Benachrichtigung an Hans Möhling ist noch in Bearbeitung.', failed: 'Ihre Anfrage ist gespeichert. Die E-Mail an Hans Möhling konnte noch nicht zugestellt werden.' };
    $('notification').textContent = notification[data.notificationStatus] || 'Die Anfrage ist gespeichert. Der Stand der persönlichen Benachrichtigung liegt noch nicht vor.';
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    if (current && polls < 30) pollTimer = window.setTimeout(() => refreshStatus(false), 4000);
  }

  async function refreshStatus(manual) {
    if (!current || polling) return;
    polling = true;
    $('refresh-status').disabled = true;
    const identity = current;
    try {
      const data = await api('/status?' + new URLSearchParams({ id: identity.id, token: identity.token }).toString());
      if (current !== identity) return;
      renderStatus(data);
      polls += 1;
      if (!['ready', 'needs_info', 'failed'].includes(data.status)) schedulePoll();
      if (manual) message('request-message', 'Stand aktualisiert.');
    } catch (error) {
      if (current !== identity) return;
      polls += 1;
      if (manual) message('request-message', error.message + ' Ihre bereits empfangene Anfrage bleibt bestehen.', 'error');
      if (error.status !== 401 && error.status !== 403 && error.status !== 404) schedulePoll();
    } finally { polling = false; $('refresh-status').disabled = false; }
  }

  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!apiBase || requestBusy || !validRequest()) return;
    const file = selectedFile();
    const note = $('description').value.trim();
    if (!file && !note) {
      message('request-message', 'Bitte wählen Sie eine Zeichnung aus oder beschreiben Sie Ihr Teil mit wenigen Worten.', 'error');
      $('description').focus(); return;
    }
    if (fileError()) { updateFile(); return; }
    const nextSignature = signature();
    if (nextSignature !== payloadSignature || !idempotencyKey) {
      payloadSignature = nextSignature;
      idempotencyKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, '0')).join('');
    }
    const data = new FormData();
    data.append('language',L.language);
    if (!showPrices) data.append('pricePolicy', 'technical-only');
    data.append('email', $('email').value.trim()); data.append('name', $('name').value.trim()); data.append('firma', $('company').value.trim()); data.append('notiz', note); data.append('idempotency_key', idempotencyKey);
    if (file) data.append('datei', file, file.name);
    requestBusy = true; updateSubmit(); message('request-message', 'Ihre Anfrage wird übertragen …');
    try {
      const result = await api('/anfrage', { method: 'POST', body: data });
      if (typeof result.id !== 'string' || !result.id || typeof result.token !== 'string' || !result.token) throw new Error('Der Eingang konnte nicht eindeutig bestätigt werden. Bitte versuchen Sie es erneut.');
      window.clearTimeout(pollTimer);
      current = { id: result.id, token: result.token };
      polls = 0;
      sentSignature = nextSignature;
      renderStatus(result);
      message('request-message', 'Ihre Anfrage ist angekommen.', 'success');
      $('response').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      schedulePoll();
    } catch (error) { message('request-message', error.message, 'error'); }
    finally { requestBusy = false; updateSubmit(); }
  });

  function appendChat(role, text, extra) {
    const article = element('article', null, 'message ' + role);
    article.appendChild(element('div', role === 'user' ? 'Sie' : 'Technischer Dialog', 'speaker'));
    article.appendChild(element('div', text, 'message-text'));
    if(extra&&extra.language)article.appendChild(element('p',tr('Antwortsprache:')+' '+(L.autonyms[window.JYI18N.normalizeLanguage(extra.language)]||extra.language),'original-language'));
    if (extra) { renderProposal(article,extra.proposal);listSection(article, 'Dazu noch eine Frage', extra.questions); sourcesSection(article, extra.sources); }
    $('messages').appendChild(article);
    $('messages').scrollTop = $('messages').scrollHeight;
    return article;
  }

  chatForm.addEventListener('submit', async event => {
    event.preventDefault();
    $('chat-input').setCustomValidity($('chat-input').value.trim()?'':tr('Bitte schreiben Sie Ihre Frage oder Idee.'));
    if (!apiBase || chatBusy || !chatForm.reportValidity()) return;
    const text = $('chat-input').value.trim();
    if (!text) return;
    const priorHistory = history.slice(-12).map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));
    const body = { message: text, history: priorHistory, language:L.language };
    if (!showPrices) body.pricePolicy = 'technical-only';
    if (current) { body.requestId = current.id; body.token = current.token; }
    // Keep the actual UTF-8 JSON below the service's 64 KB limit, including long
    // answers and languages with multibyte characters. Remove oldest pairs first.
    while (body.history.length && new TextEncoder().encode(JSON.stringify(body)).byteLength > 60000) body.history.splice(0, 2);
    const bubble = appendChat('user', text);
    chatBusy = true; updateSubmit(); message('chat-message', 'Die Antwort wird vorbereitet …');
    try {
      const response = await api('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (typeof response.answer !== 'string' || !response.answer.trim()) throw new Error('Es liegt noch keine Antwort vor. Bitte versuchen Sie es erneut.');
      history.push({ role: 'user', content: text }, { role: 'assistant', content: response.answer });
      appendChat('assistant', response.answer, response);
      if ($('chat-input').value.trim() === text) $('chat-input').value = '';
      $('chat-examples').hidden = true;
      message('chat-message', '');
    } catch (error) { bubble.remove(); message('chat-message', error.message, 'error'); }
    finally { chatBusy = false; updateSubmit(); }
  });

  $('chat-input').addEventListener('input',()=>$('chat-input').setCustomValidity(''));
  document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => {
    $('chat-input').value = button.dataset.question; $('chat-input').focus();
  }));
  $('continue-chat').addEventListener('click', () => { selectMode('chat', true); $('panel-chat').scrollIntoView({ block: 'start' }); });
  $('chat-to-request').addEventListener('click', () => {
    const questions = history.filter(item => item.role === 'user').map(item => item.content);
    if ($('chat-input').value.trim()) questions.push($('chat-input').value.trim());
    if (questions.length && !$('description').value.trim()) $('description').value = questions.join('\n\n').slice(0, 12000);
    selectMode('description', true); updateSubmit();
  });
  $('refresh-status').addEventListener('click', () => { polls = 0; refreshStatus(true); });
  $('email-fallback').addEventListener('click', event => {
    const file = selectedFile();
    const body = [$('name').value.trim(), $('company').value.trim(), $('email').value.trim(), '', $('description').value.trim(), file ? '\n'+tr('Zeichnung:')+' '+file.name+' '+tr('(bitte dieser E-Mail beifügen)') : ''].join('\n');
    event.currentTarget.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(tr('Anfrage zur Kaltumformung')) + '&body=' + encodeURIComponent(body.slice(0, 7000));
  });
  document.querySelectorAll('a[href="#datenschutz"]').forEach(link => link.addEventListener('click', () => { $('datenschutz').open = true; }));
  const openLinkedPrivacy = () => { if (window.location.hash === '#datenschutz') $('datenschutz').open = true; };
  window.addEventListener('hashchange', openLinkedPrivacy);
  openLinkedPrivacy();
  window.addEventListener('pagehide', () => window.clearTimeout(pollTimer));
  $('availability').hidden = !!apiBase;
  $('email-fallback').hidden = !!apiBase;
  window.addEventListener('jy-languagechange',()=>{$('email').setCustomValidity('');$('consent').setCustomValidity('');$('chat-input').setCustomValidity('');selectMode(mode,false);updateFile();updateSubmit();if(latestStatus)renderStatus(latestStatus);L.apply();});
  updateSubmit(); L.apply();
})();
