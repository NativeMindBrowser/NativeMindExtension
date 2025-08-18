import { register as registerNMIcon } from './icon'

export const webComponents = [
  { name: 'nm-icon', register: registerNMIcon },
]

export function registerWebComponents() {
  webComponents.forEach(({ register }) => register())
}
