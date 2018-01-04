/*
  Creates websocket which can reconnect on errors.
  It doesn't expose WebSocket object since it should be recreated each
  time an error occures, but exposes send and close methods.
  Exposes

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

function unhandle (ws) {
  handlers.forEach(function (o) {
    ws[o.name] = null
  })
}

module.exports = function (url) {
  var self = emitter()
  var ws

  function create () {
    if (ws) {
      unhandle(ws)
      ws = null
    }
    ws = new WS(url)
    ws.binaryType = 'arraybuffer'
    handle(ws, self)
    self.send = function (data) {
      ws.send(data)
    }
    self.close = function (code, reason) {
      ws.close(code, reason)
    }
  }

  create()

  self.on('error', function () {
    setTimeout(create, 5000)
  })

  return self
}
