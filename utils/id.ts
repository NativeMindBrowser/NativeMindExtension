import { customAlphabet } from 'nanoid'

const alphabetGenerator = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz')

export function generateRandomId(length = 10) {
  return alphabetGenerator(length)
}
