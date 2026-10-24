// Settings form generated from a config's defaults (shown in their order), plus optional per-field hints from the node
// or widget type: { label, hint, info, section, unit, options, presets, vars, rewards (a Twitch channel points reward picker), multiline, hidden, only, type: 'json' | 'code' | 'workflow' | 'secret' | 'var' | 'list' | 'tags' | 'action' | 'inputs' | 'palette' | 'image' | 'sound' | 'video' | 'giphy' | 'myinstants' | 'window' }.
// hint: one short line under the label; info: anything longer, in an ⓘ tooltip beside the label. section: a heading
// shown before this field, starting a group (for nodes with many settings). A field shown only while a switch is on
// (only: { someSwitch: true }) is indented under it. Plain-text options show with a capital first letter; a '-' among
// them draws a line there in a select.
// slider: true shows the options as marks on a slider, from the first to the last, instead of buttons; tips: { option: text } adds a tooltip to each mark.
// On a number, slider: true is a slider from min to max (0 to 100 by default), its value beside the label; a volume's
// slider has a mute button.
// presets: common values of a number, e.g. a duration's [3, 5, 10] seconds, shown as buttons next to its input.
// off: true labels the 0 preset "off" (where 0 turns the setting off); a word labels it that word instead (e.g. 'any').
// only: { key: value } shows the field only while those other settings have those values, e.g. { mode: 'twitch' }
// (or one of them: { layout: ['wheel', 'slots'] }). fixed: a list with a set number of items (no add, remove or move).
// An option { value, label, streamer: true } is a Twitch feature: it needs Twitch in Streamer mode, like { needs: 'twitch' }.
// An option { value, label, needs: key } needs that integration: disabled while it isn't ready (context.off lists the
// requirements not met, see Settings.jsx); the settings pane notes it when picked.
// A list default with options gets one chip per option, any number picked (e.g. the kinds of subs a trigger fires on).
// Any other list default (e.g. a poll's options) gets a list editor (columns: { key: field } for its items' fields, e.g. a
// { type: 'tags' } input, { type: 'icon' } an icon picker, { type: 'id' } a hidden random id, { options } a select; a column's
// label, unit, max, and only: { key: value } of the same item, else disabled), a color default ("#rrggbb") a color picker,
// type: 'list' a list the workflow gives at run time: a switch picks Custom (its own items, shaped like f.row, a list
// editor) or From data (a data key, e.g. items from a Fan In node); both are kept, as { from, key, items }. Without data
// before it (a trigger, a manual run) only its items show.
// type: 'palette' a grid of color squares ([{ color }]; text: the key of a text color, picked in a square before them), type: 'deck' a Control Pad node's buttons (with Companion, each with a button to copy its URL), type: 'hue-steps' a
// Hue routine's steps (warned of what its limits change), { obs: 'scenes' | 'sources' } suggestions from OBS and
// { hue: 'devices' } a Hue light, room or zone.
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Autocomplete, Button, Chip, ColorInput, ColorPicker, CopyButton, Group, Image, JsonInput, Menu, NumberInput, PasswordInput, Popover, SegmentedControl,
  Select, Slider, Stack, Switch, TagsInput, Text, Textarea, TextInput, Tooltip, UnstyledButton,
} from '@mantine/core'
import { IconBraces, IconCheck, IconCopy, IconGripVertical, IconInfoCircle, IconPlus, IconFolderOpen, IconVolume, IconVolume2, IconVolume3, IconVolume4, IconX } from '@tabler/icons-react'
import { get } from './api.js'
import { openSettings, requirements } from './Settings.jsx'
import Heading from './Heading.jsx'
import Notice from './Notice.jsx'
import { IconPicker, buttonId, deckUrl } from './Deck.jsx'
import GiphyPicker from './GiphyPicker.jsx'
import MyinstantsPicker from './MyinstantsPicker.jsx'

// "case1" -> "Case1", "sceneName" -> "Scene name"
export const humanize = (key) => key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)
// Plain-text options as { value, label }, the label with a capital first letter: "toggle" -> "Toggle".
const labelled = (options) => options?.map((o) => (typeof o === 'string' ? { value: o, label: o[0].toUpperCase() + o.slice(1) } : o))

// Suggestions filter: every option while the value is empty or one of them, else those containing it.
const suggest = ({ options, search }) => (!search || options.some((o) => o.value === search) ? options
  : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())))

