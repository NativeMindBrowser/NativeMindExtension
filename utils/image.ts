import { createJimp } from '@jimp/core'
import bmp, { msBmp } from '@jimp/js-bmp'
import gif from '@jimp/js-gif'
import jpeg from '@jimp/js-jpeg'
import png from '@jimp/js-png'
import tiff from '@jimp/js-tiff'
import * as resize from '@jimp/plugin-resize'
import { Buffer } from 'buffer'

import { lazyInitialize } from './memo'

const getJimpInstance = lazyInitialize(() => {
  return createJimp({
    formats: [bmp, gif, jpeg, png, tiff, msBmp],
    plugins: [resize.methods],
  })
})

export async function convertImageFileToJpegBase64(file: File | ArrayBuffer) {
  const Jimp = getJimpInstance()
  const fileBuffer = file instanceof File ? await file.arrayBuffer() : file
  // because of firefox's Xray wrapper, we need to convert it to a native buffer from extension realm
  const buffer = Buffer.from(new Uint8Array(fileBuffer))
  const jimp = await Jimp.fromBuffer(buffer)
  const dateUrl = await jimp.scaleToFit({ h: 2048, w: 2048 }).getBase64('image/jpeg')
  const base64Data = dateUrl.split(',')[1] // Remove the data URL prefix
  return base64Data
}
