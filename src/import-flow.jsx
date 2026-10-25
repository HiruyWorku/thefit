import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, SpinnerGap, Trash, UploadSimple, X } from "@phosphor-icons/react";
import "./import-flow.css";

const PARTS = [["upperbody", "Tops"], ["wholebody_up", "Jackets"], ["lowerbody", "Bottoms"], ["accessories_up", "Accessories"], ["shoes", "Shoes"]];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Could not read that photo."));
  reader.readAsDataURL(file);
});

export function WardrobeImportFlow({ onGarmentApproved }) {
  const inputRef = useRef(null);
  const saving = useRef(false);
  const removalRequests = useRef(new Set());
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const item = items[0];

  const submitFiles = useCallback(async (files) => {
    setOpen(true);
    setError("");
    for (const file of [...files]) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError("Choose PNG, JPEG, or WebP photos."); continue;
      }
      if (file.size > 18 * 1024 * 1024) {
        setError("Choose photos smaller than 18 MB."); continue;
      }
      try {
        const imageDataUrl = await fileToDataUrl(file);
        setItems(current => [...current, { id: crypto.randomUUID(), imageDataUrl, originalImageDataUrl: imageDataUrl, processedImageDataUrl: null, step: "photo", removing: false, removalError: "", name: "", part: "", color: "", tags: "" }]);
        setOpen(true);
      } catch (err) { setError(err.message); }
    }
  }, []);

  useEffect(() => {
    let depth = 0;
    const enter = event => { if ([...event.dataTransfer.types].includes("Files")) { event.preventDefault(); depth++; setDragging(true); } };
    const over = event => { if ([...event.dataTransfer.types].includes("Files")) event.preventDefault(); };
    const leave = event => { event.preventDefault(); depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const drop = event => { event.preventDefault(); depth = 0; setDragging(false); if (event.dataTransfer.files.length) submitFiles(event.dataTransfer.files); };
    const paste = event => { const files = [...event.clipboardData.files]; if (files.length) { event.preventDefault(); submitFiles(files); } };
    const listeners = { dragenter: enter, dragover: over, dragleave: leave, drop, paste };
    Object.entries(listeners).forEach(([name, handler]) => window.addEventListener(name, handler));
    return () => Object.entries(listeners).forEach(([name, handler]) => window.removeEventListener(name, handler));
  }, [submitFiles]);

  const update = (field, value) => setItems(current => current.map(entry => entry.id === item.id ? { ...entry, [field]: value } : entry));
  const patchItem = (id, patch) => setItems(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  const removeBackground = async () => {
    const id = item.id;
    if (item.processedImageDataUrl) { patchItem(id, { imageDataUrl: item.processedImageDataUrl }); return; }
    if (removalRequests.current.has(id)) return;
    removalRequests.current.add(id);
    patchItem(id, { removing: true, removalError: "" });
    try {
      const response = await fetch("/api/import/remove-background", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: item.originalImageDataUrl }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.imageDataUrl) throw new Error(result.error || "Could not remove the background. Retry or keep the original.");
      patchItem(id, { imageDataUrl: result.imageDataUrl, processedImageDataUrl: result.imageDataUrl });
    } catch (err) { patchItem(id, { removalError: err.message }); }
    finally { removalRequests.current.delete(id); patchItem(id, { removing: false }); }
  };
  const valid = item && item.name.trim() && item.part && HEX_COLOR.test(item.color);
  const save = async event => {
    event.preventDefault();
    if (!valid || item.step !== "details" || item.removing || saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/import/wardrobe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: item.imageDataUrl, metadata: { name: item.name.trim(), part: item.part, color: item.color, secondaryColor: null, tags: item.tags.split(",").map(tag => tag.trim()).filter(Boolean) } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this item.");
      onGarmentApproved?.(result);
      setItems(current => current.filter(entry => entry.id !== item.id));
    } catch (err) { setError(err.message); }
    finally { saving.current = false; setBusy(false); }
  };

  return <>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { submitFiles(event.target.files); event.target.value = ""; }} />
    <div className="import-drop-overlay" data-active={dragging} aria-hidden={!dragging}><div className="import-drop-target is-over"><UploadSimple size={34} /><h2>Drop item photos</h2><p>Use one item per photo, then fill in its details.</p></div></div>
    <aside className="import-tray" aria-label="Add clothes">
      <button className="import-tray__button" type="button" onClick={() => setOpen(true)} aria-label="Add clothes" aria-haspopup="dialog" aria-expanded={open}><Plus size={19} /></button>
    </aside>
    {open && <div className="import-popover-backdrop" data-open="true" onMouseDown={event => event.target === event.currentTarget && setOpen(false)} onKeyDown={event => event.key === "Escape" && setOpen(false)}>
      <section className="import-popover" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="import-popover__header"><div><p className="import-popover__eyebrow">{item ? item.step === "photo" ? "Step 2 of 3 · Prepare photo" : "Step 3 of 3 · Item details" : "Step 1 of 3 · Choose a photo"}</p><h2 className="import-popover__title" id="import-title">{item ? item.step === "photo" ? "Prepare your photo" : "Add item details" : "Add to your wardrobe"}</h2></div><button className="import-icon-button" onClick={() => setOpen(false)} aria-label="Close add clothes"><X size={20} /></button></header>
        {item?.step === "photo" ? <div className="import-photo-step">
          <div className="import-photo-checker"><img src={item.imageDataUrl} alt="Item photo preview" /></div>
          <p className="import-status">Background removal is optional. Selecting it sends this photo to Photoroom.</p>
          {item.removing && <p className="import-status" role="status"><SpinnerGap className="import-spinner" size={16} /> Removing background…</p>}
          {item.removalError && <p className="import-status is-error" role="alert">{item.removalError}</p>}
          <div className="import-actions">
            <button className="import-button" disabled={item.removing} onClick={removeBackground}>{item.processedImageDataUrl ? "Show removed background" : "Remove background"}</button>
            {item.processedImageDataUrl && <button className="import-button" disabled={item.removing} onClick={() => patchItem(item.id, { imageDataUrl: item.originalImageDataUrl })}>Restore original</button>}
            <button className="import-button import-button--primary" disabled={item.removing} onClick={() => patchItem(item.id, { step: "details", removalError: "" })}>{item.imageDataUrl === item.originalImageDataUrl ? "Keep original" : "Use this image"}</button>
            <button className="import-button" onClick={() => setItems(current => current.filter(entry => entry.id !== item.id))}><Trash size={14} /> Remove photo</button>
          </div>
        </div> : item ? <form key={item.id} onSubmit={save}>
          <p className="import-status">Enter this item’s name, category, color, and details. Nothing is saved until you select Save item.</p>
          <div className="import-editor">
            <img className="import-editor__preview" src={item.imageDataUrl} alt="Your uploaded item" />
            <fieldset className="import-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div className="import-field"><label htmlFor="item-name">Name</label><input id="item-name" autoFocus required maxLength={120} value={item.name} onChange={event => update("name", event.target.value)} placeholder="e.g. Navy jacket" /></div>
              <div className="import-field"><label htmlFor="item-category">Category</label><select id="item-category" required value={item.part} onChange={event => update("part", event.target.value)}><option value="" disabled>Choose a category</option>{PARTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
              <div className="import-field"><label htmlFor="item-color">Color</label><div className="import-color-row"><input aria-label="Choose color" type="color" value={HEX_COLOR.test(item.color) ? item.color : "#000000"} onChange={event => update("color", event.target.value)} /><input id="item-color" required pattern="#[0-9a-fA-F]{6}" placeholder="#hex" value={item.color} onChange={event => update("color", event.target.value)} /></div></div>
              <div className="import-field"><label htmlFor="item-details">Details (optional)</label><input id="item-details" value={item.tags} onChange={event => update("tags", event.target.value)} placeholder="casual, cotton, striped" /><small>Separate details with commas.</small></div>
            </fieldset>
          </div>
          <div className="import-actions"><button className="import-button" type="button" disabled={busy} onClick={() => patchItem(item.id, { step: "photo" })}>Back to photo</button><button className="import-button" type="button" disabled={busy} onClick={() => { setItems(current => current.filter(entry => entry.id !== item.id)); setError(""); }}><Trash size={14} /> Remove photo</button><button className="import-button import-button--primary" disabled={!valid || busy}>{busy ? <SpinnerGap className="import-spinner" size={14} /> : <Check size={14} />} {busy ? "Saving…" : "Save item"}</button></div>
        </form> : <div className="import-drop-target"><UploadSimple size={28} /><h2>Choose or paste an item photo</h2><p>Choose one photo per item. Next, enter its name, category, color, and details before saving.</p><button className="import-button import-button--primary" onClick={() => inputRef.current?.click()}>Choose photos</button></div>}
        {error && <p className="import-status is-error" role="alert">{error}</p>}
      </section>
    </div>}
  </>;
}
