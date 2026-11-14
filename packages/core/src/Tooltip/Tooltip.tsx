// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file Tooltip.tsx
 * @input Uses React, useTooltip hook
 * @output Exports Tooltip component for hover/focus triggered tooltips
 * @position Layer component; uses display:contents wrapper to avoid cloneElement
 *
 * SYNC: When modified, update these files to stay in sync:
 * - /packages/core/src/Tooltip/index.ts
 * - /apps/storybook/stories/Tooltip.stories.tsx
 * - /packages/cli/assets/templates/blocks/components/Tooltip/ (showcase blocks)
 */

import React, {
  useCallback,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefCallback,
} from 'react';
import {useIsomorphicLayoutEffect} from '../hooks/useIsomorphicLayoutEffect';
import * as stylex from '@stylexjs/stylex';
import {focusOutlineProps} from '../utils/focusOutline.stylex';
import {
  useTooltip,
  type TooltipFocusTrigger,
  type TooltipTouchTrigger,
} from './useTooltip';
import type {LayerAlignment, LayerPlacement} from '../Layer/useLayer';
import {colorVars} from '../theme/tokens.stylex';

export type {TooltipFocusTrigger, TooltipTouchTrigger} from './useTooltip';

const styles = stylex.create({
  wrapperContents: {
    display: 'contents',
  },
  wrapperInline: {
    display: 'inline',
  },
  hoverIndication: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: colorVars['--color-border-emphasized'],
    textUnderlineOffset: '2px',
  },
});

export interface TooltipProps {
  /**
   * The trigger element(s). Children refs are preserved.
   * When `anchorRef` is provided, children can be omitted and the tooltip
   * attaches to the external ref element as a sibling.
   */
  children?: ReactNode;

  /**
   * External ref to use as the tooltip anchor.
   * When provided (and no children), the tooltip attaches to this element
   * instead of wrapping children. This enables sibling-mode rendering,
   * useful for lazy-loaded tooltips that shouldn't remount children.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;

  /**
   * Content to display in the tooltip.
   * Typically short, non-interactive text.
   */
  content: ReactNode;

  /**
   * Position placement relative to anchor
   * @default 'above'
   */
  placement?: LayerPlacement;

  /**
   * Alignment along the placement axis
   * @default 'center'
   */
  alignment?: LayerAlignment;

  /**
   * Delay before showing on hover (ms)
   * @default 200
   */
  delay?: number;

  /**
   * Delay before hiding after mouse/focus leave (ms)
   * @default 0
   */
  hideDelay?: number;

  /**
   * When to trigger on focus:
   * - `auto`: focus on the trigger itself, or within a trigger that is
   *   focusable when focus arrives
   * - `always`: focus on the trigger or anything inside it
   * - `never`: never on focus (for composite widgets)
   *
   * @default 'auto'
   */
  focusTrigger?: TooltipFocusTrigger;

  /**
   * What a tap does on a touch pointer, where there is no hover:
   * - `auto`: tap opens the tooltip, unless the trigger performs an action of
   *   its own (a button, a link, a form control) — that tap belongs to the
   *   control, and a hint about a control the user just operated is noise
   * - `tap`: tap always opens the tooltip, even on a trigger that acts
   * - `none`: touch never opens the tooltip
   *
   * @default 'auto'
   */
  touchTrigger?: TooltipTouchTrigger;

  /**
   * Whether the tooltip is enabled.
   * When false, hover/focus triggers are disabled.
   *
   * @default true
   */
  isEnabled?: boolean;

  /**
   * Callback fired when tooltip visibility changes.
   * Called with `true` when shown and `false` when hidden.
   */
  onOpenChange?: (isOpen: boolean) => void;

  /**
   * Whether to show hover indication (dashed underline) on the trigger.
   * - `'auto'`: Show for text-only children
   * - `true`: Always show
   * - `false`: Never show
   *
   * @default 'auto'
   */
  hasHoverIndication?: 'auto' | boolean;

