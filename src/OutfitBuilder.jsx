import { useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { OptimizedImage } from './OptimizedImage.jsx';
import { OutfitTryOn } from './OutfitTryOn.jsx';
import { BUILDER_SLOTS, OUTFIT_DRAG_TYPE } from './outfit-builder.mjs';

export function OutfitBuilder({ outfit, activeSlot, onChooseSlot, onRemove, onClear, onDropItem, storageError, boardRef, onViewSaved }) {
  const [dragOver, setDragOver] = useState(null);
  const dragLeave = event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(null); };
  return <aside className="fit-builder" aria-labelledby="fit-builder-title" ref={boardRef} tabIndex={-1}>
    <div className="fit-builder-heading"><div><h2 id="fit-builder-title">Your fit</h2><p>{outfit.chosen.length ? `${outfit.chosen.length} ${outfit.chosen.length === 1 ? 'piece' : 'pieces'} selected · ready to try on` : 'Choose any pieces you like'}</p></div><button type="button" className="fit-clear" onClick={onClear} disabled={!outfit.chosen.length}>Clear outfit</button></div>
    <p className="fit-builder-help">Every slot is optional. Tap a slot, then choose a piece.<span className="fit-drag-hint"> Or drag a piece into its matching slot.</span></p>
    <div className="fit-slots">
      {BUILDER_SLOTS.map(slot => {
        const item = outfit.bySlot[slot.id];
        return <div key={slot.id} className={`fit-slot${activeSlot === slot.id ? ' is-active' : ''}${dragOver === slot.id ? ' is-drag-over' : ''}${item ? ' is-filled' : ''}`} onDragOver={event => {
          if (!event.dataTransfer.types.includes(OUTFIT_DRAG_TYPE)) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOver(slot.id);
        }} onDragLeave={dragLeave} onDrop={event => {
          if (!event.dataTransfer.types.includes(OUTFIT_DRAG_TYPE)) return;
          event.preventDefault(); event.stopPropagation(); setDragOver(null);
          onDropItem(event.dataTransfer.getData(OUTFIT_DRAG_TYPE), slot.id);
        }}>
          <button type="button" className="fit-slot-choose" onClick={event => onChooseSlot(slot.id, true, event.detail === 0)} aria-pressed={activeSlot === slot.id} aria-label={`${item ? 'Replace' : 'Choose'} ${slot.label.toLowerCase()}${item ? `: ${item.name}` : ''}`}>
            <span className="fit-slot-art">{item ? <OptimizedImage src={item.thumbnail || item.image} alt="" sizes="72px" breakpoints={[96, 160]} /> : <Plus size={20} weight="light" aria-hidden="true" />}</span>
            <span className="fit-slot-copy"><span className="fit-slot-label">{slot.label}{!slot.required && <small>Optional</small>}</span><span className="fit-slot-name">{item?.name || slot.prompt}</span></span>
          </button>
          {item && <button type="button" className="fit-slot-remove" onClick={() => onRemove(slot.id)} aria-label={`Remove ${item.name} from ${slot.label.toLowerCase()}`}><X size={15} aria-hidden="true" /></button>}
        </div>;
      })}
    </div>
    <p className="fit-draft-note">{storageError ? 'Device storage is unavailable. This draft lasts until you close or reload the page.' : 'Your draft is kept on this device. Choosing pieces is free.'}</p>
    <OutfitTryOn outfit={outfit} enabled={outfit.complete} disabledReason="Add at least one piece to save or try this fit." onViewSaved={onViewSaved} />
  </aside>;
}
