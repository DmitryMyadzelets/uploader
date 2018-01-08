# uploader
Uploads files via WebSocket API

Features:
* Uploads multiple files sequentially
* Uploads big files by chunks
* Reconnects on connection errors
* Event-based notification: [progress, done, failed]
* Doesn't resend file on an error

[Live demo](https://dmitrymyadzelets.github.io/uploader/)

To see how it handles the errors you may interrupt the network connection and delete a file while uploading.