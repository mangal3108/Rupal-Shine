# Rupali Shine

Online store and admin panel (CMS) for Rupali Shine Herbal Oil.

## Run it

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
```

```bash
npm start
```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin — the first visit asks you to create the admin username and password.

On Windows you can also double-click `start.bat`.

## What is inside

| Path | What it is |
| --- | --- |
| `server.js` | Web server, pricing, orders, payments and the admin API |
| `views.js` | The storefront pages |
| `public/css`, `public/js` | Storefront styles and scripts |
| `public/admin` | The admin panel |
| `public/uploads` | Product, logo and ingredient images |
| `data/db.json` | Created on first run. Holds products, orders, settings and payment keys. **Not in git — back it up separately.** |

## Admin panel

Products, orders, offers and coupons, payment gateways (Razorpay, Cashfree, Stripe, Cash on Delivery), pages, contact messages and all home-page text are managed from the admin panel.

## Settings

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port the site listens on |
| `DATA_DIR` | `./data` | Folder where `db.json` is stored |

Images uploaded from the admin panel are saved in `public/uploads`. On a host with a temporary disk, give both that folder and `DATA_DIR` persistent storage.
