// Pure tab-state management for MARKMARK.
// No DOM / Electron / editor dependencies, so it can be unit-tested in isolation.

/** Path identity for "is this file already open?" — Windows-oriented: / == \ and case-insensitive. */
export function normalizePath(p) {
  if (!p) return null
  return p.replace(/\//g, '\\').toLowerCase()
}

export function basename(p) {
  if (!p) return null
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1]
}

/**
 * Create an empty tab store.
 * A tab is { id, path, dirty, untitledIndex } — editor instances and DOM nodes
 * live outside the store (renderer runtime / tests provide their own).
 */
export function createTabStore() {
  /** @type {Array<{id:number, path:string|null, dirty:boolean, untitledIndex:number}>} */
  const tabs = []
  let activeId = null
  let idSeq = 0
  let untitledSeq = 0

  const get = (id) => tabs.find((t) => t.id === id) || null
  const indexOf = (id) => tabs.findIndex((t) => t.id === id)

  return {
    list: () => tabs.slice(),
    count: () => tabs.length,
    get,
    getActive: () => get(activeId),
    getActiveId: () => activeId,

    /** Create a tab (appended at the end). Does NOT activate it. */
    add({ path = null } = {}) {
      const tab = {
        id: ++idSeq,
        path,
        dirty: false,
        untitledIndex: path ? 0 : ++untitledSeq
      }
      tabs.push(tab)
      return tab
    },

    activate(id) {
      if (!get(id)) return false
      activeId = id
      return true
    },

    findByPath(path) {
      const key = normalizePath(path)
      if (!key) return null
      return tabs.find((t) => normalizePath(t.path) === key) || null
    },

    setPath(id, path) {
      const tab = get(id)
      if (tab) tab.path = path
    },

    /** Returns true when the dirty flag actually changed. */
    setDirty(id, dirty) {
      const tab = get(id)
      if (!tab || tab.dirty === !!dirty) return false
      tab.dirty = !!dirty
      return true
    },

    anyDirty: () => tabs.some((t) => t.dirty),
    listDirty: () => tabs.filter((t) => t.dirty),

    /**
     * Remove a tab. When the active tab is closed the right neighbor becomes
     * active (or the left one at the end of the strip). Returns the id of the
     * tab that should now be active, or null when no tabs remain.
     */
    close(id) {
      const i = indexOf(id)
      if (i === -1) return activeId
      tabs.splice(i, 1)
      if (activeId !== id) return activeId
      const neighbor = tabs[i] || tabs[i - 1] || null
      activeId = neighbor ? neighbor.id : null
      return activeId
    },

    /** Id of the tab to the right of `id`, wrapping around. */
    nextId(id = activeId) {
      if (tabs.length === 0) return null
      const i = indexOf(id)
      return tabs[(i + 1) % tabs.length].id
    },

    /** Id of the tab to the left of `id`, wrapping around. */
    prevId(id = activeId) {
      if (tabs.length === 0) return null
      const i = indexOf(id)
      return tabs[(i - 1 + tabs.length) % tabs.length].id
    },

    /** Display name: file basename, or untitled(-N) for unsaved tabs. */
    title(id) {
      const tab = get(id)
      if (!tab) return ''
      if (tab.path) return basename(tab.path)
      return tab.untitledIndex > 1 ? `untitled-${tab.untitledIndex}` : 'untitled'
    }
  }
}
