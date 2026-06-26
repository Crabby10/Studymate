import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

import { db } from './db.js';
import { answerQuestion, generateStudyTools } from './gemini.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Text Chunking Utility
function chunkText(text, chunkSize = 1500, overlap = 300) {
  if (!text) return [];
  const chunks = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.substring(index, index + chunkSize).trim());
    index += chunkSize - overlap;
  }
  return chunks;
}

// Authentication Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = await db.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error.message);
    res.status(401).json({ error: 'Unauthorized or expired token' });
  }
}

// --- API ROUTES ---

// 1. Documents API
app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, path: filePath, originalname, size } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();
    
    let text = '';
    let type = '';

    // Extract text based on file format
    if (fileExtension === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
      type = 'txt';
    } else if (fileExtension === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
      type = 'pdf';
    } else if (fileExtension === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
      type = 'docx';
    } else {
      // Cleanup unsupported file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' });
    }

    if (!text || text.trim().length === 0) {
      // Cleanup empty file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Could not extract text. The document seems empty.' });
    }

    const docId = `doc-${Date.now()}`;
    const chunks = chunkText(text);

    // Save document details and text chunks
    const savedDoc = await db.saveDocument(req.user.uid, docId, {
      name: originalname,
      type,
      size,
      filePath: `/uploads/${filename}`,
      text
    });

    await db.saveChunks(req.user.uid, docId, chunks);

    res.status(201).json({
      message: 'Document processed and saved successfully',
      document: savedDoc,
      chunksCount: chunks.length
    });
  } catch (error) {
    console.error('File processing error:', error);
    res.status(500).json({ error: `File processing error: ${error.message}` });
  }
});

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const documents = await db.getDocuments(req.user.uid);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const docId = req.params.id;
    const document = await db.getDocument(req.user.uid, docId);
    
    if (document && document.filePath) {
      const localPath = path.join(process.cwd(), document.filePath);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    await db.deleteDocument(req.user.uid, docId);
    res.json({ message: 'Document and its data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Chat API
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const chats = await db.getChats(req.user.uid);
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { id, title, documentIds } = req.body;
    const chatId = id || `chat-${Date.now()}`;
    const newChat = await db.saveChat(req.user.uid, chatId, { title, documentIds });
    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chat = await db.getChat(req.user.uid, req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteChat(req.user.uid, req.params.id);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: 'Message text is required' });

    const chat = await db.getChat(req.user.uid, chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (!chat.documentIds || chat.documentIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one document for this chat.' });
    }

    // Retrieve texts from selected documents
    const contexts = [];
    for (const docId of chat.documentIds) {
      const doc = await db.getDocument(req.user.uid, docId);
      if (doc && doc.text) {
        contexts.push(doc.text);
      }
    }

    if (contexts.length === 0) {
      return res.status(400).json({ error: 'Selected documents no longer exist or are empty.' });
    }

    // Call Gemini AI
    const aiAnswer = await answerQuestion(contexts, chat.messages, text);

    // Save chat messages
    const updatedMessages = [
      ...chat.messages,
      { sender: 'user', text, createdAt: new Date().toISOString() },
      { sender: 'ai', text: aiAnswer, createdAt: new Date().toISOString() }
    ];

    await db.saveChat(req.user.uid, chatId, {
      ...chat,
      messages: updatedMessages
    });

    res.json({ sender: 'ai', text: aiAnswer, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Study Tools API
app.post('/api/study/generate', authenticateToken, async (req, res) => {
  try {
    const { docId, type } = req.body;
    if (!docId || !type) return res.status(400).json({ error: 'docId and type are required' });

    const document = await db.getDocument(req.user.uid, docId);
    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Generate study aids via Gemini
    const result = await generateStudyTools(document.name, document.text, type);

    // Persist tools to the corresponding database collections
    if (type === 'quizzes') {
      await db.saveQuiz(req.user.uid, docId, result);
    } else {
      // Get existing summary details to do incremental update
      const existingSummary = await db.getSummary(req.user.uid, docId) || {};
      const studyDetails = {
        keyPoints: type === 'keyPoints' ? result.split('\n').filter(l => l.startsWith('-')) : (existingSummary.keyPoints || []),
        shortNotes: type === 'shortNotes' ? result : (existingSummary.shortNotes || ''),
        flashcards: type === 'flashcards' ? result : (existingSummary.flashcards || [])
      };
      
      const summaryText = type === 'summary' ? result : (existingSummary.summary || '');
      await db.saveSummary(req.user.uid, docId, summaryText, studyDetails);
    }

    res.json({ type, result });
  } catch (error) {
    console.error('Study tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/study/summaries/:docId', authenticateToken, async (req, res) => {
  try {
    const data = await db.getSummary(req.user.uid, req.params.docId);
    res.json(data || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/study/quizzes/:docId', authenticateToken, async (req, res) => {
  try {
    const data = await db.getQuiz(req.user.uid, req.params.docId);
    res.json(data || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Stats API
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getStats(req.user.uid);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 StudyMate AI Backend running on http://localhost:${PORT}`);
});
