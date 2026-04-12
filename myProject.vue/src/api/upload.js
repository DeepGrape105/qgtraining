import request from './request'

export const uploadImageApi = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const res = await request.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.url
}