import { useState, useRef, useEffect } from 'react';
import { parseListing, parseBestAlternative } from './parseListing';
import './VoiceListingInput.css';

// Browsers only recognise English reliably for this use; Nyanja and
// Bemba are not offered by any browser's speech service.
const LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-US', label: 'English (US)' },
];

const MAX_LISTEN_MS = 15000; // safety stop if the browser never ends the session

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access denied. Allow the microphone in your browser settings.',
  'service-not-allowed': 'Voice input is blocked in this browser. Please type your listing instead.',
  'audio-capture': 'No microphone was found. Check that your phone or computer has one.',
  'no-speech': 'No speech detected. Tap the microphone and speak clearly.',
  'network': 'Voice input needs an internet connection. Check your data and try again.',
  'language-not-supported': 'This browser does not support that language. Try English (UK).',
};

const getRecognitionClass = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null;

const neighbourhoodLabel = (value) => (value === 'Lusaka_CBD' ? 'Lusaka CBD' : value);

// Join the n-th alternative of every result into one candidate sentence
const collectAlternatives = (results) => {
  const count = Math.max(...Array.from(results, (r) => r.length), 1);
  const alternatives = [];
  for (let j = 0; j < count; j++) {
    const sentence = Array.from(results, (r) => (r[j] || r[0])?.transcript || '').join(' ').trim();
    if (sentence && !alternatives.includes(sentence)) alternatives.push(sentence);
  }
  return alternatives;
};

