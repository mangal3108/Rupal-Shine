const { STATES } = require('./pincode');
// Server-rendered storefront pages. All dynamic text goes through esc().
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const paras = t => String(t || '').split(/\n\s*\n/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
// paragraphs where **words** become bold (the text is escaped first, so this stays safe)
const rich = t => paras(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const off = p => p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

// ingredient -> small round photo (leaf icon when no photo is set)
const herbImg = i => i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ICON.leaf;
const chips = list => `<ul class="chip-list">${list.map(i => `<li><span>${herbImg(i)}</span>${esc(i.name)}</li>`).join('')}</ul>`;
// "Massage: Massage gently…" -> {title, text}
function step(line) {
  const i = line.indexOf(':');
  return i > 0 && i < 40 ? { title: line.slice(0, i).trim(), text: line.slice(i + 1).trim() } : { title: '', text: line };
}

const ICON = {
  cart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h13l-1.5 9h-10z"/><path d="M6 7 5.3 4H3"/><circle cx="9" cy="20" r="1.2"/><circle cx="16.5" cy="20" r="1.2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4C10 4 5 9 5 16c0 1 0 2 1 3l-2 2 1 1 2-2c1 0 2 1 3 1 7 0 10-7 10-17z"/></svg>',
  crown: '<svg viewBox="0 0 48 30" width="34" height="22" fill="currentColor"><path d="M4 26 1 7l11 8L24 1l12 14 11-8-3 19z"/></svg>',
  steps: [
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8c9 12 15 20 15 29a15 15 0 0 1-30 0c0-9 6-17 15-29z"/><path d="M25 38a7 7 0 0 0 7 7"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="22" r="10"/><path d="M14 54c2-11 9-16 18-16s16 5 18 16"/><path d="M19 15c2-6 7-9 13-9s11 3 13 9M12 22c-2 3-2 7 0 10M52 22c2 3 2 7 0 10"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="34" r="20"/><path d="M32 22v12l8 5M26 8h12M32 8v6"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 54V20a10 10 0 0 1 20 0"/><path d="M26 24h16a8 8 0 0 0-16 0z"/><path d="M28 32v3M34 31v5M40 32v3M30 42v3M38 42v3M34 48v3"/></svg>'
  ]
};

function logo(s) {
  if (s.logoImage) return `<img src="${esc(s.logoImage)}" alt="${esc(s.siteName)}" class="logo-img">`;
  const parts = s.siteName.trim().split(/\s+/);
  const first = parts.shift();
  return `<span class="logo-mark">${ICON.crown}</span><span class="logo-text"><b>${esc(first)}</b>${parts.length ? `<i>${esc(parts.join(' '))}</i>` : ''}</span>`;
}

// asset links carry the file's last-modified time, so browsers always pick up new versions
const fs = require('fs'), path = require('path');
const asset = p => { try { return p + '?v=' + Math.round(fs.statSync(path.join(__dirname, 'public', p)).mtimeMs).toString(36); } catch (e) { return p; } };

function layout(db, title, body, { desc = '', path = '' } = {}) {
  const s = db.settings;
  const menuPages = db.pages.filter(p => p.showInMenu);
  const footPages = db.pages.filter(p => p.showInFooter);
  const nav = [['/', 'Home'], ['/shop', 'Shop'], ...menuPages.map(p => ['/page/' + p.slug, p.title]), ['/contact', 'Contact']];
  const wa = s.whatsapp ? 'https://wa.me/' + s.whatsapp.replace(/\D/g, '') : '';
  const social = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube']].filter(([k]) => s[k]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} | ${s.siteName}` : `${s.siteName} — ${s.heroTitle}`)}</title>
<meta name="description" content="${esc(desc || s.heroSubtitle)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${asset('/css/style.css')}">
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ''}
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="/" aria-label="${esc(s.siteName)} home">${logo(s)}</a>
    <nav class="pill-nav" id="nav">
      ${nav.map(([href, label]) => `<a href="${esc(href)}"${href === path ? ' class="on"' : ''}>${esc(label)}</a>`).join('')}
    </nav>
    <a class="cart-btn" href="/cart" aria-label="Cart">${ICON.cart}<span class="cart-count" data-cart-count hidden>0</span></a>
    <button class="menu-btn" aria-label="Menu" onclick="document.getElementById('nav').classList.toggle('open')"><span></span><span></span><span></span></button>
  </div>
</header>
<main>${body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo" href="/">${logo(s)}</a>
      <p class="foot-note">${esc(s.footerNote)}</p>
      ${social.length ? `<p class="social">${social.map(([k, l]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${l}</a>`).join('')}</p>` : ''}
    </div>
    <div>
      <h4>Shop</h4>
      <a href="/shop">All Products</a><a href="/cart">Cart</a><a href="/contact">Contact Us</a>
    </div>
    <div>
      <h4>Information</h4>
      ${footPages.map(p => `<a href="/page/${esc(p.slug)}">${esc(p.title)}</a>`).join('') || '<span>—</span>'}
    </div>
    <div>
      <h4>Get in touch</h4>
      ${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>` : ''}
      ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}
      ${s.address ? `<span>${esc(s.address)}</span>` : ''}
    </div>
  </div>
  <div class="wrap copyright">© ${new Date().getFullYear()} ${esc(s.siteName)}. All rights reserved.</div>
