import { DialogContent, DialogOverlay } from '@reach/dialog'
import React from 'react'
import { animated, useSpring, useTransition } from 'react-spring'
import { useGesture } from 'react-use-gesture'
import styled, { css } from 'styled-components'
import { Z_INDEX } from 'theme/zIndex'

import { isMobile } from '../../utils/userAgent'

export const MODAL_TRANSITION_DURATION = 200

const AnimatedDialogOverlay = animated(DialogOverlay)

const StyledDialogOverlay = styled(AnimatedDialogOverlay)<{ $scrollOverlay?: boolean; $compact?: boolean }>`
  &[data-reach-dialog-overlay] {
    z-index: ${Z_INDEX.modalBackdrop};
    background-color: transparent;
    overflow: hidden;

    display: flex;
    align-items: ${({ $compact }) => ($compact ? 'flex-start' : 'center')};
    @media screen and (max-width: ${({ theme }) => theme.breakpoint.sm}px) {
      align-items: ${({ $compact }) => ($compact ? 'flex-start' : 'flex-end')};
    }
    overflow-y: ${({ $scrollOverlay, $compact }) => ($compact ? 'hidden' : $scrollOverlay && 'scroll')};
    justify-content: ${({ $compact }) => ($compact ? 'flex-start' : 'center')};

    background-color: ${({ $compact, theme }) => ($compact ? 'transparent' : theme.scrim)};

    ${({ $compact }) =>
      $compact &&
      css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      `}
  }
`

type StyledDialogProps = {
  $minHeight?: number | false
  $maxHeight?: number
  $scrollOverlay?: boolean
  $hideBorder?: boolean
  $maxWidth: number
  $compact?: boolean
}

const AnimatedDialogContent = animated(DialogContent)
const StyledDialogContent = styled(AnimatedDialogContent)<StyledDialogProps>`
  overflow-y: ${({ $compact }) => ($compact ? 'auto' : 'auto')};

  &[data-reach-dialog-content] {
    margin: ${({ $compact }) => ($compact ? '0' : 'auto')};
    background-color: ${({ theme }) => theme.surface2};
    border: ${({ theme, $hideBorder, $compact }) => ($compact || $hideBorder) ? 'none' : `1px solid ${theme.surface3}`};
    box-shadow: ${({ theme, $compact }) => ($compact ? 'none' : theme.deprecated_deepShadow)};
    padding: 0px;
    width: ${({ $compact }) => ($compact ? '100vw' : '50vw')};
    overflow-y: auto;
    overflow-x: hidden;
    max-width: ${({ $maxWidth, $compact }) => ($compact ? '100vw' : `${$maxWidth}px`)};
    ${({ $maxHeight, $compact }) =>
      !$compact && $maxHeight &&
      css`
        max-height: ${$maxHeight}vh;
      `}
    ${({ $minHeight, $compact }) =>
      !$compact && $minHeight &&
      css`
        min-height: ${$minHeight}vh;
      `}
    ${({ $compact }) =>
      $compact &&
      css`
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
      `}
    display: ${({ $scrollOverlay, $compact }) => ($compact ? 'flex' : $scrollOverlay ? 'inline-table' : 'flex')};
    border-radius: ${({ $compact }) => ($compact ? '0' : '20px')};

    @media screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
      width: ${({ $compact }) => ($compact ? '100vw' : '65vw')};
    }
    @media screen and (max-width: ${({ theme }) => theme.breakpoint.sm}px) {
      margin: 0;
      width: 100vw;
      border-radius: ${({ $compact }) => ($compact ? '0' : '20px')};
      ${({ $compact }) =>
        !$compact &&
        css`
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        `}
    }
  }
`

interface ModalProps {
  isOpen: boolean
  onDismiss?: () => void
  onSwipe?: () => void
  height?: number // takes precedence over minHeight and maxHeight
  minHeight?: number | false
  maxHeight?: number
  maxWidth?: number
  initialFocusRef?: React.RefObject<any>
  children?: React.ReactNode
  $scrollOverlay?: boolean
  hideBorder?: boolean
  compact?: boolean
}

export default function Modal({
  isOpen,
  onDismiss,
  minHeight = false,
  maxHeight = 90,
  maxWidth = 420,
  height,
  initialFocusRef,
  children,
  onSwipe = onDismiss,
  $scrollOverlay,
  hideBorder = false,
  compact = false,
}: ModalProps) {
  const fadeTransition = useTransition(isOpen, {
    config: { duration: MODAL_TRANSITION_DURATION },
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
  })

  const [{ y }, set] = useSpring(() => ({ y: 0, config: { mass: 1, tension: 210, friction: 20 } }))
  const bind = useGesture({
    onDrag: (state) => {
      set({
        y: state.down ? state.movement[1] : 0,
      })
      if (state.movement[1] > 300 || (state.velocity > 3 && state.direction[1] > 0)) {
        onSwipe?.()
      }
    },
  })

  return (
    <>
      {fadeTransition(
        ({ opacity }, item) =>
          item && (
            <StyledDialogOverlay
              style={{ opacity: opacity.to({ range: [0.0, 1.0], output: [0, 1] }) }}
              onDismiss={onDismiss}
              initialFocusRef={initialFocusRef}
              unstable_lockFocusAcrossFrames={false}
              $scrollOverlay={$scrollOverlay}
              $compact={compact}
            >
              <StyledDialogContent
                {...(isMobile && !compact
                  ? {
                      ...bind(),
                      style: { transform: y.interpolate((y) => `translateY(${(y as number) > 0 ? y : 0}px)`) },
                    }
                  : {})}
                aria-label="dialog"
                $minHeight={height ?? minHeight}
                $maxHeight={height ?? maxHeight}
                $scrollOverlay={$scrollOverlay}
                $hideBorder={hideBorder}
                $maxWidth={maxWidth}
                $compact={compact}
              >
                {/* prevents the automatic focusing of inputs on mobile by the reach dialog */}
                {!initialFocusRef && isMobile ? <div tabIndex={1} /> : null}
                {children}
              </StyledDialogContent>
            </StyledDialogOverlay>
          )
      )}
    </>
  )
}
