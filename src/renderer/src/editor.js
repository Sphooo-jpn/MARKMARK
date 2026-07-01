// Milkdown "Crepe" — a Typora-like inline WYSIWYG editor built on ProseMirror.
// Markdown is the source of truth, so round-tripping (load -> edit -> save) is faithful.
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

/**
 * Create and mount a Crepe editor.
 * @param {{ root: HTMLElement, markdown: string, onChange?: () => void }} opts
 * @returns {Promise<{ getMarkdown: () => string, destroy: () => Promise<void> }>}
 */
export async function createEditor({ root, markdown, onChange }) {
  const crepe = new Crepe({
    root,
    defaultValue: markdown ?? '',
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: 'Markdown を入力…' }
    }
  })

  crepe.on((listener) => {
    listener.markdownUpdated(() => {
      onChange?.()
    })
  })

  await crepe.create()

  return {
    getMarkdown: () => crepe.getMarkdown(),
    destroy: async () => {
      await crepe.destroy()
    }
  }
}
