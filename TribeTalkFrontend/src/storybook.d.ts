declare module "storybook" {
  export type Meta<T = unknown> = { title?: string; component?: T; tags?: string[] }
  export type StoryObj<T = unknown> = { args?: Record<string, unknown> }
}
