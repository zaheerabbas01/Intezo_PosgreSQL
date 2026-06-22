# Intezo Queue Management System — Backend Documentation

**Version:** 1.0.0  
**Runtime:** Node.js (ESM)  
**Database:** PostgreSQL via Sequelize ORM  
**Cache:** Redis  
**Real-time:** Socket.IO  
**Base URL:** `https://api.intezo.online/api`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference](#7-api-reference)
   - [Auth](#71-auth-routes--apiauth)
   - [Clinic](#72-clinic-routes--apiclinics)
   - [Doctor](#73-doctor-routes--apidoctors)
   - [Patient](#74-patient-routes--apipatients)
   - [Queue](#75-queue-routes--apiqueues)
   - [Reports](#76-report-routes--apireports)
   - [Admin](#77-admin-routes--apiadmin)
8. [Real-time Events (Socket.IO)](#8-real-time-events-socketio)
9. [Background Services](#9-background-services)
10. [Push Notifications (FCM)](#10-push-notifications-fcm)
11. [Performance & Caching](#11-performance--caching)
12. [Setup & Installation](#12-setup--installation)

---

## 1. Project Overview

Intezo is a clinic queue management platform that allows patients to book queue numbers at clinics and track their wait time in real time. Clinics and doctors manage their queues through a dashboard, while patients interact via a mobile application.

**Core capabilities:**
- Multi-role authentication (Patient, Doctor, Clinic, Admin)
- Real-time queue updates via Socket.IO
- Push notifications via Firebase Cloud Messaging (FCM)
- PDF medical report generation
- Premium patient subscriptions
- Automated daily queue resets via cron jobs
- Performance monitoring and Redis-based caching

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js v5 |
| ORM | Sequelize v6 |
| Database | PostgreSQL |
| Cache | Redis v5 |
| Real-time | Socket.IO v4 |
| Authentication | JSON Web Tokens (JWT) |
| Push Notifications | Firebase Admin SDK (FCM) |
| File Uploads | Multer + Cloudinary |
| Email | Nodemailer |
| PDF Generation | PDFKit |
| Scheduled Jobs | node-cron |
| Password Hashing | bcrypt |

---

## 3. Project Structure

```
backend/
├── app.js                  # Application entry point
├── schema.sql              # PostgreSQL schema definition
├── config/
│   ├── database.js         # Sequelize + PostgreSQL connection
│   ├── redis.js            # Redis client setup
│   └── pusher.js           # Socket.IO initialization
├── controllers/
│   ├── auth/               # Registration, login, email verification
│   ├── clinic/             # Clinic profile, queue analytics, status
│   ├── doctor/             # Doctor profile, availability, stats
│   ├── patient/            # Patient profile, queue status, history
│   ├── queue/              # Booking, cancellation, queue progression
│   ├── report/             # Medical report creation and retrieval
│   ├── admin/              # Admin dashboard and user management
│   ├── notification/       # Notification preferences
│   └── premium/            # Premium subscription management
├── models/
│   ├── index.js            # Model associations
│   ├── Clinic.js
│   ├── Doctor.js
│   ├── Patient.js
│   ├── Queue.js
│   ├── Report.js
│   ├── User.js
│   ├── PendingUser.js
│   └── PremiumPayment.js
├── routes/
│   ├── index.js            # Root router
│   ├── authRoutes.js
│   ├── clinicRoutes.js
│   ├── doctorRoutes.js
│   ├── patientRoutes.js
│   ├── queueRoutes.js
│   ├── reportRoutes.js
│   └── adminRoutes.js
├── middleware/
│   ├── auth.js             # JWT verification per role
│   ├── roles.js            # Role-based access control
│   ├── upload.js           # Multer file upload config
│   ├── performance.js      # Response time monitoring
│   └── validation.js       # Input validation
├── services/
│   ├── realtime.js         # Socket.IO emit helpers
│   ├── fcmService.js       # Firebase push notifications
│   └── emailService.js     # Nodemailer email sending
├── cron/
│   ├── dailyReset.js       # Midnight queue reset
│   └── clinicHoursReset.js # Operating hours auto-close
├── utils/
│   ├── queueReset.js       # Queue reset logic
│   └── waitTimeCalculator.js
└── uploads/
    ├── profiles/
    └── reports/
```

---

## 4. Environment Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=intezo_queue
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key

# Cloudinary (profile photo uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Server
PORT=3000
NODE_ENV=development

# MongoDB (only required for one-time migration)
MONGO_URI=mongodb://localhost:27017/intezo
```

---

## 5. Database Schema

The PostgreSQL database is named `intezo_queue`. All tables use UUID primary keys generated via the `uuid-ossp` extension. Every table has `created_at` and `updated_at` columns maintained automatically by triggers.

### Tables

#### `users`
General admin/staff accounts.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(255) | Required |
| email | VARCHAR(255) | Unique |
| role | VARCHAR(50) | `patient`, `staff`, `admin` |
| verification_code | VARCHAR(255) | Email OTP |
| verification_code_expires | TIMESTAMP | OTP expiry |

---

#### `clinics`
Clinic accounts that manage doctors and queues.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(255) | Required |
| email | VARCHAR(255) | Unique |
| password | VARCHAR(255) | bcrypt hashed |
| phone | VARCHAR(50) | Required |
| address | TEXT | Required |
| profile_photo | VARCHAR(500) | Cloudinary URL |
| services | TEXT[] | Array of service names |
| operating_hours | JSONB | `{ opening, closing }` |
| average_process_time | INTEGER | Minutes per patient (default 15) |
| max_active_queues | INTEGER | Default 50 |
| is_open | BOOLEAN | Current open/closed status |
| email_verified | BOOLEAN | |
| custom_report_templates | JSONB | Custom PDF templates |

---

#### `doctors`
Doctor accounts linked to one or more clinics.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(255) | Required |
| email | VARCHAR(255) | Unique |
| password | VARCHAR(255) | bcrypt hashed |
| phone | VARCHAR(50) | Required |
| specialties | TEXT[] | Array of specialties |
| qualifications | JSONB | Degrees and certifications |
| license_number | VARCHAR(100) | Unique |
| clinics | JSONB | Array of clinic associations |
| email_verified | BOOLEAN | |

---

#### `patients`
Patient accounts registered via the mobile app.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(255) | Required |
| email | VARCHAR(255) | Unique |
| phone | VARCHAR(50) | Unique |
| fcm_token | VARCHAR(500) | Firebase push token |
| current_queue | UUID | FK → queues(id) |
| active_queues | UUID[] | Active queue IDs |
| queue_history | UUID[] | Past queue IDs |
| is_premium | BOOLEAN | Premium status |
| premium_expires_at | TIMESTAMP | |
| clinic_notifications | UUID[] | Opted-in clinic IDs |
| doctor_notifications | UUID[] | Opted-in doctor IDs |

---

#### `queues`
Individual queue entries per patient per doctor per clinic.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| clinic_id | UUID | FK → clinics(id) |
| doctor_id | UUID | FK → doctors(id) |
| patient_id | UUID | FK → patients(id), nullable for walk-ins |
| patient_name | VARCHAR(255) | Walk-in name |
| manual_entry | JSONB | Walk-in contact details |
| number | INTEGER | Queue number |
| status | VARCHAR(50) | `waiting`, `served`, `cancelled`, `missed`, `skipped` |
| booked_at | TIMESTAMP | |
| served_at | TIMESTAMP | |
| cancelled_at | TIMESTAMP | |

---

#### `reports`
Medical reports generated by doctors for patients.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| patient_id | UUID | FK → patients(id) |
| clinic_id | UUID | FK → clinics(id) |
| doctor_id | UUID | FK → doctors(id) |
| report_type | VARCHAR(50) | `medical`, `lab_test` |
| title | VARCHAR(255) | |
| diagnosis | TEXT | Required |
| symptoms | TEXT | |
| treatment | TEXT | |
| medications | JSONB | |
| lab_tests | JSONB | |
| follow_up_date | TIMESTAMP | |
| pdf_url | VARCHAR(500) | Generated PDF path |
| is_read | BOOLEAN | Patient read status |

---

#### `pending_users`
Holds registrations awaiting email verification or admin approval.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_data | JSONB | Full registration payload |
| user_type | VARCHAR(50) | `doctor`, `clinic`, `patient` |
| status | VARCHAR(50) | `pending_verification`, `pending_approval`, `approved`, `rejected` |

---

#### `premium_payments`
Payment submissions for premium patient upgrades.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| patient_id | UUID | FK → patients(id) |
| payment_method | VARCHAR(50) | `easypesa`, `jazzcash`, `nayapay`, `sadapay` |
| amount | DECIMAL(10,2) | Default 100 |
| payment_image | TEXT | Proof of payment image |
| status | VARCHAR(50) | `pending`, `approved`, `rejected` |
| reviewed_by | UUID | FK → users(id) |

---

### Model Associations

```
Queue          → belongsTo Clinic, Doctor, Patient
Clinic         → hasMany Queue, Report
Doctor         → hasMany Queue, Report
Patient        → hasMany Queue, Report, PremiumPayment
Report         → belongsTo Patient, Clinic, Doctor
PremiumPayment → belongsTo Patient, User (reviewer)
```

---

## 6. Authentication & Authorization

All protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### JWT Payload Structure

```json
{
  "id": "uuid",
  "role": "clinic | doctor | patient | admin",
  "email": "user@example.com"
}
```

### Middleware

| Middleware | File | Purpose |
|---|---|---|
| `authenticate` | `middleware/auth.js` | Accepts any valid role token |
| `authenticatePatient` | `middleware/auth.js` | Patient tokens only |
| `authenticateDoctor` | `middleware/auth.js` | Doctor tokens only (requires email verified) |
| `authorizeClinic` | `middleware/auth.js` | Clinic tokens only |
| `authorizeAdmin` | `middleware/roles.js` | Admin role only |
| `requireRole([...])` | `middleware/roles.js` | Accepts array of allowed roles |

### Email Verification Flow

1. User registers → record saved to `pending_users` → OTP sent via email
2. User submits OTP → record moved to the appropriate table (`clinics`, `doctors`, `patients`)
3. Doctors and clinics additionally require admin approval before full access

---

## 7. API Reference

All endpoints are prefixed with `/api`.

---

### 7.1 Auth Routes — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register/patient` | None | Register a new patient |
| POST | `/login/patient` | None | Patient login |
| POST | `/verify/patient` | None | Verify patient email OTP |
| POST | `/resend/patient` | None | Resend patient OTP |
| POST | `/register/clinic` | None | Register a new clinic |
| POST | `/login/clinic` | None | Clinic login |
| POST | `/verify/clinic` | None | Verify clinic email OTP |
| POST | `/resend/clinic` | None | Resend clinic OTP |
| POST | `/register/doctor` | None | Register a new doctor |
| POST | `/login/doctor` | None | Doctor login |
| POST | `/verify/doctor` | None | Verify doctor email OTP |
| POST | `/resend/doctor` | None | Resend doctor OTP |
| POST | `/admin/login` | None | Admin login |
| POST | `/verify/admin` | None | Verify admin email OTP |
| POST | `/logout` | Any | Logout (invalidate session) |

**Login Response Example:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Clinic Name",
    "email": "clinic@example.com",
    "role": "clinic"
  }
}
```

---

### 7.2 Clinic Routes — `/api/clinics`

#### Public (No Auth Required)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register clinic |
| POST | `/login` | Clinic login |
| GET | `/public` | List all public clinics |
| POST | `/recent` | Get recently visited clinics |
| GET | `/:clinicId/status` | Get clinic open/closed status |
| GET | `/:clinicId/complete` | Get clinic + doctors + queues in one call |
| GET | `/:clinicId/summary` | Quick clinic overview |
| GET | `/:clinicId/doctors/:doctorId/queue-fast` | Fast doctor queue data |
| POST | `/:clinicId/batch-queues` | Batch queue data for multiple doctors |

#### Protected (Clinic Auth Required)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/status` | Get authenticated clinic's status |
| GET | `/profile` | Get clinic profile |
| PUT | `/profile` | Update clinic profile |
| DELETE | `/profile` | Delete clinic account |
| GET | `/analytics` | Queue analytics and statistics |
| POST | `/toggle-status` | Open or close the clinic |
| POST | `/reset-all-queues` | Reset all active queues |
| POST | `/verify-redis-counters` | Verify Redis queue counters |
| POST | `/check-operation-hours` | Check if within operating hours |
| GET | `/debug-queue` | Debug queue state |
| POST | `/upload-photo` | Upload clinic profile photo |
| DELETE | `/delete-photo` | Delete clinic profile photo |
| POST | `/add-patient-to-queue` | Manually add a walk-in patient |
| GET | `/patients/:patientId/history` | Get a patient's visit history |

---

### 7.3 Doctor Routes — `/api/doctors`

#### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/public/:clinicId` | List doctors for a clinic (public) |

#### Clinic Admin Auth Required

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List all doctors for the clinic |
| GET | `/available` | List available doctors |
| POST | `/` | Add a new doctor |
| POST | `/add-to-clinic` | Link an existing doctor to the clinic |
| GET | `/:id` | Get a specific doctor |
| PUT | `/:id` | Update a doctor |
| DELETE | `/:id` | Remove a doctor |
| PATCH | `/:id/availability` | Toggle doctor availability |
| GET | `/:id/queue-status` | Get doctor's current queue status |

#### Doctor Auth Required

| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get own profile |
| GET | `/stats` | Get own statistics |
| PUT | `/profile` | Update own profile |
| POST | `/upload-photo` | Upload profile photo |
| DELETE | `/delete-photo` | Delete profile photo |
| POST | `/toggle-availability` | Toggle own availability |
| POST | `/queue/skip` | Skip current patient |
| GET | `/queue/skipped/:doctorId` | Get list of skipped patients |
| POST | `/queue/call-back/:queueId` | Call back a skipped patient |
| POST | `/queue/next` | Advance to next patient |

---

### 7.4 Patient Routes — `/api/patients`

#### Public

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register a new patient |
| POST | `/register-and-queue` | Register and immediately join a queue |
| PUT | `/:patientId` | Update patient info |
| GET | `/:patientId/history` | Get patient queue history |

#### Patient Auth Required

| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get own profile |
| GET | `/queue-status` | Get current queue status |
| DELETE | `/cancel-booking` | Cancel current booking |
| POST | `/fcm-token` | Register FCM push token |
| PUT | `/fcm-token` | Update FCM push token |
| POST | `/book-doctor` | Book a queue slot with a doctor |
| POST | `/notifications/clinic/:clinicId` | Enable clinic open notifications |
| DELETE | `/notifications/clinic/:clinicId` | Disable clinic open notifications |
| POST | `/notifications/doctor/:doctorId` | Enable doctor available notifications |
| DELETE | `/notifications/doctor/:doctorId` | Disable doctor available notifications |
| GET | `/notifications/preferences` | Get all notification preferences |

---

### 7.5 Queue Routes — `/api/queues`

#### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/public/:clinicId/:doctorId` | Get live queue data for a doctor |
| GET | `/:clinicId/:doctorId/wait-time` | Get estimated wait time |
| GET | `/:clinicId/:doctorId/detailed` | Get detailed queue with wait times |

#### Patient Auth Required

| Method | Endpoint | Description |
|---|---|---|
| POST | `/book` | Book a queue number |
| POST | `/cancel/:queueId` | Cancel a booking |
| POST | `/book-doctor` | Book with a specific doctor |
| GET | `/patient/:queueId/wait-time` | Get wait time for a specific booking |

#### Clinic Admin Auth Required

| Method | Endpoint | Description |
|---|---|---|
| POST | `/next` | Advance queue to next number |
| POST | `/skip` | Skip current patient |
| GET | `/skipped/:doctorId` | Get skipped patients list |
| POST | `/call-back/:queueId` | Call back a skipped patient |
| POST | `/next-doctor` | Advance a specific doctor's queue |

**Book Queue Request Body:**
```json
{
  "clinicId": "uuid",
  "doctorId": "uuid",
  "patientId": "uuid",
  "patientName": "Optional walk-in name"
}
```

**Queue Response Example:**
```json
{
  "queueNumber": 12,
  "currentNumber": 8,
  "estimatedWait": "20 minutes",
  "doctorName": "Dr. Ahmed",
  "clinicName": "City Clinic"
}
```

---

### 7.6 Report Routes — `/api/reports`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/test` | None | Health check for reports routes |
| GET | `/options` | Clinic / Doctor | Get predefined field options |
| GET | `/custom-templates` | Clinic / Doctor | Get saved custom templates |
| POST | `/custom-templates` | Clinic / Doctor | Save custom templates |
| GET | `/patient` | Patient | Get own medical reports |
| GET | `/clinic` | Clinic / Doctor | Get reports for the clinic |
| POST | `/` | Clinic / Doctor | Create a new medical report |
| GET | `/:reportId/download` | Any Auth | Download report as PDF |
| PATCH | `/:reportId/read` | Patient | Mark a report as read |

**Create Report Request Body:**
```json
{
  "patientId": "uuid",
  "title": "General Checkup",
  "reportType": "medical",
  "diagnosis": "Mild hypertension",
  "symptoms": "Headache, dizziness",
  "treatment": "Rest and medication",
  "medications": [{ "name": "Amlodipine", "dose": "5mg", "frequency": "Once daily" }],
  "notes": "Follow up in 2 weeks",
  "followUpDate": "2025-09-01T00:00:00.000Z"
}
```

---

### 7.7 Admin Routes — `/api/admin`

All admin routes require authentication with the `admin` role.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Dashboard statistics |
| GET | `/patients` | List all patients |
| PUT | `/patients/:id` | Update a patient |
| DELETE | `/patients/:id` | Delete a patient |
| GET | `/doctors` | List all doctors |
| PUT | `/doctors/:id` | Update a doctor |
| DELETE | `/doctors/:id` | Delete a doctor |
| DELETE | `/doctors/:doctorId/clinics/:clinicId` | Remove doctor from a clinic |
| GET | `/clinics` | List all clinics |
| PUT | `/clinics/:id` | Update a clinic |
| DELETE | `/clinics/:id` | Delete a clinic |
| GET | `/pending-approvals` | List pending registrations |
| POST | `/approve/:id` | Approve a registration |
| POST | `/reject/:id` | Reject a registration |
| GET | `/activity` | Get recent system activity log |
| POST | `/broadcast` | Broadcast a message to all connected users |
| GET | `/online-users` | Get currently online users |
| POST | `/logout` | Force logout a user |
| GET | `/premium-payments` | List pending premium payment submissions |
| POST | `/premium-payments/:id/approve` | Approve a premium payment |
| POST | `/premium-payments/:id/reject` | Reject a premium payment |

---

## 8. Real-time Events (Socket.IO)

The server uses Socket.IO for live queue updates. Clients join rooms based on their identity.

### Server-emitted Events

| Event | Room | Payload | Description |
|---|---|---|---|
| `queue_updated` | clinic room | Queue state object | Queue number changed |
| `doctor_status_changed` | clinic room | `{ doctorId, ...data }` | Doctor availability changed |
| `status_changed` | doctor room | Status data | Doctor's own status changed |
| `patient_update` | user room | Update data | Patient-specific update |
| `system_notification` | all | `{ type, ...data }` | System-wide broadcast |
| `admin_update` | admin room | `{ type, data, timestamp }` | Admin dashboard update |

### Redis Queue Counter Keys

```
clinic:{clinicId}:current                              → current serving number
clinic:{clinicId}:lastIssued                           → last issued queue number
doctor:{doctorId}:clinic:{clinicId}:current            → doctor-level current number
doctor:{doctorId}:clinic:{clinicId}:lastIssued         → doctor-level last issued
```

---

## 9. Background Services

### Cron Jobs

| Job | Schedule | File | Description |
|---|---|---|---|
| Daily Queue Reset | `0 0 * * *` (midnight) | `cron/dailyReset.js` | Resets all queue counters and marks unserved entries as missed |
| Clinic Hours Reset | Configurable | `cron/clinicHoursReset.js` | Auto-closes clinics outside operating hours |

### Startup Queue Check

On every server start, `scripts/startup-queue-check.js` runs to:
- Verify Redis counters match the database state
- Fix any inconsistencies caused by unexpected shutdowns

---

## 10. Push Notifications (FCM)

Push notifications are sent via Firebase Cloud Messaging using the `FCMService` class in `services/fcmService.js`.

### Notification Types

| Type | Trigger | Recipients |
|---|---|---|
| `queue_update` | Queue number advances near patient's turn | Individual patient |
| `clinic_open` | Clinic toggles status to open | Patients who opted in |
| `doctor_available` | Doctor toggles availability to available | Patients who opted in |
| `patient_served` | Patient's queue entry marked as served | Individual patient |
| `report_ready` | New medical report created for patient | Individual patient |

### Deduplication

The service maintains an in-memory map of recently sent notifications to prevent duplicate pushes within configurable time windows (1–5 minutes depending on type). The map is cleaned up every 60 seconds.

### Invalid Token Handling

If FCM returns `messaging/registration-token-not-registered`, the token is automatically removed from the patient's record.

---

## 11. Performance & Caching

### Response Time Monitoring

The `performanceMonitor` middleware (`middleware/performance.js`) tracks response time for every request:
- Requests exceeding **1000ms** are logged as slow requests
- Response time is stored in Redis under `perf:{METHOD}:{path}` (last 100 measurements, 1-hour TTL)
- Every response includes an `X-Response-Time` header

### HTTP Cache Headers

The `cacheHeaders` middleware sets `Cache-Control: public, max-age=300` on public endpoints (paths containing `/public` or `/recent`).

### Database Indexes

Key indexes defined in `schema.sql`:

```sql
-- Queues (most queried table)
idx_queues_clinic_doctor_status_number  ON queues(clinic_id, doctor_id, status, number)
idx_queues_clinic_doctor_booked         ON queues(clinic_id, doctor_id, booked_at)
idx_queues_patient_status               ON queues(patient_id, status)
idx_queues_doctor_status_number         ON queues(doctor_id, status, number)

-- Reports
idx_reports_patient_created             ON reports(patient_id, created_at)
idx_reports_clinic_created              ON reports(clinic_id, created_at)
idx_reports_doctor_created              ON reports(doctor_id, created_at)
```

---

## 12. Setup & Installation

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### Steps

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

**3. Create the database and run schema**
```bash
psql -U postgres -f schema.sql
```

**4. (Optional) Migrate data from MongoDB**
```bash
node migrate.js
```

**5. Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node app.js` | Start production server |
| `dev` | `nodemon app.js` | Start development server with auto-reload |
| `migrate` | `node migrate.js` | Migrate data from MongoDB to PostgreSQL |
| `verify` | `node verify-migration.js` | Verify migration integrity |
| `clear-db` | `node clear-db.js` | Clear all PostgreSQL data |
| `db:setup` | `psql -U postgres -f schema.sql` | Initialize database schema |

### Server Startup Sequence

When `npm start` is run, the server initializes in this order:

1. Connect to PostgreSQL
2. Connect to Redis
3. Initialize Socket.IO
4. Initialize FCM service
5. Initialize Redis queue counters for all clinics and doctors
6. Run startup queue integrity check
7. Register all API routes
8. Start HTTP server on configured `PORT`

---

*Documentation generated for Intezo Queue Management System — Backend v1.0.0*
