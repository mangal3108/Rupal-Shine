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
  bag: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12.2a1 1 0 0 1-1 .8H7a1 1 0 0 1-1-.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  wa: '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M16 3.2A12.8 12.8 0 0 0 5 22.4L3.3 28.7l6.5-1.7A12.8 12.8 0 1 0 16 3.2zm0 23.3c-2 0-3.9-.5-5.5-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.6 10.6 0 1 1 16 26.5z"/><path fill="currentColor" d="M21.8 18.6c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2.1-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.7 5 2.8 1.1 3.4.9 4 .8.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>',
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
  // handwritten wordmark (default) or the uploaded logo image — chosen in Admin → Site settings → Header & logo
  if (s.logoStyle !== 'image' || !s.logoImage) {
    const word = String(s.logoText || s.siteName || '').trim();
    return `<span class="wordmark"><span class="wm-text">${esc(word)}</span>${s.logoTm !== false ? '<sup>™</sup>' : ''}<svg class="wm-swash" viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden="true"><path d="M6 9 C 50 3, 120 2, 160 6 S 205 10, 214 4"/></svg><span class="wm-leaf" aria-hidden="true">${ICON.leaf}</span></span>`;
  }
  if (s.logoImage) return `<img src="${esc(s.logoImage)}" alt="${esc(s.siteName)}" class="logo-img">`;
  const parts = s.siteName.trim().split(/\s+/);
  const first = parts.shift();
  return `<span class="logo-mark">${ICON.crown}</span><span class="logo-text"><b>${esc(first)}</b>${parts.length ? `<i>${esc(parts.join(' '))}</i>` : ''}</span>`;
}

// asset links carry the file's last-modified time, so browsers always pick up new versions
const fs = require('fs'), path = require('path');
const asset = p => { try { return p + '?v=' + Math.round(fs.statSync(path.join(__dirname, 'public', p)).mtimeMs).toString(36); } catch (e) { return p; } };

// WhatsApp chat link with the greeting typed in for the customer; on a product page it names the product
function waLink(s, about = '') {
  const num = String(s.whatsapp || '').replace(/\D/g, '');
  if (!num) return '';
  const msg = [String(s.waMessage || '').trim(), about ? `Product: ${about}` : ''].filter(Boolean).join('\n');
  return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
}
function waButton(s, about) {
  const link = waLink(s, about);
  if (!link || s.waEnabled === false) return '';
  const left = s.waPosition === 'left';
  return `<div class="wa-float${left ? ' left' : ''}" data-wa>
  ${s.waBubble ? `<div class="wa-bubble" data-wa-bubble hidden><button type="button" class="wa-x" data-wa-close aria-label="Close">×</button><b>${esc(s.siteName)}</b><p>${esc(s.waBubble)}</p><a href="${esc(link)}" target="_blank" rel="noopener">Start chat →</a></div>` : ''}
  <a class="wa-btn" href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(s.waLabel || 'Chat on WhatsApp')}">${ICON.wa}${s.waLabel ? `<span>${esc(s.waLabel)}</span>` : ''}</a>
</div>`;
}

function layout(db, title, body, { desc = '', path = '', about = '' } = {}) {
  const s = db.settings;
  const menuPages = db.pages.filter(p => p.showInMenu);
  const footPages = db.pages.filter(p => p.showInFooter);
  const nav = [['/', 'Home'], ['/shop', 'Shop'], ...menuPages.map(p => ['/page/' + p.slug, p.title]), ...(publishedDocs(db).length ? [['/certificates', 'Certificates']] : []), ['/contact', 'Contact']];
  const wa = waLink(s);
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${asset('/css/style.css')}">
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
${s.announcement ? `<div class="announce"><span>${esc(s.announcement)}</span></div>` : ''}
<header class="site-header" data-header>
  <div class="wrap header-row">
    <div class="h-side h-left">
      <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-controls="drawer" aria-expanded="false" data-menu-open>${ICON.menu}</button>
      <nav class="h-nav" aria-label="Main">
        ${nav.map(([href, label]) => `<a href="${esc(href)}"${href === path ? ' class="on" aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
      </nav>
    </div>
    <a class="logo" href="/" aria-label="${esc(s.siteName)} home">${logo(s)}</a>
    <div class="h-side h-right">
      ${wa && s.waEnabled !== false ? `<a class="icon-btn h-wa" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${ICON.wa}</a>` : ''}
      <a class="icon-btn cart-btn" href="/cart" aria-label="Cart">${ICON.bag}<span class="cart-count" data-cart-count hidden>0</span></a>
    </div>
  </div>
</header>
<div class="drawer" id="drawer" data-drawer hidden>
  <div class="drawer-shade" data-menu-close></div>
  <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="drawer-head"><a class="logo" href="/">${logo(s)}</a><button class="icon-btn" type="button" aria-label="Close menu" data-menu-close>${ICON.close}</button></div>
    <nav class="drawer-nav">${nav.map(([href, label]) => `<a href="${esc(href)}"${href === path ? ' class="on" aria-current="page"' : ''}>${esc(label)}<span>${ICON.arrow}</span></a>`).join('')}</nav>
    <div class="drawer-foot">
      ${wa && s.waEnabled !== false ? `<a class="btn drawer-wa" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.wa} Chat on WhatsApp</a>` : ''}
      ${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">Call ${esc(s.phone)}</a>` : ''}
      ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}
    </div>
  </aside>
