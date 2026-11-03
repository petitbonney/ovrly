// Icons by name for the server: node and widget types name theirs (e.g. icon: 'dice-5'), and Control Pad buttons too.
// Ovrly's own (server/icons/<name>.svg, 24px; a filled shape says fill="currentColor" itself) come first, then Tabler's.
import fs from 'node:fs/promises'

const shapes = {}

// An icon's SVG shapes, e.g. "dice-5" -> IconDice5's [[tag, attrs]]; undefined if there is no such icon.
export function iconNode(name = '') {
  const file = `Icon${name.split('-').map((w) => w && w[0].toUpperCase() + w.slice(1)).join('')}.mjs`
  return (shapes[name] ??= own(name).catch(() => import(`@tabler/icons-react/dist/esm/icons/${file}`).then((m) => m.__iconNode, () => undefined)))
}

// One of Ovrly's own icons as Tabler shapes: its elements inside <svg>, each with its attributes and a key.
async function own(name) {
  if (!/^[\w-]+$/.test(name)) throw new Error('not an icon name')
  const svg = await fs.readFile(new URL(`./icons/${name}.svg`, import.meta.url), 'utf8')
  return [...svg.replace(/<svg[^>]*>/, '').matchAll(/<(\w+)([^>]*?)\/>/g)].map(([, tag, attrs], i) =>
    [tag, { ...Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])), key: `svg-${i}` }])
}
