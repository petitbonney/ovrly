// Action: adds { sound }: a .wav of the text spoken in a language and voice, made on this computer (Settings → Text-to-Speech
// downloads the voice model), e.g. for a Sound widget's {{sound}}.
import { fill } from '../template.js'
import * as speech from '../integrations/speech.js'

const MAX = 500 // characters spoken at most: a long chat message would take a while to make and to hear
const names = new Intl.DisplayNames(['en'], { type: 'language' })
const voice = (v) => ({ value: v, label: `${v[0] === 'F' ? 'Female' : 'Male'} ${v[1]}` })

export default {
  type: 'speech',
  label: 'Text-to-Speech',
  icon: 'voice',
  category: 'action',
  group: 'Media',
  play: true,
  needs: ['speech'],
  description: 'Speaks a text with a voice made on this computer and adds the sound as {{sound}}, for a Sound widget.',
  adds: { sound: 'The spoken text (.wav), for a Sound widget' },
  fields: {
    text: { vars: true, multiline: true, hint: `e.g. {{user}} says {{message}}; ${MAX} characters at most` },
    lang: {
      label: 'Language',
      options: speech.LANGS.map((l) => ({ value: l, label: names.of(l) })).sort((a, b) => a.label.localeCompare(b.label)),
      hint: "The text's language: it sets how words are read",
    },
    voice: { options: speech.VOICES.map(voice) },
    speed: { unit: '%', presets: [80, 100, 120, 150] },
  },
  config: { text: 'Thanks for the follow, {{user}}!', lang: 'en', voice: 'F1', speed: 100 },
  async run({ config, data }) {
    const text = fill(config.text, data).trim().slice(0, MAX)
    if (!text) throw new Error('Text-to-Speech: nothing to say (the text is empty)')
    const sound = await speech.say(text, { lang: config.lang, voice: config.voice, speed: (config.speed || 100) / 100 })
    return { ...data, sound }
  },
}