</div>
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
      <a href="/shop">All Products</a><a href="/cart">Cart</a>${publishedDocs(db).length ? '<a href="/certificates">Certificates &amp; registrations</a>' : ''}<a href="/contact">Contact Us</a>
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
${waButton(s, about)}
${LIGHTBOX}
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
// direct .mp4 / .webm link. Until a link is added it shows a slow, cinematic slideshow of the product photos.
function videoBlock(s, f) {
  const url = String(s.videoUrl || '');
  const poster = f && f.images[0];
  const yt = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/(?:shorts|embed|live)\/)([\w-]{6,})/);
  let media = '';
  if (yt) media = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt[1])}" title="${esc(s.videoTitle || 'Video')}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  else if (/\.(mp4|webm)(\?|$)/i.test(url)) media = `<video src="${esc(url)}" controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''}></video>`;
  if (!media) {
    // no video yet: photo slideshow with a slow zoom, like a film
    const shots = [...new Set([...(f ? f.images : []), s.storyImage].filter(Boolean))].slice(0, 7);
    if (!shots.length) return '';
    media = `<div class="montage" data-montage>
      ${shots.map((im, i) => `<img src="${esc(im)}" alt=""${i ? ' loading="lazy"' : ' class="on"'}>`).join('')}
      <div class="montage-shade"></div>
      <div class="montage-text"><span>${ICON.leaf}${esc(s.siteName || 'Rupali Shine')}</span><b>${esc(s.videoCaption || 'From her kitchen to your home')}</b></div>
      <ol class="montage-dots" aria-hidden="true">${shots.map((_, i) => `<li${i ? '' : ' class="on"'}></li>`).join('')}</ol>
    </div>`;
  }
  const isFilm = media.startsWith('<iframe') || media.startsWith('<video');
  return `<section class="video-sec" id="video">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="kicker">${esc(s.videoKicker || 'Watch')}</span>
      <h2>${esc(s.videoTitle || 'See how it is made')}</h2>
    </div>
    <div class="video-card reveal">
      <span class="v-badge">${ICON.leaf}Handmade with care</span>
      <div class="video-frame">${media}</div>
      ${s.videoCaption && isFilm ? `<p>${esc(s.videoCaption)}</p>` : ''}
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

function home(db, products, reviews) {
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

${bannerSlider(db)}

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

${foundersBlock(s)}

${certStrip(db)}

${videoBlock(s, f)}

${whyBlock(s, f)}

${galleryBlock(s, f)}

${reviewsHome(reviews, f)}

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
  const bar = f && f.stock > 0 ? stickyBuy(f, reviews && reviews.summary, { watch: '[data-hero]', mobileOnly: true }) : '';
  return layout(db, '', body + bar, { path: '/' });
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

/* ---------------- sticky buy bar ---------------- */
// Pinned to the bottom of the screen once the page's own buy buttons have scrolled away.
// `watch` is the element that hides the bar while it is on screen; `mobileOnly` hides it on desktops.
function stickyBuy(p, summary, { qtyFrom = '', watch = '', mobileOnly = false } = {}) {
  const qty = qtyFrom ? ` data-qty-from="${qtyFrom}"` : '';
  return `<div class="sticky-buy${mobileOnly ? ' mobile-only' : ''}" data-sticky-buy data-watch="${esc(watch)}" hidden>
  ${p.images[0] ? `<img class="sb-img" src="${esc(p.images[0])}" alt="" width="46" height="46">` : ''}
  <div class="sb-info"><b>${esc(p.name)}</b>
    <span class="sb-price">${money(p.price)}${off(p) ? ` <s>${money(p.mrp)}</s> <em>${off(p)}% OFF</em>` : ''}</span>
    ${summary && summary.count ? `<span class="sb-rating">★ ${summary.avg.toFixed(1)} <small>(${summary.count})</small></span>` : ''}
  </div>
  <button class="btn sb-cart" data-add="${esc(p.id)}" data-name="${esc(p.name)}"${qty} aria-label="Add to cart">${ICON.cart}<span>Add</span></button>
  <button class="btn btn-buy sb-buy" data-add="${esc(p.id)}"${qty} data-go="/checkout">Buy now</button>
