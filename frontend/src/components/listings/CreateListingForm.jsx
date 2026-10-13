import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createListing, clearError, clearCreateSuccess } from '../../store/slices/listingSlice';
import { NEIGHBOURHOODS } from '../../utils/validation';
import { compressImage } from '../../utils/compressImage';
import { saveDraft } from '../../utils/offlineDrafts';
import toast from 'react-hot-toast';
import './CreateListingForm.css';

const UNITS = ['bag', 'tin', 'kg'];

export default function CreateListingForm({ onSuccess, voicePrefill }) {
  const dispatch = useDispatch();
  const { loading, error, createSuccess } = useSelector((s) => s.listings);
  const { user } = useSelector((s) => s.auth);

  const [title,             setTitle]             = useState('');
  const [pricePerBag,       setPricePerBag]       = useState('');
  const [unit,              setUnit]              = useState('bag');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [neighbourhood,     setNeighbourhood]     = useState(
    NEIGHBOURHOODS.includes(user?.neighbourhood) ? user.neighbourhood : 'Other'
  );
  const [description,       setDescription]       = useState('');
  const [imageFile,         setImageFile]         = useState(null);
  const [imagePreview,      setImagePreview]      = useState(null);

  // Apply a new voice result once, during render (no effect needed);
  // fields the seller already typed are kept unless voice filled them
  const [appliedPrefill, setAppliedPrefill] = useState(null);
  if (voicePrefill && voicePrefill !== appliedPrefill) {
    setAppliedPrefill(voicePrefill);
    if (voicePrefill.suggestedTitle) setTitle(voicePrefill.suggestedTitle);
    if (voicePrefill.suggestedPrice) setPricePerBag(voicePrefill.suggestedPrice);
    if (voicePrefill.suggestedQty)   setQuantityAvailable(voicePrefill.suggestedQty);
    if (UNITS.includes(voicePrefill.suggestedUnit)) setUnit(voicePrefill.suggestedUnit);
    if (voicePrefill.suggestedNeighbourhood) setNeighbourhood(voicePrefill.suggestedNeighbourhood);
  }

  useEffect(() => {
    if (createSuccess) { dispatch(clearCreateSuccess()); onSuccess?.(); }
    return () => dispatch(clearError());
  }, [createSuccess, dispatch, onSuccess]);

  const [imageError, setImageError] = useState('');

  const handleImage = async (e) => {
    const original = e.target.files[0];
    if (!original) return;
    setImageError('');
    const file = await compressImage(original);
    if (file.size > 5 * 1024 * 1024) {
      setImageError('This photo is too large (over 5 MB). Please choose another one.');
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveOffline = async () => {
    await saveDraft({ title, pricePerBag, unit, quantityAvailable, neighbourhood, description }, imageFile);
    toast.success('Saved offline. It will be posted automatically when you are back online.', { duration: 5000 });
    onSuccess?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) {
      await saveOffline();
      return;
    }
    const formData = new FormData();
    formData.append('title',             title);
    formData.append('pricePerBag',       pricePerBag);
    formData.append('unit',              unit);
    formData.append('quantityAvailable', quantityAvailable);
    formData.append('neighbourhood',     neighbourhood);
    formData.append('description',       description);
    if (imageFile) formData.append('image', imageFile);
    const result = await dispatch(createListing(formData));
    // Server unreachable mid-post: keep the listing as an offline draft
    if (result.meta.requestStatus === 'rejected' && String(result.payload).startsWith('Cannot reach the server')) {
      dispatch(clearError());
      await saveOffline();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-msg">{error}</div>}
      {imageError && <div className="error-msg">{imageError}</div>}

      {/* Image upload */}
      <div className="form-group">
        <label className="form-label">Photo (optional)</label>
        <div
          className="image-upload-zone"
          onClick={() => document.getElementById('img-upload').click()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="image-upload-zone__preview" />
          ) : (
            <div className="image-upload-zone__placeholder">
              <div className="image-upload-zone__icon">📷</div>
              <p className="image-upload-zone__text">Click to upload photo</p>
              <p className="image-upload-zone__hint">JPG, PNG, WebP — max 5MB</p>
            </div>
          )}
        </div>
        <input
          id="img-upload"
          type="file"
          accept="image/*"
          onChange={handleImage}
          className="image-upload-input"
        />
      </div>

      {/* Title */}
      <div className="form-group">
        <label className="form-label">
          Listing Title
          {voicePrefill?.suggestedTitle && (
            <span className="voice-badge">🎙 from voice</span>
          )}
        </label>
        <input
          type="text"
          placeholder="e.g. Fresh Charcoal — 25kg bags"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={80}
        />
      </div>

      {/* Price + Unit */}
      <div className="price-unit-grid">
        <div className="form-group">
          <label className="form-label">
            Price (K)
            {voicePrefill?.suggestedPrice && (
              <span className="voice-badge--inline"> 🎙</span>
            )}
          </label>
          <input
            type="number"
            placeholder="95"
            min="1"
            value={pricePerBag}
            onChange={(e) => setPricePerBag(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Per</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">
          Quantity
          {voicePrefill?.suggestedQty && (
            <span className="voice-badge--inline"> 🎙</span>
          )}
        </label>
        <input
          type="number"
          placeholder="How many bags/tins?"
          min="1"
          value={quantityAvailable}
          onChange={(e) => setQuantityAvailable(e.target.value)}
          required
        />
      </div>

      {/* Neighbourhood */}
      <div className="form-group">
        <label className="form-label">
          Location / Neighbourhood
          {voicePrefill?.suggestedNeighbourhood && (
            <span className="voice-badge--inline"> 🎙</span>
          )}
        </label>
        {/* Must be one of the backend's neighbourhood values */}
        <select value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)} required>
          {NEIGHBOURHOODS.map((n) => (
            <option key={n} value={n}>{n.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="form-label">Description (optional)</label>
        <textarea
          placeholder="Any extra details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          className="description-textarea"
        />
        <p className="char-count">{description.length}/300</p>
      </div>

      {/* Submit */}
      <button className="btn btn-ember submit-btn" type="submit" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Post Listing'}
      </button>
    </form>
  );
}