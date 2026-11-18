// Rupali Shine — storefront + admin CMS
// Run:  npm start   →  http://localhost:3000   (admin: /admin)
// Needs MONGODB_URI (in a .env file locally, or in the host's environment variables).
const path = require('path');
const fs = require('fs');
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* no .env file: settings come from the host's environment */ }
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const views = require('./views');
const pincode = require('./pincode');
const { db, middleware: storeMiddleware, stockMoved, counterMoved, nextOrderNumber, saveUpload, getUpload, ALL_LISTS } = require('./store');

const PORT = process.env.PORT || 3000;

/* ---------------- starter data & upgrades (the data itself lives in MongoDB — see store.js) ---------------- */
const defaultPayments = () => ({
  razorpay: { enabled: false, keyId: '', keySecret: '' },
  stripe: { enabled: false, secretKey: '' },
  cashfree: { enabled: false, appId: '', secretKey: '', mode: 'test' }
});
const ING_IMAGES = [['jatamansi', 'jatamansi'], ['brahmi', 'brahmi'], ['methi', 'methi'], ['fenugreek', 'methi'], ['aloe', 'aloe'], ['alovera', 'aloe'], ['bhringraj', 'bhringraj'], ['curry', 'curry'], ['amla', 'amla'], ['hibiscus', 'hibiscus'], ['coconut', 'coconut']];
function defaultIngredientImage(name) {
  const hit = ING_IMAGES.find(([k]) => name.toLowerCase().includes(k));
  const file = hit && `ing-${hit[1]}.webp`;
  return file ? '/uploads/' + file : '';
}
const creditsPage = () => ({
  id: crypto.randomUUID(), slug: 'image-credits', title: 'Image Credits', showInMenu: false, showInFooter: true,
  content: 'Ingredient photographs on this website are used under free licences from Wikimedia Commons:\n\n' + [
    'Jatamansi — "Nardostachys jatamansi, young inflorescence buds" by Plantagenet, CC BY-SA 4.0',
    'Brahmi — "Bacopa monnieri kz04" by Krzysztof Ziarnek (Kenraiz), CC BY-SA 4.0',
    'Methi Dana — "Fenugreek seeds" by Atudu, CC BY-SA 4.0',
    'Aloe Vera — "Cut Aloe Vera Leaf" by Rae Allen, CC BY 2.0',
    'Bhringraj — "Eclipta prostrata 5Dsr 1-2576" by SAplants, CC BY-SA 4.0',
    'Curry Patta — "20260317 Murraya koenigii 02" by Flocci Nivis, CC BY 4.0',
    'Amla — "Phyllanthus emblica fruit 02" by Krish Dulal, CC BY-SA 4.0',
    'Hibiscus — "Hibiscus rosa-sinensis flower (red) 1" by ChiK, CC BY-SA 4.0',
    'Coconut — "Coconuts - single and cracked open" by Ivar Leidus, CC BY-SA 4.0'
  ].join('\n') + '\n\nAll photographs are available at commons.wikimedia.org and have been cropped for display.'
});

// bring older data up to the current shape
function migrate() {
  if ((db.version || 1) >= 2) return;
  for (const p of db.products) {
    p.ingredients = (p.ingredients || []).map(i => {
      if (typeof i !== 'string') return i;
      const name = i.replace(/^[^\p{L}\p{N}]+/u, '').trim();
      return { name, image: defaultIngredientImage(name) };
    });
  }
  db.settings.payments = db.settings.payments || defaultPayments();
  if (!db.settings.logoImage) db.settings.logoImage = '/uploads/rupali-logo.png';
  if (!db.pages.some(p => p.slug === 'image-credits')) db.pages.push(creditsPage());
  db.version = 2;
}

function seed() {
  const now = new Date().toISOString();
  return {
    version: 2,
    admin: null,
    seq: { order: 1000 },
    settings: {
      siteName: 'Rupali Shine',
      logoImage: '/uploads/rupali-logo.png',
      payments: defaultPayments(),
      announcement: '100% Natural • 100% Handmade • Made in India',
      heroKicker: 'Herbal Hair Oil',
      heroTitle: 'The Power of Nature for Your Hair',
      heroSubtitle: 'A handmade blend of powerful herbs in cold-pressed coconut oil — for strong, healthy and beautiful hair.',
      heroCta: 'Shop Now',
      heroImage: '/uploads/rupali-herbs.webp',
      introKicker: 'Handmade in small batches',
      introTitle: 'Stronger • Thicker • Healthier Hair',
      introText: 'Rupali Shine Herbal Oil is prepared by hand with time-tested herbs like Amla, Bhringraj, Brahmi and Hibiscus in pure cold-pressed coconut oil.',
      herbsTitle: 'Our Herbs',
      email: 'rupalishineherbeloil@gmail.com',
      phone: '',
      whatsapp: '',
      address: 'Tilak Nagar, Delhi – 110018',
      instagram: '',
      facebook: '',
      youtube: '',
      shippingFee: 0,
      freeShippingAbove: 0,
      codEnabled: true,
      footerNote: 'Handmade herbal hair care from Delhi, India.'
    },
    products: [{
      id: crypto.randomUUID(),
      slug: 'rupali-shine-herbal-oil',
      name: 'Rupali Shine Herbal Oil',
      category: 'Hair Oil',
      size: '100 ml',
      price: 699,
      mrp: 699,
      stock: 100,
      featured: true,
      active: true,
      shortDesc: 'Handmade herbal hair oil with powerful herbs in cold-pressed coconut oil. 100% natural.',
      description: 'Rupali Shine Herbal Oil brings together time-tested herbs in a base of pure, cold-pressed coconut oil. Every bottle is 100% natural and 100% handmade.\n\nRegular massage nourishes the scalp, strengthens the roots and leaves hair soft, thick and shiny.',
      images: ['/uploads/rupali-front.webp', '/uploads/rupali-herbs.webp', '/uploads/rupali-ingredients.png', '/uploads/rupali-how-to-use.png', '/uploads/rupali-results.webp'],
      ingredients: ['Jatamansi', 'Brahmi', 'Methi Dana (Fenugreek Seeds)', 'Aloe Vera', 'Bhringraj', 'Curry Patta (Curry Leaves)', 'Amla (Indian Gooseberry)', 'Hibiscus', 'Coconut Oil (Cold Pressed)'].map(name => ({ name, image: defaultIngredientImage(name) })),
      benefits: ['Promotes hair growth', 'Strengthens hair roots', 'Helps reduce hair fall and breakage', 'Nourishes the scalp', 'Makes hair soft, thick, shiny and healthy'],
      howToUse: ['Take Oil: Take sufficient oil in your palm.', 'Massage: Massage gently on your hair and scalp for 5–10 minutes.', 'Leave On: For best results, leave it on for at least 1 hour or overnight.', 'Wash: Wash your hair with a mild shampoo.'],
      caution: 'For external use only. Keep out of reach of children. Avoid contact with eyes; in case of contact, rinse thoroughly with water. If irritation or allergy occurs, discontinue use and consult a doctor. Store in a cool & dry place.',
      createdAt: now
    }],
    pages: [
      { id: crypto.randomUUID(), slug: 'about', title: 'About Us', showInMenu: true, showInFooter: true, content: 'Rupali Shine is a handmade herbal hair care brand from Tilak Nagar, Delhi.\n\nOur herbal oil is prepared in small batches using natural herbs and cold-pressed coconut oil — 100% natural and 100% handmade.' },
      { id: crypto.randomUUID(), slug: 'shipping-policy', title: 'Shipping Policy', showInMenu: false, showInFooter: true, content: 'Edit this page from the admin panel (Pages) to describe your delivery time, courier partners and shipping charges.' },
      { id: crypto.randomUUID(), slug: 'return-policy', title: 'Return & Refund Policy', showInMenu: false, showInFooter: true, content: 'Edit this page from the admin panel (Pages) to describe your return and refund policy.' },
      creditsPage()
    ],
    orders: [],
    messages: []
  };
}