</div>`;
}

/* ---------------- reviews ---------------- */
// gold stars filled to the exact rating (4.6 → 92%)
const starBar = (r, cls = '') => `<span class="rs-stars ${cls}" style="--pct:${Math.max(0, Math.min(100, r / 5 * 100))}%" role="img" aria-label="${r} out of 5 stars"><i>★★★★★</i></span>`;
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const reviewDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function reviewCard(r, { product = '' } = {}) {
  return `<article class="rv-card">
    <header>
      <span class="rv-avatar" aria-hidden="true">${esc(initials(r.name))}</span>
      <div><b>${esc(r.name)}</b><small>${r.city ? esc(r.city) + ' · ' : ''}${reviewDate(r.createdAt)}</small></div>
      ${r.verified ? '<span class="rv-verified" title="Bought from Rupali Shine">✓ Verified buyer</span>' : ''}
    </header>
    ${starBar(r.rating)}
    ${r.title ? `<h4>${esc(r.title)}</h4>` : ''}
    <p>${esc(r.text)}</p>
    ${r.photo ? `<img class="rv-img" src="${esc(r.photo)}" alt="Photo from ${esc(r.name)}" loading="lazy">` : ''}
    ${product ? `<span class="rv-product">${esc(product)}</span>` : ''}
    ${r.reply ? `<div class="rv-reply"><b>Reply from Rupali Shine</b>${esc(r.reply)}</div>` : ''}
  </article>`;
}

function reviewsSection(p, rv) {
  const { list, summary: s } = rv;
  const SHOW = 6;
  return `<section class="reviews-sec" id="reviews">
  <div class="wrap">
    <div class="sec-head"><span class="kicker">Customer reviews</span><h2>What our customers say</h2></div>
    <div class="rv-layout">
      <aside class="rv-summary">
        ${s.count ? `<div class="rv-avg"><b>${s.avg.toFixed(1)}</b><span>out of 5</span></div>
        ${starBar(s.avg, 'lg')}
        <p class="rv-based">Based on ${plural(s.count, 'review')}</p>
        <ul class="rv-bars">${s.bars.map((n, i) => `<li><span>${5 - i} ★</span><i><em style="width:${s.count ? Math.round(n / s.count * 100) : 0}%"></em></i><small>${n}</small></li>`).join('')}</ul>`
        : `<div class="rv-empty"><span class="rv-quote" aria-hidden="true">“</span><p><b>No reviews yet.</b> Tried ${esc(p.name)}? Your words help the next family decide.</p></div>`}
        <button type="button" class="btn btn-buy btn-block" data-review-open>Write a review</button>
      </aside>
      <div class="rv-main">
        <form class="rv-form" id="reviewForm" data-product="${esc(p.id)}" novalidate${s.count ? ' hidden' : ''}>
          <h3>Share your experience</h3>
          <div class="rv-pick" role="radiogroup" aria-label="Your rating">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="rate${n}" name="rating" value="${n}"><label for="rate${n}" title="${plural(n, 'star')}">★</label>`).join('')}<span class="rv-pick-label" data-rate-label>Tap a star to rate</span></div>
          <div class="fields">
            <label class="field" data-field="name"><span>Your name *</span><input name="name" maxlength="60" autocomplete="name" required><small class="err" hidden></small></label>
            <label class="field"><span>City</span><input name="city" maxlength="60" autocomplete="address-level2"></label>
            <label class="field full"><span>Heading</span><input name="title" maxlength="100" placeholder="E.g. Less hair fall in a month"></label>
            <label class="field full" data-field="text"><span>Your review *</span><textarea name="text" rows="4" maxlength="1500" required placeholder="How did your hair feel? How long have you used it?"></textarea><small class="err" hidden></small></label>
            <label class="field"><span>Order number (optional)</span><input name="orderNumber" maxlength="20" placeholder="E.g. RS-1001"></label>
            <label class="field"><span>Mobile used for the order</span><div class="with-prefix"><b>+91</b><input name="phone" inputmode="numeric" maxlength="10" autocomplete="tel-national"></div></label>
            <p class="rv-hint full">Add your order number and mobile to get a <b>✓ Verified buyer</b> badge. Your number is never shown.</p>
            <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          </div>
          <p class="form-error" data-review-error hidden></p>
          <button class="btn btn-buy" type="submit">Submit review</button>
        </form>
        <div class="rv-thanks" data-review-thanks hidden></div>
        ${list.length ? `<div class="rv-cards">${list.map((r, i) => i < SHOW ? reviewCard(r) : reviewCard(r).replace('<article class="rv-card">', '<article class="rv-card" hidden data-more>')).join('')}</div>
        ${list.length > SHOW ? `<button type="button" class="btn btn-outline rv-more" data-review-more>Show all ${list.length} reviews</button>` : ''}` : ''}
      </div>
    </div>
  </div>
</section>${s.count ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: p.images[0] || undefined,
    aggregateRating: { '@type': 'AggregateRating', ratingValue: s.avg, reviewCount: s.count },
    review: list.slice(0, 10).map(r => ({ '@type': 'Review', author: { '@type': 'Person', name: r.name }, datePublished: String(r.createdAt).slice(0, 10), reviewBody: r.text, reviewRating: { '@type': 'Rating', ratingValue: r.rating } }))
  }).replace(/</g, '\\u003c')}</script>` : ''}`;
}

// home page strip: featured reviews (or the newest) as cards
function reviewsHome(rv, f) {
  if (!rv || !rv.list.length) return '';
  const s = rv.summary;
  return `<section class="reviews-home" id="reviews">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="kicker">Loved by our customers</span>
      <h2>Real words from real homes</h2>
      <p class="rv-headline">${starBar(s.avg, 'lg')}<b>${s.avg.toFixed(1)}</b> out of 5 · ${plural(s.count, 'review')}</p>
    </div>
    <div class="rv-row reveal">${rv.list.map(r => reviewCard(r)).join('')}</div>
    ${f ? `<p class="rv-all"><a class="link" href="/product/${esc(f.slug)}#reviews">Read all reviews ${ICON.arrow}</a></p>` : ''}
  </div>
