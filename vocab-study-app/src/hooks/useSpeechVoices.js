import { useEffect, useState } from 'react';

export function useSpeechVoices() {
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      if (window.speechSynthesis.onvoiceschanged === load) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  return voices;
}
