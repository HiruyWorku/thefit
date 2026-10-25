import { useEffect, useId, useRef, useState } from 'react';
import { cachedOutfitPreview, outfitPreviewKey, requestOutfitPreview } from './outfit-preview.mjs';
import { fitDateLabel, saveFitOfDay } from './saved-fits.mjs';

export function OutfitTryOn({ outfit, enabled = true, disabledReason = '', active = true, onViewSaved }) {
  const [preview, setPreview] = useState({ key: '', status: 'idle' });
  const [liveOutfit, setLiveOutfit] = useState(null);
  const [LiveTryOn, setLiveTryOnComponent] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [saveState, setSaveState] = useState({ key: '', status: 'idle' });
  const saveLock = useRef(false);
  const liveImportLock = useRef(false);
  const previewLock = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const previewId = useId();
  const key = outfitPreviewKey(outfit);
  const savedImage = cachedOutfitPreview(outfit);
  const activePreview = preview.key === key ? preview : null;
  const image = activePreview?.image || savedImage;
  const expanded = activePreview?.expanded || false;
  const ready = enabled && active && !!outfit?.chosen.length;
  const saved = saveState.key === key ? saveState : null;
  useEffect(() => { if (!active) setLiveOutfit(null); }, [active]);

  const openLive = async () => {
    if (!ready || liveImportLock.current) return;
    setLiveError('');
    if (LiveTryOn) { setLiveOutfit(outfit); return; }
    liveImportLock.current = true;
    setLiveLoading(true);
    try {
      const module = await import('./LiveTryOn.jsx');
      setLiveTryOnComponent(() => module.LiveTryOn);
      if (activeRef.current) setLiveOutfit(outfit);
    } catch { setLiveError('The live camera could not load. Refresh the page and try again.'); }
    finally { liveImportLock.current = false; setLiveLoading(false); }
  };
  const showPhoto = async () => {
    if (!ready || previewLock.current) return;
    if (image) { setPreview({ key, status: 'ready', image, expanded: !expanded }); return; }
    previewLock.current = true;
    setPreview({ key, status: 'loading' });
    try { setPreview({ key, status: 'ready', image: await requestOutfitPreview(outfit), expanded: true }); }
    catch (error) { setPreview({ key, status: 'error', error: error.message || 'Could not generate your preview.' }); }
    finally { previewLock.current = false; }
  };
  const saveFit = async () => {
    if (!ready || saveLock.current || preview.status === 'loading') return;
    saveLock.current = true;
    setSaveState({ key, status: 'loading' });
    try {
      const fit = await saveFitOfDay(outfit, { previewDataUrl: image || null });
      setSaveState({ key, status: 'ready', date: fit.date });
    } catch (error) { setSaveState({ key, status: 'error', error: error.message }); }
    finally { saveLock.current = false; }
  };

  return <div className="daily-try-on">
    {!ready && disabledReason && <p className="try-on-requirements">{disabledReason}</p>}
    <button type="button" className="daily-live-try-on" onClick={openLive} disabled={!ready || liveLoading}>{liveLoading ? 'Loading camera…' : 'See this outfit live ↗'}</button>
    {liveError && <p className="daily-note daily-error" role="alert">{liveError}</p>}
    <button type="button" className="daily-location" disabled={!ready || preview.status === 'loading'} aria-expanded={image ? expanded : undefined} aria-controls={image ? previewId : undefined} onClick={showPhoto}>{preview.status === 'loading' ? 'Creating your preview…' : image ? expanded ? 'Hide preview' : 'Show preview' : 'Try this look on me'}</button>
    <button type="button" className="outfit-save-button" disabled={!ready || saveState.status === 'loading' || preview.status === 'loading'} onClick={saveFit}>{saveState.status === 'loading' ? 'Saving your fit…' : 'Save fit of the day'}</button>
    {saved?.status === 'ready' && <p className="saved-fit-confirmation" role="status">Saved for {fitDateLabel(saved.date)}.{onViewSaved && <> <button type="button" onClick={onViewSaved}>View saved fits</button></>}</p>}
    {saved?.status === 'error' && <p className="daily-note daily-error" role="alert">{saved.error}</p>}
    <p className="fit-save-note">Saving keeps your selected pieces and any photo preview locally. It uses no paid APIs.</p>
    <p className="daily-note">Live opens a free camera preview before you start Decart. Photo previews use OpenAI credits and send your reference photo and selected pieces to OpenAI. Actual fit may differ.</p>
    {preview.status === 'loading' && <p className="daily-note" role="status">Generating your look. This can take a few minutes.</p>}
    {activePreview?.status === 'error' && <p className="daily-note daily-error" role="alert">{activePreview.error}</p>}
    {image && <figure id={previewId} className="daily-try-on-result" hidden={!expanded}><img src={image} alt="AI preview of you wearing your selected outfit" /><figcaption>AI outfit preview</figcaption><a href={image} download="my-outfit.png">Download preview ↗</a></figure>}
    {active && liveOutfit && LiveTryOn && <LiveTryOn outfit={liveOutfit} onClose={() => setLiveOutfit(null)} />}
  </div>;
}