// The "{}" button: a menu of the data keys available at this node (vars null: none, on a trigger); onPick(key) gets
// the one picked.
function VarMenu({ vars, onPick }) {
  if (!vars) return null
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Insert data from previous nodes">
          <ActionIcon variant="subtle" size="sm" aria-label="Insert data from previous nodes"><IconBraces size={16} /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      {/* Scrollable and capped: a long list must scroll itself, not the canvas behind it (nowheel/nopan) */}
      <Menu.Dropdown mah="50vh" className="nowheel nopan" style={{ overflowY: 'auto' }}>
        {vars.length ? vars.map((k) => <Menu.Item key={k} onClick={() => onPick(k)}>{`{{${k}}}`}</Menu.Item>)
          : <Menu.Label>Connect an input first</Menu.Label>}
      </Menu.Dropdown>
    </Menu>
  )
}

// Text input with a "{}" menu that inserts "{{key}}" placeholders at the cursor. With data, it also suggests those
// values as you type (see suggest).
function VarInput({ vars, value, onChange, multiline, data, ...props }) {
  const ref = useRef()
  const insert = (key) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    onChange(value.slice(0, start) + `{{${key}}}` + value.slice(el?.selectionEnd ?? start))
  }
  const menu = <VarMenu vars={vars} onPick={insert} />
  if (data) return <Autocomplete ref={ref} data={data} filter={suggest} value={value} onChange={onChange} rightSection={menu} {...props} />
  const Input = multiline ? Textarea : TextInput
  return <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rightSection={menu} autosize={multiline || undefined} minRows={multiline ? 2 : undefined} maxRows={multiline ? 8 : undefined} {...props} />
}

// A scene or source name, suggested from the OBS integration (the sources of the node's scene). Typing stays free,
// so it works with OBS closed, and with {{key}} placeholders.
function ObsInput({ list, scene, ...props }) {
  const [names, setNames] = useState([])
  const [error, setError] = useState('')
  const path = list === 'scenes' ? '/api/obs/scenes' : `/api/obs/sources?scene=${encodeURIComponent(scene)}`
  const skip = list === 'sources' && (!scene || scene.includes('{{'))
  useEffect(() => {
    if (skip) return setNames([])
    fetch(path).then(async (r) => {
      const body = await r.json()
      setNames(r.ok ? body : [])
      setError(r.ok ? '' : 'OBS is not connected: names can still be typed')
    }, () => setError('OBS is not reachable'))
  }, [path, skip])
  return <VarInput {...props} data={names} description={error || props.description} placeholder={names.length ? 'Pick or type a name' : undefined} />
}

// A Hue light, room or zone, picked from the bridge's (grouped). A device the bridge no longer has shows its id.
function HueInput(props) {
  const [devices, setDevices] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/hue/devices').then(async (r) => {
      const body = await r.json()
      setDevices(r.ok ? body : [])
      setError(r.ok ? '' : body.error)
    }, () => setError('Ovrly is not reachable'))
  }, [])
  const known = devices.some((g) => g.items.some((d) => d.value === props.value))
  const data = known || !props.value ? devices : [...devices, { group: 'Not found', items: [props.value] }]
  return <Select {...props} data={data} description={error || props.description} placeholder="Pick a light, room or zone" searchable allowDeselect={false} />
}

// A channel points reward, picked from the channel's (empty: any). A title no longer there still shows.
function RewardInput(props) {
  const [titles, setTitles] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/twitch/rewards').then(async (r) => {
      const body = await r.json()
      setTitles(r.ok ? body : [])
      setError(r.ok ? '' : body.error)
    }, () => setError('Ovrly is not reachable'))
  }, [])
  const data = !props.value || titles.includes(props.value) ? titles : [...titles, props.value]
  return <Select {...props} data={data} description={error || props.description} placeholder="Any reward" searchable clearable onChange={(v) => props.onChange(v ?? '')} />
}

// A Hue routine's steps, with a warning for each the limits change (limits: shortest step on a light and on a room or
// zone, most steps; from server/hue.js, which applies them) and a note on restoring a room or zone.
function HueSteps({ value, limits, device, transition, restore, ...props }) {
  const group = device.startsWith('grouped_light/')
  const min = group ? limits.group : limits.light
  const warnings = value.flatMap((s, i) => {
    if (i >= limits.steps) return []
    const duration = Math.max(min, Number(s.duration) || 0)
    return [
      Number(s.duration) < min && `Step ${i + 1} lasts ${Number(s.duration) || 0}ms, below the ${min}ms minimum on a ${group ? 'room or zone' : 'light'}: it will last ${min}ms.`,
      transition > duration && `Step ${i + 1}: the ${transition}ms transition is longer than the step: it will fade over ${duration}ms.`,
    ].filter(Boolean)
  })
  if (value.length > limits.steps) warnings.push(`Only the first ${limits.steps} steps will play.`)
  return (
    <Stack gap={4}>
      <ListInput {...props} value={value} />
      {warnings.length > 0 && <Notice>{warnings.map((w) => <div key={w}>{w}</div>)}</Notice>}
      {group && <Text size="xs" c="dimmed">Putting a room or zone back as it was sends one command per light, 0.1s apart{restore ? '' : ' (on Stop or Cancel)'}.</Text>}
    </Stack>
  )
}

