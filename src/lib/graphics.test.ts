import { describe, expect, it } from 'vitest'
import { OUTPUT_FORMATS, THEME_COLORS } from '../config/editor'
import {
  clampCrop,
  colorTextRange,
  getCoverCrop,
  reconcileTextSegments,
} from './graphics'

describe('rich text segments', () => {
  it('applies a color only to the selected range and merges equal neighbors', () => {
    expect(colorTextRange([{ text: 'TFC gagne' }], 0, 3, '#6A2C91')).toEqual([
      { text: 'TFC', color: '#6A2C91' },
      { text: ' gagne' },
    ])
    expect(
      colorTextRange(
        [{ text: 'Le ', color: '#FFFFFF' }, { text: 'TFC', color: '#6A2C91' }],
        3,
        6,
        '#FFFFFF',
      ),
    ).toEqual([{ text: 'Le TFC', color: '#FFFFFF' }])
  })

  it('preserves formatting for unchanged text around an edit', () => {
    expect(
      reconcileTextSegments(
        [{ text: 'Le ', color: '#FFFFFF' }, { text: 'TFC', color: '#6A2C91' }, { text: ' gagne' }],
        'Le Toulouse gagne',
      ),
    ).toEqual([
      { text: 'Le ', color: '#FFFFFF' },
      { text: 'T', color: '#6A2C91' },
      { text: 'oulouse gagne' },
    ])
  })

  it('keeps the six configured editorial colors', () => {
    expect(THEME_COLORS).toHaveLength(6)
  })
})

describe('image crop and output formats', () => {
  it.each([
    ['square', 1080, 1080],
    ['portrait', 1080, 1350],
    ['landscape', 1200, 630],
  ])('format %s has exact output dimensions', (id, width, height) => {
    const format = OUTPUT_FORMATS.find((item) => item.id === id)
    expect(format).toMatchObject({ width, height })
  })

  it('covers the entire format without distorting the source ratio', () => {
    const crop = getCoverCrop(1600, 900, { width: 1080, height: 1350 }, { x: 0, y: 0, zoom: 1 })
    expect(crop.height).toBe(1350)
    expect(crop.width).toBeGreaterThanOrEqual(1080)
    expect(crop.x + crop.width).toBeGreaterThanOrEqual(1080)
  })

  it('clamps panning so the image cannot uncover the canvas', () => {
    const crop = clampCrop(
      { x: 5, y: -5, zoom: 2 },
      1600,
      900,
      { width: 1080, height: 1350 },
    )
    const baseScale = Math.max(1080 / 1600, 1350 / 900)
    const maxX = (1600 * baseScale * crop.zoom - 1080) / (2 * 1080)
    const maxY = (900 * baseScale * crop.zoom - 1350) / (2 * 1350)
    expect(Math.abs(crop.x)).toBeLessThanOrEqual(maxX)
    expect(Math.abs(crop.y)).toBeLessThanOrEqual(maxY)
  })
})
