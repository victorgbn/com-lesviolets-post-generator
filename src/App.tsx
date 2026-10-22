import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TEXT_COLOR, EXPORT_JPEG_QUALITY, FONTS, OUTPUT_FORMATS, THEME_COLORS } from './config/editor'
import {
  clampCrop,
  colorTextRange,
  drawComposition,
  reconcileTextSegments,
  type Crop,
  type TextSegment,
} from './lib/graphics'
import './App.css'

type TextId = 'title' | 'description'
type PanelTab = 'image' | 'text' | 'style'
type TextLayer = {
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

const INITIAL_LAYERS: Record<TextId, TextLayer> = {
  title: {
    value: 'Le TFC réalise une excellente opération',
    segments: [{ text: 'Le TFC réalise une excellente opération' }],
    visible: true,
    x: 0.5,
    y: 0.69,
    fontSize: 76,
    fontFamily: FONTS[0].family,
    fontWeight: 400,
    lineHeight: 1.08,
    align: 'left',
  },
  description: {
    value: 'La réaction après la rencontre',
    segments: [{ text: 'La réaction après la rencontre' }],
    visible: true,
    x: 0.5,
    y: 0.87,
    fontSize: 32,
    fontFamily: FONTS[1].family,
    fontWeight: 400,
    lineHeight: 1.2,
    align: 'left',
  },
}

function App() {
  const [formatId, setFormatId] = useState<(typeof OUTPUT_FORMATS)[number]['id']>('portrait')
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 })
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [fileName, setFileName] = useState('')
  const [layers, setLayers] = useState(INITIAL_LAYERS)
  const [selectedText, setSelectedText] = useState<TextId>('title')
  const [selectedItem, setSelectedItem] = useState<'image' | TextId>('image')
  const [tab, setTab] = useState<PanelTab>('image')
  const [selections, setSelections] = useState<Record<TextId, { start: number; end: number }>>({
    title: { start: 0, end: 0 },
    description: { start: 0, end: 0 },
  })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const wasDraggedRef = useRef(false)
  const format = useMemo(() => OUTPUT_FORMATS.find((item) => item.id === formatId)!, [formatId])
  const layer = layers[selectedText]

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Le navigateur ne peut pas créer le canevas de prévisualisation.')
      return
    }
    drawComposition(context, format, image, crop, layers.title, layers.description)
  }, [crop, format, image, layers])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => () => image?.close(), [image])

  const updateLayer = (id: TextId, update: Partial<TextLayer>) => {
    setLayers((current) => ({ ...current, [id]: { ...current[id], ...update } }))
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setError('')
    setStatus('')
    const supported =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!supported) {
      setError('Format non pris en charge. Choisissez une image JPEG, PNG ou WebP.')
      return
    }
    setImporting(true)
    try {
      const bitmap = await createImageBitmap(file)
      setImage((previous) => {
        previous?.close()
        return bitmap
      })
      setFileName(file.name)
      setCrop((previous) => clampCrop(previous, bitmap.width, bitmap.height, format))
      setStatus('Image importée. Faites glisser le visuel pour ajuster le cadrage.')
      setSelectedItem('image')
      setTab('image')
    } catch {
      setError('Cette image n’a pas pu être chargée. Essayez un autre fichier.')
    } finally {
      setImporting(false)
    }
  }

  const handleFormatChange = (nextId: (typeof OUTPUT_FORMATS)[number]['id']) => {
    setFormatId(nextId)
    setStatus('Format modifié. Vérifiez le cadrage et le placement des textes.')
    setError('')
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return
    const rect = event.currentTarget.getBoundingClientRect()
    wasDraggedRef.current = false
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (selectedItem !== 'image') {
      const pointY = ((event.clientY - rect.top) / rect.height) * format.height
      const selectedLayer = layers[selectedItem]
      const anchorY = selectedLayer.y * format.height
      if (Math.abs(pointY - anchorY) > selectedLayer.fontSize * 2.5) setSelectedItem('image')
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = pointerRef.current
    if (!previous || previous.id !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const deltaX = ((event.clientX - previous.x) / rect.width) * format.width
    const deltaY = ((event.clientY - previous.y) / rect.height) * format.height
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) wasDraggedRef.current = true
    pointerRef.current = { ...previous, x: event.clientX, y: event.clientY }
    if (selectedItem === 'image' && image) {
      setCrop((current) =>
        clampCrop(
          { ...current, x: current.x + deltaX / format.width, y: current.y + deltaY / format.height },
          image.width,
          image.height,
          format,
        ),
      )
    } else if (selectedItem !== 'image') {
      const selectedLayer = layers[selectedItem]
      updateLayer(selectedItem, {
        x: Math.max(0.08, Math.min(0.92, selectedLayer.x + deltaX / format.width)),
        y: Math.max(0.12, Math.min(0.94, selectedLayer.y + deltaY / format.height)),
      })
    }
  }

  const handlePointerUp = () => {
    pointerRef.current = null
  }

  const updateSelection = () => {
    const input = textareaRef.current
    if (input) {
      setSelections((current) => ({
        ...current,
        [selectedText]: { start: input.selectionStart, end: input.selectionEnd },
      }))
    }
  }

  const applyColor = (color?: string) => {
    const current = layers[selectedText]
    const selection = selections[selectedText]
    const nextSegments = colorTextRange(current.segments, selection.start, selection.end, color)
    if (selection.start === selection.end) {
      setStatus('Sélectionnez un mot ou une portion dans le champ de texte avant d’appliquer une couleur.')
      return
    }
    updateLayer(selectedText, { segments: nextSegments })
    setStatus(color ? 'Couleur appliquée à la sélection.' : 'Couleur de la sélection réinitialisée.')
  }

  const exportImage = async (mime: 'image/png' | 'image/jpeg') => {
    if (!image) return
    setError('')
    setStatus('')
    setExporting(true)
    try {
      const fontPromises = [layers.title, layers.description].map((item) =>
        document.fonts.load(`${item.fontWeight} ${item.fontSize}px ${item.fontFamily}`),
      )
      await Promise.all(fontPromises)
      await document.fonts.ready
      const canvas = document.createElement('canvas')
      canvas.width = format.width
      canvas.height = format.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Impossible de créer le canevas haute résolution.')
      drawComposition(context, format, image, crop, layers.title, layers.description)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Le navigateur n’a pas généré le fichier.'))),
          mime,
          mime === 'image/jpeg' ? EXPORT_JPEG_QUALITY : undefined,
        )
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lesviolets-${format.id}-${new Date().toISOString().slice(0, 10)}.${mime === 'image/png' ? 'png' : 'jpg'}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(`Visuel exporté en ${mime === 'image/png' ? 'PNG' : 'JPEG'} · ${format.width} × ${format.height} px.`)
    } catch (exportError) {
      setError(exportError instanceof Error ? `Export impossible : ${exportError.message}` : 'Une erreur inattendue a empêché l’export.')
    } finally {
      setExporting(false)
    }
  }

  const formatFontFamily = layer.fontFamily
  const enabledFontWeights = FONTS.find((font) => font.family === formatFontFamily)?.weights ?? [400, 700]

  return (
    <main className="studio">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Studio LesViolets, accueil">
          <span className="brand-mark">LV</span>
          <span><strong>Studio</strong><small>LESVIOLETS.COM</small></span>
        </a>
        <div className="topbar-actions">
          <label className="format-select">
            <span>Format</span>
            <select value={formatId} onChange={(event) => handleFormatChange(event.target.value as typeof formatId)}>
              {OUTPUT_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <small>{format.width} × {format.height}</small>
          </label>
          <button className="button button-secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            <span aria-hidden="true">＋</span> {importing ? 'Import…' : 'Importer'}
          </button>
          <div className="export-buttons">
            <button className="button button-primary" disabled={!image || exporting} onClick={() => exportImage('image/png')}>
              {exporting ? 'Export…' : '↓ Exporter PNG'}
            </button>
            <button className="button button-secondary jpeg-button" disabled={!image || exporting} onClick={() => exportImage('image/jpeg')}>JPEG</button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          void importFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
        aria-label="Choisir une image"
      />

      <div className="workspace">
        <section
          className={`preview-area ${dropActive ? 'drop-active' : ''}`}
          aria-busy={importing}
          onDragOver={(event) => { event.preventDefault(); setDropActive(true) }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDropActive(false)
            void importFile(event.dataTransfer.files[0])
          }}
          aria-label="Zone de prévisualisation"
        >
          <div className="preview-heading">
            <div><span className="eyebrow">ESPACE DE TRAVAIL</span><strong>{fileName || 'Nouveau visuel'}</strong></div>
            <div className="preview-meta"><span className="live-dot" /> Aperçu en direct <span className="meta-separator">·</span> {format.width} × {format.height}</div>
          </div>
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              width={format.width}
              height={format.height}
              className={image ? 'preview-canvas has-image' : 'preview-canvas'}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(event) => {
                if (wasDraggedRef.current) {
                  wasDraggedRef.current = false
                  return
                }
                if (!image) return
                const rect = event.currentTarget.getBoundingClientRect()
                const y = ((event.clientY - rect.top) / rect.height) * format.height
                if (y >= layers.description.y * format.height - layers.description.fontSize * 1.5) {
                  setSelectedText('description')
                  setSelectedItem('description')
                } else if (y >= layers.title.y * format.height - layers.title.fontSize * 2.5) {
                  setSelectedText('title')
                  setSelectedItem('title')
                } else {
                  setSelectedItem('image')
                }
              }}
              aria-label={image ? 'Prévisualisation du visuel, faire glisser pour déplacer' : 'Prévisualisation vide'}
              role="img"
            />
            {!image && (
              <button className="empty-overlay" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon">↑</span>
                <strong>{importing ? 'Importation en cours…' : 'Commencez par importer une photo'}</strong>
                <span>Glissez-déposez une image ici ou parcourez vos fichiers</span>
                <span className="supported">JPEG · PNG · WEBP</span>
              </button>
            )}
            {dropActive && <div className="drop-overlay">Déposez l’image pour remplacer la photo</div>}
          </div>
          <div className="preview-footer">
            <span><kbd>↔</kbd> Glissez pour déplacer {selectedItem === 'image' ? 'la photo' : 'le texte sélectionné'}</span>
            <span>{image ? 'Canevas haute résolution' : 'Prêt à créer'}</span>
          </div>
        </section>

        <aside className="editor-panel">
          <div className="panel-tabs" role="tablist" aria-label="Outils d’édition">
            {([
              ['image', 'Image', '▧'],
              ['text', 'Texte', 'T'],
              ['style', 'Style', '◈'],
            ] as const).map(([id, label, icon]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'panel-tab active' : 'panel-tab'} onClick={() => setTab(id)}>
                <span aria-hidden="true">{icon}</span>{label}
              </button>
            ))}
          </div>

          {tab === 'image' && (
            <div className="panel-content">
              <div className="panel-title"><span className="eyebrow">VOTRE PHOTO</span><h2>Image & cadrage</h2></div>
              <button className="upload-button" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <span className="upload-small-icon">↑</span>
                <span><strong>{importing ? 'Importation en cours…' : image ? 'Remplacer la photo' : 'Importer une photo'}</strong><small>JPEG, PNG ou WebP</small></span>
                <span className="chevron">›</span>
              </button>
              {image ? (
                <>
                  <div className="file-info"><span className="file-icon">▧</span><span><strong>{fileName}</strong><small>{image.width} × {image.height} px</small></span><button aria-label="Supprimer l’image" className="icon-button danger-text" onClick={() => { setImage(null); setFileName(''); setCrop({ x: 0, y: 0, zoom: 1 }); setStatus('Image supprimée.') }}>×</button></div>
                  <div className="control-block">
                    <div className="label-row"><label htmlFor="zoom">Zoom</label><output>{crop.zoom.toFixed(1)}×</output></div>
                    <input id="zoom" type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => setCrop((value) => ({ ...value, zoom: Number(event.target.value) }))} />
                    <div className="range-labels"><span>Adapter</span><span>Zoomer</span></div>
                  </div>
                  <button className="text-action" onClick={() => setCrop({ x: 0, y: 0, zoom: 1 })}>↺ <span>Réinitialiser le cadrage</span></button>
                </>
              ) : (
                <p className="helper-text">Votre photo reste sur cet appareil. Rien n’est envoyé à un serveur.</p>
              )}
              <div className="panel-divider" />
              <div className="panel-title"><span className="eyebrow">FORMAT DE SORTIE</span><h2>Dimensions</h2></div>
              <div className="format-options">
                {OUTPUT_FORMATS.map((item) => (
                  <button key={item.id} className={formatId === item.id ? 'format-option selected' : 'format-option'} onClick={() => handleFormatChange(item.id)}>
                    <span className={`format-shape ${item.id}`} />
                    <span>{item.name}<small>{item.width} × {item.height}</small></span>
                    {formatId === item.id && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'text' && (
            <div className="panel-content">
              <div className="panel-title"><span className="eyebrow">ÉLÉMENTS ÉDITORIAUX</span><h2>Contenu</h2></div>
              {(['title', 'description'] as const).map((id) => (
                <button key={id} className={`layer-row ${selectedText === id ? 'selected' : ''}`} onClick={() => { setSelectedText(id); setSelectedItem(id) }}>
                  <span className={`layer-badge ${id}`}>{id === 'title' ? 'T' : '≡'}</span>
                  <span><strong>{id === 'title' ? 'Titre principal' : 'Description'}</strong><small>{id === 'title' ? 'Titre' : 'Texte secondaire'}</small></span>
                  <span className={`visibility-dot ${layers[id].visible ? 'visible' : ''}`} />
                </button>
              ))}
              <div className="control-block editor-text-block">
                <div className="label-row"><label htmlFor="text-input">{selectedText === 'title' ? 'Texte du titre' : 'Description'}</label><span>{layer.value.length} caractères</span></div>
                <textarea
                  ref={textareaRef}
                  id="text-input"
                  value={layer.value}
                  rows={selectedText === 'title' ? 4 : 3}
                  placeholder={selectedText === 'title' ? 'Saisissez votre titre…' : 'Ajouter une description facultative…'}
                  onChange={(event) => {
                    const value = event.target.value
                    updateLayer(selectedText, { value, segments: reconcileTextSegments(layer.segments, value) })
                  }}
                  onSelect={updateSelection}
                  onKeyUp={updateSelection}
                  onMouseUp={updateSelection}
                />
              </div>
              <div className="control-block">
                <div className="label-row"><label htmlFor="font-size">Taille du texte</label><output>{layer.fontSize} px</output></div>
                <input id="font-size" type="range" min="18" max="120" value={layer.fontSize} onChange={(event) => updateLayer(selectedText, { fontSize: Number(event.target.value) })} />
              </div>
              <div className="control-block">
                <div className="label-row"><label htmlFor="line-height">Interligne</label><output>{layer.lineHeight.toFixed(2)}</output></div>
                <input id="line-height" type="range" min="0.9" max="1.6" step="0.05" value={layer.lineHeight} onChange={(event) => updateLayer(selectedText, { lineHeight: Number(event.target.value) })} />
              </div>
              <div className="control-block">
                <div className="label-row"><span>Alignement</span></div>
                <div className="align-buttons" role="group" aria-label="Alignement du texte">
                  {(['left', 'center', 'right'] as const).map((align) => <button key={align} className={layer.align === align ? 'align-button active' : 'align-button'} aria-label={`Aligner ${align === 'left' ? 'à gauche' : align === 'center' ? 'au centre' : 'à droite'}`} onClick={() => updateLayer(selectedText, { align })}>{align === 'left' ? '☰' : align === 'center' ? '≡' : '☷'}</button>)}
                </div>
              </div>
              <div className="visibility-actions">
                <button className="text-action" onClick={() => updateLayer(selectedText, { visible: !layer.visible })}>{layer.visible ? '◉ Masquer cet élément' : '◎ Afficher cet élément'}</button>
                <button className="text-action danger-text" onClick={() => updateLayer(selectedText, { value: '', segments: [], visible: false })}>× Effacer le texte</button>
              </div>
            </div>
          )}

          {tab === 'style' && (
            <div className="panel-content">
              <div className="panel-title"><span className="eyebrow">APPARENCE</span><h2>Style du texte</h2></div>
              <div className="control-block">
                <div className="label-row"><label htmlFor="text-layer">Élément sélectionné</label></div>
                <select id="text-layer" className="field-select" value={selectedText} onChange={(event) => { const id = event.target.value as TextId; setSelectedText(id); setSelectedItem(id) }}>
                  <option value="title">Titre principal</option><option value="description">Description</option>
                </select>
              </div>
              <div className="control-block">
                <div className="label-row"><label htmlFor="font-family">Typographie</label></div>
                <select id="font-family" className="field-select" value={layer.fontFamily} onChange={(event) => updateLayer(selectedText, { fontFamily: event.target.value })}>
                  {FONTS.map((font) => <option key={font.name} value={font.family}>{font.name}</option>)}
                </select>
              </div>
              <div className="control-block">
                <div className="label-row"><span>Graisse</span></div>
                <div className="weight-options">
                  {enabledFontWeights.map((weight) => <button key={weight} className={layer.fontWeight === weight ? 'weight-option active' : 'weight-option'} onClick={() => updateLayer(selectedText, { fontWeight: weight })}>{weight === 400 ? 'Normal' : weight === 500 ? 'Moyen' : weight === 700 ? 'Gras' : 'Extra gras'}</button>)}
                </div>
              </div>
              <div className="control-block">
                <div className="label-row"><span>Couleur par défaut</span><output className="color-output"><i style={{ backgroundColor: DEFAULT_TEXT_COLOR }} /> {layer.segments.find((segment) => segment.color)?.color ?? DEFAULT_TEXT_COLOR}</output></div>
                <div className="color-palette" role="group" aria-label="Palette de couleurs">
                  {THEME_COLORS.map((color) => <button key={color.value} className={`color-swatch ${color.value === (layer.segments.find((segment) => segment.color)?.color ?? DEFAULT_TEXT_COLOR) ? 'chosen' : ''}`} title={color.name} aria-label={`Appliquer ${color.name} à la sélection, ou comme couleur de texte`} style={{ backgroundColor: color.value }} onClick={() => {
                    if (selections[selectedText].start !== selections[selectedText].end) applyColor(color.value)
                    else updateLayer(selectedText, { segments: [{ text: layer.value, color: color.value }] })
                  }}>{color.value === '#FFFFFF' && <span>✓</span>}</button>)}
                </div>
                <p className="helper-text compact">Sélectionnez un passage dans l’éditeur de texte, puis choisissez une couleur pour le styliser.</p>
                <button className="text-action" onClick={() => applyColor(undefined)}>↺ <span>Retirer la couleur de la sélection</span></button>
              </div>
              <div className="panel-divider" />
              <div className="control-block">
                <div className="label-row"><span>Position du texte</span><small>Glissez-le sur le visuel</small></div>
                <div className="position-controls">
                  <label>X <input type="range" min="0.08" max="0.92" step="0.01" value={layer.x} onChange={(event) => updateLayer(selectedText, { x: Number(event.target.value) })} /></label>
                  <label>Y <input type="range" min="0.12" max="0.94" step="0.01" value={layer.y} onChange={(event) => updateLayer(selectedText, { y: Number(event.target.value) })} /></label>
                </div>
              </div>
            </div>
          )}
          {(status || error) && <div className={error ? 'notice error-notice' : 'notice'} role={error ? 'alert' : 'status'}>{error || status}<button aria-label="Fermer le message" onClick={() => { setError(''); setStatus('') }}>×</button></div>}
          <div className="panel-bottom"><span className="secure-icon">◈</span> Édition locale · vos images restent privées</div>
        </aside>
      </div>
    </main>
  )
}

export default App
