import { VoiceGender } from '../types';
import { getEndpointUrl, logNetworkDiagnostic, isAndroidWebView } from './config';

// Speech-to-Text (STT) interface for single inputs
export interface STTCallbacks {
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

// Continuous Voice Conversation STT interface
export interface VoiceModeCallbacks {
  onInterim: (transcript: string) => void;
  onSpeechFinal: (transcript: string) => void;
  onError: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
}

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isVoiceModeActive: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private watchdogTimer: any = null;
  private silenceTimer: any = null;
  private latestTranscript: string = '';
  private currentSpeechRate: number = 0.98;

  // MediaRecorder Fallback for Android WebView / APK (Median)
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private volumeAnimFrame: number | null = null;
  private recordedAudioChunks: Blob[] = [];
  private isUserSpeakingAudio: boolean = false;
  private fallbackSilenceTimer: any = null;
  private activeVoiceCallbacks: VoiceModeCallbacks | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Initialize Speech Recognition (Speech-to-Text)
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'de-DE'; // German
        } catch (e) {
          console.warn('SpeechRecognition init error:', e);
        }
      }

      // 2. Pre-cache available voices for Speech Synthesis (Text-to-Speech)
      this.loadVoices();
      if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  public setSpeechRate(rate: number): void {
    this.currentSpeechRate = Math.max(0.65, Math.min(1.4, rate));
  }

  public getSpeechRate(): number {
    return this.currentSpeechRate;
  }

  private loadVoices(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices();
      } catch (e) {
        this.cachedVoices = [];
      }
    }
  }

  /**
   * Detects if the current environment is Android WebView or a Median.co APK wrapper
   */
  public isAndroidWebView(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    const isAndroid = ua.includes('android');

    // Median / GoNative JavaScript Bridge presence
    const hasMedianBridge = !!(window as any).median || !!(window as any).gonative;

    // WebView signature patterns
    const isWebView =
      ua.includes('wv') ||
      ua.includes('version/4.0') ||
      ua.includes('median') ||
      ua.includes('gonative') ||
      hasMedianBridge ||
      (isAndroid && ua.includes('mobile safari') && !ua.includes('chrome/'));

    return isAndroid && isWebView;
  }

  /**
   * Check if native window.speechSynthesis is genuinely usable in this environment.
   * In Android WebView (like Median APK), speechSynthesis often exists as an empty stub or silently hangs.
   */
  public isSpeechSynthesisUsable(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return false;
    }
    // In Android WebView, speechSynthesis is notoriously broken or silent
    if (this.isAndroidWebView()) {
      return false;
    }
    return true;
  }

  public isSTTSupported(): boolean {
    return !!this.recognition || !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  public isTTSSupported(): boolean {
    return true;
  }

  /**
   * Start listening to microphone for single input (e.g. Chat Input Bar)
   */
  public startListening(callbacks: STTCallbacks): boolean {
    if (!this.recognition) {
      callbacks.onError('متصفحك لا يدعم التعرف الصوتي المباشر. يفضل استخدام Google Chrome أو Edge.');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      callbacks.onResult(finalTranscript);
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      if (event.error === 'not-allowed') {
        callbacks.onError('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.');
      } else if (event.error === 'no-speech') {
        callbacks.onError('لم يتم سماع صوت. يرجى المحاولة مرة أخرى.');
      } else {
        callbacks.onError(`خطأ في الميكروفون: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
      return true;
    } catch (err: any) {
      this.isListening = false;
      callbacks.onError(err.message || 'تعذر تشغيل الميكروفون');
      return false;
    }
  }

  /**
   * Stop single-turn listening
   */
  public stopListening(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  /**
   * Start Continuous Voice Mode Listening with smart silence detection & Android fallback
   */
  public startVoiceModeListening(callbacks: VoiceModeCallbacks): void {
    this.stopSpeaking();
    this.stopVoiceModeListening();

    this.isVoiceModeActive = true;
    this.activeVoiceCallbacks = callbacks;
    this.latestTranscript = '';

    // If SpeechRecognition is supported and NOT in an Android WebView without Google Services
    if (this.recognition && !this.isAndroidWebView()) {
      this.startNativeVoiceRecognition(callbacks);
    } else {
      // Use MediaRecorder + Gemini Transcribe fallback for Android WebView / Median APK
      this.startMediaRecorderFallback(callbacks);
    }
  }

  /**
   * Native Web Speech Recognition for continuous loop with silence detection
   */
  private startNativeVoiceRecognition(callbacks: VoiceModeCallbacks): void {
    if (!this.recognition) {
      this.startMediaRecorderFallback(callbacks);
      return;
    }

    this.isListening = true;
    this.latestTranscript = '';

    const resetSilenceTimer = () => {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }

      // 1.8 seconds of silence after user speaks -> finalize utterance
      this.silenceTimer = setTimeout(() => {
        const text = this.latestTranscript.trim();
        if (text.length > 0 && this.isVoiceModeActive) {
          console.log('Voice Mode: Speech complete ->', text);
          this.stopListening();
          callbacks.onSpeechFinal(text);
        }
      }, 1800);
    };

    this.recognition.onresult = (event: any) => {
      if (!this.isVoiceModeActive) return;

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          this.latestTranscript += ' ' + item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const combined = (this.latestTranscript + ' ' + interim).trim();
      if (combined) {
        this.latestTranscript = combined;
        callbacks.onInterim(combined);
        resetSilenceTimer();
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Continuous STT event error:', event.error);
      if (!this.isVoiceModeActive) return;

      if (event.error === 'not-allowed') {
        this.stopVoiceModeListening();
        callbacks.onError('يرجى السماح بصلاحية الميكروفون لاستخدام المحادثة الصوتية.');
      } else if (event.error === 'no-speech') {
        // Ignore silence, stay listening
      } else if (event.error === 'network' || event.error === 'service-not-allowed') {
        // Switch to MediaRecorder fallback
        console.warn('Native speech service unavailable. Switching to MediaRecorder fallback.');
        this.stopListening();
        this.startMediaRecorderFallback(callbacks);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // If voice mode is still active and user didn't finalize yet, restart listening
      if (this.isVoiceModeActive) {
        try {
          this.recognition.start();
          this.isListening = true;
        } catch (e) {
          // If restart fails, switch to fallback
          this.startMediaRecorderFallback(callbacks);
        }
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Failed to start native recognition:', e);
      this.startMediaRecorderFallback(callbacks);
    }
  }

  /**
   * MediaRecorder + Web Audio API fallback for Android WebView / APK (Median)
   * Captures voice when user speaks, detects end of utterance via volume threshold,
   * then transcribes via server-side Gemini API.
   */
  private async startMediaRecorderFallback(callbacks: VoiceModeCallbacks): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        callbacks.onError('المتصفح لا يدعم تسجيل الصوت عبر الميكروفون.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      // Audio Context for real-time visual volume and Voice Activity Detection (VAD)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!this.isVoiceModeActive || !this.analyser) return;

          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalizedVol = Math.min(100, Math.round((avg / 128) * 100));

          if (callbacks.onVolumeChange) {
            callbacks.onVolumeChange(normalizedVol);
          }

          // Voice Activity Detection (VAD)
          const SPEECH_THRESHOLD = 15;
          if (normalizedVol > SPEECH_THRESHOLD) {
            if (!this.isUserSpeakingAudio) {
              this.isUserSpeakingAudio = true;
              callbacks.onInterim('جاري الاستماع لصوتك...');
            }
            if (this.fallbackSilenceTimer) {
              clearTimeout(this.fallbackSilenceTimer);
              this.fallbackSilenceTimer = null;
            }
          } else if (this.isUserSpeakingAudio && !this.fallbackSilenceTimer) {
            // Silence detected after speech -> set timeout
            this.fallbackSilenceTimer = setTimeout(() => {
              if (this.isVoiceModeActive && this.isUserSpeakingAudio) {
                this.isUserSpeakingAudio = false;
                this.finalizeMediaRecorderRecording(callbacks);
              }
            }, 1800);
          }

          this.volumeAnimFrame = requestAnimationFrame(checkVolume);
        };

        this.volumeAnimFrame = requestAnimationFrame(checkVolume);
      }

      // Initialize MediaRecorder
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/aac', ''];
      let chosenMime = '';
      for (const m of mimeTypes) {
        if (!m || (MediaRecorder as any).isTypeSupported?.(m)) {
          chosenMime = m;
          break;
        }
      }

      this.recordedAudioChunks = [];
      const options = chosenMime ? { mimeType: chosenMime } : undefined;
      const recorder = new MediaRecorder(stream, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedAudioChunks.push(e.data);
        }
      };

      recorder.start(250); // Slice every 250ms
    } catch (err: any) {
      console.error('MediaRecorder fallback error:', err);
      callbacks.onError('تعذر الوصول إلى الميكروفون. يرجى تفعيل الصلاحية في إعدادات التطبيق.');
    }
  }

  /**
   * Finalize MediaRecorder recording and send audio to /api/transcribe
   */
  private async finalizeMediaRecorderRecording(callbacks: VoiceModeCallbacks): Promise<void> {
    if (!this.mediaRecorder) return;

    try {
      callbacks.onInterim('جاري معالجة الصوت بدقة...');

      // Stop recorder to flush last chunk
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Small delay to ensure ondataavailable fires
      await new Promise((r) => setTimeout(r, 200));

      if (this.recordedAudioChunks.length === 0) {
        // Restart recorder
        if (this.isVoiceModeActive) {
          this.recordedAudioChunks = [];
          if (this.mediaRecorder && this.mediaStream) {
            this.mediaRecorder.start(250);
          }
        }
        return;
      }

      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.recordedAudioChunks, { type: mimeType });
      this.recordedAudioChunks = [];

      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const transcribeUrl = getEndpointUrl('/api/transcribe');
        const startTime = Date.now();
        try {
          const base64Data = (reader.result as string).split(',')[1];
          if (!base64Data) {
            if (this.isVoiceModeActive && this.mediaRecorder && this.mediaStream) {
              this.mediaRecorder.start(250);
            }
            return;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(transcribeUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ audioBase64: base64Data, mimeType }),
          }).finally(() => clearTimeout(timeoutId));

          const durationMs = Date.now() - startTime;
          logNetworkDiagnostic({
            endpoint: transcribeUrl,
            method: 'POST',
            status: response.status,
            durationMs,
          });

          if (response.ok) {
            const data = await response.json();
            const text = (data.text || '').trim();
            if (text && this.isVoiceModeActive) {
              this.stopVoiceModeListening();
              callbacks.onSpeechFinal(text);
              return;
            }
          } else {
            console.warn(`[Speech STT] Transcription failed with HTTP ${response.status}`);
          }

          // If no speech recognized, restart recorder for next utterance
          if (this.isVoiceModeActive && this.mediaRecorder && this.mediaStream) {
            this.mediaRecorder.start(250);
          }
        } catch (e: any) {
          const durationMs = Date.now() - startTime;
          logNetworkDiagnostic({
            endpoint: transcribeUrl,
            method: 'POST',
            durationMs,
            error: e?.message || 'Transcription network error',
          });
          console.warn('Transcription request error:', e?.message || e);
          if (this.isVoiceModeActive && this.mediaRecorder && this.mediaStream) {
            this.mediaRecorder.start(250);
          }
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.warn('finalizeMediaRecorderRecording error:', err);
    }
  }

  /**
   * Stop Voice Mode Listening and cleanup all streams & recorders
   */
  public stopVoiceModeListening(): void {
    this.isVoiceModeActive = false;
    this.activeVoiceCallbacks = null;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.fallbackSilenceTimer) {
      clearTimeout(this.fallbackSilenceTimer);
      this.fallbackSilenceTimer = null;
    }

    if (this.volumeAnimFrame) {
      cancelAnimationFrame(this.volumeAnimFrame);
      this.volumeAnimFrame = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }

    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
      this.analyser = null;
    }

    this.recordedAudioChunks = [];
    this.isUserSpeakingAudio = false;
  }

  /**
   * Clean German text before speech synthesis
   */
  private cleanGermanText(text: string): string {
    return text
      .replace(/[*#_~`]/g, '')
      .replace(/\(.*?\)/g, '') // remove parenthetical explanations
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
  }

  /**
   * Main TTS function: Automatically detects browser vs Android APK/WebView
   * and routes to the best German TTS engine with zero voice overlapping.
   */
  public speakText(
    text: string,
    gender: VoiceGender,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (errorMsg: string) => void,
    options?: SpeakOptions
  ): void {
    // 1. Immediately cancel any currently playing audio or speech and pause mic
    this.stopSpeaking();

    const cleanText = this.cleanGermanText(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const effectiveRate = options?.rate || this.currentSpeechRate;

    // 2. If running inside Android WebView / Median APK, or if Web Speech API is not usable:
    // Directly use HTML5 Audio TTS (100% compatible with Android WebView)
    if (!this.isSpeechSynthesisUsable()) {
      this.playWithHtmlAudio(cleanText, onStart, onEnd, onError, effectiveRate);
      return;
    }

    // 3. In desktop or compatible browsers, try native SpeechSynthesis first
    this.playWithSpeechSynthesis(
      cleanText,
      gender,
      onStart,
      onEnd,
      () => {
        // Fallback: If SpeechSynthesis fails or hangs, seamlessly switch to HTML5 Audio TTS
        console.warn('SpeechSynthesis failed or unsupported, falling back to Android/HTML5 Audio TTS');
        this.playWithHtmlAudio(cleanText, onStart, onEnd, onError, effectiveRate);
      },
      effectiveRate
    );
  }

  /**
   * Native Web Speech API execution with watchdog timer and configurable speed
   */
  private playWithSpeechSynthesis(
    cleanText: string,
    gender: VoiceGender,
    onStart?: () => void,
    onEnd?: () => void,
    onFallback?: () => void,
    rate: number = 0.98
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onFallback) onFallback();
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;
    utterance.lang = 'de-DE';

    if (this.cachedVoices.length === 0) {
      this.cachedVoices = window.speechSynthesis.getVoices();
    }

    const germanVoices = this.cachedVoices.filter(
      (v) => v.lang.startsWith('de') || v.lang.replace('_', '-').startsWith('de')
    );

    if (germanVoices.length > 0) {
      let matchedVoice: SpeechSynthesisVoice | null = null;
      if (gender === 'female') {
        matchedVoice =
          germanVoices.find(
            (v) =>
              v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('anna') ||
              v.name.toLowerCase().includes('katja') ||
              v.name.toLowerCase().includes('marlene') ||
              v.name.toLowerCase().includes('petra') ||
              v.name.toLowerCase().includes('hedda') ||
              v.name.toLowerCase().includes('vicki')
          ) ||
          germanVoices.find((v) => !v.name.toLowerCase().includes('male')) ||
          germanVoices[0];
      } else {
        matchedVoice =
          germanVoices.find(
            (v) =>
              v.name.toLowerCase().includes('male') ||
              v.name.toLowerCase().includes('markus') ||
              v.name.toLowerCase().includes('stefan') ||
              v.name.toLowerCase().includes('martin') ||
              v.name.toLowerCase().includes('hans') ||
              v.name.toLowerCase().includes('florian')
          ) ||
          germanVoices[0];
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    // Speech tuning
    utterance.rate = rate;
    utterance.pitch = gender === 'female' ? 1.08 : 0.92;

    let hasStarted = false;

    // Watchdog timer: If SpeechSynthesis hangs without starting within 1000ms, fallback
    this.watchdogTimer = setTimeout(() => {
      if (!hasStarted && this.currentUtterance === utterance) {
        console.warn('SpeechSynthesis watchdog triggered: utterance did not start in time.');
        this.stopSpeaking();
        if (onFallback) onFallback();
      }
    }, 1000);

    utterance.onstart = () => {
      hasStarted = true;
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis utterance error:', e);
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.currentUtterance = null;
      if (onFallback) {
        onFallback();
      } else if (onEnd) {
        onEnd();
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Failed to call window.speechSynthesis.speak:', e);
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      if (onFallback) onFallback();
    }
  }

  /**
   * Android APK / WebView compatible HTML5 Audio TTS fallback
   * Supports configurable playbackRate (e.g. slower rate)
   */
  private playWithHtmlAudio(
    cleanText: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (errorMsg: string) => void,
    rate: number = 0.98
  ): void {
    try {
      const encodedText = encodeURIComponent(cleanText.slice(0, 500));
      const serverTtsUrl = getEndpointUrl(`/api/tts?lang=de&text=${encodedText}`);
      const directGoogleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=de&q=${encodedText}`;

      const audio = new Audio();
      this.currentAudio = audio;
      audio.playbackRate = rate;

      let fallbackAttempted = false;

      const cleanup = () => {
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      audio.onplay = () => {
        logNetworkDiagnostic({
          endpoint: audio.src,
          method: 'GET',
          status: 200,
          durationMs: 0,
        });
        if (onStart) onStart();
      };

      audio.onended = () => {
        cleanup();
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        const errDetail = audio.error ? `MediaError code ${audio.error.code}` : 'Network error';
        logNetworkDiagnostic({
          endpoint: audio.src,
          method: 'GET',
          durationMs: 0,
          error: errDetail,
        });
        console.warn('[Speech TTS] HTML5 Audio error on URL:', audio.src, errDetail, e);

        if (!fallbackAttempted) {
          fallbackAttempted = true;
          console.log('[Speech TTS] Attempting direct Google TTS fallback...');
          audio.src = directGoogleTtsUrl;
          audio.playbackRate = rate;
          audio.load();
          audio.play().catch((err) => {
            console.warn('[Speech TTS] Direct fallback also failed:', err);
            cleanup();
            if (onError) {
              onError('تعذر تشغيل الصوت من الخادم. يرجى التحقق من اتصال السيرفر بالإنترنت.');
            } else if (onEnd) {
              onEnd();
            }
          });
        } else {
          cleanup();
          if (onError) {
            onError('تعذر تشغيل الصوت على هذا الجهاز (Media Playback Error).');
          } else if (onEnd) {
            onEnd();
          }
        }
      };

      audio.src = serverTtsUrl;
      audio.playbackRate = rate;
      audio.load();

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr) => {
          console.warn('[Speech TTS] audio.play() promise rejected:', playErr);
          if (!fallbackAttempted) {
            fallbackAttempted = true;
            audio.src = directGoogleTtsUrl;
            audio.playbackRate = rate;
            audio.load();
            audio.play().catch((finalErr) => {
              console.warn('[Speech TTS] Direct fallback audio.play() promise rejected:', finalErr);
              cleanup();
              if (onError) {
                onError('يرجى الضغط على زر الاستماع مرة أخرى لتفعيل الصوت.');
              } else if (onEnd) {
                onEnd();
              }
            });
          }
        });
      }
    } catch (err: any) {
      console.error('[Speech TTS] playWithHtmlAudio initialization error:', err);
      if (onError) {
        onError('محرك الصوت غير متوفر حالياً.');
      } else if (onEnd) {
        onEnd();
      }
    }
  }

  /**
   * Immediately cancel any running speech or audio playback
   * Ensures no two sounds play concurrently
   */
  public stopSpeaking(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    // 1. Cancel native SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      this.currentUtterance = null;
    }

    // 2. Stop and release HTML5 Audio
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch (e) {}
      this.currentAudio = null;
    }
  }
}

export const speechService = new SpeechService();
