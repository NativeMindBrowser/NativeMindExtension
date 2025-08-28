import { computed, Ref, ref, watch } from 'vue'

export function useValueGuard<T>(value: Ref<T>, validator: (value: T) => { isValid: boolean, errorMessage?: string }) {
  const v = ref(value.value)
  const validStatus = computed(() => validator(v.value))
  const isValid = computed(() => validStatus.value.isValid)
  const errorMessage = computed(() => {
    return !validStatus.value.isValid ? validStatus.value.errorMessage : undefined
  })
  watch(v, (newValue) => {
    if (validator(newValue).isValid) {
      value.value = newValue
    }
  }, { deep: true })
  watch(value, (newValue) => {
    v.value = newValue
  })
  return { value: v, guardedValue: value, isValid, errorMessage }
}
