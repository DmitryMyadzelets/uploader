/* global d3 */

var ready = require('./ready')
var reader = require('./reader')
var emitter = require('./emitter')
var websocket = require('./websocket')

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

  events
    .on('begin', function () {
      progress(0)
    })
    .on('chunk', function (chunk) {
      progress(chunk.end / chunk.size)
    })

  function status (ok) {
    d3.select('#status')
      .text(ok ? 'Connected' : 'Disconnected')
      .classed('connected', ok)
  }
  status()

  // File read and send logic

  var ws = websocket('wss://echo.websocket.org')
  ws
    .on('connect', status.bind(null, true))
    .on('disconnect', status.bind(null, false))
    .on('message', events.emit.bind(events, 'message'))
    .on('connect', function () {
      if (queue.length > 0) {
        events.emit('upload')
      }
    })
    .on('disconnect', function () {
      if (queue.length > 0) {
        events.emit('failed')
      }
    })

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
