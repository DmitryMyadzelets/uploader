(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){

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
  o.emit = emit
  o.events = {}
  return o
}

},{}],3:[function(require,module,exports){
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
    // Expect JSON if data is a string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
        // If server has sent an error
        if (data.error) {
          throw new Error(data.error.message)
        }
      } catch (err) {
        error(err)
        fail()
        check()
        return
      }
    }

    self.emit('progress', progress)
    if (meta) {
      meta = null
      read = reader(file, onchunk)
      read()
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

},{"./emitter":2,"./reader":4,"./websocket":5}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{"./emitter":2}],6:[function(require,module,exports){
/* global d3 */

var ready = require('./ready')
var emitter = require('./upload/emitter')
// var upload = require('./upload')('wss://echo.websocket.org')
// var upload = require('./upload')('wss://piazzarussa.ru/api/pic/')
var upload = require('./upload')('wss://127.0.0.1/api/pic/')

var events = emitter()
var queue = []
var failed = []
var uploaded = []

function expectFiles (el, callback) {
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

  upload
    .on('progress', progress)
    .on('error', function (err) {
      console.log(err)
    })
  upload.websocket
    .on('connect', status.bind(null, true))
    .on('disconnect', status.bind(null, false))

  // logic

  events.on('file', function (file) {
    var o = upload(file)
    queue.push(o)
    view()
  })

  function unqueue (a) {
    var i = queue.findIndex(function key (b) {
      return a.id === b.id
    })
    return queue.splice(i, 1)[0]
  }

  upload
    .on('done', function (o) {
      console.log('done', o)
      uploaded.push(unqueue(o))
      view()
    })
    .on('failed', function (o) {
      console.log('failed', o)
      failed.push(unqueue(o))
      view()
    })
})

},{"./ready":1,"./upload":3,"./upload/emitter":2}]},{},[6]);
