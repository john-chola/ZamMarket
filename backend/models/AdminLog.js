const mongoose = require('mongoose');

// One document per administrator action, so moderation is accountable:
// who did what, to whom, when and why.
const adminLogSchema = new mongoose.Schema(
  {
    admin:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName:  { type: String, default: '' },
    action: {
      type: String,
      enum: ['VERIFY_SELLER', 'SUSPEND_USER', 'REACTIVATE_USER', 'CHANGE_ROLE', 'REMOVE_LISTING'],
      required: true,
    },
    targetType: { type: String, enum: ['user', 'listing'], required: true },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    targetName: { type: String, default: '' },
    detail:     { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
