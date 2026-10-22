// Settings form generated from a config's defaults, plus optional per-field hints from the node or widget type:
// { label, hint, unit, options, presets, vars, multiline, hidden, only, type: 'json' | 'code' | 'workflow' | 'secret' | 'var' | 'keys' | 'action' | 'inputs' | 'image' | 'sound' | 'video' | 'giphy' | 'myinstants' | 'window' }.
// slider: true shows the options as marks on a slider, from the first to the last, instead of buttons; tips: { option: text } adds a tooltip to each mark.
// On a number, slider: true is a slider from min to max (0 to 100 by default), its value beside the label; a volume's
// slider has a mute button.
// presets: common values of a number, e.g. a duration's [3, 5, 10] seconds, shown as buttons next to its input.
// only: { key: value } shows the field only while those other settings have those values, e.g. { mode: 'twitch' }
// (or one of them: { layout: ['wheel', 'slots'] }). fixed: a list with a set number of items (no add, remove or move).
// An option { value, label, streamer: true } is a Twitch feature: it needs Twitch in Streamer mode (context.streamer).
// An option { value, label, needs: key } needs that integration: disabled while it isn't ready (context.off lists those).
// A list default with options gets one chip per option, any number picked (e.g. the kinds of subs a trigger fires on).
// Any other list default (e.g. a poll's options) gets a list editor (columns: { key: field } for its items' fields, e.g. a
// { type: 'keys' } picker, { type: 'icon' } an icon picker, { type: 'id' } a hidden random id), a color default ("#rrggbb") a color picker,
// type: 'deck' a Control Pad node's buttons (with Companion, each with a button to copy its URL), and
// { obs: 'scenes' | 'sources' } suggestions from OBS.
import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Autocomplete, Button, Chip, ColorInput, CopyButton, Group, Image, JsonInput, Menu, NumberInput, PasswordInput, SegmentedControl,
  Select, Slider, Stack, Switch, TagsInput, Text, Textarea, TextInput, Tooltip,
} from '@mantine/core'
import { IconBraces, IconCheck, IconCopy, IconGripVertical, IconPlus, IconFolderOpen, IconVolume, IconVolume2, IconVolume3, IconVolume4, IconX } from '@tabler/icons-react'
import { get } from './api.js'
import { integrations } from './Settings.jsx'
import { IconPicker, buttonId, deckUrl } from './Deck.jsx'
import GiphyPicker from './GiphyPicker.jsx'
import MyinstantsPicker from './MyinstantsPicker.jsx'

// "case1" -> "Case1", "sceneName" -> "Scene name"
const humanize = (key) => key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)

// Suggestions filter: every option while the value is empty or one of them, else those containing it.
const suggest = ({ options, search }) => (!search || options.some((o) => o.value === search) ? options
  : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())))

// The "{}" button: a menu of the data keys available at this node; onPick(key) gets the one picked.
function VarMenu({ vars, onPick }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Insert data from previous nodes">
          <ActionIcon variant="subtle" size="sm"><IconBraces size={16} /></ActionIcon>
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
  return <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rightSection={menu} autosize={multiline || undefined} minRows={multiline ? 2 : undefined} {...props} />
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

// "90 s" -> "1m30", "300 s" -> "5m": presets read faster in minutes.
const short = (n, unit) => (unit === 's' && n >= 60 ? `${Math.floor(n / 60)}m${n % 60 ? String(n % 60).padStart(2, '0') : ''}` : `${n}${unit ?? ''}`)

// A number with preset buttons (the current one highlighted) and an input for any other value.
function PresetInput({ label, description, unit, presets, value, onChange }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Group gap={6} wrap="nowrap">
        {presets.map((n) => (
          <Button key={n} size="compact-xs" h={30} px="sm" variant={n === value ? 'filled' : 'default'} onClick={() => onChange(n)}>{short(n, unit)}</Button>
        ))}
        <NumberInput size="xs" w={90} min={0} aria-label={`Custom ${label.toLowerCase()}`} suffix={unit && ` ${unit}`} value={value} onChange={(v) => onChange(Number(v))} />
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
  const src = value && (/^([a-z]:[\\/]|[\\/])/i.test(value) && !value.startsWith('/media/') ? `/file?path=${encodeURIComponent(value)}` : value)
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && !value.includes('{{') && kind === 'image' && <Image src={src} alt="" h={90} fit="contain" radius="sm" bg="dark.6" />}
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

// A GIF picked from Giphy or a sound from Myinstants (kind): a preview and a button opening the picker. The value is its URL.
function PickInput({ kind, media = 'gif', rating, label, description, value, onChange }) {
  const [ready, setReady] = useState(kind !== 'giphy') // Giphy needs its API key set up
  const [picking, setPicking] = useState(false)
  useEffect(() => {
    if (kind === 'giphy') get('/api/giphy').then((s) => setReady(s.connected), () => {})
  }, [kind])
  const Picker = kind === 'giphy' ? GiphyPicker : MyinstantsPicker
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && (media === 'clip' ? <video src={value} controls muted loop style={{ height: 90 }} />
        : kind === 'giphy' ? <Image src={value} alt="" h={90} fit="contain" radius="sm" bg="dark.6" />
        : <audio controls style={{ width: '100%' }} src={value} />)}
      <Tooltip label="Set up Giphy first (Integration → Giphy)" disabled={ready}>
        <Button size="xs" variant="default" style={{ alignSelf: 'start' }} data-disabled={!ready || undefined} onClick={() => ready && setPicking(true)}>
          {kind === 'giphy' ? `Pick a ${media === 'gif' ? 'GIF' : media}` : 'Pick a sound'}
        </Button>
      </Tooltip>
      <Picker opened={picking} onClose={() => setPicking(false)} onPick={onChange} media={media} rating={rating} />
    </Stack>
  )
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const swatches = ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44']
// Column widths of list items with fields: icons, colors and numbers are narrow, text takes the rest.
const width = (v, column) => (column?.type === 'icon' ? 28 : isColor(v) ? 110 : typeof v === 'number' ? 72 : undefined)