</section>`;
}

function product(db, p, related, methods = [], offers = {}, rv = { list: [], summary: { count: 0, avg: 0, bars: [0, 0, 0, 0, 0] } }) {
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
    <a class="rating-line" href="#reviews">${rv.summary.count ? `${starBar(rv.summary.avg)}<b>${rv.summary.avg.toFixed(1)}</b><span>${plural(rv.summary.count, 'review')}</span>` : '<span>Be the first to review</span>'}</a>
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
      <span><b>${esc(c.summary)}</b> — use code <code>${esc(c.code)}</code>${c.expires ? `<small class="coupon-ends" data-ends="${esc(c.expires)}">Ends ${esc(new Date(c.expires).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }))}</small>` : ''}</span><em>Tap to apply</em></button>`).join('')}</div>` : ''}
    ${s.prepaidPercent > 0 && methods.some(m => m.id !== 'cod') ? `<p class="assure">Pay online and get an extra ${s.prepaidPercent}% off at checkout.</p>` : ''}
    ${s.freeShippingAbove > 0 ? `<p class="assure">Free delivery on orders above ${money(s.freeShippingAbove)}.</p>` : !s.shippingFee ? '<p class="assure">Free delivery on every order.</p>' : ''}

    ${trust.length ? `<ul class="trust">${trust.map(t => `<li>${TRUST_ICON}${esc(t)}</li>`).join('')}</ul>` : ''}
    ${certLink(db)}
    ${p.benefits.length ? `<div class="block"><h3>Benefits</h3><ul class="tick-list">${p.benefits.map(b => `<li>${ICON.leaf}${esc(b)}</li>`).join('')}</ul></div>` : ''}
  </div>
</section>
<section class="wrap pdp-details">
  ${p.description ? `<div class="block"><h3>About this product</h3>${paras(p.description)}</div>` : ''}
  ${p.ingredients.length ? `<div class="block"><h3>Ingredients</h3>${chips(p.ingredients)}</div>` : ''}
  ${steps.length ? `<div class="block"><h3>How to use</h3><ol class="how">${steps.map(st => `<li>${st.title ? `<b>${esc(st.title)}.</b> ` : ''}${esc(st.text)}</li>`).join('')}</ol></div>` : ''}
  ${p.caution ? `<div class="block caution"><h3>Caution</h3>${paras(p.caution)}</div>` : ''}
</section>
${reviewsSection(p, rv)}
${related.length ? `<section class="wrap products-sec"><h2 class="section-title">You may also like</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}
${inStock ? stickyBuy(p, rv.summary, { qtyFrom: 'qty', watch: '#buyRow' }) : ''}`;
  return layout(db, p.name, body, { desc: p.shortDesc, about: p.name });
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

/* ---------------- brand photos: banner slider, founders, gallery ---------------- */
// promotional banners under the hero, sliding every few seconds (swipe on phones)
function bannerSlider(db) {
  const slides = (db.banners || []).filter(b => b.published && b.image);
  if (!slides.length) return '';
  const img = b => `<span class="bn-blur" style="background-image:url('${esc(b.image)}')" aria-hidden="true"></span><picture>${b.mobileImage ? `<source media="(max-width: 640px)" srcset="${esc(b.mobileImage)}">` : ''}<img src="${esc(b.image)}" alt="${esc(b.alt)}"${slides[0] === b ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
  return `<section class="banners" aria-label="Offers" data-banners>
  <div class="wrap">
    <div class="bn-frame">
      <div class="bn-track" data-bn-track>
        ${slides.map((b, i) => b.link ? `<a class="bn-slide" href="${esc(b.link)}" aria-label="${esc(b.alt || 'Banner ' + (i + 1))}">${img(b)}</a>` : `<div class="bn-slide">${img(b)}</div>`).join('')}
      </div>
      ${slides.length > 1 ? `<button type="button" class="bn-arrow prev" data-bn-step="-1" aria-label="Previous banner">‹</button><button type="button" class="bn-arrow next" data-bn-step="1" aria-label="Next banner">›</button>
      <div class="bn-dots">${slides.map((_, i) => `<button type="button" data-bn-go="${i}" aria-label="Banner ${i + 1}"${i ? '' : ' class="on"'}></button>`).join('')}</div>` : ''}
    </div>
  </div>
</section>`;
}

