# Rupali Shine

Online store and admin panel (CMS) for Rupali Shine Herbal Oil. All store data lives in MongoDB, so the site can run on Vercel or any Node.js host.

## Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer and a MongoDB database (for example a free MongoDB Atlas cluster).

1. Create a file named `.env` in this folder with your database address:

   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@YOUR-CLUSTER.mongodb.net/
   ```

2. Install and start:

   ```bash
   npm install
   ```

   ```bash
   npm start
   ```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin — the first visit asks you to create the admin username and password.

On Windows you can also double-click `start.bat`.

## Deploy on Vercel

1. Import this repository in Vercel. Keep **Root Directory** `./` and **Application Preset** `Express`. Leave the build settings empty.
2. Under **Environment Variables** add `MONGODB_URI` with your database address.
3. In MongoDB Atlas → **Network Access**, allow access from anywhere (`0.0.0.0/0`). Vercel's servers do not have a fixed address.
4. Deploy, then open `/admin` on the new site straight away to make sure the admin account is yours.

## What is inside

| Path | What it is |
| --- | --- |
| `server.js` | Web server, pricing, orders, payments and the admin API |
| `store.js` | Data layer: loads and saves everything in MongoDB |
| `pincode.js` | Indian states list and the PIN code checker used at checkout |
| `views.js` | The storefront pages |
| `public/css`, `public/js` | Storefront styles and scripts |
| `public/admin` | The admin panel script and styles |
| `public/uploads` | The starter product, logo and ingredient images |

## Where the data lives

| MongoDB collection | Contents |
| --- | --- |
| `store` | Site settings, payment keys, admin login, order-number counter |
| `products`, `pages`, `coupons` | One document per product / page / coupon |
| `orders`, `messages` | One document per order / contact message |
| `uploads` | Images uploaded from the admin panel (up to 4 MB each) |

Back up the database from MongoDB Atlas. Nothing is stored on the server's disk.

## Settings

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | — (required) | MongoDB connection address |
| `MONGODB_DB` | `rupalishine` | Database name |
| `PORT` | `3000` | Port used when running locally |

Never commit `.env` — it holds the database password.
