// Tabler icons by name for the server: node and widget types name theirs (e.g. icon: 'dice-5'), and Control Pad buttons too.
const shapes = {}

// A Tabler icon's SVG shapes, e.g. "dice-5" -> IconDice5's [[tag, attrs]]; undefined if there is no such icon.
export function iconNode(name = '') {
  const file = `Icon${name.split('-').map((w) => w && w[0].toUpperCase() + w.slice(1)).join('')}.mjs`
  return (shapes[name] ??= import(`@tabler/icons-react/dist/esm/icons/${file}`).then((m) => m.__iconNode, () => undefined))
}
