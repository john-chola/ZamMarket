import React, { useState, useRef, useEffect } from 'react';

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

// Extract title
const extractTitle = (text) => {
  if (text.includes('charcoal')) {
    const charcoalIndex = text.indexOf('charcoal');
    const start = Math.max(0, charcoalIndex - 20);
    const end = Math.min(text.length, charcoalIndex + 50);
    const context = text.substring(start, end).trim();
    const cleaned = context.replace(/[0-9kbags,]/gi, '').trim();
    if (cleaned.length > 3) return cleaned.substring(0, 60);
    return 'Charcoal';
  }
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    return words.slice(0, 3).join(' ').substring(0, 60);
  }
  return '';
};

export default function VoiceListingInput({ onResult, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | listening | processing | done | error
  const [transcript, setTranscript] = useState('');
  const [extracted, setExtracted] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const lastTranscriptRef = useRef(''); // ✅ Track transcript separately

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
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
      lastTranscriptRef.current = finalTranscript; // ✅ Store in ref
      setTranscript(finalTranscript);
    };

    recognition.onend = () => {
      // ✅ Use ref to get the actual transcript
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
        'network': 'Network error. Using text input instead.',
        'aborted': 'Listening stopped.',
      };
      setErrorMsg(msgs[e.error] || `Speech error: ${e.error}`);
      setPhase('error');
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  // ✅ FIXED: Accept transcript as parameter instead of relying on state
  const processTranscript = (finalTranscript) => {
    setPhase('processing');
    
    // Use small delay to ensure state updates are visible
    setTimeout(() => {
      const mapped = applyKeywordMap(finalTranscript);
      const result = {
        rawTranscript: finalTranscript,
        mappedText: mapped,
        suggestedTitle: extractTitle(mapped),
        suggestedPrice: extractPrice(mapped),
        suggestedQty: extractQuantity(mapped),
      };
      setExtracted(result);
      setPhase('done');
    }, 300);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript('');
    lastTranscriptRef.current = ''; // ✅ Reset ref
    setExtracted({});
    setErrorMsg('');
    setPhase('listening');
    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const handleUse = () => {
    // Only send non-empty fields
    const filtered = {
      suggestedTitle: extracted.suggestedTitle || '',
      suggestedPrice: extracted.suggestedPrice || '',
      suggestedQty: extracted.suggestedQty || '',
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
    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🎤</div>
      <p style={{ color: 'var(--ash)', fontSize: 14, marginBottom: 16 }}>
        Voice input is not supported in this browser. Please use Chrome or Edge.
      </p>
      <button onClick={onClose} className="btn btn-outline" style={{ width: 'auto', padding: '8px 20px' }}>
        Use Text Input
      </button>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: 17 }}>Voice Listing</h3>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: 'var(--ash)', lineHeight: 1 }}>✕</button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ash)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Speak your listing in <strong>English, Nyanja, or Bemba</strong>.<br />
        Example: <em>"charcoal, 10 bags, K95 each"</em>
      </p>

      {/* Mic button */}
      {(phase === 'idle' || phase === 'error') && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button onClick={startListening}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--ember)', border: 'none',
              cursor: 'pointer', fontSize: 32,
              boxShadow: '0 4px 16px rgba(216,90,48,0.3)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            🎙️
          </button>
          <p style={{ fontSize: 12, color: 'var(--ash)', marginTop: 8 }}>Tap to speak</p>
        </div>
      )}

      {/* Listening animation */}
      {phase === 'listening' && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button onClick={stopListening}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#E24B4A', border: 'none', cursor: 'pointer', fontSize: 32,
              animation: 'pulse-mic 1s ease-in-out infinite',
            }}>🎙️</button>
          <p style={{ fontSize: 12, color: 'var(--ember)', marginTop: 8, fontWeight: 500 }}>
            Listening... tap to stop
          </p>
          {transcript && (
            <p style={{ fontSize: 13, color: 'var(--coal)', marginTop: 8,
              background: 'var(--cream)', borderRadius: 8, padding: '8px 12px' }}>
              "{transcript}"
            </p>
          )}
        </div>
      )}

      {/* Processing */}
      {phase === 'processing' && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="spinner" style={{ margin: '0 auto', borderTopColor: 'var(--ember)',
            border: '3px solid var(--border)', width: 28, height: 28 }} />
          <p style={{ fontSize: 13, color: 'var(--ash)', marginTop: 8 }}>Processing speech...</p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="error-msg" style={{ marginBottom: '1rem' }}>{errorMsg}</div>
      )}

      {/* Results */}
      {phase === 'done' && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '1rem',
            marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--ash)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 6 }}>You said</p>
            <p style={{ fontSize: 13, color: 'var(--coal)', fontStyle: 'italic' }}>
              "{extracted.rawTranscript}"
            </p>
          </div>

          {/* Show detected fields */}
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              extracted.suggestedTitle && { label: 'Title detected', value: extracted.suggestedTitle },
              extracted.suggestedPrice && { label: 'Price detected', value: `K${extracted.suggestedPrice}` },
              extracted.suggestedQty && { label: 'Quantity detected', value: extracted.suggestedQty },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} style={{ background: 'white', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ash)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Show partial match warning */}
          {!extracted.suggestedTitle && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#F57F17' }}>
                ℹ️ Could not fully extract details. Fill in the rest manually.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
            <button onClick={handleUse} className="btn btn-ember" style={{ flex: 2 }}>
              ✅ Use This
            </button>
            <button onClick={handleRetry} className="btn btn-outline" style={{ flex: 1 }}>
              Retry
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 0 0 rgba(226,75,74,0.4); }
          50%       { box-shadow: 0 0 0 16px rgba(226,75,74,0); }
        }
      `}</style>
    </div>
  );
}
