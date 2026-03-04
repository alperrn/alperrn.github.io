import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, 
    updatePassword, setPersistence, browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, 
    deleteDoc, doc, updateDoc, setDoc, getDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// --- FİREBASE BAĞLANTISI ---
const firebaseConfig = {
    apiKey: "AIzaSyDMnxRHS_WcdseegpSs6M_E5bOLUYOwQq4",
    authDomain: "yks-sayac-al314.firebaseapp.com",
    projectId: "yks-sayac-al314",
    storageBucket: "yks-sayac-al314.firebasestorage.app",
    messagingSenderId: "132997440207",
    appId: "1:132997440207:web:35f664d6be917a0a254dba"
};
// İnternet kontrol fonksiyonu
const isOnline = () => navigator.onLine;

// Örnek: saveRecordToCloud fonksiyonunun başına ekle
window.saveRecordToCloud = async function(type, durationStr) {
    if(!isOnline()) {
        console.log("Çevrimdışı: Veri buluta kaydedilemedi ancak sayaç çalışmaya devam eder.");
        return; 
    }
    // ... mevcut kodların devamı
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Oturumun kalıcı olmasını sağlar
setPersistence(auth, browserLocalPersistence);

// --- GLOBAL DEĞİŞKENLER VE GİRİŞ ÇIKIŞ ---
window.yksAuth = auth;
window.yksSignIn = signInWithEmailAndPassword;

window.yksGoogleLogin = function() { 
    return signInWithPopup(auth, googleProvider); 
};

window.yksLogout = function() { 
    signOut(auth).then(() => { 
        localStorage.clear(); 
        window.location.href = "login.html"; 
    }); 
};

const badPasswords = ["123456", "password", "123456789", "12345", "12345678", "111111", "123123", "1234567890", "1234567", "qwerty", "admin123"];

window.formatName = function(nameStr) { 
    return nameStr.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '); 
};

// --- 1. KAYIT VE PROFİL İŞLEMLERİ ---
window.yksRegisterWithRole = async function(email, password, firstName, lastName, role) {
    if (badPasswords.includes(password.toLowerCase())) {
        throw new Error("Bu şifre çok yaygın, lütfen daha güvenli bir şifre seçin!");
    }
    const fullName = window.formatName(firstName) + " " + window.formatName(lastName);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), { 
            name: fullName, 
            email: email, 
            role: role, 
            teacherId: null, 
            isPremium: false, 
            maxStudents: 2 
        });
        return userCredential.user;
    } catch (error) { 
        throw error; 
    }
};

