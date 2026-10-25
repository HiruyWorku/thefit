import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { WardrobeImportFlow } from "./import-flow.jsx";
import { DailySuggestions } from "./DailySuggestions.jsx";
import { OptimizedImage } from "./OptimizedImage.jsx";
import { CategoryFields } from "./CategoryFields.jsx";
import { CATEGORIES, GARMENT_TYPES, getGarmentType, getItemCategory, filterWardrobe, validGarmentType } from "./garment-types.mjs";
import { OutfitBuilder } from "./OutfitBuilder.jsx";
import { SavedFits } from "./SavedFits.jsx";
import { savedPreviewMatches } from "./saved-fits.mjs";
import { rememberOutfitPreview } from "./outfit-preview.mjs";
import { BUILDER_SLOTS, BUILDER_STORAGE_KEY, OUTFIT_DRAG_TYPE, addBuilderItem, builderSlotFor, customizeOutfit, parseBuilderDraft, resolveBuilderOutfit } from "./outfit-builder.mjs";
import "./outfit-builder.css";

const TYPES = [
  { id: "all", label: "All" },
  ...CATEGORIES,
];

const TYPE_MAP = Object.fromEntries(TYPES.map((type) => [type.id, type]));
const TYPE_ORDER = Object.fromEntries(TYPES.slice(1).map((type, index) => [type.id, index]));


function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}



function buildSamplingCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);
  return canvas;
}

function sampleImageColor(image, canvas, event) {
  const bounds = image.getBoundingClientRect();
  const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  const imageX = Math.floor((event.clientX - bounds.left - offsetX) / scale);
  const imageY = Math.floor((event.clientY - bounds.top - offsetY) / scale);

  if (imageX < 0 || imageY < 0 || imageX >= canvas.width || imageY >= canvas.height) return null;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  for (let radius = 0; radius <= 18; radius += 2) {
    const startX = Math.max(0, imageX - radius);
    const startY = Math.max(0, imageY - radius);
    const width = Math.min(canvas.width - startX, (radius * 2) + 1);
    const height = Math.min(canvas.height - startY, (radius * 2) + 1);
    const data = context.getImageData(startX, startY, width, height).data;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 96) return rgbToHex(data[index], data[index + 1], data[index + 2]);
    }
  }

  return null;
}

