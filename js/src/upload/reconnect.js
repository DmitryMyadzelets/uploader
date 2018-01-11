// Invokes the callback on socket's errors

var WS = window.MozWebSocket || window.WebSocket

module.exports = function (url, callback) {
  var ws

  function connect () {
    ws = new WS(url)
    ws.onerror = onerror
    callback(null, ws)
  }

  function onerror (err) {
    callback(err, ws)
    setTimeout(connect, 5000)
  }

  connect()
}
