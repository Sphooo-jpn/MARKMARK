import { describe, it, expect } from 'vitest'
import { createTabStore, normalizePath, basename } from '../../src/renderer/src/tab-store.js'

describe('normalizePath', () => {
  it('treats forward/back slashes and case as equal (Windows semantics)', () => {
    expect(normalizePath('C:/Users/foo/A.md')).toBe(normalizePath('c:\\users\\foo\\a.md'))
  })

  it('returns null for empty input', () => {
    expect(normalizePath(null)).toBeNull()
    expect(normalizePath('')).toBeNull()
  })
})

describe('basename', () => {
  it('handles both separators', () => {
    expect(basename('C:\\dir\\file.md')).toBe('file.md')
    expect(basename('/home/user/file.md')).toBe('file.md')
    expect(basename(null)).toBeNull()
  })
})

describe('createTabStore', () => {
  it('adds tabs with increasing ids and does not activate them', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    expect(b.id).toBeGreaterThan(a.id)
    expect(s.count()).toBe(2)
    expect(s.getActive()).toBeNull()
  })

  it('names untitled tabs sequentially and files by basename', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    const c = s.add({ path: 'C:\\docs\\note.md' })
    expect(s.title(a.id)).toBe('untitled')
    expect(s.title(b.id)).toBe('untitled-2')
    expect(s.title(c.id)).toBe('note.md')
    expect(s.title(9999)).toBe('')
  })

  it('activates only existing tabs', () => {
    const s = createTabStore()
    const a = s.add()
    expect(s.activate(a.id)).toBe(true)
    expect(s.getActiveId()).toBe(a.id)
    expect(s.activate(12345)).toBe(false)
    expect(s.getActiveId()).toBe(a.id)
  })

  it('finds open tabs by path regardless of case and separators', () => {
    const s = createTabStore()
    const t = s.add({ path: 'C:\\Docs\\Note.md' })
    expect(s.findByPath('c:/docs/note.md')).toBe(t)
    expect(s.findByPath('c:/docs/other.md')).toBeNull()
    expect(s.findByPath(null)).toBeNull()
  })

  it('setDirty reports whether the flag changed and aggregates', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    expect(s.setDirty(a.id, true)).toBe(true)
    expect(s.setDirty(a.id, true)).toBe(false) // no change
    expect(s.anyDirty()).toBe(true)
    expect(s.listDirty()).toEqual([s.get(a.id)])
    expect(s.setDirty(a.id, false)).toBe(true)
    expect(s.anyDirty()).toBe(false)
    expect(s.setDirty(b.id, false)).toBe(false)
    expect(s.setDirty(9999, true)).toBe(false)
  })

  it('setPath updates the path (after Save As)', () => {
    const s = createTabStore()
    const a = s.add()
    s.setPath(a.id, 'C:\\x\\saved.md')
    expect(s.get(a.id).path).toBe('C:\\x\\saved.md')
    expect(s.title(a.id)).toBe('saved.md')
  })

  it('closing the active tab promotes the right neighbor, or the left one at the end', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    const c = s.add()
    s.activate(b.id)
    expect(s.close(b.id)).toBe(c.id) // right neighbor
    s.activate(c.id)
    expect(s.close(c.id)).toBe(a.id) // last tab -> left neighbor
    expect(s.close(a.id)).toBeNull() // nothing left
    expect(s.count()).toBe(0)
  })

  it('closing a non-active tab keeps the active tab', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    s.activate(a.id)
    expect(s.close(b.id)).toBe(a.id)
    expect(s.getActiveId()).toBe(a.id)
  })

  it('close of unknown id is a no-op', () => {
    const s = createTabStore()
    const a = s.add()
    s.activate(a.id)
    expect(s.close(777)).toBe(a.id)
    expect(s.count()).toBe(1)
  })

  it('nextId/prevId cycle through the strip', () => {
    const s = createTabStore()
    const a = s.add()
    const b = s.add()
    const c = s.add()
    s.activate(c.id)
    expect(s.nextId()).toBe(a.id) // wraps
    expect(s.prevId()).toBe(b.id)
    s.activate(a.id)
    expect(s.nextId()).toBe(b.id)
    expect(s.prevId()).toBe(c.id) // wraps backwards
  })

  it('nextId/prevId return null when empty', () => {
    const s = createTabStore()
    expect(s.nextId()).toBeNull()
    expect(s.prevId()).toBeNull()
  })
})
