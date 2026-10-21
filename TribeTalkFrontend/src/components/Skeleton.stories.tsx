import type { Meta, StoryObj } from "storybook"
import { Skeleton } from "./Skeleton"
const meta = { title: "UI/Skeleton", component: Skeleton, tags: ["autodocs"] } satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { className: "h-6 w-48" } }
