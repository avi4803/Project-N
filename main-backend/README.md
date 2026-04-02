# 🚀 Classmode: The Ultimate Academic Operating System

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/framework-Express.js-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/database-MongoDB-brightgreen.svg)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/cache-Redis-red.svg)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Classmode is a comprehensive backend ecosystem designed to digitize and automate the modern academic experience. From **zero-faculty attendance** to **AI-driven document processing**, it transforms how institutions manage their daily operations.

---

## 🌟 What Makes Classmode Different?

Instead of just being a database, Classmode acts as a **smart orchestrator** for your campus. It handles the "boring" administrative tasks so faculty and students can focus on what matters: **Education**.

---

## 🚀 Key Features

### 🔐 Security & Identity Hub
- **Multi-Role RBAC**: Granular dashboard access for Students, Institutional Admins, and Class Admins.
- **Secure Authentication**: JWT-based stateless auth with session blacklisting for maximum security.
- **OTP Verification**: Integrated One-Time Password service for secure login and account recovery.
- **Institutional Isolation**: Support for multiple colleges/campuses with strict cohort-level data separation.

### ✅ Attendance V2 & Gamification
- **Faculty-Free Automation**: Session orchestration via persistent cron jobs—no manual faculty involvement needed.
- **Weekly Recurring Cycles**: Seamless management of semester-long repeating schedules with dynamic session generation.
- **Gamification Engine**: Smart streaks, achievement badges (e.g., *Streak Master*, *Early Bird*), and milestone rewards to boost engagement.
- **Correction Workflow**: Formal request-response system for attendance disputes with a full audit trail.
- **Daily Status Summaries**: Automatic reporting of daily attendance statistics directly to the student dashboard.

### 📅 Resource & Schedule Management
- **Intelligent Timetables**: Conflict-free Class/Lab scheduling with multi-faculty and batch orchestration.
- **Batch & Section Orchestration**: Hierarchical management of academic units (Departments -> Batches -> Sections).
- **Holiday & Event Engine**: Institution-wide academic calendars with automatic session rescheduling and alerts.
- **Subject Management**: Granular tracking of subjects, faculty assignments, and academic status.

### ⚡ AI-Driven Document Processing
- **Gemini AI OCR**: Integrated high-accuracy extraction of data from IDs and documents via **Google Gemini AI**.
- **Self-Service Verification**: Automatic cross-referencing of document data for student registration and verification.

### 📮 Real-time Connectivity & Alerts
- **Smart Push Notifications (FCM)**: Real-time alerts for class reminders, attendance prompts, and latest news.
- **Automated Class Reminders**: Pre-class notifications to help minimize absenteeism.
- **Campus-Wide Broadcasts**: Targeted messaging to specific batches, classes, or the entire institution.
- **Transactional Emailing**: High-delivery `Nodemailer` integration for OTPs, administrative alerts, and system notifications.

---

## 📈 Built for Scale & Reliability

Classmode isn't just a prototype; it's a production-ready engine engineered for performance:
- **Sub-Millisecond Speed**: Frequently accessed data (like today's timetable) is cached in **Redis** for lightning-fast retrieval.
- **Non-Blocking Background Tasks**: Heavy tasks like OCR and bulk emailing are offloaded to **Bull Queues**, ensuring the API remains highly responsive even during peak hours.
- **Self-Healing Cron Jobs**: Automated health checks and maintenance jobs run 24/7 to ensure system integrity and data consistency.

---

## 🚢 Reliable Deployment

We use **GitHub Actions** for automated testing and deployment. To maintain total control over your releases, we've implemented a **Manual Trigger** system:
1. 🛠️ **Build & Test**: Every push to `main` is automatically validated for quality.
2. 🚀 **One-Click Deploy**: Deployment to AWS only starts when you manually trigger it from the Actions tab, giving you total control over downtime and versioning.

---

## 📘 Project Resources

- ⚙️ [Deployment & Engineering Guide](SETUP_GUIDE.md)
- ✅ [Deep Dive: Attendance V2 Logic](ATTENDANCE_SYSTEM_V2.md)
- 🧪 [QA & Testing Protocols](TESTING_GUIDE.md)

---

<p align="center">Built with ❤️ for the next generation of Academic Infrastructure</p>
<p align="center"><b>Avinash Nishad</b></p>