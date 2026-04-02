//新增工序
//实例化使用bootstrap插件直接serialize获取表单数据
//工序的
const processModal = document.querySelector('#processModal')
const modal1 = new bootstrap.Modal(processModal)
const processForm = document.querySelector('#processForm')
//工序的
const craftModal = document.querySelector('#craftModal')
const modal2 = new bootstrap.Modal(craftModal)
const craftForm = document.querySelector('#craftForm')
//直接封装网址接口
const urlPocess = 'http://localhost:3000/processes'
const urlCraft = 'http://localhost:3000/crafts'

//打开页面自动更新列表
upDataList(urlPocess, '.processList')
upDataList(urlCraft, '.craftList')

//点击显示输入框
//点击新增工序显示输入框
document.querySelector('.processBottom').addEventListener('click', function () {
  modal1.show()
})
//点击新增工艺显示输入框
document.querySelector('.craftHeader button').addEventListener('click', function () {
  modal2.show()
})

//点击删除选中工艺，在工艺列表添加事件监听，点击工艺时如果有move样式就删除这个工艺
document.querySelector('.craftBottom').addEventListener('click', async () => {
  const moveItem = document.querySelector('.craftList .move')
  if (!moveItem) {
    return alert('请先点击选中要删除的工艺')
  }
  const id = moveItem.dataset.id
  try {
    await axios({
      url: `${urlCraft}/${id}`,
      method: 'DELETE'
    })
  } catch (err) {
    console.dir('删除失败：' + err.message)
  }
  upDataList(urlCraft, '.craftList')
})

//点击添加样式move
//点击工艺列表的li添加move样式标记，
document.querySelector('.craftList').addEventListener('click', async e => {
  const header = document.querySelector('.newCraftHeader')
  const content = document.querySelector('.newCraftContent')
  if (e.target.tagName === 'LI') {
    addMove(e, '.craftList')
    if (e.target.classList.contains('move')) {
      const id = e.target.dataset.id
      header.innerHTML = `<h2>工艺：<span>${e.target.innerText}</span></h2>
        <button class="saveAll">保存工艺</button>
        <button class="delAll">清空工序</button>`
      header.classList.add('show')
      try {
        const res = await axios({
          url: `${urlCraft}/${id}`,
        })
        content.dataset.id = res.data.id
        content.innerHTML = '<span>将左侧工序拖拽到此处</span>'
        upDataNewCraft(res.data.innerPoccess || [])
      } catch (err) {
        console.dir(err.message);
      }
    } else {
      header.classList.remove('show')
      content.innerHTML = '<span>将左侧工序拖拽到此处</span>'
    }
  }
})
document.querySelector('.processList').addEventListener('click', e => {
  addMove(e, '.processList')
})

//拖拽事件
//抓之前
document.querySelector('.processList').addEventListener('dragstart', e => {
  if (e.target.tagName === 'LI') {
    //得到id得到一切
    e.dataTransfer.setData('text/id', e.target.dataset.id)
    //贴标签判定可放入情况
    e.dataTransfer.setData('processtype', 'true')
    addMove(e, '.processList')
  }
})
//抓之后
document.querySelector('.processList').addEventListener('dragend', () => {
  document.querySelector('.newCraftContent').style.background = '#FFFFFF'
})


//判断是否允许工序进入
document.querySelector('.newCraftContent').addEventListener('dragover', e => {
  let isProcess = e.dataTransfer.types.includes('processtype')
  let haveCraft = document.querySelector('.newCraftHeader').classList.contains('show')
  if (isProcess && haveCraft) {
    e.preventDefault()
    e.currentTarget.style.background = '#e6f7ee'
  } else {
    e.currentTarget.style.background = '#FCEEEE'
  }
})

//进入后加载数据
document.querySelector('.newCraftContent').addEventListener('drop', async e => {
  const isProcess = e.dataTransfer.types.includes('processtype')
  const processId = e.dataTransfer.getData('text/id')
  if (isProcess) {
    document.querySelector('.newCraftContent span').style.display = 'none'
    e.preventDefault()
    const newLi = document.createElement('li')
    document.querySelector('.newCraftContent').appendChild(newLi)
    const res = await axios({
      url: `${urlPocess}/${processId}`
    })
    newLi.innerHTML = `
          <p>${document.querySelectorAll('.newCraftContent li').length}.</p><div class="pname">${res.data.name}</div><button>删除工序</button>
      `
  }
})