// A saved workflow, picked by id.
function WorkflowSelect({ value, onChange, ...props }) {
  const [list, setList] = useState([])
  useEffect(() => {
    get('/api/workflows').then((all) => setList(all.map((w) => ({ value: w.id, label: w.name || w.id }))))
  }, [])
  return <Select {...props} data={list} value={value} onChange={onChange} placeholder="Pick a workflow" />
}

// An app or window (or part of its name), picked from those open now, listed again each time the list opens. Typing
// stays free.
function WindowInput({ onChange, ...props }) {
  const [names, setNames] = useState([])
  const load = () => fetch('/api/windows').then((r) => r.json()).then((list) => Array.isArray(list) && setNames(list), () => {})
  useEffect(() => {
    load()
  }, [])
  // Without the Accessibility permission (macOS), only app names come back.
  const titles = names.some((n) => n.includes(' — '))
  const description = titles || !names.length ? props.description : `${props.description}. Window titles need the Accessibility permission`
  return <Autocomplete {...props} description={description} data={names} filter={suggest} limit={100} onDropdownOpen={load}
    onChange={onChange} placeholder="Pick or type an app or window" />
}

// A time preset reads in its biggest unit that fits: 90 s -> "1m30", 1440 min -> "1d", 1000 ms -> "1s".
const SECONDS = { ms: 0.001, s: 1, min: 60 }
const STEPS = [['w', 604800], ['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]
function short(n, unit) {
  const s = n * (SECONDS[unit] ?? NaN)
  const i = STEPS.findIndex(([, size]) => s >= size)
  if (i < 0 || !Number.isInteger(s)) return `${n}${unit ?? ''}`
  const [name, size] = STEPS[i]
  const rest = (s % size) / (STEPS[i + 1]?.[1] ?? 1)
  return `${Math.floor(s / size)}${name}${rest ? String(rest).padStart(2, '0') : ''}`
}

// A number with preset buttons (the current one highlighted) and an input for any other value.
function PresetInput({ label, name, description, unit, presets, off, value, onChange }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Group gap={6} wrap="nowrap">
        {presets.map((n) => (
          <Button key={n} size="compact-xs" h={30} px="sm" variant={n === value ? 'filled' : 'default'} onClick={() => onChange(n)}>{off && n === 0 ? (off === true ? 'off' : off) : short(n, unit)}</Button>
        ))}
        <NumberInput size="xs" w={90} min={0} aria-label={`Custom ${name.toLowerCase()}`} suffix={unit && ` ${unit}`} value={value} onChange={(v) => onChange(Number(v))} />
      </Group>
    </Stack>
  )
}

// A number on a slider, its value beside the label. mute: a button beside it whose icon follows the level, and which
// mutes (0) or brings back the level it had (all of it if it was muted when the page opened).
const LEVELS = [[67, IconVolume], [34, IconVolume2], [1, IconVolume4], [0, IconVolume3]] // from this % up
function SliderInput({ label, description, unit, min = 0, max = 100, mute, value, onChange }) {
  const last = useRef(value || max)
  if (value > min) last.current = value
  const Icon = LEVELS.find(([from]) => ((value - min) / (max - min)) * 100 >= from)[1]
  return (
    <Stack gap={4}>
      <Group gap={6}>
        <Text size="xs" fw={500}>{label}</Text>
        <Text size="xs" c="dimmed">{value}{unit && ` ${unit}`}</Text>
      </Group>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Group gap="xs" wrap="nowrap">
        {mute && (
          <Tooltip label={value > min ? 'Mute' : 'Unmute'}>
            <ActionIcon variant="subtle" color="gray" aria-label={value > min ? 'Mute' : 'Unmute'} onClick={() => onChange(value > min ? min : last.current)}>
              <Icon size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Slider size="md" w={200} min={min} max={max} label={null} value={value} onChange={onChange} />
      </Group>
    </Stack>
  )
}

// An image, sound or video (kind): a preview, and a field to type a URL, a path or
// {{key}} (e.g. {{gif}} from a GIPHY node), with an icon button beside it to pick a file on disk.
const FILE_KINDS = { image: 'an image', sound: 'a sound', video: 'a video' }
function FileInput({ kind, label, description, value, onChange, vars }) {
  const [error, setError] = useState('')
  // The server opens the OS file dialog: a browser page can't see a picked file's path.
  const browse = async () => {
    const res = await fetch(`/api/browse-${kind}`, { method: 'POST' })
    const body = await res.json()
    setError(res.ok ? '' : body.error)
    if (body.path) onChange(body.path)
  }
  const src = value && (/^([a-z]:[\\/]|[\\/])/i.test(value) ? `/file?path=${encodeURIComponent(value)}` : value)
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && !value.includes('{{') && kind === 'image' && <Image src={src} alt="" h={90} fit="contain" radius="sm" bg="var(--mantine-color-default)" />}
      {value && !value.includes('{{') && kind === 'sound' && <audio controls style={{ width: '100%' }} src={src} />}
      {value && !value.includes('{{') && kind === 'video' && <video controls muted style={{ width: '100%', maxHeight: 140 }} src={src} />}
      {value && kind === 'video' && <Button size="xs" variant="subtle" color="red" style={{ alignSelf: 'start' }} onClick={() => onChange('')}>Clear</Button>}
      <Group gap={6} wrap="nowrap" align="start">
        <VarInput size="xs" flex={1} placeholder={`or ${FILE_KINDS[kind]} URL or file path`} vars={vars} value={value} onChange={onChange} />
        <Tooltip label="Browse files">
          <ActionIcon size={30} variant="default" aria-label="Browse files" onClick={browse}><IconFolderOpen size={16} /></ActionIcon>
        </Tooltip>
      </Group>
      {error && <Text size="xs" c="red">{error}</Text>}
    </Stack>
  )
}

// A GIF picked from Giphy or a sound from Myinstants (kind): a preview and a button opening the picker. The value is its
// URL. ready: false while Giphy isn't set up: the button opens its settings instead.
function PickInput({ kind, media = 'gif', rating, ready, label, description, value, onChange }) {
  const [picking, setPicking] = useState(false)
  const Picker = kind === 'giphy' ? GiphyPicker : MyinstantsPicker
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && (media === 'clip' ? <video src={value} controls muted loop style={{ height: 90 }} />
        : kind === 'giphy' ? <Image src={value} alt="" h={90} fit="contain" radius="sm" bg="var(--mantine-color-default)" />
        : <audio controls style={{ width: '100%' }} src={value} />)}
      <Group gap={6}>
        <Button size="xs" variant="default" onClick={() => (ready ? setPicking(true) : openSettings('giphy'))}>
          {!ready ? 'Set up Giphy first' : kind === 'giphy' ? `Pick a ${media === 'gif' ? 'GIF' : media}` : 'Pick a sound'}
        </Button>
        {value && <Button size="xs" variant="subtle" color="red" onClick={() => onChange('')}>Clear</Button>}
      </Group>
      <Picker opened={picking} onClose={() => setPicking(false)} onPick={onChange} media={media} rating={rating} />
    </Stack>
  )
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
// Tags are added on Enter, a comma or a space: none of them (commands, user names, keys, Twitch tags) has a space.
const TAG_SPLIT = [',', ' ']
// Tag fields scroll past about three lines of tags instead of growing.
const TAG_SCROLL = { maxHeight: 92, overflowY: 'auto' }
const swatches = ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44']
// Column widths of list items with fields: icons, colors and numbers are narrow, text takes the rest.
const width = (v, column) => (column?.type === 'icon' ? 28 : column?.options ? 76 : isColor(v) ? 110 : typeof v === 'number' ? 72 : undefined)

