import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Normalize user object — always ensure both id and _id are present
const normalizeUser = (user) => {
  if (!user) return null;
  const id = user._id || user.id;
  return { ...user, _id: id, id };
};

// ── Async thunks ───────────────────────────────────────────

export const requestOTP = createAsyncThunk(
  'auth/requestOTP',
  async (phone, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/request-otp', { phone });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send OTP');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/register', userData);
      const user = normalizeUser(data.user);
      localStorage.setItem('zammarket_token', data.token);
      localStorage.setItem('zammarket_user', JSON.stringify(user));
      return { ...data, user };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      const user = normalizeUser(data.user);
      localStorage.setItem('zammarket_token', data.token);
      localStorage.setItem('zammarket_user', JSON.stringify(user));
      return { ...data, user };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      return { ...data, user: normalizeUser(data.user) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user');
    }
  }
);

export const upgradeToSeller = createAsyncThunk(
  'auth/upgradeToSeller',
  async (sellerData, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/users/me/upgrade-to-seller', sellerData);
      const user = normalizeUser(data.user);
      localStorage.setItem('zammarket_user', JSON.stringify(user));
      return { ...data, user };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Upgrade failed');
    }
  }
);

// ── Rehydrate from localStorage ────────────────────────────
const storedToken = localStorage.getItem('zammarket_token');
const storedUser  = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem('zammarket_user'));
    return normalizeUser(raw); // normalize on rehydration too
  } catch { return null; }
})();

// If we have a stored user with only 'id', update localStorage now
if (storedUser) {
  localStorage.setItem('zammarket_user', JSON.stringify(storedUser));
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:            storedUser,
    token:           storedToken,
    isAuthenticated: !!storedToken,
    loading:         false,
    error:           null,
    otpSent:         false,
    otpPhone:        null,
    otpSentAt:       null,
    otpSimulated:    false,
  },
  reducers: {
    logout(state) {
      state.user           = null;
      state.token          = null;
      state.isAuthenticated = false;
      state.otpSent        = false;
      state.otpPhone       = null;
      localStorage.removeItem('zammarket_token');
      localStorage.removeItem('zammarket_user');
    },
    clearError(state) { state.error = null; },
    resetOtp(state)   { state.otpSent = false; state.otpPhone = null; state.otpSentAt = null; state.otpSimulated = false; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestOTP.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(requestOTP.fulfilled, (state, action) => {
        state.loading  = false;
        state.otpSent  = true;
        state.otpPhone = action.meta.arg;
        state.otpSentAt = Date.now();
        // Only true when the server prints codes in its log instead of sending an SMS
        state.otpSimulated = Boolean(action.payload?.devNote);
      })
      .addCase(requestOTP.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    builder
      .addCase(registerUser.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading         = false;
        state.user            = action.payload.user;
        state.token           = action.payload.token;
        state.isAuthenticated = true;
        state.otpSent         = false;
      })
      .addCase(registerUser.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    builder
      .addCase(loginUser.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading         = false;
        state.user            = action.payload.user;
        state.token           = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    builder
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload.user;
      });

    builder
      .addCase(upgradeToSeller.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(upgradeToSeller.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload.user;
      })
      .addCase(upgradeToSeller.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { logout, clearError, resetOtp } = authSlice.actions;
export default authSlice.reducer;