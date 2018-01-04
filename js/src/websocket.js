var emitter = require('./emitter')

var WS = window.MozWebSocket || window.WebSocket

var events = [
  {name: 'onopen', event: 'connect'},
  {name: 'onerror', event: 'error'},
  {name: 'onclose', event: 'disconnect'},
  {name: 'onmessage', event: 'message'}
]

function hook (ws, emitter) {
  events.forEach(function (o) {
    ws[o.name] = function (evt) {
      emitter.emit(o.event, evt)
    }
  })
}

module.exports = function (url) {
  var self = emitter()
  var ws

  function create () {
    ws = new WS(url)
    ws.binaryType = 'arraybuffer'
    hook(ws, self)
    self.send = ws.send.bind(ws)
    self.close = ws.close.bind(ws)
  }

  create()

  self.on('error', function () {
    setTimeout(create, 5000)
  })

  return self
}