// One list item: a text, or an object edited field by field. shape (a default item) says which input each field gets,
// so a color being typed doesn't turn into a text field.
function ItemInput({ item, shape, columns = {}, onChange }) {
  if (typeof shape !== 'object') return <TextInput size="xs" flex={1} value={item} onChange={(e) => onChange(e.target.value)} />
  return Object.entries(shape).map(([key, example]) => {
    const w = width(example, columns[key])
    const props = { size: 'xs', w, flex: w ? undefined : 1, 'aria-label': columns[key]?.label ?? humanize(key), disabled: !applies(columns[key], item) }
    const set = (v) => onChange({ ...item, [key]: v })
    if (columns[key]?.type === 'id') return null
    if (columns[key]?.options) return <Select key={key} {...props} data={labelled(columns[key].options)} value={item[key]} onChange={set} allowDeselect={false} />
    if (columns[key]?.type === 'icon') return <IconPicker key={key} value={item[key]} color={Object.values(item).find(isColor)} onChange={set} />
    if (columns[key]?.type === 'tags') {
      return <TagsInput key={key} {...props} miw={0} styles={{ input: TAG_SCROLL, inputField: { minWidth: 30 } }} data={columns[key].options} splitChars={TAG_SPLIT}
        value={item[key] ? item[key].split('+') : []} onChange={(v) => set(v.join('+'))} />
    }
    if (isColor(example)) return <ColorInput key={key} {...props} swatches={swatches} value={item[key] ?? ''} onChange={set} />
    if (typeof example === 'number') {
      return <NumberInput key={key} {...props} min={0} max={columns[key]?.max} suffix={columns[key]?.unit && ` ${columns[key].unit}`} value={item[key]} onChange={(v) => set(Number(v))} />
    }
    return <TextInput key={key} {...props} miw={0} value={item[key] ?? ''} onChange={(e) => set(e.target.value)} />
  })
}