  /**
   * Controlled open state. When provided, overrides hover/focus triggers:
   * - `true`: force-show the tooltip (hover/focus hide is suppressed)
   * - `false`: force-hide the tooltip
   * - `undefined`: uncontrolled — hover/focus triggers manage visibility
   *
   * A controlled tooltip still takes Escape when it is the top-most layer, and
   * answers by calling `onOpenChange(false)` without hiding itself — closing is
   * your update's decision, exactly as for a controlled Dialog. Ignore the call
   * and the tip stays, and so does the press: nothing underneath dismisses.
   *
   * The same holds for focus held closed: focus that would open the tooltip
   * calls `onOpenChange(true)` and shows nothing until your update sets
   * `isOpen`.
   */
  isOpen?: boolean;

  /**
   * Whether the tooltip should be shown on mount.
   * The tooltip is still dismissible — this just opens it initially.
   */
  isDefaultOpen?: boolean;
}

/**
 * Check if children are text-only (no React elements)
 */
function isTextOnly(children: ReactNode): boolean {
  return typeof children === 'string' || typeof children === 'number';
}

/**
 * Utility to merge ARIA ID strings
 */
function mergeIds(...ids: (string | undefined | null)[]): string | undefined {
  const filtered = ids.filter(Boolean);
  return filtered.length > 0 ? filtered.join(' ') : undefined;
}

interface AttachedTrigger {
  el: HTMLElement;
  ref: RefCallback<HTMLElement>;
  id: string;
}

function addId(el: HTMLElement, id: string): void {
  const existing = el.getAttribute('aria-describedby');
  if (!existing?.split(/\s+/).includes(id)) {
    el.setAttribute('aria-describedby', mergeIds(existing, id) ?? '');
  }
}

