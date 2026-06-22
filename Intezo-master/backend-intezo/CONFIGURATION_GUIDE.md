# Intezo Queue System - Configuration Guide

## Switching Between Domain and Local IPv4

This guide explains how to switch your Intezo Queue System between production domain (https://api.intezo.online) and local IPv4 (http://202.47.48.188:3000) for testing.

---

## 📋 Quick Overview

| Component | Domain (Production) | IPv4 (Local Testing) |
|-----------|-------------------|---------------------|
| **Backend** | https://api.intezo.online | http://202.47.48.188:3000 |
| **Web Dashboard** | https://web.intezo.online | http://202.47.48.188:3001 |
| **Mobile App** | Uses domain | Uses IPv4 |

---

## 🔧 Configuration Steps

### 1️⃣ Backend Configuration

**Location:** `backend-intezo/.env`

The backend **supports both simultaneously** - no changes needed!

```env
# Backend listens on all interfaces (0.0.0.0)
PORT=3000

# CORS allows both domain and IPv4
FRONTEND_URL='https://web.intezo.online,http://202.47.48.188:3001'
```

✅ **Backend is ready for both!**

---

### 2️⃣ Web Dashboard Configuration

**Location:** `clinic_dashboard/.env`

#### For Domain (Production):
```bash
cd clinic_dashboard
copy .env.domain .env
npm start
```

**File: `.env.domain`**
```env
REACT_APP_API_URL=https://api.intezo.online/api
REACT_APP_SOCKET_URL=https://api.intezo.online
PORT=3001
```

#### For IPv4 (Local Testing):
```bash
cd clinic_dashboard
copy .env.ipv4 .env
npm start
```

**File: `.env.ipv4`**
```env
REACT_APP_API_URL=http://202.47.48.188:3000/api
REACT_APP_SOCKET_URL=http://202.47.48.188:3000
PORT=3001
```

---

### 3️⃣ Mobile App Configuration

**Location:** `mobile_app/.env`

#### For Domain (Production):
```bash
cd mobile_app
copy .env.domain .env
flutter pub get
flutter run
```

**File: `.env.domain`**
```env
API_BASE_URL=https://api.intezo.online/api
SOCKET_BASE_URL=https://api.intezo.online
```

#### For IPv4 (Local Testing):
```bash
cd mobile_app
copy .env.ipv4 .env
flutter pub get
flutter run
```

**File: `.env.ipv4`**
```env
API_BASE_URL=http://202.47.48.188:3000/api
SOCKET_BASE_URL=http://202.47.48.188:3000
```

---

## 🚀 Complete Setup Commands

### Setup for Domain (Production)

```bash
# Web Dashboard
cd clinic_dashboard
copy .env.domain .env
npm start

# Mobile App
cd ../mobile_app
copy .env.domain .env
flutter pub get
flutter run

# Backend (no change needed)
cd ../backend-intezo
npm run dev
```

### Setup for IPv4 (Local Testing)

```bash
# Web Dashboard
cd clinic_dashboard
copy .env.ipv4 .env
npm start

# Mobile App
cd ../mobile_app
copy .env.ipv4 .env
flutter pub get
flutter run

# Backend (no change needed)
cd ../backend-intezo
npm run dev
```

---

## 📱 Access URLs

### Domain Configuration
- **Web Dashboard:** https://web.intezo.online
- **Backend API:** https://api.intezo.online/api
- **API Docs:** https://api.intezo.online/api-docs

### IPv4 Configuration
- **Web Dashboard:** http://202.47.48.188:3001
- **Backend API:** http://202.47.48.188:3000/api
- **API Docs:** http://202.47.48.188:3000/api-docs

---

## ✅ Verification Steps

### 1. Check Web Dashboard
1. Open browser console (F12)
2. Look for: `"ApiConfig: Using base URL: ..."`
3. Should show the URL from your `.env` file

### 2. Check Mobile App
1. Run the app: `flutter run`
2. Check console output
3. Look for: `"ApiConfig: Using base URL: ..."`
4. Should show the URL from your `.env` file

### 3. Test Booking Flow
1. **Mobile App:** Book a queue number
2. **Web Dashboard:** Should see the queue appear instantly
3. **Real-time Updates:** Both should sync via Socket.IO

---

## 🔥 Important Notes

### For IPv4 Testing:

1. **Network Requirement:**
   - Mobile device and backend must be on the same network
   - Backend must be accessible at `202.47.48.188:3000`

2. **Firewall Settings:**
   ```bash
   # Windows Firewall (if needed)
   netsh advfirewall firewall add rule name="Intezo Backend" dir=in action=allow protocol=TCP localport=3000
   netsh advfirewall firewall add rule name="Intezo Frontend" dir=in action=allow protocol=TCP localport=3001
   ```

3. **Security:**
   - IPv4 uses HTTP (not encrypted)
   - Only use on trusted networks
   - Not recommended for production data

### For Domain (Production):

1. **Requirements:**
   - Internet connection required
   - Cloudflare tunnel must be running
   - HTTPS - secure connection

2. **Cloudflare Tunnel:**
   ```bash
   start-cloudflare.bat
   ```

---

## 🐛 Troubleshooting

### Web Dashboard Not Using .env
```bash
# Solution:
1. Stop the development server (Ctrl+C)
2. Delete .env file
3. Copy the correct template: copy .env.ipv4 .env
4. Restart: npm start
5. Clear browser cache (Ctrl+Shift+Delete)
```

### Mobile App Not Using .env
```bash
# Solution:
1. Stop the app
2. Copy the correct template: copy .env.ipv4 .env
3. Run: flutter pub get
4. Restart app: flutter run
# Note: Hot reload won't work, need full restart
```

### Cannot Connect via IPv4
```bash
# Check backend is running:
curl http://202.47.48.188:3000/api-docs

# Check if port is open:
netstat -an | findstr :3000

# Verify IP address:
ipconfig
# Look for IPv4 Address under your network adapter
```

### Socket.IO Not Connecting
```bash
# Check console for errors
# Verify backend is running
# Check CORS settings in backend
# Try restarting both backend and frontend
```

---

## 📊 How It Works

### Mobile App Books Queue (IPv4)
```
Mobile App (202.47.48.188:3001)
    ↓ POST /api/queues/book-doctor
Backend (202.47.48.188:3000)
    ↓ Save to PostgreSQL
    ↓ Update Redis Cache
    ↓ Emit Socket.IO Event
Web Dashboard (202.47.48.188:3001)
    ↓ Receives real-time update
    ✓ Queue appears instantly!
```

### Key Points:
- ✅ Same PostgreSQL database
- ✅ Same Redis cache
- ✅ Same Socket.IO server
- ✅ Real-time sync works perfectly
- ✅ No data loss when switching

---

## 📁 File Structure

```
Intezo-master/
├── backend-intezo/
│   └── .env                    ← Supports both (no change needed)
│
├── clinic_dashboard/
│   ├── .env                    ← Active config (copy from templates)
│   ├── .env.domain            ← Domain template
│   └── .env.ipv4              ← IPv4 template
│
└── mobile_app/
    ├── .env                    ← Active config (copy from templates)
    ├── .env.domain            ← Domain template
    └── .env.ipv4              ← IPv4 template
```

---

## 🎯 Best Practices

1. **Keep Templates Updated**
   - Never delete `.env.domain` or `.env.ipv4`
   - Update templates when URLs change

2. **Git Ignore**
   - `.env` is in `.gitignore`
   - Never commit `.env` files
   - Only commit template files

3. **Testing Workflow**
   - Use IPv4 for local development
   - Use domain for production testing
   - Test both configurations before deployment

4. **Documentation**
   - Document any custom URLs
   - Update this README if IPv4 changes
   - Keep team informed of configuration changes

---

## 🔐 Security Checklist

- [ ] Never expose `.env` files publicly
- [ ] Use HTTPS (domain) for production
- [ ] Use HTTP (IPv4) only on trusted networks
- [ ] Keep tokens and secrets secure
- [ ] Don't share `.env` contents
- [ ] Rotate credentials regularly

---

## 📞 Support

If you encounter issues:

1. Check this README first
2. Verify `.env` files are correct
3. Restart all services
4. Check console logs for errors
5. Verify network connectivity

---

## 🎉 Quick Reference

### Switch to Domain
```bash
# Web
cd clinic_dashboard && copy .env.domain .env && npm start

# Mobile
cd mobile_app && copy .env.domain .env && flutter pub get && flutter run
```

### Switch to IPv4
```bash
# Web
cd clinic_dashboard && copy .env.ipv4 .env && npm start

# Mobile
cd mobile_app && copy .env.ipv4 .env && flutter pub get && flutter run
```

---

**Last Updated:** 2024
**Version:** 1.0.0
**Maintained By:** Intezo Development Team

---

## ✨ Summary

- ✅ Backend supports both simultaneously
- ✅ Web & Mobile use `.env` templates
- ✅ Just copy the template you need
- ✅ Restart the app
- ✅ Everything works!

**That's it! Simple configuration switching with environment variables.** 🚀
