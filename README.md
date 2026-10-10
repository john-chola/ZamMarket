# 🪵 ZamMarket

**A Progressive Web Application for Local Zambian Charcoal Commerce**

> Final Year Project — University of Zambia (UNZA)
> School of Natural and Applied Sciences · Department of Computing and Informatics
> Academic Year 2026

---

## 📌 Problem Statement

Charcoal sellers in Zambian communities struggle to find buyers in their immediate neighbourhood. Buyers have no reliable way to locate trusted charcoal sellers nearby. ZamMarket solves this by connecting local charcoal sellers and buyers through a mobile-first progressive web application.

---

## 🎯 Project Aims

To design, develop, and evaluate a progressive web application for local Zambian commerce that incorporates:
- Voice-based listing creation (English, Nyanja, Bemba)
- Offline-first functionality with background sync
- Blockchain-based seller trust scoring
- Real-time peer-to-peer messaging

---

## ✨ Features

### For Sellers
- 📱 Register with Zambian phone number (OTP verification)
- 🎙️ Create listings by speaking in English, Nyanja, or Bemba
- 📷 Upload product photos (Cloudinary)
- 📦 Manage listings (edit, mark as sold, pause, delete)
- 💬 Real-time chat with buyers
- 🔗 Build a blockchain-verified trust score
- 📵 Works offline — listings sync when reconnected

### For Buyers
- 🔍 Browse charcoal listings with neighbourhood and price filters
- 👤 View seller profiles with trust scores
- 💬 Message sellers directly
- ⭐ Rate sellers after collecting charcoal (blockchain recorded)
- 📵 Offline browsing of cached listings

### For Admins
- 📊 Dashboard with platform statistics
- ✅ Verify trusted sellers
- ⛔ Suspend/reactivate accounts
- 🗑️ Remove inappropriate listings
- 🔄 Change user roles

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│   React 18 + Redux Toolkit + Vite   │
│        Progressive Web App          │
├─────────────────────────────────────┤
│          Application Layer          │
│    Node.js + Express.js + JWT       │
│         Socket.io (chat)            │
├─────────────────────────────────────┤
│            Data Layer               │
│  MongoDB Atlas + Mongoose ODM       │
│  IndexedDB (offline queue)          │
└─────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Redux Toolkit, React Router 6, Vite |
| Styling | Custom CSS with design tokens |
| Backend | Node.js, Express.js 4 |
| Database | MongoDB Atlas + Mongoose |
| Real-time | Socket.io |
| Authentication | JWT + bcrypt + OTP (simulated) |
| Image Storage | Cloudinary |
| Offline | Service Worker + IndexedDB |
| Blockchain | SHA-256 hash chain (crypto-js) |
| Voice | Web Speech API (English/Nyanja/Bemba) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ — https://nodejs.org
- Git — https://git-scm.com
- MongoDB Atlas account — https://cloud.mongodb.com (free)
- Cloudinary account — https://cloudinary.com (free)

---

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/zammarket.git
cd zammarket
```

---

### 2. Backend setup

```bash
cd backend
npm install
```

Create your `.env` file:
```bash
cp .env.example .env
```

Fill in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/zammarket
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
npm run dev
```

Backend runs at: `http://localhost:5000`
Health check: `http://localhost:5000/api/health`

---

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:
```bash
npm start
```

Frontend runs at: `http://localhost:5173`

---

### 4. How OTP works in development

Since SMS is simulated, OTP codes print to the **backend terminal**:

```
──────────────────────────────────────
📱 SIMULATED OTP for +260977123456: 847291
──────────────────────────────────────
```

Check the backend terminal when registering.

---

### 5. Create the first admin

Admins cannot sign up through the app. Create one from the `backend` folder:

```bash
npm run create-admin -- --phone 0971234567 --name "Site Admin" --password "your-strong-password"
```

If the phone number is already registered, that account is promoted to admin instead. Then log in with that phone number and password and open `/admin` (or tap the admin button on the dashboard).

> **Where is my data in Atlas?** The database called `admin` in MongoDB Atlas is MongoDB's own system database and is always empty for apps. ZamMarket's data lives in the database named at the end of `MONGODB_URI` (e.g. `.../zammarket`), in collections such as `users`, `listings` and `trustchains`.

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/request-otp` | Send OTP to phone | No |
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/me` | Current user | JWT |
| GET | `/api/listings` | Browse listings | No |
| POST | `/api/listings` | Create listing | Seller |
| PUT | `/api/listings/:id` | Update listing | Seller |
| DELETE | `/api/listings/:id` | Delete listing | Seller |
| GET | `/api/chat/conversations` | Inbox | JWT |
| POST | `/api/chat/conversations` | Start conversation | JWT |
| GET | `/api/chat/conversations/:id/messages` | Get messages | JWT |
| GET | `/api/trust/:sellerId` | Seller trust chain | No |
| POST | `/api/trust/rate` | Rate a seller | JWT |
| GET | `/api/admin/stats` | Platform stats | Admin |
| GET | `/api/admin/users` | All users | Admin |
| PUT | `/api/admin/users/:id/verify` | Verify seller | Admin |

