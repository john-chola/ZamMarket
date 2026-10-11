import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { describeError } from '../../utils/api';

// ── Async thunks ───────────────────────────────────────────

export const fetchListings = createAsyncThunk(
  'listings/fetchAll',
  async ({ neighbourhood = 'All', page = 1, search = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (neighbourhood !== 'All') params.append('neighbourhood', neighbourhood);
      if (search) params.append('search', search);
      const { data } = await api.get(`/listings?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load listings');
    }
  }
);

export const fetchMyListings = createAsyncThunk(
  'listings/fetchMine',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/listings/my/listings');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load your listings');
    }
  }
);

export const fetchListing = createAsyncThunk(
  'listings/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/listings/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Listing not found');
    }
  }
);

export const createListing = createAsyncThunk(
  'listings/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/listings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000, // waking the server + photo upload can be slow
      });
      return data;
    } catch (err) {
      return rejectWithValue(describeError(err, 'Failed to create listing'));
    }
  }
);

export const updateListing = createAsyncThunk(
  'listings/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/listings/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update listing');
    }
  }
);

export const updateListingStatus = createAsyncThunk(
  'listings/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/listings/${id}/status`, { status });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update status');
    }
  }
);

export const deleteListing = createAsyncThunk(
  'listings/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/listings/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete listing');
    }
  }
);

// ── Slice ──────────────────────────────────────────────────
const listingSlice = createSlice({
  name: 'listings',
  initialState: {
    items: [],           // browse page listings
    myListings: [],      // seller's own listings
    current: null,       // single listing view
    pagination: null,
    loading: false,
    myLoading: false,
    error: null,
    createSuccess: false,
  },
  reducers: {
    clearError(state) { state.error = null; },
    clearCreateSuccess(state) { state.createSuccess = false; },
    clearCurrent(state) { state.current = null; },
  },
  extraReducers: (builder) => {
    // fetchListings
    builder
      .addCase(fetchListings.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchListings.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.listings;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchListings.rejected, (state, action) => {
        state.loading = false; state.error = action.payload;
      });

    // fetchMyListings
    builder
      .addCase(fetchMyListings.pending, (state) => { state.myLoading = true; })
      .addCase(fetchMyListings.fulfilled, (state, action) => {
        state.myLoading = false;
        state.myListings = action.payload.listings;
      })
      .addCase(fetchMyListings.rejected, (state, action) => {
        state.myLoading = false; state.error = action.payload;
      });

    // fetchListing (single)
    builder
      .addCase(fetchListing.pending, (state) => { state.loading = true; })
      .addCase(fetchListing.fulfilled, (state, action) => {
        state.loading = false; state.current = action.payload.listing;
      })
      .addCase(fetchListing.rejected, (state, action) => {
        state.loading = false; state.error = action.payload;
      });

    // createListing
    builder
      .addCase(createListing.pending, (state) => { state.loading = true; state.error = null; state.createSuccess = false; })
      .addCase(createListing.fulfilled, (state, action) => {
        state.loading = false;
        state.createSuccess = true;
        state.myListings.unshift(action.payload.listing); // add to top
      })
      .addCase(createListing.rejected, (state, action) => {
        state.loading = false; state.error = action.payload;
      });

    // updateListingStatus
    builder
      .addCase(updateListingStatus.fulfilled, (state, action) => {
        const updated = action.payload.listing;
        const idx = state.myListings.findIndex((l) => l._id === updated._id);
        if (idx !== -1) state.myListings[idx] = updated;
      });

    // deleteListing
    builder
      .addCase(deleteListing.fulfilled, (state, action) => {
        state.myListings = state.myListings.filter((l) => l._id !== action.payload);
        state.items = state.items.filter((l) => l._id !== action.payload);
      });
  },
});

export const { clearError, clearCreateSuccess, clearCurrent } = listingSlice.actions;
export default listingSlice.reducer;