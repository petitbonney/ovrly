// Small uppercase section heading with optional controls on the right; other props go to its row (e.g. mt).
import { Group, Text } from '@mantine/core'

export default function Heading({ title, children, ...props }) {
  return (
    <Group justify="space-between" mb="xs" {...props}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{title}</Text>
      {children}
    </Group>
  )
}
