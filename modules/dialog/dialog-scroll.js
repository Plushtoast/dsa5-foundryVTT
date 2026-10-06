export function makeDialogContentScrollable(dialog) {
  const form = dialog?.element?.querySelector('form');
  const content = form?.querySelector('.dialog-content');
  if (!form || !content) {
    throw new Error('Cannot make dialog content scrollable: expected a form with .dialog-content');
  }

  form.style.overflowY = 'hidden';
  content.classList.add('scrollable');
}