export default function VoiceListingInput({ onResult, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | listening | done | error
  const [language, setLanguage] = useState('en-GB');
  const [liveText, setLiveText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef(null);
  const alternativesRef = useRef([]);
  const errorRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const RecognitionClass = getRecognitionClass();
  const parsed = transcript ? parseListing(transcript) : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      recognitionRef.current?.abort();
    };
  }, []);

  const fail = (message) => {
    setErrorMsg(message);
    setPhase('error');
  };

  const startListening = () => {
    if (!RecognitionClass) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      fail(ERROR_MESSAGES.network);
      return;
    }

    // A fresh instance per attempt avoids stuck sessions on Android Chrome
    recognitionRef.current?.abort();
    const recognition = new RecognitionClass();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    alternativesRef.current = [];
    errorRef.current = null;

    recognition.onresult = (e) => {
      const alternatives = collectAlternatives(e.results);
      alternativesRef.current = alternatives;
      if (mountedRef.current) setLiveText(alternatives[0] || '');
    };

    recognition.onerror = (e) => {
      // 'aborted' happens when we stop it ourselves — not a user-facing error
      if (e.error === 'aborted') return;
      errorRef.current = ERROR_MESSAGES[e.error] || `Voice input failed (${e.error}). Please try again or type instead.`;
    };

    recognition.onend = () => {
      clearTimeout(timerRef.current);
      if (!mountedRef.current || recognitionRef.current !== recognition) return;
      const best = parseBestAlternative(alternativesRef.current);
      if (best) {
        setTranscript(best.transcript);
        setPhase('done');
      } else {
        fail(errorRef.current || ERROR_MESSAGES['no-speech']);
      }
    };

    recognitionRef.current = recognition;
    setLiveText('');
    setTranscript('');
    setErrorMsg('');
    setPhase('listening');

    try {
      recognition.start();
      timerRef.current = setTimeout(() => recognition.stop(), MAX_LISTEN_MS);
    } catch {
      fail('Could not start the microphone. Please try again.');
    }
  };

  const stopListening = () => {
    clearTimeout(timerRef.current);
    recognitionRef.current?.stop();
  };

  const handleClose = () => {
    recognitionRef.current?.abort();
    onClose();
  };

  const handleUse = () => {
    if (!parsed) return;
    onResult({
      suggestedTitle: parsed.title || '',
      suggestedPrice: parsed.price !== null ? String(parsed.price) : '',
      suggestedQty: parsed.quantity !== null ? String(parsed.quantity) : '',
      suggestedUnit: parsed.unit || '',
      suggestedNeighbourhood: parsed.neighbourhood || '',
    });
    onClose();
  };

  const handleRetry = () => {
    setPhase('idle');
    setTranscript('');
    setLiveText('');
  };

  if (!RecognitionClass) return (
    <div className="voice-listing-unsupported">
      <div className="voice-listing-unsupported-icon">🎤</div>
      <p className="voice-listing-unsupported-text">
        Voice input is not supported in this browser. Please use Chrome, Edge or Safari, or type your listing.
      </p>
      <button onClick={onClose} className="btn btn-outline voice-listing-unsupported-button">
        Use Text Input
      </button>
    </div>
  );

  const fields = parsed ? [
    { label: 'Title', value: parsed.title },
    { label: 'Price', value: parsed.price !== null ? `K${parsed.price}` : null },
    { label: 'Quantity', value: parsed.quantity },
    { label: 'Unit', value: parsed.unit },
    { label: 'Location', value: parsed.neighbourhood && neighbourhoodLabel(parsed.neighbourhood) },
  ] : [];
  const found = fields.filter((f) => f.value !== null && f.value !== '');
  const missing = fields.filter((f) => f.value === null || f.value === '').map((f) => f.label.toLowerCase());

  return (
    <div className="voice-listing-container">
      <div className="voice-listing-header">
        <h3 className="voice-listing-title">Voice Listing</h3>
        <button onClick={handleClose} className="voice-listing-close-btn" aria-label="Close voice input">✕</button>
      </div>

      <p className="voice-listing-instructions">
        Say the <strong>quantity, price and area</strong> in English.<br />
        Example: <em>"Charcoal, 10 bags, K95 each, Kanyama"</em>
      </p>

      {(phase === 'idle' || phase === 'error') && (
        <>
          <div className="voice-listing-language-group">
            <label className="voice-listing-language-label" htmlFor="voice-language">Language</label>
            <select
              id="voice-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="voice-listing-language-select"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <p className="voice-listing-language-hint">
              ⓘ Needs an internet connection. Numbers can be said as words, e.g. "ninety five kwacha".
            </p>
          </div>

          <div className="voice-listing-mic-container">
            <button onClick={startListening} className="voice-listing-mic-button" aria-label="Start speaking">🎙️</button>
            <p className="voice-listing-mic-label">Tap to speak</p>
          </div>
        </>
      )}

      {phase === 'listening' && (
        <div className="voice-listing-listening-container">
          <button onClick={stopListening} className="voice-listing-listening-button" aria-label="Stop listening">🎙️</button>
          <p className="voice-listing-listening-status">Listening... tap to stop</p>
          {liveText && <p className="voice-listing-transcript-preview">"{liveText}"</p>}
        </div>
      )}

      {phase === 'error' && <div className="voice-listing-error">{errorMsg}</div>}

      {phase === 'done' && parsed && (
        <div className="voice-listing-results">
          <div className="voice-listing-raw-transcript">
            <label className="voice-listing-raw-label" htmlFor="voice-transcript">
              You said — fix any mistakes here
            </label>
            <textarea
              id="voice-transcript"
              className="voice-listing-edit-input"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={2}
            />
          </div>

          {found.length > 0 && (
            <div className="voice-listing-fields-grid">
              {found.map(({ label, value }) => (
                <div key={label} className="voice-listing-field-item">
                  <span className="voice-listing-field-label">{label}</span>
                  <span className="voice-listing-field-value">{value}</span>
                </div>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <div className="voice-listing-warning">
              <p className="voice-listing-warning-text">
                ℹ️ Not detected: {missing.join(', ')}. Edit the text above, retry, or fill these in on the form.
              </p>
            </div>
          )}

          <div className="voice-listing-actions">
            <button onClick={handleUse} className="btn btn-ember voice-listing-use-button" disabled={found.length === 0}>
              ✅ Use This
            </button>
            <button onClick={handleRetry} className="btn btn-outline voice-listing-retry-button">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
