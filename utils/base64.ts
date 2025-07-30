import { fromByteArray, toByteArray } from 'base64-js'

export function base64ToUint8Array(base64: string): Uint8Array {
  return toByteArray(base64)
}

export function uint8ArrayToBase64(uint8: Uint8Array): string {
  return fromByteArray(uint8)
}

export function dataURLToUint8Array(dataURL: string) {
  if (!dataURL.startsWith('data:')) {
    throw new Error('Invalid data URL')
  }
  const type = dataURL.split(';')[0].split(':')[1]
  const base64 = dataURL.split(',')[1]
  const uint8Array = base64ToUint8Array(base64)
  return {
    data: uint8Array,
    type,
  }
}

export function uint8ArrayToDataURL(uint8: Uint8Array, mimeType: string) {
  const base64 = uint8ArrayToBase64(uint8)
  return `data:${mimeType};base64,${base64}`
}

export function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      }
      else {
        reject(new Error('FileReader result is not a string'))
      }
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

export async function fileToBase64(file: File): Promise<string> {
  const dataURL = await fileToDataURL(file)
  const base64 = dataURL.split(',')[1]
  if (!base64) {
    throw new Error('Failed to extract base64 from data URL')
  }
  return base64
}

export async function arrayBufferToBase64(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer)
  return uint8ArrayToBase64(uint8Array)
}
