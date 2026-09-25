import React, { useState, useRef, useEffect } from 'react';
import './VoiceListingInput.css';

// ── Nyanja / Bemba keyword mappings ───────────────────────
const KEYWORD_MAP = {
  // Nyanja numbers
  'imodzi': '1', 'iwiri': '2', 'itatu': '3', 'inayi': '4', 'isanu': '5',
  'isanu ndi imodzi': '6', 'isanu ndi iwiri': '7', 'isanu ndi itatu': '8',
  // Bemba numbers
  'cimo': '1', 'fibili': '2', 'fitatu': '3', 'fine': '4', 'fisano': '5', 'mutanda': '6', 'cine lubala': '7', 'cine konsekonse': '8', 'pabula': '9', 'ikumi linmo': '10',
  // Nyanja charcoal terms
  'maalasha': 'charcoal', 'masaka': 'bags', 'saka': 'bag',
  // Bemba charcoal terms
  'amalaasha': 'charcoal', 'amasaka': 'bags', 'isaka': 'bag',
  // Common price words
  'kwacha': 'K', 'ngwe': '',
  // Units
  'umufuko': 'bag', 'tini': 'tin', 'kilogram': 'kg',
};

const applyKeywordMap = (transcript) => {
  let result = transcript.toLowerCase().trim();
  Object.entries(KEYWORD_MAP).forEach(([local, english]) => {
    result = result.replace(new RegExp(`\\b${local}\\b`, 'gi'), english);
  });
  return result.replace(/\s+/g, ' ');
};

