// server.js
require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const { testEmailConnection } = require('./src/utils/email.js')

// ===== ИМПОРТ МАРШРУТОВ =====
const authRoutes = require('./src/routes/auth')
const teacherRoutes = require('./src/routes/teachers')
const testResultsRoutes = require('./src/routes/testResults')
const interactivesRoutes = require('./src/routes/interactives')
const notificationRoutes = require('./src/routes/notifications')
const permissionsRoutes = require('./src/routes/permissions')
const testsRoutes = require('./src/routes/tests')
const classesRoutes = require('./src/routes/classes')
const newsRoutes = require('./src/routes/news')
const sectionsRoutes = require('./src/routes/sections')
const schoolRequestsRoutes = require('./src/routes/schoolRequests')

const app = express()
const PORT = process.env.PORT || 5000

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(cors())

// ===== ПОДКЛЮЧЕНИЕ К MONGODB =====
mongoose
	.connect(process.env.MONGODB_URI)
	.then(async () => {
		console.log('✅ MongoDB Atlas подключена')

		// Проверяем email
		await testEmailConnection()

		console.log('🚀 Сервер готов к работе')
	})
	.catch(err => console.error('❌ Ошибка подключения к MongoDB:', err))

// ===== МАРШРУТЫ =====
app.use('/api/auth', authRoutes)
app.use('/api/teachers', teacherRoutes)
app.use('/api/test-results', testResultsRoutes)
app.use('/api/interactives', interactivesRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/permissions', permissionsRoutes)
app.use('/api/tests', testsRoutes)
app.use('/api/classes', classesRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/sections', sectionsRoutes)
app.use('/api/school-requests', schoolRequestsRoutes)

// ===== ОБРАБОТКА ОШИБОК =====
app.use((err, req, res, next) => {
	console.error('❌ Ошибка:', err.stack)
	res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

// ===== ЗАПУСК =====
app.listen(PORT, () => {
	console.log(`🌐 Сервер запущен на http://localhost:${PORT}`)
})
