// Editor themes, picked in Settings → Appearance and kept by this browser: Ovrly's own, then palettes of well-known
// IDE themes. Each palette gives a few colors (page, surfaces, border, text, dimmed text, accent, and the four node
// category colors); ide() turns them into a Mantine color scheme and theme, and the graph's colors (vars, set as
// --ovrly-<name> CSS variables for app.css and the node icons). swatch: the colors shown in the theme picker.
// Overlays don't follow them.

// Mixes two #rrggbb colors: t = 0 gives a, 1 gives b.
const mix = (a, b, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')}`
// Relative luminance (WCAG), to pick an accent shade that white text reads on (4.5:1).
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// bg: the page; canvas: the graph; surface: inputs and nodes; border; fg: text; dim: secondary text; accent: buttons,
// links, selection; trigger, logic, action, widget: the node categories.
function ide({ label, scheme, bg, canvas, surface, border, fg, dim, accent, trigger, logic, action, widget }) {
  // Mantine's shades of a color: lighter (0-5), the color itself (6), darker (7-9).
  const shades = [0.8, 0.65, 0.5, 0.35, 0.2, 0.1].map((t) => mix(accent, '#ffffff', t)).concat(accent, ...[0.15, 0.3, 0.45].map((t) => mix(accent, '#000000', t)))
  const filled = [6, 7, 8, 9].find((i) => 1.05 / (luminance(shades[i]) + 0.05) >= 4.5) ?? 9
  const theme = { primaryColor: 'accent', primaryShade: { light: filled, dark: filled }, colors: { accent: shades } }
  if (scheme === 'dark') {
    // Mantine's dark shades: 0 text, 2 dimmed text, 4 borders, 5 hover, 6 inputs, 7 page.
    theme.colors.dark = [fg, mix(fg, dim, 0.5), dim, mix(dim, border, 0.5), border, mix(surface, border, 0.5), surface, bg, mix(bg, '#000000', 0.2), mix(bg, '#000000', 0.4)]
  } else {
    // Light: the page is "white", text "black"; grays: 0 hover, 4 borders, 6 dimmed text.
    Object.assign(theme, { white: bg, black: fg })
    theme.colors.gray = [surface, mix(surface, border, 0.33), mix(surface, border, 0.66), mix(border, surface, 0.2), border, mix(border, dim, 0.5), dim, mix(dim, fg, 0.33), mix(dim, fg, 0.66), fg]
  }
  return {
    label, scheme, theme, swatch: [bg, accent, trigger, widget],
    vars: {
      canvas, dots: mix(canvas, fg, 0.15), node: scheme === 'dark' ? surface : bg, line: mix(fg, canvas, 0.45), selected: fg, label: fg, sub: dim,
      trigger, logic, action, widget,
    },
  }
}

export default {
  ovrly: {
    label: 'Ovrly', scheme: 'dark', swatch: ['#242424', '#228be6', '#ff922b', '#38d9a9'],
    vars: {
      canvas: '#2d2e2e', dots: '#555555', node: '#414244', line: '#9a9a9a', selected: '#ffffff', label: '#eeeeee', sub: '#999999',
      trigger: 'var(--mantine-color-orange-5)', logic: 'var(--mantine-color-blue-4)', action: 'var(--mantine-color-grape-4)', widget: 'var(--mantine-color-teal-4)',
    },
  },
  dracula: ide({
    label: 'Dracula', scheme: 'dark', bg: '#282a36', canvas: '#21222c', surface: '#343746', border: '#44475a', fg: '#f8f8f2', dim: '#a3abd0',
    accent: '#bd93f9', trigger: '#ffb86c', logic: '#8be9fd', action: '#ff79c6', widget: '#50fa7b',
  }),
  tokyo: ide({
    label: 'Tokyo Night', scheme: 'dark', bg: '#1a1b26', canvas: '#16161e', surface: '#24283b', border: '#3b4261', fg: '#c0caf5', dim: '#8189b3',
    accent: '#7aa2f7', trigger: '#ff9e64', logic: '#7dcfff', action: '#bb9af7', widget: '#9ece6a',
  }),
  nord: ide({
    label: 'Nord', scheme: 'dark', bg: '#2e3440', canvas: '#292e39', surface: '#3b4252', border: '#4c566a', fg: '#eceff4', dim: '#a5afc2',
    accent: '#88c0d0', trigger: '#d08770', logic: '#81a1c1', action: '#b48ead', widget: '#a3be8c',
  }),
  catppuccin: ide({
    label: 'Catppuccin', scheme: 'dark', bg: '#1e1e2e', canvas: '#181825', surface: '#313244', border: '#45475a', fg: '#cdd6f4', dim: '#a6adc8',
    accent: '#cba6f7', trigger: '#fab387', logic: '#89b4fa', action: '#f5c2e7', widget: '#a6e3a1',
  }),
  gruvbox: ide({
    label: 'Gruvbox', scheme: 'dark', bg: '#282828', canvas: '#1d2021', surface: '#3c3836', border: '#504945', fg: '#ebdbb2', dim: '#a89984',
    accent: '#d79921', trigger: '#fe8019', logic: '#83a598', action: '#d3869b', widget: '#8ec07c',
  }),
  onedark: ide({
    label: 'One Dark Pro', scheme: 'dark', bg: '#282c34', canvas: '#21252b', surface: '#2c313a', border: '#3e4451', fg: '#abb2bf', dim: '#8b929e',
    accent: '#61afef', trigger: '#d19a66', logic: '#56b6c2', action: '#c678dd', widget: '#98c379',
  }),
  monokai: ide({
    label: 'Monokai', scheme: 'dark', bg: '#272822', canvas: '#1e1f1c', surface: '#3e3d32', border: '#49483e', fg: '#f8f8f2', dim: '#a59f85',
    accent: '#f92672', trigger: '#fd971f', logic: '#66d9ef', action: '#ae81ff', widget: '#a6e22e',
  }),
  solarized: ide({
    label: 'Solarized Dark', scheme: 'dark', bg: '#002b36', canvas: '#00252e', surface: '#073642', border: '#2a4c55', fg: '#93a1a1', dim: '#6c8288',
    accent: '#268bd2', trigger: '#cb4b16', logic: '#2aa198', action: '#6c71c4', widget: '#859900',
  }),
  github: ide({
    label: 'GitHub Light', scheme: 'light', bg: '#ffffff', canvas: '#f6f8fa', surface: '#f6f8fa', border: '#d0d7de', fg: '#1f2328', dim: '#59636e',
    accent: '#0969da', trigger: '#bc4c00', logic: '#0969da', action: '#8250df', widget: '#1a7f37',
  }),
  onelight: ide({
    label: 'One Light', scheme: 'light', bg: '#fafafa', canvas: '#f0f0f1', surface: '#f0f0f1', border: '#dbdbdc', fg: '#383a42', dim: '#696c77',
    accent: '#4078f2', trigger: '#c18401', logic: '#0184bc', action: '#a626a4', widget: '#50a14f',
  }),
  latte: ide({
    label: 'Catppuccin Latte', scheme: 'light', bg: '#eff1f5', canvas: '#e6e9ef', surface: '#e6e9ef', border: '#bcc0cc', fg: '#4c4f69', dim: '#6c6f85',
    accent: '#8839ef', trigger: '#fe640b', logic: '#1e66f5', action: '#ea76cb', widget: '#40a02b',
  }),
}
