import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../store/slices/authSlice';
import './LoginPage.css';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    return () => dispatch(clearError());
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ phone, password }));
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">

        <div className="login-header">
          <h1 className="login-logo">
            <span className="logo-dot"></span> ZamMarket
          </h1>
          <p className="login-subtitle">Welcome back</p>
        </div>

        <div className="card">
          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +260977123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn btn-ember" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Log In'}
            </button>
          </form>
        </div>

        <p className="login-footer">
          New to ZamMarket?{' '}
          <Link to="/register" className="login-link">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}