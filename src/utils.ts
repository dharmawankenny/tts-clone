import { AudioTrackData, SentenceChunk, SentencePosition, SpeechChunk } from "./types";

export function getParagraphs(text: string) {
  return text.split('\n').map(p => p?.trim());
}

export function getSentences(paragraph: string) {
  return paragraph.split('.').map(sentence => sentence.trim()).filter(sentence => sentence);
}

export function getDisplayParagraphs(text: string) {
  return getParagraphs(text).map(p => p ? `${getSentences(p).join('. ')}${p.endsWith('.') ? '.' : ''}` : '');
}

export function getSentencesAndPositions(text: string) {
  const paragraphs = getParagraphs(text).filter(p => p);
  const sentences: Array<string> = [];
  const positions: Array<SentencePosition> = [];
  paragraphs.forEach((p, pIdx) => {
    const pSentences = getSentences(p);
    let offset = 0;
    pSentences.forEach(s => {
      sentences.push(s);
      positions.push({ paragraphIdx: pIdx, offset });
      offset += s.length + 2;
    });
  });
  return {
    sentences,
    positions,
  };
}

export function getParagraphTextNodes(paragraphs: string[], root: HTMLElement): Array<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const paragraphNodes: Array<Text> = [];

  let textNode = walker.nextNode();
  let pIdx = 0;
  while (textNode) {
    const start = textNode.textContent?.indexOf(paragraphs[pIdx]) ?? -1;
    if (start !== -1) {
      paragraphNodes.push(textNode as Text);
      textNode = walker.nextNode();
      pIdx++;
    } else {
      textNode = walker.nextNode();
    }
  }

  return paragraphNodes;
}

function getTextRects(text: string, offset: number, node: Text) {
  if (!node) return [];
  const start = node.textContent?.indexOf(text, offset) ?? -1;
  if (start === -1) return [];
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  return range.getClientRects();
}

export function getSentenceRects(sentence: SentenceChunk, paragraphNodes: Array<Text>, rootNode: HTMLElement) {
  const rootRect = rootNode.getBoundingClientRect();
  const rects = getTextRects(sentence.value, sentence.position.offset, paragraphNodes[sentence.position.paragraphIdx]);

  return Array.from(rects).map(rect => ({
    top: rect.top - rootRect.top - 2,
    left: rect.left - rootRect.left - 3,
    width: rect.width + 6,
    height: rect.height + 4,
  }));
}

export function getWordRects(word: SpeechChunk, sentence: SentenceChunk, paragraphNodes: Array<Text>, rootNode: HTMLElement) {
  const rootRect = rootNode.getBoundingClientRect();
  const rects = getTextRects(word.value, sentence.position.offset + word.start, paragraphNodes[sentence.position.paragraphIdx]);
  return Array.from(rects).map(rect => ({
    top: rect.top - rootRect.top - 2,
    left: rect.left - rootRect.left - 3,
    width: rect.width + 6,
    height: rect.height + 4,
  }));
}

export function audioStreamToArrayBuffer(audioStream: string) {
  const decodedData = atob(audioStream);
  const uintArray = new Uint8Array(decodedData.length);
  for (let i = 0; i < decodedData.length; i++) {
    uintArray[i] = decodedData.charCodeAt(i);
  }
  return uintArray.buffer;
}

export function buildChunkProgress(data: Array<AudioTrackData>): Array<Array<number>> {
  const chunkProgress = new Array<Array<number>>(data.length).fill([]).map<Array<number>>(() => []);

  let totalDuration = 0;
  for (let i = 0; i < data.length; i++) {
    const sentenceTrack = data[i];
    const sentence = sentenceTrack.speechMarks.chunks[0];
    if (sentence) {
      totalDuration += sentence.endTime;
    }
  }

  let prevSentencesDuration = 0;
  for (let i = 0; i < data.length; i++) {
    const sentenceTrack = data[i];
    const wordChunks = sentenceTrack.speechMarks.chunks[0]?.chunks;

    if (wordChunks) {
      for (let j = 0; j < wordChunks.length; j++) {
        chunkProgress[i].push((prevSentencesDuration + wordChunks[j].endTime) / totalDuration);
      }

      prevSentencesDuration += sentenceTrack.speechMarks.chunks[0].endTime;
    }
  }

  return chunkProgress;
}

export async function playAudio(data: AudioTrackData, context: AudioContext, wordChunkIdx?: number) {
  const audioSource = context.createBufferSource();
  audioSource.buffer = await context.decodeAudioData(audioStreamToArrayBuffer(data.audioStream));
  audioSource.connect(context.destination);

  let startOffset = 0;
  if (wordChunkIdx && data.speechMarks.chunks[0]?.chunks?.[wordChunkIdx]) {
    startOffset = data.speechMarks.chunks[0].chunks[wordChunkIdx].startTime / 1000;
  }
  audioSource.start(0, startOffset);

  return audioSource;
}
