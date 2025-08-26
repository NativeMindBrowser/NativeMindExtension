import { register as registerNMIcon } from './icon'
import { register as registerNMAgentTask } from './reading-task'

export const webComponents = [
  { name: 'nm-icon', register: registerNMIcon },
  { name: 'nm-agent-task', register: registerNMAgentTask },
]

export function registerWebComponents() {
  webComponents.forEach(({ register }) => register())
}
