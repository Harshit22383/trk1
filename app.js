import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteField, onSnapshot, arrayUnion, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: window.ENV?.FIREBASE_API_KEY || '',
    authDomain: window.ENV?.FIREBASE_PROJECT_ID ? `${window.ENV.FIREBASE_PROJECT_ID}.firebaseapp.com` : '',
    projectId: window.ENV?.FIREBASE_PROJECT_ID || '',
    storageBucket: window.ENV?.FIREBASE_PROJECT_ID ? `${window.ENV.FIREBASE_PROJECT_ID}.firebasestorage.app` : '',
    appId: window.ENV?.FIREBASE_APP_ID || ''
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let locationWatchId = null;
let currentLocation = null;
let sosTimeout = null;
let locationHistory = [];
const MAX_HISTORY_DISTANCE = 50;
let geofences = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeTouristApp();
});

function initializeTouristApp() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUserData(user);
        } else {
            currentUser = null;
            showLogin();
        }
    });

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegisterLink').addEventListener('click', showRegister);
    document.getElementById('showLoginLink').addEventListener('click', showLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addContactBtn').addEventListener('click', showAddContactModal);
    document.getElementById('cancelAddContactBtn').addEventListener('click', hideAddContactModal);
    document.getElementById('addContactForm').addEventListener('submit', handleAddContact);
    document.getElementById('refreshLocationBtn').addEventListener('click', getCurrentLocation);
    document.getElementById('addGeofenceBtn').addEventListener('click', showAddGeofenceModal);
    document.getElementById('cancelAddGeofenceBtn').addEventListener('click', hideAddGeofenceModal);
    document.getElementById('addGeofenceForm').addEventListener('submit', handleAddGeofence);
    document.getElementById('viewHistoryBtn').addEventListener('click', showLocationHistory);
    document.getElementById('closeHistoryBtn').addEventListener('click', hideLocationHistory);

    const sosBtn = document.getElementById('sosBtn');
    sosBtn.addEventListener('mousedown', startSOSTimer);
    sosBtn.addEventListener('mouseup', cancelSOSTimer);
    sosBtn.addEventListener('mouseleave', cancelSOSTimer);
    sosBtn.addEventListener('touchstart', startSOSTimer);
    sosBtn.addEventListener('touchend', cancelSOSTimer);

    initBatteryMonitoring();
}

async function loadUserData(user) {
    currentUser = user;
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        const userData = userDoc.data();
        currentUser.name = userData.name;
        currentUser.phone = userData.phone;
        
        onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                locationHistory = data.locationHistory || [];
                geofences = data.geofences || [];
                loadContacts();
                loadGeofences();
                updateLocationHistoryDisplay();
            }
        });
    }
    
    showDashboard();
}

function showScreen(screenId) {
    const screens = ['loginScreen', 'registerScreen', 'dashboardScreen', 'addContactModal', 'addGeofenceModal', 'locationHistoryModal'];
    screens.forEach(screen => {
        document.getElementById(screen).classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showLogin() {
    showScreen('loginScreen');
}

function showRegister() {
    showScreen('registerScreen');
}

function showDashboard() {
    showScreen('dashboardScreen');
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name || currentUser.email;
        document.getElementById('userEmail').textContent = currentUser.email;
        loadContacts();
        loadGeofences();
        startLocationTracking();
        updateLocationHistoryDisplay();
    }
}

function showAddContactModal() {
    showScreen('addContactModal');
}

function hideAddContactModal() {
    document.getElementById('addContactForm').reset();
    showDashboard();
}

function showAddGeofenceModal() {
    showScreen('addGeofenceModal');
}

function hideAddGeofenceModal() {
    document.getElementById('addGeofenceForm').reset();
    showDashboard();
}

function showLocationHistory() {
    showScreen('locationHistoryModal');
}

function hideLocationHistory() {
    showDashboard();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorDiv.classList.add('hidden');
        document.getElementById('loginForm').reset();
    } catch (error) {
        errorDiv.textContent = error.message || 'Invalid email or password';
        errorDiv.classList.remove('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            name,
            email,
            phone,
            contacts: [],
            locationHistory: [],
            geofences: [],
            createdAt: serverTimestamp()
        });

        errorDiv.classList.add('hidden');
        successDiv.textContent = 'Registration successful! Logging you in...';
        successDiv.classList.remove('hidden');
        document.getElementById('registerForm').reset();

        setTimeout(() => {
            successDiv.classList.add('hidden');
        }, 2000);
    } catch (error) {
        errorDiv.textContent = error.message || 'Registration failed';
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
    }
}

