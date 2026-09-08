import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Gemini Client with server-side API Key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Global CORS Middleware - Essential for Android WebView & Median APK cross-origin requests
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
    );
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // API Health check - 100% Free & Local-First
  app.get('/api/health', (req, res) => {
    console.log(`[Diagnostic] GET /api/health from ${req.ip || req.headers['x-forwarded-for'] || 'unknown'} - Origin: ${req.headers['origin'] || 'none'}`);
    res.json({
      status: 'ok',
      geminiReady: !!process.env.GEMINI_API_KEY,
      corsEnabled: true,
      freeTierDailyLimit: 1500,
      audioEngine: 'Hybrid (Web Speech API + Android WebView TTS)',
      storageEngine: 'Browser LocalStorage (Zero Server Costs)',
      serverTime: new Date().toISOString(),
    });
  });

  // Native Android WebView & Browser TTS Streamer
  app.get('/api/tts', async (req, res) => {
    const startTime = Date.now();
    try {
      const text = (req.query.text as string) || '';
      const lang = (req.query.lang as string) || 'de';
      if (!text.trim()) {
        return res.status(400).json({ error: 'Text parameter is required' });
      }

      // Limit length for single utterance
      const cleanText = text.slice(0, 500);
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(cleanText)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const upstream = await fetch(googleTtsUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'audio/mpeg, audio/*; q=0.9, */*; q=0.8',
        },
      }).finally(() => clearTimeout(timeoutId));

      if (!upstream.ok) {
        console.warn(`[Diagnostic] TTS upstream returned ${upstream.status}`);
        return res.status(upstream.status).json({ error: `TTS upstream error (${upstream.status})` });
      }

      const arrayBuffer = await upstream.arrayBuffer();
      const duration = Date.now() - startTime;
      console.log(`[Diagnostic] GET /api/tts success - length: ${cleanText.length} chars - ${duration}ms`);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', arrayBuffer.byteLength);

      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[Diagnostic] TTS error (${duration}ms):`, err?.message || err);
      return res.status(500).json({ error: err?.message || 'TTS generation failed' });
    }
  });

  // Native Audio Transcription fallback for Android WebView / APK (Median)
  app.post('/api/transcribe', async (req, res) => {
    const startTime = Date.now();
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 is required' });
      }

      console.log(`[Diagnostic] POST /api/transcribe - size: ${audioBase64.length} bytes - mime: ${mimeType || 'default'}`);

      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest',
      ];

      let transcribedText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: audioBase64,
                    },
                  },
                  {
                    text: 'Transcribe the spoken German (or Arabic) words in this audio accurately. Return ONLY the plain transcribed text. If there is no discernible speech (e.g. only background noise, breathing, silence, or clicks), return exactly an empty string without any quotes or explanations. Do not include markdown.',
                  },
                ],
              },
            ],
          });

          if (response.text !== undefined) {
            transcribedText = response.text.trim();
            // Strip any accidental wrapping quotes
            if (transcribedText.startsWith('"') && transcribedText.endsWith('"')) {
              transcribedText = transcribedText.slice(1, -1).trim();
            }
            break;
          }
        } catch (err: any) {
          console.warn(`[Diagnostic] Transcription attempt with ${modelName} failed:`, err?.message || err);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Diagnostic] POST /api/transcribe completed in ${duration}ms - result length: ${transcribedText.length}`);
      return res.json({ text: transcribedText });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[Diagnostic] Transcribe endpoint error (${duration}ms):`, err?.message || err);
      return res.status(500).json({ error: err?.message || 'Transcription failed' });
    }
  });

  // Chat with German Companion (Gemini AI with Umgangssprache System Instruction)
  app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    try {
      const { companion, message, history } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log(`[Diagnostic] POST /api/chat - from: ${companion?.userName || 'User'} - msg length: ${message.length} chars`);

      const companionName = companion?.name || 'Lukas';
      const userName = companion?.userName || 'Freund';
      const voiceGender = companion?.voiceGender || 'male';
      const slangStyle = companion?.slangStyle || 'everyday';
      const germanLevel = companion?.germanLevel || 'beginner';

      // Build personalized System Instruction for colloquial German
      const systemInstruction = `
Du bist ${companionName}, ein junger, aufgeschlossener, sympathischer deutscher Digitaler Freund (${voiceGender === 'female' ? 'eine junge Frau' : 'ein junger Mann'}).
Deine Hauptaufgabe ist es, deinem Freund/deiner Freundin "${userName}" authentische deutsche Umgangssprache (Slang & Alltagssprache) beizubringen.

