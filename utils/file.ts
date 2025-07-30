import { PromiseOr } from '@/types/common'

export type FileOrFileGetter<F extends File = File> = F | FileGetter

export class FileGetter<F extends File = File> {
  private cachedFile?: F

  static fromFile(file: File) {
    return new FileGetter(() => file, file.name, file.type)
  }

  constructor(private getFile: () => PromiseOr<F>, public name: string, public readonly mimeType: string) { }

  async file() {
    if (this.cachedFile) return this.cachedFile
    this.cachedFile = await this.getFile()
    return this.cachedFile
  }
}

// we use wrapper instead of inheritance because of firefox's weird behavior
// if we define a class like CustomFile extends File, then new CustomFile() will return a File instance
class ExtendedFile {
  protected file: File
  constructor(...args: ConstructorParameters<typeof File>) {
    this.file = new File(...args)
  }

  get name() {
    return this.file.name
  }

  get size() {
    return this.file.size
  }

  get type() {
    return this.file.type
  }

  get lastModified() {
    return this.file.lastModified
  }

  get webkitRelativePath() {
    return this.file.webkitRelativePath
  }

  text() {
    return this.file.text()
  }

  arrayBuffer() {
    return this.file.arrayBuffer()
  }

  slice(...args: Parameters<File['slice']>) {
    return this.file.slice(...args)
  }

  bytes() {
    return this.file.bytes()
  }

  stream() {
    return this.file.stream()
  }
}

export class PdfTextFile extends ExtendedFile {
  constructor(fileName: string, texts: string[], public pageCount: number, public source?: string | number) {
    const content = JSON.stringify({ texts, pageCount })
    super([content], fileName, { type: 'application/x-pdf-text' })
  }

  async textContent() {
    const text = await this.file.text()
    return JSON.parse(text).texts as string[]
  }
}
