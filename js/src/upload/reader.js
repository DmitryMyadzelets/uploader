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
