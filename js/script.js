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
  o.emit = emit
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
/* global WebSocket, d3 */

var ready = require('./ready')
var reader = require('./reader')
var emitter = require('./emitter')

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

function websocket (url) {
  var ws = new WebSocket(url, 'json')
  ws.binaryType = 'arraybuffer'

  ws.onopen = events.emit.bind(events, 'connect')
  ws.onclose = events.emit.bind(events, 'disconnect')
  ws.onmessage = events.emit.bind(events, 'message')
  ws.onerror = console.error.bind(console)

  return ws
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

  events
    .on('begin', function () {
      progress(0)
    })
    .on('chunk', function (chunk) {
      progress(chunk.end / chunk.size)
    })

  // File read and send logic

  var ws = websocket('wss://echo.websocket.org')

  events.on('file', function enqueue (file) {
    queue.push({
      file: file,
      id: uid()
    })
    if (queue.length === 1) {
      events.emit('upload')
    }
  })
  events.on('file', view)

  function onchunk (err, chunk) {
    if (err) {
      return events.emit('failed')
    }
    events.emit('chunk', chunk)
  }

  events.on('upload', function () {
    var q = queue[0]
    q.read = reader(q.file, onchunk)
    q.read()
    events.emit('begin', q)
  })

  events.on('chunk', function (chunk) {
    ws.send(chunk.data)
    queue[0].next = chunk.end < chunk.size
  })

  events.on('message', function (message) {
    var q = queue[0]
    if (q.next) {
      q.read()
    } else {
      events.emit('end', q)
    }
  })

  events
    .on('end', function () {
      uploaded.push(queue.shift())
      if (queue.length > 0) {
        events.emit('upload')
      }
    })
    .on('failed', function () {
      failed.push(queue.shift())
      if (queue.length > 0) {
        events.emit('upload')
      }
    })

  events.on('end', view)
  events.on('failed', view)
})

},{"./emitter":1,"./reader":2,"./ready":3}]},{},[4]);
