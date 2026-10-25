import { CATEGORIES, GARMENT_TYPES } from './garment-types.mjs';

export function CategoryFields({ part, garmentType, onChange, prefix, className = 'field' }) {
  return <>
    <label className={className} htmlFor={`${prefix}-category`}>
      <span>Category</span>
      <select id={`${prefix}-category`} required value={part} onChange={event => onChange({ part: event.target.value, garmentType: '' })}>
        <option value="" disabled>Choose a category</option>
        {CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
      </select>
    </label>
    <label className={className} htmlFor={`${prefix}-garment-type`}>
      <span>Garment type</span>
      <select id={`${prefix}-garment-type`} required disabled={!part} value={garmentType || ''} onChange={event => onChange({ garmentType: event.target.value })}>
        <option value="" disabled>{part ? 'Choose a garment type' : 'Choose a category first'}</option>
        {GARMENT_TYPES.filter(type => type.part === part).map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
      </select>
    </label>
  </>;
}
