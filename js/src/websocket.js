/*
  Creates a websocket which can reconnect on errors.
  It doesn't expose WebSocket object since it should be recreated each
  time an error occurs, but exposes send and close methods.
  Reconnect stops when you close the websocket.

*/
var emitter = require('./emitter')

var WS = window.MozWebSocket || window.WebSocket

var handlers = [
  {name: 'onopen', event: 'connect'},
  {name: 'onerror', event: 'error'},
  {name: 'onclose', event: 'disconnect'},
  {name: 'onmessage', event: 'message'}
]

function handle (ws, emitter) {
  handlers.forEach(function (o) {
    ws[o.name] = function (evt) {
      emitter.emit(o.event, evt)
    }
  })
}

module.exports = function (url) {
  var self = emitter()
  var ws, tid

  function create () {
    if (ws) {
      ws = null
    }
    ws = new WS(url)
    ws.binaryType = 'arraybuffer'
    handle(ws, self)
    self.send = function (data) {
      ws.send(data)
    }
    self.close = function (code, reason) {
      clearTimeout(tid)
      ws.close(code, reason)
    }
  }

  create()

  self.on('error', function () {
    tid = setTimeout(create, 5000)
  })

  return self
}