function GalleryItem({ item, selected, onOpen, building = false, inFit = false, onPick }) {
  const type = getGarmentType(item)?.label || TYPE_MAP[getItemCategory(item)]?.singular || "wardrobe item";
  const canPick = !!builderSlotFor(item);

  return (
    <div className={`gallery-piece${building ? ' is-selectable' : ''}`}>
    <button
      className={`gallery-item${selected ? " selected" : ""}${building && inFit ? ' in-fit' : ''}`}
      type="button"
      onClick={event => building ? onPick(item.id, null, event.detail === 0) : onOpen(item.id)}
      disabled={building && !canPick}
      draggable={building && canPick}
      onDragStart={event => { event.dataTransfer.setData(OUTFIT_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; }}
      aria-label={`${building ? 'Add' : 'Edit'} ${item.name || type}${building ? ' to your fit' : ''}`}
      aria-pressed={building ? inFit : selected}
      data-testid={`wardrobe-item-${item.id}`}
    >
      <OptimizedImage
        src={item.thumbnail || item.image}
        alt=""
        sizes="(max-width: 520px) calc(50vw - 16px), (max-width: 860px) calc(33vw - 18px), 180px"
        breakpoints={[120, 180, 240, 320, 480]}
      />
      {building && inFit && <span className="gallery-in-fit"><Check size={14} weight="bold" aria-hidden="true" /><span>In your fit</span></span>}
    </button>
    {building && <><p className="gallery-piece-name">{item.name || type}</p><button type="button" className="gallery-piece-edit" onClick={() => onOpen(item.id)} aria-label={`Edit ${item.name || type}`}><PencilSimple size={16} aria-hidden="true" /></button></>}
    </div>
  );
}

function TagEditor({ tags, onChange }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const nextTag = input.trim().replace(/^#/, "");
    if (!nextTag || tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) return;
    onChange([...tags, nextTag]);
    setInput("");
  };

  return (
    <div className="tag-editor">
      <div className="editable-tags">
        {tags.map((tag) => (
          <span className="editable-tag" key={tag}>
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((existing) => existing !== tag))} aria-label={`Remove ${tag}`}>
              <X size={12} weight="regular" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a detail"
          aria-label="Add detail tag"
        />
        <button type="button" onClick={addTag} disabled={!input.trim()} aria-label="Add detail">
          <Plus size={15} weight="regular" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ColorControl({ label, field, value, onChange, sampling, setSampling }) {
  return (
    <div className="color-slot">
      <div className="color-slot-heading">
        <span>{label}</span>
      </div>
      <label className="selected-color-control">
        <input
          type="color"
          value={value || "#9a9286"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Choose ${label.toLowerCase()}`}
        />
        <span className="selected-color-copy">
          <small>Selected</small>
          <strong>{value || "Custom"}</strong>
        </span>
      </label>
      <button
        className={`sample-button${sampling === field ? " active" : ""}`}
        type="button"
        onClick={() => setSampling((current) => current === field ? null : field)}
      >
        {sampling === field ? "Cancel picking" : `Pick ${label.toLowerCase()} from image`}
      </button>
    </div>
  );
}

function ItemEditor({ draft, setDraft, sampling, setSampling, sampleStatus }) {
  return (
    <div className="item-editor">
      <label className="field">
        <span>Name</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder={TYPE_MAP[draft.part]?.singular || "Wardrobe item"}
        />
      </label>

      <CategoryFields part={draft.part} garmentType={draft.garmentType} prefix="edit-item" onChange={patch => setDraft(current => ({ ...current, ...patch }))} />

      <fieldset className="color-field">
        <legend>Color</legend>
        <div className="colors-editor">
          <ColorControl
            label="Color"
            field="primary"
            value={draft.color}
            onChange={(color) => setDraft((current) => ({ ...current, color }))}
            sampling={sampling}
            setSampling={setSampling}
          />
        </div>
        <p className="color-help" aria-live="polite">{sampling ? `Click anywhere on the garment to sample the color.` : sampleStatus || "Choose a color or pick a color from the image."}</p>
      </fieldset>

      <div className="field details-field">
        <span>Details</span>
        <TagEditor tags={draft.tags} onChange={(tags) => setDraft((current) => ({ ...current, tags }))} />
      </div>
    </div>
  );
}

function itemDraft(item) {
  return { name: item.name || "", part: getItemCategory(item), garmentType: getGarmentType(item)?.id || "", color: item.color || "#9a9286", secondaryColor: item.secondaryColor || null, tags: [...(item.tags || [])] };
}

function ItemViewer({ item, onClose, onSave, onDelete }) {
  const closeButtonRef = useRef(null);
  const imageRef = useRef(null);
  const samplingCanvasRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const [sampling, setSampling] = useState(null);
  const [sampleStatus, setSampleStatus] = useState("");
  const [draft, setDraft] = useState(() => itemDraft(item));
  const [shaking, setShaking] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const saveLock = useRef(false);
  const type = getGarmentType(item)?.label || TYPE_MAP[getItemCategory(item)]?.singular || "Wardrobe item";

  const isDirty = useMemo(() => {
    const normalizedTags = (tags) => tags.map((tag) => tag.trim()).filter(Boolean);
    return JSON.stringify({
      name: draft.name.trim(),
      part: draft.part,
      garmentType: draft.garmentType,
      color: draft.color?.toLowerCase() || null,
      secondaryColor: draft.secondaryColor?.toLowerCase() || null,
      tags: normalizedTags(draft.tags),
    }) !== JSON.stringify({
      name: (item.name || "").trim(),
      part: getItemCategory(item),
      garmentType: getGarmentType(item)?.id || "",
      color: item.color?.toLowerCase() || null,
      secondaryColor: item.secondaryColor?.toLowerCase() || null,
      tags: normalizedTags(item.tags || []),
    });
  }, [draft, item]);

  const nudgeUnsaved = useCallback(() => {
    setCloseBlocked(true);
    setShaking(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShaking(true));
    });
    clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShaking(false), 420);
  }, []);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) nudgeUnsaved();
    else onClose();
  }, [isDirty, nudgeUnsaved, onClose, saving]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (sampling) setSampling(null);
        else requestClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("viewer-open");
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("viewer-open");
      clearTimeout(shakeTimerRef.current);
    };
  }, [requestClose, sampling]);

  useEffect(() => {
    if (!isDirty) setCloseBlocked(false);
  }, [isDirty]);

  useEffect(() => {
    setSampling(null);
    setSampleStatus("");
    setDraft(itemDraft(item));
  }, [item]);

  const cancelEditing = () => {
    setDraft(itemDraft(item));
    setSampling(null);
    setSampleStatus("");
    onClose();
  };

  const saveEditing = async () => {
    if (saveLock.current) return;
    setSaveError(""); setSaveNotice("");
    if (!draft.name.trim() || draft.name.trim().length > 120 || !/^#[0-9a-f]{6}$/i.test(draft.color) || (draft.secondaryColor && !/^#[0-9a-f]{6}$/i.test(draft.secondaryColor))) {
      setSaveError("Enter a name (up to 120 characters) and valid colors."); return;
    }
    if (!draft.garmentType || !validGarmentType(draft.part, draft.garmentType)) {
      setSaveError("Choose a garment type for this category."); return;
    }
    saveLock.current = true; setSaving(true);
    try {
      await onSave({ ...item, ...draft, name: draft.name.trim(), tags: draft.tags.map((tag) => tag.trim()).filter(Boolean) });
      setSampling(null);
      setSaveNotice("Changes saved.");
    } catch (error) { setSaveError(error.message || "Could not save changes. Please try again."); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const handleImageLoad = (event) => {
    samplingCanvasRef.current = buildSamplingCanvas(event.currentTarget);
  };

  const handleImageClick = (event) => {
    if (!sampling || !samplingCanvasRef.current) return;
    const color = sampleImageColor(event.currentTarget, samplingCanvasRef.current, event);
    if (!color) {
      setSampleStatus("That spot is transparent—try directly on the garment.");
      return;
    }
    const targetField = sampling === "secondary" ? "secondaryColor" : "color";
    setDraft((current) => ({ ...current, [targetField]: color }));
    setSampleStatus(`Sampled ${color} as the ${sampling} color.`);
    setSampling(null);
  };

  const garmentArtwork = (
    <div
      className={`viewer-art${sampling ? " sampling" : ""}`}
    >
      <OptimizedImage
        ref={imageRef}
        src={item.image}
        alt={`Selected ${type.toLowerCase()}`}
        sizes="(max-width: 520px) 40vw, 300px"
        breakpoints={[160, 240, 320, 480, 640]}
        priority
        onLoad={handleImageLoad}
        onClick={handleImageClick}
      />
      {sampling && <span className="sample-hint">Click garment to sample</span>}
    </div>
  );

  return (
    <div className="viewer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
    <div className="viewer-entry">
    <aside className={`viewer editing${shaking ? " shake" : ""}`} role="dialog" aria-modal="true" aria-label="Selected wardrobe item">
      <button className="viewer-icon-close" type="button" onClick={requestClose} aria-label="Close viewer" ref={closeButtonRef}>
        <X size={24} weight="light" aria-hidden="true" />
      </button>

      <div className="viewer-heading"><h2>{draft.name || TYPE_MAP[draft.part]?.singular}</h2></div>
      {garmentArtwork}

      <div className="viewer-details editing">
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <ItemEditor
          draft={draft}
          setDraft={setDraft}
          sampling={sampling}
          setSampling={setSampling}
          sampleStatus={sampleStatus}
        />

        </fieldset>
        {saveError && <p className="unsaved-notice" role="alert">{saveError}</p>}
        {saveNotice && <p role="status">{saveNotice}</p>}
        {closeBlocked && <p className="unsaved-notice" role="status">Save or cancel changes before closing.</p>}

        <div className="viewer-actions">
          <button className="delete-button" type="button" disabled={saving} onClick={() => onDelete(item.id)}>
            <Trash size={15} weight="regular" aria-hidden="true" /> Delete
          </button>
          <span className="action-spacer" />
          <button className="secondary-button" type="button" disabled={saving} onClick={cancelEditing}>Cancel</button>
          <button className="primary-button" type="button" disabled={saving} onClick={saveEditing}>
            <Check size={15} weight="bold" aria-hidden="true" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </aside>
    </div>
    </div>
  );
}

export function App({ userId }) {
  const draftKey = `${BUILDER_STORAGE_KEY}:${userId}`;
  const [items, setItems] = useState([]);
  const [activeType, setActiveType] = useState("all");
  const [activeGarmentType, setActiveGarmentType] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outfitMode, setOutfitMode] = useState('suggested');
  const [builderSelection, setBuilderSelection] = useState(() => {
    try { return parseBuilderDraft(localStorage.getItem(draftKey)); } catch { return {}; }
  });
  const [activeSlot, setActiveSlot] = useState(null);
  const [builderMessage, setBuilderMessage] = useState('');
  const [draftStorageError, setDraftStorageError] = useState(false);
  const boardRef = useRef(null);
  const galleryHeaderRef = useRef(null);
  const building = outfitMode === 'builder';
  const viewingSaved = outfitMode === 'saved';
  const builtOutfit = useMemo(() => resolveBuilderOutfit(builderSelection, items), [builderSelection, items]);
  const selectedBuilderIds = new Set(builtOutfit.chosen.map(({ item }) => item.id));

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(builderSelection)); setDraftStorageError(false); }
    catch { setDraftStorageError(true); }
  }, [builderSelection, draftKey]);

  useEffect(() => {
    fetch("/api/import/wardrobe", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) return response.json().then(result => { throw new Error(result.error || 'Could not load your wardrobe.'); });
        return response.json();
      })
      .then((loadedItems) => {
        setItems(loadedItems);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const visibleItems = useMemo(() => {
    const filtered = filterWardrobe(items, activeType, activeGarmentType);
    return [...filtered].sort((a, b) => {
      if (activeType === "all") {
        const typeDifference = (TYPE_ORDER[getItemCategory(a)] ?? 99) - (TYPE_ORDER[getItemCategory(b)] ?? 99);
        if (typeDifference) return typeDifference;
      }
      return a.id.localeCompare(b.id);
    });
  }, [activeType, activeGarmentType, items]);

  const chooseType = (typeId) => {
    setActiveType(typeId);
    setActiveGarmentType("all");
    setSelectedId(null);
    if (building) setActiveSlot(BUILDER_SLOTS.find(slot => slot.part === typeId)?.id || null);
    if (building) setBuilderMessage('');
  };

  const scrollBuilderArea = target => {
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    requestAnimationFrame(() => (target === 'board' ? boardRef : galleryHeaderRef).current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };
  const focusBuilderSlot = (slotId, scroll = true, keyboard = false) => {
    const slot = BUILDER_SLOTS.find(entry => entry.id === slotId);
    setActiveSlot(slot?.id || null);
    setActiveType(slot?.part || 'all');
    setActiveGarmentType('all');
    setSelectedId(null);
    if (scroll) scrollBuilderArea(slot ? 'gallery' : 'board');
    if (keyboard) requestAnimationFrame(() => (slot ? galleryHeaderRef.current?.parentElement.querySelector('.gallery-item:not(:disabled)') : boardRef.current)?.focus({ preventScroll: true }));
  };
  const openBuilder = () => {
    setOutfitMode('builder');
    focusBuilderSlot(null, false);
    setBuilderMessage('');
  };
  const chooseSlot = (slotId, scroll = true, keyboard = false) => {
    setBuilderMessage(builtOutfit.bySlot[slotId] ? 'Choose a replacement. The rest of your fit stays as it is.' : 'Choose a piece from your wardrobe to fill this slot.');
    focusBuilderSlot(slotId, scroll, keyboard);
  };
  const chooseBuilderItem = (id, targetSlot = null, keyboard = false) => {
    const item = items.find(entry => entry.id === id);
    const next = addBuilderItem(builderSelection, item, targetSlot);
    if (!next) {
      const expected = BUILDER_SLOTS.find(slot => slot.id === builderSlotFor(item));
      setBuilderMessage(expected ? `${item.name} belongs in ${expected.label.toLowerCase()}. Drop it in that slot.` : 'Choose a top, bottoms, footwear, outerwear or headwear for this fit.');
      return;
    }
    setBuilderSelection(next);
    setBuilderMessage(`${item.name} added. Add another piece, save this fit, or try it on.`);
    focusBuilderSlot(null, true, keyboard);
  };
  const removeBuilderItem = slotId => {
    setBuilderSelection(current => { const next = { ...current }; delete next[slotId]; return next; });
    setBuilderMessage('Piece removed. Choose a replacement whenever you like.');
    focusBuilderSlot(slotId, false);
  };
  const clearBuilder = () => {
    setBuilderSelection({});
    setBuilderMessage('Outfit cleared. Choose any pieces to start again.');
    focusBuilderSlot(null, false);
  };
  const customizeSuggestion = outfit => {
    const next = customizeOutfit(outfit);
    setBuilderSelection(next);
    setOutfitMode('builder');
    setBuilderMessage('Suggested look copied. Swap any piece to make it yours.');
    focusBuilderSlot(null, false);
  };
  const loadSavedFit = fit => {
    const next = customizeOutfit({ chosen: fit.items.map(item => ({ item })) });
    const restored = resolveBuilderOutfit(next, items);
    if (savedPreviewMatches(fit, restored)) rememberOutfitPreview(restored, fit.previewImage);
    setBuilderSelection(next); setOutfitMode('builder');
    focusBuilderSlot(null, false);
    setBuilderMessage(restored.chosen.length < fit.items.length ? 'Saved fit loaded. Some pieces are no longer in your wardrobe; choose replacements for those slots.' : 'Saved fit loaded. Swap a piece or try it on again.');
  };

  const saveItem = async (updatedItem) => {
    let saved = updatedItem;
    {
      const response = await fetch(`/api/import/wardrobe/${updatedItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { name: updatedItem.name, part: updatedItem.part, garmentType: updatedItem.garmentType, color: updatedItem.color, secondaryColor: updatedItem.secondaryColor, tags: updatedItem.tags } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save changes.");
      saved = result;
    }
    setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
  };

  const deleteItem = async (id) => {
    {
      try {
        const response = await fetch(`/api/import/wardrobe/${id}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error("Could not delete the imported item.");
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedId(null);
  };

  const addImportedItem = useCallback((newItem) => {
    setItems((current) => current.some((item) => item.id === newItem.id) ? current : [...current, newItem]);
  }, []);


  return (
    <div className={`app-shell with-daily-panel${selectedItem ? " has-selection" : ""}`}>
      <main className="gallery-pane">
        <header className="outfit-workspace-heading"><h1>Your wardrobe</h1><div className="outfit-mode-switch" role="group" aria-label="Outfit mode"><button type="button" aria-pressed={outfitMode === 'suggested'} onClick={() => { setOutfitMode('suggested'); setSelectedId(null); setActiveType('all'); setActiveGarmentType('all'); }}>Suggested outfit</button><button type="button" aria-pressed={building} onClick={openBuilder}>Build a fit</button><button type="button" aria-pressed={viewingSaved} onClick={() => { setOutfitMode('saved'); setSelectedId(null); }}>Saved fits</button></div></header>
        <div hidden={outfitMode !== 'suggested'}><DailySuggestions items={items} onOpen={setSelectedId} onCustomize={customizeSuggestion} active={outfitMode === 'suggested'} onViewSaved={() => setOutfitMode('saved')} /></div>
        {viewingSaved && <SavedFits onLoad={loadSavedFit} onBuild={openBuilder} />}
        {!viewingSaved && <div className={`wardrobe-workspace${building ? ' is-building' : ''}`}>
        {building && <OutfitBuilder outfit={builtOutfit} activeSlot={activeSlot} onChooseSlot={chooseSlot} onRemove={removeBuilderItem} onClear={clearBuilder} onDropItem={chooseBuilderItem} storageError={draftStorageError} boardRef={boardRef} onViewSaved={() => setOutfitMode('saved')} />}
        <div className="wardrobe-collection">
        <header className="gallery-header" ref={galleryHeaderRef}>
          {building && <div className="builder-context"><div><h2>{activeSlot ? BUILDER_SLOTS.find(slot => slot.id === activeSlot)?.prompt : 'Make it yours'}</h2><p role="status">{builderMessage || 'Tap a piece to add it, or use the pencil to edit its details.'}</p></div><button type="button" onClick={() => boardRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })}>View your fit</button></div>}
          <div className="gallery-meta-row">
            <p className="piece-count" aria-live="polite">{activeType === "all" ? items.length : `${visibleItems.length} of ${items.length}`} {items.length === 1 ? "piece" : "pieces"}</p>
          </div>
          <nav className="category-nav" aria-label="Filter wardrobe by item type">
            {TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={activeType === type.id ? "active" : ""}
                onClick={() => chooseType(type.id)}
                aria-pressed={activeType === type.id}
              >
                {type.label}
              </button>
            ))}
          </nav>
          {activeType !== "all" && <label className="wardrobe-type-filter"><span>Garment type</span><select value={activeGarmentType} onChange={event => setActiveGarmentType(event.target.value)}><option value="all">All {TYPE_MAP[activeType]?.label.toLowerCase()}</option>{GARMENT_TYPES.filter(type => type.part === activeType).map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>}
        </header>

        {error && <p className="status error">{error}</p>}
        {!error && loading && <p className="status">Loading wardrobe</p>}
        {!error && !loading && !items.length && <p className="status empty">Drop, paste, or add a photo to import your first piece.</p>}
        {!error && !loading && !!items.length && !visibleItems.length && <p className="status empty">No items match this category and garment type yet. Choose another filter or add a piece.</p>}

        {!!items.length && (
          <section className="gallery-grid" aria-label={`${TYPE_MAP[activeType]?.label || "All"} wardrobe items`}>
            {visibleItems.map((item) => (
              <GalleryItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onOpen={setSelectedId}
                building={building}
                inFit={selectedBuilderIds.has(item.id)}
                onPick={chooseBuilderItem}
              />
            ))}
          </section>
        )}
        </div>
        </div>}
      </main>

      {selectedItem && <ItemViewer item={selectedItem} onClose={() => setSelectedId(null)} onSave={saveItem} onDelete={deleteItem} />}
      <WardrobeImportFlow onGarmentApproved={addImportedItem} />
    </div>
  );
}
