import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let ai = null;
let useGemini = false;

if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    useGemini = true;
    console.log('🤖 Gemini AI Client Initialized successfully.');
  } catch (error) {
    console.warn('⚠️ Gemini AI Client failed to initialize. Using mock responses instead.', error.message);
  }
} else {
  console.log('🤖 Gemini API Key not found. StudyMate AI running in Mock AI Mode.');
}

// Simple keyword matching for local context ranking if docs get very large
function searchRelevantContext(fullText, query, maxChars = 200000) {
  if (fullText.length <= maxChars) {
    return fullText;
  }
  
  // Split into paragraphs
  const paragraphs = fullText.split(/\n\s*\n/);
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const ranked = paragraphs.map(p => {
    let score = 0;
    const lowerP = p.toLowerCase();
    terms.forEach(term => {
      if (lowerP.includes(term)) score += 1;
    });
    return { text: p, score };
  });
  
  // Sort by score and take the best ones
  ranked.sort((a, b) => b.score - a.score);
  
  let result = '';
  for (const item of ranked) {
    if (result.length + item.text.length > maxChars) break;
    result += item.text + '\n\n';
  }
  return result || fullText.substring(0, maxChars);
}

// 1. AI Chat answering from context
export async function answerQuestion(documentContexts, chatHistory, question) {
  const combinedContext = documentContexts.join('\n\n---\n\n');
  const contextText = searchRelevantContext(combinedContext, question, 150000); // Send up to 150k characters context

  if (useGemini && ai) {
    try {
      const prompt = `You are "StudyMate AI", a helpful, precise educational assistant.
Your task is to answer the user's question based ONLY on the provided document context.

Critical Constraints:
1. Answer the question using ONLY the facts and information present in the document.
2. Do NOT use outside knowledge, general assumptions, or extrapolation not directly supported by the text.
3. If the answer to the user's question cannot be found or inferred directly from the document context, you MUST respond with exactly this text: "Information not available in uploaded documents." Do not say anything else.
4. Keep the explanation clear, educational, and structured in Markdown.

Document Context:
-----------------
${contextText}
-----------------

Chat History:
${chatHistory.map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n')}

User Question: ${question}
Answer:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text || "Information not available in uploaded documents.";
    } catch (error) {
      console.error('Error calling Gemini API for chat:', error);
      return `Error generating response: ${error.message}`;
    }
  } else {
    // Mock Mode logic: simple search
    return mockChatResponse(contextText, question);
  }
}

// 2. Study Tools generator
export async function generateStudyTools(docName, docText, type) {
  if (useGemini && ai) {
    try {
      let prompt = ``;
      let systemInstruction = `You are a helpful educational AI designed to generate study aids. Always respond with clean, beautifully formatted markdown unless JSON format is requested.`;

      switch (type) {
        case 'summary':
          prompt = `Analyze the document "${docName}" and generate a comprehensive Summary. 
It should have an overview section, key concepts explained, and a final summary. Use neat headers, bullet points, and bold text.
Document Text:
${docText.substring(0, 100000)}`;
          break;
        case 'keyPoints':
          prompt = `Extract the most critical Key Points from the document "${docName}".
Format the response as a bulleted list with bold topic headers for each point, explaining why it's important.
Document Text:
${docText.substring(0, 100000)}`;
          break;
        case 'shortNotes':
          prompt = `Generate highly organized, concise Short Notes from the document "${docName}" designed for quick pre-exam revision.
Structure it with clean logical sections, bullet points, definitions, and highlights.
Document Text:
${docText.substring(0, 100000)}`;
          break;
        case 'questions':
          prompt = `Identify the most Important Questions that could be asked in an exam based on the document "${docName}".
Generate 5-7 questions. For each question, provide a brief answer or hint on how to answer it.
Document Text:
${docText.substring(0, 100000)}`;
          break;
        case 'flashcards':
          prompt = `Generate 6-8 Flashcards from the document "${docName}".
You MUST return ONLY a valid JSON array of objects, where each object has a "front" (the question, term, or concept) and "back" (the answer, definition, or explanation). 
Format: [{"front": "...", "back": "..."}, ...]
Do NOT wrap the JSON inside markdown blocks or include any introductory text.
Document Text:
${docText.substring(0, 80000)}`;
          break;
        case 'quizzes':
          prompt = `Generate a 5-question Multiple Choice Quiz (MCQ) from the document "${docName}".
You MUST return ONLY a valid JSON array of objects, where each object has "question" (string), "options" (array of 4 strings), "answer" (integer 0-3 corresponding to the correct option index), and "explanation" (string explaining why it is correct).
Format: [{"question": "...", "options": ["...", "...", "...", "..."], "answer": 0, "explanation": "..."}, ...]
Do NOT wrap the JSON inside markdown blocks or include any introductory text.
Document Text:
${docText.substring(0, 80000)}`;
          break;
        default:
          throw new Error('Invalid study tool type requested');
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          // If we want JSON output for flashcards and quizzes, we can set responseMimeType
          responseMimeType: (type === 'flashcards' || type === 'quizzes') ? 'application/json' : 'text/plain'
        }
      });

      const text = response.text;
      if (type === 'flashcards' || type === 'quizzes') {
        return JSON.parse(text);
      }
      return text;
    } catch (error) {
      console.error(`Error calling Gemini for ${type}:`, error);
      // Fallback to mock generation if Gemini fails mid-request
      return getMockDataForType(docName, docText, type);
    }
  } else {
    // Generate simulated content based on doc name and simple text extraction
    return getMockDataForType(docName, docText, type);
  }
}

// --- MOCK MODE LOGIC ---

function mockChatResponse(context, question) {
  const cleanQuestion = question.toLowerCase().trim();
  
  // Try to find keywords in context
  const lines = context.split('\n');
  let matchedSnippet = '';
  
  // Extract paragraphs containing some keywords
  const keywords = cleanQuestion.split(/\s+/).filter(w => w.length > 3);
  
  for (const line of lines) {
    if (line.length < 20) continue;
    const lowerLine = line.toLowerCase();
    let matches = 0;
    
    keywords.forEach(kw => {
      if (lowerLine.includes(kw)) matches++;
    });
    
    if (matches > 0 && matches >= Math.min(2, keywords.length)) {
      matchedSnippet = line.trim();
      break;
    }
  }

  if (matchedSnippet) {
    return `Based on the document context, here is what I found:

> ${matchedSnippet}

I hope this helps! If you need more details, let me know.
*(Note: Running in AI Demo Mode)*`;
  }

  // Generic fallback if user asks something simple
  if (cleanQuestion.includes('hello') || cleanQuestion.includes('hi')) {
    return `Hello! I am StudyMate AI (Demo Mode). I can help answer questions based on your uploaded documents. What would you like to know?`;
  }
  
  return "Information not available in uploaded documents.";
}

function getMockDataForType(docName, docText, type) {
  // Simple extraction of terms from the document text
  const cleanText = docText.replace(/[\r\n]+/g, ' ');
  const words = cleanText.split(/\s+/).filter(w => w.length > 5 && /^[a-zA-Z]+$/.test(w));
  
  // Get unique keywords
  const keywords = [...new Set(words)].slice(0, 15);
  
  switch (type) {
    case 'summary':
      return `# Summary: ${docName}

## Overview
This document, titled **${docName}**, covers key topics regarding its domain. 

## Key Core Subjects
Based on structural analysis of the text, the document focuses on:
${keywords.slice(0, 5).map(k => `- **${k.charAt(0).toUpperCase() + k.slice(1)}**: Explores principles, implementations, and theoretical guidelines.`).join('\n')}

## Conclusion
A valuable study resource highlighting essential concepts and practical structures for students.
*(Note: Generated in Demo Mode)*`;

    case 'keyPoints':
      return `# Key Points for ${docName}

${keywords.slice(0, 6).map((k, i) => `- **Point ${i+1}: Focus on ${k.charAt(0).toUpperCase() + k.slice(1)}**
  The document details the mechanics and relevance of ${k}. Understanding this concept is critical for understanding the overall subject matter.`).join('\n\n')}
*(Note: Generated in Demo Mode)*`;

    case 'shortNotes':
      return `# Short Revision Notes: ${docName}

## Section 1: Introduction & Definitions
- **Topic Core**: Analyzing text relating to "${keywords[0] || 'Subject'}".
- **Primary Concepts**: Includes aspects of ${keywords.slice(1, 4).join(', ')}.

## Section 2: Core Workings
- **Mechanics**: How ${keywords[4] || 'components'} interact with ${keywords[5] || 'systems'}.
- **Key Relationships**: ${keywords[6] || 'Concept A'} drives the efficiency of ${keywords[7] || 'Concept B'}.

## Quick Recall Hacks
- Use abbreviations for ${keywords[8] || 'Process'}.
- Remember: *${keywords[9] || 'Term'}* always precedes *${keywords[10] || 'Result'}*.
*(Note: Generated in Demo Mode)*`;

    case 'questions':
      return `# Important Exam Questions: ${docName}

${keywords.slice(0, 5).map((k, i) => `### Q${i+1}. Explain the role and significance of "${k.charAt(0).toUpperCase() + k.slice(1)}" in this context?
- **Hint**: Refer to section ${i+1} where the attributes and dependencies of ${k} are discussed. Make sure to define its basic functions first.`).join('\n\n')}
*(Note: Generated in Demo Mode)*`;

    case 'flashcards':
      return [
        {
          front: `What is the primary role of ${keywords[0] || 'this study material'}?`,
          back: `It acts as a core reference point, laying down the fundamental principles of the subject.`
        },
        {
          front: `How does the document define ${keywords[1] || 'the main concept'}?`,
          back: `It is described as a critical mechanism which dictates how surrounding systems operate.`
        },
        {
          front: `Why is ${keywords[2] || 'this element'} important?`,
          back: `Because it governs standard behaviors and ensures consistency across the studied process.`
        },
        {
          front: `What is the correlation between ${keywords[3] || 'Factor X'} and ${keywords[4] || 'Factor Y'}?`,
          back: `They have a directly proportional relationship where one guides the progression of the other.`
        },
        {
          front: `List one major takeaway regarding ${keywords[5] || 'the final chapter'}.`,
          back: `Understanding its structure is vital for scoring well in practical application assessments.`
        }
      ];

    case 'quizzes':
      return [
        {
          question: `What is the primary theme discussed in relation to "${keywords[0] || 'the topic'}"?`,
          options: [
            `Standard structural deployment of ${keywords[0] || 'concepts'}`,
            `Historical regression metrics of ${keywords[1] || 'studies'}`,
            `Complete negation of standard ${keywords[2] || 'principles'}`,
            `None of the above`
          ],
          answer: 0,
          explanation: `The text focuses heavily on outlining the structure and implementation guidelines, making the first option the correct answer.`
        },
        {
          question: `Which of the following is highlighted as a critical factor in the document?`,
          options: [
            `Ignoring the usage of ${keywords[3] || 'factors'}`,
            `The integrated application of ${keywords[1] || 'methods'}`,
            `Substituting ${keywords[4] || 'data'} with manual guessworks`,
            `All of the above`
          ],
          answer: 1,
          explanation: `The author repeatedly emphasizes the importance of integrated applications for optimal study results.`
        },
        {
          question: `In what context is "${keywords[2] || 'the concept'}" predominantly analyzed?`,
          options: [
            `Theoretical research only`,
            `Practical laboratory environments`,
            `Broad educational and revision frameworks`,
            `Commercial marketing campaigns`
          ],
          answer: 2,
          explanation: `StudyMate AI documents are analyzed inside educational study contexts to maximize student revision efficiency.`
        },
        {
          question: `Which process should follow the implementation of "${keywords[3] || 'Concept A'}"?`,
          options: [
            `Immediate evaluation of ${keywords[5] || 'data'}`,
            `Discarding all notes`,
            `Waiting for external reviews`,
            `None of the above`
          ],
          answer: 0,
          explanation: `Evaluation of data is vital right after implementation to measure efficacy.`
        },
        {
          question: `What is the ultimate goal of studying "${docName}"?`,
          options: [
            `To summarize academic research fields`,
            `To achieve academic excellence and master the topic`,
            `To archive study resources`,
            `To build local data files`
          ],
          answer: 1,
          explanation: `The primary objective of StudyMate AI is helping students master their curriculum contents.`
        }
      ];
    default:
      return "Invalid type";
  }
}
