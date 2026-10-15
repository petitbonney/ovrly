// Small uppercase section heading with optional controls on the right.
import { Group, Text } from '@mantine/core'

export default function Heading({ title, children }) {
  return (
    <Group justify="space-between" mb="xs">
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{title}</Text>
      {children}
    </Group>
  )
}
