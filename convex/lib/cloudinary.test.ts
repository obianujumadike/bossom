import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliveryFormat, signedDeliveryUrl, signParams, verifyUploadResponse } from './cloudinary'

// Expected values were generated with the official cloudinary@2.11.0 SDK
// (utils.api_sign_request / url with sign_url) using api_secret "abcd".
const config = { cloudName: 'demo', apiKey: '123456789012345', apiSecret: 'abcd' }

test('upload signature matches the example in Cloudinary docs', async () => {
  const sig = await signParams(
    { timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' },
    'abcd',
  )
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e')
})

test('upload signature for the params Bossom signs matches the SDK', async () => {
  const sig = await signParams(
    {
      timestamp: 1700000000,
      folder: 'bossom/cases/abc',
      type: 'authenticated',
      allowed_formats: 'jpg,jpeg,png,tif,tiff,dcm',
      ignored_empty: '',
    },
    'abcd',
  )
  assert.equal(sig, '74d5adf3e7cecb50150e4ce87bc9f00f672a9241')
})

test('a genuine upload response verifies, a tampered one does not', async () => {
  const genuine = { public_id: 'bossom/cases/abc/xyz', version: 1700000001, signature: '3cf82718b165867e0286ce6d02570df821a7c493' }
  assert.equal(await verifyUploadResponse(genuine, 'abcd'), true)
  assert.equal(await verifyUploadResponse({ ...genuine, public_id: 'bossom/cases/OTHER/xyz' }, 'abcd'), false)
  assert.equal(await verifyUploadResponse(genuine, 'wrong-secret'), false)
})

test('signed delivery URLs match the SDK for image and raw assets', async () => {
  assert.equal(
    await signedDeliveryUrl(config, { publicId: 'bossom/cases/abc/xyz', version: 1700000001, resourceType: 'image', format: 'png' }),
    'https://res.cloudinary.com/demo/image/authenticated/s--kb6nJZ2P--/v1700000001/bossom/cases/abc/xyz.png',
  )
  assert.equal(
    await signedDeliveryUrl(config, { publicId: 'bossom/cases/abc/scan', version: 42, resourceType: 'image', format: 'jpg' }),
    'https://res.cloudinary.com/demo/image/authenticated/s--5joUyQA_--/v42/bossom/cases/abc/scan.jpg',
  )
  assert.equal(
    await signedDeliveryUrl(config, { publicId: 'bossom/cases/abc/file.dcm', version: 7, resourceType: 'raw' }),
    'https://res.cloudinary.com/demo/raw/authenticated/s--47VvTPwj--/v7/bossom/cases/abc/file.dcm',
  )
})

test('DICOM images are delivered as JPEG so browsers can render them', () => {
  assert.equal(deliveryFormat('image', 'dcm'), 'jpg')
  assert.equal(deliveryFormat('image', 'png'), 'png')
  assert.equal(deliveryFormat('raw', 'dcm'), undefined)
})
