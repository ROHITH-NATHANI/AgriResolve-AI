import { useCallback, useEffect, useMemo, useState } from 'react';

const stripMarkdownForSpeech = (text: string) => {
  // remove code blocks and inline code
  let cleaned = text.replace(/```[\s\S]*?```/g, ' ');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // remove links: [label](url) -> label
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

  // remove common markdown tokens
  cleaned = cleaned.replace(/[*#_>~-]/g, ' ');

  // collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const hasSupport = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }, []);

  useEffect(() => {
    if (!hasSupport) return;

    const loadVoices = () => {
      try {
        setVoices(window.speechSynthesis.getVoices());
      } catch {
        setVoices([]);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {
        // ignore
      }
    };
  }, [hasSupport]);

  const cancel = useCallback(() => {
    if (!hasSupport) return;
    try {
      window.speechSynthesis.cancel();
    } finally {
      setIsSpeaking(false);
    }
  }, [hasSupport]);

  const buildChunks = (text: string) => {
    const maxLen = 220;
    const sentences = text.split(/(?<=[.!?])\s+/g).filter(Boolean);
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if ((buf + ' ' + s).trim().length > maxLen) {
        if (buf.trim()) chunks.push(buf.trim());
        buf = s;
      } else {
        buf = `${buf} ${s}`.trim();
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.length ? chunks : [text];
  };

  const speak = useCallback(
    (text: string, lang: string = 'en-US') => {
      if (!hasSupport) return;

      // Cancel any current speech
      window.speechSynthesis.cancel();

      const cleanText = stripMarkdownForSpeech(text);
      if (!cleanText) return;

      const preferredVoice =
        voices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()) && v.name.includes('Google')) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()));

      const chunks = buildChunks(cleanText);
      let idx = 0;

      const speakNext = () => {
        if (idx >= chunks.length) {
          setIsSpeaking(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[idx]);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => {
          setIsSpeaking(true);
          try {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          } catch {
            // ignore
          }
        };

        utterance.onend = () => {
          idx += 1;
          speakNext();
        };

        utterance.onerror = () => {
          idx += 1;
          speakNext();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    },
    [hasSupport, voices]
  );

  return { isSpeaking, voices, speak, cancel, hasSupport };
};
