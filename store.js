// Data layer: everything the store remembers lives in MongoDB (no local disk needed),
// so the site can run on serverless hosts such as Vercel.
//
// How it works: each request loads a fresh copy of the data it needs, the route code
// reads and changes it through the `db` object like a plain JavaScript object, and when
// the response is about to be sent only the things that actually changed are written back.
const { MongoClient } = require('mongodb');
const { AsyncLocalStorage } = require('async_hooks');

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'rupalishine';

// lists are stored one document per item, so two customers ordering at the same moment
// never overwrite each other. `pos: true` lists keep the order they were created in.
const LISTS = { products: { pos: true }, pages: { pos: true }, coupons: { pos: true }, orders: {}, messages: {}, reviews: {} };
const ALL_LISTS = Object.keys(LISTS);

let clientPromise;
function database() {
  if (!URI) return Promise.reject(new Error('MONGODB_URI is not set. Add it to the .env file (local) or to the host\'s environment variables.'));
  if (!clientPromise) {
    clientPromise = new MongoClient(URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 }).connect()
      .catch(e => { clientPromise = null; throw e; }); // allow a retry on the next request
  }
  return clientPromise.then(c => c.db(DB_NAME));
}

// `db` always points at the data of the request that is currently running
const context = new AsyncLocalStorage();
const current = () => {
  const ctx = context.getStore();
  if (!ctx) throw new Error('Store data was used outside a request.');
  return ctx.data;
};
const db = new Proxy({}, {
  get: (_, k) => current()[k],
  set: (_, k, v) => { current()[k] = v; return true; },
  has: (_, k) => k in current(),
  deleteProperty: (_, k) => delete current()[k]
});

const sign = (item, i, key) => JSON.stringify(item) + (LISTS[key].pos ? '|' + i : '');

async function load(lists) {
  const d = await database();
  const data = {}, snap = { singles: {}, lists: {} };
  const jobs = [
    d.collection('store').find({ _id: { $ne: 'counter' } }).toArray().then(docs => {
      for (const s of docs) { data[s._id] = s.value; snap.singles[s._id] = JSON.stringify(s.value); }
    }),
    ...lists.map(key => d.collection(key).find().toArray().then(docs => {
      if (LISTS[key].pos) docs.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
      else docs.sort((a, b) => String(b.data.createdAt || '').localeCompare(String(a.data.createdAt || ''))); // newest first
      data[key] = docs.map(x => x.data);
      snap.lists[key] = new Map(docs.map((x, i) => [x._id, sign(x.data, i, key)]));
    }))
  ];
  await Promise.all(jobs);
  return { data, snap, stock: [] };
}

// write back only what changed since load()
async function flush(ctx) {
  const d = await database();
  const ops = [];
  // Stock changes are applied as "+n / -n" inside the database, so orders placed at the same
  // moment each subtract their own quantity instead of overwriting one another.
  const moves = new Map();
  for (const m of ctx.stock.splice(0)) moves.set(m.id, (moves.get(m.id) || 0) + m.delta);
  const before = ctx.snap.lists.products;
  for (const [id, delta] of moves) {
    const i = (ctx.data.products || []).findIndex(p => p.id === id);
    if (!delta || i < 0 || !before) continue;
    const item = ctx.data.products[i];
    // if stock is the only thing that changed on this product, skip the full rewrite below
    if (before.get(id) === sign({ ...item, stock: item.stock - delta }, i, 'products')) before.set(id, sign(item, i, 'products'));
    ops.push(d.collection('products').updateOne({ _id: id }, { $inc: { 'data.stock': delta } }));
  }
  for (const [key, value] of Object.entries(ctx.data)) {
    if (LISTS[key]) {
      const before = ctx.snap.lists[key];
      if (!before || !Array.isArray(value)) continue; // this list was not loaded for this request
      const seen = new Set();
      value.forEach((item, i) => {
        const sig = sign(item, i, key);
        seen.add(item.id);
        if (before.get(item.id) !== sig) {
          before.set(item.id, sig);
          ops.push(d.collection(key).replaceOne({ _id: item.id }, { data: item, pos: i }, { upsert: true }));
        }
      });
      for (const id of [...before.keys()]) if (!seen.has(id)) { before.delete(id); ops.push(d.collection(key).deleteOne({ _id: id })); }
    } else if (value !== undefined) {
      const sig = JSON.stringify(value);
      if (ctx.snap.singles[key] !== sig) {
        ctx.snap.singles[key] = sig;
        ops.push(d.collection('store').replaceOne({ _id: key }, { value }, { upsert: true }));
      }
    }
  }
  await Promise.all(ops);
}

// Runs once each time the server starts: creates the starter data on first use and
// lets the app bring older data up to date.
let readyPromise;
function ready(seed, prepare) {
  if (!readyPromise) {
    readyPromise = (async () => {
      const ctx = await load(ALL_LISTS);
      if (!('settings' in ctx.data)) {
        Object.assign(ctx.data, seed());
        for (const key of ALL_LISTS) { ctx.data[key] = ctx.data[key] || []; ctx.snap.lists[key] = ctx.snap.lists[key] || new Map(); }
      }
      context.run(ctx, prepare);
      await flush(ctx);
      const d = await database();
      await d.collection('store').updateOne({ _id: 'counter' }, { $setOnInsert: { n: (ctx.data.seq && ctx.data.seq.order) || 1000 } }, { upsert: true });
    })().catch(e => { readyPromise = null; throw e; });
  }
  return readyPromise;
}

// Express middleware. `need(path)` says which lists this request uses.
function middleware(seed, prepare, need) {
  return async (req, res, next) => {
    let ctx;
    try {
      await ready(seed, prepare);
      ctx = await load(need(req.path));
    } catch (e) {
      console.error('Database error:', e.message);
      const msg = 'The store is temporarily unavailable. Please try again in a moment.';
      return req.path.startsWith('/api/') ? res.status(503).json({ error: msg }) : res.status(503).type('text').send(msg);
    }
    // save changes just before the response leaves, so a reply is never sent for unsaved data
    const end = res.end.bind(res);
    let ended = false;
    res.end = (...args) => {
      if (ended) return res;
      ended = true;
      flush(ctx).then(() => end(...args), e => {
        console.error('Save failed:', e.message);
        if (!res.headersSent) {
          res.statusCode = 500;
          for (const h of ['Content-Length', 'ETag', 'Location', 'Set-Cookie']) res.removeHeader(h);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        end(JSON.stringify({ error: 'Could not save your changes. Please try again.' }));
      });
      return res;
    };
    context.run(ctx, next);
  };
}

// record a stock change made by the current request (see flush)
function stockMoved(id, delta) {
  const ctx = context.getStore();
  if (ctx && delta) ctx.stock.push({ id, delta });
}

// order numbers come from an atomic counter, so they are never repeated
async function nextOrderNumber() {
  const d = await database();
  const doc = await d.collection('store').findOneAndUpdate({ _id: 'counter' }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  return (doc && doc.value ? doc.value.n : doc.n);
}

// images uploaded from the admin panel
async function saveUpload(name, type, buffer) {
  const d = await database();
  await d.collection('uploads').insertOne({ _id: name, type, data: buffer, at: new Date() });
}
async function getUpload(name) {
  const d = await database();
  const doc = await d.collection('uploads').findOne({ _id: name });
  return doc ? { type: doc.type, data: Buffer.from(doc.data.buffer || doc.data) } : null;
}

module.exports = { db, middleware, stockMoved, nextOrderNumber, saveUpload, getUpload, ALL_LISTS };