// A list setting: one row per item, reordered by dragging its grip (dropped above the row it lands on) or removed,
// and an Add button. A new item is empty
// text, or shaped like the default items with empty text and, for colors, the first swatch not used yet (and a new id,
// the default icon). extra(item) shows before its remove button.
function ListInput({ label, description, value, defaults, fixed, columns = {}, extra, onChange }) {
  const shape = defaults[0]
  const set = (i, item) => onChange(value.map((v, j) => (j === i ? item : v)))
  const [drag, setDrag] = useState(null) // { from, over }: the row being dragged and the row it is over
  const rows = useRef()
  const drop = () => {
    const next = value.filter((_, j) => j !== drag.from)
    next.splice(drag.over > drag.from ? drag.over - 1 : drag.over, 0, value[drag.from])
    onChange(next)
    setDrag(null)
  }
  const blank = () => {
    if (typeof shape !== 'object') return ''
    const used = value.flatMap((item) => Object.values(item))
    const fresh = swatches.find((c) => !used.includes(c)) ?? swatches[value.length % swatches.length]
    return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, columns[k]?.type === 'id' ? buttonId() : columns[k]?.type === 'icon' || columns[k]?.options ? v
      : isColor(v) ? fresh : typeof v === 'string' ? '' : v]))
  }
  return (
    <Stack gap={4}>
      {label && <Text size="xs" fw={500}>{label}</Text>}
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {typeof shape === 'object' && (
        // Column titles, as wide as the fields under them.
        <Group gap={6} wrap="nowrap" pl={28} pr={extra ? 56 : 28}>
          {Object.entries(shape).filter(([key]) => columns[key]?.type !== 'id').map(([key, example]) => (
            <Text key={key} size="xs" c="dimmed" w={width(example, columns[key])} flex={width(example, columns[key]) ? undefined : 1}>{columns[key]?.label ?? humanize(key)}</Text>
          ))}
        </Group>
      )}
      {/* Rows scroll past about 6, headers and Add staying in view; py: room for the drop line. */}
      <Stack ref={rows} gap={4} mah={240} py={2} style={{ overflowY: 'auto' }}>
        {value.map((item, i) => (
          <div
            key={i}
            // The drop spot shows as a line above the row (or below the last one).
            style={{ boxShadow: drag && drag.over === i && drag.from !== i ? '0 -2px 0 var(--mantine-color-blue-5)' : undefined }}
            onDragOver={(e) => {
              if (!drag) return
              e.preventDefault()
              const { top, height } = e.currentTarget.getBoundingClientRect()
              const over = e.clientY > top + height / 2 && i === value.length - 1 ? value.length : i
              if (over !== drag.over) setDrag({ ...drag, over })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag) drop()
            }}
          >
            <Group gap={6} wrap="nowrap">
              {!fixed && <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                style={{ cursor: 'grab' }}
                aria-label="Drag to reorder"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('application/ovrly-row', String(i)) // Firefox needs some data to drag
                  e.dataTransfer.setDragImage(e.currentTarget.parentElement, 0, 0)
                  setDrag({ from: i, over: i })
                }}
                onDragEnd={() => setDrag(null)}
              >
                <IconGripVertical size={14} />
              </ActionIcon>}
              <ItemInput item={item} shape={shape} columns={columns} onChange={(v) => set(i, v)} />
              {extra?.(item)}
              {!fixed && <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><IconX size={14} /></ActionIcon>}
            </Group>
          </div>
        ))}
        {drag?.over === value.length && <div style={{ height: 2, marginTop: -2, background: 'var(--mantine-color-blue-5)' }} />}
      </Stack>
      {!fixed && (
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} fullWidth
          onClick={() => {
            onChange([...value, blank()])
            requestAnimationFrame(() => rows.current?.scrollTo({ top: rows.current.scrollHeight }))
          }}>
          Add
        </Button>
      )}
    </Stack>
  )
}

