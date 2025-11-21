import { renderer } from 'src/backends/webgl2';

const version = import.meta.env.VITE_APP_VERSION;
console.log(`Version ${version}`);

const initTime = performance.now();

const canvasElement = document.querySelector('canvas');
if (!canvasElement) throw 'No canvasElement';

renderer(canvasElement)
    .then(requestAnimationFrame)
    .catch(console.error)
    .finally(() => console.log(`Ready in ${(performance.now() - initTime).toFixed(3)}ms`));
