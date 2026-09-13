// Run inside the preview's window. A handler created by Studio stops running
// when that opener navigates or Vite reloads it, leaving a dead print button.
const button = document.querySelector('[data-print-preview]');
if (button) {
  button.addEventListener('click', () => {
    window.focus();
    window.print();
  });
  button.disabled = false;
}
