(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

function on (event, fun) {
  if (this.events[event]) {
    this.events[event].push(fun)
  } else {
    this.events[event] = [fun]
  }
  return this
}

function emit (event, o) {
  if (this.events[event]) {
    var i
    var m = this.events[event].length | 0
    for (i = 0; i < m; i += 1) {
      this.events[event][i].call(this, o)
    }
  }
}

module.exports = function (o) {
  o = o || {}
  o.on = on
  o.emit = function () {
    var args = arguments
    setTimeout(function () {
      emit.apply(o, args)
    })
  }
  o.events = {}
  return o
}

},{}],2:[function(require,module,exports){
/* global FileReader */

function unlock (fun) {
  return function () {
    var args = arguments
    setTimeout(function () {
      fun.apply(null, args)
    })
  }
}

// Returns a function to read a chunk
// Increments automatially
// You can pass the size of the chunk to read, ~100kB by default
// callback: function (err, chunk, next)
module.exports = function (file, callback) {
  // To avoid locking
  callback = unlock(callback)

  var reader = new FileReader()
  var size = file.size
  var max = 100000 // maximum number of bytes to read
  var start = 0
  var end
  var locked = false
  var slice = file.webkitSlice || file.mozSlice || file.slice

  // Reads n bytes from the file
  function chunk (n) {
    if (locked) {
      return
    }
    locked = true
    if (start < size) {
      max = n || max
      end = start + max
      if (end >= size) {
        end = size // last chunk
      }
      // note, the start is inclusive, the end is exclusive
      reader.readAsArrayBuffer(slice.call(file, start, end))
    } else {
      callback(null, {size: size, start: end, end: end}, chunk)
    }
  }

  reader.onerror = callback

  // Invoked when the reading of a chunk of the file is done
  reader.onloadend = function (evt) {
    if (evt.target.error) {
      return callback(evt.target.error)
    }
    callback(null, {size: size, start: start, end: end, data: reader.result}, chunk)
    // calculate next chunk offset
    start += max
    locked = false
  }

  return chunk
}

},{}],3:[function(require,module,exports){
/* global window */

// Invokes callback when DOM is ready for manipulation
module.exports = function (callback) {
  // Motivation:
  // https://gomakethings.com/a-native-javascript-equivalent-of-jquerys-ready-method/
  // Docs:
  // https://developer.mozilla.org/en/docs/Web/API/Document/readyState
  var loading, done

  done = function () {
    document.removeEventListener('readystatechange', loading)
    window.removeEventListener('load', done)
    callback()
  }

  loading = function () {
    if (document.readyState === 'loading') {
      return true
    }
    done()
  }

  if (loading()) {
    document.addEventListener('readystatechange', loading)
    window.addEventListener('load', done)
  }
}

},{}],4:[function(require,module,exports){
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

},{"./emitter":1,"./reader":2}],5:[function(require,module,exports){
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

  self.connected = function () {
    return connected
  }

  create()

  return self
}

},{"./emitter":1}],6:[function(require,module,exports){
/* global d3 */

var ready = require('./ready')
// var reader = require('./reader')
var emitter = require('./emitter')
var websocket = require('./websocket')
var sender = require('./upload')

var events = emitter()
var queue = []
var uploaded = []
var failed = []
var uid = (function () {
  var id = 0
  return function () {
    id += 1
    return id
  }
}())

function expectFiles (el) {
  el.addEventListener('change', function () {
    var files = el.files
    var i = files.length
    while (i > 0) {
      i -= 1
      events.emit('file', files[i])
    }
  })
}

// function elapsed (msec) {
//   var sec = msec / 1000 | 0
//   msec -= sec * 1000
//   return sec + ':' + msec
// }

var view = (function () {
  function key (d) {
    return d.id
  }
  function update (id, data) {
    var update = d3.select(id).selectAll('li').data(data, key)
    update.exit().remove()
    update.enter().append('li')
      .text(function (d) {
        return d.file.name
      })
  }
  return function () {
    update('#queued', queue)
    update('#uploaded', uploaded)
    update('#failed', failed)
  }
}())

ready(function () {
  // view

  expectFiles(document.getElementById('file-input'))
  var progress = (function (el) {
    return function (fraction) {
      el.style.width = (fraction * 100) + '%'
    }
  }(document.getElementById('bar')))
  progress(0)

  function status (ok) {
    d3.select('#status')
      .text(ok ? 'Connected' : 'Disconnected')
      .classed('connected', ok)
  }
  status()

  // logic

  var ws = websocket('wss://echo.websocket.org')
  var send = sender(ws)

  function check () {
    if (ws.connected() && send.ready()) {
      if (queue.length > 0) {
        send(queue[0].file)
      }
    }
    view()
  }

  ws
    .on('connect', function () {
      check()
    })
    .on('connect', status.bind(null, true))
    .on('disconnect', status.bind(null, false))

  send
    .on('progress', progress)
    .on('done', function () {
      uploaded.push(queue.shift())
      check()
    })
    .on('error', function (err) {
      console.warn(err)
      failed.push(queue.shift())
      check()
    })

  events.on('file', function enqueue (file) {
    queue.push({
      file: file,
      id: uid()
    })
    check()
  })
})

},{"./emitter":1,"./ready":3,"./upload":4,"./websocket":5}]},{},[6]);
