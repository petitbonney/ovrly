// The docs site (VitePress), published on GitHub Pages by .github/workflows/docs.yml: two sections, each with its own
// sidebar, picked from the home page.
import { defineConfig } from 'vitepress'

const repo = 'https://github.com/petitbonney/ovrly'

export default defineConfig({
  title: 'Ovrly',
  description: 'Node-based automation for live stream interactions.',
  base: '/ovrly/', // served at petitbonney.github.io/ovrly
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: 'localhostLinks', // Ovrly's own address; links between pages are still checked
  srcExclude: ['screenshots/**'], // the screenshot script, not pages
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/ovrly/logo.svg' }]],
  markdown: {
    // `{{ }}` is Ovrly's template syntax, and Vue's: keep inline code as written (code blocks already are).
    config(md) {
      const code = md.renderer.rules.code_inline
      md.renderer.rules.code_inline = (...args) => code(...args).replace('<code', '<code v-pre')
    },
  },
  themeConfig: {
    logo: { light: '/wordmark.svg', dark: '/wordmark-dark.svg', alt: 'Ovrly' },
    siteTitle: false, // the wordmark already reads "Ovrly"
    nav: [
      { text: 'Streamer', link: '/streamer/', activeMatch: '/streamer/' },
      { text: 'Developer', link: '/developer/', activeMatch: '/developer/' },
      { text: 'Download', link: `${repo}/releases` },
    ],
    sidebar: {
      '/streamer/': [
        { text: 'Start', items: [
          { text: 'Getting started', link: '/streamer/' },
          { text: 'Templates', link: '/streamer/templates' },
        ] },
        { text: 'Use', items: [
          { text: 'The editor', link: '/streamer/editor' },
          { text: 'Data and variables', link: '/streamer/data' },
          { text: 'Nodes', link: '/streamer/nodes' },
          { text: 'Widgets', link: '/streamer/widgets' },
        ] },
        { text: 'Connect', items: [
          { text: 'Twitch', link: '/streamer/twitch' },
          { text: 'OBS', link: '/streamer/obs' },
          { text: 'Stream Deck', link: '/streamer/stream-deck' },
          { text: 'Philips Hue and Giphy', link: '/streamer/hue-giphy' },
        ] },
        { text: 'More', items: [
          { text: 'Files, LAN and safety', link: '/streamer/files' },
          { text: 'Troubleshooting', link: '/streamer/troubleshooting' },
        ] },
      ],
      '/developer/': [
        { text: 'Understand', items: [
          { text: 'Architecture', link: '/developer/' },
          { text: 'HTTP API', link: '/developer/api' },
        ] },
        { text: 'Build', items: [
          { text: 'Run from source', link: '/developer/from-source' },
          { text: 'Writing a node', link: '/developer/nodes' },
          { text: 'Writing a widget', link: '/developer/widgets' },
          { text: 'Custom nodes and widgets', link: '/developer/custom' },
        ] },
        { text: 'Contribute', items: [
          { text: 'Contributing', link: '/developer/contributing' },
        ] },
      ],
    },
    search: { provider: 'local' },
    outline: 'deep',
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/master/docs/:path`, text: 'Edit this page on GitHub' },
    footer: { message: 'Released under the GPL-3.0-or-later license.' },
  },
})
