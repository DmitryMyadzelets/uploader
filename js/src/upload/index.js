var reader = require('./reader')
var emitter = require('./emitter')
var reconnect = require('./reconnect')

// Unique ID generator
var uid = (function () {
  var id = 0
  return function () {
    id += 1
    return id
  }
}())

/*
  The module has three states: {initial, reading and sending}.
  The busy (reading and sending) state is composed of two values: {meta, read}.
  {meta} states for sending file's meta information in JSON format.
  {read} implies reading and sending the file's content as binary data.

  The module emits events: {connect, disconnect, progress, done, failed}
*/

module.exports = function (url) {
  var self, ws, connected, read, progress, next, file, meta
  var queue = []

  function error (err) {
    self.emit('error', err)
  }

  function fail () {
    read = null
    meta = null
    self.emit('failed', queue.shift())
  }

  // Entry point for the read-send process
  function check () {
    if (connected && !(read || meta)) {
      if (queue.length > 0) {
        file = queue[0].file
        meta = JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type
        })
        ws.send(meta)
      }
    }
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

  function onmessage (message) {
    self.emit('progress', progress)
      // TODO: check the message
    if (meta) {
      meta = null
      try {
        var o = JSON.parse(message.data)
        if (o.error) {
          throw new Error(o.error.message)
        }
        read = reader(file, onchunk)
        read()
      } catch (err) {
        error(err)
        fail()
        check()
      }
    } else {
      if (next) {
        read()
      } else {
        read = null
        self.emit('done', queue.shift())
        check()
      }
    }
  }

  reconnect(url, function (err, websocket) {
    ws = websocket
    ws.onopen = onopen
    ws.onclose = onclose
    ws.onmessage = onmessage
    ws.binaryType = 'arraybuffer'
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
