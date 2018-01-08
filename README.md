# uploader
Uploads files via WebSocket API

Features:
* Uses native WebSocket object of the browser
* Uploads multiple files sequentially
* Uploads big files by chunks
* Sends files as binary data
* Reconnects on connection errors
* Event-based notification for UI: `["progress", "done", "failed"]`
* Doesn't resend file on an error

[Live demo](https://dmitrymyadzelets.github.io/uploader/)


To see how it handles the errors you may interrupt the network connection and delete a file while uploading.

Note: no server is provided by this project, a public echo server is used for the demo.
