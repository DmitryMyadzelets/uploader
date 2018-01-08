/* global d3 */

var ready = require('./ready')
var emitter = require('./upload/emitter')
var upload = require('./upload')('wss://echo.websocket.org')

var events = emitter()
var queue = []
var uploaded = []
var failed = []

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

  // logic

  events.on('file', function (file) {
    var o = upload(file)
    queue.push(o)
    view()
  })

  upload
    .on('progress', progress)
    .on('connect', status.bind(null, true))
    .on('disconnect', status.bind(null, false))
    .on('done', function (o) {
      uploaded.push(queue.pop())
      view()
    })
    .on('failed', function (o) {
      failed.push(queue.pop())
      view()
    })
    .on('error', function (err) {
      console.error('error', err)
    })
})
