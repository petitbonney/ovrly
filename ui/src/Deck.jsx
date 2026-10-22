// Control Pad node: its buttons' icons and URLs, the icon picker of its settings, and the grid of buttons that fire
// them from the editor, as its mode would (so not while the workflow is off), each marked when a key shows it.
import { useEffect, useState } from 'react'
import { ActionIcon, Menu, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { animate } from 'animejs'
import {
  IconAlarm, IconBell, IconBolt, IconBookmark, IconBroadcast, IconCamera, IconClock, IconCoffee, IconConfetti, IconCrown,
  IconDeviceGamepad2, IconDice5, IconEye, IconEyeOff, IconFlame, IconGhost, IconGift, IconHandStop, IconHeart,
  IconLayoutDashboard, IconMessage, IconMicrophone, IconMicrophoneOff, IconMoodSad, IconMoodSmile, IconMoon, IconMovie,
  IconMusic, IconPhoto, IconPizza, IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconPower, IconRefresh, IconRocket,
  IconLink, IconScissors, IconSkull, IconSpeakerphone, IconStar, IconSun, IconSwords, IconThumbDown, IconThumbUp, IconTrophy,
  IconVideo, IconVideoOff, IconVolume, IconVolumeOff,
} from '@tabler/icons-react'
import { get, json } from './api.js'

// The icons a button can have, by Tabler name (the server draws the Stream Deck keys from it): a short list to pick
// from at a glance, not the 5000 of Tabler.
export const deckIcons = {
  star: IconStar, heart: IconHeart, flame: IconFlame, bolt: IconBolt, bell: IconBell, gift: IconGift, trophy: IconTrophy,
  crown: IconCrown, confetti: IconConfetti, rocket: IconRocket, swords: IconSwords, 'dice-5': IconDice5,
  'device-gamepad-2': IconDeviceGamepad2, 'thumb-up': IconThumbUp, 'thumb-down': IconThumbDown, 'mood-smile': IconMoodSmile,
  'mood-sad': IconMoodSad, skull: IconSkull, ghost: IconGhost, 'hand-stop': IconHandStop, 'player-play': IconPlayerPlay,
  'player-pause': IconPlayerPause, 'player-stop': IconPlayerStop, refresh: IconRefresh, power: IconPower,
  microphone: IconMicrophone, 'microphone-off': IconMicrophoneOff, camera: IconCamera, video: IconVideo,
  'video-off': IconVideoOff, movie: IconMovie, eye: IconEye, 'eye-off': IconEyeOff, 'layout-dashboard': IconLayoutDashboard,
  photo: IconPhoto, volume: IconVolume, 'volume-off': IconVolumeOff, music: IconMusic, speakerphone: IconSpeakerphone,
  broadcast: IconBroadcast, message: IconMessage, clock: IconClock, alarm: IconAlarm, coffee: IconCoffee, pizza: IconPizza,
  moon: IconMoon, sun: IconSun, scissors: IconScissors, bookmark: IconBookmark,
}

// A button's URL path: its name as a slug for reading, then its id, the only part the server looks at.
const slug = (name) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const deckUrl = (b) => `/hooks/deck/${[slug(b.name), b.id].filter(Boolean).join('-')}`

// A random id for a new button, e.g. "k3x9".
export const buttonId = () => Math.random().toString(36).slice(2, 6)

// The icon of a button, in its color; a click opens the other icons.
export function IconPicker({ value, color, onChange }) {
  const Icon = deckIcons[value] ?? IconStar
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <ActionIcon variant="light" color={color} size={28} aria-label="Icon"><Icon size={18} /></ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <SimpleGrid cols={8} spacing={2} verticalSpacing={2}>
          {Object.entries(deckIcons).map(([name, Icon]) => (
            <Tooltip key={name} label={name} openDelay={400}>
              <ActionIcon variant={name === value ? 'filled' : 'subtle'} color={name === value ? color : 'gray'} onClick={() => onChange(name)}>
                <Icon size={18} />
              </ActionIcon>
            </Tooltip>
          ))}
        </SimpleGrid>
      </Menu.Dropdown>
    </Menu>
  )
}

// Where a paired key is, e.g. "Stream Deck MK.2, row 1, column 3".
const place = (k, devices) => [devices[k.device]?.name ?? 'Stream Deck', k.row == null ? 'in a multi action' : `row ${k.row + 1}, column ${k.column + 1}`].join(', ')

// The buttons, five a row like a Stream Deck; a press goes the mode's way: a key press for the Stream Deck, the
// button's URL for Companion. Whether the workflow is on, and the keys paired with the Ovrly plugin, are asked again
// every 2s, so switching the workflow off greys the grid.
export default function DeckGrid({ workflow, node, config }) {
  const [on, setOn] = useState(true)
  const [deck, setDeck] = useState({ devices: {}, keys: [] })
  useEffect(() => {
    const load = () => {
      get(`/api/workflows/${workflow}`).then((w) => setOn(w.enabled !== false), () => {})
      get('/api/streamdeck').then(setDeck, () => {})
    }
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [workflow])
  const plugin = config.mode === 'streamdeck'
  const press = (e, b) => {
    animate(e.currentTarget, { scale: [0.88, 1], duration: 300, ease: 'outBack' })
    if (plugin) fetch('/api/streamdeck/press', json('POST', { workflow, node, button: b.id }))
    else fetch(deckUrl(b), { method: 'POST' })
  }
  return (
    <Stack gap="xs" flex="1 1 320px" miw={0}>
      <Text size="xs" c="dimmed">{!on ? 'This workflow is off: its buttons fire nothing.' : `Press a button to fire it, as ${plugin ? 'its Stream Deck key' : 'Companion'} would.`}</Text>
      {plugin && deck.connected && <Text size="xs" c="dimmed">In the Stream Deck app, drag Ovrly → Ovrly button onto a key, then pick a button in its settings. <IconLink size={11} /> marks the buttons on a key.</Text>}
      {!config.buttons.length && <Text size="sm" c="dimmed">Add a button on the left.</Text>}
      <SimpleGrid cols={5} spacing="xs" maw={5 * 88}>
        {config.buttons.map((b) => {
          const Icon = deckIcons[b.icon] ?? IconStar
          const keys = !plugin ? [] : deck.keys.filter((k) => k.workflow === workflow && k.node === node && k.button === b.id)
          return (
            <UnstyledButton key={b.id} className="deck-button" disabled={!on} onClick={(e) => press(e, b)} style={{ background: b.color }}>
              <Icon size={28} stroke={1.6} />
              <span>{b.name}</span>
              {keys.length > 0 && (
                <Tooltip label={keys.map((k) => <div key={k.context}>On {place(k, deck.devices)}</div>)} withinPortal>
                  <IconLink className="paired" size={14} />
                </Tooltip>
              )}
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
