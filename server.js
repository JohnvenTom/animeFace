const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const FormData = require('form-data');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 配置multer用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制文件大小为5MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 提供静态文件服务

/**
 * 处理图片识别请求
 * 
 * @param {Object} req - HTTP请求对象
 * @param {Object} res - HTTP响应对象
 * @returns {void}
 * 
 * @description
 * 该函数处理前端发送的图片识别请求，支持通过本地上传或URL链接两种方式
 * 将图片转发给animeTrace API进行识别，并将识别结果返回给前端
 * 
 * @throws {Error} 当图片上传失败、URL无效或API调用失败时抛出错误
 */
app.post('/api/recognize', upload.single('file'), async (req, res) => {
  try {
    // 检查是否有文件上传或URL参数
    if (!req.file && !req.body.url) {
      return res.status(400).json({ error: '请上传图片文件或输入图片URL地址' });
    }

    // 获取请求参数
    const isMulti = req.body.is_multi;
    const model = req.body.model;
    const aiDetect = req.body.ai_detect;
    const imageUrl = req.body.url;
    
    // 使用form-data库构建请求体
    const form = new FormData();
    
    // 根据上传方式添加相应参数
    if (req.file) {
      // 本地上传
      form.append('file', Buffer.from(req.file.buffer), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    } else if (imageUrl) {
      // URL链接
      form.append('url', imageUrl);
    }
    
    // 添加可选参数
    if (isMulti !== undefined) {
      form.append('is_multi', isMulti);
    }
    if (model !== undefined) {
      form.append('model', model);
    }
    if (aiDetect !== undefined) {
      form.append('ai_detect', aiDetect);
    }

    // 调用animeTrace识别API
    const response = await axios.post('https://api.animetrace.com/v1/search', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000 // 30秒超时
    });

    // 返回API响应给前端
    res.json(response.data);
  } catch (error) {
    console.error('识别API调用失败:', error.message);
    
    // 根据错误类型返回不同的错误信息
    if (error.response) {
      // API返回错误状态码
      const statusCode = error.response.status;
      const data = error.response.data;
      
      // 处理animeTrace API特定的错误码
      let errorMessage = '识别服务错误';
      
      if (data && data.code) {
        switch (data.code) {
          case 17701:
            errorMessage = '图片大小过大，请上传更小的图片';
            break;
          case 17702:
            errorMessage = '服务器繁忙，请稍后重试';
            break;
          case 17703:
            errorMessage = '请求参数不正确，请检查输入';
            break;
          case 17704:
            errorMessage = 'API维护中，请稍后重试';
            break;
          case 17705:
            errorMessage = '图片格式不支持，请上传JPG、PNG或GIF格式';
            break;
          case 17706:
            errorMessage = '识别无法完成，请重试';
            break;
          case 17707:
            errorMessage = '服务器内部错误，请重试';
            break;
          case 17708:
            errorMessage = '图片中的人物数量超过限制';
            break;
          case 17722:
            errorMessage = '图片下载失败，请检查图片URL';
            break;
          case 17728:
            errorMessage = '已达到本次使用上限，请稍后再试';
            break;
          case 17731:
            errorMessage = '服务利用人数过多，请重新尝试';
            break;
          default:
            errorMessage = data.message || errorMessage;
        }
      } else {
        errorMessage = data.message || errorMessage;
      }
      
      res.status(statusCode).json({ 
        error: errorMessage,
        details: data
      });
    } else if (error.request) {
      // 请求发送失败
      res.status(500).json({ 
        error: '无法连接到识别服务，请稍后重试' 
      });
    } else {
      // 其他错误
      res.status(500).json({ 
        error: `请求配置错误: ${error.message}` 
      });
    }
  }
});

/**
 * 根路径路由，返回前端页面
 * 
 * @param {Object} req - HTTP请求对象
 * @param {Object} res - HTTP响应对象
 * @returns {void}
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 启动服务器
 * 
 * @description
 * 在指定端口上启动Express服务器，监听客户端请求
 * 
 * @throws {Error} 当服务器启动失败时抛出错误
 */
app.listen(PORT, () => {
  console.log(`Anime character recognition server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the application`);
});

// 错误处理中间件
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制（最大5MB）' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

module.exports = app;