// "Meet our founders": photo card + short text
function foundersBlock(s) {
  if (s.foundersShow === false || !s.foundersImage) return '';
  return `<section class="founders" id="founders">
  <div class="wrap">
    <div class="founders-card reveal">
      <figure class="founders-photo"><img src="${esc(s.foundersImage)}" alt="${esc(s.foundersNames ? s.foundersNames + ', founders of ' + s.siteName : 'Our founders')}" loading="lazy"></figure>
      <div class="founders-copy">
        ${s.foundersKicker ? `<span class="kicker">${esc(s.foundersKicker)}</span>` : ''}
        <h2>${esc(s.foundersTitle || 'Meet our founders')}</h2>
        ${rich(s.foundersText)}
        <p class="founders-sign">— ${esc(s.foundersNames || '')}</p>
      </div>
    </div>
  </div>
</section>`;
}

// lifestyle photos of the bottle, tap to view full size
function galleryBlock(s, f) {
  const pics = (s.galleryImages || []).filter(Boolean);
  if (s.galleryShow === false || !pics.length) return '';
  return `<section class="gallery-sec" id="gallery">
  <div class="wrap">
    <div class="sec-head reveal">${s.galleryKicker ? `<span class="kicker">${esc(s.galleryKicker)}</span>` : ''}<h2>${esc(s.galleryTitle || 'Gallery')}</h2></div>
    <div class="gal-grid reveal">
      ${pics.map((im, i) => `<a class="gal-item" href="${esc(im)}" data-lightbox data-caption="${esc(s.siteName)}"><img src="${esc(im)}" alt="${esc(s.siteName)} herbal oil" loading="lazy"></a>`).join('')}
    </div>
    ${f ? `<p class="gal-cta"><a class="btn btn-buy" href="/product/${esc(f.slug)}">Shop ${esc(f.name)} ${ICON.arrow}</a></p>` : ''}
  </div>
</section>`;
}
// the full-size viewer used by the gallery and the certificates page
const LIGHTBOX = `<div class="lightbox" data-lightbox-box hidden role="dialog" aria-modal="true" aria-label="Photo">
  <button type="button" class="lb-close" data-lightbox-close aria-label="Close">${ICON.close}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
</div>`;

