/**
 * ImageModal Component
 * Full-screen image viewer with gallery navigation, zoom, and pan.
 * Uses @headlessui/react Dialog for accessible modal behavior.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import {
  X,
  CaretLeft,
  CaretRight,
  ArrowClockwise,
  ArrowCounterClockwise,
  ImageBroken,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsIn,
} from '@phosphor-icons/react'
import type { ImageAttachment } from '../types'
import { createDataUrl, formatFileSize } from '../utils/fileUtils'
import { useTranslation } from '../hooks/useTranslation'

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  attachment: ImageAttachment
  allAttachments?: ImageAttachment[]
  currentIndex?: number
  onNavigate?: (direction: 'prev' | 'next') => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const ZOOM_STEP = 0.25

function ImageModal({
  isOpen,
  onClose,
  attachment,
  allAttachments,
  currentIndex = 0,
  onNavigate,
}: ImageModalProps) {
  const { t } = useTranslation()
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Zoom, pan & rotation state
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const imageAreaRef = useRef<HTMLDivElement>(null)

  const hasMultipleImages = allAttachments && allAttachments.length > 1
  const canNavigatePrev = hasMultipleImages && currentIndex > 0
  const canNavigateNext =
    hasMultipleImages && currentIndex < (allAttachments?.length || 1) - 1
  const isZoomed = scale > 1
  const isTransformed = isZoomed || rotation !== 0

  // Keep refs in sync for event handlers
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { positionRef.current = position }, [position])

  // Keyboard navigation + zoom shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onNavigate && canNavigatePrev) {
        onNavigate('prev')
      } else if (e.key === 'ArrowRight' && onNavigate && canNavigateNext) {
        onNavigate('next')
      } else if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE))
      } else if (e.key === '-') {
        setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE))
        if (scaleRef.current - ZOOM_STEP <= 1) setPosition({ x: 0, y: 0 })
      } else if (e.key === '0') {
        setScale(1)
        setPosition({ x: 0, y: 0 })
        setRotation(0)
      } else if (e.key === 'r' && !e.shiftKey) {
        setRotation((r) => r + 90)
      } else if (e.key === 'R' || (e.key === 'r' && e.shiftKey)) {
        setRotation((r) => r - 90)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onNavigate, canNavigatePrev, canNavigateNext])

  // Reset state on attachment change
  useEffect(() => {
    setIsImageLoaded(false)
    setImageError(false)
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }, [attachment])

  // Mouse wheel zoom (needs native listener for preventDefault on passive)
  useEffect(() => {
    const el = imageAreaRef.current
    if (!el || !isOpen) return

    const handler = (e: WheelEvent) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const current = scaleRef.current
      const newScale = Math.min(Math.max(current + delta, MIN_SCALE), MAX_SCALE)
      if (newScale === current) return
      e.preventDefault()
      setScale(newScale)
      if (newScale <= 1) setPosition({ x: 0, y: 0 })
    }

    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [isOpen])

  const handleRetry = useCallback(() => {
    setImageError(false)
    setIsImageLoaded(false)
    setRetryKey((k) => k + 1)
  }, [])

  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE))
    if (scaleRef.current - ZOOM_STEP <= 1) setPosition({ x: 0, y: 0 })
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }, [])

  // Double-click to toggle between fit and 2x zoom
  const handleDoubleClick = useCallback(() => {
    const current = scaleRef.current
    if (current !== 1) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    } else {
      setScale(2)
    }
  }, [])

  // Drag to pan (when zoomed)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Click background to close (only when not transformed)
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isTransformed) {
      onClose()
    }
  }, [isTransformed, onClose])

  const previewUrl =
    attachment.preview || createDataUrl(attachment.base64Data, attachment.mimeType)

  const zoomPercent = Math.round(scale * 100)

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative" style={{ zIndex: 99999 }}>
      <DialogBackdrop
        className="fixed inset-0 bg-black/90 backdrop-blur-sm"
        style={{ zIndex: 99999 }}
      />

      <DialogPanel
        className="fixed inset-0 flex flex-col"
        style={{ zIndex: 100000 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Header ── */}
        <div className="flex items-center px-5 py-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {hasMultipleImages && (
              <span className="text-xs text-white/50 tabular-nums whitespace-nowrap font-medium">
                {currentIndex + 1} / {allAttachments?.length}
              </span>
            )}
            <span className="text-sm text-white/90 truncate font-medium">{attachment.filename}</span>
            <span className="text-xs text-white/40 whitespace-nowrap">
              {formatFileSize(attachment.sizeBytes)}
            </span>
          </div>
        </div>

        {/* ── Image area ── */}
        <div
          ref={imageAreaRef}
          className="relative flex-1 flex items-center justify-center min-h-0 px-4 pb-4"
          onClick={handleBackdropClick}
          style={{ cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {/* ── Floating close button ── */}
          <button
            onClick={onClose}
            className="absolute top-3 right-5 z-30 cursor-pointer flex items-center justify-center w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-all duration-200 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label={t('BiChat.Image.Close')}
            type="button"
          >
            <X size={20} weight="bold" />
          </button>

          {/* Loading spinner */}
          {!isImageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span className="text-xs text-white/40">{t('BiChat.Loading')}</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {imageError && (
            <div role="alert" className="flex flex-col items-center justify-center text-center max-w-xs">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <ImageBroken size={28} className="text-white/30" weight="duotone" />
              </div>
              <p className="text-sm font-medium text-white/70 mb-1">{t('BiChat.Image.FailedToLoad')}</p>
              <p className="text-xs text-white/30 mb-5 truncate max-w-full">{attachment.filename}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label={t('BiChat.Image.Retry')}
              >
                <ArrowClockwise size={16} weight="bold" />
                {t('BiChat.Retry.Label')}
              </button>
            </div>
          )}

          {/* Image */}
          <img
            key={retryKey}
            src={previewUrl}
            alt={attachment.filename}
            className={[
              'relative z-0 max-w-[85vw] max-h-[calc(100vh-160px)] object-contain select-none rounded-lg',
              'transition-opacity duration-300 ease-out',
              isImageLoaded ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging
                ? 'opacity 0.3s ease-out'
                : 'transform 0.2s ease-out, opacity 0.3s ease-out',
            }}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => setImageError(true)}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            loading="lazy"
            draggable={false}
          />

          {/* ── Navigation arrows ── */}
          {hasMultipleImages && (
            <>
              <button
                onClick={() => onNavigate?.('prev')}
                disabled={!canNavigatePrev || !isImageLoaded || imageError}
                className={[
                  'absolute left-4 top-1/2 -translate-y-1/2 z-20',
                  'flex items-center justify-center w-11 h-11 rounded-full',
                  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  canNavigatePrev && isImageLoaded && !imageError
                    ? 'cursor-pointer bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white shadow-lg border border-white/10'
                    : 'bg-black/20 text-white/20 cursor-not-allowed',
                ].join(' ')}
                aria-label={t('BiChat.Image.Previous')}
                type="button"
              >
                <CaretLeft size={20} weight="bold" />
              </button>

              <button
                onClick={() => onNavigate?.('next')}
                disabled={!canNavigateNext || !isImageLoaded || imageError}
                className={[
                  'absolute right-4 top-1/2 -translate-y-1/2 z-20',
                  'flex items-center justify-center w-11 h-11 rounded-full',
                  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  canNavigateNext && isImageLoaded && !imageError
                    ? 'cursor-pointer bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white shadow-lg border border-white/10'
                    : 'bg-black/20 text-white/20 cursor-not-allowed',
                ].join(' ')}
                aria-label={t('BiChat.Image.Next')}
                type="button"
              >
                <CaretRight size={20} weight="bold" />
              </button>
            </>
          )}

          {/* ── Zoom toolbar ── */}
          {isImageLoaded && !imageError && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-black/50 backdrop-blur-xl rounded-full px-1.5 py-1.5 border border-white/10 shadow-2xl">
              <button
                type="button"
                onClick={zoomOut}
                disabled={scale <= MIN_SCALE}
                className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:text-white/20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                aria-label={t('BiChat.Image.ZoomOut')}
              >
                <MagnifyingGlassMinus size={16} weight="bold" />
              </button>

              <span className="text-xs text-white/60 tabular-nums font-medium min-w-[3.5rem] text-center select-none">
                {zoomPercent}%
              </span>

              <button
                type="button"
                onClick={zoomIn}
                disabled={scale >= MAX_SCALE}
                className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:text-white/20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                aria-label={t('BiChat.Image.ZoomIn')}
              >
                <MagnifyingGlassPlus size={16} weight="bold" />
              </button>

              <div className="w-px h-4 bg-white/15 mx-1" />

              <button
                type="button"
                onClick={() => setRotation((r) => r - 90)}
                className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t('BiChat.Image.RotateLeft')}
              >
                <ArrowCounterClockwise size={16} weight="bold" />
              </button>

              <button
                type="button"
                onClick={() => setRotation((r) => r + 90)}
                className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t('BiChat.Image.RotateRight')}
              >
                <ArrowClockwise size={16} weight="bold" />
              </button>

              {isTransformed && (
                <>
                  <div className="w-px h-4 bg-white/15 mx-1" />
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={t('BiChat.Image.ResetZoom')}
                  >
                    <ArrowsIn size={16} weight="bold" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogPanel>
    </Dialog>
  )
}

export { ImageModal }
export default ImageModal
