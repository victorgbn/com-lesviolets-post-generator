import { DEFAULT_TEXT_COLOR } from '../config/editor'

export type TextSegment = { text: string; color?: string }
export type Crop = { x: number; y: number; zoom: number }
export type CanvasFormat = { width: number; height: number }

export function mergeSegments(segments: TextSegment[]): TextSegment[] {
  return segments.reduce<TextSegment[]>((result, segment) => {
    if (!segment.text) return result
    const previous = result[result.length - 1]
    if (previous && previous.color === segment.color) {
      previous.text += segment.text
    } else {
      result.push({ ...segment })
    }
    return result
  }, [])
}

export function colorTextRange(
  segments: TextSegment[],
  start: number,
  end: number,
  color?: string,
): TextSegment[] {
  const textLength = segments.reduce((total, segment) => total + segment.text.length, 0)
  const rangeStart = Math.max(0, Math.min(start, end, textLength))
  const rangeEnd = Math.max(rangeStart, Math.min(Math.max(start, end), textLength))
  if (rangeStart === rangeEnd) return segments

  let cursor = 0
  const result: TextSegment[] = []
  for (const segment of segments) {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.text.length
    const overlapStart = Math.max(rangeStart, segmentStart)
    const overlapEnd = Math.min(rangeEnd, segmentEnd)
    if (overlapStart >= overlapEnd) {
      result.push(segment)
    } else {
      const localStart = overlapStart - segmentStart
      const localEnd = overlapEnd - segmentStart
      result.push({ text: segment.text.slice(0, localStart), color: segment.color })
      result.push({ text: segment.text.slice(localStart, localEnd), color })
      result.push({ text: segment.text.slice(localEnd), color: segment.color })
    }
    cursor = segmentEnd
  }
  return mergeSegments(result)
}

