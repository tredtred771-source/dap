export type VoiceGender = 'female' | 'male';

export type GermanLevel = 'beginner' | 'intermediate' | 'advanced';

export type SlangStyle = 'everyday' | 'youth' | 'berlin';

export type VoiceConversationState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'error';

export interface CompanionProfile {
  id?: string;
  name: string;
  voiceGender: VoiceGender;
  avatar: string;
  userName: string;
  germanLevel: GermanLevel;
  slangStyle: SlangStyle;
  bio?: string;
  createdAt?: string;
}

export interface SlangTip {
  term: string;
  explanationAr: string;
  formalGerman: string;
  example: string;
}

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanationAr: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'companion';
  text: string;
  arabicTranslation?: string;
  timestamp: number;
  grammarCorrection?: GrammarCorrection | null;
  slangTips?: SlangTip[];
  audioUrl?: string;
  audioPlaying?: boolean;
}

export interface StoredConversation {
  userId: string;
  companion: CompanionProfile;
  messages: ChatMessage[];
  learnedSlang: SlangTip[];
  lastUpdated: number;
}

export interface DailyUsage {
  count: number;
  date: string;
  limit: number;
}

