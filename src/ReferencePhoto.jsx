import { useId, useState } from 'react';
import { clearOutfitPreviews } from './outfit-preview.mjs';
import { uploadPrivatePhoto } from './private-upload.mjs';

export function ReferencePhoto({ disabled, onSaved }) {
  const id = useId();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 24 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP photo smaller than 24 MB.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      const upload = await uploadPrivatePhoto(file, 'reference');
      const response = await fetch('/api/account/reference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your reference photo.');
      clearOutfitPreviews(); onSaved?.(); setStatus('Reference photo saved privately. Your next preview will use it.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <details className="reference-photo"><summary>Your reference photo</summary><p>Add a clear, full-body photo of yourself for photo try-ons. Uploading it does not generate a preview or use AI credits.</p><label htmlFor={id}>{busy ? 'Saving your photo…' : 'Add or replace your photo'}</label><input id={id} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={upload} />{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}</details>;
}