// One list item: a text, or an object edited field by field. shape (a default item) says which input each field gets,
// so a color being typed doesn't turn into a text field.
function ItemInput({ item, shape, columns = {}, onChange }) {
  if (typeof shape !== 'object') return <TextInput size="xs" flex={1} value={item} onChange={(e) => onChange(e.target.value)} />
  return Object.entries(shape).map(([key, example]) => {
    const props = { size: 'xs', w: width(example), flex: width(example) ? undefined : 1, 'aria-label': humanize(key) }
    const set = (v) => onChange({ ...item, [key]: v })
    if (columns[key]?.type === 'id') return null
    if (columns[key]?.type === 'icon') return <IconPicker key={key} value={item[key]} color={Object.values(item).find(isColor)} onChange={set} />
    if (columns[key]?.type === 'keys') {
      return <TagsInput key={key} {...props} miw={0} styles={{ inputField: { minWidth: 30 } }} data={columns[key].options}
        value={item[key] ? item[key].split('+') : []} onChange={(v) => set(v.join('+'))} />
    }
    if (isColor(example)) return <ColorInput key={key} {...props} swatches={swatches} value={item[key] ?? ''} onChange={set} />
    if (typeof example === 'number') return <NumberInput key={key} {...props} min={0} value={item[key]} onChange={(v) => set(Number(v))} />
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
    return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, columns[k]?.type === 'id' ? buttonId() : columns[k]?.type === 'icon' ? v
      : isColor(v) ? fresh : typeof v === 'string' ? '' : v]))
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {typeof shape === 'object' && (
        // Column titles, as wide as the fields under them.
        <Group gap={6} wrap="nowrap" pl={28} pr={extra ? 56 : 28}>
          {Object.entries(shape).filter(([key]) => columns[key]?.type !== 'id').map(([key, example]) => (
            <Text key={key} size="xs" c="dimmed" w={width(example, columns[key])} flex={width(example, columns[key]) ? undefined : 1}>{humanize(key)}</Text>
          ))}
        </Group>
      )}
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
      {!fixed && (
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} fullWidth
          onClick={() => onChange([...value, blank()])}>
          Add
        </Button>
      )}
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

