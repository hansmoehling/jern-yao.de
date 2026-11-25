(function () {
  'use strict';
  if (new URL(window.location.href).searchParams.get('embedded') !== '1' || window.parent === window) return;
  document.documentElement.classList.add('jy-embedded');
  let lastHeight = 0;
  const resize = () => {
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    if (height === lastHeight || height < 100) return;
    lastHeight = height;
    window.parent.postMessage({ type: 'jy-module-height', height }, window.location.origin);
  };
  new ResizeObserver(resize).observe(document.body);
  window.addEventListener('load', resize);
  resize();
})();