// first run: start from the old local data file if there is one (so nothing is lost when moving to MongoDB)
function firstData() {
  const file = path.join(__dirname, 'data', 'db.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); console.log('Importing existing store data from data/db.json into MongoDB'); }
  catch (e) { data = seed(); }
  return data;
}
const save = () => {}; // changes are written to MongoDB automatically when the response is sent

const HOME_DEFAULTS = {
  statsLines: '9: Powerful herbs\n100%: Natural\n100%: Handmade',
  journeyKicker: 'From nature to your hair',
  journeyTitle: 'The Journey of Every Bottle',
  journeySteps: [
    'Gathered from Nature: Amla, Bhringraj, Brahmi, Hibiscus and more — every bottle begins with real herbs.',
    'Infused in Coconut Oil: The herbs are blended into pure, cold-pressed coconut oil, the base of our formula.',
    'Handmade with Care: Prepared and bottled by hand. 100% natural, 100% handmade.',
    'Your Hair Ritual: Massage, leave on, wash — for stronger, thicker, healthier hair.'
  ].join('\n')
};
// runs at every server start inside a database context: upgrades old data and fills in new settings
// Certificates page starter entries. Wording sticks to what each document actually is:
// Udyam = government registration, MQA = private third-party GMP certificate,
// ZED = the pledge (first step of the scheme, not a ZED certification level),
// Make in India = the business's own self-declaration (kept unpublished — see its note).
const STARTER_DOCUMENTS = [
  {
    title: 'Udyam Registration — MSME', kind: 'Government registration', badge: 'Govt. registered MSME',
    issuer: 'Ministry of Micro, Small & Medium Enterprises, Government of India',
    number: 'UDYAM-DL-11-0167330', issued: '2026-07-27', validUntil: '',
    summary: 'Rupali Shine Herbal Oil is registered with the Government of India as a Micro enterprise. Major activity: Manufacturing — hair oils and related products.',
    image: '/uploads/cert-udyam.webp', thumb: '/uploads/cert-udyam-sm.webp',
    verifyUrl: 'https://udyamregistration.gov.in/Udyam_Verify.aspx', verifyHint: 'Enter the Udyam number on the government portal.',
    published: true, featured: true, note: ''
  },
  {
    title: 'GMP Certificate of Compliance', kind: 'Independent certification', badge: 'GMP certified',
    issuer: 'MQA Certification Services (independent certification body)',
    number: 'GMP/26M05635', issued: '2026-08-03', validUntil: '2029-08-02',
    summary: 'An independent certification body assessed our unit and found it in compliance with GMP (Good Manufacturing Practices) for manufacturing hair oil and other herbal products. It stays valid subject to yearly surveillance audits.',
    image: '/uploads/cert-gmp-mqa.webp', thumb: '/uploads/cert-gmp-mqa-sm.webp',
    verifyUrl: 'https://www.mqacertification.com', verifyHint: 'Check the certificate number on the issuer’s website.',
    published: true, featured: true, note: 'This is a private certification, not a government GMP licence. Keep the wording “independent certification body”.'
  },
  {
    title: 'MSME ZED Pledge', kind: 'Government scheme pledge', badge: 'ZED pledge taken',
    issuer: 'Ministry of MSME — Sustainable (ZED) Certification Scheme',
    number: 'ZED_01082026_1004550', issued: '2026-08-01', validUntil: '',
    summary: 'We have taken the Zero Defect, Zero Effect pledge: a commitment to safe, high-quality products made with processes that are environmentally sound and socially responsible. The pledge is the first step of the ZED scheme; the Bronze, Silver and Gold certification levels come after it.',
    image: '/uploads/cert-zed-pledge.webp', thumb: '/uploads/cert-zed-pledge-sm.webp',
    verifyUrl: 'https://zed.msme.gov.in', verifyHint: 'Scan the QR code on the pledge, or visit the ZED portal.',
    published: true, featured: true, note: 'This is the pledge, not a ZED certificate — do not describe it as “ZED certified” until you get Bronze/Silver/Gold.'
  },
  {
    title: 'Make in India — self-declaration', kind: 'Self-declaration', badge: 'Made in India',
    issuer: 'Rupali Shine Herbal Oil (self-certified)',
    number: '', issued: '2026-09-22', validUntil: '',
    summary: 'Our own declaration, made for government purchases (GeM), that the product is made at our unit in Ashok Nagar, West Delhi.',
    image: '/uploads/cert-make-in-india.webp', thumb: '/uploads/cert-make-in-india-sm.webp',
    verifyUrl: '', verifyHint: '',
    published: false, featured: false,
    note: 'Kept off the website on purpose: (1) it is a self-declaration, not a certificate issued to you; (2) it states 0% local content, which reads badly to shoppers; (3) it carries the State Emblem of India, whose commercial use is restricted by the State Emblem of India (Prohibition of Improper Use) Act, 2005. Publish only after checking with your CA or lawyer.'
  }
];

// Brand photos. The two promo banners carry numbers ("4.4 star rating", "100000+ sold / happy customers")
// and health claims; they start hidden so they only go live once the owner confirms the numbers are true.
const BANNER_NOTE = 'Hidden until you confirm: this banner says “4.4 star rating” and “100000+ hair oil sold / happy customers”. Showing numbers that are not true is a misleading advertisement under the Consumer Protection Act, 2019. Publish it only if you can prove them (e.g. offline sales records, marketplace ratings) — otherwise ask your designer for a version without those numbers.';
const STARTER_BANNERS = [
  { image: '/uploads/banner-summer-special.webp', alt: 'Rupali Shine Herbal Oil — Summer Special', link: '/product/rupali-shine-herbal-oil', published: false, note: BANNER_NOTE },
  { image: '/uploads/banner-ayurvedic.webp', alt: 'Rupali Shine natural herbs hair oil, 100 ml', link: '/product/rupali-shine-herbal-oil', published: false, note: BANNER_NOTE }
];
const LIFESTYLE_PHOTOS = ['/uploads/rupali-bottle-bath.webp', '/uploads/rupali-bottle-herbs.webp', '/uploads/rupali-bottle-golden.webp', '/uploads/rupali-bottle-splash.webp'];
const FOUNDER_DEFAULTS = {
  foundersShow: true,
  foundersImage: '/uploads/founders-rupali-ansar.webp',
  foundersKicker: 'The people behind the bottle',
  foundersTitle: 'Meet our founders',
  foundersNames: 'Rupali & Ansar Khan',
  foundersText: 'Rupali Shine began at home, with a family recipe for hair oil made by hand. Rupali and Ansar Khan started the brand to take that same oil — the same herbs, the same care — to many more homes.\n\nEvery bottle is still prepared and packed at our unit in Ashok Nagar, West Delhi.',
  galleryShow: true,
  galleryKicker: 'In every home',
  galleryTitle: 'Made with nature, made for you',
  galleryImages: LIFESTYLE_PHOTOS,
  // "How to use" ritual: front of the bottle, then the two back-label photos
  ritualShow: true,
  ritualKicker: 'The Rupali Shine ritual',
  ritualTitle: 'Four simple steps to stronger hair',
  ritualImages: ['/uploads/rupali-bottle-splash.webp', '/uploads/rupali-back-how-to-use.webp', '/uploads/rupali-back-ingredients.webp'],
  // "Our story" as chapters, told by Ansar
  storyIntro: 'Three people, one recipe — and now, you.',
  storyChapters: [
    {
      label: 'Chapter one · Her', title: 'Her hands, her herbs', caption: 'My mother · in loving memory', image: '/uploads/rupali-mother-original.webp',
      text: 'In our home, hair oil was never something you bought. **My mother made it herself** — warming pure coconut oil slowly, then adding jatamansi, brahmi, bhringraj, amla, hibiscus, methi, curry leaves and aloe vera, each in its own measure.\n\nShe never wrote the recipe down. It lived in her hands, and in the patient head massages she gave everyone she loved.'
    },
    {
      label: 'Chapter two · Us', title: 'A promise we kept together', caption: 'Rupali · co-founder', image: '/uploads/rupali-portrait.webp',
      text: 'When she passed away, we realised her recipe could quietly leave with her. **My wife Rupali would not let that happen.**\n\nTogether we pieced it back — the herbs, the quantities, the slow warming — batch after batch, until it smelled and felt exactly like hers. Today Rupali makes sure every bottle is prepared the way my mother would have wanted.'
    },
    {
      label: 'Chapter three · You', title: 'From our home to yours', caption: 'Handmade in small batches', image: '/uploads/rupali-bottle-herbs.webp',
      text: 'Rupali Shine is that promise in a bottle — nine herbs in cold-pressed coconut oil, made by hand in small batches in Delhi.\n\nHer picture is on every label, because every bottle is still hers. **And every time you use it, her story continues with you.**'
    }
  ]
};
const BACK_LABEL_PHOTOS = ['/uploads/rupali-back-how-to-use.webp', '/uploads/rupali-back-ingredients.webp'];

function prepare() {
migrate();
if (!db.secret) db.secret = crypto.randomBytes(32).toString('hex'); // signs admin login cookies
for (const k in HOME_DEFAULTS) if (db.settings[k] === undefined) db.settings[k] = HOME_DEFAULTS[k];
// put the three bottle views first so the home page 3D viewer spins front → back
for (const p of db.products) {
  const want = ['/uploads/rupali-front.webp', '/uploads/rupali-ingredients.png', '/uploads/rupali-how-to-use.png'];
  if (!db.spinOrdered && p.images[0] === want[0] && want.every(w => p.images.includes(w))) p.images = [...want, ...p.images.filter(i => !want.includes(i))];
}
db.spinOrdered = true;
db.coupons = db.coupons || [];
db.reviews = db.reviews || [];
db.documents = db.documents || [];
db.banners = db.banners || [];
// first run with the brand photos: promo banners (kept off until their claims are confirmed),
// founders section, lifestyle gallery, and the bottle photos added to the product gallery
if (!db.brandPhotosAdded) {
  db.brandPhotosAdded = true;
  if (!db.banners.length) db.banners.push(...STARTER_BANNERS.map(b => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...b })));
  const f = db.products.find(p => p.featured) || db.products[0];
  if (f) for (const im of LIFESTYLE_PHOTOS) if (!f.images.includes(im)) f.images.push(im);
}
for (const [k, v] of Object.entries(FOUNDER_DEFAULTS)) if (db.settings[k] === undefined) db.settings[k] = v;
// first run with the story chapters and back-label photos
if (!db.storyChaptersAdded) {
  db.storyChaptersAdded = true;
  if (db.settings.storyTitle === 'This oil was my mother’s first') db.settings.storyTitle = 'A recipe that refused to be forgotten';
  if (db.settings.storySign === 'Her son, Founder of Rupali Shine') db.settings.storySign = 'Ansar & Rupali Khan';
  const f = db.products.find(p => p.featured) || db.products[0];
  if (f) for (const im of BACK_LABEL_PHOTOS) if (!f.images.includes(im)) f.images.push(im);
}
// first run: the business's certificates and registrations, described exactly as issued
if (!db.docsSeeded) {
  db.docsSeeded = true;
  if (!db.documents.length) db.documents.push(...STARTER_DOCUMENTS.map(d => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...d })));
}
// header & logo, WhatsApp chat button
for (const [k, v] of Object.entries({
  logoStyle: 'script', logoText: '', logoTm: true,
  waEnabled: true, waLabel: 'Chat with us', waPosition: 'right',
  waMessage: 'Hello! I have a question about Rupali Shine Herbal Oil.',
  waBubble: 'Hi! Have a question about the oil or your order? Chat with us on WhatsApp.'
})) if (db.settings[k] === undefined) db.settings[k] = v;
}
const STORY_TEXT = 'Long before there was a label or a bottle, there was my mother, making this oil with her own hands. Jatamansi, brahmi, amla, bhringraj, hibiscus — every herb in it was her choice.\n\nShe is no longer with us. But her recipe is, and so is the care she put into it. I started Rupali Shine so that her oil would not end with her — so that it could reach more homes than she ever could.\n\nHer picture is on every bottle, because every bottle is still hers.';
// same story with key phrases in **bold** for the home page
const STORY_TEXT_RICH = STORY_TEXT
  .replace('making this oil with her own hands', '**making this oil with her own hands**')
  .replace('so that her oil would not end with her', '**so that her oil would not end with her**')
  .replace('every bottle is still hers', '**every bottle is still hers**');
