import {useCallback, useRef, useState} from "react";
import { buildChunkProgress, getSentencesAndPositions, playAudio } from "./utils";
import { AudioTrackData, Playback, SentenceChunk, SentenceContext, SpeechChunk } from "./types";
import { loadTrack } from "./api";

export default function useAudioEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [progress, setProgress] = useState(0);
  const [highlightedSentence, setHighlightedSentence] = useState<SentenceChunk>();
  const [highlightedWord, setHighlightedWord] = useState<SpeechChunk>();

  const { isLoading, loadSentences, getTrack, resetTrack } = useAudioLoader();
  const playback = useRef<Playback>({ sentenceIdx: 0, wordChunkIdx: 0, progressTimeoutId: undefined });
  const sentenceContext = useRef<SentenceContext>({ sentences: [], positions: [], wordChunkProgress: [] });
  const audioContext = useRef<AudioContext>();
  const audioSource = useRef<AudioBufferSourceNode>();
  const endedAbortController = useRef<AbortController>();

  const load = useCallback((text: string) => {
    const { sentences, positions } = getSentencesAndPositions(text);
    sentenceContext.current = { sentences, positions, wordChunkProgress: [] };
    loadSentences(sentences, data => {
      sentenceContext.current.wordChunkProgress = buildChunkProgress(data);
    });
  }, [loadSentences]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setHighlightedSentence(undefined);
    setHighlightedWord(undefined);
    if (playback.current.progressTimeoutId) clearTimeout(playback.current.progressTimeoutId);
    playback.current = { sentenceIdx: 0, wordChunkIdx: 0, progressTimeoutId: undefined };
    sentenceContext.current = { sentences: [], positions: [], wordChunkProgress: [] };
    if (audioSource.current) {
      audioSource.current.stop();
      audioSource.current.disconnect();
      audioSource.current = undefined;
    }
    resetTrack();
  }, [resetTrack]);

  const updatePlaybackProgress = useCallback(() => {
    if (sentenceContext.current?.wordChunkProgress[playback.current.sentenceIdx]?.[playback.current.wordChunkIdx]) {
      setProgress(sentenceContext.current.wordChunkProgress[playback.current.sentenceIdx][playback.current.wordChunkIdx] * 100);
    }
  }, []);
  const syncPlaybackProgress = useCallback(async () => {
    const currentTrack = await getTrack(playback.current.sentenceIdx);
    const chunks = currentTrack?.speechMarks.chunks[0].chunks;
  
    if (chunks && chunks[playback.current.wordChunkIdx]) {
      updatePlaybackProgress();
      setHighlightedWord(chunks[playback.current.wordChunkIdx]);

      if (chunks[playback.current.wordChunkIdx + 1]) {
        const timeout = chunks[playback.current.wordChunkIdx + 1].startTime - chunks[playback.current.wordChunkIdx].startTime;
        playback.current.progressTimeoutId = setTimeout(() => {
          playback.current.wordChunkIdx++;
          syncPlaybackProgress();
        }, timeout);
      }
    } else {
      playback.current.progressTimeoutId = undefined;
    }
  }, [getTrack, updatePlaybackProgress]);

  const play = useCallback(async () => {
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
    }

    const audioData = await getTrack(playback.current.sentenceIdx);
    const trackCount = sentenceContext.current?.sentences.length;

    if (audioData) {
      setIsPlaying(true);
      setHasPrev(playback.current.sentenceIdx > 0);
      setHasNext(playback.current.sentenceIdx < trackCount - 1);
      setHighlightedSentence({
        value: sentenceContext.current.sentences[playback.current.sentenceIdx],
        position: sentenceContext.current.positions[playback.current.sentenceIdx],
      });
      
      audioSource.current = await playAudio(audioData, audioContext.current, playback.current.wordChunkIdx);
      endedAbortController.current = new AbortController();
      audioSource.current.addEventListener('ended', () => {
        const currentTrackCount = sentenceContext.current?.sentences.length;
        if (currentTrackCount > 0) {
          if (playback.current.progressTimeoutId) {
            clearTimeout(playback.current.progressTimeoutId);
            playback.current.progressTimeoutId = undefined;
          }
          if (playback.current.sentenceIdx + 1 < currentTrackCount) {
            playback.current.sentenceIdx++;
            playback.current.wordChunkIdx = 0;
            play();
          } else {
            setIsPlaying(false);
            playback.current.sentenceIdx = 0;
            playback.current.wordChunkIdx = 0;
          }
        }
      }, { signal: endedAbortController.current.signal });
  
      void syncPlaybackProgress();
    }
  }, [getTrack, syncPlaybackProgress]);

  const pause = useCallback(() => {
    if (playback.current.progressTimeoutId) clearTimeout(playback.current.progressTimeoutId);
    if (endedAbortController.current) endedAbortController.current.abort();
    if (audioSource.current) {
      audioSource.current.stop();
      audioSource.current.disconnect();
    }
    setIsPlaying(false);
  }, []);

  const prev = useCallback(() => {
    if (playback.current.sentenceIdx === 0) return;
    pause();
    playback.current.sentenceIdx--;
    playback.current.wordChunkIdx = 0;
    if (playback.current.sentenceIdx === 0) {
      setHasPrev(false);
    }
    void play();
  }, [pause, play]);

  const next = useCallback(() => {
    const trackCount = sentenceContext.current?.sentences.length ?? 0;
    if (trackCount > 0 && playback.current.sentenceIdx === trackCount - 1) return;
    pause();
    playback.current.sentenceIdx++;
    playback.current.wordChunkIdx = 0;
    if (trackCount > 0 && playback.current.sentenceIdx === trackCount - 1) {
      setHasNext(false);
    }
    void play();
  }, [pause, play]);

  return {
    isPlaying,
    isLoading,
    progress,
    highlightedSentence,
    highlightedWord,
    load,
    reset,
    play,
    pause,
    prev,
    hasPrev,
    next,
    hasNext,
  };
}

function useAudioLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const trackPromises = useRef<Array<Promise<AudioTrackData>>>();
  const fetchAbortController = useRef<AbortController>();

  const loadSentences = useCallback((sentences: string[], onAllFetched: (data: AudioTrackData[]) => void) => {
    setIsLoading(true);
    fetchAbortController.current = new AbortController();
    const audioFilePromises = sentences.map(sentence => loadTrack(sentence, fetchAbortController.current!));
    trackPromises.current = audioFilePromises;
    // safe to do here because we already have abort controller on the loadTrack itself,
    // so if there's a reset() call when we're still fetching, it will abort the fetch
    // and this Promise.all will be rejected.
    Promise.all(audioFilePromises).then(onAllFetched);
    setIsLoading(false);
  }, []);

  const getTrack = useCallback(async (index: number) => {
    const trackPromise = trackPromises.current?.[index];
    if (!trackPromise) return;
    setIsLoading(true);
    const track = await trackPromise;
    setIsLoading(false)
    return track;
  }, []);

  const resetTrack = useCallback(() => {
    if (fetchAbortController.current) {
      fetchAbortController.current?.abort();
      fetchAbortController.current = undefined;
    }
    trackPromises.current = undefined;
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    loadSentences,
    getTrack,
    resetTrack,
  };
}