// Try to extract price from transcript
const extractPrice = (text) => {
  const patterns = [
    /K\s*(\d+)/i,
    /(\d+)\s*K(?:\s|$)/i,
    /kwacha\s*(\d+)/i,
    /(\d+)\s*kwacha/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
};

// Try to extract quantity from transcript
const extractQuantity = (text) => {
  const patterns = [
    /(\d+)\s*(?:bags?|tins?|kg)/i,
    /(\d+)\s*(?:amasaka|umufuko|tini)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
};

// Extract title - improved regex to preserve product names
const extractTitle = (text) => {
  if (text.includes('charcoal')) {
    const charcoalIndex = text.indexOf('charcoal');
    const start = Math.max(0, charcoalIndex - 20);
    const end = Math.min(text.length, charcoalIndex + 50);
    const context = text.substring(start, end).trim();
    // Remove only: digits, 'bag'/'bags'/'tin'/'tins'/'kg', 'K', 'each', and commas
    const cleaned = context
      .replace(/\b(?:bags?|tins?|kg|K|each)\b/gi, '')
      .replace(/\d+/g, '')
      .replace(/[,]/g, '')
      .trim();
    if (cleaned.length > 3) return cleaned.substring(0, 60);
    return 'Charcoal';
  }
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    return words.slice(0, 3).join(' ').substring(0, 60);
  }
  return '';
};

// Extract neighbourhood/location from transcript
const extractNeighbourhood = (text) => {
  // Common Lusaka neighbourhoods
  const neighbourhoods = [
    'kalingalinga', 'kanyama', 'mtendere', 'chilenje',
    'matero', 'bauleni', 'chelstone', 'woodlands',
    'kabwata', 'libala', 'lusaka cbd', 'city center',
  ];
  
  const lowerText = text.toLowerCase();
  for (const neighbourhood of neighbourhoods) {
    if (lowerText.includes(neighbourhood)) {
      return neighbourhood.charAt(0).toUpperCase() + neighbourhood.slice(1);
    }
  }
  
  return '';
};

export default function VoiceListingInput({ onResult, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | listening | processing | done | error
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [transcript, setTranscript] = useState('');
  const [extracted, setExtracted] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Default, will be updated on start
    recognition.maxAlternatives = 3;

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      const finalTranscript = final || interim;
      lastTranscriptRef.current = finalTranscript;
      setTranscript(finalTranscript);
    };

    recognition.onend = () => {
      if (lastTranscriptRef.current.trim()) {
        processTranscript(lastTranscriptRef.current);
      } else {
        setErrorMsg('No speech detected. Please try again.');
        setPhase('error');
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      const msgs = {
        'not-allowed': 'Microphone access denied. Please allow microphone in browser settings.',
        'no-speech': 'No speech detected. Please try again.',
        'network': 'Network error. Please try again.',
        'aborted': 'Listening stopped.',
      };
      setErrorMsg(msgs[e.error] || `Speech error: ${e.error}`);
      setPhase('error');
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const processTranscript = (finalTranscript) => {
    setPhase('processing');
    
    setTimeout(() => {
      const mapped = applyKeywordMap(finalTranscript);
      const result = {
        rawTranscript: finalTranscript,
        mappedText: mapped,
        suggestedTitle: extractTitle(mapped),
        suggestedPrice: extractPrice(mapped),
        suggestedQty: extractQuantity(mapped),
        suggestedNeighbourhood: extractNeighbourhood(mapped),
      };
      setExtracted(result);
      setPhase('done');
    }, 300);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    
    // Set language before starting
    recognitionRef.current.lang = selectedLanguage;
    
    setTranscript('');
    lastTranscriptRef.current = '';
    setExtracted({});
    setErrorMsg('');
    setPhase('listening');
    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const handleUse = () => {
    const filtered = {
      suggestedTitle: extracted.suggestedTitle || '',
      suggestedPrice: extracted.suggestedPrice || '',
      suggestedQty: extracted.suggestedQty || '',
      suggestedNeighbourhood: extracted.suggestedNeighbourhood || '',
    };
    onResult(filtered);
    onClose();
  };

  const handleRetry = () => {
    setPhase('idle');
    setTranscript('');
    lastTranscriptRef.current = '';
    setExtracted({});
  };

  if (!supported) return (
    <div className="voice-listing-unsupported">
      <div className="voice-listing-unsupported-icon">🎤</div>
      <p className="voice-listing-unsupported-text">
        Voice input is not supported in this browser. Please use Chrome or Edge.
      </p>
      <button onClick={onClose} className="btn btn-outline voice-listing-unsupported-button">
        Use Text Input
      </button>
    </div>
  );

  return (
    <div className="voice-listing-container">
      <div className="voice-listing-header">
        <h3 className="voice-listing-title">Voice Listing</h3>
        <button onClick={onClose} className="voice-listing-close-btn">✕</button>
      </div>

      <p className="voice-listing-instructions">
        Speak your listing in <strong>English, Nyanja, or Bemba</strong>.<br />
        Example: <em>"charcoal, 10 bags, K95 each, Kanyama"</em>
      </p>

      {/* Language selector */}
      {(phase === 'idle' || phase === 'error') && (
        <div className="voice-listing-language-group">
          <label className="voice-listing-language-label">Language</label>
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="voice-listing-language-select"
          >
            <option value="en-US">English (United States)</option>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="ny-ZM">Nyanja (Zambia)</option>
            <option value="bem-ZM">Bemba (Zambia)</option>
          </select>
          <p className="voice-listing-language-hint">
            ⓘ Bemba/Nyanja support varies by browser. Chrome on Android has best support.
          </p>
        </div>
      )}

      {/* Mic button */}
      {(phase === 'idle' || phase === 'error') && (
        <div className="voice-listing-mic-container">
          <button onClick={startListening} className="voice-listing-mic-button">🎙️</button>
          <p className="voice-listing-mic-label">Tap to speak</p>
        </div>
      )}

      {/* Listening animation */}
      {phase === 'listening' && (
        <div className="voice-listing-listening-container">
          <button onClick={stopListening} className="voice-listing-listening-button">🎙️</button>
          <p className="voice-listing-listening-status">Listening... tap to stop</p>
          <p className="voice-listing-language-display">
            Language: {selectedLanguage === 'en-US' ? 'English (US)' : selectedLanguage === 'en-GB' ? 'English (UK)' : selectedLanguage === 'ny-ZM' ? 'Nyanja' : 'Bemba'}
          </p>
          {transcript && (
            <p className="voice-listing-transcript-preview">"{transcript}"</p>
          )}
        </div>
      )}

      {/* Processing */}
      {phase === 'processing' && (
        <div className="voice-listing-processing-container">
          <div className="voice-listing-spinner" />
          <p className="voice-listing-processing-text">Processing speech...</p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="voice-listing-error">{errorMsg}</div>
      )}

      {/* Results */}
      {phase === 'done' && (
        <div className="voice-listing-results">
          <div className="voice-listing-raw-transcript">
            <p className="voice-listing-raw-label">You said</p>
            <p className="voice-listing-raw-text">"{extracted.rawTranscript}"</p>
          </div>

          {/* Show detected fields */}
          <div className="voice-listing-fields-grid">
            {[
              extracted.suggestedTitle && { label: 'Title detected', value: extracted.suggestedTitle },
              extracted.suggestedPrice && { label: 'Price detected', value: `K${extracted.suggestedPrice}` },
              extracted.suggestedQty && { label: 'Quantity detected', value: extracted.suggestedQty },
              extracted.suggestedNeighbourhood && { label: 'Location detected', value: extracted.suggestedNeighbourhood },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} className="voice-listing-field-item">
                <span className="voice-listing-field-label">{label}</span>
                <span className="voice-listing-field-value">{value}</span>
              </div>
            ))}
          </div>

          {/* Show partial match warning */}
          {!extracted.suggestedTitle && (
            <div className="voice-listing-warning">
              <p className="voice-listing-warning-text">
                ℹ️ Could not fully extract details. Fill in the rest manually.
              </p>
            </div>
          )}

          <div className="voice-listing-actions">
            <button onClick={handleUse} className="btn btn-ember voice-listing-use-button">
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