const WHY_LINES = [
  'Nine herbs in one oil – jatamansi, brahmi, bhringraj, amla, hibiscus, methi, curry leaves and aloe vera',
  'Coconut oil base – the herbs are infused in cold-pressed coconut oil',
  'Her recipe – made the way she made it at home, by hand, in small batches',
  'Simple ritual – massage, leave on for an hour or overnight, then wash',
  'Easy to order – free delivery across India and cash on delivery'
].join('\n');
const STORY_DEFAULTS = {
  storyKicker: 'The heart of Rupali Shine',
  storyTitle: 'This oil was my mother’s first',
  storyText: STORY_TEXT_RICH,
  whyKicker: 'Why Rupali Shine',
  whyTitle: 'Why choose Rupali Shine?',
  whyLines: WHY_LINES,
  storySign: 'Her son, Founder of Rupali Shine',
  storyCaption: 'In loving memory',
  storyImage: '/uploads/rupali-mother-original.webp'
};
function prepareStory() {
for (const k in STORY_DEFAULTS) if (db.settings[k] === undefined) db.settings[k] = STORY_DEFAULTS[k];
// the first starter photo was a cropped copy; switch stores still using it to the original photo
if (db.settings.storyImage === '/uploads/rupali-mother.webp') db.settings.storyImage = '/uploads/rupali-mother-original.webp';
// stores still showing the untouched starter story get the version with bold key phrases
if (db.settings.storyText === STORY_TEXT) db.settings.storyText = STORY_TEXT_RICH;
if (db.settings.storyKicker === 'Our Story') db.settings.storyKicker = STORY_DEFAULTS.storyKicker;
// first run after the story was added: tell it on the About page too (only if that page is still the starter text)
const aboutPage = db.pages.find(p => p.slug === 'about');
if (!db.storyAdded && aboutPage && aboutPage.content.startsWith('Rupali Shine is a handmade herbal hair care brand')) {
  aboutPage.title = 'Our Story';
  aboutPage.content = STORY_TEXT + '\n\nRupali Shine Herbal Oil is 100% natural and 100% handmade in Tilak Nagar, Delhi.';
}
db.storyAdded = true;
for (const [k, v] of Object.entries({ bulkTiers: '', prepaidPercent: 0, trustLines: '100% Natural\n100% Handmade\nMade in India' })) if (db.settings[k] === undefined) db.settings[k] = v;
}