//点击删除按钮
document.querySelector('.newCraftContent').addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    e.target.parentElement.remove()
    const lis = document.querySelectorAll('.newCraftContent li')
    if (lis.length === 0) {
      document.querySelector('.newCraftContent').innerHTML = '<span>将左侧工序拖拽到此处</span>'
    } else {
      lis.forEach((li, index) => {
        li.querySelector('p').innerText = `${index + 1}.`
      })
    }
  }
})

//点击提交就获取表单数据并发送请求，这里用到保存数据和更新列表函数
//点击提交工序数据
document.querySelector('.submitProcess').addEventListener('click', async e => {
  await saveSubmit(e, processForm, urlPocess, modal1)
  upDataList(urlPocess, '.processList')
})
//点击提交工艺数据
document.querySelector('.submitCraft').addEventListener('click', async e => {
  await saveSubmit(e, craftForm, urlCraft, modal2)
  upDataList(urlCraft, '.craftList')
})

//封装一个保存数据的函数，参数分别是事件对象，表单元素，接口地址和模态框实例
async function saveSubmit(e, Form, url, modal) {
  e.preventDefault()
  const data = serialize(Form, { hash: true, empty: true })
  //存数据
  try {
    await axios({
      url,
      method: 'POST',
      data
    })
    //关掉模态框和清除表单数据
    modal.hide()
    Form.reset()
  } catch (err) {
    console.dir(err.message)
  }
}


//点击保存,点击删除工序进行删除
document.querySelector('.newCraftHeader').addEventListener('click', async e => {
  e.stopPropagation()
  const id = document.querySelector('.newCraftContent').dataset.id
  if (e.target.classList.contains('saveAll')) {
    const innerProcessData = Array.from(document.querySelectorAll('.newCraftContent li .pname')).map(item => {
      return { name: item.innerText.trim() }
    })
    await axios({
      url: `${urlCraft}/${id}`,
      method: 'PATCH',
      data: {
        innerPoccess: innerProcessData
      }
    })
  }
  if (e.target.classList.contains('delAll')) {
    try {
      await axios({
        url: `${urlCraft}/${id}`,
        method: 'PATCH',
        data: { innerPoccess: [] }
      })
      upDataNewCraft([])
    } catch (err) {
      console.dir(err.message)
    }
  }
})



//更新列表函数,参数分别是接口地址和列表的选择器
async function upDataList(url, List) {
  try {
    //得到请求的数据
    const res = await axios({
      url
    })
    //映射更换字符串
    let htmlStr = ''
    if (url === urlPocess) {
      htmlStr = res.data.map(item => `
      <li draggable="true" data-id="${item.id}">${item.name}</li>
    `).join('')
    } else {
      htmlStr = res.data.map(item => `
      <li data-id="${item.id}">${item.name}</li>
    `).join('')
    }
    document.querySelector(List).innerHTML = htmlStr
  } catch (err) {
    console.dir(err.message);
  }
}

//添加move样式函数，参数分别是事件对象和列表的选择器
function addMove(e, List) {
  if (e.target.tagName === 'LI') {
    document.querySelectorAll(List + ' li').forEach(item => {
      if (item !== e.target) {
        item.classList.remove('move')
      }
    })
    e.target.classList.toggle('move')
  }
}

//更新列表
function upDataNewCraft(data) {
  const content = document.querySelector('.newCraftContent')
  if (data.length > 0) {
    content.innerHTML = ''
    document.querySelector('.newCraftContent').innerHTML = data.map((item, index) => `<li>
          <p>${index + 1}.</p><div class= "pname">${item.name}</div><button>删除工序</button>
        </li>`).join('')
  } else {
    content.innerHTML = '<span>将左侧工序拖拽到此处</span>'
  }
}
