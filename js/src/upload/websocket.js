/*
  Creates a websocket which can reconnect on errors.
  It doesn't expose WebSocket object since it should be recreated each
  time an error occurs, but exposes 'send' and 'close' methods.
  The return value of 'send' and 'close' methods should be ignored.
  Reconnect stops when you close the websocket.

  The WebSocket may invokes 'onclose' event regardless its previous state,
  i.e. if it wasn't open before.
  This websocket emits 'connect' and 'disconnect' events upon its state.
*/

var emitter = require('./emitter')
var WS = window.MozWebSocket || window.WebSocket

var states = []
states[WS.CONNECTING] = 'connecting'
states[WS.OPEN] = 'connect'
states[WS.CLOSING] = 'disconnecting'
states[WS.CLOSED] = 'disconnect'

function isObject (o) { return typeof o === 'object' && o !== null }

module.exports = function (url, opt) {
  var ws, tid, ost
  var self = emitter()
  if (!isObject(opt)) {
    opt = {}
  }

  function state () {
    if (ws && (ost !== ws.readyState)) {
      self.emit(states[ost = ws.readyState])
    }
    return ws && ws.readyState
  }

  function repair () {
    tid = setTimeout(create, 5000)
  }

  function onerror (err) {
    self.emit('error', err)
  }

  function onclose (evt) {
    if (!evt.wasClean) {
      repair()
    }
    state()
  }

  function onmessage (evt) {
    self.emit('message', evt.data)
  }

  function create () {
    ws = new WS(url)
    ws.onopen = state
    ws.onerror = onerror
    ws.onclose = onclose
    ws.onmessage = onmessage
    ws.binaryType = 'arraybuffer'
  }

  self.send = function (message) {
    return ws && ws.send(message)
  }

  self.close = function (code, reason) {
    clearTimeout(tid)
    return ws && ws.close(code || 1000, reason)
  }

  self.open = function () {
    if (!ws || (ws && (ws.readyState === WS.CLOSED))) {
      create()
    }
    return ws && (ws.readyState === WS.OPEN)
  }

  self.connected = function () {
    return ws && (ws.readyState === WS.OPEN)
  }

  if (!opt.disconnected) {
    self.open()
  }

  return self
}