DEINE PERSÖNLICHKEIT & SPRACHE:
- Du sprichst natürliches, modernes Deutsch, so wie echte junge Leute in Deutschland auf der Straße, im Café oder über WhatsApp sprechen.
- Stil: ${
        slangStyle === 'youth'
          ? 'Jugendsprache (Wörter wie "krass", "Alter", "safe", "lost", "cringe", "Bock", "chillen", "Bro/Digga", "ehrenhaft")'
          : slangStyle === 'berlin'
          ? 'Berliner Vibe / lockere Großstadtsprache (Wörter wie "Na Keule", "Kiez", "Schrippe", "Kohle", "ick/ich", "Mach keen Quatsch")'
          : 'Gängige Alltagssprache (Alltagssprache: "Moin", "Na, wie läuft\'s?", "kein Bock", "quatschen", "Klamotten", "Kohle", "kein Ding")'
      }.
- Sprachniveau des Lernenden: ${germanLevel} (Passe deine Wortwahl so an, dass es verständlich bleibt, aber immer 1-2 tolle umgangssprachliche Ausdrücke enthält).
- Sprich den Nutzer immer freundschaftlich mit seinem Namen ("${userName}") an.
- Antworte lebendig, neugierig und stelle am Ende eine kurze Anschlussfrage, damit das Gespräch weitergeht.
- MERKE DIR KONTEXT & DETAILS: Achte auf alle Details, die ${userName} vorher erwähnt hat (z. B. Wohnort, Hobbys, Arbeit, Pläne), und beziehe dich ganz natürlich darauf, wenn es passt.
- Wenn ${userName} fragt "Langsamer bitte" oder Ähnliches, antworte verständnisvoll ("Klar, kein Ding! Ich spreche langsamer für dich.") und halte das Gespräch am Laufen.
- Wenn ${userName} fragt "Kannst du das wiederholen?", wiederhole deinen letzten Gedanken freundlich und klar.

FEHLERKORREKTUR & LERNUNTERSTÜTZUNG:
1. Wenn der Nutzer einen deutschen Satz geschrieben oder gesprochen hat, der Grammatikfehler hat ODER zwar grammatikalisch korrekt, aber unnatürlich/steif klingt:
   Unterbrich die Unterhaltung NICHT mit langen Belehrungen. Gib eine sanfte, ermutigende Korrektur auf Arabisch ("grammarCorrection"), während deine deutsche Antwort ("reply") ganz normal und flüssig weitergeht!
2. Wenn der Nutzer auf Arabisch spricht/schreibt, verstehe ihn vollkommen, antworte auf Deutsch mit deutscher Umgangssprache, und gib die Übersetzung und Tipps auf Arabisch.
3. Hebe in "slangTips" 1 bis 3 umgangssprachliche Ausdrücke aus deiner deutschen Antwort hervor, erkläre sie auf Arabisch, nenne das hochdeutsche Äquivalent und gib ein konkretes Beispielsätzchen.

