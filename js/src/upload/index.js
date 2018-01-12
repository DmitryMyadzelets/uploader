var reader = require('./reader')
var emitter = require('./emitter')
var websocket = require('./websocket')

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

  The module emits events: {progress, done, failed}
*/

module.exports = function (url) {
  var self, read, progress, next, file, meta
  var ws = websocket(url)
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
    if (ws.open() && !(read || meta)) {
      if (queue.length > 0) {
        file = queue[0].file
        meta = JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type
        })
        ws.send(meta)
      } else {
        ws.close()
      }
    }
  }

  ws.on('connect', check)

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

  ws.on('disconnect', function () {
    if (read) {
      error(new Error('Disconnected while uploading'))
      fail()
    }
  })

  ws.on('message', function (data) {
    self.emit('progress', progress)
      // TODO: check the message
    if (meta) {
      meta = null
      try {
        var o = JSON.parse(data)
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

  self.websocket = ws

  return emitter(self)
}
