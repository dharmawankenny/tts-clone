import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SentenceChunk, SpeechChunk } from "./types";
import { getParagraphTextNodes, getSentenceRects, getWordRects } from "./utils";

interface HighlightStyle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function useHighlighter(
  sentence?: SentenceChunk,
  word?: SpeechChunk
) {
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [paragraphs, setParagraphs] = useState<Array<string>>([]);
  const [paragraphNodes, setParagraphNodes] = useState<Array<Text>>([]);
  const [sentenceHighlights, setSentenceHighlights] = useState<Array<HighlightStyle>>([]);
  const [wordHighlights, setWordHighlights] = useState<Array<HighlightStyle>>([]);
  
  useEffect(() => {
    if (sentence && paragraphNodes && textBoxRef.current) {
      setSentenceHighlights(getSentenceRects(sentence, paragraphNodes, textBoxRef.current));
    } else {
      setSentenceHighlights([]);
    }
  }, [sentence, paragraphNodes]);
  
  useEffect(() => {
    if (word && sentence && paragraphNodes && textBoxRef.current) {
      setWordHighlights(getWordRects(word, sentence, paragraphNodes, textBoxRef.current));
    } else {
      setWordHighlights([]);
    }
  }, [word, sentence, paragraphNodes]);

  useLayoutEffect(() => {
    if (paragraphs && textBoxRef.current) {
      setParagraphNodes(getParagraphTextNodes(paragraphs.filter(p => p), textBoxRef.current));
    }
  }, [paragraphs]);

  return {
    paragraphs,
    setParagraphs,
    textBoxRef,
    sentenceHighlights,
    wordHighlights,
  };
}