/* ---------------- helpers ---------------- */
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, min = 0, max = 1e7) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const list = (v, maxItems = 40) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map(s => str(s, 300)).filter(Boolean).slice(0, maxItems);
const slugify = s => str(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
function uniqueSlug(base, coll, ignoreId) {
  let slug = slugify(base), i = 2;
  while (coll.some(x => x.slug === slug && x.id !== ignoreId)) slug = `${slugify(base)}-${i++}`;
  return slug;
}
const safeImage = u => { u = str(u, 300); return /^\/uploads\/[\w.-]+$/.test(u) ? u : ''; };
// links the home-page video section can play (same patterns as views.videoBlock)
const VIDEO_LINK = /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)[\w-]{6,}|youtu\.be\/[\w-]{6,}|\S+\.(?:mp4|webm)(?:\?\S*)?$)/i;
const safeUrl = u => { u = str(u, 300); return /^https?:\/\//i.test(u) ? u : ''; };

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function checkPassword(password, admin) {
  const h = crypto.scryptSync(password, admin.salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(admin.hash, 'hex'));
}

/* ---------------- app ---------------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // so https links are built correctly behind a hosting proxy
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
// uploaded images are cached; css/js are re-checked so updates show immediately
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, file) => res.set('Cache-Control', file.includes(path.sep + 'uploads' + path.sep) ? 'public, max-age=604800' : 'no-cache')
}));
// images uploaded from the admin panel are kept in MongoDB
app.get('/uploads/:name', async (req, res, next) => {
  if (!/^[\w.-]+$/.test(req.params.name)) return next();
  try {
    const file = await getUpload(req.params.name);
    if (!file) return res.status(404).type('text').send('Not found');
    res.set('Cache-Control', 'public, max-age=31536000, immutable').type(file.type).send(file.data);
  } catch (e) { res.status(503).type('text').send('Unavailable'); }
});
// PIN code checker used by the checkout page (needs no store data)
app.get('/api/pincode/:pin', async (req, res) => {
  const r = await pincode.lookup(req.params.pin);
  res.set('Cache-Control', r.verified ? 'public, max-age=86400' : 'no-store').json(r);
});
// load the data each request needs (orders and messages only where they are used)
const NEEDS_ORDERS = /^\/(api\/admin|api\/orders|api\/pay|api\/reviews|order|pay)(\/|$)/, NEEDS_MESSAGES = /^\/(api\/admin|api\/contact)(\/|$)/;
app.use(storeMiddleware(firstData, () => { prepare(); prepareStory(); }, p =>
  ALL_LISTS.filter(k => k === 'orders' ? NEEDS_ORDERS.test(p) : k === 'messages' ? NEEDS_MESSAGES.test(p) : true)));

/* ---------------- admin sessions ---------------- */
// The login cookie is "<expiry>.<signature>". It is signed with a secret kept in the database and
// tied to the current password, so it works across serverless instances and stops working when the password changes.
const SESSION_MS = 1000 * 60 * 60 * 12;
const sessionSig = exp => crypto.createHmac('sha256', db.secret).update(exp + '|' + db.admin.hash).digest('hex');
function isAuthed(req) {
  const m = /(?:^|;\s*)rs_admin=(\d{13})\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m || !db.admin || +m[1] < Date.now()) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(sessionSig(m[1])));
}
function startSession(req, res) {
  const exp = String(Date.now() + SESSION_MS);
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.set('Set-Cookie', `rs_admin=${exp}.${sessionSig(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}
const requireAdmin = (req, res, next) => isAuthed(req) ? next() : res.status(401).json({ error: 'Please log in.' });

const attempts = new Map(); // ip -> {count, until}
function throttled(ip) {
  const a = attempts.get(ip);
  return a && a.count >= 8 && a.until > Date.now();
}
function noteFail(ip) {
  const a = attempts.get(ip) || { count: 0, until: 0 };
  if (a.until < Date.now()) a.count = 0;
  a.count++; a.until = Date.now() + 15 * 60 * 1000;
  attempts.set(ip, a);
}

/* ---------------- storefront pages ---------------- */
// a sale with an end time switches itself off: the price goes back to M.R.P.
const effectivePrice = p => (p.saleEnds && Date.now() > Date.parse(p.saleEnds)) ? p.mrp : p.price;
const activeProducts = () => db.products.filter(p => p.active).map(p => {
  const price = effectivePrice(p), onSale = price < p.mrp;
  return { ...p, price, onSale, saleEnds: onSale && p.saleEnds ? p.saleEnds : '', saleLabel: onSale ? p.saleLabel || '' : '' };
});
const send = (res, html, status = 200) => res.status(status).type('html').send(html);

/* ---------------- reviews ---------------- */
// Only reviews the store owner has approved are ever shown. Nothing is shown until real customers write in.
const approvedReviews = productId => db.reviews.filter(r => r.status === 'approved' && (!productId || r.productId === productId))
  .sort((a, b) => (b.featured - a.featured) || String(b.createdAt).localeCompare(String(a.createdAt)));
function ratingSummary(list) {
  const count = list.length;
  const bars = [5, 4, 3, 2, 1].map(star => list.filter(r => r.rating === star).length);
  return { count, avg: count ? Math.round(list.reduce((s, r) => s + r.rating, 0) / count * 10) / 10 : 0, bars };
}
const reviewsFor = p => { const list = approvedReviews(p.id); return { list, summary: ratingSummary(list) }; };
const homeReviews = () => {
  const all = approvedReviews();
  const featured = all.filter(r => r.featured);
  return { list: (featured.length ? featured : all).slice(0, 6), summary: ratingSummary(all) };
};
const orderKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const last10 = v => String(v || '').replace(/\D/g, '').slice(-10);

app.get('/', (req, res) => send(res, views.home(db, activeProducts(), homeReviews())));
app.get('/shop', (req, res) => send(res, views.shop(db, activeProducts(), str(req.query.category, 60))));
app.get('/product/:slug', (req, res) => {
  const p = activeProducts().find(x => x.slug === req.params.slug);
  if (!p) return send(res, views.notFound(db), 404);
  send(res, views.product(db, p, activeProducts().filter(x => x.id !== p.id).slice(0, 4), paymentMethods(), { coupons: visibleCoupons().map(c => ({ ...c, summary: c.label || couponSummary(c) })), tiers: bulkTiers() }, reviewsFor(p)));
});
app.get('/cart', (req, res) => send(res, views.cart(db)));
app.get('/checkout', (req, res) => send(res, views.checkout(db, paymentMethods())));
app.get('/contact', (req, res) => send(res, views.contact(db)));
app.get('/certificates', (req, res) => send(res, views.certificates(db)));
app.get('/order/:key', (req, res) => {
  const o = db.orders.find(x => x.key === req.params.key);
  if (!o) return send(res, views.notFound(db), 404);
  res.set('Cache-Control', 'no-store');
  send(res, views.orderPlaced(db, o));
});
app.get('/page/:slug', (req, res) => {
  const pg = db.pages.find(x => x.slug === req.params.slug);
  if (!pg) return send(res, views.notFound(db), 404);
  send(res, views.page(db, pg));
});
app.get('/admin', (req, res) => send(res, views.adminPage()));

/* ---------------- public API ---------------- */
const publicProduct = p => ({ id: p.id, slug: p.slug, name: p.name, size: p.size, price: p.price, mrp: p.mrp, stock: p.stock, image: p.images[0] || '' });

app.get('/api/products', (req, res) => {
  const ids = str(req.query.ids, 2000).split(',').filter(Boolean);
  const items = activeProducts().filter(p => !ids.length || ids.includes(p.id));
  res.json({ products: items.map(publicProduct), shippingFee: db.settings.shippingFee, freeShippingAbove: db.settings.freeShippingAbove });
});

function shippingFor(subtotal) {
  const s = db.settings;
  if (s.freeShippingAbove > 0 && subtotal >= s.freeShippingAbove) return 0;
  return s.shippingFee || 0;
}

/* ---------------- offers & pricing ---------------- */
// One function prices every cart (cart page, checkout and the final order), so the
// customer always sees exactly what they will be charged.
// "2: 5" on a line means: buy 2 or more, get 5% off
const bulkTiers = () => String(db.settings.bulkTiers || '').split('\n')
  .map(l => /^\s*(\d+)\s*[:=]\s*(\d+(?:\.\d+)?)/.exec(l)).filter(Boolean)
  .map(m => ({ qty: +m[1], percent: Math.min(90, +m[2]) }))
  .filter(t => t.qty > 1 && t.percent > 0).sort((a, b) => a.qty - b.qty);
/* ---------------- coupons ---------------- */
const couponCode = v => str(v, 30).toUpperCase().replace(/[^A-Z0-9]/g, '');
const couponExpired = c => !!c.expires && Date.now() > Date.parse(c.expires);
const couponNotStarted = c => !!c.starts && Date.now() < Date.parse(c.starts);
const couponUsedUp = c => c.maxUses > 0 && c.used >= c.maxUses;
const couponLive = c => c.active && !couponExpired(c) && !couponNotStarted(c) && !couponUsedUp(c);
const visibleCoupons = () => db.coupons.filter(c => c.showOnSite && couponLive(c));
const shortDate = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
// the one line a shopper reads, e.g. "10% off (up to ₹100) on orders above ₹499"
function couponSummary(c) {
  const what = c.type === 'shipping' ? 'Free delivery' : c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` (up to ₹${c.maxDiscount})` : ''}` : `₹${c.value} off`;
  const only = c.products && c.products.length ? ` on ${c.products.map(id => (db.products.find(p => p.id === id) || {}).name).filter(Boolean).join(', ')}` : '';
  return what + only + (c.minOrder ? ` on orders above ₹${c.minOrder}` : '') + (c.firstOrder ? ' · first order only' : '');
}
// why a coupon can't be used for this cart ('' = it can)
function couponProblem(c, amount, eligible) {
  if (!c || !c.active) return 'This coupon code is not valid.';
  if (couponNotStarted(c)) return `This coupon starts on ${shortDate(c.starts)}.`;
  if (couponExpired(c)) return 'This coupon has expired.';
  if (couponUsedUp(c)) return 'This coupon is no longer available.';
  if (eligible <= 0) return 'This coupon does not apply to the items in your cart.';
  if (amount < c.minOrder) return `Add items worth ₹${Math.ceil(c.minOrder - amount)} more to use this coupon (minimum order ₹${c.minOrder}).`;
  return '';
}
// checks that need the shopper's mobile number, so they run when the order is placed
function couponCustomerProblem(c, phone) {
  if (!c || (!c.perCustomer && !c.firstOrder)) return '';
  const mine = db.orders.filter(o => last10(o.customer && o.customer.phone) === last10(phone) && !['cancelled', 'pending'].includes(o.status));
  if (c.firstOrder && mine.length) return `Coupon ${c.code} is for first orders only.`;
  if (c.perCustomer && mine.filter(o => o.coupon === c.code).length >= c.perCustomer)
    return c.perCustomer === 1 ? `You have already used coupon ${c.code}.` : `Coupon ${c.code} can be used ${c.perCustomer} times per customer.`;
  return '';
}
// a coupon counts as used once its order is real: Cash on Delivery placed, or online payment received
function countCouponUse(order) {
  if (!order.coupon || order.couponCounted) return;
  const c = db.coupons.find(x => x.code === order.coupon);
  order.couponCounted = true;
  if (c) { c.used = (c.used || 0) + 1; counterMoved('coupons', c.id, 'used', 1); }
}

function priceCart(lines, { code, method } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const mrpTotal = lines.reduce((s, l) => s + Math.max(l.p.mrp, l.p.price) * l.qty, 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const tiers = bulkTiers();
  const tier = tiers.filter(t => units >= t.qty).pop();
  code = couponCode(code);
  const c = code ? db.coupons.find(x => x.code === code) : null;
  const pp = db.settings.prepaidPercent || 0;

  // works out the bill with or without the buy-more offer / the coupon
  function run(useTier, useCoupon) {
    const discounts = [];
    let amount = subtotal, coupon = null, couponError = '', freeShip = false;
    const take = (label, value) => { const d = Math.min(amount, Math.round(value)); if (d > 0) { discounts.push({ label, amount: d }); amount -= d; } };
    if (useTier && tier) take(`Buy ${tier.qty}+ offer (${tier.percent}% off)`, amount * tier.percent / 100);
    if (useCoupon && code) {
      // only the chosen products count towards the coupon (all products when none are chosen)
      const base = c && c.products && c.products.length ? lines.filter(l => c.products.includes(l.p.id)).reduce((s, l) => s + l.p.price * l.qty, 0) : subtotal;
      const eligible = subtotal ? base * amount / subtotal : 0; // after the buy-more discount
      couponError = couponProblem(c, amount, eligible);
      if (!couponError) {
        coupon = c;
        if (c.type === 'shipping') freeShip = true;
        else {
          let off = c.type === 'percent' ? eligible * c.value / 100 : Math.min(c.value, eligible);
          if (c.type === 'percent' && c.maxDiscount > 0) off = Math.min(off, c.maxDiscount);
          take(`Coupon ${c.code}`, off);
        }
      }
    }
    if (pp > 0 && method && method !== 'cod') take(`Online payment offer (${pp}% off)`, amount * pp / 100);
    const normalShipping = lines.length ? shippingFor(amount) : 0;
    if (freeShip && normalShipping) discounts.push({ label: `Coupon ${c.code} (free delivery)`, amount: normalShipping, shipping: true });
    const shipping = freeShip ? 0 : normalShipping;
    return { discounts, amount, shipping, total: amount + shipping, coupon, couponError };
  }

  let r = run(true, true), note = '';
  // a coupon that can't be combined: the shopper automatically gets whichever deal is better
  if (c && r.coupon && c.combine === false && tier) {
    const tierOnly = run(true, false), couponOnly = run(false, true);
    if (tierOnly.total <= couponOnly.total) {
      r = { ...tierOnly, couponError: `Your Buy ${tier.qty}+ offer saves more than coupon ${c.code}, so we kept the better deal (they can't be combined).` };
    } else { r = couponOnly; note = `Coupon ${c.code} can't be combined with the Buy-more offer, so only the coupon is applied.`; }
  }
  const next = tiers.find(t => t.qty > units);
  return {
    subtotal, discounts: r.discounts, shipping: r.shipping, total: r.total, coupon: r.coupon, couponError: r.couponError, couponNote: note,
    saved: (mrpTotal - subtotal) + r.discounts.reduce((s, d) => s + d.amount, 0),
    nextTier: next && units ? { need: next.qty - units, percent: next.percent } : null,
    freeShippingGap: db.settings.freeShippingAbove > 0 && r.shipping > 0 ? db.settings.freeShippingAbove - r.amount : 0
  };
}

// live price for whatever is in the browser's cart
app.post('/api/cart/quote', (req, res) => {
  const b = req.body || {};
  const lines = [];
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
    const p = activeProducts().find(x => x.id === it.id);
    const qty = Math.min(Math.floor(num(it.qty, 0, 99)), p ? p.stock : 0);
    if (p && qty > 0) lines.push({ p, qty });
  }
  const q = priceCart(lines, { code: b.code, method: str(b.method, 20) });
  res.json({
    lines: lines.map(l => ({ ...publicProduct(l.p), qty: l.qty })),
    subtotal: q.subtotal, discounts: q.discounts, shipping: q.shipping, total: q.total, saved: q.saved,
    coupon: q.coupon ? q.coupon.code : '', couponError: q.couponError, couponNote: q.couponNote,
    couponSummary: q.coupon ? (q.coupon.label || couponSummary(q.coupon)) : '',
    offers: visibleCoupons().map(c => ({ code: c.code, summary: c.label || couponSummary(c) })),
    nextTier: q.nextTier, freeShippingGap: q.freeShippingGap, prepaidPercent: db.settings.prepaidPercent || 0
  });
});


/* ---------------- payments ---------------- */
// Gateways are configured from Admin → Payments. Keys live in data/db.json (server side only).
const pay = () => db.settings.payments;
const gatewayReady = {
  razorpay: () => !!(pay().razorpay.enabled && pay().razorpay.keyId && pay().razorpay.keySecret),
  stripe: () => !!(pay().stripe.enabled && pay().stripe.secretKey),
  cashfree: () => !!(pay().cashfree.enabled && pay().cashfree.appId && pay().cashfree.secretKey)
};
function paymentMethods() {
  const m = [];
  if (gatewayReady.razorpay()) m.push({ id: 'razorpay', label: 'Pay Online', hint: 'UPI, cards, netbanking & wallets — secured by Razorpay' });
  if (gatewayReady.cashfree()) m.push({ id: 'cashfree', label: gatewayReady.razorpay() ? 'Pay Online (Cashfree)' : 'Pay Online', hint: 'UPI, cards, netbanking & wallets — secured by Cashfree' });
  if (gatewayReady.stripe()) m.push({ id: 'stripe', label: 'Pay by Card', hint: 'Credit / debit card — secured by Stripe' });
  if (db.settings.codEnabled) m.push({ id: 'cod', label: 'Cash on Delivery', hint: 'Pay when your order arrives.' });
  return m;
}
const PAY_LABEL = { cod: 'Cash on Delivery', razorpay: 'Online (Razorpay)', stripe: 'Card (Stripe)', cashfree: 'Online (Cashfree)' };

async function gw(url, { method = 'GET', headers = {}, body } = {}) {
  const r = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20000) });
  let data = {};
  try { data = JSON.parse(await r.text()); } catch (e) { /* non-JSON reply */ }
  return { ok: r.ok, status: r.status, data };
}
const basic = (user, pass) => 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
const rzpHeaders = () => ({ Authorization: basic(pay().razorpay.keyId, pay().razorpay.keySecret), 'Content-Type': 'application/json' });
const stripeHeaders = () => ({ Authorization: 'Bearer ' + pay().stripe.secretKey, 'Content-Type': 'application/x-www-form-urlencoded' });
const cfBase = () => pay().cashfree.mode === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const cfHeaders = () => ({ 'x-client-id': pay().cashfree.appId, 'x-client-secret': pay().cashfree.secretKey, 'x-api-version': '2023-08-01', 'Content-Type': 'application/json' });
const gwError = (name, r) => new Error(`${name}: ${r.data?.error?.description || r.data?.error?.message || r.data?.message || 'request failed (' + r.status + ')'}`);
const baseUrl = req => `${req.protocol}://${req.get('host')}`;

