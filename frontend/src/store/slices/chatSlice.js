import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// ── Async thunks ───────────────────────────────────────────

export const startConversation = createAsyncThunk(
  'chat/startConversation',
  async (listingId, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/chat/conversations', { listingId });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to start conversation');
    }
  }
);

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/chat/conversations');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load inbox');
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load messages');
    }
  }
);

export const sendMessageREST = createAsyncThunk(
  'chat/sendMessageREST',
  async ({ conversationId, text }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/chat/conversations/${conversationId}/messages`, { text });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send message');
    }
  }
);

// ── Slice ──────────────────────────────────────────────────
const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    conversations: [],
    currentConversation: null,
    messages: [],
    loading: false,
    messagesLoading: false,
    error: null,
    isTyping: false,           // other user typing
    isOnline: navigator.onLine,
    pendingCount: 0,           // offline queued messages count
  },
  reducers: {
    // Called by Socket.io listener when new message arrives
    addMessage(state, action) {
      const msg = action.payload;
      // Avoid duplicates
      const exists = state.messages.find((m) => m._id === msg._id);
      if (!exists) state.messages.push(msg);
    },

    // Update conversation preview in inbox when message arrives
    updateConversationPreview(state, action) {
      const { conversationId, lastMessage } = action.payload;
      const idx = state.conversations.findIndex((c) => c._id === conversationId);
      if (idx !== -1) {
        state.conversations[idx].lastMessage = lastMessage;
        // Move to top of inbox
        const [conv] = state.conversations.splice(idx, 1);
        state.conversations.unshift(conv);
      }
    },

    // Remove the on-screen "queued" copy once the real message has been sent
    removeMessage(state, action) {
      state.messages = state.messages.filter((m) => m._id !== action.payload);
    },

    setTyping(state, action) { state.isTyping = action.payload; },
    setOnline(state, action) { state.isOnline = action.payload; },
    setPendingCount(state, action) { state.pendingCount = action.payload; },
    clearError(state) { state.error = null; },
    clearMessages(state) { state.messages = []; state.currentConversation = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false; state.error = action.payload;
      });

    builder
      .addCase(fetchMessages.pending, (state) => { state.messagesLoading = true; })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.messages = action.payload.messages;
        state.currentConversation = action.payload.conversation;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.messagesLoading = false; state.error = action.payload;
      });

    builder
      .addCase(startConversation.fulfilled, (state, action) => {
        state.currentConversation = action.payload.conversation;
        // Add to inbox if not already there
        const exists = state.conversations.find((c) => c._id === action.payload.conversation._id);
        if (!exists) state.conversations.unshift(action.payload.conversation);
      });

    builder
      .addCase(sendMessageREST.fulfilled, (state, action) => {
        const msg = action.payload.message;
        const exists = state.messages.find((m) => m._id === msg._id);
        if (!exists) state.messages.push(msg);
      });
  },
});

export const {
  addMessage, removeMessage, updateConversationPreview, setTyping,
  setOnline, setPendingCount, clearError, clearMessages,
} = chatSlice.actions;

export default chatSlice.reducer;