async function handleLogout() {
    stopLocationTracking();
    await signOut(auth);
    showLogin();
}

async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        const contacts = userDoc.data().contacts || [];
        
        if (contacts.length === 0) {
            contactsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📞</div>
                    <p>No SOS contacts added yet.<br>Add trusted contacts for emergency situations.</p>
                </div>
            `;
        } else {
            contactsList.innerHTML = contacts.map((contact, index) => `
                <div class="contact-card">
                    <div class="contact-info">
                        <h3>${contact.name}</h3>
                        <p>${contact.phone} &bull; ${contact.relation}</p>
                    </div>
                    <button class="btn btn--secondary btn--small" onclick="window.removeContact(${index})">Remove</button>
                </div>
            `).join('');
        }
    }
}

async function handleAddContact(e) {
    e.preventDefault();
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const relation = document.getElementById('contactRelation').value;

    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
        contacts: arrayUnion({ name, phone, relation })
    });

    hideAddContactModal();
    loadContacts();
}

window.removeContact = async function(index) {
    if (confirm('Are you sure you want to remove this contact?')) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const contacts = userDoc.data().contacts || [];
        contacts.splice(index, 1);
        await updateDoc(userDocRef, { contacts });
        loadContacts();
    }
};

async function loadGeofences() {
    const geofencesList = document.getElementById('geofencesList');
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        geofences = userDoc.data().geofences || [];
        
        if (geofences.length === 0) {
            geofencesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🗺️</div>
                    <p>No geo-fences added yet.<br>Set safe zones to get notified if you leave.</p>
                </div>
            `;
        } else {
            geofencesList.innerHTML = geofences.map((fence, index) => `
                <div class="geofence-item">
                    <div class="geofence-info">
                        <h3>${fence.name}</h3>
                        <p>Radius: ${fence.radius}m • ${fence.active ? '<span class="status-badge">Active</span>' : '<span class="status-badge--warning">Inactive</span>'}</p>
                    </div>
                    <button class="btn btn--secondary btn--small" onclick="window.removeGeofence(${index})">Remove</button>
                </div>
            `).join('');
        }
    }
}

async function handleAddGeofence(e) {
    e.preventDefault();
    const name = document.getElementById('geofenceName').value;
    const radius = parseInt(document.getElementById('geofenceRadius').value);

    if (!currentLocation) {
        alert('Please wait for location to be available');
        return;
    }

    const fence = {
        name,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius,
        active: true,
        createdAt: new Date().toISOString()
    };

    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
        geofences: arrayUnion(fence)
    });

    hideAddGeofenceModal();
    loadGeofences();
}

window.removeGeofence = async function(index) {
    if (confirm('Are you sure you want to remove this geo-fence?')) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const fences = userDoc.data().geofences || [];
        fences.splice(index, 1);
        await updateDoc(userDocRef, { geofences: fences });
        loadGeofences();
    }
};

function startLocationTracking() {
    if ('geolocation' in navigator) {
        getCurrentLocation();
        locationWatchId = navigator.geolocation.watchPosition(
            updateLocation,
            handleLocationError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        document.getElementById('locationCoords').textContent = 'Geolocation not supported by your browser';
    }
}

function stopLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
}

