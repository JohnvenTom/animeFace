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
 * 该函数处理前端发送的图片识别请求，将图片转发给dio.jite.me API进行识别
 * 并将识别结果返回给前端
 * 
 * @throws {Error} 当图片上传失败或API调用失败时抛出错误
 */
app.post('/api/recognize', upload.single('file'), async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }

    // 获取use_correction参数
    const useCorrection = req.body.use_correction;
    
    // 使用form-data库构建请求体
    const form = new FormData();
    form.append('file', Buffer.from(req.file.buffer), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    // 如果提供了use_correction参数，也添加到表单中
    if (useCorrection !== undefined) {
      form.append('use_correction', useCorrection);
    }

    // 调用dio.jite.me识别API
    const response = await axios.post('https://dio.jite.me/api/recognize', form, {
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
      res.status(error.response.status).json({ 
        error: `识别服务错误: ${error.response.data.message || '未知错误'}`,
        details: error.response.data
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