// Rupali Shine admin panel (single page). All dynamic text is escaped with esc().
(function () {
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const date = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let view = 'dashboard';
  let me = {};

  async function api(method, url, body) {
    const opt = { method, headers: {} };
    if (body instanceof FormData) opt.body = body;
    else if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch('/api/admin' + url, opt);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/login') { boot(); throw new Error(data.error || 'Please log in.'); }
    if (!r.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  let toastTimer;
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }
  const fail = e => toast(e.message, true);
  function openModal(title, html) {
    modal.innerHTML = `<div class="modal-box"><div class="modal-head"><h2>${esc(title)}</h2><button class="x" data-close aria-label="Close">×</button></div>${html}</div>`;
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

  const field = (label, name, value = '', { type = 'text', full = false, hint = '', attrs = '' } = {}) =>
    `<label class="field${full ? ' full' : ''}"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const area = (label, name, value = '', { rows = 4, hint = '' } = {}) =>
    `<label class="field full"><span>${label}</span><textarea name="${name}" rows="${rows}">${esc(value)}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const check = (label, name, on) => `<label class="check"><input type="checkbox" name="${name}"${on ? ' checked' : ''}> ${label}</label>`;
  // <input type="datetime-local"> works in the admin's own time zone; the server stores ISO time
  const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocalInput = v => v ? new Date(v).toISOString() : '';
  const formData = form => {
    const o = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type=checkbox]').forEach(c => { o[c.name] = c.checked; });
    return o;
  };

  /* ---------- auth ---------- */
  async function boot() {
    me = await fetch('/api/admin/me').then(r => r.json());
    if (me.loggedIn) return shell();
    const setup = me.needsSetup;
    app.innerHTML = `<div class="auth"><form id="authForm">
      <h1>${setup ? 'Create admin account' : 'Admin login'}</h1>
      <p>${setup ? 'Choose the username and password you will use to manage your store.' : 'Sign in to manage your store.'}</p>
      <div class="fields" style="grid-template-columns:1fr">
        ${field('Username', 'username', '', { attrs: 'required autocomplete="username"' })}
        ${field('Password', 'password', '', { type: 'password', attrs: `required autocomplete="${setup ? 'new-password' : 'current-password'}"`, hint: setup ? 'At least 8 characters.' : '' })}
      </div>
      <p class="error" id="authErr" hidden></p>
      <button class="btn">${setup ? 'Create account' : 'Log in'}</button>
    </form></div>`;
    document.getElementById('authForm').addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('authErr');
      try { await api('POST', setup ? '/setup' : '/login', formData(e.target)); boot(); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  }

  /* ---------- shell ---------- */
  const NAV = [['dashboard', 'Dashboard'], ['products', 'Products'], ['orders', 'Orders'], ['reviews', 'Reviews'], ['documents', 'Certificates'], ['offers', 'Offers & Coupons'], ['payments', 'Payments'], ['pages', 'Pages'], ['messages', 'Messages'], ['settings', 'Site Settings'], ['account', 'Account']];
  function shell() {
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <div class="brand">Rupali Shine<small>Admin panel</small></div>
        ${NAV.map(([k, l]) => `<button data-view="${k}">${l}</button>`).join('')}
        <div class="spacer"></div>
        <a href="/" target="_blank" rel="noopener">View website ↗</a>
        <button data-logout>Log out</button>
      </aside>
      <section class="main" id="main"></section>
    </div>`;
    app.querySelector('.side').addEventListener('click', async e => {
      const b = e.target.closest('[data-view]');
      if (b) return go(b.dataset.view);
      if (e.target.closest('[data-logout]')) { await api('POST', '/logout'); boot(); }
    });
    go(view);
  }
  function go(v) {
    view = v;
    app.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    const main = document.getElementById('main');
    // each visit renders into its own box, so a slow earlier request can't overwrite the current view
    const box = document.createElement('div');
    box.innerHTML = '<p class="empty">Loading…</p>';
    main.replaceChildren(box);
    VIEWS[v](box).catch(fail);
  }

  /* ---------- image picker ---------- */
  function imagePicker(el, images, { multiple = true } = {}) {
    function draw() {
      el.innerHTML = images.map((u, i) => `<div class="img"><img src="${esc(u)}" alt="">
        ${multiple && i > 0 ? `<button type="button" class="mv" data-first="${i}" title="Make main image">★</button>` : ''}
        <button type="button" data-rm="${i}" title="Remove">×</button>${multiple && i === 0 ? '<span class="first">Main</span>' : ''}</div>`).join('') +
        (multiple || !images.length ? `<label class="upload">+ Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif"${multiple ? ' multiple' : ''}></label>` : '');
    }
    el.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]'), first = e.target.closest('[data-first]');
      if (rm) { images.splice(+rm.dataset.rm, 1); draw(); }
      if (first) { images.unshift(images.splice(+first.dataset.first, 1)[0]); draw(); }
    });
    el.addEventListener('change', async e => {
      if (e.target.type !== 'file' || !e.target.files.length) return;
      // one image per request keeps each upload under the host's size limit
      try {
        for (const f of [...e.target.files]) {
          if (f.size > 4 * 1024 * 1024) throw new Error(`“${f.name}” is larger than 4 MB. Please use a smaller image.`);
          const fd = new FormData(); fd.append('images', f);
          const r = await api('POST', '/upload', fd);
          if (multiple) images.push(...r.urls); else images.splice(0, images.length, r.urls[0]);
          draw();
        }
      } catch (ex) { fail(ex); draw(); }
    });
    draw();
  }

  /* ---------- reviews helpers ---------- */
  const stars = n => `<span class="stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const SOURCE = { website: 'Website', admin: 'Added by you', whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', phone: 'Phone call' };
  const day = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const toDateInput = iso => (iso ? new Date(iso) : new Date()).toISOString().slice(0, 10);

  function reviewForm(r, products) {
    const photo = r && r.photo ? [r.photo] : [];
    const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
    openModal(r ? 'Edit review' : 'Add a review', `<form id="reviewForm">
      ${r ? '' : '<p class="note">Only add reviews that real customers gave you — for example on WhatsApp, Instagram, email or a phone call. Never write reviews yourself: fake reviews are against consumer law in India and break buyers’ trust.</p>'}
      <div class="fields">
        <label class="field"><span>Product</span><select name="productId">${products.map(p => opt(p.id, p.name, r ? r.productId : products[0] && products[0].id)).join('')}</select></label>
        <div class="field"><span>Rating</span><div class="star-pick">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="st${n}" name="rating" value="${n}"${(r ? r.rating : 5) === n ? ' checked' : ''}><label for="st${n}" title="${n} star${n > 1 ? 's' : ''}">★</label>`).join('')}</div></div>
        ${field('Customer name', 'name', r && r.name, { attrs: 'required maxlength="60"' })}
        ${field('City (optional)', 'city', r && r.city, { attrs: 'maxlength="60"' })}
        ${field('Review heading (optional)', 'title', r && r.title, { full: true, attrs: 'maxlength="100"', hint: 'E.g. “My hair fall reduced”' })}
        ${area('Review', 'text', r && r.text, { rows: 5 })}
        <div class="field full"><span>Customer photo (optional)</span><div class="images" id="reviewPhoto"></div><small>A photo the customer sent you, with their permission.</small></div>
        ${field('Date', 'createdAt', toDateInput(r && r.createdAt), { type: 'date' })}
        ${r ? `<label class="field"><span>Came from</span><input type="text" value="${esc(SOURCE[r.source] || r.source)}" disabled></label>` : `<label class="field"><span>Came from</span><select name="source">${['whatsapp', 'instagram', 'email', 'phone', 'admin'].map(k => opt(k, SOURCE[k], 'whatsapp')).join('')}</select></label>`}
        ${area('Your reply (optional)', 'reply', r && r.reply, { rows: 3, hint: 'Shown under the review as “Reply from Rupali Shine”. A warm thank-you builds trust.' })}
        <label class="field"><span>Show on website?</span><select name="status">${[['approved', 'Yes — show it'], ['pending', 'Not yet — keep for checking'], ['hidden', 'No — hide it']].map(([v, l]) => opt(v, l, r ? r.status : 'approved')).join('')}</select></label>
        <div class="field"><span>Badges</span>${check('Verified buyer (they really bought from you)', 'verified', r && r.verified)}${check('Feature on the home page', 'featured', r && r.featured)}</div>
      </div>
      ${r && r.orderNumber ? `<p class="muted">Customer gave order <b>${esc(r.orderNumber)}</b>${r.phone ? ` and mobile <b>${esc(r.phone)}</b>` : ''}. ${r.verified ? 'These matched a real order.' : 'These did not match an order automatically — check before marking as verified.'}</p>` : ''}
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">${r ? 'Save changes' : 'Add review'}</button></div>
    </form>`);
    imagePicker(modal.querySelector('#reviewPhoto'), photo, { multiple: false });
    modal.querySelector('#reviewForm').addEventListener('submit', async e => {
      e.preventDefault();
      const d = formData(e.target);
      d.photo = photo[0] || '';
      try {
        await api(r ? 'PUT' : 'POST', '/reviews' + (r ? '/' + r.id : ''), d);
        closeModal(); toast(r ? 'Review saved' : 'Review added'); go('reviews');
      } catch (ex) { fail(ex); }
    });
  }

  /* ---------- certificates form ---------- */
  function documentForm(d, done) {
    const img = d && d.image ? [d.image] : [];
    openModal(d ? 'Edit certificate' : 'Add a certificate', `<form id="docForm">
      <p class="note">Describe each document exactly as it is. A pledge is not a certificate, a self-declaration is not issued by the government, and a private certificate is not a government licence — honest wording builds more trust than big claims.</p>
      <div class="fields">
        ${field('Certificate name', 'title', d && d.title, { full: true, attrs: 'required maxlength="100" placeholder="e.g. GMP Certificate of Compliance"' })}
        <div class="field full"><span>Photo or scan of the certificate</span><div class="images" id="docPick"></div><small>JPG, PNG or WebP up to 4 MB. For a PDF, take a screenshot of the page.</small></div>
        ${field('Type', 'kind', d && d.kind, { attrs: 'maxlength="60" list="docKinds" placeholder="e.g. Government registration"' })}
        <datalist id="docKinds"><option value="Government registration"><option value="Government licence"><option value="Independent certification"><option value="Lab test report"><option value="Government scheme pledge"><option value="Self-declaration"></datalist>
        ${field('Short badge text', 'badge', d && d.badge, { attrs: 'maxlength="40" placeholder="e.g. GMP certified"', hint: 'Shown on the home page and product page.' })}
        ${field('Issued by', 'issuer', d && d.issuer, { full: true, attrs: 'maxlength="140"' })}
        ${field('Certificate / registration number', 'number', d && d.number, { attrs: 'maxlength="60"' })}
        ${field('Issue date', 'issued', d && d.issued, { type: 'date' })}
        ${field('Valid until (optional)', 'validUntil', d && d.validUntil, { type: 'date', hint: 'Leave empty if it does not expire.' })}
        ${area('What it means (shown to shoppers)', 'summary', d && d.summary, { rows: 3 })}
        ${field('Verify link (optional)', 'verifyUrl', d && d.verifyUrl, { type: 'url', attrs: 'placeholder="https://"', hint: 'The issuer’s page where anyone can check it.' })}
        ${field('How to verify (optional)', 'verifyHint', d && d.verifyHint, { attrs: 'maxlength="140" placeholder="e.g. Enter the Udyam number on the portal."' })}
        ${area('Private note (only you see this)', 'note', d && d.note, { rows: 2 })}
        <div class="field full checks">${check('Show on the website', 'published', d ? d.published : true)}${check('Also show on the home page and product page', 'featured', d ? d.featured : false)}</div>
      </div><p class="error" hidden></p>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">${d ? 'Save changes' : 'Add certificate'}</button></div>
    </form>`);
    imagePicker(modal.querySelector('#docPick'), img, { multiple: false });
    modal.querySelector('#docForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const list = await api(d ? 'PUT' : 'POST', '/documents' + (d ? '/' + d.id : ''), { ...formData(e.target), image: img[0] || '' });
        closeModal(); toast(d ? 'Certificate saved' : 'Certificate added'); done(list);
      } catch (ex) { const er = modal.querySelector('.error'); er.textContent = ex.message; er.hidden = false; }
    };
  }

  const VIEWS = {
    /* ---------- certificates ---------- */
    async documents(main) {
      let docs = await api('GET', '/documents');
      const day = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const expiring = d => d.validUntil && (Date.parse(d.validUntil) - Date.now()) < 60 * 864e5;
      const draw = () => {
        main.innerHTML = `<div class="top"><h1>Certificates</h1><div class="actions"><a class="btn ghost" href="/certificates" target="_blank" rel="noopener">View page ↗</a><button class="btn" data-new>+ Add certificate</button></div></div>
          <div class="card"><p class="muted" style="margin:0">These appear on the <b>Certificates &amp; Registrations</b> page. Ticked “home page” ones also show as badges on the home page and under the Buy button. Use the arrows to change the order.</p></div>
          <div class="doc-list">${docs.length ? docs.map((d, i) => `<article class="doc ${d.published ? '' : 'off'}">
            <a class="doc-img" href="${esc(d.image)}" target="_blank" rel="noopener"><img src="${esc(d.thumb || d.image)}" alt=""></a>
            <div class="doc-body">
              <div class="rv-head">${d.published ? '<span class="tag">On website</span>' : '<span class="tag off">Hidden</span>'}${d.featured && d.published ? '<span class="tag gold">Home page</span>' : ''}${expiring(d) ? `<span class="tag new">${Date.parse(d.validUntil) < Date.now() ? 'Expired' : 'Expires soon'}</span>` : ''}${d.kind ? `<span class="muted">${esc(d.kind)}</span>` : ''}</div>
              <h3>${esc(d.title)}</h3>
              <p class="muted">${[d.issuer, d.number, d.issued && 'Issued ' + day(d.issued), d.validUntil && 'Valid until ' + day(d.validUntil)].filter(Boolean).map(esc).join(' · ')}</p>
              ${d.note ? `<p class="doc-note">${esc(d.note)}</p>` : ''}
              <div class="actions">
                <button class="btn ghost sm" data-move="up" data-id="${esc(d.id)}"${i ? '' : ' disabled'} aria-label="Move up">↑</button><button class="btn ghost sm" data-move="down" data-id="${esc(d.id)}"${i < docs.length - 1 ? '' : ' disabled'} aria-label="Move down">↓</button>
                <button class="btn ${d.published ? 'ghost' : ''} sm" data-pub="${esc(d.id)}">${d.published ? 'Hide' : 'Show on website'}</button>
                ${d.published ? `<button class="btn ghost sm" data-feat="${esc(d.id)}">${d.featured ? 'Remove from home page' : 'Show on home page'}</button>` : ''}
                <button class="btn ghost sm" data-edit="${esc(d.id)}">Edit</button><button class="btn danger sm" data-del="${esc(d.id)}">Delete</button>
              </div>
            </div>
          </article>`).join('') : '<div class="card"><p class="empty">No certificates yet. Click “Add certificate” to upload one.</p></div>'}</div>`;
      };
      draw();
      main.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        const id = t.dataset.id || t.dataset.edit || t.dataset.del || t.dataset.pub || t.dataset.feat;
        const d = docs.find(x => x.id === id);
        try {
          if ('new' in t.dataset) return documentForm(null, l => { docs = l; draw(); });
          if (t.dataset.edit) return documentForm(d, l => { docs = l; draw(); });
          if (t.dataset.move) docs = await api('POST', `/documents/${id}/move`, { dir: t.dataset.move });
          if (t.dataset.pub) {
            if (!d.published && d.note && !confirm('Your note on this certificate:\n\n' + d.note + '\n\nShow it on the website anyway?')) return;
            docs = await api('PUT', '/documents/' + id, { published: !d.published }); toast(d.published ? 'Hidden from website' : 'Now on the website');
          }
          if (t.dataset.feat) docs = await api('PUT', '/documents/' + id, { featured: !d.featured });
          if (t.dataset.del && confirm('Delete this certificate?')) docs = await api('DELETE', '/documents/' + id);
          draw();
        } catch (ex) { fail(ex); }
      };
    },

    /* ---------- reviews ---------- */
    async reviews(main) {
      const { reviews, products } = await api('GET', '/reviews');
      let filter = reviews.some(r => r.status === 'pending') ? 'pending' : 'all';
      const productName = id => (products.find(p => p.id === id) || {}).name || '';
      function draw() {
        const count = k => reviews.filter(r => r.status === k).length;
        const live = reviews.filter(r => r.status === 'approved');
        const avg = live.length ? (live.reduce((s, r) => s + r.rating, 0) / live.length).toFixed(1) : '–';
        const list = filter === 'all' ? reviews : reviews.filter(r => r.status === filter);
        const TABS = [['pending', 'To check'], ['approved', 'Showing on website'], ['hidden', 'Hidden'], ['all', 'All']];
        main.innerHTML = `<div class="top"><h1>Reviews</h1><button class="btn" data-new>+ Add review</button></div>
          <div class="stats">
            <div class="stat"><b>${avg}</b><span>Average rating</span></div>
            <div class="stat"><b>${live.length}</b><span>Showing on website</span></div>
            <div class="stat"><b>${count('pending')}</b><span>To check</span></div>
            <div class="stat"><b>${live.filter(r => r.featured).length}</b><span>On home page</span></div>
          </div>
          <div class="seg">${TABS.map(([k, l]) => `<button data-filter="${k}"${k === filter ? ' class="on"' : ''}>${l}${k !== 'all' ? ` <em>${count(k)}</em>` : ''}</button>`).join('')}</div>
          <div class="rv-list">${list.length ? list.map(r => `<article class="rv ${esc(r.status)}">
            <div class="rv-head">${stars(r.rating)}<span class="tag ${r.status === 'approved' ? '' : r.status === 'pending' ? 'pending' : 'off'}">${r.status === 'approved' ? 'Showing' : r.status === 'pending' ? 'To check' : 'Hidden'}</span>${r.verified ? '<span class="tag">✓ Verified buyer</span>' : ''}${r.featured ? '<span class="tag gold">★ Home page</span>' : ''}</div>
            ${r.title ? `<h4>${esc(r.title)}</h4>` : ''}
            <p>${esc(r.text)}</p>
            ${r.photo ? `<img class="rv-photo" src="${esc(r.photo)}" alt="">` : ''}
            ${r.reply ? `<p class="rv-reply"><b>Your reply:</b> ${esc(r.reply)}</p>` : ''}
            <p class="muted rv-meta"><b>${esc(r.name)}</b>${r.city ? ', ' + esc(r.city) : ''} · ${esc(productName(r.productId) || r.productName)} · ${day(r.createdAt)} · ${esc(SOURCE[r.source] || r.source)}</p>
            <div class="actions">
              ${r.status !== 'approved' ? `<button class="btn sm" data-status="approved" data-id="${esc(r.id)}">Approve &amp; show</button>` : `<button class="btn ghost sm" data-status="hidden" data-id="${esc(r.id)}">Hide</button>`}
              ${r.status === 'approved' ? `<button class="btn ghost sm" data-feature="${r.featured ? '0' : '1'}" data-id="${esc(r.id)}">${r.featured ? 'Remove from home page' : 'Show on home page'}</button>` : ''}
              <button class="btn ghost sm" data-edit="${esc(r.id)}">Edit / reply</button>
              <button class="btn danger sm" data-del="${esc(r.id)}">Delete</button>
            </div>
          </article>`).join('') : `<div class="card"><p class="empty">${filter === 'pending' ? 'No reviews waiting. New reviews from customers appear here first, and only show on the website after you approve them.' : 'No reviews here yet. Customers can write one on each product page, or click “Add review” to add one a customer sent you.'}</p></div>`}</div>`;
      }
      draw();
      main.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        const r = reviews.find(x => x.id === t.dataset.id || x.id === t.dataset.edit || x.id === t.dataset.del);
        try {
          if (t.dataset.filter) { filter = t.dataset.filter; return draw(); }
          if ('new' in t.dataset) return reviewForm(null, products);
          if (t.dataset.edit) return reviewForm(r, products);
          if (t.dataset.status) { Object.assign(r, await api('PUT', '/reviews/' + r.id, { status: t.dataset.status })); toast(t.dataset.status === 'approved' ? 'Now showing on the website' : 'Hidden from the website'); return draw(); }
          if (t.dataset.feature) { Object.assign(r, await api('PUT', '/reviews/' + r.id, { featured: t.dataset.feature === '1' })); return draw(); }
          if (t.dataset.del && confirm('Delete this review permanently?')) { await api('DELETE', '/reviews/' + r.id); reviews.splice(reviews.indexOf(r), 1); draw(); }
        } catch (ex) { fail(ex); }
      };
    },

    /* ---------- dashboard ---------- */
    async dashboard(main) {
      const s = await api('GET', '/stats');
      main.innerHTML = `<div class="top"><h1>Dashboard</h1></div>
        <div class="stats">
          <div class="stat"><b>${s.newOrders}</b><span>New orders</span></div>
          <div class="stat"><b>${s.orders}</b><span>Total orders</span></div>
          <div class="stat"><b>${money(s.revenue)}</b><span>Order value</span></div>
          <div class="stat"><b>${s.products}</b><span>Products</span></div>
          <div class="stat"><b>${s.messages}</b><span>Messages</span></div>
          <div class="stat"><b>${s.pendingReviews || 0}</b><span>Reviews to check</span></div>
        </div>
        ${s.lowStock.length ? `<div class="card"><h3>Low stock</h3>${s.lowStock.map(p => `<p class="muted" style="margin:0">${esc(p.name)} — <b>${p.stock}</b> left</p>`).join('')}</div>` : ''}
        <div class="card"><h3>Recent orders</h3>${s.recent.length ? `<div class="table-wrap"><table>
          <tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr>
          ${s.recent.map(o => `<tr><td><b>${esc(o.number)}</b></td><td>${esc(o.customer.name)}</td><td>${money(o.total)}</td><td><span class="tag ${esc(o.status)}">${esc(o.status)}</span></td><td class="muted">${date(o.createdAt)}</td></tr>`).join('')}
        </table></div>` : '<p class="empty">No orders yet. They will appear here when customers place them.</p>'}</div>`;
    },

    /* ---------- products ---------- */
    async products(main) {
      const items = await api('GET', '/products');
      main.innerHTML = `<div class="top"><h1>Products</h1><button class="btn" data-new>+ Add product</button></div>
        <div class="card">${items.length ? `<div class="table-wrap"><table>
          <tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>
          ${items.map(p => `<tr>
            <td>${p.images[0] ? `<img class="thumb" src="${esc(p.images[0])}" alt="">` : ''}</td>
            <td><b>${esc(p.name)}</b><br><span class="muted">${esc([p.category, p.size].filter(Boolean).join(' · '))}</span></td>
            <td>${money(p.price)}${p.mrp > p.price ? ` <s class="muted">${money(p.mrp)}</s>` : ''}</td>
            <td>${p.stock}</td>
            <td><span class="tag${p.active ? '' : ' off'}">${p.active ? 'Live' : 'Hidden'}</span>${p.featured ? ' <span class="tag gold">Featured</span>' : ''}</td>
            <td class="actions"><a class="btn ghost sm" href="/product/${esc(p.slug)}" target="_blank" rel="noopener">View</a><button class="btn ghost sm" data-edit="${esc(p.id)}">Edit</button><button class="btn danger sm" data-del="${esc(p.id)}">Delete</button></td>
          </tr>`).join('')}</table></div>` : '<p class="empty">No products yet. Click “Add product” to create your first one.</p>'}</div>`;
      main.onclick = async e => {
        const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (e.target.closest('[data-new]')) productForm();
        if (ed) productForm(items.find(p => p.id === ed.dataset.edit));
        if (del && confirm('Delete this product? This cannot be undone.')) { await api('DELETE', '/products/' + del.dataset.del).catch(fail); go('products'); }
      };
    },

    /* ---------- orders ---------- */
    async orders(main) {
      const items = await api('GET', '/orders');
      const STATUS = ['pending', 'new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      const LABEL = { pending: 'awaiting payment' };
      const payTag = o => o.paymentStatus === 'paid' ? '<span class="tag">Paid</span>' : o.paymentStatus === 'pending' ? '<span class="tag new">Not paid</span>' : '';
      main.innerHTML = `<div class="top"><h1>Orders</h1></div>
        <div class="card">${items.length ? `<div class="table-wrap"><table>
          <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
          ${items.map(o => `<tr>
            <td><b>${esc(o.number)}</b><br><span class="muted">${date(o.createdAt)}</span></td>
            <td>${esc(o.customer.name)}<br><span class="muted">${esc(o.customer.phone)} · ${esc(o.customer.city)}</span></td>
            <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
            <td>${money(o.total)} ${payTag(o)}<br><span class="muted">${esc(o.payment)}</span></td>
            <td><select data-status="${esc(o.id)}">${STATUS.map(s => `<option value="${s}"${s === o.status ? ' selected' : ''}>${LABEL[s] || s}</option>`).join('')}</select></td>
            <td class="actions"><button class="btn ghost sm" data-open="${esc(o.id)}">Details</button></td>
          </tr>`).join('')}</table></div>` : '<p class="empty">No orders yet.</p>'}</div>`;
      main.onchange = async e => {
        const s = e.target.closest('[data-status]'); if (!s) return;
        try { await api('PUT', '/orders/' + s.dataset.status, { status: s.value }); toast('Order updated'); } catch (ex) { fail(ex); go('orders'); }
      };
      main.onclick = e => {
        const b = e.target.closest('[data-open]'); if (!b) return;
        const o = items.find(x => x.id === b.dataset.open), c = o.customer;
        openModal('Order ' + o.number, `<dl class="kv">
            <dt>Placed</dt><dd>${date(o.createdAt)}</dd>
            <dt>Customer</dt><dd>${esc(c.name)}</dd>
            <dt>Phone</dt><dd><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></dd>
            ${c.email ? `<dt>Email</dt><dd>${esc(c.email)}</dd>` : ''}
            ${c.altPhone ? `<dt>Alternate phone</dt><dd><a href="tel:${esc(c.altPhone)}">${esc(c.altPhone)}</a></dd>` : ''}
            <dt>Address${c.addressType ? ` (${esc(c.addressType)})` : ''}</dt><dd>${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} – ${esc(c.pincode)}${c.country ? ', ' + esc(c.country) : ''}</dd>
            ${'pinVerified' in c ? `<dt>PIN code</dt><dd>${c.pinVerified ? '<span class="tag">Verified with India Post</span>' : '<span class="tag off">Not confirmed – please check</span>'}</dd>` : ''}
            ${c.note ? `<dt>Customer note</dt><dd>${esc(c.note)}</dd>` : ''}
            <dt>Payment</dt><dd>${esc(o.payment)} ${payTag(o)}</dd>
            ${o.gatewayRef ? `<dt>Gateway reference</dt><dd>${esc(o.gatewayPaymentId || o.gatewayRef)}</dd>` : ''}
          </dl>
          <table>
            <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
            ${o.items.map(i => `<tr><td>${esc(i.name)} <span class="muted">${esc(i.size || '')}</span></td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}
            ${(o.discounts || []).map(d => `<tr><td colspan="2">${esc(d.label)}</td><td>− ${money(d.amount)}</td></tr>`).join('')}
            <tr><td colspan="2">Shipping</td><td>${o.shipping ? money(o.shipping) : 'Free'}</td></tr>
            <tr><td colspan="2"><b>Total</b></td><td><b>${money(o.total)}</b></td></tr>
          </table>
          <div class="form-actions"><button class="btn danger" data-del-order>Delete order</button>${o.paymentStatus === 'pending' ? '<button class="btn ghost" data-check-pay>Check payment</button>' : ''}<button class="btn ghost" onclick="window.print()">Print</button><button class="btn" data-close>Close</button></div>`);
        const chk = modal.querySelector('[data-check-pay]');
        if (chk) chk.onclick = async () => {
          chk.disabled = true; chk.textContent = 'Checking…';
          try {
            const r = await api('POST', '/orders/' + o.id + '/check-payment');
            toast(r.paymentStatus === 'paid' ? 'Payment received — order is now confirmed as paid' : 'No payment found for this order yet');
            closeModal(); go('orders');
          } catch (ex) { fail(ex); chk.disabled = false; chk.textContent = 'Check payment'; }
        };
        modal.querySelector('[data-del-order]').onclick = async () => {
          if (!confirm('Delete this order permanently?')) return;
          await api('DELETE', '/orders/' + o.id).catch(fail); closeModal(); go('orders');
        };
      };
    },

    /* ---------- pages ---------- */
    async pages(main) {
      const items = await api('GET', '/pages');
      main.innerHTML = `<div class="top"><h1>Pages</h1><button class="btn" data-new>+ Add page</button></div>
        <div class="card">${items.length ? `<div class="table-wrap"><table>
          <tr><th>Title</th><th>Link</th><th>Shown in</th><th></th></tr>
          ${items.map(p => `<tr><td><b>${esc(p.title)}</b></td><td><a href="/page/${esc(p.slug)}" target="_blank" rel="noopener">/page/${esc(p.slug)}</a></td>
            <td>${[p.showInMenu && 'Menu', p.showInFooter && 'Footer'].filter(Boolean).join(', ') || '—'}</td>
            <td class="actions"><button class="btn ghost sm" data-edit="${esc(p.id)}">Edit</button><button class="btn danger sm" data-del="${esc(p.id)}">Delete</button></td></tr>`).join('')}
        </table></div>` : '<p class="empty">No pages yet.</p>'}</div>`;
      const form = pg => {
        openModal(pg ? 'Edit page' : 'Add page', `<form id="pgForm"><div class="fields">
            ${field('Title', 'title', pg?.title, { attrs: 'required' })}
            ${field('Link name (optional)', 'slug', pg?.slug, { hint: 'Used in the page address, e.g. about' })}
            ${area('Content', 'content', pg?.content, { rows: 12, hint: 'Leave an empty line between paragraphs.' })}
            <div class="field full checks">${check('Show in top menu', 'showInMenu', pg?.showInMenu)}${check('Show in footer', 'showInFooter', pg ? pg.showInFooter : true)}</div>
          </div><p class="error" hidden></p>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save page</button></div></form>`);
        modal.querySelector('#pgForm').onsubmit = async e => {
          e.preventDefault();
          try { await api(pg ? 'PUT' : 'POST', '/pages' + (pg ? '/' + pg.id : ''), formData(e.target)); closeModal(); toast('Page saved'); go('pages'); }
          catch (ex) { const er = modal.querySelector('.error'); er.textContent = ex.message; er.hidden = false; }
        };
      };
      main.onclick = async e => {
        const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (e.target.closest('[data-new]')) form();
        if (ed) form(items.find(p => p.id === ed.dataset.edit));
        if (del && confirm('Delete this page?')) { await api('DELETE', '/pages/' + del.dataset.del).catch(fail); go('pages'); }
      };
    },

    /* ---------- messages ---------- */
    async messages(main) {
      const items = await api('GET', '/messages');
      main.innerHTML = `<div class="top"><h1>Messages</h1></div>
        ${items.length ? items.map(m => `<div class="card"><div class="top" style="margin-bottom:8px"><div><b>${esc(m.name)}</b> <span class="muted">· ${esc([m.phone, m.email].filter(Boolean).join(' · '))} · ${date(m.createdAt)}</span></div><button class="btn danger sm" data-del="${esc(m.id)}">Delete</button></div><div style="white-space:pre-wrap">${esc(m.message)}</div></div>`).join('') : '<div class="card"><p class="empty">No messages yet. Messages from the Contact page appear here.</p></div>'}`;
      main.onclick = async e => {
        const del = e.target.closest('[data-del]');
        if (del && confirm('Delete this message?')) { await api('DELETE', '/messages/' + del.dataset.del).catch(fail); go('messages'); }
      };
    },

    /* ---------- settings ---------- */
    async settings(main) {
      const s = await api('GET', '/settings');
      const hero = s.heroImage ? [s.heroImage] : [], logo = s.logoImage ? [s.logoImage] : [];
      main.innerHTML = `<form id="setForm"><div class="top"><h1>Site Settings</h1><button class="btn">Save changes</button></div>
        <div class="card"><h3>Header &amp; logo</h3><div class="fields">
          ${field('Store name', 'siteName', s.siteName)}
          ${field('Top announcement bar', 'announcement', s.announcement, { hint: 'The line above the header, e.g. “Purely herbal, made by hand.” Leave empty to hide.' })}
          <label class="field"><span>Logo style</span><select name="logoStyle">
            <option value="script"${s.logoStyle !== 'image' ? ' selected' : ''}>Handwritten wordmark</option>
            <option value="image"${s.logoStyle === 'image' ? ' selected' : ''}>Uploaded logo image</option>
          </select><small>The wordmark writes your name in an elegant script font with a swash underline.</small></label>
          ${field('Wordmark text', 'logoText', s.logoText, { hint: 'Leave empty to use the store name.', attrs: `placeholder="${esc(s.siteName)}" maxlength="40"` })}
          <div class="field"><span>Wordmark</span>${check('Show ™ after the name', 'logoTm', s.logoTm !== false)}</div>
          <div class="field full"><span>Logo image (used when “Uploaded logo image” is chosen)</span><div class="images" id="logoPick"></div></div>
          ${field('Footer note', 'footerNote', s.footerNote, { full: true })}
        </div></div>
        <div class="card"><h3>WhatsApp chat button</h3><div class="fields">
          <div class="field"><span>Show the button</span>${check('Show the WhatsApp chat button on the website', 'waEnabled', s.waEnabled !== false)}</div>
          ${field('WhatsApp number', 'whatsapp', s.whatsapp, { hint: 'Your WhatsApp number with country code, e.g. 919876543210 (a 10-digit mobile gets +91 added). The button only appears when this is filled.', attrs: 'inputmode="numeric" maxlength="16"' })}
          ${area('Message typed in for the customer', 'waMessage', s.waMessage, { rows: 2, hint: 'Opens in WhatsApp ready to send. On a product page the product name is added automatically.' })}
          ${field('Button text', 'waLabel', s.waLabel, { hint: 'Shown next to the icon on computers. Leave empty for the round icon only.', attrs: 'maxlength="40"' })}
          <label class="field"><span>Button position</span><select name="waPosition"><option value="right"${s.waPosition !== 'left' ? ' selected' : ''}>Bottom right</option><option value="left"${s.waPosition === 'left' ? ' selected' : ''}>Bottom left</option></select></label>
          ${area('Greeting bubble', 'waBubble', s.waBubble, { rows: 2, hint: 'A small message that pops up once, a few seconds after a visitor arrives. Leave empty to turn it off.' })}
          ${s.whatsapp ? `<div class="field full"><span>Test it</span><a class="btn ghost sm" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">Open my WhatsApp chat link ↗</a></div>` : ''}
        </div></div>
        <div class="card"><h3>Home page</h3><div class="fields">
          ${field('Hero small heading', 'heroKicker', s.heroKicker)}
          ${field('Hero button text', 'heroCta', s.heroCta)}
          ${field('Hero main heading', 'heroTitle', s.heroTitle, { full: true })}
          ${area('Hero text', 'heroSubtitle', s.heroSubtitle, { rows: 2 })}
          <div class="field full"><span>Hero image (white background works best)</span><div class="images" id="heroPick"></div></div>
          ${field('Intro small heading', 'introKicker', s.introKicker)}
          ${field('Intro heading', 'introTitle', s.introTitle)}
          ${area('Intro text', 'introText', s.introText, { rows: 3 })}
          ${field('Herbs strip heading', 'herbsTitle', s.herbsTitle, { hint: 'The home page showcases the product marked “Featured”.' })}
        </div></div>
        <div class="card"><h3>Home page — our story</h3><div class="fields">
          ${field('Small heading', 'storyKicker', s.storyKicker)}
          ${field('Heading', 'storyTitle', s.storyTitle)}
          ${area('Story', 'storyText', s.storyText, { rows: 9, hint: 'Leave an empty line between paragraphs. Put **two stars** around words to make them bold. Leave the story empty to hide this section.' })}
          ${field('Signature', 'storySign', s.storySign)}
          ${field('Line under the photo', 'storyCaption', s.storyCaption)}
          <div class="field full"><span>Photo</span><div class="images" id="storyPick"></div></div>
        </div></div>
        <div class="card"><h3>Home page — video</h3><div class="fields">
          ${field('Small heading', 'videoKicker', s.videoKicker, { hint: 'Leave empty to show “Watch”.' })}
          ${field('Heading', 'videoTitle', s.videoTitle, { hint: 'Leave empty to show “See how it is made”.' })}
          ${field('Video link', 'videoUrl', s.videoUrl, { hint: 'Open the video on YouTube, click Share → Copy, and paste the link here (e.g. https://youtu.be/abc123). A direct .mp4 link also works. To change the video, paste a new link and save. While this is empty, the section shows a slideshow of your product photos.' })}
          ${field('Text under the video', 'videoCaption', s.videoCaption, { hint: 'Also shown on top of the photo slideshow. Leave empty to show “From her kitchen to your home”.' })}
        </div></div>
        <div class="card"><h3>Home page — why choose us</h3><div class="fields">
          ${field('Small heading', 'whyKicker', s.whyKicker)}
          ${field('Heading', 'whyTitle', s.whyTitle)}
          ${area('Points — one per line', 'whyLines', s.whyLines, { rows: 6, hint: 'Write each point as: Title – explanation. Up to 8 points. Leave empty to hide this section.' })}
        </div></div>
        <div class="card"><h3>Home page — highlights &amp; journey</h3><div class="fields">
          ${area('Highlight numbers — one per line', 'statsLines', s.statsLines, { rows: 3, hint: 'Format: Number: label — e.g. 9: Powerful herbs. Numbers count up when the visitor scrolls to them. Leave empty to hide.' })}
          ${field('Journey small heading', 'journeyKicker', s.journeyKicker)}
          ${field('Journey heading', 'journeyTitle', s.journeyTitle)}
          ${area('Journey steps — one per line (up to 5)', 'journeySteps', s.journeySteps, { rows: 5, hint: 'Format: Step title: description. The animated scene uses the featured product’s main image and ingredient photos. Leave empty to hide the journey.' })}
        </div></div>
        <div class="card"><h3>Contact details</h3><div class="fields">
          ${field('Email', 'email', s.email, { type: 'email' })}
          ${field('Phone', 'phone', s.phone)}
          ${field('Address', 'address', s.address)}
          ${field('Instagram link', 'instagram', s.instagram, { type: 'url', attrs: 'placeholder="https://"' })}
          ${field('Facebook link', 'facebook', s.facebook, { type: 'url', attrs: 'placeholder="https://"' })}
          ${field('YouTube link', 'youtube', s.youtube, { type: 'url', attrs: 'placeholder="https://"' })}
        </div></div>
        <div class="card"><h3>Shipping</h3><div class="fields">
          ${field('Shipping charge (₹)', 'shippingFee', s.shippingFee, { type: 'number', attrs: 'min="0"', hint: '0 = free shipping.' })}
          ${field('Free shipping above (₹)', 'freeShippingAbove', s.freeShippingAbove, { type: 'number', attrs: 'min="0"', hint: '0 = not used.' })}
          <p class="field full muted">Payment methods (Cash on Delivery, Razorpay, Stripe, Cashfree) are managed under <b>Payments</b>.</p>
        </div></div>
        <div class="form-actions"><button class="btn">Save changes</button></div></form>`;
      imagePicker(main.querySelector('#heroPick'), hero, { multiple: false });
      imagePicker(main.querySelector('#logoPick'), logo, { multiple: false });
      const story = s.storyImage ? [s.storyImage] : [];
      imagePicker(main.querySelector('#storyPick'), story, { multiple: false });
      main.querySelector('#setForm').onsubmit = async e => {
        e.preventDefault();
        try { await api('PUT', '/settings', { ...formData(e.target), heroImage: hero[0] || '', logoImage: logo[0] || '', storyImage: story[0] || '' }); toast('Settings saved'); }
        catch (ex) { fail(ex); }
      };
    },

    /* ---------- offers & coupons ---------- */
    async offers(main) {
      let o = await api('GET', '/offers');
      const now = () => Date.now();
      const cState = c => !c.active ? '<span class="tag off">Off</span>'
        : c.starts && now() < Date.parse(c.starts) ? '<span class="tag new">Scheduled</span>'
        : c.expires && now() > Date.parse(c.expires) ? '<span class="tag off">Expired</span>'
        : c.maxUses && c.used >= c.maxUses ? '<span class="tag off">Used up</span>' : '<span class="tag">Active</span>';
      const pname = id => (o.products.find(p => p.id === id) || {}).name || '';
      // same wording the shopper sees
      const summary = c => {
        const what = c.type === 'shipping' ? 'Free delivery' : c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` (up to ${money(c.maxDiscount)})` : ''}` : `${money(c.value)} off`;
        return what + (c.products && c.products.length ? ` on ${c.products.map(pname).filter(Boolean).join(', ')}` : '') + (c.minOrder ? ` on orders above ${money(c.minOrder)}` : '');
      };
      const rules = c => [
        c.perCustomer ? `${c.perCustomer}× per customer` : '', c.firstOrder ? 'First order only' : '',
        c.combine === false ? 'Not with Buy-more offer' : '', c.starts ? 'From ' + date(c.starts) : '', c.expires ? 'Until ' + date(c.expires) : ''
      ].filter(Boolean).map(r => `<span class="rule">${esc(r)}</span>`).join('');
      const csv = codes => 'data:text/csv;charset=utf-8,' + encodeURIComponent('Coupon code\n' + codes.join('\n'));

      const draw = () => {
        const singles = o.coupons.filter(c => !c.batch);
        const batches = {};
        o.coupons.filter(c => c.batch).forEach(c => { (batches[c.batch] = batches[c.batch] || []).push(c); });
        const stat = code => o.stats[code] || { orders: 0, revenue: 0, discount: 0 };
        main.innerHTML = `<div class="top"><h1>Offers &amp; Coupons</h1><div class="actions"><button class="btn ghost" data-batch>Generate batch of codes</button><button class="btn" data-new>+ Add coupon</button></div></div>
        <div class="card"><p class="muted" style="margin:0"><b>Product sale price:</b> open <b>Products → Edit</b> and set the selling price below the M.R.P. Coupons and the offers below apply on top of that, in the cart and at payment — the discounted total is what Razorpay, Stripe or Cashfree charge.</p></div>

        <div class="card"><h3>Coupon codes</h3>${singles.length ? `<div class="table-wrap"><table class="coupons-table">
          <tr><th>Code</th><th>Discount</th><th>Rules</th><th>Used</th><th>Results</th><th>Status</th><th></th></tr>
          ${singles.map(c => { const s = stat(c.code); return `<tr>
            <td><b class="code">${esc(c.code)}</b>${c.showOnSite ? '<br><span class="tag gold">Shown on site</span>' : ''}${c.label ? `<br><span class="muted">${esc(c.label)}</span>` : ''}</td>
            <td>${esc(summary(c))}</td>
            <td class="rules">${rules(c) || '<span class="muted">—</span>'}</td>
            <td>${c.used}${c.maxUses ? ' / ' + c.maxUses : ''}</td>
            <td>${s.orders ? `${s.orders} order${s.orders > 1 ? 's' : ''}<br><span class="muted">${money(s.revenue)} sales · ${money(s.discount)} given</span>` : '<span class="muted">No orders yet</span>'}</td>
            <td>${cState(c)}</td>
            <td class="actions"><button class="btn ghost sm" data-toggle="${esc(c.id)}">${c.active ? 'Turn off' : 'Turn on'}</button><button class="btn ghost sm" data-edit="${esc(c.id)}">Edit</button><button class="btn ghost sm" data-copy="${esc(c.id)}">Duplicate</button><button class="btn danger sm" data-del="${esc(c.id)}">Delete</button></td></tr>`; }).join('')}
        </table></div>` : '<p class="empty">No coupons yet. Click “Add coupon” to create one, e.g. WELCOME10 for 10% off the first order.</p>'}</div>

        ${Object.keys(batches).length ? `<div class="card"><h3>Batches of single-use codes</h3><div class="table-wrap"><table>
          <tr><th>Batch</th><th>Discount</th><th>Codes</th><th>Used</th><th></th></tr>
          ${Object.entries(batches).map(([id, list]) => `<tr><td><b>${esc(list[0].batchName || 'Batch')}</b><br><span class="muted">${date(list[0].createdAt)}</span></td><td>${esc(summary(list[0]))}</td><td>${list.length}</td><td>${list.filter(c => c.used).length}</td>
            <td class="actions"><a class="btn ghost sm" download="${esc((list[0].batchName || 'coupons').replace(/[^\w-]+/g, '-'))}.csv" href="${csv(list.filter(c => !c.used).map(c => c.code))}">Download unused codes</a><button class="btn danger sm" data-del-batch="${esc(id)}">Delete batch</button></td></tr>`).join('')}
        </table></div></div>` : ''}

        <form class="card" id="checkForm"><h3>Check a coupon code</h3>
          <p class="muted" style="margin-top:-6px">Test any code exactly as a customer would at checkout — see whether it works and the final price.</p>
          <div class="fields check-grid">
            ${field('Coupon code', 'code', '', { attrs: 'required maxlength="30" style="text-transform:uppercase" placeholder="WELCOME10"' })}
            <label class="field"><span>Product</span><select name="productId">${o.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${money(p.price)})</option>`).join('')}</select></label>
            ${field('Quantity', 'qty', 1, { type: 'number', attrs: 'min="1" max="99"' })}
            <label class="field"><span>Payment</span><select name="method"><option value="cod">Cash on Delivery</option><option value="online">Online payment</option></select></label>
            ${field('Customer mobile (optional)', 'phone', '', { attrs: 'inputmode="numeric" maxlength="13"', hint: 'Checks “per customer” and “first order only” rules.' })}
          </div>
          <div class="form-actions" style="justify-content:flex-start"><button class="btn">Check code</button></div>
          <div id="checkOut"></div>
        </form>

        <form class="card" id="autoForm"><h3>Automatic offers</h3><div class="fields">
          ${area('Buy more, save more — one rule per line', 'bulkTiers', o.bulkTiers, { rows: 3, hint: 'Format: quantity: percent off — e.g. “2: 5” gives 5% off when the cart has 2 or more items, “3: 10” gives 10% off for 3 or more. Shown as pack choices on the product page. Leave empty to switch off.' })}
          ${field('Extra discount for online payment (%)', 'prepaidPercent', o.prepaidPercent, { type: 'number', attrs: 'min="0" max="50" step="1"', hint: '0 = off. Encourages prepaid orders over Cash on Delivery. Needs a payment gateway switched on.' })}
          ${area('Trust points under the Buy button — one per line', 'trustLines', o.trustLines, { rows: 3, hint: 'Short and true, e.g. 100% Natural. Cash on Delivery and Secure online payment are added automatically when enabled.' })}
        </div><div class="form-actions"><button class="btn">Save offers</button></div></form>`;
      };

      // the discount rules, shared by the single-coupon form and the batch generator
      const ruleFields = c => `
        <label class="field"><span>Discount type</span><select name="type" data-type>
          <option value="percent"${!c || c.type === 'percent' ? ' selected' : ''}>Percent off (%)</option>
          <option value="flat"${c && c.type === 'flat' ? ' selected' : ''}>Flat amount off (₹)</option>
          <option value="shipping"${c && c.type === 'shipping' ? ' selected' : ''}>Free delivery</option></select></label>
        <div data-only="percent flat">${field('Discount value', 'value', c ? c.value : '', { type: 'number', attrs: 'min="1" step="1"', hint: 'e.g. 10 for 10% off, or 50 for ₹50 off.' })}</div>
        <div data-only="percent">${field('Maximum discount (₹)', 'maxDiscount', c ? c.maxDiscount || 0 : 0, { type: 'number', attrs: 'min="0" step="1"', hint: '0 = no limit. e.g. 20% off, up to ₹100.' })}</div>
        ${field('Minimum order (₹)', 'minOrder', c ? c.minOrder : 0, { type: 'number', attrs: 'min="0" step="1"', hint: '0 = no minimum.' })}
        ${field('Starts (optional)', 'starts', toLocalInput(c && c.starts), { type: 'datetime-local', hint: 'Leave empty to start now.' })}
        ${field('Ends (optional)', 'expires', toLocalInput(c && c.expires), { type: 'datetime-local', hint: 'Shown to shoppers as “Ends …”.' })}
        <div class="field full"><span>Works on</span><div class="checks">${o.products.map(p => `<label class="check"><input type="checkbox" name="products" value="${esc(p.id)}"${c && c.products && c.products.includes(p.id) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('')}</div><small>Tick nothing to let it work on every product.</small></div>`;
      const wireType = form => {
        const sync = () => { const t = form.querySelector('[data-type]').value; form.querySelectorAll('[data-only]').forEach(el => { el.hidden = !el.dataset.only.split(' ').includes(t); }); };
        form.querySelector('[data-type]').addEventListener('change', sync); sync();
      };
      const readRules = form => {
        const d = formData(form);
        d.products = [...form.querySelectorAll('input[name=products]:checked')].map(i => i.value);
        d.starts = fromLocalInput(form.starts.value); d.expires = fromLocalInput(form.expires.value);
        return d;
      };

      const couponForm = (c, copy) => {
        openModal(c && !copy ? 'Edit coupon' : 'Add coupon', `<form id="cForm"><div class="fields">
            <label class="field"><span>Coupon code</span><div class="code-row"><input name="code" value="${esc(copy ? '' : c ? c.code : '')}" required maxlength="30" placeholder="WELCOME10" style="text-transform:uppercase"><button type="button" class="btn ghost sm" data-gen>Generate</button></div><small>Letters and numbers only. “Generate” makes a random, easy-to-read code.</small></label>
            ${field('Description for shoppers (optional)', 'label', c ? c.label : '', { attrs: 'maxlength="80" placeholder="e.g. Diwali offer — 15% off"', hint: 'Leave empty to describe it automatically.' })}
            ${ruleFields(c)}
            ${field('Total uses allowed', 'maxUses', c ? c.maxUses : 0, { type: 'number', attrs: 'min="0" step="1"', hint: '0 = unlimited.' })}
            ${field('Uses per customer', 'perCustomer', c ? c.perCustomer || 0 : 0, { type: 'number', attrs: 'min="0" step="1"', hint: 'Checked by mobile number. 1 = once per customer, 0 = no limit.' })}
            <div class="field full checks">
              ${check('First order only', 'firstOrder', c && c.firstOrder)}
              ${check('Can be combined with the Buy-more offer', 'combine', !c || c.combine !== false)}
              ${check('Active', 'active', c ? c.active : true)}
              ${check('Show on the product page and in the cart', 'showOnSite', c && c.showOnSite)}
            </div>
            <p class="preview-line full" data-preview></p>
          </div><p class="error" hidden></p>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save coupon</button></div></form>`);
        const form = modal.querySelector('#cForm');
        wireType(form);
        const prev = () => { const d = readRules(form); d.value = +d.value || 0; d.maxDiscount = +d.maxDiscount || 0; d.minOrder = +d.minOrder || 0; form.querySelector('[data-preview]').textContent = 'Shoppers see: ' + (d.label || summary(d)) + (d.firstOrder ? ' · first order only' : ''); };
        form.addEventListener('input', prev); form.addEventListener('change', prev); prev();
        form.querySelector('[data-gen]').onclick = async () => {
          try { const r = await api('POST', '/coupons/generate', { prefix: form.code.value.replace(/[^a-z]/gi, '').slice(0, 8) || 'RS', length: 5 }); form.code.value = r.code; }
          catch (ex) { fail(ex); }
        };
        form.onsubmit = async e => {
          e.preventDefault();
          try {
            o = await api(c && !copy ? 'PUT' : 'POST', '/coupons' + (c && !copy ? '/' + c.id : ''), readRules(form));
            closeModal(); draw(); toast('Coupon saved');
          } catch (ex) { const er = modal.querySelector('.error'); er.textContent = ex.message; er.hidden = false; }
        };
      };

      const batchForm = () => {
        openModal('Generate a batch of codes', `<form id="bForm">
          <p class="note" style="background:var(--leaf-soft);border-color:#cfe3b0;color:var(--green-2)">Creates many different codes that each work <b>once</b> — ideal for influencers, WhatsApp customers or printed cards in the parcel. A shared code can't be reused.</p>
          <div class="fields">
            ${field('Batch name', 'batchName', '', { attrs: 'maxlength="60" placeholder="e.g. Instagram — Priya"' })}
            ${field('Code starts with', 'prefix', 'RS', { attrs: 'maxlength="12" style="text-transform:uppercase"', hint: 'e.g. RS gives codes like RS7KQ4M.' })}
            ${field('How many codes', 'count', 20, { type: 'number', attrs: 'min="1" max="500"' })}
            ${field('Random characters per code', 'length', 5, { type: 'number', attrs: 'min="4" max="12"' })}
            ${ruleFields(null)}
            <div class="field full checks">${check('First order only', 'firstOrder', false)}${check('Can be combined with the Buy-more offer', 'combine', true)}${check('Active', 'active', true)}</div>
          </div><p class="error" hidden></p>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Generate codes</button></div></form>`);
        const form = modal.querySelector('#bForm');
        wireType(form);
        form.onsubmit = async e => {
          e.preventDefault();
          const btn = form.querySelector('button:not([type])'); btn.disabled = true; btn.textContent = 'Generating…';
          try {
            const r = await api('POST', '/coupons/generate', { ...readRules(form), create: true });
            o = r; draw();
            openModal(`${r.codes.length} codes ready`, `<p>Each code works once. Copy them or download the list to share.</p>
              <textarea class="codes-out" rows="10" readonly>${esc(r.codes.join('\n'))}</textarea>
              <div class="form-actions"><button type="button" class="btn ghost" data-copy-codes>Copy all</button><a class="btn ghost" download="coupon-codes.csv" href="${csv(r.codes)}">Download CSV</a><button type="button" class="btn" data-close>Done</button></div>`);
            modal.querySelector('[data-copy-codes]').onclick = () => { navigator.clipboard.writeText(r.codes.join('\n')).then(() => toast('Codes copied'), () => toast('Select the codes and copy them', true)); };
          } catch (ex) { const er = modal.querySelector('.error'); if (er) { er.textContent = ex.message; er.hidden = false; } btn.disabled = false; btn.textContent = 'Generate codes'; }
        };
      };

      draw();
      main.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return;
        const find = id => o.coupons.find(c => c.id === id);
        try {
          if ('new' in t.dataset) couponForm();
          if ('batch' in t.dataset) batchForm();
          if (t.dataset.edit) couponForm(find(t.dataset.edit));
          if (t.dataset.copy) couponForm(find(t.dataset.copy), true);
          if (t.dataset.toggle) { const c = find(t.dataset.toggle); o = await api('PUT', '/coupons/' + c.id, { active: !c.active }); draw(); toast(c.active ? 'Coupon turned off' : 'Coupon turned on'); }
          if (t.dataset.del && confirm('Delete this coupon?')) { o = await api('DELETE', '/coupons/' + t.dataset.del); draw(); }
          if (t.dataset.delBatch && confirm('Delete every code in this batch?')) { o = await api('DELETE', '/coupons/batch/' + t.dataset.delBatch); draw(); }
        } catch (ex) { fail(ex); }
      });
      main.addEventListener('submit', async e => {
        e.preventDefault();
        if (e.target.id === 'autoForm') {
          try { o = await api('PUT', '/offers', formData(e.target)); draw(); toast('Offers saved'); } catch (ex) { fail(ex); }
        }
        if (e.target.id === 'checkForm') {
          const out = e.target.querySelector('#checkOut');
          const d = formData(e.target);
          try {
            const r = await api('POST', '/coupons/check', d);
            out.innerHTML = `<div class="check-result ${r.valid ? 'ok' : 'bad'}">
              <p class="verdict">${r.valid ? `✓ <b>${esc(r.code)}</b> works` : `✗ <b>${esc(r.code)}</b> ${r.exists ? 'can’t be used here' : 'does not exist'}`}</p>
              ${r.error ? `<p>${esc(r.error)}</p>` : ''}${r.note ? `<p>${esc(r.note)}</p>` : ''}
              ${r.summary ? `<p class="muted">${esc(r.summary)} · used ${r.used}${r.maxUses ? ' of ' + r.maxUses : ''} times</p>` : ''}
              <table class="mini"><tr><td>${esc(r.cart)}</td><td>${money(r.subtotal)}</td></tr>
                ${r.discounts.map(x => `<tr><td>${esc(x.label)}</td><td>− ${money(x.amount)}</td></tr>`).join('')}
                <tr><td>Delivery</td><td>${r.shipping ? money(r.shipping) : 'Free'}</td></tr>
                <tr class="total"><td>Customer pays</td><td>${money(r.total)}</td></tr></table></div>`;
          } catch (ex) { out.innerHTML = `<p class="error">${esc(ex.message)}</p>`; }
        }
      });
    },


    /* ---------- payments ---------- */
    async payments(main) {
      let p = await api('GET', '/payments');
      const secret = (label, name, set) => field(label, name, '', { type: 'password', attrs: `autocomplete="off" placeholder="${set ? '•••••••• saved — leave empty to keep' : 'Paste here'}"` });
      const state = (g, live) => !g.secretSet ? '<span class="tag off">Not set up</span>' : `<span class="tag${g.enabled ? '' : ' off'}">${g.enabled ? 'On' : 'Off'}</span> <span class="tag ${live ? 'gold' : 'confirmed'}">${live ? 'Live mode' : 'Test mode'}</span>`;
      const actions = g => `<div class="form-actions"><span class="result muted" data-result="${g}"></span>${p[g].secretSet ? `<button type="button" class="btn danger" data-remove="${g}">Remove keys</button>` : ''}<button type="button" class="btn ghost" data-test="${g}">Save &amp; test connection</button><button class="btn">Save</button></div>`;
      const draw = () => {
        main.innerHTML = `<div class="top"><h1>Payments</h1></div>
        <div class="card"><p class="muted" style="margin:0">Turn on any payment method by pasting its keys below — no coding needed. Start with the gateway’s <b>test keys</b>, press <b>Save &amp; test connection</b>, place a test order on your website, then replace them with your <b>live keys</b> when you are ready to accept real money.</p></div>

        <form class="card" data-g="cod"><h3>Cash on Delivery</h3>
          <div class="checks">${check('Accept Cash on Delivery orders', 'enabled', p.codEnabled)}</div>
          <div class="form-actions"><button class="btn">Save</button></div></form>

        <form class="card" data-g="razorpay"><div class="top" style="margin-bottom:6px"><h3 style="margin:0">Razorpay</h3><div>${state(p.razorpay, p.razorpay.live)}</div></div>
          <p class="muted">UPI, cards, netbanking and wallets. Get keys from Razorpay Dashboard → Account &amp; Settings → API Keys. Test keys start with <code>rzp_test_</code>.</p>
          <div class="fields">${field('Key ID', 'keyId', p.razorpay.keyId, { attrs: 'autocomplete="off" placeholder="rzp_test_…"' })}${secret('Key Secret', 'keySecret', p.razorpay.secretSet)}
          <div class="field full checks">${check('Show Razorpay at checkout', 'enabled', p.razorpay.enabled)}</div></div>${actions('razorpay')}</form>

        <form class="card" data-g="cashfree"><div class="top" style="margin-bottom:6px"><h3 style="margin:0">Cashfree Payments</h3><div>${state(p.cashfree, p.cashfree.mode === 'live')}</div></div>
          <p class="muted">UPI, cards, netbanking and wallets. Get keys from Cashfree Dashboard → Developers → API Keys. Choose the mode that matches your keys.</p>
          <div class="fields">${field('App ID (Client ID)', 'appId', p.cashfree.appId, { attrs: 'autocomplete="off"' })}${secret('Secret Key (Client Secret)', 'secretKey', p.cashfree.secretSet)}
          <label class="field"><span>Mode</span><select name="mode"><option value="test"${p.cashfree.mode === 'live' ? '' : ' selected'}>Test (sandbox)</option><option value="live"${p.cashfree.mode === 'live' ? ' selected' : ''}>Live (production)</option></select></label>
          <div class="field checks">${check('Show Cashfree at checkout', 'enabled', p.cashfree.enabled)}</div></div>${actions('cashfree')}</form>

        <form class="card" data-g="stripe"><div class="top" style="margin-bottom:6px"><h3 style="margin:0">Stripe</h3><div>${state(p.stripe, p.stripe.live)}</div></div>
          <p class="muted">Card payments on Stripe’s secure page. Get the key from Stripe Dashboard → Developers → API keys. Test keys start with <code>sk_test_</code>.</p>
          <div class="fields">${secret('Secret key', 'secretKey', p.stripe.secretSet)}
          <div class="field checks">${check('Show Stripe at checkout', 'enabled', p.stripe.enabled)}</div></div>${actions('stripe')}</form>`;
      };
      const saveForm = async form => {
        const g = form.dataset.g, d = formData(form);
        const body = g === 'cod' ? { codEnabled: d.enabled } : { [g]: d };
        p = await api('PUT', '/payments', body);
        return p.warning;
      };
      draw();
      main.addEventListener('submit', async e => {
        e.preventDefault();
        try { const warn = await saveForm(e.target); draw(); toast(warn || 'Saved', !!warn); } catch (ex) { fail(ex); }
      });
      main.addEventListener('click', async e => {
        const t = e.target.closest('[data-test]'), rm = e.target.closest('[data-remove]');
        if (rm && confirm('Remove the saved keys and switch this payment method off?')) {
          try { p = await api('DELETE', '/payments/' + rm.dataset.remove); draw(); toast('Keys removed'); } catch (ex) { fail(ex); }
        }
        if (!t) return;
        const g = t.dataset.test;
        try {
          await saveForm(t.closest('form')); draw();
          const out = main.querySelector(`[data-result="${g}"]`);
          out.textContent = 'Testing…';
          try { const r = await api('POST', '/payments/test/' + g); out.textContent = '✔ ' + r.message; out.className = 'result good'; }
          catch (ex) { out.textContent = '✖ ' + ex.message; out.className = 'result bad'; }
        } catch (ex) { fail(ex); }
      });
    },

    /* ---------- account ---------- */
    async account(main) {
      main.innerHTML = `<div class="top"><h1>Account</h1></div>
        <div class="card" style="max-width:460px"><h3>Change password</h3><p class="muted">Signed in as <b>${esc(me.username)}</b></p>
        <form id="pwForm"><div class="fields" style="grid-template-columns:1fr">
          ${field('Current password', 'current', '', { type: 'password', attrs: 'required autocomplete="current-password"' })}
          ${field('New password', 'next', '', { type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 8 characters.' })}
        </div><div class="form-actions"><button class="btn">Update password</button></div></form></div>`;
      main.querySelector('#pwForm').onsubmit = async e => {
        e.preventDefault();
        try { await api('POST', '/password', formData(e.target)); e.target.reset(); toast('Password updated'); } catch (ex) { fail(ex); }
      };
    }
  };

  /* ---------- product form ---------- */
  function productForm(p) {
    const images = p ? [...p.images] : [];
    const lines = a => (a || []).join('\n');
    openModal(p ? 'Edit product' : 'Add product', `<form id="pForm"><div class="fields">
        ${field('Product name', 'name', p?.name, { full: true, attrs: 'required' })}
        ${field('Selling price (₹)', 'price', p?.price ?? '', { type: 'number', attrs: 'required min="0" step="1"' })}
        ${field('M.R.P. (₹)', 'mrp', p?.mrp ?? '', { type: 'number', attrs: 'min="0" step="1"', hint: 'Set the selling price below the M.R.P. to put the product on sale — the % off badge and “You save” appear automatically.' })}
        ${field('Sale label (optional)', 'saleLabel', p?.saleLabel, { attrs: 'placeholder="Launch offer" maxlength="40"', hint: 'Shown above the price while the product is on sale.' })}
        ${field('Sale ends on (optional)', 'saleEnds', toLocalInput(p?.saleEnds), { type: 'datetime-local', hint: 'Shows a live countdown. After this time the price returns to the M.R.P. by itself.' })}
        ${field('Stock quantity', 'stock', p?.stock ?? 0, { type: 'number', attrs: 'min="0" step="1"' })}
        ${field('Size / net quantity', 'size', p?.size, { attrs: 'placeholder="100 ml"' })}
        ${field('Category', 'category', p?.category, { attrs: 'placeholder="Hair Oil"' })}
        ${field('Link name (optional)', 'slug', p?.slug, { hint: 'Used in the product page address.' })}
        <div class="field full"><span>Images (the first is the main image; the first 3 turn in the home page 3D viewer)</span><div class="images" id="imgPick"></div><small>JPG, PNG or WEBP, up to 4 MB each.</small></div>
        ${area('Short description', 'shortDesc', p?.shortDesc, { rows: 2 })}
        ${area('Full description', 'description', p?.description, { rows: 5, hint: 'Leave an empty line between paragraphs.' })}
        <div class="field full"><span>Ingredients (photo + name)</span><div id="ingList" class="ing-list"></div><small>Click a circle to upload a photo of the ingredient. Square photos work best.</small></div>
        ${area('Benefits — one per line', 'benefits', lines(p?.benefits), { rows: 4 })}
        ${area('How to use — one step per line', 'howToUse', lines(p?.howToUse), { rows: 4, hint: 'Format: Step title: description — e.g. Massage: Massage gently for 5–10 minutes.' })}
        ${area('Caution', 'caution', p?.caution, { rows: 3 })}
        <div class="field full checks">${check('Live on website', 'active', p ? p.active : true)}${check('Featured on home page', 'featured', p?.featured)}</div>
      </div><p class="error" hidden></p>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save product</button></div></form>`);
    imagePicker(modal.querySelector('#imgPick'), images);

    // ingredient rows: photo + name
    const ings = p ? p.ingredients.map(i => ({ ...i })) : [];
    const ingEl = modal.querySelector('#ingList');
    const drawIngs = () => {
      ingEl.innerHTML = ings.map((g, i) => `<div class="ing-row">
          <label class="ing-photo" title="Upload photo">${g.image ? `<img src="${esc(g.image)}" alt="">` : '<span>+ Photo</span>'}<input type="file" accept="image/jpeg,image/png,image/webp" data-ing-file="${i}"></label>
          <input type="text" value="${esc(g.name)}" placeholder="Ingredient name" data-ing-name="${i}" maxlength="80">
          <button type="button" class="x" data-ing-rm="${i}" title="Remove">×</button>
        </div>`).join('') + '<button type="button" class="btn ghost sm" data-ing-add>+ Add ingredient</button>';
    };
    ingEl.addEventListener('input', e => { if (e.target.dataset.ingName) ings[+e.target.dataset.ingName].name = e.target.value; });
    ingEl.addEventListener('click', e => {
      const rm = e.target.closest('[data-ing-rm]');
      if (rm) { ings.splice(+rm.dataset.ingRm, 1); drawIngs(); }
      if (e.target.closest('[data-ing-add]')) { ings.push({ name: '', image: '' }); drawIngs(); ingEl.querySelector('.ing-row:last-of-type input[type=text]').focus(); }
    });
    ingEl.addEventListener('change', async e => {
      if (!e.target.dataset.ingFile || !e.target.files.length) return;
      const fd = new FormData(); fd.append('images', e.target.files[0]);
      try { const r = await api('POST', '/upload', fd); ings[+e.target.dataset.ingFile].image = r.urls[0]; drawIngs(); } catch (ex) { fail(ex); }
    });
    drawIngs();

    modal.querySelector('#pForm').onsubmit = async e => {
      e.preventDefault();
      try {
        await api(p ? 'PUT' : 'POST', '/products' + (p ? '/' + p.id : ''), { ...formData(e.target), saleEnds: fromLocalInput(e.target.saleEnds.value), images, ingredients: ings.filter(g => g.name.trim()) });
        closeModal(); toast('Product saved'); go('products');
      } catch (ex) { const er = modal.querySelector('.error'); er.textContent = ex.message; er.hidden = false; }
    };
  }

  boot();
})();
