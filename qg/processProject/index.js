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
  if (!moveItem) return alert('请先点击选中要删除的工艺')
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
document.querySelector('.craftList').addEventListener('click', e => {
  addMove(e, '.craftList')
})
document.querySelector('.processList').addEventListener('click', e => {
  addMove(e, '.processList')
})

//拖拽事件
//抓之前
document.querySelector('.processList').addEventListener('dragstart', e => {
  if (e.target.tagName === 'LI') {
    e.dataTransfer.setData('text/plain', e.target.dataset.id)
    addMove(e, '.processList')
  }
})
document.querySelector('.craftList').addEventListener('dragstart', e => {
  if (e.target.tagName === 'LI') {
    e.dataTransfer.setData('text/plain', e.target.dataset.id)
    addMove(e, '.craftList')
  }
})
//抓之后
document.querySelector('.processList').addEventListener('dragend', e => {
  if (e.target.tagName === 'LI') {
    addMove(e, '.processList')
  }
})
document.querySelector('.craftList').addEventListener('dragend', e => {
  if (e.target.tagName === 'LI') {
    addMove(e, '.craftList')
  }
})

//允许你进入
document.querySelector('.newCraft').addEventListener('dragover', e => {

})

//进入后加载数据
document.querySelector('.newCraft').addEventListener('drop', async e => {
  e.preventDefault()
  const id = e.dataTransfer.getData('text/plain')
  try {
    const res = await axios({
      url: `${urlPocess}/${id}`,
      method: 'GET'
    })
  } catch {
    console.dir(err.message);
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
    const res = await axios({
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

//更新列表函数,参数分别是接口地址和列表的选择器
async function upDataList(url, List) {
  try {
    //得到请求的数据
    const res = await axios({
      url,
      method: 'GET'
    })
    //映射更换字符串
    const htmlStr = res.data.map(item => `
      <li draggable="true" data-id="${item.id}">${item.name}</li>
    `).join('')
    document.querySelector(List).innerHTML = htmlStr
  } catch (err) {
    console.dir(err.message);
  }
}

//添加move样式函数，参数分别是事件对象和列表的选择器
function addMove(e, List) {
  if (e.target.tagName === 'LI') {
    document.querySelectorAll(List + ' li').forEach(item => {
      item.classList.remove('move')
    })
    e.target.classList.toggle('move')
  }
}

//打开页面自动更新列表
upDataList(urlPocess, '.processList')
upDataList(urlCraft, '.craftList')