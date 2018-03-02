!function e(n,t,r){function o(u,c){if(!t[u]){if(!n[u]){var s="function"==typeof require&&require
if(!c&&s)return s(u,!0)
if(i)return i(u,!0)
var a=new Error("Cannot find module '"+u+"'")
throw a.code="MODULE_NOT_FOUND",a}var f=t[u]={exports:{}}
n[u][0].call(f.exports,function(e){var t=n[u][1][e]
return o(t||e)},f,f.exports,e,n,t,r)}return t[u].exports}for(var i="function"==typeof require&&require,u=0;u<r.length;u++)o(r[u])
return o}({1:[function(e,n,t){n.exports=function(e){var n,t
t=function(){document.removeEventListener("readystatechange",n),window.removeEventListener("load",t),e()},(n=function(){if("loading"===document.readyState)return!0
t()})()&&(document.addEventListener("readystatechange",n),window.addEventListener("load",t))}},{}],2:[function(e,n,t){function r(e,n){return this.events[e]?this.events[e].push(n):this.events[e]=[n],this}function o(e,n){if(this.events[e]){var t,r=0|this.events[e].length
for(t=0;t<r;t+=1)this.events[e][t].call(this,n)}}n.exports=function(e){return e=e||{},e.on=r,e.emit=o,e.events={},e}},{}],3:[function(e,n,t){var r=e("./reader"),o=e("./emitter"),i=e("./websocket"),u=function(){var e=0
return function(){return e+=1}}()
n.exports=function(e){function n(e){a.emit("error",e)}function t(){f=null,m=null,a.emit("failed",h.shift())}function c(){!v.open()||f||m||(h.length>0?(p=h[0].file,m=JSON.stringify({name:p.name,size:p.size,type:p.type}),v.send(m)):v.close())}function s(e,r){if(e)return n(e),t(),c()
d=r.end/r.size,l=r.end<r.size,v.send(r.data)}var a,f,d,l,p,m,v=i(e),h=[]
return v.on("connect",c),v.on("disconnect",function(){f&&(n(new Error("Disconnected while uploading")),t())}),v.on("message",function(e){if("string"==typeof e)try{if(e=JSON.parse(e),e.error)throw new Error(e.error.message)}catch(e){return n(e),t(),void c()}a.emit("progress",d),m?(m=null,(f=r(p,s))()):l?f():(f=null,a.emit("done",h.shift()),c())}),a=function(e){var n={file:e,id:u()}
return h.push(n),c(),n},a.websocket=v,o(a)}},{"./emitter":2,"./reader":4,"./websocket":5}],4:[function(e,n,t){function r(e){return function(){var n=arguments
setTimeout(function(){e.apply(null,n)})}}n.exports=function(e,n){function t(r){a||(a=!0,s<u?(c=r||c,o=s+c,o>=u&&(o=u),i.readAsArrayBuffer(f.call(e,s,o))):n(null,{size:u,start:o,end:o},t))}n=r(n)
var o,i=new FileReader,u=e.size,c=1e5,s=0,a=!1,f=e.webkitSlice||e.mozSlice||e.slice
return i.onerror=n,i.onloadend=function(e){if(e.target.error)return n(e.target.error)
n(null,{size:u,start:s,end:o,data:i.result},t),s+=c,a=!1},t}},{}],5:[function(e,n,t){function r(e){return"object"==typeof e&&null!==e}var o=e("./emitter"),i=window.MozWebSocket||window.WebSocket,u=[]
u[i.CONNECTING]="connecting",u[i.OPEN]="connect",u[i.CLOSING]="disconnecting",u[i.CLOSED]="disconnect",n.exports=function(e,n){function t(){return l&&m!==l.readyState&&v.emit(u[m=l.readyState]),l&&l.readyState}function c(){p=setTimeout(d,5e3)}function s(e){v.emit("error",e)}function a(e){e.wasClean||c(),t()}function f(e){v.emit("message",e.data)}function d(){l=new i(e),l.onopen=t,l.onerror=s,l.onclose=a,l.onmessage=f,l.binaryType="arraybuffer"}var l,p,m,v=o()
return r(n)||(n={}),v.send=function(e){return l&&l.send(e)},v.close=function(e,n){return clearTimeout(p),l&&l.close(e||1e3,n)},v.open=function(){return(!l||l&&l.readyState===i.CLOSED)&&d(),l&&l.readyState===i.OPEN},v.connected=function(){return l&&l.readyState===i.OPEN},n.disconnected||v.open(),v}},{"./emitter":2}],6:[function(e,n,t){function r(e,n){e.addEventListener("change",function(){for(var n=e.files,t=n.length;t>0;)t-=1,c.emit("file",n[t])})}var o=e("./ready"),i=e("./upload/emitter"),u=e("./upload")("wss://echo.websocket.org"),c=i(),s=[],a=[],f=[],d=function(){function e(e){return e.id}function n(n,t){var r=d3.select(n).selectAll("li").data(t,e)
r.exit().remove(),r.enter().append("li").text(function(e){return e.file.name})}return function(){n("#queued",s),n("#uploaded",f),n("#failed",a)}}()
o(function(){function e(e){d3.select("#status").text(e?"Connected":"Disconnected").classed("connected",e)}function n(e){var n=s.findIndex(function(n){return e.id===n.id})
return s.splice(n,1)[0]}r(document.getElementById("file-input"))
var t=function(e){return function(n){e.style.width=100*n+"%"}}(document.getElementById("bar"))
t(0),e(),u.on("progress",t).on("error",function(e){console.log(e)}),u.websocket.on("connect",e.bind(null,!0)).on("disconnect",e.bind(null,!1)),c.on("file",function(e){var n=u(e)
s.push(n),d()}),u.on("done",function(e){console.log("done",e),f.push(n(e)),d()}).on("failed",function(e){console.log("failed",e),a.push(n(e)),d()})})},{"./ready":1,"./upload":3,"./upload/emitter":2}]},{},[6])
