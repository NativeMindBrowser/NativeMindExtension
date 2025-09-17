import { Ref, ref } from 'vue'

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  startLeft: number
  startTop: number
}

interface DragOptions {
  handle?: Ref<HTMLElement | null>
  onDragStart?: () => void
  onDragEnd?: () => void
  onDrag?: (left: number, top: number) => void
  constrainToViewport?: boolean
}

export function useDraggable(
  targetElement: Ref<HTMLElement | null>,
  options: DragOptions = {},
) {
  const {
    handle,
    onDragStart,
    onDragEnd,
    onDrag,
    constrainToViewport = true,
  } = options

  const isDragging = ref(false)
  const position = ref({ left: 0, top: 0 })

  const dragState: DragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  }

  const handleMouseDown = (event: MouseEvent) => {
    const target = targetElement.value
    if (!target) return

    // Check if the drag handle is being used
    const dragHandle = handle?.value || target
    if (!dragHandle.contains(event.target as Node)) return

    event.preventDefault()
    event.stopPropagation()

    const rect = target.getBoundingClientRect()

    dragState.isDragging = true
    dragState.startX = event.clientX
    dragState.startY = event.clientY
    dragState.startLeft = rect.left
    dragState.startTop = rect.top

    isDragging.value = true
    onDragStart?.()

    // Add global event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: false })
    document.addEventListener('mouseup', handleMouseUp, { passive: false })

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState.isDragging || !targetElement.value) return

    event.preventDefault()

    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY

    let newLeft = dragState.startLeft + deltaX
    let newTop = dragState.startTop + deltaY

    // Constrain to viewport if enabled
    if (constrainToViewport) {
      const target = targetElement.value
      const rect = target.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Prevent dragging outside viewport bounds
      newLeft = Math.max(0, Math.min(viewportWidth - rect.width, newLeft))
      newTop = Math.max(0, Math.min(viewportHeight - rect.height, newTop))
    }

    position.value = { left: newLeft, top: newTop }
    onDrag?.(newLeft, newTop)

    // Apply the position to the element
    if (targetElement.value) {
      targetElement.value.style.left = `${newLeft}px`
      targetElement.value.style.top = `${newTop}px`
    }
  }

  const handleMouseUp = () => {
    dragState.isDragging = false
    isDragging.value = false

    // Remove global event listeners
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)

    // Restore text selection
    document.body.style.userSelect = ''

    onDragEnd?.()
  }

  const initDraggable = () => {
    const target = targetElement.value
    if (!target) return

    // Add mouse down listener to the drag handle or target
    const dragHandle = handle?.value || target
    dragHandle.addEventListener('mousedown', handleMouseDown, { passive: false })

    // Set cursor style for drag handle
    dragHandle.style.cursor = 'move'

    return () => {
      dragHandle.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      dragHandle.style.cursor = ''
    }
  }

  const resetPosition = () => {
    position.value = { left: 0, top: 0 }
    if (targetElement.value) {
      targetElement.value.style.left = '0px'
      targetElement.value.style.top = '0px'
    }
  }

  return {
    isDragging,
    position,
    initDraggable,
    resetPosition,
  }
}
