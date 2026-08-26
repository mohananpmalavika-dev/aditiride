# AditiRide — Universal Multi-Modal Vehicle Booking & Ride-Hailing Platform

Production-ready cross-platform web and mobile-ready mobility architecture with authoritative fare engine, multi-lingual voice booking in 6 regional languages, favorite captain direct dispatch, bilateral two-way blocking, live OpenStreetMap telematics, and role-isolated workspaces.

---

## 🌟 Key Features

1. **Role-Isolated Workspaces & Strict RBAC**:
   - **👑 Admin Control Center**: Live operations control room map, dynamic pricing & vehicle category studio, driver KYC document review queue, fraud/risk anomaly monitor, and immutable audit logs.
   - **🚖 Driver / Captain Workspace**: GPS telematics broadcaster (Online/Offline), incoming booking offers HUD with 20s countdown timer, turn-by-turn navigation, mandatory 4-digit passenger OTP trip start verification, bounded custom pricing studio ($\pm 20\%$), and net earnings dashboard.
   - **🚗 Passenger Portal**: 3-action fast booking, 1-tap quick rebooking, multi-stop routes, interactive OpenStreetMap, live tracking HUD, masked private calling, SOS emergency shield, and digital receipts.
   - **🏢 Fleet Operations Portal**: Multi-vehicle roster overview, driver shift schedules, and revenue distribution analytics.

2. **🎙️ Multi-Lingual Voice Booking Engine**:
   - Natural language voice/text intent parser supporting 6 regional languages: **Malayalam (`ml`)**, **English (`en`)**, **Hindi (`hi`)**, **Tamil (`ta`)**, **Kannada (`kn`)**, and **Telugu (`te`)**.
   - Spoken audio confirmation preview with calculated fare before booking creation.

3. **🔒 Trust, Safety & Authoritative Guardrails**:
   - **4-Digit Passenger PIN / OTP**: Cryptographically required for captain to begin ride.
   - **Bilateral (Two-Way) Blocking**: If passenger blocks driver OR driver blocks passenger, the matching engine permanently excludes them from open dispatch and direct requests.
   - **Emergency SOS Shield**: Instant alert broadcast to 24/7 safety command center & 112 emergency helpline.

---

## 🚀 Default Credentials

* **Super Admin**:
  * **Username**: `mgdhanyamohan`
  * **Password**: `Thathu@110`
  * **Role**: `SUPER_ADMIN`
* **Demo Passenger**: `dhanya` / `Thathu@110`
* **Demo Captains**: `rahul` (Prime Sedan), `arun` (Auto), `priya` (EV Hatchback) / `Thathu@110`
* **Fleet Partner**: `keralacabs` / `Thathu@110`

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### 2. Run the Platform
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

Run authoritative unit and integration tests across the fare engine, matching engine, voice NLP, and booking state machines:
```bash
cd server
npm test
```
