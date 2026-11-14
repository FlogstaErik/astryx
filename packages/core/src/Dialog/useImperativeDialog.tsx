// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file useImperativeDialog.tsx
 * @input Uses React, Dialog
 * @output Exports useImperativeDialog hook
 * @position Utility hook; wraps Dialog with imperative show/hide API
 *
 * Eliminates boilerplate for dialogs that don't need controlled state.
 * Instead of managing isOpen + content state, call show() with content
 * and the dialog handles the rest.
 *
 * @example
 * ```
 * const dialog = useImperativeDialog();
 * <button onClick={() => dialog.show(<MyContent />)}>Open</button>
 * {dialog.element}
 * ```
 */

import {useState, useCallback, useMemo, type ReactNode} from 'react';
import {Dialog, type DialogProps} from './Dialog';

type DialogOptions = Omit<DialogProps, 'isOpen' | 'onOpenChange' | 'children'>;

export interface ImperativeDialogReturn {
  /** Show the dialog with the given content. */
  show: (content: ReactNode, options?: DialogOptions) => void;
  /** Hide the dialog. */
  hide: () => void;
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Render this in your JSX tree. */
  element: ReactNode;
}

/**
 * Imperative dialog — show/hide without managing state.
 *
 * @example
 * ```
 * const dialog = useImperativeDialog();
 * onClick={() => dialog.show(
 *   <CodeBlock code={output} language="bash" />
 * )}
 * return <>{dialog.element}</>;
 * ```
 */
export function useImperativeDialog(
  defaultOptions?: DialogOptions,
): ImperativeDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  // Options from the latest show() call only. Each call replaces them, so
  // one call's options never leak into the next. The current defaultOptions
  // apply beneath them on every render.
  const [options, setOptions] = useState<DialogOptions | undefined>();

  const show = useCallback(
    (newContent: ReactNode, newOptions?: DialogOptions) => {
      setContent(newContent);
      setOptions(newOptions);
      setIsOpen(true);
    },
    [],
  );

  const hide = useCallback(() => {
    setIsOpen(false);
  }, []);

  const element = useMemo(
    () => (
      <Dialog
        isOpen={isOpen}
        onOpenChange={open => {
          if (!open) {
            setIsOpen(false);
          }
        }}
        {...(defaultOptions ?? {})}
        {...(options ?? {})}>
        {content}
      </Dialog>
    ),
    [isOpen, content, options, defaultOptions],
  );

  return {show, hide, isOpen, element};
}