export function reconcileTextSegments(
  segments: TextSegment[],
  nextText: string,
): TextSegment[] {
  const oldText = segments.map((segment) => segment.text).join('')
  if (oldText === nextText) return segments

  let prefixLength = 0
  while (
    prefixLength < oldText.length &&
    prefixLength < nextText.length &&
    oldText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < oldText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    oldText[oldText.length - 1 - suffixLength] ===
      nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  const result: TextSegment[] = []
  let cursor = 0
  for (const segment of segments) {
    const segmentEnd = cursor + segment.text.length
    const keptEnd = Math.min(segmentEnd, prefixLength)
    if (keptEnd > cursor) {
      result.push({ text: segment.text.slice(0, keptEnd - cursor), color: segment.color })
    }
    cursor = segmentEnd
  }

  const insertedText = nextText.slice(prefixLength, nextText.length - suffixLength)
  if (insertedText) result.push({ text: insertedText })

  const suffixStart = oldText.length - suffixLength
  cursor = 0
  for (const segment of segments) {
    const segmentEnd = cursor + segment.text.length
    const keptStart = Math.max(cursor, suffixStart)
    if (segmentEnd > keptStart) {
      result.push({
        text: segment.text.slice(keptStart - cursor),
        color: segment.color,
      })
    }
    cursor = segmentEnd
  }
  return mergeSegments(result)
}

export function getCoverCrop(
  imageWidth: number,
  imageHeight: number,
  format: CanvasFormat,
  crop: Crop,
) {
  const baseScale = Math.max(format.width / imageWidth, format.height / imageHeight)
  const scale = baseScale * Math.max(1, crop.zoom)
  const width = imageWidth * scale
  const height = imageHeight * scale
  const maxX = Math.max(0, (width - format.width) / 2)
  const maxY = Math.max(0, (height - format.height) / 2)
  const x = Math.max(-maxX, Math.min(maxX, crop.x * format.width))
  const y = Math.max(-maxY, Math.min(maxY, crop.y * format.height))
  return {
    x: (format.width - width) / 2 + x,
    y: (format.height - height) / 2 + y,
    width,
    height,
  }
}

export function clampCrop(crop: Crop, imageWidth: number, imageHeight: number, format: CanvasFormat): Crop {
  const baseScale = Math.max(format.width / imageWidth, format.height / imageHeight)
  const width = imageWidth * baseScale * Math.max(1, crop.zoom)
  const height = imageHeight * baseScale * Math.max(1, crop.zoom)
  const maxX = Math.max(0, (width - format.width) / 2 / format.width)
  const maxY = Math.max(0, (height - format.height) / 2 / format.height)
  return {
    ...crop,
    x: Math.max(-maxX, Math.min(maxX, crop.x)),
    y: Math.max(-maxY, Math.min(maxY, crop.y)),
  }
}

type RenderText = {
  value: string
  segments: TextSegment[]
  visible: boolean
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fontWeight: number
  lineHeight: number
  align: CanvasTextAlign
}

function textLines(
  context: CanvasRenderingContext2D,
  segments: TextSegment[],
  width: number,
) {
  const lines: Array<Array<{ text: string; color: string }>> = [[]]
  const lineWidths = [0]
  for (const segment of segments) {
    for (const character of Array.from(segment.text)) {
      const lineIndex = lines.length - 1
      if (character === '\n') {
        lines.push([])
        lineWidths.push(0)
        continue
      }
      const color = segment.color ?? DEFAULT_TEXT_COLOR
      context.fillStyle = color
      const previous = lines[lineIndex][lines[lineIndex].length - 1]
      const combined = previous ? previous.text + character : character
      const candidateWidth = previous
        ? lineWidths[lineIndex] - context.measureText(previous.text).width + context.measureText(combined).width
        : context.measureText(character).width
      if (candidateWidth > width && lines[lineIndex].length > 0 && character.trim()) {
        lines.push([{ text: character, color }])
        lineWidths.push(context.measureText(character).width)
      } else {
        if (previous && previous.color === color) previous.text += character
        else lines[lineIndex].push({ text: character, color })
        lineWidths[lineIndex] = candidateWidth
      }
    }
  }
  return { lines, lineWidths }
}

export function drawComposition(
  context: CanvasRenderingContext2D,
  format: CanvasFormat,
  image: CanvasImageSource | null,
  crop: Crop,
  title: RenderText,
  description: RenderText,
) {
  context.clearRect(0, 0, format.width, format.height)
  context.fillStyle = '#17131d'
  context.fillRect(0, 0, format.width, format.height)

  if (image) {
    const dimensions = image as CanvasImageSource & { width: number; height: number }
    const rect = getCoverCrop(dimensions.width, dimensions.height, format, crop)
    context.save()
    context.beginPath()
    context.rect(0, 0, format.width, format.height)
    context.clip()
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
    context.restore()

    const gradient = context.createLinearGradient(0, format.height * 0.43, 0, format.height)
    gradient.addColorStop(0, 'rgba(13, 8, 22, 0)')
    gradient.addColorStop(0.45, 'rgba(13, 8, 22, 0.50)')
    gradient.addColorStop(1, 'rgba(13, 8, 22, 0.90)')
    context.fillStyle = gradient
    context.fillRect(0, 0, format.width, format.height)
  }

  const scale = format.width / 1080
  const drawText = (item: RenderText) => {
    if (!item.visible || !item.value.trim()) return
    const fontSize = item.fontSize * scale
    const maxWidth = format.width * 0.84
    const x = format.width * item.x
    const y = format.height * item.y
    const segments = item.segments.length ? item.segments : [{ text: item.value }]
    context.save()
    context.font = `${item.fontWeight} ${fontSize}px ${item.fontFamily}`
    context.textBaseline = 'top'
    context.textAlign = item.align
    context.shadowColor = 'rgba(0, 0, 0, 0.25)'
    context.shadowBlur = 10 * scale
    const { lines, lineWidths } = textLines(context, segments, maxWidth)
    lines.forEach((line, index) => {
      const lineWidth = lineWidths[index]
      let cursorX =
        item.align === 'center' ? x - lineWidth / 2 : item.align === 'right' ? x + maxWidth / 2 - lineWidth : x - maxWidth / 2
      const lineY = y + index * fontSize * item.lineHeight
      for (const run of line) {
        context.fillStyle = run.color
        context.fillText(run.text, cursorX, lineY)
        cursorX += context.measureText(run.text).width
      }
    })
    context.restore()
  }

  drawText(title)
  drawText(description)
  context.save()
  context.font = `700 ${14 * scale}px Arial, sans-serif`
  context.fillStyle = 'rgba(255, 255, 255, 0.88)'
  context.textAlign = 'right'
  context.textBaseline = 'bottom'
  context.fillText('LESVIOLETS.COM', format.width - 40 * scale, format.height - 32 * scale)
  context.restore()
}
