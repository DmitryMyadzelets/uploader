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
