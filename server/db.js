import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const dbJsonPath = path.resolve('db.json');

// Initialize Local JSON database structure if it doesn't exist
if (!fs.existsSync(dbJsonPath)) {
  fs.writeFileSync(dbJsonPath, JSON.stringify({
    users: {},
    documents: {},
    chunks: {},
    chats: {},
    summaries: {},
    quizzes: {},
    stats: {}
  }, null, 2));
}

let useFirebase = false;

// Attempt to initialize Firebase Admin
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve('firebase-service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    useFirebase = true;
    console.log('🔥 Connected to Firebase Admin (via service account file)');
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    });
    useFirebase = true;
    console.log('🔥 Connected to Firebase Admin (via environment variables)');
  } else {
    console.log('💾 Running database in Demo Mode (Local JSON Storage: db.json)');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin failed to initialize, falling back to Local JSON Storage. Error:', error.message);
  useFirebase = false;
}

const firestore = useFirebase ? admin.firestore() : null;

// Helper to read local JSON
function readLocalDb() {
  try {
    const data = fs.readFileSync(dbJsonPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: {}, documents: {}, chunks: {}, chats: {}, summaries: {}, quizzes: {}, stats: {} };
  }
}

// Helper to write local JSON
function writeLocalDb(data) {
  fs.writeFileSync(dbJsonPath, JSON.stringify(data, null, 2));
}

