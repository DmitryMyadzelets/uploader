/*
  Creates a websocket which can reconnect on errors.
  It doesn't expose WebSocket object since it should be recreated each
  time an error occurs, but exposes 'send' and 'close' methods.
  The return value of 'send' and 'close' methods should be ignored.
  Reconnect stops when you close the websocket.

  The WebSocket may emit 'onclose' event regardless its previous state,
  i.e. if it wasn't open before.
  This websocket emits 'connect' and 'disconnect' events upon its state.
  The 'error' event is emitted when it's in connected state only.
*/
var emitter = require('./emitter')

var WS = window.MozWebSocket || window.WebSocket

module.exports = function (url) {
  var self = emitter()
  var ws, tid, connected

  function onopen () {
    connected = true
    self.emit('connect')
  }

  function onclose () {
    if (connected) {
      self.emit('disconnect')
    }
    connected = false
  }

  function onmessage (evt) {
    self.emit('message', evt.data)
  }

  function onerror (err) {
    tid = setTimeout(create, 5000)
    if (connected) {
      self.emit('error', err)
    }
  }

  function create () {
    if (ws) {
      ws = null
    }
    ws = new WS(url)
    ws.binaryType = 'arraybuffer'
    // Events handlers
    ws.onopen = onopen
    ws.onclose = onclose
    ws.onerror = onerror
    ws.onmessage = onmessage
  }

  self.send = function (data) {
    return ws && ws.send(data)
  }

  self.close = function (code, reason) {
    clearTimeout(tid)
    return ws && ws.close(code, reason)
  }

  self.open = function () {
    if (!connected) {
      create()
    }
  }

  create()

  return self
}
