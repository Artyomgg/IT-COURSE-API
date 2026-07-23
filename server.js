require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

const authRoutes = require('./src/routes/auth')
const teacherRoutes = require('./src/routes/teachers')
const scheduleRoutes = require('./src/routes/schedules')
const testResultsRoutes = require('./src/routes/testResults')
const TeacherSchedule = require('./src/models/TeacherSchedule')

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

mongoose
	.connect(process.env.MONGODB_URI)
	.then(async () => {
		console.log('✅ MongoDB Atlas подключена')
		await TeacherSchedule.ensureCollection()
		console.log('🚀 Сервер готов к работе')
	})
	.catch(err => console.error('❌ Ошибка подключения к MongoDB:', err))

app.use('/api/auth', authRoutes)
app.use('/api/teachers', teacherRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/test-results', testResultsRoutes)

app.use((err, req, res, next) => {
	console.error(err.stack)
	res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

app.listen(PORT, () => {
	console.log(`🌐 Сервер запущен на http://localhost:${PORT}`)
})
