/*
  Reads, chunks and sends one file via websocket.
  Emits events: ['progress', 'done', 'error'].
*/

var reader = require('./reader')
var emitter = require('./emitter')

module.exports = function (ws) {
  var self, read, progress, next

  function error (err) {
    read = null
    self.emit('error', err)
  }

  ws
    .on('message', function (message) {
      self.emit('progress', progress)
      // TODO: check the message
      if (next) {
        read()
      } else {
        read = null
        self.emit('done')
      }
    })
    .on('error', function () {
      if (read) {
        error(new Error('Upload failed due to websocket error'))
      }
    })

  function onchunk (err, chunk) {
    if (err) {
      return error(err)
    }
    progress = chunk.end / chunk.size
    next = chunk.end < chunk.size
    ws.send(chunk.data)
  }

  self = function (file) {
    read = reader(file, onchunk)
    read()
  }

  self.ready = function () {
    return !read
  }

  return emitter(self)
}