</footer>
${wa ? `<a class="wa-float" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M16 4a12 12 0 0 0-10 18l-2 6 6-2a12 12 0 1 0 6-22z"/><path fill="#fff" stroke="none" d="M11 11c0 6 4 10 10 10l1-3-3-2-1 1c-2-1-3-2-4-4l1-1-2-3z"/></svg></a>` : ''}
<div class="toast" id="toast" hidden></div>
<script src="${asset('/js/shop.js')}"></script>
<script src="${asset('/js/fx.js')}" defer></script>
</body>
</html>`;
}

function card(p) {
  const o = off(p);
  return `<article class="card">
    <a class="card-img" href="/product/${esc(p.slug)}">
      ${p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : ''}
      ${o ? `<span class="badge">${o}% OFF</span>` : ''}${p.stock < 1 ? '<span class="badge sold">Sold out</span>' : ''}
    </a>
    <div class="card-body">
      ${p.category ? `<span class="card-cat">${esc(p.category)}</span>` : ''}
      <h3><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></h3>
      <p class="price">${money(p.price)}${o ? ` <s>${money(p.mrp)}</s>` : ''}${p.size ? ` <small>/ ${esc(p.size)}</small>` : ''}</p>
      <button class="btn btn-sm btn-buy" data-add="${esc(p.id)}" data-name="${esc(p.name)}"${p.stock < 1 ? ' disabled' : ''}>${p.stock < 1 ? 'Sold out' : 'Add to cart'}</button>
    </div>
  </article>`;
}

// "Good to know" strip under the story: only facts the store really offers
const FACTS = ['Made in India', 'Cash on delivery available', 'Secure online payments', 'Delivered across India'];

// Video section, set from the admin panel (Site settings → Video). Accepts a YouTube link or a
// direct .mp4 / .webm link. Hidden when no link is set.
function videoBlock(s, poster) {
  const url = String(s.videoUrl || '');
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/(?:shorts|embed)\/)([\w-]{6,})/);
  let media = '';
  if (yt) media = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt[1])}" title="${esc(s.videoTitle || 'Video')}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  else if (/\.(mp4|webm)(\?|$)/i.test(url)) media = `<video src="${esc(url)}" controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''}></video>`;
  if (!media) return '';
  return `<section class="video-sec" id="video">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="kicker">${esc(s.videoKicker || 'Watch')}</span>
      <h2>${esc(s.videoTitle || 'See how it is made')}</h2>
    </div>
    <div class="video-card reveal">
      <span class="v-badge">${ICON.leaf}Handmade with care</span>
      <div class="video-frame">${media}</div>
      ${s.videoCaption ? `<p>${esc(s.videoCaption)}</p>` : ''}
    </div>
  </div>
