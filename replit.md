# Tourist Raksha Kavach - Safety Companion App

## Overview
A comprehensive safety application for tourists featuring SOS alerts, location tracking, geo-fencing, and emergency services integration. Built with Firebase for secure data management and real-time synchronization.

## Features Implemented
1. **Firebase Authentication** - Email/password registration and login
2. **Location History Tracking** - Automatically tracks last 50km of travel
3. **Geo-Fencing** - Create safe zones and get alerts when leaving them
4. **SOS Emergency System** - Quick alert to emergency contacts and services
5. **Emergency Contacts Management** - Store and manage trusted contacts
6. **Battery Monitoring** - Auto-send location when battery is critically low
7. **Emergency Services Quick Dial** - One-tap access to Police, Ambulance, Fire, Women Helpline

## Recent Changes (November 23, 2025)
- Set up project with Node.js and Express server
- Integrated Firebase Authentication and Firestore
- Implemented location history tracking (last 50km)
- Added geo-fencing feature with customizable safe zones
- Organized code into proper structure (HTML, CSS, JS)
- Configured workflow to run on port 5000

## Project Architecture
```
/
├── server.js              # Express server serving static files on port 5000
├── public/
│   ├── index.html        # Main HTML with all app screens
│   ├── css/
│   │   └── styles.css    # All styling and theme variables
│   └── js/
│       └── app.js        # Firebase integration and app logic
├── package.json          # Dependencies (express, firebase)
└── replit.md            # This file
```

## Firebase Configuration Required
The app requires Firebase setup. You need to provide three environment variables:
1. `FIREBASE_API_KEY` - Your Firebase API key
2. `FIREBASE_PROJECT_ID` - Your Firebase project ID
3. `FIREBASE_APP_ID` - Your Firebase app ID

### Firebase Setup Steps:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Email/Password authentication in Authentication section
4. Create a Firestore database in production mode
5. Register a web app and copy the config values
6. Provide the three values mentioned above when requested

## Data Structure
The app stores data in Firestore with this structure:
```
users/{userId}
  - name: string
  - email: string
  - phone: string
  - contacts: array of {name, phone, relation}
  - locationHistory: array of {latitude, longitude, accuracy, timestamp}
  - geofences: array of {name, latitude, longitude, radius, active, createdAt}
  - createdAt: timestamp
```

## Location History
- Automatically tracks location changes greater than 50 meters
- Stores up to 50km of travel history
- Removes oldest points when total distance exceeds 50km
- All data synced to Firebase in real-time

## Geo-Fencing
- Create safe zones at current location
- Set custom radius (50m to 5km)
- Get alerts when leaving safe zones
- Activate/deactivate zones as needed

## User Preferences
- Clean, modern mobile-first design
- Dark mode support based on system preference
- Minimal, focused UI for emergency situations
- Real-time data synchronization across devices