// A type: 'palette' field: a grid of color squares, [{ color }]. A square opens its picker (with Remove); the dashed
// "+" adds the first swatch not used yet and opens it. With text (a text color) and onText, a square before them,
// set apart by a line, picks the labels' color: an "A" in it, on the first color.
function PaletteInput({ label, description, value, onChange, text, onText }) {
  const [open, setOpen] = useState(null) // the square whose picker is open: its index, or 'text'
  const set = (i, color) => onChange(value.map((v, j) => (j === i ? { color } : v)))
  const add = () => {
    const used = value.map((v) => v.color)
    onChange([...value, { color: swatches.find((c) => !used.includes(c)) ?? swatches[value.length % swatches.length] }])
    setOpen(value.length)
  }
  const square = { width: 28, height: 28, borderRadius: 6, cursor: 'pointer', flex: 'none' }
  const swatch = (id, name, style, picker, content) => (
    <Popover key={id} opened={open === id} onChange={(o) => setOpen(o ? id : null)} position="bottom-start" shadow="md">
      <Popover.Target>
        <UnstyledButton aria-label={name} onClick={() => setOpen(open === id ? null : id)}
          style={{ ...square, boxShadow: open === id ? '0 0 0 2px var(--mantine-color-blue-5)' : 'inset 0 0 0 1px rgba(0,0,0,.2)', ...style }}>
          {content}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">{picker}</Popover.Dropdown>
    </Popover>
  )
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {/* p: room for the open square's ring, which the pane would clip on the left */}
      <Group gap={6} wrap="nowrap" align="flex-start" p={2}>
        {onText && <>
          {swatch('text', `Text color ${text}`,
            { display: 'grid', placeItems: 'center', background: value[0]?.color ?? '#3a3a44', color: text, fontWeight: 800, textShadow: '0 1px 2px #0009' },
            <SwatchPicker color={text} swatches={['#ffffff', '#000000', ...swatches.slice(0, 6)]} onChange={onText} />, 'A')}
          <div style={{ width: 1, height: 20, margin: '4px 2px', flex: 'none', background: 'var(--mantine-color-default-border)' }} />
        </>}
        <Group gap={6}>
          {value.map((v, i) => swatch(i, `Color ${v.color}`, { background: v.color },
            <SwatchPicker color={v.color} swatches={swatches} onChange={(c) => set(i, c)}
              onRemove={() => {
                onChange(value.filter((_, j) => j !== i))
                setOpen(null)
              }} />))}
          <UnstyledButton aria-label="Add a color" onClick={add}
            style={{ ...square, display: 'grid', placeItems: 'center', border: '1px dashed var(--mantine-color-dimmed)', color: 'var(--mantine-color-dimmed)' }}>
            <IconPlus size={14} />
          </UnstyledButton>
        </Group>
      </Group>
    </Stack>
  )
}

// A palette square's picker: the color, its hex (applied once valid) and, with onRemove, a Remove button.
function SwatchPicker({ color, swatches, onChange, onRemove }) {
  const [hex, setHex] = useState(color)
  useEffect(() => setHex(color), [color])
  return (
    <Stack gap={6} w={200}>
      <ColorPicker size="sm" fullWidth format="hex" swatches={swatches} swatchesPerRow={8} value={color} onChange={onChange} />
      <Group gap={6} wrap="nowrap">
        <TextInput size="xs" flex={1} value={hex} onChange={(e) => {
          setHex(e.target.value)
          if (isColor(e.target.value)) onChange(e.target.value)
        }} />
        {onRemove && <Button size="xs" variant="light" color="red" onClick={onRemove}>Remove</Button>}
      </Group>
    </Stack>
  )
}

// A type: 'list' field (see the header): Custom items or a data key, picked with a switch where data comes in (vars).
function ListField({ label, description, row, columns, vars, value, onChange }) {
  const v = { from: 'custom', key: '', items: [], ...(value && typeof value === 'object' && value) }
  const set = (patch) => onChange({ ...v, ...patch })
  const items = <ListInput value={v.items} defaults={[row]} columns={columns} onChange={(items) => set({ items })} />
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {vars && (
        <SegmentedControl size="xs" fullWidth value={v.from} onChange={(from) => set({ from })}
          data={[{ value: 'custom', label: 'Custom' }, { value: 'data', label: 'From data' }]} />
      )}
      {vars && v.from === 'data' ? <Autocomplete size="xs" data={vars} placeholder="Data key, e.g. items" value={v.key} onChange={(key) => set({ key })} /> : items}
    </Stack>
  )
}

// A copy button for a URL, which its tooltip shows.
function CopyUrl({ url }) {
  return (
    <CopyButton value={url}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : `Copy ${url}`}>
          <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label="Copy URL">
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  )
}

// A label with its info (f.info) in an ⓘ tooltip beside it.
function Label({ text, info }) {
  if (!info) return text
  return (
    <Group component="span" gap={4} wrap="nowrap" display="inline-flex" style={{ verticalAlign: 'bottom' }}>
      {text}
      <Tooltip label={info} multiline w={260} withinPortal>
        <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" style={{ cursor: 'help' }} aria-label={info} />
      </Tooltip>
    </Group>
  )
}

