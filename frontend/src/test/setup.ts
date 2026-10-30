import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// `findBy…` and `waitFor` give up after 1 s by default, which a busy machine can
// exceed without anything being wrong; a real failure still fails, just a bit later.
configure({ asyncUtilTimeout: 5000 });

/**
 * jsdom does not implement the `<dialog>` methods. This is the smallest model
 * of what the browser does that the tests rely on: `showModal` makes the
 * dialog open (and so visible to the queries) and `close` closes it and fires
 * the `close` event. Focus trapping and the Escape key are the browser's job;
 * the tests fire the `cancel` event that Escape produces.
 */
HTMLDialogElement.prototype.showModal = function showModal(
  this: HTMLDialogElement,
): void {
  this.setAttribute('open', '');
};

HTMLDialogElement.prototype.close = function close(
  this: HTMLDialogElement,
): void {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

/**
 * jsdom has no `URL.createObjectURL`. The previews only need a unique string
 * back and to know when it is revoked, so this model returns `blob:test-N` and
 * leaves the revoking to be spied on.
 */
let objectUrls = 0;
URL.createObjectURL = () => `blob:test-${(objectUrls += 1)}`;
URL.revokeObjectURL = () => undefined;
