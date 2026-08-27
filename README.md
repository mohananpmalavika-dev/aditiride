# AditiRide — Universal Multi-Modal Vehicle Booking & Mobility Platform

Production-oriented multi-modal mobility architecture featuring an authoritative fare engine, multilingual voice booking, favorite captain dispatch, bilateral two-way blocking, live OpenStreetMap telematics, zero-trust JWT authorization, and role-isolated workspaces.

---

## 🌟 Key Modules & Architecture

1. **Role-Isolated Workspaces & Strict RBAC**:
   - **👑 Admin Control Center**: Live operations control room map, dynamic pricing & vehicle category studio, driver KYC document review queue, fraud/risk anomaly monitor, and immutable audit logs.
   - **🚖 Driver / Captain Workspace**: GPS telematics broadcaster (Online/Offline), incoming booking offers HUD with 20s countdown timer, turn-by-turn navigation, mandatory 4-digit passenger OTP trip start verification, bounded custom pricing studio ($\pm 20\%$), and net earnings dashboard.
   - **🚗 Passenger Portal**: 3-action fast booking, 1-tap quick rebooking, multi-stop routes, interactive OpenStreetMap, live tracking HUD, masked private calling, SOS emergency shield, and digital receipts.
   - **🏢 Fleet Operations Portal**: Multi-vehicle roster overview, driver shift schedules, and revenue distribution analytics.

2. **🔒 Security, Authentication & Zero-Trust Hardening**:
   - **Bcrypt Password Hashing**: Salted cryptographic password hashing on all user accounts.
   - **Signed JWT Access Tokens**: Authoritative token verification across all REST endpoints and Socket.IO handshakes.
   - **Zero-Trust Identity Derivation**: Backend enforces user identity via `req.user.id`, eliminating Insecure Direct Object References (IDOR).
   - **Authoritative Fare Calculations**: Final trip fares are recalibrated dynamically with real telematics rather than client-submitted estimates.
   - **SOS Participant Verification**: Only authenticated, active ride participants can trigger emergency escalation.
   - **Unguessable 256-Bit Live Share Tokens**: High-entropy cryptographic tokens for family trip sharing.

3. **🎙️ Multi-Lingual Voice Booking Engine**:
   - Natural language voice/text intent parser supporting 6 regional languages: **Malayalam (`ml`)**, **English (`en`)**, **Hindi (`hi`)**, **Tamil (`ta`)**, **Kannada (`kn`)**, and **Telugu (`te`)**.
   - Spoken audio confirmation preview with calculated fare before booking creation.

4. **⚡ Trust & Safety Guardrails**:
   - **4-Digit Passenger PIN / OTP**: Required for captain to begin ride.
   - **Bilateral (Two-Way) Blocking**: If passenger blocks driver OR driver blocks passenger, the matching engine permanently excludes them from open dispatch and direct requests.
   - **Emergency SOS Shield**: Instant alert broadcast to 24/7 safety command center & 112 emergency helpline.

---

## 🛠️ Getting Started

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in `server/`:
```bash
cp server/.env.example server/.env
```

### 2. Install Dependencies
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### 3. Run the Platform
```bash
# Terminal 1 - Backend & Real-Time Engine (Port 5099)
cd server
npm run dev

# Terminal 2 - Frontend Web & PWA (Port 5180)
cd client
npm run dev
```

Open `http://localhost:5180` in your browser.

---

## 🧪 Automated Test Suite

Run authoritative unit, security, and integration tests across the fare engine, matching engine, voice NLP, booking state machines, and JWT security:
```bash
cd server
npm test
```