// Removes only this tooltip's id, so an aria-describedby that React or the
// caller set after attach survives the detach.
function removeId(el: HTMLElement, id: string): void {
  const rest = (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(token => token !== '' && token !== id);
  if (rest.length > 0) {
    el.setAttribute('aria-describedby', rest.join(' '));
  } else {
    el.removeAttribute('aria-describedby');
  }
}

/**
 * Tooltip component for displaying informative text on hover/focus.
 *
 * Uses inverted colors (dark background, light text) for high contrast.
 * Uses a display:contents wrapper so children refs are preserved.
 * Uses CSS anchor positioning and the Popover API for optimal performance.
 *
 * @example
 * ```
 * <Tooltip content="Helpful tooltip text" placement="above">
 *   <Button>Hover me</Button>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  children,
  anchorRef,
  content,
  placement = 'above',
  alignment = 'center',
  delay = 200,
  hideDelay = 0,
  focusTrigger = 'auto',
  touchTrigger = 'auto',
  isEnabled = true,
  onOpenChange,
  hasHoverIndication = 'auto',
  isOpen,
  isDefaultOpen,
}: TooltipProps): ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textOnly = children != null ? isTextOnly(children) : false;

  // Determine if hover indication should be shown
  const showHoverIndication =
    hasHoverIndication === true || (hasHoverIndication === 'auto' && textOnly);

  const handleShow = useCallback(() => {
    onOpenChange?.(true);
  }, [onOpenChange]);

  const handleHide = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Use the hook for all tooltip behavior
  const tooltip = useTooltip({
    placement,
    alignment,
    delay,
    hideDelay,
    focusTrigger,
    touchTrigger,
    isEnabled,
    isOpen,
    isDefaultOpen,
    onShow: handleShow,
    onHide: handleHide,
  });

  // Sibling mode: attach to external anchorRef
  useIsomorphicLayoutEffect(() => {
    if (!anchorRef) {
      return;
    }

    const attach = (el: HTMLElement) => {
      // Use combined ref for position + interaction
      tooltip.ref(el);

      // Set aria-describedby, merging with existing
      const existingDescribedBy = el.getAttribute('aria-describedby');
      el.setAttribute(
        'aria-describedby',
        mergeIds(existingDescribedBy, tooltip.describedBy) ?? '',
      );

      return () => {
        tooltip.ref(null);
        if (existingDescribedBy) {
          el.setAttribute('aria-describedby', existingDescribedBy);
        } else {
          el.removeAttribute('aria-describedby');
        }
      };
    };

    const el = anchorRef.current;
    if (el) {
      return attach(el);
    }

    // React attaches an ancestor's ref after its descendants' layout effects,
    // so a tooltip rendered inside its own anchor (SideNavItem's collapsed
    // rail tooltip) still sees null here on mount, and this effect's deps
    // never change to re-run it. Re-check once the commit has attached all
    // refs; if the anchor is still gone, this tooltip has no anchor, as before.
    let detach: (() => void) | undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      const el = anchorRef.current;
      if (el) {
        detach = attach(el);
      }
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [anchorRef, tooltip.ref, tooltip.describedBy]);

  // Element children: the display:contents wrapper's first element child is
  // the trigger. A re-render can swap that element or rewrite its
  // aria-describedby, so the trigger is re-checked after each commit. A child
  // component can do the same without this component rendering, so a
  // MutationObserver re-checks on those changes too.
  const tooltipRef = tooltip.ref;
  const describedBy = tooltip.describedBy;
  const attachedRef = useRef<AttachedTrigger | null>(null);

  const detachTrigger = useCallback(() => {
    const attached = attachedRef.current;
    if (attached) {
      attachedRef.current = null;
      attached.ref(null);
      removeId(attached.el, attached.id);
    }
  }, []);

  const syncTrigger = useCallback(() => {
    if (anchorRef || textOnly) {
      return;
    }
    const next =
      (wrapperRef.current?.firstElementChild as HTMLElement | null) ?? null;
    const attached = attachedRef.current;
    if (
      attached &&
      (attached.el !== next ||
        attached.ref !== tooltipRef ||
        attached.id !== describedBy)
    ) {
      detachTrigger();
    }
    if (!next) {
      return;
    }
    if (!attachedRef.current) {
      // Use combined ref for position + interaction
      tooltipRef(next);
      attachedRef.current = {el: next, ref: tooltipRef, id: describedBy};
    }
    addId(next, describedBy);
  }, [anchorRef, textOnly, tooltipRef, describedBy, detachTrigger]);

  // The cleanup runs before React attaches refs, so a switch to text-only or
  // anchorRef mode detaches here before the new trigger attaches.
  useIsomorphicLayoutEffect(() => {
    if (anchorRef || textOnly) {
      return;
    }
    return detachTrigger;
  }, [anchorRef, textOnly, detachTrigger]);

  // No dependency list: each commit can replace the child or its attributes.
  useIsomorphicLayoutEffect(() => {
    syncTrigger();
  });

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof MutationObserver === 'undefined') {
      return;
    }
    const observer = new MutationObserver(syncTrigger);
    observer.observe(wrapper, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-describedby'],
    });
    return () => observer.disconnect();
  }, [syncTrigger]);

  // Sibling mode: render only the tooltip (no wrapper needed)
  if (anchorRef && children == null) {
    return <>{tooltip.renderTooltip(content)}</>;
  }

  // For text-only children: use inline span with ref on wrapper
  if (textOnly) {
    return (
      <>
        <span
          ref={tooltip.ref}
          tabIndex={0}
          aria-describedby={tooltip.describedBy}
          // The span is a tab stop Astryx adds: it draws the shared ring,
          // which a theme restyles through the focus-outline tokens.
          {...focusOutlineProps.focusVisible(
            styles.wrapperInline,
            showHoverIndication && styles.hoverIndication,
          )}>
          {children}
        </span>
        {tooltip.renderTooltip(content)}
      </>
    );
  }

  // For element children: use display:contents, ref on first child
  return (
    <>
      <div ref={wrapperRef} {...stylex.props(styles.wrapperContents)}>
        {children}
      </div>
      {tooltip.renderTooltip(content)}
    </>
  );
}

Tooltip.displayName = 'Tooltip';