/* ---------------- certificates & registrations ---------------- */
const publishedDocs = db => (db.documents || []).filter(d => d.published && d.image);
const docDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const SEAL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14.5 7.5 22l4.5-2.5 4.5 2.5L15 14.5"/><path d="m9.5 9 1.8 1.8L14.8 7.5"/></svg>';

// home page: small "certified & registered" row
function certStrip(db) {
  const docs = publishedDocs(db).filter(d => d.featured);
  if (!docs.length) return '';
  return `<section class="cert-strip">
  <div class="wrap">
    <div class="sec-head reveal"><span class="kicker">Certified &amp; registered</span><h2>Made with care — and on record</h2></div>
    <div class="cert-row reveal">
      ${docs.map(d => `<a class="cert-mini" href="/certificates#${esc(d.id)}">
        <span class="cm-img"><img src="${esc(d.thumb || d.image)}" alt="${esc(d.title)}" loading="lazy"></span>
        <span class="cm-text"><b>${SEAL}${esc(d.badge || d.title)}</b><small>${esc(d.issuer)}</small></span>
      </a>`).join('')}
    </div>
    <p class="rv-all"><a class="link" href="/certificates">See all certificates ${ICON.arrow}</a></p>
  </div>
</section>`;
}
// product page: one line under the trust points
function certLink(db) {
  const docs = publishedDocs(db).filter(d => d.featured && d.badge);
  return docs.length ? `<a class="cert-link" href="/certificates">${SEAL}<span>${docs.map(d => esc(d.badge)).join(' · ')}</span><em>View certificates</em></a>` : '';
}

function certificates(db) {
  const docs = publishedDocs(db);
  const body = `
<section class="page-head certs-head"><div class="wrap">
  <span class="kicker">Trust &amp; transparency</span>
  <h1>Certificates &amp; Registrations</h1>
  <p class="lead">Every document below is shown exactly as it was issued. Tap one to see it in full size, or check it yourself on the issuer’s website.</p>
</div></section>
<section class="wrap pad">
  ${docs.length ? `<div class="cert-grid">
    ${docs.map((d, i) => `<article class="cert-card reveal" id="${esc(d.id)}" style="--d:${i}">
      <a class="cert-img" href="${esc(d.image)}" data-lightbox data-caption="${esc(d.title)}" aria-label="Open ${esc(d.title)} full size">
        <img src="${esc(d.thumb || d.image)}" alt="${esc(d.title)}" loading="${i < 2 ? 'eager' : 'lazy'}">
        <span class="cert-zoom">Tap to view full size</span>
      </a>
      <div class="cert-body">
        ${d.kind ? `<span class="cert-kind">${esc(d.kind)}</span>` : ''}
        <h2>${esc(d.title)}</h2>
        ${d.issuer ? `<p class="cert-issuer">Issued by ${esc(d.issuer)}</p>` : ''}
        <dl class="cert-facts">
          ${d.number ? `<div><dt>Number</dt><dd><code>${esc(d.number)}</code></dd></div>` : ''}
          ${d.issued ? `<div><dt>Issued</dt><dd>${docDate(d.issued)}</dd></div>` : ''}
          ${d.validUntil ? `<div><dt>Valid until</dt><dd>${docDate(d.validUntil)}</dd></div>` : ''}
        </dl>
        ${d.summary ? `<p class="cert-summary">${esc(d.summary)}</p>` : ''}
        ${d.verifyUrl ? `<div class="cert-verify"><a class="btn btn-outline btn-sm" href="${esc(d.verifyUrl)}" target="_blank" rel="noopener nofollow">Verify on issuer’s site ↗</a>${d.verifyHint ? `<small>${esc(d.verifyHint)}</small>` : ''}</div>` : ''}
      </div>
    </article>`).join('')}
  </div>
  <p class="cert-foot">Questions about any certificate? <a href="/contact">Contact us</a> — we are happy to share more details.</p>`
  : '<p class="empty">Certificates will appear here soon.</p>'}
</section>`;
  return layout(db, 'Certificates & Registrations', body, { path: '/certificates', desc: `${db.settings.siteName} certificates and registrations: ${docs.map(d => d.title).join(', ')}.` });
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

module.exports = { adminPage, home, shop, product, cart, checkout, orderPlaced, contact, page, notFound, certificates };
