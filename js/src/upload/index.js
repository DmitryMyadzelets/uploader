var reader = require('./reader')
var emitter = require('./emitter')
var reconnect = require('./reconnect')

var uid = (function () {
  var id = 0
  return function () {
    id += 1
    return id
  }
}())

module.exports = function (url) {
  var self, ws, connected, read, progress, next
  var queue = []

  function error (err) {
    self.emit('error', err)
  }

  function fail () {
    read = null
    self.emit('failed', queue.shift())
  }

  function onchunk (err, chunk) {
    if (err) {
      error(err)
      fail()
      return check()
    }
    progress = chunk.end / chunk.size
    next = chunk.end < chunk.size
    ws.send(chunk.data)
  }

  function check () {
    if (connected && !read) {
      if (queue.length > 0) {
        read = reader(queue[0].file, onchunk)
        read()
      }
    }
  }

  function onopen () {
    connected = true
    self.emit('connect')
    check()
  }

  function onclose () {
    connected = false
    self.emit('disconnect')
    if (read) {
      error(new Error('Disconnected while uploading'))
      fail()
    }
  }

  function onmessage () {
    self.emit('progress', progress)
      // TODO: check the message
    if (next) {
      read()
    } else {
      read = null
      self.emit('done', queue.shift())
      check()
    }
  }

  reconnect(url, function (err, websocket) {
    ws = websocket
    ws.onopen = onopen
    ws.onclose = onclose
    ws.onmessage = onmessage
    return err && read && error(err)
  })

  self = function (file) {
    var o = {
      file: file,
      id: uid()
    }
    queue.push(o)
    check()
    return o
  }

  return emitter(self)
}