// One setting; context: { vars: data keys available here, trigger: whether the node is a trigger (no data comes
// before it, so no "{}" menu), widget: the node's widget, types, off: the requirements not met } for the dynamic types.
function Field({ name, f, fallback, value, set, change, values, context }) {
  const vars = context.trigger ? null : context.vars ?? []
  const props = { label: <Label text={f.label ?? humanize(name)} info={f.info} />, description: f.hint, size: 'xs' }
  if (Array.isArray(fallback) && f.options) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        <Chip.Group multiple value={value} onChange={set}>
          <Group gap={6}>{labelled(f.options).map((o) => <Chip key={o.value} value={o.value} size="xs">{o.label}</Chip>)}</Group>
        </Chip.Group>
      </Stack>
    )
  }
  if (f.type === 'deck') {
    return <ListInput label={props.label} description={props.description} value={value} onChange={set}
      defaults={[{ id: '', icon: 'star', name: '', color: swatches[0] }]} columns={{ id: { type: 'id' }, icon: { type: 'icon' } }}
      extra={values.mode === 'companion' ? (b) => <CopyUrl url={location.origin + deckUrl(b)} /> : undefined} />
  }
  if (f.type === 'hue-steps') {
    return <HueSteps label={props.label} description={props.description} value={value} defaults={fallback} columns={f.columns} limits={f.limits}
      device={values.device ?? ''} transition={Number(values.transition) || 0} restore={values.restore} onChange={set} />
  }
  if (f.type === 'palette') {
    return <PaletteInput {...props} value={value} onChange={set} text={values[f.text]} onText={f.text && ((c) => change({ [f.text]: c }))} />
  }
  if (f.type === 'list') return <ListField {...props} row={f.row} columns={f.columns} vars={vars} value={value} onChange={set} />
  if (Array.isArray(fallback)) return <ListInput label={props.label} description={props.description} value={value} defaults={fallback} fixed={f.fixed} columns={f.columns} onChange={set} />
  if (f.type === 'tags') {
    const tags = value ? value.split('+') : []
    return <TagsInput {...props} styles={{ input: TAG_SCROLL }} data={f.options} splitChars={TAG_SPLIT} value={tags} onChange={(v) => set(v.join('+'))}
      rightSection={<VarMenu vars={vars} onPick={(k) => set([...tags, `{{${k}}}`].join('+'))} />} />
  }
  // A widget's actions come from its type: those that apply with the widget's settings. Short option lists are buttons.
  const type = context.types?.find((t) => t.type === context.widget?.type)
  // A Widget Action node's inputs, as their own settings: the fields its widget type asks for the action picked (its
  // stop action by default; none: nothing shown).
  if (f.type === 'inputs') {
    const fields = type?.actions[values.action || type.onStop]?.inputs ?? {}
    if (!Object.keys(fields).length) return null
    const defaults = Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, f.default ?? '']))
    return <Fields defaults={defaults} values={value} fields={fields} context={context} onChange={set} />
  }
  // Options needing a requirement not met (Twitch features without Streamer mode, an integration not ready) can't be
  // picked, and say why on hover; one picked earlier is noted at the top of the settings pane.
  const state = { ...type?.state, ...context.widget?.state }
  const options = f.type === 'action' ? Object.keys(type?.actions ?? {}).filter((a) => applies(type.actions[a], state)) : f.options
  const line = options?.indexOf('-') ?? -1
  const choices = labelled(options?.filter((o) => o !== '-'))?.map(({ streamer, needs, ...option }) => {
    const unmet = requirements.find((r) => (r.key === needs || (streamer && r.key === 'twitch')) && context.off?.includes(r.key))
    return unmet ? { ...option, disabled: true, why: `Needs ${unmet.needs} (Settings → ${unmet.label})` } : option
  })
  if (f.type === 'action' && !options.length) return null
  if (f.slider && typeof fallback === 'number') {
    return <SliderInput {...props} unit={f.unit} min={f.min} max={f.max} mute={name === 'volume'} value={value} onChange={set} />
  }
  // Plain-text marks show in capitals (ratings: PG-13); { value, label } ones as labelled. mx: room for the end labels.
  if (f.slider) {
    const values = options.map((o) => o.value ?? o)
    return (
      <Stack gap={4} pb="lg">
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        <Slider size="md" w={options.length > 4 ? 300 : 200} mx="lg" min={0} max={options.length - 1} step={1} label={null}
          marks={options.map((o, i) => ({ value: i, label: <Tooltip label={f.tips?.[values[i]]} disabled={!f.tips} multiline w={200} withinPortal><span style={{ pointerEvents: 'auto' }}>{o.label ?? o.toUpperCase()}</span></Tooltip> }))}
          value={values.indexOf(value)} onChange={(i) => set(values[i])} />
      </Stack>
    )
  }
  // A Widget Action node with no action set runs its widget's stop action.
  const picked = f.type === 'action' ? value || type?.onStop : value
  if (choices?.length <= 4) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        <SegmentedControl size="xs" fullWidth value={picked} onChange={set}
          data={choices.map(({ why, ...o }) => (why ? { ...o, label: <Tooltip label={why} withinPortal><span>{o.label}</span></Tooltip> } : o))} />
      </Stack>
    )
  }
  // A Select needs text labels: a disabled option's reason goes after its name.
  // A '-' splits the options in two unnamed groups, a line between them (app.css).
  if (choices) {
    const data = choices.map(({ why, ...o }) => (why ? { ...o, label: `${o.label} (${why})` } : o))
    const grouped = line < 0 ? data : [{ group: '', items: data.slice(0, line) }, { group: '', items: data.slice(line) }]
    return <Select {...props} data={grouped} value={picked} onChange={set} allowDeselect={false} />
  }
  if (f.type === 'var') return <Autocomplete {...props} data={vars ?? []} value={value} onChange={set} />
  if (f.type === 'json') return <JsonInput {...props} value={value} onChange={set} validationError="Invalid JSON" formatOnBlur autosize minRows={2} maxRows={8} />
  if (f.type === 'code') {
    return <Textarea {...props} value={value} onChange={(e) => set(e.target.value)} autosize minRows={4} maxRows={12} spellCheck={false} styles={{ input: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }} />
  }
  if (f.type === 'workflow') return <WorkflowSelect {...props} value={value} onChange={set} />
  if (FILE_KINDS[f.type]) return <FileInput kind={f.type} {...props} vars={vars} value={value} onChange={set} />
  if (f.type === 'giphy' || f.type === 'myinstants') {
    return <PickInput {...props} kind={f.type} media={f.media} rating={values.rating} ready={f.type !== 'giphy' || !context.off?.includes('giphy')} value={value} onChange={set} />
  }
  if (f.type === 'window') return <WindowInput {...props} value={value} onChange={set} />
  if (f.type === 'secret') return <PasswordInput {...props} value={value} onChange={(e) => set(e.target.value)} />
  if (isColor(fallback)) return <ColorInput {...props} swatches={swatches} value={value} onChange={set} />
  if (typeof fallback === 'boolean') return <Switch {...props} checked={value} onChange={(e) => set(e.target.checked)} />
  if (f.presets) return <PresetInput {...props} name={f.label ?? humanize(name)} unit={f.unit} presets={f.presets} off={f.off} value={value} onChange={set} />
  if (typeof fallback === 'number') return <NumberInput {...props} suffix={f.unit && ` ${f.unit}`} value={value} onChange={(v) => set(Number(v))} />
  if (f.rewards) return <RewardInput {...props} value={value} onChange={set} />
  if (f.hue) return <HueInput {...props} value={value} onChange={set} />
  if (f.obs) return <ObsInput {...props} list={f.obs} scene={values.scene ?? ''} vars={vars} value={value} onChange={set} />
  if (f.vars) return <VarInput {...props} vars={vars} multiline={f.multiline} value={value} onChange={set} />
  return <TextInput {...props} value={value} onChange={(e) => set(e.target.value)} />
}