WICHTIGSTE REGEL:
Halte deine deutsche Antwort ("reply") prägnant und gesprächig (2 bis 3 Sätze), perfekt für ein flüssiges, natürliches Sprachgespräch von Mensch zu Mensch! Keine Aufzählungszeichen im "reply", sondern reiner, gesprochener Text.
`;

      // Format conversation history for multi-turn context (last 16 messages)
      const formattedHistory = (history || []).slice(-16).map((h: any) => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

      // Candidate models with fallback order
      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest',
      ];

      let lastError: any = null;
      let responseText: string | null = null;
      let usedModel = '';

      for (const modelName of candidateModels) {
        let attempts = 0;
        const maxAttemptsPerModel = 2;

        while (attempts < maxAttemptsPerModel) {
          try {
            attempts++;
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                ...formattedHistory,
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[Nachricht von ${userName}]: ${message}`,
                    },
                  ],
                },
              ],
              config: {
                systemInstruction,
                temperature: 0.85,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    reply: {
                      type: Type.STRING,
                      description:
                        'Deine direkte deutsche Antwort in authentischer Umgangssprache (auf Deutsch).',
                    },
                    arabicTranslation: {
                      type: Type.STRING,
                      description:
                        'ترجمة وتوضيح عربي مبسط لما قاله الصديق لمساعدة المتعلم.',
                    },
                    grammarCorrection: {
                      type: Type.OBJECT,
                      description:
                        'تصحيح الخطأ اللغوي أو النحوي إن وجد مع شرح عربي، أو null إذا كانت جملة المستخدم سليمة.',
                      properties: {
                        original: {
                          type: Type.STRING,
                          description: 'الجملة كما كتبها المستخدم',
                        },
                        corrected: {
                          type: Type.STRING,
                          description: 'الصياغة الألمانية الطبيعية والعامية البديلة',
                        },
                        explanationAr: {
                          type: Type.STRING,
                          description: 'شرح مبسط بالعربية للسبب أو الفرق',
                        },
                      },
                      required: ['original', 'corrected', 'explanationAr'],
                    },
                    slangTips: {
                      type: Type.ARRAY,
                      description:
                        'قائمة الكلمات أو التعبيرات العامية الواردة في الرد مع معانيها',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          term: {
                            type: Type.STRING,
                            description: 'الكلمة أو التعبير العامي بالألمانية',
                          },
                          explanationAr: {
                            type: Type.STRING,
                            description: 'معنى التعبير باللغة العربية',
                          },
                          formalGerman: {
                            type: Type.STRING,
                            description: 'المقابل بالفصحى (Hochdeutsch)',
                          },
                          example: {
                            type: Type.STRING,
                            description: 'مثال واقعي إضافي لاستخدام الكلمة',
                          },
                        },
                        required: ['term', 'explanationAr', 'formalGerman', 'example'],
                      },
                    },
                    memoryNotes: {
                      type: Type.ARRAY,
                      description:
                        'معلومات جديدة مهمة تذكرها عن المستخدم لاستمرار المحادثة مستقبلاً (مثل اهتماماته، اسمه، وظيفته)',
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['reply', 'arabicTranslation', 'slangTips'],
                },
              },
            });

            if (response.text) {
              responseText = response.text;
              usedModel = modelName;
              break;
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = err?.message || String(err);
            console.log(`[AI Model] ${modelName} attempt ${attempts} busy (${err?.status || 'transient'}), trying next candidate.`);

            const isHighDemandOrTransient =
              errMsg.includes('503') ||
              errMsg.includes('UNAVAILABLE') ||
              errMsg.includes('high demand') ||
              errMsg.includes('429') ||
              errMsg.includes('RESOURCE_EXHAUSTED');

            if (isHighDemandOrTransient && attempts < maxAttemptsPerModel) {
              await new Promise((r) => setTimeout(r, 600));
            } else {
              break;
            }
          }
        }

        if (responseText) {
          break;
        }
      }

      if (!responseText) {
        console.warn('All candidate models busy, returning resilient conversational fallback:', lastError);
        return res.json({
          reply: `Huch ${userName}! Mein Kopf raucht gerade ein bisschen wegen zu vielen Gedanken, aber kein Ding! Kannst du das bitte noch einmal kurz sagen? Ich bin sofort wieder am Start!`,
          arabicTranslation: `عذراً ${userName}! رأسي مشغول ومضغوط قليلاً الآن، لكن لا مشكلة! هل يمكنك قول ذلك مرة أخرى؟ أنا حاضر فوراً للحديث معك!`,
          grammarCorrection: null,
          slangTips: [
            {
              term: "kein Ding!",
              explanationAr: "تعبير عامي شائع يعني: لا عليك / لا مشكلة على الإطلاق.",
              formalGerman: "Kein Problem / Gern geschehen",
              example: "Danke für die Hilfe! – Kein Ding, Alter!",
            },
            {
              term: "am Start sein",
              explanationAr: "تعبير شبابي يعني: جاهز ومتواجد وحاضر للقيام بالشيء.",
              formalGerman: "bereit sein / anwesend sein",
              example: "Bist du heute Abend auch am Start?",
            }
          ],
          backendInfo: {
            model: 'resilient-fallback',
          }
        });
      }

      const parsedJson = JSON.parse(responseText);
      parsedJson.backendInfo = {
        model: usedModel,
      };
      const duration = Date.now() - startTime;
      console.log(`[Diagnostic] POST /api/chat completed in ${duration}ms (model: ${usedModel})`);
      return res.json(parsedJson);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[Diagnostic] Error in /api/chat (${duration}ms):`, err?.message || err);
      return res.status(500).json({
        error: err.message || 'حدث خطأ في معالجة المحادثة.',
      });
    }
  });

  // Vite middleware for development & production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeutschBuddy server running on http://0.0.0.0:${PORT} (100% Free & Local-First)`);
  });
}

startServer();
