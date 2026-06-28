import { DEFAULT_SPEECH_SETTINGS, normalizeSpeechSettings } from './storage.js';
import { clamp } from './math.js';

export function getSpeechText(word, accent = 'us') {
  let text = String(word || '').trim();
  // Expand parenthesised optional letters, e.g. "distil(l)" -> "distill" (uk) / "distil" (us).
  // The previous version also had two literal-String regexes (/ise\/-ize/ and /er\/-tre/)
  // that never matched real headwords — the slash-split below already handles
  // "analyse/-yze" style alternations by taking the first form.
  text = text.replace(/\(([a-z]+)\)/gi, (_, optional) => {
    if (optional.length <= 2) return accent === 'uk' ? optional : '';
    return optional;
  });
  // Take the first slash-separated form (e.g. "hi/hey" -> "hi") and strip punctuation.
  text = text.split('/')[0].replace(/[^A-Za-z .'-]/g, '').trim();
  return text || word;
}

export function getEnglishVoices(voices) {
  return voices
    .filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
    .sort((left, right) => {
      const leftName = `${left.name} ${left.lang}`.toLowerCase();
      const rightName = `${right.name} ${right.lang}`.toLowerCase();
      const score = (name) => {
        let value = 0;
        if (/samantha|alex|ava|allison|susan|victoria|karen|daniel|serena|tessa|moira|fiona|arthur|joelle/.test(name)) value += 8;
        if (/premium|enhanced|neural|natural/.test(name)) value += 4;
        if (/compact|novelty|fred|ralph|albert|bad news|bells|boing|bubbles|cellos|jester|organ|trinoids|whisper|zarvox/.test(name)) value -= 8;
        return value;
      };
      return score(rightName) - score(leftName) || left.name.localeCompare(right.name);
    });
}

export function chooseEnglishVoice(voices, accent = 'us', preferredVoiceURI = '') {
  const englishVoices = getEnglishVoices(voices);
  if (!englishVoices.length) return null;
  const preferred = englishVoices.find((voice) => voice.voiceURI === preferredVoiceURI);
  if (preferred) return preferred;
  const target = accent === 'uk' ? 'en-gb' : 'en-us';
  return (
    englishVoices.find((voice) => voice.lang?.toLowerCase() === target) ||
    englishVoices.find((voice) => voice.lang?.toLowerCase().startsWith(target)) ||
    englishVoices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
    englishVoices[0]
  );
}

export function speakWord(word, settings = DEFAULT_SPEECH_SETTINGS, voices = []) {
  if (typeof window === 'undefined') return;
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance || !word) return;
  const speechSettings = normalizeSpeechSettings(settings);
  window.speechSynthesis.cancel();
  const text = getSpeechText(word, speechSettings.accent);
  const repeat = clamp(Number(speechSettings.repeat) || 1, 1, 3);
  const voice = chooseEnglishVoice(voices, speechSettings.accent, speechSettings.voiceURI);

  for (let index = 0; index < repeat; index += 1) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechSettings.accent === 'uk' ? 'en-GB' : 'en-US';
    utterance.rate = clamp(Number(speechSettings.rate) || DEFAULT_SPEECH_SETTINGS.rate, 0.62, 1.05);
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
}

export { DEFAULT_SPEECH_SETTINGS, normalizeSpeechSettings };