// Whether a setting, or a widget action, applies with these settings (values, then defaults): its only matches them.
export const applies = (f, values, defaults = {}) => !f?.only || Object.entries(f.only).every(([k, v]) => [v].flat().includes(values[k] ?? defaults[k]))

// show: the settings to show (all by default), e.g. to show some of them elsewhere in the pane.
export default function Fields({ defaults, values, onChange, fields = {}, context = {}, show = Object.keys(defaults) }) {
  const keys = show.filter((key) => !fields[key]?.hidden && applies(fields[key], values, defaults))
  if (keys.length === 0) return <Text size="sm" c="dimmed">No settings</Text>
  return (
    <Stack gap="sm" maw={420}>
      {keys.map((key, i) => {
        const f = fields[key] ?? {}
        // Shown only while a switch is on: indented under it.
        const nested = Object.keys(f.only ?? {}).some((k) => typeof defaults[k] === 'boolean')
        const field = (
          <Field
            name={key}
            f={f}
            fallback={defaults[key]}
            value={values[key] ?? defaults[key]}
            set={(v) => onChange({ ...values, [key]: v })}
            change={(patch) => onChange({ ...values, ...patch })}
            values={{ ...defaults, ...values }}
            context={context}
          />
        )
        return (
          <Fragment key={key}>
            {f.section && <Heading title={f.section} mt={i ? 'xs' : 0} mb={0} />}
            {nested ? <div className="nested">{field}</div> : field}
          </Fragment>
        )
      })}
    </Stack>
  )
}
