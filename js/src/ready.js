/* global window */

// Invokes callback when DOM is ready for manipulation
module.exports = function (callback) {
  // Motivation:
  // https://gomakethings.com/a-native-javascript-equivalent-of-jquerys-ready-method/
  // Docs:
  // https://developer.mozilla.org/en/docs/Web/API/Document/readyState
  var loading, done

  done = function () {
    document.removeEventListener('readystatechange', loading)
    window.removeEventListener('load', done)
    callback()
  }

  loading = function () {
    if (document.readyState === 'loading') {
      return true
    }
    done()
  }

  if (loading()) {
    document.addEventListener('readystatechange', loading)
    window.addEventListener('load', done)
  }
}
