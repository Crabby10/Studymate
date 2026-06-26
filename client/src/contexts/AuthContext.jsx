import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Config check
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId
);

let authInstance = null;

if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    console.log('🔥 Firebase Auth service initialized.');
  } catch (error) {
    console.warn('⚠️ Firebase Auth failed to initialize, using Mock Auth instead.', error.message);
  }
} else {
  console.log('💾 Firebase Config not found. Using Mock Authentication.');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(!authInstance);

  useEffect(() => {
    if (authInstance) {
      // Firebase listener
      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          try {
            const tokenId = await user.getIdToken();
            setToken(tokenId);
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0]
            });
          } catch (e) {
            console.error('Error fetching auth token', e);
          }
        } else {
          setCurrentUser(null);
          setToken(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Mock listener
      const mockUser = localStorage.getItem('studymate_mock_user');
      if (mockUser) {
        const parsed = JSON.parse(mockUser);
        setCurrentUser(parsed);
        setToken(`mock-token-${parsed.uid}`);
      }
      setLoading(false);
    }
  }, []);

  // Login
  async function login(email, password) {
    if (authInstance) {
      const credential = await signInWithEmailAndPassword(authInstance, email, password);
      const tokenId = await credential.user.getIdToken();
      setToken(tokenId);
      return credential.user;
    } else {
      // Mock login
      const mockUserDb = JSON.parse(localStorage.getItem('studymate_mock_users_db') || '[]');
      const user = mockUserDb.find(u => u.email === email && u.password === password);
      if (!user) {
        throw new Error('Invalid email or password');
      }
      const activeUser = { uid: user.uid, email: user.email, displayName: user.displayName };
      localStorage.setItem('studymate_mock_user', JSON.stringify(activeUser));
      setCurrentUser(activeUser);
      setToken(`mock-token-${activeUser.uid}`);
      return activeUser;
    }
  }

  // Signup
  async function signUp(email, password, displayName) {
    if (authInstance) {
      const credential = await createUserWithEmailAndPassword(authInstance, email, password);
      await updateProfile(credential.user, { displayName });
      const tokenId = await credential.user.getIdToken();
      setToken(tokenId);
      return credential.user;
    } else {
      // Mock signup
      const mockUsersDb = JSON.parse(localStorage.getItem('studymate_mock_users_db') || '[]');
      if (mockUsersDb.some(u => u.email === email)) {
        throw new Error('Email already in use');
      }
      
      const newUid = `user-${Date.now()}`;
      const newUser = { uid: newUid, email, password, displayName };
      mockUsersDb.push(newUser);
      localStorage.setItem('studymate_mock_users_db', JSON.stringify(mockUsersDb));

      const activeUser = { uid: newUid, email, displayName };
      localStorage.setItem('studymate_mock_user', JSON.stringify(activeUser));
      setCurrentUser(activeUser);
      setToken(`mock-token-${activeUser.uid}`);
      return activeUser;
    }
  }

  // Logout
  async function logout() {
    if (authInstance) {
      await signOut(authInstance);
      setToken(null);
      setCurrentUser(null);
    } else {
      localStorage.removeItem('studymate_mock_user');
      setToken(null);
      setCurrentUser(null);
    }
  }

  const value = {
    currentUser,
    token,
    isDemoMode,
    login,
    signUp,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