window.yksUpdateProfile = async function(newName) {
    const user = auth.currentUser; 
    if(!user) return false;
    
    const formattedName = window.formatName(newName);
    try { 
        await updateDoc(doc(db, "users", user.uid), { name: formattedName }); 
        localStorage.setItem('userName', formattedName); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

window.yksUpdatePassword = async function(newPassword) {
    if (badPasswords.includes(newPassword.toLowerCase())) {
        throw new Error("Bu şifre çok yaygın!");
    }
    try { 
        await updatePassword(auth.currentUser, newPassword); 
        return true; 
    } catch(e) { 
        throw e; 
    }
};

// --- 2. BİLDİRİM VE DUYURU SİSTEMİ ---
window.sendNotification = async function(toUid, message, senderName) {
    const d = new Date(); 
    const dateStr = d.toLocaleDateString('tr-TR') + " " + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
    try { 
        await addDoc(collection(db, "notifications"), { 
            toUid: toUid, 
            message: message, 
            sender: senderName, 
            date: dateStr, 
            timestamp: d.getTime() 
        }); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

window.sendBulkNotification = async function(studentIdsArray, message, senderName) {
    const batch = writeBatch(db); 
    const d = new Date(); 
    const dateStr = d.toLocaleDateString('tr-TR') + " " + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
    
    studentIdsArray.forEach(uid => { 
        const docRef = doc(collection(db, "notifications")); 
        batch.set(docRef, { 
            toUid: uid, 
            message: message, 
            sender: senderName, 
            date: dateStr, 
            timestamp: d.getTime() 
        }); 
    });
    
    try { 
        await batch.commit(); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

window.getNotifications = async function() {
    const user = auth.currentUser;
    try {
        let q;
        if (user) {
            q = query(collection(db, "notifications"), where("toUid", "in", [user.uid, "all"]));
        } else {
            q = query(collection(db, "notifications"), where("toUid", "==", "all"));
        }
        
        const snapshot = await getDocs(q); 
        let notifs = [];
        snapshot.forEach(doc => {
            notifs.push({ id: doc.id, ...doc.data() });
        }); 
        return notifs.sort((a, b) => b.timestamp - a.timestamp);
    } catch(e) { 
        console.error(e); 
        return []; 
    }
};

window.clearAllNotifications = async function() {
    try { 
        const q = query(collection(db, "notifications")); 
        const snapshot = await getDocs(q); 
        snapshot.forEach(async (document) => { 
            await deleteDoc(doc(db, "notifications", document.id)); 
        }); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

// --- 3. UI, MODAL VE ZİYARETÇİ KONTROLÜ ---
window.injectAuthModal = function() {
    if(document.getElementById('customAuthModal')) return; 
    
    const modalHtml = `
        <div class="custom-auth-modal" id="customAuthModal">
            <div class="custom-auth-content">
                <span class="auth-modal-icon">🚀</span>
                <h2 style="margin-bottom: 0.5rem; color: var(--btn-bg);">Aramıza Katıl!</h2>
                <p style="opacity: 0.8; font-size: 0.95rem;">Bu aracı kullanabilmek ve verilerini güvenle buluta kaydetmek için ücretsiz bir hesaba ihtiyacın var.</p>
                <div class="auth-modal-btns">
                    <button class="btn" style="background: transparent; color: var(--text-color); border: 2px solid var(--border-color);" onclick="closeAuthModal()">Vazgeç</button>
                    <button class="btn" onclick="window.location.href='login.html'">Hemen Kayıt Ol</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeAuthModal = function() { 
    const m = document.getElementById('customAuthModal'); 
    if(m) {
        m.classList.remove('active'); 
    }
};

document.addEventListener('click', (e) => { 
    const target = e.target.closest('.req-auth'); 
    if(target) { 
        if(localStorage.getItem('isLoggedIn') !== 'true') { 
            e.preventDefault(); 
            window.injectAuthModal(); 
            setTimeout(() => { 
                document.getElementById('customAuthModal').classList.add('active'); 
            }, 10); 
        } 
    } 
});

window.initTheme = function() { 
    if (localStorage.getItem('yksTheme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark'); 
    }
};

window.toggleTheme = function() { 
    if (document.documentElement.getAttribute('data-theme') === 'dark') { 
        document.documentElement.removeAttribute('data-theme'); 
        localStorage.setItem('yksTheme', 'light'); 
    } else { 
        document.documentElement.setAttribute('data-theme', 'dark'); 
        localStorage.setItem('yksTheme', 'dark'); 
    } 
};

window.toggleMenu = function() { 
    document.getElementById('sideMenu').classList.toggle('open'); 
};

window.formatTime = function(seconds) { 
    const h = Math.floor(seconds / 3600); 
    const m = Math.floor((seconds % 3600) / 60); 
    const s = seconds % 60; 
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
};

window.updateProfileAvatar = function() {
    const pBtn = document.getElementById('profileBtnText');
    if(pBtn) {
        pBtn.textContent = (localStorage.getItem('isLoggedIn') === 'true') ? (localStorage.getItem('userName') || "A").charAt(0).toUpperCase() : "?";
        
        if(localStorage.getItem('isPremium') === 'true' || localStorage.getItem('userRole') === 'admin') {
            pBtn.parentElement.classList.add('is-premium');
        } else {
            pBtn.parentElement.classList.remove('is-premium');
        }
    }
};

function applyRoleUI(role) {
    const authLink = document.getElementById('authLink');
    if(role === 'teacher') { 
        document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none'); 
        document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'block'); 
        if(authLink) authLink.style.display = 'none'; 
    } else if (role === 'student') { 
        document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'none'); 
        document.querySelectorAll('.student-only').forEach(el => el.style.display = 'block'); 
        if(authLink) authLink.style.display = 'none'; 
    } else if (role === 'admin') { 
        document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'block'); 
        document.querySelectorAll('.student-only').forEach(el => el.style.display = 'block'); 
        if(authLink) authLink.style.display = 'none'; 
    } else { 
        document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'none'); 
        document.querySelectorAll('.student-only').forEach(el => el.style.display = 'block'); 
        if(authLink) authLink.style.display = 'block'; 
    }
}

// --- 4. OTURUM YÖNETİMİ VE SÜRE KONTROLÜ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        localStorage.setItem('isLoggedIn', 'true');
        
        if(user.email === 'admin@yksistasyonu.com') { 
            localStorage.setItem('userRole', 'admin'); 
            localStorage.setItem('userName', 'Sistem Yöneticisi'); 
            localStorage.setItem('isPremium', 'true'); 
            applyRoleUI('admin'); 
            window.updateProfileAvatar(); 
            
            if(window.loadCodes) window.loadCodes();
            if(window.loadFeedbacks) window.loadFeedbacks();
            return; 
        }

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                let isPrem = userData.isPremium || false;
                let maxSt = userData.maxStudents || 2;

                if (isPrem && userData.premiumUntil && new Date().getTime() > userData.premiumUntil) {
                    isPrem = false; 
                    maxSt = 2;
                    await updateDoc(doc(db, "users", user.uid), { 
                        isPremium: false, 
                        maxStudents: 2, 
                        premiumUntil: null 
                    });
                    alert("⚠️ Premium üyeliğinizin süresi dolmuştur. Öğrenci limitiniz 2'ye düşürüldü.");
                }

                localStorage.setItem('userRole', userData.role); 
                localStorage.setItem('userName', userData.name); 
                localStorage.setItem('isPremium', isPrem); 
                applyRoleUI(userData.role);
            } else { 
                window.yksLogout(); 
                return; 
            }
        } catch(e) { 
            console.error("Oturum hatası:", e); 
        }
        
        window.updateProfileAvatar(); 
        if(window.loadCustomPageData) window.loadCustomPageData(); 
        if(window.loadRecords) window.loadRecords(); 
        if(window.loadExams) window.loadExams();
    } else { 
        localStorage.setItem('isLoggedIn', 'false'); 
        localStorage.removeItem('userRole'); 
        localStorage.removeItem('userName'); 
        localStorage.removeItem('isPremium'); 
        applyRoleUI('guest'); 
        window.updateProfileAvatar(); 
        
        if(window.loadCustomPageData) window.loadCustomPageData();
    }
});

// --- 5. VERİTABANI: KAYITLAR VE DENEMELER ---
window.saveRecordToCloud = async function(type, durationStr) { 
    const d = new Date(); 
    const dateStr = d.toLocaleDateString('tr-TR') + " " + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}); 
    const user = auth.currentUser; 
    
    if (user) { 
        try { 
            await addDoc(collection(db, "records"), { 
                uid: user.uid, 
                type: type, 
                date: dateStr, 
                duration: durationStr, 
                timestamp: d.getTime() 
            }); 
        } catch (e) { 
            console.error(e); 
        } 
    } 
};

window.getCloudRecords = async function(targetUid) { 
    const user = auth.currentUser; 
    if(!user) return []; 
    
    const fetchUid = targetUid || user.uid; 
    try { 
        const q = query(collection(db, "records"), where("uid", "==", fetchUid)); 
        const snapshot = await getDocs(q); 
        let records = []; 
        snapshot.forEach((doc) => { 
            records.push({ id: doc.id, ...doc.data() }); 
        }); 
        return records.sort((a, b) => b.timestamp - a.timestamp); 
    } catch (e) { 
        return []; 
    } 
};

window.clearCloudRecords = async function() { 
    const user = auth.currentUser; 
    if(!user) return; 
    
    const q = query(collection(db, "records"), where("uid", "==", user.uid)); 
    const snapshot = await getDocs(q); 
    snapshot.forEach(async (document) => { 
        await deleteDoc(doc(db, "records", document.id)); 
    }); 
};

window.saveExamToCloud = async function(examData) { 
    const user = auth.currentUser; 
    if (user) { 
        try { 
            await addDoc(collection(db, "exams"), { 
                uid: user.uid, 
                ...examData, 
                timestamp: new Date().getTime() 
            }); 
        } catch (e) { 
            console.error(e); 
        } 
    } else { 
        window.location.href = "login.html"; 
    } 
};

window.getCloudExams = async function(targetUid) { 
    const user = auth.currentUser; 
    if(!user) return []; 
    
    const fetchUid = targetUid || user.uid; 
    const q = query(collection(db, "exams"), where("uid", "==", fetchUid)); 
    const snapshot = await getDocs(q); 
    let exams = []; 
    snapshot.forEach((doc) => { 
        exams.push({ id: doc.id, ...doc.data() }); 
    }); 
    return exams.sort((a, b) => b.timestamp - a.timestamp); 
};

window.deleteCloudExam = async function(id) { 
    await deleteDoc(doc(db, "exams", id)); 
};

window.updateCloudExam = async function(id, examData) { 
    await updateDoc(doc(db, "exams", id), examData); 
};

// --- 6. KOÇLUK SİSTEMİ VE ÖĞRENCİ LİMİTİ ---
window.linkToTeacher = async function(teacherUid) { 
    const user = auth.currentUser; 
    if(!user) return false; 
    
    try { 
        const teacherDoc = await getDoc(doc(db, "users", teacherUid)); 
        if(teacherDoc.exists() && teacherDoc.data().role === 'teacher') { 
            const q = query(collection(db, "users"), where("teacherId", "==", teacherUid));
            const snapshot = await getDocs(q);
            const maxAllowed = teacherDoc.data().maxStudents || 2;

            if(snapshot.size >= maxAllowed) {
                alert(`❌ BAĞLANTI BAŞARISIZ: Rehber öğretmeninizin ${maxAllowed} kişilik öğrenci kapasitesi dolmuştur.`); 
                return false;
            }
            
            await updateDoc(doc(db, "users", user.uid), { teacherId: teacherUid }); 
            return true; 
        } 
        return false; 
    } catch(e) { 
        return false; 
    } 
};

window.getMyStudents = async function() { 
    const user = auth.currentUser; 
    if(!user) return []; 
    
    const q = query(collection(db, "users"), where("teacherId", "==", user.uid)); 
    const snapshot = await getDocs(q); 
    let students = []; 
    snapshot.forEach(doc => {
        students.push({ id: doc.id, ...doc.data() });
    }); 
    return students; 
};

window.addTask = async function(studentId, date, description) { 
    const teacher = auth.currentUser; 
    if(!teacher) return; 
    
    await addDoc(collection(db, "tasks"), { 
        teacherId: teacher.uid, 
        studentId: studentId, 
        date: date, 
        description: description, 
        completed: false, 
        timestamp: new Date().getTime() 
    }); 
};

window.getTasks = async function(studentId) { 
    const targetUid = studentId || auth.currentUser.uid; 
    const q = query(collection(db, "tasks"), where("studentId", "==", targetUid)); 
    const snapshot = await getDocs(q); 
    let tasks = []; 
    snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
    }); 
    return tasks; 
};

window.toggleTaskStatus = async function(taskId, isCompleted) { 
    await updateDoc(doc(db, "tasks", taskId), { completed: isCompleted }); 
};

window.deleteTask = async function(taskId) { 
    try { 
        await deleteDoc(doc(db, "tasks", taskId)); 
        return true; 
    } catch(e) { 
        return false; 
    } 
};

window.getUserData = async function() { 
    const user = auth.currentUser; 
    if(!user) return null; 
    
    const userDoc = await getDoc(doc(db, "users", user.uid)); 
    return userDoc.exists() ? userDoc.data() : null; 
};

// --- 7. PREMIUM KOD ÜRETİM VE ONAY SİSTEMİ ---
// --- 7. PREMIUM KOD ÜRETİM VE ONAY SİSTEMİ (GÜNCELLENDİ) ---
window.generatePremiumCode = async function(maxSt, premiumDays, companyName) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    try { 
        await setDoc(doc(db, "premium_codes", code), { 
            isUsed: false, 
            isActive: true, 
            createdAt: new Date().getTime(), 
            usedBy: null, 
            maxStudents: parseInt(maxSt), 
            premiumDays: parseInt(premiumDays) || 0,
            company: companyName || "Bireysel Satış" // Firma bilgisi ekledik
        }); 
        return code; 
    } catch(e) { 
        return null; 
    }
};

window.deactivatePremiumCode = async function(codeStr) {
    try { 
        await updateDoc(doc(db, "premium_codes", codeStr), { isActive: false }); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

window.getPremiumCodes = async function() {
    try { 
        const q = query(collection(db, "premium_codes")); 
        const snap = await getDocs(q); 
        let codes = []; 
        snap.forEach(doc => {
            codes.push({ id: doc.id, ...doc.data() });
        }); 
        return codes.sort((a,b) => b.createdAt - a.createdAt); 
    } catch(e) { 
        return []; 
    }
};

window.redeemPremiumCode = async function(codeStr) {
    const user = auth.currentUser; 
    if(!user) return false;
    
    try {
        const codeRef = doc(db, "premium_codes", codeStr.toUpperCase()); 
        const codeSnap = await getDoc(codeRef);
        
        if(codeSnap.exists() && codeSnap.data().isUsed === false && codeSnap.data().isActive !== false) {
            const codeData = codeSnap.data();
            const newMax = codeData.maxStudents || 50; 
            const days = codeData.premiumDays || 0;
            
            let premiumUntil = null;
            if (days > 0) { 
                premiumUntil = new Date().getTime() + (days * 24 * 60 * 60 * 1000); 
            }
            
            await updateDoc(codeRef, { 
                isUsed: true, 
                usedBy: user.uid, 
                usedAt: new Date().getTime() 
            });
            
            await updateDoc(doc(db, "users", user.uid), { 
                isPremium: true, 
                maxStudents: newMax, 
                premiumUntil: premiumUntil 
            });
            
            localStorage.setItem('isPremium', 'true'); 
            window.updateProfileAvatar(); 
            return true;
        }
        return false; 
    } catch(e) { 
        return false; 
    }
};

// --- 8. İSTEK VE ÖNERİ (FEEDBACK) SİSTEMİ ---
window.submitFeedback = async function(message) {
    const user = auth.currentUser; 
    if(!user) return false;
    
    const userName = localStorage.getItem('userName') || 'Bilinmeyen Kullanıcı';
    const userEmail = localStorage.getItem('userEmail') || user.email;
    const d = new Date(); 
    const dateStr = d.toLocaleDateString('tr-TR') + " " + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
    
    try { 
        await addDoc(collection(db, "feedbacks"), { 
            uid: user.uid, 
            name: userName, 
            email: userEmail, 
            message: message, 
            date: dateStr, 
            timestamp: d.getTime() 
        }); 
        return true; 
    } catch(e) { 
        console.error(e); 
        return false; 
    }
};

window.getFeedbacks = async function() {
    try { 
        const q = query(collection(db, "feedbacks")); 
        const snap = await getDocs(q); 
        let feedbacks = []; 
        snap.forEach(doc => {
            feedbacks.push({ id: doc.id, ...doc.data() });
        }); 
        return feedbacks.sort((a,b) => b.timestamp - a.timestamp); 
    } catch(e) { 
        return []; 
    }
};

window.deleteFeedback = async function(id) {
    try { 
        await deleteDoc(doc(db, "feedbacks", id)); 
        return true; 
    } catch(e) { 
        return false; 
    }
};

// --- BAŞLANGIÇ YÜKLEMELERİ ---
window.addEventListener('DOMContentLoaded', () => { 
    window.initTheme(); 
    window.updateProfileAvatar(); 
    window.injectAuthModal(); 
});