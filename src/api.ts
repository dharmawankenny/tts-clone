import { AudioTrackData } from "./types";

export async function loadTrack(sentence: string, abortController: AbortController): Promise<AudioTrackData> {
  const res = await fetch('https://audio.api.speechify.com/generateAudioFiles', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audioFormat: "ogg",
      paragraphChunks: [sentence],
      voiceParams: {
        name: "Davis",
        engine: "azure",
        languageCode:"en-US",
      },
    }),
    signal: abortController.signal,
  });
  return await res.json() as AudioTrackData;
}