// Database Abstraction Layer API
export const db = {
  // Check auth token
  verifyToken: async (token) => {
    if (!token) throw new Error('No token provided');
    
    if (useFirebase) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return { uid: decodedToken.uid, email: decodedToken.email };
      } catch (err) {
        throw new Error('Invalid token: ' + err.message);
      }
    } else {
      // In local mode, token is simply format 'mock-token-USER_ID'
      if (token.startsWith('mock-token-')) {
        const uid = token.replace('mock-token-', '');
        return { uid, email: `${uid}@studymate.mock` };
      }
      throw new Error('Invalid mock token format');
    }
  },

  // Document Methods
  getDocuments: async (userId) => {
    if (useFirebase) {
      const snapshot = await firestore.collection('documents')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const localDb = readLocalDb();
      return Object.values(localDb.documents)
        .filter(doc => doc.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  getDocument: async (userId, docId) => {
    if (useFirebase) {
      const doc = await firestore.collection('documents').doc(docId).get();
      if (!doc.exists) return null;
      const data = doc.data();
      if (data.userId !== userId) throw new Error('Unauthorized');
      return { id: doc.id, ...data };
    } else {
      const localDb = readLocalDb();
      const doc = localDb.documents[docId];
      if (!doc) return null;
      if (doc.userId !== userId) throw new Error('Unauthorized');
      return doc;
    }
  },

  saveDocument: async (userId, docId, documentData) => {
    const dataToSave = {
      id: docId,
      userId,
      ...documentData,
      createdAt: new Date().toISOString()
    };

    if (useFirebase) {
      await firestore.collection('documents').doc(docId).set(dataToSave);
      return dataToSave;
    } else {
      const localDb = readLocalDb();
      localDb.documents[docId] = dataToSave;
      writeLocalDb(localDb);
      return dataToSave;
    }
  },

  deleteDocument: async (userId, docId) => {
    // Verify document belongs to user
    await db.getDocument(userId, docId);

    if (useFirebase) {
      // Delete document
      await firestore.collection('documents').doc(docId).delete();
      
      // Delete subcollection chunks
      const chunksSnapshot = await firestore.collection('documents').doc(docId).collection('chunks').get();
      const batch = firestore.batch();
      chunksSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Delete associated summary and quiz if exists
      const summarySnap = await firestore.collection('summaries').where('docId', '==', docId).get();
      const quizSnap = await firestore.collection('quizzes').where('docId', '==', docId).get();
      
      const cleanBatch = firestore.batch();
      summarySnap.docs.forEach(doc => cleanBatch.delete(doc.ref));
      quizSnap.docs.forEach(doc => cleanBatch.delete(doc.ref));
      await cleanBatch.commit();
      
      return true;
    } else {
      const localDb = readLocalDb();
      
      // Delete doc
      delete localDb.documents[docId];
      
      // Delete chunks
      if (localDb.chunks[docId]) {
        delete localDb.chunks[docId];
      }
      
      // Delete summaries
      Object.keys(localDb.summaries).forEach(k => {
        if (localDb.summaries[k].docId === docId) {
          delete localDb.summaries[k];
        }
      });

      // Delete quizzes
      Object.keys(localDb.quizzes).forEach(k => {
        if (localDb.quizzes[k].docId === docId) {
          delete localDb.quizzes[k];
        }
      });
      
      writeLocalDb(localDb);
      return true;
    }
  },

  // Chunk Methods
  saveChunks: async (userId, docId, chunks) => {
    if (useFirebase) {
      const batch = firestore.batch();
      const docRef = firestore.collection('documents').doc(docId);
      
      chunks.forEach((chunk, index) => {
        const chunkRef = docRef.collection('chunks').doc(`chunk-${index}`);
        batch.set(chunkRef, {
          id: `chunk-${index}`,
          docId,
          userId,
          text: chunk,
          index
        });
      });
      await batch.commit();
    } else {
      const localDb = readLocalDb();
      localDb.chunks[docId] = chunks.map((chunk, index) => ({
        id: `chunk-${index}`,
        docId,
        userId,
        text: chunk,
        index
      }));
      writeLocalDb(localDb);
    }
  },

  getChunks: async (userId, docId) => {
    if (useFirebase) {
      const snapshot = await firestore.collection('documents').doc(docId).collection('chunks').orderBy('index', 'asc').get();
      return snapshot.docs.map(doc => doc.data());
    } else {
      const localDb = readLocalDb();
      return localDb.chunks[docId] || [];
    }
  },

  // Chats Methods
  getChats: async (userId) => {
    if (useFirebase) {
      const snapshot = await firestore.collection('chats')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const localDb = readLocalDb();
      return Object.values(localDb.chats)
        .filter(chat => chat.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  getChat: async (userId, chatId) => {
    if (useFirebase) {
      const doc = await firestore.collection('chats').doc(chatId).get();
      if (!doc.exists) return null;
      const data = doc.data();
      if (data.userId !== userId) throw new Error('Unauthorized');
      return { id: doc.id, ...data };
    } else {
      const localDb = readLocalDb();
      const chat = localDb.chats[chatId];
      if (!chat) return null;
      if (chat.userId !== userId) throw new Error('Unauthorized');
      return chat;
    }
  },

  saveChat: async (userId, chatId, chatData) => {
    const dataToSave = {
      id: chatId,
      userId,
      title: chatData.title || 'New Chat',
      documentIds: chatData.documentIds || [],
      messages: chatData.messages || [],
      createdAt: chatData.createdAt || new Date().toISOString()
    };

    if (useFirebase) {
      await firestore.collection('chats').doc(chatId).set(dataToSave);
      return dataToSave;
    } else {
      const localDb = readLocalDb();
      localDb.chats[chatId] = dataToSave;
      writeLocalDb(localDb);
      return dataToSave;
    }
  },

  deleteChat: async (userId, chatId) => {
    await db.getChat(userId, chatId); // verify auth
    if (useFirebase) {
      await firestore.collection('chats').doc(chatId).delete();
      return true;
    } else {
      const localDb = readLocalDb();
      delete localDb.chats[chatId];
      writeLocalDb(localDb);
      return true;
    }
  },

  // Summary Methods
  saveSummary: async (userId, docId, summaryText, studyDetails) => {
    const summaryId = `summary-${docId}`;
    const data = {
      id: summaryId,
      docId,
      userId,
      summary: summaryText,
      keyPoints: studyDetails.keyPoints || [],
      shortNotes: studyDetails.shortNotes || '',
      flashcards: studyDetails.flashcards || [],
      createdAt: new Date().toISOString()
    };

    if (useFirebase) {
      await firestore.collection('summaries').doc(summaryId).set(data);
      return data;
    } else {
      const localDb = readLocalDb();
      localDb.summaries[summaryId] = data;
      writeLocalDb(localDb);
      return data;
    }
  },

  getSummary: async (userId, docId) => {
    const summaryId = `summary-${docId}`;
    if (useFirebase) {
      const doc = await firestore.collection('summaries').doc(summaryId).get();
      return doc.exists ? doc.data() : null;
    } else {
      const localDb = readLocalDb();
      return localDb.summaries[summaryId] || null;
    }
  },

  // Quizzes Methods
  saveQuiz: async (userId, docId, questions) => {
    const quizId = `quiz-${docId}`;
    const data = {
      id: quizId,
      docId,
      userId,
      questions,
      createdAt: new Date().toISOString()
    };

    if (useFirebase) {
      await firestore.collection('quizzes').doc(quizId).set(data);
      return data;
    } else {
      const localDb = readLocalDb();
      localDb.quizzes[quizId] = data;
      writeLocalDb(localDb);
      return data;
    }
  },

  getQuiz: async (userId, docId) => {
    const quizId = `quiz-${docId}`;
    if (useFirebase) {
      const doc = await firestore.collection('quizzes').doc(quizId).get();
      return doc.exists ? doc.data() : null;
    } else {
      const localDb = readLocalDb();
      return localDb.quizzes[quizId] || null;
    }
  },

  // Stats Methods
  getStats: async (userId) => {
    const docs = await db.getDocuments(userId);
    const chats = await db.getChats(userId);
    
    const totalDocs = docs.length;
    let questionsAsked = 0;
    chats.forEach(chat => {
      questionsAsked += chat.messages.filter(m => m.sender === 'user').length;
    });

    const recentUploads = docs.slice(0, 5).map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      createdAt: doc.createdAt
    }));

    // Generate dynamic study statistics per type
    const fileTypes = { pdf: 0, docx: 0, txt: 0 };
    docs.forEach(doc => {
      if (fileTypes[doc.type] !== undefined) {
        fileTypes[doc.type]++;
      }
    });

    // Mock weekly activity for chart representation
    const weeklyActivity = [3, 2, 5, totalDocs, Math.max(0, questionsAsked - 2), questionsAsked, questionsAsked + 1];

    return {
      totalDocuments: totalDocs,
      questionsAsked,
      recentUploads,
      fileTypes,
      weeklyActivity
    };
  }
};