// start a payment at the gateway; returns what the browser needs to continue
async function startPayment(order, req) {
  const paise = Math.round(order.total * 100);
  const c = order.customer;
  if (order.gateway === 'razorpay') {
    const r = await gw('https://api.razorpay.com/v1/orders', { method: 'POST', headers: rzpHeaders(), body: JSON.stringify({ amount: paise, currency: 'INR', receipt: order.number, notes: { order: order.number } }) });
    if (!r.ok || !r.data.id) throw gwError('Razorpay', r);
    order.gatewayRef = r.data.id;
    return { gateway: 'razorpay', keyId: pay().razorpay.keyId, rzpOrderId: r.data.id, amount: paise, name: db.settings.siteName, description: 'Order ' + order.number, prefill: { name: c.name, contact: c.phone, email: c.email }, orderKey: order.key };
  }
  if (order.gateway === 'stripe') {
    const f = new URLSearchParams({
      mode: 'payment', client_reference_id: order.id,
      success_url: `${baseUrl(req)}/pay/stripe/return?key=${order.key}`,
      cancel_url: `${baseUrl(req)}/order/${order.key}`,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][unit_amount]': String(paise),
      'line_items[0][price_data][product_data][name]': `${db.settings.siteName} order ${order.number}`
    });
    if (c.email) f.set('customer_email', c.email);
    const r = await gw('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: stripeHeaders(), body: f.toString() });
    if (!r.ok || !r.data.url) throw gwError('Stripe', r);
    order.gatewayRef = r.data.id;
    return { gateway: 'stripe', redirect: r.data.url };
  }
  if (order.gateway === 'cashfree') {
    const ref = `${order.number}-${order.key.slice(0, 8)}`;
    const phone = c.phone.replace(/\D/g, '').slice(-10);
    const details = { customer_id: 'cust_' + phone, customer_name: c.name, customer_phone: phone };
    if (c.email) details.customer_email = c.email;
    const r = await gw(cfBase() + '/orders', { method: 'POST', headers: cfHeaders(), body: JSON.stringify({ order_id: ref, order_amount: order.total, order_currency: 'INR', customer_details: details, order_meta: { return_url: `${baseUrl(req)}/pay/cashfree/return?key=${order.key}` } }) });
    if (!r.ok || !r.data.payment_session_id) throw gwError('Cashfree', r);
    order.gatewayRef = ref;
    return { gateway: 'cashfree', sessionId: r.data.payment_session_id, mode: pay().cashfree.mode === 'live' ? 'production' : 'sandbox' };
  }
  throw new Error('Unknown payment method.');
}