---

## 🌐 Deployment

### Frontend — Vercel
```
Framework:        Vite
Root Directory:   frontend
Build Command:    npm run build
Output Directory: dist

Environment Variables:
  VITE_API_URL    = https://your-api.onrender.com/api
  VITE_SOCKET_URL = https://your-api.onrender.com
```

### Backend — Render
```
Root Directory: backend
Build Command:  npm install
Start Command:  node server.js

Environment Variables:
  PORT, NODE_ENV=production, MONGODB_URI, JWT_SECRET,
  JWT_EXPIRES_IN, CLOUDINARY_*,
  FRONTEND_URL = https://your-app.vercel.app   (comma-separate several URLs)
```

**Checklist when deploying**
- `FRONTEND_URL` on Render must exactly match the Vercel address (no trailing path), or the browser blocks API and chat requests (CORS).
- `VITE_API_URL` and `VITE_SOCKET_URL` on Vercel must point at the Render address. Redeploy the frontend after changing them, because Vite builds them into the app.
- In MongoDB Atlas → Network Access, allow Render to connect (e.g. `0.0.0.0/0`), or the backend exits with "MongoDB failed".
- `frontend/vercel.json` sends every page route to `index.html`, so refreshing `/dashboard` works.
- Render's free tier sleeps when idle; the first request after a pause can take about a minute.

---

## 📁 Project Structure

```
zammarket/
├── backend/
│   ├── controllers/        # authController, listingController, chatController,
│   │                       # trustController, adminController
│   ├── middleware/         # auth.js, upload.js, rateLimiter.js, errorHandler.js
│   ├── models/             # User, Listing, Conversation, Message, TrustChain, OTP
│   ├── routes/             # auth, user, listing, chat, trust, admin
│   ├── utils/              # blockchain.js, cloudinary.js, jwt.js, otp.js, socket.js
│   ├── .env.example
│   └── server.js
│
└── frontend/
    ├── public/             # manifest.json, sw.js, favicon.svg
    └── src/
        ├── components/
        │   ├── common/     # ProtectedRoute
        │   ├── listings/   # ListingCard, CreateListingForm
        │   └── voice/      # VoiceListingInput
        ├── pages/          # Login, Register, Dashboard, Browse, Listings,
        │                   # Chat, Inbox, TrustScore, Admin, CreateListing
        ├── store/
        │   └── slices/     # authSlice, listingSlice, chatSlice
        ├── utils/          # api.js, socket.js, validation.js,
        │                   # offlineQueue.js, pwa.js
        ├── App.jsx
        └── index.jsx
```

---

## 🧪 Testing

```bash
# Backend: trust chain, auth, rating rules, CORS (no database needed)
cd backend
npm test

# Frontend: lint + voice listing parser
cd frontend
npm run lint
npm run test:voice

# Lighthouse performance audit
# Open Chrome → DevTools → Lighthouse → Generate report
```

**Test targets:**
- SUS usability score ≥ 70
- Lighthouse performance ≥ 70 on mobile
- Offline functionality verified
- Blockchain tamper detection verified

---

## 🔐 Security

- Passwords hashed with **bcrypt** (12 rounds)
- Authentication via **JWT** (7-day expiry)
- OTP rate limited — 3 attempts per 10 minutes
- Login rate limited — 10 attempts per 15 minutes
- Input validation and sanitisation on all endpoints
- HTTPS enforced in production
- Phone numbers masked in public profiles

---

## 📚 Academic References

- Sommerville, I. (2016). *Software Engineering* (10th ed.). Pearson.
- Larman, C. (2004). *Applying UML and Patterns* (3rd ed.). Addison-Wesley.
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1995). *Design Patterns*. Addison-Wesley.

---

## 👨‍💻 Author

**John Chola**
Student ID: 2021422054
BSc Computer Science (Software Engineering)
University of Zambia — School of Natural and Applied Sciences
Department of Computing and Informatics

---

## 📄 Licence

MIT — for academic purposes.

*ZamMarket · UNZA Final Year Project · 2026*