function getCurrentLocation() {
    if ('geolocation' in navigator) {
        document.getElementById('locationCoords').textContent = 'Getting location...';
        navigator.geolocation.getCurrentPosition(updateLocation, handleLocationError);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getTotalHistoryDistance() {
    let totalDistance = 0;
    for (let i = 1; i < locationHistory.length; i++) {
        const prev = locationHistory[i - 1];
        const curr = locationHistory[i];
        totalDistance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return totalDistance;
}

async function updateLocation(position) {
    const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
    };

    let shouldAddToHistory = false;
    
    if (locationHistory.length === 0) {
        shouldAddToHistory = true;
    } else {
        const lastLocation = locationHistory[locationHistory.length - 1];
        const distance = calculateDistance(
            lastLocation.latitude,
            lastLocation.longitude,
            newLocation.latitude,
            newLocation.longitude
        );
        
        if (distance >= 0.05) {
            shouldAddToHistory = true;
        }
    }

    if (shouldAddToHistory) {
        locationHistory.push(newLocation);
        
        while (getTotalHistoryDistance() > MAX_HISTORY_DISTANCE && locationHistory.length > 1) {
            locationHistory.shift();
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
            locationHistory: locationHistory
        });
    }

    currentLocation = newLocation;

    const coordsDiv = document.getElementById('locationCoords');
    coordsDiv.innerHTML = `
        <strong>Latitude:</strong> ${currentLocation.latitude.toFixed(6)}<br>
        <strong>Longitude:</strong> ${currentLocation.longitude.toFixed(6)}<br>
        <strong>Accuracy:</strong> ±${Math.round(currentLocation.accuracy)}m<br>
        <strong>History:</strong> ${getTotalHistoryDistance().toFixed(2)} km tracked<br>
        <strong>Maps:</strong> <a href="https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary);">View on Google Maps</a>
    `;

    checkGeofences(newLocation);
    updateLocationHistoryDisplay();
}

function checkGeofences(location) {
    geofences.forEach(fence => {
        if (!fence.active) return;
        
        const distance = calculateDistance(
            fence.latitude,
            fence.longitude,
            location.latitude,
            location.longitude
        ) * 1000;
        
        if (distance > fence.radius) {
            showGeofenceAlert(fence, distance);
        }
    });
}

function showGeofenceAlert(fence, distance) {
    const message = `⚠️ GEO-FENCE ALERT!\n\nYou have left the safe zone: ${fence.name}\nDistance from center: ${Math.round(distance)}m`;
    alert(message);
}

function updateLocationHistoryDisplay() {
    const historyList = document.getElementById('locationHistoryList');
    
    if (locationHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📍</div>
                <p>No location history yet.<br>Your location will be tracked as you move.</p>
            </div>
        `;
    } else {
        const reversedHistory = [...locationHistory].reverse();
        historyList.innerHTML = reversedHistory.slice(0, 50).map(loc => {
            const date = new Date(loc.timestamp);
            return `
                <div class="history-item">
                    <div>Lat: ${loc.latitude.toFixed(6)}, Lon: ${loc.longitude.toFixed(6)}</div>
                    <div class="history-item-time">${date.toLocaleString()}</div>
                </div>
            `;
        }).join('');
    }
}

function handleLocationError(error) {
    let message = 'Unable to retrieve location';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out';
            break;
    }
    document.getElementById('locationCoords').textContent = message;
}

function startSOSTimer() {
    sosTimeout = setTimeout(() => {
        activateSOS();
    }, 2000);
}

function cancelSOSTimer() {
    if (sosTimeout) {
        clearTimeout(sosTimeout);
        sosTimeout = null;
    }
}

async function activateSOS() {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    const contacts = userDoc.data().contacts || [];

    let alertMessage = '🚨 EMERGENCY SOS ACTIVATED 🚨\n\n';
    alertMessage += `User: ${currentUser.name || currentUser.email}\n`;
    alertMessage += `Phone: ${currentUser.phone || 'N/A'}\n\n`;

    if (currentLocation) {
        alertMessage += `Location:\nLat: ${currentLocation.latitude.toFixed(6)}\nLong: ${currentLocation.longitude.toFixed(6)}\n`;
        alertMessage += `Maps: https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}\n\n`;
    }

    if (contacts.length > 0) {
        alertMessage += 'Alerting SOS contacts:\n';
        contacts.forEach(contact => {
            alertMessage += `• ${contact.name} (${contact.phone})\n`;
            callContact(contact.phone, contact.name);
        });
    } else {
        alertMessage += 'No SOS contacts added.\n';
    }

    alertMessage += '\nAlso alerting emergency services...';
    alert(alertMessage);

    callEmergency('100', 'Police (Emergency)');
}

function callContact(phone, name) {
    if (confirm(`Call ${name} at ${phone}?`)) {
        window.location.href = `tel:${phone}`;
    }
}

window.callEmergency = function(number, service) {
    if (confirm(`Call ${service} (${number})?`)) {
        window.location.href = `tel:${number}`;
    }
};

function initBatteryMonitoring() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function (battery) {
            function showBatteryModal() {
                const modal = document.getElementById('battery-modal');
                if (battery.level <= 0.15) {
                    modal.style.display = 'flex';
                } else {
                    modal.style.display = 'none';
                }
            }
            
            function checkAndSendLocation() {
                if (battery.level <= 0.02 && currentLocation && currentUser) {
                    sendLocationToSOSContacts(currentLocation.latitude, currentLocation.longitude);
                }
            }
            
            showBatteryModal();
            battery.addEventListener('levelchange', showBatteryModal);
            battery.addEventListener('levelchange', checkAndSendLocation);
        });
    }
}

async function sendLocationToSOSContacts(latitude, longitude) {
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const contacts = userDoc.data().contacts || [];
        
        alert(`Critical Battery! Location sent to ${contacts.length} SOS contacts.\nLocation: https://www.google.com/maps?q=${latitude},${longitude}`);
    } catch (error) {
        console.error('Error sending location:', error);
    }
}
