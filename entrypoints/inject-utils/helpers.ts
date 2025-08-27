export function getElementAttributes(el: Element): Record<string, string | undefined> {
  return Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value]))
}

export function checkNodeType<E extends (typeof Element | typeof Text | typeof ShadowRoot)>(type: E, node: Node): node is InstanceType<E> {
  return node instanceof type
}