// ask the gateway whether this order has been paid
async function isPaidAtGateway(order) {
  if (!order.gatewayRef) return false;
  if (order.gateway === 'razorpay') {
    const r = await gw(`https://api.razorpay.com/v1/orders/${encodeURIComponent(order.gatewayRef)}/payments`, { headers: rzpHeaders() });
    return r.ok && (r.data.items || []).some(p => p.status === 'captured' || p.status === 'authorized');
  }
  if (order.gateway === 'stripe') {
    const r = await gw(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.gatewayRef)}`, { headers: stripeHeaders() });
    return r.ok && r.data.payment_status === 'paid' && r.data.client_reference_id === order.id;
  }
  if (order.gateway === 'cashfree') {
    const r = await gw(`${cfBase()}/orders/${encodeURIComponent(order.gatewayRef)}`, { headers: cfHeaders() });
    return r.ok && r.data.order_status === 'PAID';
  }
  return false;
}

function takeStock(o) {
  if (o.stockTaken) return;
  o.items.forEach(it => { const p = db.products.find(x => x.id === it.id); if (p) { p.stock -= it.qty; stockMoved(p.id, -it.qty); } });
  o.stockTaken = true;
}
function returnStock(o) {
  if (!o.stockTaken) return;
  o.items.forEach(it => { const p = db.products.find(x => x.id === it.id); if (p) { p.stock += it.qty; stockMoved(p.id, it.qty); } });
  o.stockTaken = false;
}
function markPaid(o) {
  if (o.paymentStatus === 'paid') return;
  o.paymentStatus = 'paid';
  o.paidAt = new Date().toISOString();
  if (o.status === 'pending') o.status = 'new';
  takeStock(o);
  countCouponUse(o);
  save();
}
async function confirmPayment(o) {
  if (o.paymentStatus !== 'paid' && await isPaidAtGateway(o)) markPaid(o);
  return o.paymentStatus === 'paid';
}

app.post('/api/orders', async (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const mobile = v => str(v, 20).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''); // drop +91 / leading 0
  const customer = {
    name: str(c.name, 80), phone: mobile(c.phone), altPhone: mobile(c.altPhone), email: str(c.email, 120),
    line1: str(c.line1, 120), line2: str(c.line2, 120), landmark: str(c.landmark, 80),
    city: str(c.city, 60), state: str(c.state, 60), pincode: str(c.pincode, 6), country: 'India',
    addressType: ['Home', 'Work', 'Other'].includes(c.addressType) ? c.addressType : 'Home', note: str(c.note, 300)
  };
  // one-line address, used wherever the order is shown
  customer.address = [customer.line1, customer.line2, customer.landmark && 'Near ' + customer.landmark.replace(/^near\s+/i, '')].filter(Boolean).join(', ');
  const bad = (msg, field) => res.status(400).json({ error: msg, field });
  if (str(c.country, 40) && str(c.country, 40) !== 'India') return bad('Sorry, we deliver only within India right now.', 'country');
  if (customer.name.replace(/[^\p{L}]/gu, '').length < 3) return bad('Please enter your full name.', 'name');
  if (!/^[6-9]\d{9}$/.test(customer.phone)) return bad('Please enter a valid 10-digit mobile number.', 'phone');
  if (customer.altPhone && !/^[6-9]\d{9}$/.test(customer.altPhone)) return bad('The alternate mobile number is not valid.', 'altPhone');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email)) return bad('Please enter a valid email.', 'email');
  if (customer.line1.length < 3) return bad('Please enter your house / flat number and building.', 'line1');
  if (customer.line2.length < 3) return bad('Please enter your area, street or village.', 'line2');
  if (customer.city.length < 2) return bad('Please enter your town or city.', 'city');
  if (!pincode.STATES.includes(customer.state)) return bad('Please select your state.', 'state');
  const pin = await pincode.lookup(customer.pincode, 3500);
  if (!pin.valid) return bad(pin.error, 'pincode');
  if (!pin.states.includes(customer.state)) return bad(`PIN code ${customer.pincode} is not in ${customer.state}. Please check the PIN code and state.`, 'pincode');
  customer.pinVerified = !!pin.verified;

  const methods = paymentMethods();
  if (!methods.length) return res.status(400).json({ error: 'Online ordering is paused right now. Please contact us.' });
  const method = methods.find(m => m.id === b.method);
  if (!method) return res.status(400).json({ error: 'Please choose a payment method.' });

  const lines = [];
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
    const p = activeProducts().find(x => x.id === it.id);
    const qty = Math.floor(num(it.qty, 0, 99));
    if (!p || qty < 1) continue;
    if (p.stock < qty) return res.status(400).json({ error: `Only ${p.stock} left of ${p.name}.` });
    lines.push({ p, qty });
  }
  if (!lines.length) return res.status(400).json({ error: 'Your cart is empty.' });

  const q = priceCart(lines, { code: b.code, method: method.id });
  if (b.code && q.couponError && !q.coupon && !/kept the better deal/.test(q.couponError)) return res.status(400).json({ error: q.couponError, field: 'coupon' });
  const customerProblem = couponCustomerProblem(q.coupon, customer.phone);
  if (customerProblem) return res.status(400).json({ error: customerProblem + ' Please remove it to continue.', field: 'coupon' });
  const { subtotal, shipping } = q;
  const online = method.id !== 'cod';
  const order = {
    id: crypto.randomUUID(),
    key: crypto.randomBytes(16).toString('hex'),
    number: 'RS-' + await nextOrderNumber(),
    createdAt: new Date().toISOString(),
    status: online ? 'pending' : 'new',
    gateway: method.id,
    payment: PAY_LABEL[method.id],
    paymentStatus: online ? 'pending' : 'cod',
    customer,
    items: lines.map(l => ({ id: l.p.id, name: l.p.name, size: l.p.size, price: l.p.price, qty: l.qty, image: l.p.images[0] || '' })),
    subtotal, discounts: q.discounts, coupon: q.coupon ? q.coupon.code : '', shipping, total: q.total
  };
  if (!online) {
    takeStock(order);
    countCouponUse(order);
    db.orders.unshift(order);
    save();
    return res.json({ ok: true, url: '/order/' + order.key, number: order.number });
  }
  try {
    const next = await startPayment(order, req);
    db.orders.unshift(order);
    save();
    res.json({ ok: true, number: order.number, orderUrl: '/order/' + order.key, ...next });
  } catch (e) {
    console.error('Payment start failed:', e.message);
    res.status(502).json({ error: 'Could not start the online payment. Please try again or choose another payment method.' });
  }
});

// Razorpay: the checkout popup returns a signed payment, verified here
app.post('/api/pay/razorpay/verify', (req, res) => {
  const b = req.body || {};
  const o = db.orders.find(x => x.key === str(b.key, 64) && x.gateway === 'razorpay');
  const oid = str(b.razorpay_order_id, 80), pid = str(b.razorpay_payment_id, 80), sig = str(b.razorpay_signature, 200);
  if (!o || !oid || o.gatewayRef !== oid) return res.status(400).json({ error: 'Order not found.' });
  const expected = crypto.createHmac('sha256', pay().razorpay.keySecret).update(oid + '|' + pid).digest('hex');
  const good = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!good) return res.status(400).json({ error: 'Payment could not be verified. If money was deducted, please contact us.' });
  o.gatewayPaymentId = pid;
  markPaid(o);
  res.json({ ok: true, url: '/order/' + o.key });
});

// Stripe and Cashfree send the customer back here after payment
app.get('/pay/:gateway/return', async (req, res) => {
  const o = db.orders.find(x => x.key === str(req.query.key, 64) && x.gateway === req.params.gateway);
  if (!o) return send(res, views.notFound(db), 404);
  try { await confirmPayment(o); } catch (e) { console.error('Payment check failed:', e.message); }
  res.redirect('/order/' + o.key);
});

let contactCount = { t: 0, n: 0 };
app.post('/api/contact', (req, res) => {
  const b = req.body || {};
  const m = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: str(b.name, 80), phone: str(b.phone, 15), email: str(b.email, 120), message: str(b.message, 2000) };
  if (!m.name || !m.message || (!m.phone && !m.email)) return res.status(400).json({ error: 'Please fill your name, a phone or email, and a message.' });
  if (Date.now() - contactCount.t > 3600e3) contactCount = { t: Date.now(), n: 0 };
  if (++contactCount.n > 60) return res.status(429).json({ error: 'Too many messages right now. Please try later.' });
  db.messages.unshift(m);
  db.messages = db.messages.slice(0, 500);
  save();
  res.json({ ok: true });
});

// a customer writes a review; it waits for the owner's approval before it is shown
let reviewCount = { t: 0, n: 0 };
app.post('/api/reviews', (req, res) => {
  const b = req.body || {};
  if (str(b.website)) return res.json({ ok: true }); // hidden field only bots fill in
  const p = activeProducts().find(x => x.id === b.productId);
  if (!p) return res.status(400).json({ error: 'Please choose a product.' });
  const rating = Math.round(Number(b.rating));
  const r = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), productId: p.id, productName: p.name,
    name: str(b.name, 60), city: str(b.city, 60), rating, title: str(b.title, 100), text: str(b.text, 1500),
    photo: '', reply: '', status: 'pending', featured: false, verified: false, source: 'website',
    orderNumber: str(b.orderNumber, 20), phone: last10(b.phone)
  };
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Please choose a star rating.', field: 'rating' });
  if (r.name.length < 2) return res.status(400).json({ error: 'Please enter your name.', field: 'name' });
  if (r.text.length < 10) return res.status(400).json({ error: 'Please write a few words about your experience (at least 10 letters).', field: 'text' });
  if (Date.now() - reviewCount.t > 3600e3) reviewCount = { t: Date.now(), n: 0 };
  if (++reviewCount.n > 40) return res.status(429).json({ error: 'Too many reviews right now. Please try later.' });
  // "Verified buyer" when the order number and mobile number match a real order for this product
  if (r.orderNumber && r.phone.length === 10) {
    r.verified = db.orders.some(o => orderKey(o.number) === orderKey(r.orderNumber) && last10(o.customer.phone) === r.phone &&
      !['cancelled', 'pending'].includes(o.status) && o.items.some(i => i.id === p.id));
  }
  db.reviews.unshift(r);
  db.reviews = db.reviews.slice(0, 2000);
  res.json({ ok: true, verified: r.verified });
});

/* ---------------- admin API ---------------- */
app.get('/api/admin/me', (req, res) => res.json({ needsSetup: !db.admin, loggedIn: isAuthed(req), username: db.admin?.username }));

app.post('/api/admin/setup', (req, res) => {
  if (db.admin) return res.status(403).json({ error: 'Admin account already exists.' });
  const username = str(req.body?.username, 40), password = String(req.body?.password ?? '');
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  db.admin = { username, ...hashPassword(password) };
  save();
  startSession(req, res);
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (throttled(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const username = str(req.body?.username, 40), password = String(req.body?.password ?? '');
  if (!db.admin || username !== db.admin.username || !checkPassword(password, db.admin)) {
    noteFail(req.ip);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  attempts.delete(req.ip);
  startSession(req, res);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.set('Set-Cookie', 'rs_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin);

app.post('/api/admin/password', (req, res) => {
  const current = String(req.body?.current ?? ''), next = String(req.body?.next ?? '');
  if (!checkPassword(current, db.admin)) return res.status(400).json({ error: 'Current password is wrong.' });
  if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  Object.assign(db.admin, hashPassword(next));
  save();
  res.json({ ok: true });
});

app.get('/api/admin/stats', (req, res) => {
  const live = db.orders.filter(o => o.status !== 'cancelled' && o.status !== 'pending');
  res.json({
    products: db.products.length,
    orders: live.length,
    newOrders: db.orders.filter(o => o.status === 'new').length,
    revenue: live.reduce((s, o) => s + o.total, 0),
    messages: db.messages.length,
    pendingReviews: db.reviews.filter(r => r.status === 'pending').length,
    lowStock: db.products.filter(p => p.active && p.stock <= 5).map(p => ({ name: p.name, stock: p.stock })),
    recent: db.orders.slice(0, 5)
  });
});

// uploads
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
// Vercel accepts request bodies up to about 4.5 MB, so images are uploaded one per request, 4 MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'))
});
app.post('/api/admin/upload', (req, res) => {
  upload.array('images', 10)(req, res, async err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 4 MB.' : err.message });
    try {
      const urls = [];
      for (const f of req.files || []) {
        const name = Date.now().toString(36) + '-' + crypto.randomBytes(5).toString('hex') + EXT[f.mimetype];
        await saveUpload(name, f.mimetype, f.buffer);
        urls.push('/uploads/' + name);
      }
      res.json({ urls });
    } catch (e) { console.error('Upload failed:', e.message); res.status(500).json({ error: 'Could not save the image. Please try again.' }); }
  });
});

// products
function productFrom(b, existing) {
  const name = str(b.name, 120);
  if (!name) throw new Error('Product name is required.');
  const price = num(b.price);
  const p = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  Object.assign(p, {
    name,
    slug: uniqueSlug(str(b.slug, 80) || name, db.products, p.id),
    category: str(b.category, 60),
    size: str(b.size, 40),
    price,
    mrp: Math.max(price, num(b.mrp)),
    stock: Math.floor(num(b.stock, 0, 1e6)),
    featured: !!b.featured,
    active: b.active !== false,
    shortDesc: str(b.shortDesc, 300),
    description: str(b.description, 5000),
    caution: str(b.caution, 1500),
    saleLabel: str(b.saleLabel, 40),
    saleEnds: isoOrBlank(b.saleEnds),
    images: (Array.isArray(b.images) ? b.images : []).map(safeImage).filter(Boolean).slice(0, 10),
    ingredients: (Array.isArray(b.ingredients) ? b.ingredients : []).map(i => ({ name: str(i?.name, 80), image: safeImage(i?.image) })).filter(i => i.name).slice(0, 40),
    benefits: list(b.benefits),
    howToUse: list(b.howToUse, 8)
  });
  return p;
}
app.get('/api/admin/products', (req, res) => res.json(db.products));
app.post('/api/admin/products', (req, res) => {
  try { const p = productFrom(req.body || {}); db.products.push(p); save(); res.json(p); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/products/:id', (req, res) => {
  const p = db.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  try { productFrom(req.body || {}, p); save(); res.json(p); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/products/:id', (req, res) => {
  db.products = db.products.filter(x => x.id !== req.params.id);
  save(); res.json({ ok: true });
});

// offers: coupons + automatic discounts
const isoOrBlank = v => { const t = Date.parse(str(v, 40)); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };
// the rules of a coupon (everything except its code), checked before anything is saved
function couponRules(b) {
  const type = ['flat', 'shipping'].includes(b.type) ? b.type : 'percent';
  const value = type === 'shipping' ? 0 : num(b.value, 0, type === 'percent' ? 90 : 100000);
  if (type !== 'shipping' && !value) throw new Error('Enter how much discount the coupon gives.');
  const starts = isoOrBlank(b.starts), expires = isoOrBlank(b.expires);
  if (starts && expires && Date.parse(expires) <= Date.parse(starts)) throw new Error('The end date must be after the start date.');
  const products = (Array.isArray(b.products) ? b.products : []).filter(id => db.products.some(p => p.id === id));
  return {
    type, value, products, starts, expires,
    label: str(b.label, 80),
    maxDiscount: type === 'percent' ? num(b.maxDiscount, 0, 100000) : 0,
    minOrder: num(b.minOrder, 0, 1e6),
    maxUses: Math.floor(num(b.maxUses, 0, 1e6)),
    perCustomer: Math.floor(num(b.perCustomer, 0, 100)),
    firstOrder: !!b.firstOrder,
    combine: b.combine !== false,
    active: b.active !== false,
    showOnSite: !!b.showOnSite
  };
}
function couponFrom(b, existing) {
  const code = couponCode(b.code);
  if (code.length < 3) throw new Error('Coupon code needs at least 3 letters or numbers.');
  if (db.coupons.some(c => c.code === code && c !== existing)) throw new Error('That coupon code already exists.');
  const rules = couponRules(b);
  const c = existing || { id: crypto.randomUUID(), used: 0, createdAt: new Date().toISOString() };
  return Object.assign(c, rules, { code });
}
// random codes that are easy to read out over the phone: no 0/O, 1/I/L
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = (prefix, len) => couponCode(prefix) + Array.from(crypto.randomBytes(len), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
function uniqueCode(prefix, len) {
  for (let i = 0; i < 50; i++) { const c = randomCode(prefix, len); if (!db.coupons.some(x => x.code === c)) return c; }
  throw new Error('Could not make a unique code — try a longer code length.');
}
// how each coupon has performed (paid / Cash on Delivery orders only)
function couponStats() {
  const stats = {};
  for (const o of db.orders) {
    if (!o.coupon || ['cancelled', 'pending'].includes(o.status)) continue;
    const s = stats[o.coupon] || (stats[o.coupon] = { orders: 0, revenue: 0, discount: 0 });
    s.orders++; s.revenue += o.total;
    s.discount += (o.discounts || []).filter(d => d.label.startsWith('Coupon ')).reduce((t, d) => t + d.amount, 0);
  }
  return stats;
}
const offersView = () => ({
  coupons: db.coupons, stats: couponStats(), products: db.products.map(p => ({ id: p.id, name: p.name, price: p.price })),
  bulkTiers: db.settings.bulkTiers, prepaidPercent: db.settings.prepaidPercent, trustLines: db.settings.trustLines
});
app.get('/api/admin/offers', (req, res) => res.json(offersView()));
app.put('/api/admin/offers', (req, res) => {
  const b = req.body || {};
  if ('bulkTiers' in b) db.settings.bulkTiers = list(b.bulkTiers, 5).join('\n');
  if ('prepaidPercent' in b) db.settings.prepaidPercent = num(b.prepaidPercent, 0, 50);
  if ('trustLines' in b) db.settings.trustLines = list(b.trustLines, 4).map(l => l.slice(0, 40)).join('\n');
  save(); res.json(offersView());
});
app.post('/api/admin/coupons', (req, res) => {
  try { db.coupons.push(couponFrom(req.body || {})); save(); res.json(offersView()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
// generator: one new random code, or a batch of single-use codes (e.g. for influencers or WhatsApp customers)
app.post('/api/admin/coupons/generate', (req, res) => {
  const b = req.body || {};
  const count = Math.floor(num(b.count, 1, 500)), len = Math.floor(num(b.length, 4, 12)), prefix = couponCode(b.prefix).slice(0, 12);
  if (!b.create) { try { return res.json({ code: uniqueCode(prefix, len) }); } catch (e) { return res.status(400).json({ error: e.message }); } }
  let rules;
  try { rules = couponRules(b); } catch (e) { return res.status(400).json({ error: e.message }); }
  const batch = crypto.randomBytes(6).toString('hex'), batchName = str(b.batchName, 60) || `${prefix || 'Batch'} × ${count}`;
  const codes = [];
  try {
    for (let i = 0; i < count; i++) {
      const code = uniqueCode(prefix, len);
      // every code in a batch works once, so a shared or leaked code can't be reused
      db.coupons.push({ id: crypto.randomUUID(), used: 0, createdAt: new Date().toISOString(), ...rules, maxUses: 1, perCustomer: 0, showOnSite: false, code, batch, batchName });
      codes.push(code);
    }
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json({ ...offersView(), codes, batch });
});
// validator: try a code against a sample cart, exactly as a shopper would at checkout
app.post('/api/admin/coupons/check', (req, res) => {
  const b = req.body || {};
  const code = couponCode(b.code);
  if (!code) return res.status(400).json({ error: 'Enter a coupon code to check.' });
  const p = db.products.find(x => x.id === b.productId) || db.products[0];
  if (!p) return res.status(400).json({ error: 'Add a product first.' });
  const qty = Math.floor(num(b.qty, 1, 99));
  const q = priceCart([{ p, qty }], { code, method: str(b.method, 20) });
  const c = db.coupons.find(x => x.code === code);
  const customer = b.phone ? couponCustomerProblem(q.coupon, b.phone) : '';
  res.json({
    code, exists: !!c, valid: !!q.coupon && !customer, error: customer || q.couponError || '', note: q.couponNote || '',
    summary: c ? (c.label || couponSummary(c)) : '', used: c ? c.used : 0, maxUses: c ? c.maxUses : 0,
    cart: `${qty} × ${p.name} (${'₹' + p.price} each)`, subtotal: q.subtotal, discounts: q.discounts, shipping: q.shipping, total: q.total
  });
});
app.put('/api/admin/coupons/:id', (req, res) => {
  const c = db.coupons.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  // quick on/off switch from the list
  if (Object.keys(req.body || {}).join() === 'active') { c.active = !!req.body.active; save(); return res.json(offersView()); }
  try { couponFrom(req.body || {}, c); save(); res.json(offersView()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/coupons/batch/:batch', (req, res) => {
  db.coupons = db.coupons.filter(x => x.batch !== req.params.batch);
  save(); res.json(offersView());
});
app.delete('/api/admin/coupons/:id', (req, res) => {
  db.coupons = db.coupons.filter(x => x.id !== req.params.id);
  save(); res.json(offersView());
});

// orders
const STATUSES = ['pending', 'new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
app.get('/api/admin/orders', (req, res) => res.json(db.orders));
app.put('/api/admin/orders/:id', (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const status = str(req.body?.status, 20);
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  // stock goes back on cancel; it is taken (again) when an order becomes active
  if (status === 'cancelled') returnStock(o);
  else if (status !== 'pending') { takeStock(o); countCouponUse(o); }
  o.status = status;
  if ('adminNote' in (req.body || {})) o.adminNote = str(req.body.adminNote, 500);
  save(); res.json(o);
});
app.delete('/api/admin/orders/:id', (req, res) => {
  db.orders = db.orders.filter(x => x.id !== req.params.id);
  save(); res.json({ ok: true });
});

// pages
function pageFrom(b, existing) {
  const title = str(b.title, 120);
  if (!title) throw new Error('Page title is required.');
  const pg = existing || { id: crypto.randomUUID() };
  Object.assign(pg, {
    title, slug: uniqueSlug(str(b.slug, 80) || title, db.pages, pg.id),
    content: str(b.content, 20000), showInMenu: !!b.showInMenu, showInFooter: !!b.showInFooter
  });
  return pg;
}
app.get('/api/admin/pages', (req, res) => res.json(db.pages));
app.post('/api/admin/pages', (req, res) => {
  try { const pg = pageFrom(req.body || {}); db.pages.push(pg); save(); res.json(pg); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/pages/:id', (req, res) => {
  const pg = db.pages.find(x => x.id === req.params.id);
  if (!pg) return res.status(404).json({ error: 'Page not found.' });
  try { pageFrom(req.body || {}, pg); save(); res.json(pg); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/pages/:id', (req, res) => {
  db.pages = db.pages.filter(x => x.id !== req.params.id);
  save(); res.json({ ok: true });
});

// messages
// reviews: approve / hide / feature / reply, or add one a customer sent on WhatsApp, email etc.
const REVIEW_STATUS = ['pending', 'approved', 'hidden'];
function readReview(b, existing) {
  const r = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: 'admin', orderNumber: '', phone: '' };
  const p = db.products.find(x => x.id === b.productId) || db.products.find(x => x.id === r.productId);
  const rating = Math.round(Number(b.rating));
  if (!p) return 'Please choose a product.';
  if (!(rating >= 1 && rating <= 5)) return 'Rating must be 1 to 5 stars.';
  if (str(b.name, 60).length < 2) return 'Please enter the customer’s name.';
  if (str(b.text, 1500).length < 3) return 'Please enter the review text.';
  Object.assign(r, {
    productId: p.id, productName: p.name, rating,
    name: str(b.name, 60), city: str(b.city, 60), title: str(b.title, 100), text: str(b.text, 1500),
    reply: str(b.reply, 1000), photo: safeImage(b.photo),
    status: REVIEW_STATUS.includes(b.status) ? b.status : 'approved',
    featured: !!b.featured, verified: !!b.verified
  });
  if (b.source && !existing) r.source = ['admin', 'whatsapp', 'email', 'instagram', 'phone'].includes(b.source) ? b.source : 'admin';
  if (b.createdAt && !Number.isNaN(Date.parse(b.createdAt))) r.createdAt = new Date(b.createdAt).toISOString();
  return r;
}
app.get('/api/admin/reviews', (req, res) => res.json({ reviews: db.reviews, products: db.products.map(p => ({ id: p.id, name: p.name })) }));
app.post('/api/admin/reviews', (req, res) => {
  const r = readReview(req.body || {});
  if (typeof r === 'string') return res.status(400).json({ error: r });
  db.reviews.unshift(r);
  res.json(r);
});
app.put('/api/admin/reviews/:id', (req, res) => {
  const existing = db.reviews.find(x => x.id === req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found.' });
  // quick actions from the list send only { status } or { featured }
  const b = req.body || {};
  if (Object.keys(b).every(k => k === 'status' || k === 'featured')) {
    if (REVIEW_STATUS.includes(b.status)) existing.status = b.status;
    if ('featured' in b) existing.featured = !!b.featured;
    return res.json(existing);
  }
  const r = readReview(b, existing);
  if (typeof r === 'string') return res.status(400).json({ error: r });
  res.json(r);
});
app.delete('/api/admin/reviews/:id', (req, res) => {
  db.reviews = db.reviews.filter(x => x.id !== req.params.id);
  res.json({ ok: true });
});

// certificates & registrations shown on /certificates
const isoDay = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) && !Number.isNaN(Date.parse(v)) ? str(v, 10) : '';
function documentFrom(b, existing) {
  const title = str(b.title, 100);
  if (title.length < 3) throw new Error('Please enter the certificate name.');
  const image = safeImage(b.image);
  if (!image) throw new Error('Please upload a photo or scan of the certificate.');
  const verifyUrl = str(b.verifyUrl) ? safeUrl(b.verifyUrl) : '';
  if (str(b.verifyUrl) && !verifyUrl) throw new Error('The verify link must start with https://');
  const issued = isoDay(b.issued), validUntil = isoDay(b.validUntil);
  if (issued && validUntil && validUntil <= issued) throw new Error('“Valid until” must be after the issue date.');
  const d = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  return Object.assign(d, {
    title, image, issued, validUntil, verifyUrl,
    thumb: existing && existing.image === image ? existing.thumb || '' : '', // a new image has no separate thumbnail
    kind: str(b.kind, 60), badge: str(b.badge, 40), issuer: str(b.issuer, 140), number: str(b.number, 60),
    summary: str(b.summary, 700), verifyHint: str(b.verifyHint, 140), note: str(b.note, 700),
    published: !!b.published, featured: !!b.featured
  });
}
app.get('/api/admin/documents', (req, res) => res.json(db.documents));
app.post('/api/admin/documents', (req, res) => {
  try { db.documents.push(documentFrom(req.body || {})); res.json(db.documents); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/documents/:id', (req, res) => {
  const d = db.documents.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Certificate not found.' });
  const b = req.body || {};
  // quick switches from the list
  if (Object.keys(b).every(k => k === 'published' || k === 'featured')) {
    if ('published' in b) d.published = !!b.published;
    if ('featured' in b) d.featured = !!b.featured;
    return res.json(db.documents);
  }
  try { documentFrom(b, d); res.json(db.documents); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/documents/:id/move', (req, res) => {
  const i = db.documents.findIndex(x => x.id === req.params.id), j = i + (req.body && req.body.dir === 'up' ? -1 : 1);
  if (i < 0) return res.status(404).json({ error: 'Certificate not found.' });
  if (j >= 0 && j < db.documents.length) [db.documents[i], db.documents[j]] = [db.documents[j], db.documents[i]];
  res.json(db.documents);
});
app.delete('/api/admin/documents/:id', (req, res) => {
  db.documents = db.documents.filter(x => x.id !== req.params.id);
  res.json(db.documents);
});

// home page banner slider
function bannerFrom(b, existing) {
  const image = safeImage(b.image);
  if (!image) throw new Error('Please upload the banner image.');
  const link = str(b.link, 300);
  if (link && !/^(\/[\w\-./#?=&%]*|https?:\/\/\S+)$/.test(link)) throw new Error('The link must be a page on this site (e.g. /shop) or start with https://');
  const x = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  return Object.assign(x, { image, mobileImage: safeImage(b.mobileImage), link, alt: str(b.alt, 140), note: str(b.note, 700), published: !!b.published });
}
app.get('/api/admin/banners', (req, res) => res.json(db.banners));
app.post('/api/admin/banners', (req, res) => {
  try { db.banners.push(bannerFrom(req.body || {})); res.json(db.banners); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/banners/:id', (req, res) => {
  const x = db.banners.find(i => i.id === req.params.id);
  if (!x) return res.status(404).json({ error: 'Banner not found.' });
  const b = req.body || {};
  if (Object.keys(b).join() === 'published') { x.published = !!b.published; return res.json(db.banners); }
  try { bannerFrom(b, x); res.json(db.banners); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/banners/:id/move', (req, res) => {
  const i = db.banners.findIndex(x => x.id === req.params.id), j = i + (req.body && req.body.dir === 'up' ? -1 : 1);
  if (i < 0) return res.status(404).json({ error: 'Banner not found.' });
  if (j >= 0 && j < db.banners.length) [db.banners[i], db.banners[j]] = [db.banners[j], db.banners[i]];
  res.json(db.banners);
});
app.delete('/api/admin/banners/:id', (req, res) => { db.banners = db.banners.filter(x => x.id !== req.params.id); res.json(db.banners); });

app.get('/api/admin/messages', (req, res) => res.json(db.messages));
app.delete('/api/admin/messages/:id', (req, res) => {
  db.messages = db.messages.filter(x => x.id !== req.params.id);
  save(); res.json({ ok: true });
});

// payments (secret keys are write-only: never sent back to the browser)
const SECRET = { razorpay: 'keySecret', stripe: 'secretKey', cashfree: 'secretKey' };
function paymentsView() {
  const out = { codEnabled: db.settings.codEnabled };
  for (const g of Object.keys(SECRET)) {
    out[g] = { ...pay()[g], [SECRET[g]]: '', secretSet: !!pay()[g][SECRET[g]] };
  }
  out.razorpay.live = pay().razorpay.keyId.startsWith('rzp_live_');
  out.stripe.live = pay().stripe.secretKey.startsWith('sk_live_') || pay().stripe.secretKey.startsWith('rk_live_');
  return out;
}
app.get('/api/admin/payments', (req, res) => res.json(paymentsView()));
app.put('/api/admin/payments', (req, res) => {
  const b = req.body || {}, p = pay();
  if ('codEnabled' in b) db.settings.codEnabled = !!b.codEnabled;
  if (b.razorpay) {
    p.razorpay.keyId = str(b.razorpay.keyId, 100);
    if (str(b.razorpay.keySecret, 200)) p.razorpay.keySecret = str(b.razorpay.keySecret, 200);
    p.razorpay.enabled = !!b.razorpay.enabled;
  }
  if (b.stripe) {
    if (str(b.stripe.secretKey, 300)) p.stripe.secretKey = str(b.stripe.secretKey, 300);
    p.stripe.enabled = !!b.stripe.enabled;
  }
  if (b.cashfree) {
    p.cashfree.appId = str(b.cashfree.appId, 100);
    if (str(b.cashfree.secretKey, 300)) p.cashfree.secretKey = str(b.cashfree.secretKey, 300);
    p.cashfree.mode = b.cashfree.mode === 'live' ? 'live' : 'test';
    p.cashfree.enabled = !!b.cashfree.enabled;
  }
  // a gateway cannot be switched on without its keys
  const missing = [];
  if (p.razorpay.enabled && !(p.razorpay.keyId && p.razorpay.keySecret)) { p.razorpay.enabled = false; missing.push('Razorpay'); }
  if (p.stripe.enabled && !p.stripe.secretKey) { p.stripe.enabled = false; missing.push('Stripe'); }
  if (p.cashfree.enabled && !(p.cashfree.appId && p.cashfree.secretKey)) { p.cashfree.enabled = false; missing.push('Cashfree'); }
  save();
  res.json({ ...paymentsView(), warning: missing.length ? `${missing.join(', ')} was not switched on because its keys are missing.` : '' });
});
app.delete('/api/admin/payments/:gateway', (req, res) => {
  const g = req.params.gateway;
  if (!SECRET[g]) return res.status(404).json({ error: 'Unknown gateway.' });
  pay()[g] = defaultPayments()[g];
  save(); res.json(paymentsView());
});
// "Test connection": makes a harmless read-only call with the saved keys
app.post('/api/admin/payments/test/:gateway', async (req, res) => {
  const g = req.params.gateway;
  try {
    if (g === 'razorpay') {
      if (!pay().razorpay.keyId || !pay().razorpay.keySecret) throw new Error('Save your Key ID and Key Secret first.');
      const r = await gw('https://api.razorpay.com/v1/payments?count=1', { headers: rzpHeaders() });
      if (!r.ok) throw new Error(r.status === 401 ? 'Razorpay rejected these keys. Please check the Key ID and Key Secret.' : gwError('Razorpay', r).message);
      return res.json({ ok: true, message: `Connected to Razorpay (${pay().razorpay.keyId.startsWith('rzp_live_') ? 'LIVE' : 'test'} mode).` });
    }
    if (g === 'stripe') {
      if (!pay().stripe.secretKey) throw new Error('Save your Secret key first.');
      const r = await gw('https://api.stripe.com/v1/balance', { headers: stripeHeaders() });
      if (!r.ok) throw new Error(r.status === 401 ? 'Stripe rejected this key. Please check the Secret key.' : gwError('Stripe', r).message);
      return res.json({ ok: true, message: `Connected to Stripe (${r.data.livemode ? 'LIVE' : 'test'} mode).` });
    }
    if (g === 'cashfree') {
      if (!pay().cashfree.appId || !pay().cashfree.secretKey) throw new Error('Save your App ID and Secret Key first.');
      const r = await gw(cfBase() + '/orders/connection-check-' + Date.now(), { headers: cfHeaders() });
      // a "not found" reply means the keys were accepted
      if (r.status !== 404 && !r.ok) throw new Error(r.status === 401 || r.status === 403 ? `Cashfree rejected these keys for ${pay().cashfree.mode === 'live' ? 'Live' : 'Test'} mode. Check the keys and the mode.` : gwError('Cashfree', r).message);
      return res.json({ ok: true, message: `Connected to Cashfree (${pay().cashfree.mode === 'live' ? 'LIVE' : 'test'} mode).` });
    }
    res.status(404).json({ error: 'Unknown gateway.' });
  } catch (e) {
    res.status(400).json({ error: e.name === 'TimeoutError' || e.cause ? 'Could not reach the payment gateway. Check your internet connection.' : e.message });
  }
});
app.post('/api/admin/orders/:id/check-payment', async (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  try { await confirmPayment(o); res.json(o); }
  catch (e) { res.status(502).json({ error: 'Could not reach the payment gateway.' }); }
});

// settings
const settingsView = () => ({ ...db.settings, payments: undefined });
app.get('/api/admin/settings', (req, res) => res.json(settingsView()));
app.put('/api/admin/settings', (req, res) => {
  const b = req.body || {}, s = db.settings;
  if (str(b.videoUrl) && !VIDEO_LINK.test(str(b.videoUrl)))
    return res.status(400).json({ error: 'The video link must be a YouTube link (e.g. https://youtu.be/…) or a direct .mp4 / .webm link.' });
  // checked before anything is changed, so a wrong number never half-saves the form
  let waNumber;
  if ('whatsapp' in b) {
    waNumber = str(b.whatsapp, 20).replace(/\D/g, '');
    if (waNumber.length === 10) waNumber = '91' + waNumber; // a 10-digit Indian mobile gets the country code added
    if (waNumber && (waNumber.length < 11 || waNumber.length > 15)) return res.status(400).json({ error: 'WhatsApp number: enter it with the country code, e.g. 919876543210.' });
  }
  for (const k of ['siteName', 'announcement', 'heroKicker', 'heroTitle', 'heroCta', 'introKicker', 'introTitle', 'herbsTitle', 'email', 'phone', 'whatsapp', 'address', 'footerNote'])
    if (k in b) s[k] = str(b[k], 200);
  for (const k of ['heroSubtitle', 'introText']) if (k in b) s[k] = str(b[k], 600);
  for (const k of ['journeyKicker', 'journeyTitle', 'storyKicker', 'storyTitle', 'storySign', 'storyCaption', 'videoKicker', 'videoTitle', 'whyKicker', 'whyTitle', 'foundersKicker', 'foundersTitle', 'foundersNames', 'galleryKicker', 'galleryTitle']) if (k in b) s[k] = str(b[k], 120);
  if ('foundersText' in b) s.foundersText = str(b.foundersText, 1500);
  if ('foundersImage' in b) s.foundersImage = safeImage(b.foundersImage);
  for (const k of ['foundersShow', 'galleryShow', 'ritualShow']) if (k in b) s[k] = !!b[k];
  for (const k of ['ritualKicker', 'ritualTitle', 'storyIntro']) if (k in b) s[k] = str(b[k], 160);
  if ('ritualImages' in b) s.ritualImages = (Array.isArray(b.ritualImages) ? b.ritualImages : []).map(safeImage).filter(Boolean).slice(0, 6);
  if ('storyChapters' in b) s.storyChapters = (Array.isArray(b.storyChapters) ? b.storyChapters : []).slice(0, 5).map(c => ({
    label: str(c && c.label, 60), title: str(c && c.title, 120), caption: str(c && c.caption, 80),
    image: safeImage(c && c.image), text: str(c && c.text, 1500)
  })).filter(c => c.title || c.text);
  if ('galleryImages' in b) s.galleryImages = (Array.isArray(b.galleryImages) ? b.galleryImages : []).map(safeImage).filter(Boolean).slice(0, 12);
  if ('whyLines' in b) s.whyLines = list(b.whyLines, 8).join('\n');
  if ('videoCaption' in b) s.videoCaption = str(b.videoCaption, 300);
  if ('videoUrl' in b) s.videoUrl = safeUrl(b.videoUrl);
  if ('storyText' in b) s.storyText = str(b.storyText, 3000);
  if ('storyImage' in b) s.storyImage = safeImage(b.storyImage);
  if ('statsLines' in b) s.statsLines = list(b.statsLines, 4).join('\n');
  if ('journeySteps' in b) s.journeySteps = list(b.journeySteps, 5).join('\n');
  for (const k of ['heroImage', 'logoImage']) if (k in b) s[k] = safeImage(b[k]);
  if ('logoStyle' in b) s.logoStyle = b.logoStyle === 'image' ? 'image' : 'script';
  if ('logoText' in b) s.logoText = str(b.logoText, 40);
  if ('waPosition' in b) s.waPosition = b.waPosition === 'left' ? 'left' : 'right';
  for (const k of ['logoTm', 'waEnabled']) if (k in b) s[k] = !!b[k];
  if ('waLabel' in b) s.waLabel = str(b.waLabel, 40);
  for (const k of ['waMessage', 'waBubble']) if (k in b) s[k] = str(b[k], 300);
  if (waNumber !== undefined) s.whatsapp = waNumber;
  for (const k of ['instagram', 'facebook', 'youtube']) if (k in b) s[k] = safeUrl(b[k]);
  if ('shippingFee' in b) s.shippingFee = num(b.shippingFee, 0, 10000);
  if ('freeShippingAbove' in b) s.freeShippingAbove = num(b.freeShippingAbove, 0, 1e6);
  if (!s.siteName) s.siteName = 'Rupali Shine';
  save(); res.json(settingsView());
});

/* ---------------- fallbacks ---------------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => send(res, views.notFound(db), 404));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Bad request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

module.exports = app; // Vercel runs the app from this export
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Rupali Shine running →  http://localhost:${PORT}   (admin: http://localhost:${PORT}/admin)`));
