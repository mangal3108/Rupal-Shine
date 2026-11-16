// Storefront behaviour: cart (localStorage), live pricing with offers, coupons,
// sale countdowns, product gallery, checkout and contact form.
(function () {
  const KEY = 'rs_cart', COUPON = 'rs_coupon';
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const getCart = () => { const c = store.get(KEY, []); return Array.isArray(c) ? c : []; };
  function setCart(c) { store.set(KEY, c); badge(); }
  const getCoupon = () => String(store.get(COUPON, '') || '');
  function badge() {
    const n = getCart().reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = n; el.hidden = !n; });
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function add(id, qty) {
    const c = getCart(); const it = c.find(i => i.id === id);
    if (it) it.qty = Math.min(99, it.qty + qty); else c.push({ id, qty: Math.min(99, qty) });
    setCart(c);
  }
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  // clicks: add to cart / buy now, quantity steppers, gallery thumbs, home tabs, coupon chips
  document.addEventListener('click', e => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const src = addBtn.dataset.qtyFrom && document.getElementById(addBtn.dataset.qtyFrom);
      const qty = Math.max(1, parseInt(src ? src.value : 1, 10) || 1);
      add(addBtn.dataset.add, qty);
      if (addBtn.dataset.go) location.href = addBtn.dataset.go;
      else toast((addBtn.dataset.name || 'Item') + ' added to cart');
      return;
    }
    const q = e.target.closest('[data-qty]');
    if (q) {
      const input = $('input', q.parentElement);
      const max = parseInt(input.max, 10) || 99;
      input.value = Math.min(max, Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(q.dataset.qty, 10)));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const th = e.target.closest('[data-img]');
    if (th) {
      $('#mainImg').src = th.dataset.img;
      document.querySelectorAll('[data-img]').forEach(b => b.classList.toggle('on', b === th));
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === tab));
      document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      return;
    }
    const cp = e.target.closest('[data-coupon]');
    if (cp) {
      store.set(COUPON, cp.dataset.coupon);
      document.querySelectorAll('[data-coupon]').forEach(b => b.classList.toggle('on', b === cp));
      cp.querySelector('em').textContent = 'Applied ✓';
      toast(`Coupon ${cp.dataset.coupon} will be applied in your cart`);
    }
  });

  /* ---------- product page: pack selector, sticky buy bar ---------- */
  const packs = $('[data-packs]'), qtyInput = $('#qty');
  if (packs && qtyInput) {
    packs.addEventListener('change', e => { if (e.target.name === 'pack') qtyInput.value = e.target.value; });
    qtyInput.addEventListener('change', () => {  // keep the highlighted pack in step with the quantity box
      let best = null;
      packs.querySelectorAll('input').forEach(r => { if (+r.value <= +qtyInput.value) best = r; });
      if (best) best.checked = true;
    });
  }
  const sticky = $('[data-sticky-buy]'), buyRow = $('#buyRow');
  if (sticky && buyRow && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => { sticky.hidden = es[0].isIntersecting || es[0].boundingClientRect.top > 0; }).observe(buyRow);
  }
  const applied = getCoupon();
  document.querySelectorAll('[data-coupon]').forEach(b => { if (b.dataset.coupon === applied) { b.classList.add('on'); b.querySelector('em').textContent = 'Applied ✓'; } });

  /* ---------- sale countdowns (the end time is set by the store in the admin panel) ---------- */
  const clocks = [...document.querySelectorAll('[data-countdown]')];
  if (clocks.length) {
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      let ended = false;
      clocks.forEach(el => {
        const left = Date.parse(el.dataset.countdown) - Date.now();
        if (left <= 0) { ended = true; return; }
        const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
        el.querySelector('b').textContent = (d ? d + 'd ' : '') + pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
      });
      if (ended) location.reload(); // the sale is over: show the regular price
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- live cart pricing ---------- */
  async function quote(method) {
    const cart = getCart();
    const q = await post('/api/cart/quote', { items: cart, code: getCoupon(), method: method || '' });
    setCart(q.lines.map(l => ({ id: l.id, qty: l.qty }))); // drops removed / sold-out items
    return q;
  }
  const totalsHtml = q => `
    <table class="lines">
      <tr><td>Subtotal</td><td>${money(q.subtotal)}</td></tr>
      ${q.discounts.map(d => `<tr class="disc"><td>${esc(d.label)}</td><td>− ${money(d.amount)}</td></tr>`).join('')}
      <tr><td>Shipping</td><td>${q.shipping ? money(q.shipping) : '<span class="free">Free</span>'}</td></tr>
      <tr class="total"><td>Total</td><td>${money(q.total)}</td></tr>
    </table>
    ${q.saved > 0 ? `<p class="saved-note">You are saving ${money(q.saved)} on this order</p>` : ''}`;
  const nudgesHtml = q => `
    ${q.freeShippingGap > 0 ? `<div class="nudge"><span>Add <b>${money(q.freeShippingGap)}</b> more for <b>free delivery</b></span><i><u style="width:${Math.max(6, Math.min(100, 100 - q.freeShippingGap / (q.freeShippingGap + q.total - q.shipping) * 100))}%"></u></i></div>` : ''}
    ${q.nextTier ? `<div class="nudge"><span>Add <b>${q.nextTier.need} more</b> to get <b>${q.nextTier.percent}% off</b> your order</span></div>` : ''}`;
  const couponHtml = q => q.coupon
    ? `<div class="coupon-box applied"><span>Coupon <b>${esc(q.coupon)}</b> applied</span><button type="button" data-coupon-remove>Remove</button></div>`
    : `<form class="coupon-box" data-coupon-form><input name="code" placeholder="Coupon code" maxlength="30" autocomplete="off" value="${esc(getCoupon())}"><button>Apply</button></form>
       ${q.couponError && getCoupon() ? `<p class="coupon-err">${esc(q.couponError)}</p>` : ''}`;
  // coupon box works the same on the cart and checkout pages
  function wireCoupon(root, rerender) {
    root.addEventListener('submit', e => {
      if (!e.target.matches('[data-coupon-form]')) return;
      e.preventDefault();
      store.set(COUPON, e.target.code.value.trim().toUpperCase() || null);
      rerender();
    });
    root.addEventListener('click', e => { if (e.target.closest('[data-coupon-remove]')) { store.set(COUPON, null); rerender(); } });
  }

  /* ---------- cart page ---------- */
  const cartView = $('#cartView');
  async function renderCart() {
    const q = await quote();
    if (!q.lines.length) {
      cartView.innerHTML = '<p class="empty">Your cart is empty.</p><p class="center"><a class="btn btn-buy" href="/shop">Shop now</a></p>';
      return;
    }
    cartView.innerHTML = `
      <div>
        ${nudgesHtml(q)}
        <div class="panel cart-lines">
        ${q.lines.map(l => `<div class="cart-line" data-id="${esc(l.id)}">
          <a href="/product/${esc(l.slug)}" class="cart-thumb">${l.image ? `<img src="${esc(l.image)}" alt="">` : ''}</a>
          <div class="cart-name"><a href="/product/${esc(l.slug)}">${esc(l.name)}</a><small>${esc(l.size || '')} · ${money(l.price)}${l.mrp > l.price ? ` <s>${money(l.mrp)}</s>` : ''}</small></div>
          <div class="qty"><button type="button" data-qty="-1">−</button><input type="number" value="${l.qty}" min="1" max="${Math.min(99, l.stock)}" aria-label="Quantity"><button type="button" data-qty="1">+</button></div>
          <b class="cart-amt">${money(l.price * l.qty)}</b>
          <button class="remove" type="button" data-remove aria-label="Remove">×</button>
        </div>`).join('')}
        </div>
      </div>
      <aside class="panel summary"><h3>Summary</h3>${couponHtml(q)}${totalsHtml(q)}<a class="btn btn-buy btn-block" href="/checkout">Proceed to checkout</a></aside>`;
  }
  if (cartView) {
    const rerender = () => renderCart().catch(() => { cartView.innerHTML = '<p class="empty">Could not load your cart. Please refresh.</p>'; });
    rerender();
    wireCoupon(cartView, rerender);
    cartView.addEventListener('change', e => {
      const line = e.target.closest('.cart-line'); if (!line) return;
      const max = parseInt(e.target.max, 10) || 99;
      const qty = Math.min(max, Math.max(1, parseInt(e.target.value, 10) || 1));
      setCart(getCart().map(i => i.id === line.dataset.id ? { ...i, qty } : i));
      rerender();
    });
    cartView.addEventListener('click', e => {
      if (!e.target.closest('[data-remove]')) return;
      const id = e.target.closest('.cart-line').dataset.id;
      setCart(getCart().filter(i => i.id !== id));
      rerender();
    });
  }

  function showError(msg) { const el = $('#formError'); el.textContent = msg; el.hidden = !msg; }
  const loadScript = src => new Promise((ok, bad) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const el = document.createElement('script');
    el.src = src; el.onload = ok; el.onerror = () => bad(new Error('Could not load the payment page. Check your internet connection.'));
    document.head.appendChild(el);
  });

  /* ---------- checkout page ---------- */
  const form = $('#checkoutForm');
  if (form) {
    const summary = $('#summary');
    const method = () => (new FormData(form).get('method') || '');
    const renderSummary = () => quote(method()).then(q => {
      if (!q.lines.length) { location.replace('/cart'); return; }
      summary.innerHTML = `<h3>Order summary</h3>
        ${q.lines.map(l => `<div class="sum-line"><span>${esc(l.name)} × ${l.qty}</span><b>${money(l.price * l.qty)}</b></div>`).join('')}
        ${couponHtml(q)}${totalsHtml(q)}`;
    });
    renderSummary();
    wireCoupon(summary, renderSummary);
    form.addEventListener('change', e => { if (e.target.name === 'method') renderSummary(); }); // online-payment offer changes the total
    form.addEventListener('submit', async e => {
      e.preventDefault();
      showError('');
      const customer = Object.fromEntries(new FormData(form));
      const btn = $('button[type=submit]', form);
      btn.disabled = true; btn.textContent = 'Placing order…';
      const chosen = customer.method; delete customer.method;
      const reset = msg => { showError(msg); btn.disabled = false; btn.textContent = 'Place order'; };
      try {
        const res = await post('/api/orders', { customer, items: getCart(), method: chosen, code: getCoupon() });
        if (!res.gateway) { setCart([]); store.set(COUPON, null); location.href = res.url; return; } // cash on delivery
        btn.textContent = 'Opening secure payment…';
        if (res.gateway === 'stripe') { location.href = res.redirect; return; }  // Stripe hosted page
        if (res.gateway === 'cashfree') {
          await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
          window.Cashfree({ mode: res.mode }).checkout({ paymentSessionId: res.sessionId, redirectTarget: '_self' });
          return;
        }
        if (res.gateway === 'razorpay') {
          await loadScript('https://checkout.razorpay.com/v1/checkout.js');
          const rzp = new window.Razorpay({
            key: res.keyId, order_id: res.rzpOrderId, amount: res.amount, currency: 'INR',
            name: res.name, description: res.description, prefill: res.prefill, theme: { color: '#6f9a2e' },
            handler: async pmt => {
              try { const v = await post('/api/pay/razorpay/verify', { key: res.orderKey, ...pmt }); setCart([]); store.set(COUPON, null); location.href = v.url; }
              catch (err) { reset(err.message); }
            },
            modal: { ondismiss: () => reset('Payment was not completed. You can try again.') }
          });
          rzp.open();
        }
      } catch (err) { reset(err.message); renderSummary(); }
    });
  }

  /* ---------- contact page ---------- */
  const cform = $('#contactForm');
  if (cform) cform.addEventListener('submit', async e => {
    e.preventDefault();
    showError('');
    try {
      await post('/api/contact', Object.fromEntries(new FormData(cform)));
      cform.innerHTML = '<p class="lead">Thank you! Your message has been sent. We will get back to you soon.</p>';
    } catch (err) { showError(err.message); }
  });

  badge();
})();
