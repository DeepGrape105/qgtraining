const http = require('http')
const fs = require('fs')
const path = require('path')
const server = http.createServer()

server.on('request', (req, res) => {
  const url = req.url
  let fpath = ''
  //不输入后缀也可以访问
  if (url === '/') {
    fpath = path.join(__dirname, 'index.html')
  } else {
    fpath = path.join(__dirname, url)
  }

  fs.readFile(fpath, (err, data) => {
    if (err) {
      res.statusCode = 404
      return res.end('404 Not Found')
    }
    res.end(data)
  })
})

server.listen(8080, () => {
  console.log('服务器已启动：http://localhost:8080')
})