// One setting; context: { vars: data keys available here, widget: the node's widget, types } for the dynamic types.
function Field({ name, f, fallback, value, set, values, context }) {
  const props = { label: f.label ?? humanize(name), description: f.hint, size: 'xs' }
  if (Array.isArray(fallback) && f.options) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        <Chip.Group multiple value={value} onChange={set}>
          <Group gap={6}>{f.options.map((o) => <Chip key={o.value ?? o} value={o.value ?? o} size="xs">{o.label ?? o}</Chip>)}</Group>
        </Chip.Group>
      </Stack>
    )
  }
  if (f.type === 'deck') {
    return <ListInput label={props.label} description={props.description} value={value} onChange={set}
      defaults={[{ id: '', icon: 'star', name: '', color: swatches[0] }]} columns={{ id: { type: 'id' }, icon: { type: 'icon' } }}
      extra={values.mode === 'companion' ? (b) => <CopyUrl url={location.origin + deckUrl(b)} /> : undefined} />
  }
  if (Array.isArray(fallback)) return <ListInput label={props.label} description={props.description} value={value} defaults={fallback} fixed={f.fixed} columns={f.columns} onChange={set} />
  if (f.type === 'keys') {
    const tags = value ? value.split('+') : []
    return <TagsInput {...props} data={f.options} value={tags} onChange={(v) => set(v.join('+'))}
      rightSection={<VarMenu vars={context.vars ?? []} onPick={(k) => set([...tags, `{{${k}}}`].join('+'))} />} />
  }
  // A widget's actions come from its type: those that apply with the widget's settings. Short option lists are buttons.
  const type = context.types?.find((t) => t.type === context.widget?.type)
  // A widget action's inputs, as their own settings: the fields its widget type asks for that action (none: nothing
  // shown). A widget node's (linked: true) are those of the action its type links to it ("start", unless the type says
  // otherwise), a Widget Action node's those of the one picked ("stop" by default).
  if (f.type === 'inputs') {
    const fields = type?.actions[f.linked ? type.linked : values.action || 'stop']?.inputs ?? {}
    if (!Object.keys(fields).length) return null
    const defaults = Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, f.default ?? '']))
    return <Fields defaults={defaults} values={value} fields={fields} context={context} onChange={set} />
  }
  // Twitch features can't be picked unless Streamer mode is on, nor options needing an integration that isn't ready;
  // a Twitch feature picked earlier says why it won't run.
  const config = { ...type?.config, ...context.widget?.config }
  const options = f.type === 'action' ? Object.keys(type?.actions ?? {}).filter((a) => applies(type.actions[a], config)) : f.options?.map((o) => {
    if (typeof o === 'string') return o
    const { streamer, needs, ...option } = o
    const integration = context.off?.includes(needs) && integrations.find((i) => i.key === needs)
    const why = streamer && !context.streamer ? 'Needs Twitch in Streamer mode, signed in (Integration → Twitch)'
      : integration ? `Needs ${integration.needs} (Integration → ${integration.label})` : null
    return why ? { ...option, disabled: true, why } : option
  })
  // A disabled option says why on hover (segmented buttons only: a Select needs text labels).
  const explained = options?.map(({ why, ...o }) => !why ? o : {
    ...o,
    label: <Tooltip label={why} withinPortal><span>{o.label}</span></Tooltip>,
  })
  if (f.type === 'action' && !options.length) return null
  if (f.options?.find((o) => o.value === value)?.streamer && !context.streamer) {
    props.description = <Text span size="xs" c="yellow">Needs Twitch in Streamer mode, signed in (Integration → Twitch)</Text>
  }
  if (f.slider && typeof fallback === 'number') {
    return <SliderInput {...props} unit={f.unit} min={f.min} max={f.max} mute={name === 'volume'} value={value} onChange={set} />
  }
  if (f.slider) {
    return (
      <Stack gap={4} pb="lg">
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        <Slider size="md" w={200} min={0} max={options.length - 1} step={1} label={null} marks={options.map((o, i) => ({ value: i, label: <Tooltip label={f.tips?.[o]} disabled={!f.tips} multiline w={200} withinPortal><span style={{ pointerEvents: 'auto' }}>{o.toUpperCase()}</span></Tooltip> }))}
          value={options.indexOf(value)} onChange={(i) => set(options[i])} />
      </Stack>
    )
  }
  if (options?.length <= 4) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        {/* A Widget Action node with no action set runs "stop". */}
        <SegmentedControl size="xs" data={explained} value={f.type === 'action' ? value || 'stop' : value} onChange={set} style={{ alignSelf: 'start' }} />
      </Stack>
    )
  }
  if (options) return <Select {...props} data={options} value={f.type === 'action' ? value || 'stop' : value} onChange={set} allowDeselect={false} />
  if (f.type === 'var') return <Autocomplete {...props} data={context.vars ?? []} value={value} onChange={set} />
  if (f.type === 'json') return <JsonInput {...props} value={value} onChange={set} validationError="Invalid JSON" formatOnBlur autosize minRows={2} />
  if (f.type === 'code') {
    return <Textarea {...props} value={value} onChange={(e) => set(e.target.value)} autosize minRows={4} spellCheck={false} styles={{ input: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }} />
  }
  if (f.type === 'workflow') return <WorkflowSelect {...props} value={value} onChange={set} />
  if (FILE_KINDS[f.type]) return <FileInput kind={f.type} {...props} vars={context.vars ?? []} value={value} onChange={set} />
  if (f.type === 'giphy' || f.type === 'myinstants') return <PickInput {...props} kind={f.type} media={f.media} rating={values.rating} value={value} onChange={set} />
  if (f.type === 'window') return <WindowInput {...props} value={value} onChange={set} />
  if (f.type === 'secret') return <PasswordInput {...props} value={value} onChange={(e) => set(e.target.value)} />
  if (isColor(fallback)) return <ColorInput {...props} swatches={swatches} value={value} onChange={set} />
  if (typeof fallback === 'boolean') return <Switch {...props} checked={value} onChange={(e) => set(e.target.checked)} />
  if (f.presets) return <PresetInput {...props} unit={f.unit} presets={f.presets} value={value} onChange={set} />
  if (typeof fallback === 'number') return <NumberInput {...props} suffix={f.unit && ` ${f.unit}`} value={value} onChange={(v) => set(Number(v))} />
  if (f.obs) return <ObsInput {...props} list={f.obs} scene={values.scene ?? ''} vars={context.vars ?? []} value={value} onChange={set} />
  if (f.vars) return <VarInput {...props} vars={context.vars ?? []} multiline={f.multiline} value={value} onChange={set} />
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
      {keys.map((key) => (
        <Field
          key={key}
          name={key}
          f={fields[key] ?? {}}
          fallback={defaults[key]}
          value={values[key] ?? defaults[key]}
          set={(v) => onChange({ ...values, [key]: v })}
          values={{ ...defaults, ...values }}
          context={context}
        />
      ))}
    </Stack>
  )
}
