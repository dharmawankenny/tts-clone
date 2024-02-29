export interface SpeechChunk {
  chunks?: SpeechChunk[];
  type: 'sentence' | 'word';
  value: string;
  startTime: number;
  endTime: number;
  start: number;
  end: number;
}

export interface AudioTrackData {
  audioStream: string;
  format: string;
  speechMarks: {
    chunks: SpeechChunk[];
  };
}

export interface Playback {
  sentenceIdx: number;
  wordChunkIdx: number;
  progressTimeoutId?: ReturnType<typeof setTimeout>;
}

export interface SentencePosition {
  paragraphIdx: number;
  offset: number;
}

export interface SentenceChunk {
  value: string;
  position: SentencePosition;
}

export interface SentenceContext {
  sentences: string[];
  positions: SentencePosition[];
  wordChunkProgress: number[][];
}
