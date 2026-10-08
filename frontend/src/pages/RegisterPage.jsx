import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { requestOTP, registerUser, clearError, resetOtp } from '../store/slices/authSlice';
import { isValidZambianPhone, normalizePhone, NEIGHBOURHOODS } from '../utils/validation';
import './RegisterPage.css';

const steps = ['Phone', 'Verify', 'Details'];

function StepBar({ current }) {
  return (
    <div className="step-bar">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="step-item">
            <div className={`step-circle ${i < current ? 'completed' : i === current ? 'active' : 'pending'}`}>
              {i < current ? '' : i + 1}
            </div>
            <span className={`step-label ${i === current ? 'active' : 'inactive'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`step-connector ${i < current ? 'completed' : 'pending'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, otpSent, isAuthenticated } = useSelector((s) => s.auth);

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [neighbourhood, setNeighbourhood] = useState('Other');
  const [businessName, setBusinessName] = useState('');
  const [phoneErr, setPhoneErr] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    return () => { dispatch(clearError()); dispatch(resetOtp()); };
  }, [isAuthenticated, navigate, dispatch]);

  // Move to the code step as soon as the OTP has been sent
  if (otpSent && step === 0) setStep(1);

  const handleRequestOTP = (e) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!isValidZambianPhone(normalized)) {
      setPhoneErr('Enter a valid Zambian number (e.g. 0977123456)');
      return;
    }
    setPhoneErr('');
    dispatch(requestOTP(normalized));
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setStep(2);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    dispatch(registerUser({
      phone: normalizePhone(phone),
      otp,
      name,
      password,
      role,
      neighbourhood,
      ...(role === 'seller' && businessName && { sellerProfile: { businessName } }),
    }));
  };

  return (
    <div className="register-container">
      <div className="register-wrapper">

        <div className="register-header">
          <h1 className="register-logo">
            <span className="logo-dot"></span> ZamMarket
          </h1>
          <p className="register-subtitle">Create your account</p>
        </div>

        <div className="card">
          <StepBar current={step} />

          {error && <div className="error-msg">{error}</div>}

          {step === 0 && (
            <form onSubmit={handleRequestOTP}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 0977 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                {phoneErr && <p style={{ color: 'var(--ember)', fontSize: 12, marginTop: 4 }}>{phoneErr}</p>}
                <p className="helper-text">
                  Zamtel, Airtel, or MTN number. A verification code will be sent.
                </p>
              </div>
              <button className="btn btn-ember" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Send Verification Code'}
              </button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  type="text"
                  placeholder="6-digit code"
                  className="otp-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
                <p className="dev-hint">
                   Dev mode: Check your backend terminal (Git Bash window running the server) for the code.
                </p>
              </div>
              <button className="btn btn-ember" type="submit" disabled={otp.length !== 6}>
                Verify Code
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => { setStep(0); dispatch(resetOtp()); }}
              >
                 Change Number
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">I want to</label>
                <div className="role-selector">
                  {['buyer', 'seller'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`role-btn ${role === r ? 'active' : 'inactive'}`}
                      onClick={() => setRole(r)}
                    >
                      {r === 'buyer' ? 'Buy' : '🪵 Sell'}
                    </button>
                  ))}
                </div>
              </div>

              {role === 'seller' && (
                <div className="form-group">
                  <label className="form-label">Business Name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mwale Charcoal"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Neighbourhood</label>
                <select value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)}>
                  {NEIGHBOURHOODS.map((n) => (
                    <option key={n} value={n}>{n.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <button className="btn btn-ember" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="register-footer">
          Already have an account?{' '}
          <Link to="/login" className="register-link">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}