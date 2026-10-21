import type { StorybookConfig } from "@storybook/react-vite"
const config: StorybookConfig = { stories: ["../src/**/*.stories.@(ts|tsx)"], addons: [], framework: { name: "@storybook/react-vite", options: {} }, viteFinal: async (config) => ({ ...config }) }
export default config
