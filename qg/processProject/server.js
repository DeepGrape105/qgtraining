const http = require('http')
const fs = require('fs')
const path = require('path')
const dirPath = path.join(__dirname, 'db.json')
const crypto = require('crypto')
//读入文件函数
const fsRead = () => {
  return JSON.parse(fs.readFileSync(dirPath, 'utf8'))
}
//读出文件函数
const fsWrite = (data) => {
  fs.writeFileSync(dirPath, JSON.stringify(data))
}
//创建服务器
const server = http.createServer((req, res) => {
  const method = req.method
  const url = req.url
  //获取html静态网页
  if (method === 'GET' && !url.startsWith('/api')) {
    let tempPath = ''
    if (url === '/') {
      tempPath = 'index.html'
    } else {
      tempPath = url
    }
    const filePath = path.join(__dirname, tempPath)
    //获取样式名
    const ext = path.extname(filePath)
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404
        res.end('404 Not Found')
      } else {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' })
        res.end(data)
      }
    })
    return
  }

  //监听数据
  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', () => {
    //获取数据
    const data = fsRead()
    let parsedBody = {}
    if (body) {
      parsedBody = JSON.parse(body)
    }

    //工序模块请求
    if (url.startsWith('/api/processes')) {
      const id = url.split('/')[3]
      if (method === 'GET') {
        if (id) {
          //返回符合条件的
          const item = data.processes.find(p => p.id === id)
          res.end(JSON.stringify(item || {}))
        } else {
          res.end(JSON.stringify(data.processes))
        }
      } else if (method === 'POST') {
        //生成id方便匹配
        const newItem = { ...parsedBody, id: crypto.randomBytes(4).toString('hex') }
        //加入到数组
        data.processes.push(newItem)
        fsWrite(data)
        res.end('success')
      }
    }
    //工艺模块请求
    else if (url.startsWith('/api/crafts')) {
      const id = url.split('/')[3]

      if (method === 'GET') {
        if (id) {
          const item = data.crafts.find(c => c.id === id)
          res.end(JSON.stringify(item || {}))
        } else {
          res.end(JSON.stringify(data.crafts))
        }
      } else if (method === 'POST') {
        const newCraft = {
          ...parsedBody,
          id: crypto.randomBytes(4).toString('hex'),
          innerPoccess: []
        }
        data.crafts.push(newCraft)
        fsWrite(data)
        res.end(JSON.stringify(newCraft))
      } else if (method === 'DELETE' && id) {
        //用数组方法过滤不符合的
        data.crafts = data.crafts.filter(c => c.id !== id)
        fsWrite(data)
        res.end(JSON.stringify('success'))
      }
      else if (method === 'PATCH' && id) {
        const item = data.crafts.find(c => c.id === id)
        item.innerPoccess = parsedBody.innerPoccess || []
        fsWrite(data)
        res.end('success')
      }
    }
  })
})

server.listen(3000, () => {
  console.log('服务器运行在 http://localhost:3000')
})