</section>`;
}

// "Why choose" checklist: one point per line, written as "Title – explanation"
function whyBlock(s, f) {
  const items = String(s.whyLines || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.+?)\s+[–—-]\s+(.+)$/) || l.match(/^(.+?):\s*(.+)$/);
    return m ? { title: m[1], text: m[2] } : { title: l, text: '' };
  });
  if (!items.length) return '';
  const img = f && (f.images[1] || f.images[0]);
  return `<section class="why" id="why">
  <div class="wrap">
    <div class="why-card reveal">
      ${img ? `<div class="why-img"><img src="${esc(img)}" alt="${esc(f.name)}" loading="lazy"></div>` : ''}
      <div class="why-copy">
        ${s.whyKicker ? `<span class="kicker">${esc(s.whyKicker)}</span>` : ''}
        <h2>${esc(s.whyTitle || 'Why choose us?')}</h2>
        <ul class="why-list">${items.map(i => `<li>${ICON.check}<span><b>${esc(i.title)}</b>${i.text ? ` – ${esc(i.text)}` : ''}</span></li>`).join('')}</ul>
        ${f ? `<a class="btn btn-buy" href="/product/${esc(f.slug)}">Buy now ${ICON.arrow}</a>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

function home(db, products) {
  const s = db.settings;
  const f = products.find(p => p.featured) || products[0];
  const tabs = f ? [
    ['Ingredients', chips(f.ingredients), f.ingredients.length],
    ['Benefits', `<ul class="tick-list">${f.benefits.map(b => `<li>${ICON.leaf}${esc(b)}</li>`).join('')}</ul>`, f.benefits.length],
    ['About', paras(f.description), f.description]
  ].filter(t => t[2]) : [];
  const steps = f ? f.howToUse.map(step) : [];
  const herbs = f ? f.ingredients : [];
  const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
  const stats = lines(s.statsLines).map(step).filter(x => x.title);
  const journey = lines(s.journeySteps).map(step);
  const orbs = herbs.filter(h => h.image);
  const spin = f ? f.images.slice(0, 3) : [];
  const buy = f ? `<button class="btn btn-buy" data-add="${esc(f.id)}" data-name="${esc(f.name)}"${f.stock < 1 ? ' disabled' : ''}>${f.stock < 1 ? 'Sold out' : 'Add to cart'}</button>` : '';

  const body = `
<section class="hero" data-hero>
  <div class="hero-blob"></div>
  <canvas class="hero-dust" data-dust aria-hidden="true"></canvas>
  <div class="wrap hero-row">
    <div class="hero-copy">
      ${s.heroKicker ? `<span class="kicker">${esc(s.heroKicker)}</span>` : ''}
      <h1>${esc(s.heroTitle)}</h1>
      <p>${esc(s.heroSubtitle)}</p>
      <div class="hero-actions">
        <a class="btn btn-buy" href="${f ? '/product/' + esc(f.slug) : '/shop'}">${esc(s.heroCta || 'Shop Now')} ${ICON.arrow}</a>
        ${f ? `<span class="hero-price">${money(f.price)}${off(f) ? ` <s>${money(f.mrp)}</s> <em class="save">${off(f)}% OFF</em>` : ''}${f.size ? ` <small>/ ${esc(f.size)}</small>` : ''}</span>` : ''}
      </div>
      ${journey.length ? `<a class="scroll-cue" href="#journey"><i></i>Scroll to see the journey</a>` : ''}
    </div>
    <div class="hero-art">${s.heroImage ? `<img src="${esc(s.heroImage)}" alt="${esc(s.siteName)}" data-tilt>` : ''}</div>
  </div>
</section>

${stats.length ? `<section class="stats"><div class="wrap stats-row">
  ${stats.map(x => `<div class="stat reveal"><b data-count="${esc(x.title)}">${esc(x.title)}</b><span>${esc(x.text)}</span></div>`).join('')}
</div></section>` : ''}

<section class="intro wrap reveal">
  ${s.introKicker ? `<span class="kicker">${esc(s.introKicker)}</span>` : ''}
  <h2>${esc(s.introTitle)}</h2>
  <p>${esc(s.introText)}</p>
  <a class="round-btn" href="${journey.length ? '#journey' : '#featured'}" aria-label="Scroll down">${ICON.down}</a>
</section>

${s.storyText ? `<section class="story" id="story">
  <div class="wrap">
    <div class="story-card reveal">
      <figure class="story-photo">
        ${s.storyImage ? `<div class="story-frame"><img src="${esc(s.storyImage)}" alt="${esc(s.storyCaption || s.storyTitle)}" loading="lazy"></div>` : ''}
        ${s.storyCaption ? `<figcaption>${ICON.leaf}${esc(s.storyCaption)}</figcaption>` : ''}
      </figure>
      <div class="story-copy">
        ${s.storyKicker ? `<span class="kicker">${esc(s.storyKicker)}</span>` : ''}
        <h2>${esc(s.storyTitle)}</h2>
        ${rich(s.storyText)}
        ${s.storySign ? `<p class="story-sign">— ${esc(s.storySign)}</p>` : ''}
      </div>
    </div>
  </div>
</section>
<ul class="facts" aria-label="Good to know">${FACTS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}

${videoBlock(s, f && f.images[0])}

${whyBlock(s, f)}

${journey.length && f ? `<section class="journey" id="journey" data-journey style="--steps:${journey.length}">
  <div class="journey-stage">
    <canvas class="journey-dust" data-dust="dark" aria-hidden="true"></canvas>
    <div class="journey-copy">
      ${s.journeyKicker ? `<span class="kicker">${esc(s.journeyKicker)}</span>` : ''}
      <h2>${esc(s.journeyTitle)}</h2>
      <div class="j-steps">
        ${journey.map((j, i) => `<article class="j-step${i ? '' : ' on'}" data-jstep="${i}">
          <span class="j-num">${String(i + 1).padStart(2, '0')}</span>
          <h3>${esc(j.title || 'Step ' + (i + 1))}</h3>
          <p>${esc(j.text)}</p>
          ${i === journey.length - 1 ? `<div class="j-cta">${buy}<a class="link" href="/product/${esc(f.slug)}">View details ${ICON.arrow}</a></div>` : ''}
        </article>`).join('')}
      </div>
      <ol class="j-progress" aria-hidden="true">${journey.map((j, i) => `<li${i ? '' : ' class="on"'}></li>`).join('')}</ol>
    </div>
    <div class="journey-scene" aria-hidden="true">
      <div class="j-world" data-jworld>
        <div class="j-ring"></div>
        <div class="j-spot" data-jspot>${f.images[0] ? `<img src="${esc(f.images[0])}" alt="">` : ''}</div>
        ${orbs.map(o => `<div class="j-orb" data-jorb><img src="${esc(o.image)}" alt="" loading="lazy"><em>${esc(o.name.replace(/\s*\(.*\)$/, ''))}</em></div>`).join('')}
      </div>
    </div>
  </div>
</section>` : ''}

${f ? `<section class="featured" id="featured">
  <div class="feat-blob reveal">
    <span class="feat-label">Inside the bottle</span>
    <div class="feat-tabs" role="tablist">
      ${tabs.map((t, i) => `<button role="tab" data-tab="${i}"${i ? '' : ' class="on"'}><i></i>${t[0]}</button>`).join('')}
    </div>
  </div>
  <div class="feat-img reveal">
    ${spin.length > 1 ? `<div class="spin" data-spin tabindex="0" role="group" aria-label="Rotate the bottle">
      <div class="spin-card" data-spin-card>${spin.map((im, i) => `<img src="${esc(im)}" alt="${esc(f.name)} view ${i + 1}" draggable="false"${i ? ' hidden' : ''}>`).join('')}</div>
      <div class="spin-ui"><button type="button" data-spin-step="-1" aria-label="Rotate left">‹</button><span>Drag to rotate</span><button type="button" data-spin-step="1" aria-label="Rotate right">›</button></div>
    </div>` : `<a href="/product/${esc(f.slug)}">${f.images[0] ? `<img src="${esc(f.images[0])}" alt="${esc(f.name)}" loading="lazy">` : ''}</a>`}
  </div>
  <div class="feat-info reveal">
    <h2>${esc(f.name)}</h2>
    ${priceBlock(f, true)}
    ${tabs.map((t, i) => `<div class="feat-panel" data-panel="${i}"${i ? ' hidden' : ''}><h5>${t[0]}</h5>${t[1]}</div>`).join('')}
    <div class="feat-actions">
      ${buy}
      <a class="link" href="/product/${esc(f.slug)}">View details ${ICON.arrow}</a>
    </div>
  </div>
</section>` : ''}

${steps.length ? `<section class="process wrap">
  <h2 class="section-title reveal">How to Use</h2>
  <div class="steps" style="--n:${steps.length}">
    ${steps.map((st, i) => `<div class="step reveal" style="--d:${i}">
      <div class="step-icon">${ICON.steps[i % 4]}</div>
      <span class="step-dot">${i + 1}</span>
      <h4>${esc(st.title || 'Step ' + (i + 1))}</h4>
      <p>${esc(st.text)}</p>
    </div>`).join('')}
  </div>
</section>` : ''}

${products.length > 1 ? `<section class="wrap products-sec">
  <h2 class="section-title reveal">Our Products</h2>
  <div class="grid">${products.slice(0, 8).map(card).join('')}</div>
  <p class="center"><a class="btn btn-outline" href="/shop">View all products</a></p>
</section>` : ''}

${herbs.length ? `<section class="herbs">
  <div class="wrap herbs-row">
    <div class="herbs-head reveal"><span class="kicker">${esc(s.siteName)}</span><h3>${esc(s.herbsTitle || 'Our Herbs')}</h3></div>
    <ul class="herb-list">${herbs.map((h, i) => `<li class="reveal" style="--d:${i}"><span class="herb-circle">${herbImg(h)}</span><em>${esc(h.name)}</em></li>`).join('')}</ul>
  </div>
</section>` : ''}`;
  return layout(db, '', body, { path: '/' });
}

function shop(db, products, category) {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
  const shown = category ? products.filter(p => p.category === category) : products;
  const body = `
<section class="page-head"><div class="wrap"><span class="kicker">${esc(db.settings.siteName)}</span><h1>Shop</h1></div></section>
<section class="wrap pad">
  ${cats.length > 1 ? `<div class="filters"><a href="/shop"${category ? '' : ' class="on"'}>All</a>${cats.map(c => `<a href="/shop?category=${encodeURIComponent(c)}"${c === category ? ' class="on"' : ''}>${esc(c)}</a>`).join('')}</div>` : ''}
  ${shown.length ? `<div class="grid">${shown.map(card).join('')}</div>` : '<p class="empty">No products yet. Please check back soon.</p>'}
</section>`;
  return layout(db, 'Shop', body, { path: '/shop' });
}

// price with struck M.R.P., % badge, savings line and (when the sale has an end time) a live countdown
function priceBlock(p, big) {
  const o = off(p);
  return `<div class="price-block${big ? ' big' : ''}">
    ${o && p.saleLabel ? `<span class="sale-label">${esc(p.saleLabel)}</span>` : ''}
    <p class="price${big ? ' big' : ''}">${money(p.price)}${o ? ` <s>${money(p.mrp)}</s> <span class="save">${o}% OFF</span>` : ''}${!big && p.size ? ` <small>/ ${esc(p.size)}</small>` : ''}</p>
    ${o && big ? `<p class="you-save">You save ${money(p.mrp - p.price)}</p>` : ''}
    ${o && p.saleEnds ? `<p class="countdown" data-countdown="${esc(p.saleEnds)}">Offer ends in <b>…</b></p>` : ''}
  </div>`;
}
const TRUST_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>';

function product(db, p, related, methods = [], offers = {}) {
  const s = db.settings;
  const steps = p.howToUse.map(step);
  const tiers = offers.tiers || [], coupons = offers.coupons || [];
  const inStock = p.stock > 0;
  const trust = [
    ...String(s.trustLines || '').split('\n').map(x => x.trim()).filter(Boolean),
    methods.some(m => m.id === 'cod') && 'Cash on Delivery',
    methods.some(m => m.id !== 'cod') && 'Secure online payment'
  ].filter(Boolean);
  // pack choices built from the "buy more, save more" tiers
  const packs = tiers.length && inStock ? [{ qty: 1, percent: 0 }, ...tiers].filter(t => t.qty <= p.stock) : [];
  const body = `
<section class="wrap pdp">
  <div class="gallery">
    <div class="gallery-main">${off(p) ? `<span class="badge">${off(p)}% OFF</span>` : ''}${p.images[0] ? `<img id="mainImg" src="${esc(p.images[0])}" alt="${esc(p.name)}">` : ''}</div>
    ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((im, i) => `<button data-img="${esc(im)}"${i ? '' : ' class="on"'} aria-label="Image ${i + 1}"><img src="${esc(im)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  </div>
  <div class="pdp-info">
    <p class="crumbs"><a href="/">Home</a> / <a href="/shop">Shop</a>${p.category ? ` / ${esc(p.category)}` : ''}</p>
    <h1>${esc(p.name)}</h1>
    ${p.shortDesc ? `<p class="lead">${esc(p.shortDesc)}</p>` : ''}
    ${priceBlock(p, true)}
    <p class="meta">${p.size ? `Net quantity: <b>${esc(p.size)}</b> · ` : ''}Inclusive of all taxes</p>
    ${!inStock ? '<p class="stock out">Currently sold out</p>' : p.stock <= 5 ? `<p class="stock low">Only ${p.stock} left in stock</p>` : '<p class="stock">In stock</p>'}

    ${packs.length > 1 ? `<div class="packs" data-packs>
      <span class="packs-title">Buy more, save more</span>
      ${packs.map((t, i) => {
        const total = Math.round(p.price * t.qty * (1 - t.percent / 100));
        return `<label class="pack"><input type="radio" name="pack" value="${t.qty}"${i ? '' : ' checked'}>
          <span class="pack-name">${t.qty} ${t.qty > 1 ? 'bottles' : 'bottle'}${t.percent ? ` <em>Save ${t.percent}%</em>` : ''}${i === packs.length - 1 && i ? ' <i>Best value</i>' : ''}</span>
          <span class="pack-price">${money(total)}${t.percent ? ` <s>${money(p.price * t.qty)}</s>` : ''}<small>${money(Math.round(total / t.qty))} each</small></span></label>`;
      }).join('')}
    </div>` : ''}

    <div class="buy-row" id="buyRow">
      <div class="qty"><button type="button" data-qty="-1" aria-label="Decrease">−</button><input id="qty" type="number" value="1" min="1" max="${Math.max(1, Math.min(99, p.stock))}" aria-label="Quantity"><button type="button" data-qty="1" aria-label="Increase">+</button></div>
      <button class="btn btn-buy" data-add="${esc(p.id)}" data-name="${esc(p.name)}" data-qty-from="qty"${inStock ? '' : ' disabled'}>Add to cart</button>
      <button class="btn btn-dark" data-add="${esc(p.id)}" data-qty-from="qty" data-go="/checkout"${inStock ? '' : ' disabled'}>Buy now</button>
    </div>

    ${coupons.length ? `<div class="coupons">${coupons.map(c => `<button type="button" class="coupon" data-coupon="${esc(c.code)}">
      <span><b>${c.type === 'percent' ? `${c.value}% off` : `${money(c.value)} off`}</b>${c.minOrder ? ` on orders above ${money(c.minOrder)}` : ''} — use code <code>${esc(c.code)}</code></span><em>Tap to apply</em></button>`).join('')}</div>` : ''}
    ${s.prepaidPercent > 0 && methods.some(m => m.id !== 'cod') ? `<p class="assure">Pay online and get an extra ${s.prepaidPercent}% off at checkout.</p>` : ''}
    ${s.freeShippingAbove > 0 ? `<p class="assure">Free delivery on orders above ${money(s.freeShippingAbove)}.</p>` : !s.shippingFee ? '<p class="assure">Free delivery on every order.</p>' : ''}

    ${trust.length ? `<ul class="trust">${trust.map(t => `<li>${TRUST_ICON}${esc(t)}</li>`).join('')}</ul>` : ''}
    ${p.benefits.length ? `<div class="block"><h3>Benefits</h3><ul class="tick-list">${p.benefits.map(b => `<li>${ICON.leaf}${esc(b)}</li>`).join('')}</ul></div>` : ''}
  </div>
</section>
<section class="wrap pdp-details">
  ${p.description ? `<div class="block"><h3>About this product</h3>${paras(p.description)}</div>` : ''}
  ${p.ingredients.length ? `<div class="block"><h3>Ingredients</h3>${chips(p.ingredients)}</div>` : ''}
  ${steps.length ? `<div class="block"><h3>How to use</h3><ol class="how">${steps.map(st => `<li>${st.title ? `<b>${esc(st.title)}.</b> ` : ''}${esc(st.text)}</li>`).join('')}</ol></div>` : ''}
  ${p.caution ? `<div class="block caution"><h3>Caution</h3>${paras(p.caution)}</div>` : ''}
</section>
${related.length ? `<section class="wrap products-sec"><h2 class="section-title">You may also like</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}
${inStock ? `<div class="sticky-buy" data-sticky-buy hidden>
  <div><b>${esc(p.name)}</b><span>${money(p.price)}${off(p) ? ` <s>${money(p.mrp)}</s> <em>${off(p)}% OFF</em>` : ''}</span></div>
  <button class="btn btn-buy" data-add="${esc(p.id)}" data-qty-from="qty" data-go="/checkout">Buy now</button>
</div>` : ''}`;
  return layout(db, p.name, body, { desc: p.shortDesc });
}

function cart(db) {
  const body = `
<section class="page-head"><div class="wrap"><h1>Your Cart</h1></div></section>
<section class="wrap pad"><div id="cartView" class="cart-view"><p class="empty">Loading your cart…</p></div></section>`;
  return layout(db, 'Cart', body);
}

function checkout(db, methods = []) {
  // every field carries its own error line; `hint` is the small help text under it
  const f = (name, label, attrs = '', { cls = '', hint = '', prefix = '' } = {}) => `<label class="field ${cls}" data-field="${name}"><span>${label}</span>${prefix ? `<div class="with-prefix"><b>${prefix}</b><input name="${name}" ${attrs}></div>` : `<input name="${name}" ${attrs}>`}${hint ? `<small class="hint">${hint}</small>` : ''}<small class="err" hidden></small></label>`;
  const body = `
<section class="page-head"><div class="wrap"><h1>Checkout</h1></div></section>
<section class="wrap pad checkout">
  <form id="checkoutForm" class="panel" novalidate>
    <h3>Contact details</h3>
    <div class="fields">
      ${f('name', 'Full name *', 'required autocomplete="name" maxlength="80" placeholder="First and last name"')}
      ${f('phone', 'Mobile number *', 'required type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="10-digit mobile number"', { prefix: '+91', hint: 'For delivery updates and the courier’s call.' })}
      ${f('email', 'Email (optional)', 'type="email" autocomplete="email" maxlength="120" placeholder="For your order confirmation"', { cls: 'full' })}
    </div>
    <h3>Delivery address</h3>
    <p class="ship-note"><img src="/uploads/icon-truck.svg" alt="" width="22" height="22"> We currently deliver across India only.</p>
    <div class="fields">
      <label class="field" data-field="country"><span>Country / Region *</span><select name="country" autocomplete="country-name"><option value="India" selected>India</option></select><small class="err" hidden></small></label>
      <label class="field" data-field="pincode"><span>PIN code *</span><input name="pincode" required inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="6-digit PIN code"><small class="hint" id="pinStatus">We fill in your city and state from the PIN code.</small><small class="err" hidden></small></label>
      ${f('line1', 'Flat, House no., Building, Company *', 'required maxlength="120" autocomplete="address-line1"', { cls: 'full' })}
      ${f('line2', 'Area, Street, Sector, Village *', 'required maxlength="120" autocomplete="address-line2" list="pinAreas"', { cls: 'full' })}
      <datalist id="pinAreas"></datalist>
      ${f('landmark', 'Landmark (optional)', 'maxlength="80" placeholder="E.g. near Apollo Hospital"', { cls: 'full' })}
      ${f('city', 'Town / City *', 'required maxlength="60" autocomplete="address-level2"')}
      <label class="field" data-field="state"><span>State / Union Territory *</span><select name="state" required autocomplete="address-level1"><option value="">Select state</option>${STATES.map(s => `<option>${esc(s)}</option>`).join('')}</select><small class="err" hidden></small></label>
      <div class="field full" data-field="addressType"><span>Address type</span>
        <div class="chips">
          <label><input type="radio" name="addressType" value="Home" checked><i><img src="/uploads/icon-home.svg" alt="" width="22" height="22"> Home <em>(all-day delivery)</em></i></label>
          <label><input type="radio" name="addressType" value="Work"><i><img src="/uploads/icon-work.svg" alt="" width="22" height="22"> Work <em>(10 am – 6 pm)</em></i></label>
          <label><input type="radio" name="addressType" value="Other"><i>Other</i></label>
        </div>
      </div>
      ${f('altPhone', 'Alternate mobile (optional)', 'type="tel" inputmode="numeric" maxlength="10" placeholder="If we cannot reach you"', { prefix: '+91' })}
      ${f('note', 'Delivery instructions (optional)', 'maxlength="300" placeholder="E.g. leave with security"')}
      <label class="check full"><input type="checkbox" id="saveAddress" checked> <span>Save these details on this device for next time</span></label>
    </div>
    <h3>Payment</h3>
    ${methods.length ? methods.map((m, i) => `<label class="pay-opt"><input type="radio" name="method" value="${esc(m.id)}"${i ? '' : ' checked'}> <span><b>${esc(m.label)}${db.settings.prepaidPercent > 0 && m.id !== 'cod' ? ` <em class="save">Extra ${db.settings.prepaidPercent}% off</em>` : ''}</b><small>${esc(m.hint)}</small></span></label>`).join('') : '<p class="form-error">Ordering is paused right now. Please contact us.</p>'}
    <p class="form-error" id="formError" hidden></p>
    <button class="btn btn-buy btn-block" type="submit"${methods.length ? '' : ' disabled'}>Place order</button>
  </form>
  <aside class="panel summary" id="summary"><h3>Order summary</h3><p class="empty">Loading…</p></aside>
</section>`;
  return layout(db, 'Checkout', body);
}

function orderPlaced(db, o) {
  const c = o.customer;
  const table = `<div class="panel">
    <table class="lines">
      ${o.items.map(i => `<tr><td>${esc(i.name)}${i.size ? ` <small>(${esc(i.size)})</small>` : ''} × ${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}
      ${(o.discounts || []).map(d => `<tr class="disc"><td>${esc(d.label)}</td><td>− ${money(d.amount)}</td></tr>`).join('')}
      <tr><td>Shipping</td><td>${o.shipping ? money(o.shipping) : 'Free'}</td></tr>
      <tr class="total"><td>Total (${esc(o.payment)})</td><td>${money(o.total)}</td></tr>
    </table>
    <p class="meta">Deliver to: ${esc(c.name)}, ${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} – ${esc(c.pincode)}${c.country ? ', ' + esc(c.country) : ''} · ${esc(c.phone)}</p>
  </div>`;
  // online payment started but not completed
  if (o.status === 'pending') {
    return layout(db, 'Payment pending', `
<section class="wrap pad thanks">
  <div class="tick wait">!</div>
  <h1>Payment not completed</h1>
  <p class="lead">We have not received the payment for order <b>${esc(o.number)}</b>. Your cart is saved — you can try again. If money was deducted, please contact us with this order number.</p>
  ${table}
  <a class="btn" href="/checkout">Try payment again</a> &nbsp; <a class="btn btn-outline" href="/contact">Contact us</a>
</section>`);
  }
  const paid = o.paymentStatus === 'paid';
  const body = `
<section class="wrap pad thanks">
  <div class="tick">✓</div>
  <h1>Thank you, ${esc(c.name.split(' ')[0])}!</h1>
  <p class="lead">${paid ? `Payment received. Your order <b>${esc(o.number)}</b> is confirmed.` : `Your order <b>${esc(o.number)}</b> has been placed.`} We will contact you on ${esc(c.phone)} about delivery.</p>
  ${table}
  <a class="btn" href="/shop">Continue shopping</a>
</section>
<script>try{localStorage.removeItem('rs_cart');localStorage.removeItem('rs_coupon')}catch(e){}</script>`;
  return layout(db, 'Order placed', body);
}

function contact(db) {
  const s = db.settings;
  const body = `
<section class="page-head"><div class="wrap"><span class="kicker">We'd love to hear from you</span><h1>Contact Us</h1></div></section>
<section class="wrap pad checkout">
  <form id="contactForm" class="panel" novalidate>
    <div class="fields">
      <label class="field"><span>Your name *</span><input name="name" required maxlength="80"></label>
      <label class="field"><span>Mobile number</span><input name="phone" type="tel" maxlength="15"></label>
      <label class="field full"><span>Email</span><input name="email" type="email" maxlength="120"></label>
      <label class="field full"><span>Message *</span><textarea name="message" rows="5" required maxlength="2000"></textarea></label>
    </div>
    <p class="form-error" id="formError" hidden></p>
    <button class="btn" type="submit">Send message</button>
  </form>
  <aside class="panel summary">
    <h3>${esc(s.siteName)}</h3>
    ${s.address ? `<p>${esc(s.address)}</p>` : ''}
    ${s.phone ? `<p><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></p>` : ''}
    ${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
  </aside>
</section>`;
  return layout(db, 'Contact', body, { path: '/contact' });
}

function page(db, pg) {
  const body = `
<section class="page-head"><div class="wrap"><h1>${esc(pg.title)}</h1></div></section>
<section class="wrap pad prose">${paras(pg.content)}</section>`;
  return layout(db, pg.title, body, { path: '/page/' + pg.slug });
}

function notFound(db) {
  return layout(db, 'Page not found', `<section class="wrap pad thanks"><h1>Page not found</h1><p class="lead">The page you are looking for does not exist.</p><a class="btn" href="/">Back to home</a></section>`);
}

// shell of the admin panel (the panel itself is public/admin/admin.js)
function adminPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin | Rupali Shine</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${asset('/admin/admin.css')}">
</head>
<body>
<div id="app"></div>
<div id="modal" class="modal" hidden></div>
<div id="toast" class="toast" hidden></div>
<script src="${asset('/admin/admin.js')}"></script>
</body>
</html>`;
}

module.exports = { adminPage, home, shop, product, cart, checkout, orderPlaced, contact, page, notFound };
