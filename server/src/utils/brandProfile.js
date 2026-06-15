const toPlain = (obj) => {
  if (!obj) return {};
  if (typeof obj.toObject === 'function') return obj.toObject();
  return { ...obj };
};

const omitUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && !(value instanceof Date)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(value)) {
      const next = omitUndefined(v);
      if (next !== undefined) cleaned[k] = next;
    }
    return Object.keys(cleaned).length ? cleaned : undefined;
  }
  return value;
};

const mergeBrandProfile = (existing, updates = {}) => {
  const base = omitUndefined(toPlain(existing)) || {};
  const patch = omitUndefined(updates) || {};
  const merged = { ...base, ...patch };

  if (patch.colors !== undefined) {
    const colors = omitUndefined({ ...(base.colors || {}), ...patch.colors });
    if (colors) merged.colors = colors;
    else delete merged.colors;
  }

  if (patch.fonts !== undefined) {
    const fonts = omitUndefined({ ...(base.fonts || {}), ...patch.fonts });
    if (fonts) merged.fonts = fonts;
    else delete merged.fonts;
  }

  return omitUndefined(merged) || {};
};

module.exports = { mergeBrandProfile, omitUndefined, toPlain };
