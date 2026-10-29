import './ui/style.css';
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
if (params.get('view') === 'car') {
  import('./viewer.js').then((m) => m.runViewer(canvas, params));
} else {
  import('./game/boot.js').then((m) => m.boot(canvas, params));
}
