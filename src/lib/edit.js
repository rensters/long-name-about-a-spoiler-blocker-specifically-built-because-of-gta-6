// shared "change a pack" helpers for the popup + settings page. built-in packs are saved as a diff
// on top of the json file, your own packs are saved whole.
(function (root) {
  const SS = root.SpoilerShield;
  const P = SS.packs;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function uniqueId(state, id) {
    let n = id;
    let i = 2;
    while (state.packs.some((p) => p.id === n)) n = `${id}-${i++}`;
    return n;
  }

  async function savePack(state, edited) {
    const ps = state.packState;
    const clean = clone(edited);
    delete clean.builtin;
    const base = state.builtins[clean.id];
    if (base) {
      ps.diffs[clean.id] = P.makeDiff(base, clean);
    } else {
      const { pack } = P.validatePack(clean);
      pack.id = clean.id; // keep the id we already gave it, validate only cleans it
      ps.custom[pack.id] = pack;
    }
    if (!ps.order.includes(clean.id)) ps.order.push(clean.id);
    return SS.store.savePackState(ps);
  }

  async function addTerm(state, packId, tier, term) {
    const pack = state.packs.find((p) => p.id === packId);
    if (!pack) throw new Error('pack not found');
    const t = String(term || '').trim();
    if (!t) return 'empty';
    const edited = clone(pack);
    edited[tier] = P.groups(edited[tier]);
    for (const k of P.TIERS) {
      if (P.entries(edited[k]).some((e) => P.keyOf(e.term) === P.keyOf(t))) return k === tier ? 'exists' : 'other-tier:' + k;
    }
    (edited[tier][P.ADDED_GROUP] = edited[tier][P.ADDED_GROUP] || []).push(t);
    await savePack(state, edited);
    return 'added';
  }

  async function setField(state, packId, patch) {
    const pack = state.packs.find((p) => p.id === packId);
    if (!pack) throw new Error('pack not found');
    return savePack(state, { ...clone(pack), ...patch });
  }

  async function deletePack(state, id) {
    if (state.builtins[id]) throw new Error("built-in packs can't be deleted, switch them off instead");
    delete state.packState.custom[id];
    state.packState.order = state.packState.order.filter((x) => x !== id);
    return SS.store.savePackState(state.packState);
  }

  async function resetPack(state, id) {
    delete state.packState.diffs[id];
    return SS.store.savePackState(state.packState);
  }

  async function createPack(state, name) {
    const p = P.blankPack(name);
    p.id = uniqueId(state, p.id);
    state.packState.custom[p.id] = p;
    state.packState.order.push(p.id);
    await SS.store.savePackState(state.packState);
    return p;
  }

  // replaceBuiltin: true when you're re-importing your own export of a built-in pack
  async function importPack(state, json, replaceBuiltin) {
    let obj;
    try {
      obj = JSON.parse(json);
    } catch (e) {
      throw new Error("that file isn't valid JSON (" + e.message + ')');
    }
    const { pack, warnings } = P.validatePack(obj);
    if (state.builtins[pack.id] && replaceBuiltin) {
      state.packState.diffs[pack.id] = P.makeDiff(state.builtins[pack.id], pack);
    } else {
      pack.id = uniqueId(state, state.builtins[pack.id] ? pack.id + '-copy' : pack.id);
      state.packState.custom[pack.id] = pack;
      state.packState.order.push(pack.id);
    }
    await SS.store.savePackState(state.packState);
    return { pack, warnings };
  }

  function exportAll(state) {
    return JSON.stringify(
      { exportedFrom: "i can't afford a PS5 but i also wish to not get spoiled", exportedAt: new Date().toISOString(), settings: state.settings, packState: state.packState },
      null,
      2,
    );
  }

  async function importAll(json) {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object' || !obj.packState || !obj.settings) throw new Error("that's not a backup from this extension");
    const ps = obj.packState;
    const clean = { diffs: {}, custom: {}, order: Array.isArray(ps.order) ? ps.order.filter((x) => typeof x === 'string') : [] };
    for (const [id, d] of Object.entries(ps.diffs || {})) if (d && typeof d === 'object') clean.diffs[id] = d;
    for (const [id, p] of Object.entries(ps.custom || {})) {
      try {
        const v = P.validatePack(p).pack;
        v.id = id;
        clean.custom[id] = v;
      } catch (e) {
        /* skip the broken one, keep the rest */
      }
    }
    await SS.store.saveSettings({ ...SS.store.DEFAULT_SETTINGS, ...obj.settings });
    await SS.store.savePackState(clean);
  }

  root.SpoilerShield.edit = { savePack, addTerm, setField, deletePack, resetPack, createPack, importPack, exportAll, importAll, uniqueId };
})(globalThis);
