import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateListingForm from '../components/listings/CreateListingForm';
import VoiceListingInput from '../components/voice/VoiceListingInput';
import './CreateListingPage.css';

export default function CreateListingPage() {
  const navigate = useNavigate();
  const [showVoice, setShowVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);

  const handleVoiceResult = (result) => {
    setVoiceResult(result);
    setShowVoice(false);
  };

  return (
    <div className="create-listing-container">
      <nav className="create-listing-nav">
        <button 
          onClick={() => navigate(-1)}
          className="nav-back-btn"
        >
          ←
        </button>
        <span className="nav-title">New Listing</span>
        <button 
          onClick={() => setShowVoice(!showVoice)}
          className={`voice-toggle-btn ${showVoice ? 'voice-toggle-active' : ''}`}
        >
          🎤 Voice
        </button>
      </nav>

      <div className="create-listing-content">
        {/* Voice input panel */}
        {showVoice && (
          <div className="voice-input-panel card">
            <VoiceListingInput
              onResult={handleVoiceResult}
              onClose={() => setShowVoice(false)}
            />
          </div>
        )}

        {/* Voice result banner */}
        {voiceResult && !showVoice && (
          <div className="voice-result-banner">
            <p className="voice-result-text">
              ✅ Voice data applied — review and submit below
            </p>
            <button 
              onClick={() => setVoiceResult(null)}
              className="voice-result-dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <div className="card listing-form-card">
          <h2 className="form-title">Post a charcoal listing</h2>
          <p className="form-subtitle">
            Buyers in your neighbourhood will see this immediately.
          </p>
          <CreateListingForm
            voicePrefill={voiceResult}
            onSuccess={() => navigate('/listings/my')}
          />
        </div>
      </div>
    </div>
  );
}