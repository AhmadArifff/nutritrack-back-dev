# NutriTrack Backend

Express.js backend untuk NutriTrack dengan database MySQL/XAMPP.

## Setup

1. Pastikan MySQL XAMPP aktif.
2. Salin konfigurasi environment:

```bash
cp .env.example .env
```

3. Install dependency:

```bash
npm install
```

4. Jalankan migrasi dan seed:

```bash
npm run db:setup
```

5. Jalankan API:

```bash
npm run dev
```

API berjalan di `http://localhost:4000`.

## Demo Account

- Email: `alex@nutritrack.app`
- Password: `nutritrack123`

## Scripts

- `npm run migrate`: membuat database `nutritrack` dan semua tabel.
- `npm run seed`: mengisi data awal untuk testing.
- `npm run dev`: menjalankan server dengan nodemon.
- `npm start`: menjalankan server production.

## Endpoint Utama

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/summary`
- `GET /api/foods`
- `GET /api/food-logs`
- `POST /api/food-logs`
- `GET /api/meal-plans`
- `POST /api/meal-plans`
- `GET /api/progress/weight`
- `POST /api/progress/weight`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/settings`
- `PUT /api/settings`
