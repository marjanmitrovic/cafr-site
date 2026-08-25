(() => {
  'use strict';

  const nativeSetInterval = window.setInterval.bind(window);

  window.setInterval = (handler, timeout, ...args) => {
    let effectiveTimeout = timeout;

    if (
      timeout === 30000 &&
      typeof handler === 'function' &&
      Function.prototype.toString.call(handler).includes('refreshCurrentUser')
    ) {
      effectiveTimeout = 5 * 60 * 1000;
    }

    return nativeSetInterval(handler, effectiveTimeout, ...args);
  };
})();
