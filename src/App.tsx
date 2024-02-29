import {useState} from 'react'
import './App.css'
import useAudioEngine from "./useAudioEngine.ts";
import useHighlighter from "./useHighlighter.ts";
import { getDisplayParagraphs } from './utils.ts';

function App() {
  const [text, setText] = useState('');
  const [isUpdated, setIsUpdated] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const { isLoading, isPlaying, progress, highlightedSentence, highlightedWord, load, reset, play, pause, hasPrev, prev, hasNext, next } = useAudioEngine();

  const { paragraphs, setParagraphs, textBoxRef, sentenceHighlights, wordHighlights } = useHighlighter(highlightedSentence, highlightedWord);

  return (
    <>
      <h1 className="title">Speechify Lite</h1>
      <div className="content">
        <textarea
          value={text}
          onChange={evt => {
            setText(evt.target.value);
            setIsUpdated(true);
          }}
          disabled={!isEditing}
          className="text-input"
        />
        {!isEditing && (
          <div
            ref={textBoxRef}
            role="button"
            onClick={() => {
              if (!isLoading && !isPlaying) {
                setIsEditing(true);
                setParagraphs([]);
              }
            }}
            className="text-box"
          >
            {sentenceHighlights.map((style) => (
              <div
                className="sentence-highlight"
                style={style}
                key={`sentence-${style.top}-${style.left}-${style.width}-${style.height}`}
              />
            ))}
            {wordHighlights.map((style) => (
              <div
                className="word-highlight"
                style={style}
                key={`word-${style.top}-${style.left}-${style.width}-${style.height}`}
              />
            ))}
            {paragraphs.map((paragraph, pIndex) => (
              <p key={`${pIndex}-${paragraph}`}>
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-active"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
      <div className="controls">
        <button
          onClick={prev}
          disabled={isLoading || !hasPrev || progress === 100}
        >
          Prev
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setParagraphs(getDisplayParagraphs(text));

            if (isUpdated) {
              reset();
              load(text);
              setIsUpdated(false);
            }

            if (isPlaying) {
              pause();
            } else {
              void play();
            }
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : isPlaying ? 'Playing...' : isUpdated ? 'Play' : progress === 100 ? 'Restart' : 'Resume'}
        </button>
        <button
          onClick={next}
          disabled={isLoading || !hasNext || progress === 100}
        >
          Next
        </button>
      </div>
    </>
  )
}

export default App
