const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const SchoolRequest = require('../models/SchoolRequest.js')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')

// Генерация пароля
const generateRandomPassword = (length = 12) => {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
	let password = ''
	for (let i = 0; i < length; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	return password
}

// ============ GET / — Получить все заявки ============
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { role } = req.user
		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const requests = await SchoolRequest.find()
			.sort({ createdAt: -1 })
			.populate('processedBy', 'full_name email')

		res.json(requests)
	} catch (err) {
		console.error('❌ Ошибка получения заявок:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ POST / — Создать заявку ============
router.post('/', async (req, res) => {
	try {
		const {
			schoolName,
			schoolAddress,
			schoolPhone,
			schoolEmail,
			directorName,
			teacherName,
			teacherEmail,
			teacherPhone,
			message,
		} = req.body

		if (!schoolName || !schoolEmail || !directorName || !teacherName || !teacherEmail) {
			return res.status(400).json({ error: 'Заполните все обязательные поля' })
		}

		// Проверяем, не зарегистрирована ли уже школа
		const existingSchool = await Teacher.findOne({ school: schoolName })
		if (existingSchool) {
			return res.status(400).json({ error: 'Эта школа уже зарегистрирована' })
		}

		// Проверяем, не подана ли уже заявка
		const existingRequest = await SchoolRequest.findOne({
			schoolName,
			status: 'pending',
		})
		if (existingRequest) {
			return res.status(400).json({ error: 'Заявка от этой школы уже подана' })
		}

		const request = new SchoolRequest({
			schoolName,
			schoolAddress: schoolAddress || '',
			schoolPhone: schoolPhone || '',
			schoolEmail,
			directorName,
			teacherName,
			teacherEmail,
			teacherPhone: teacherPhone || '',
			message: message || '',
			status: 'pending',
		})

		await request.save()

		res.status(201).json({
			message: 'Заявка отправлена! Ожидайте подтверждения.',
			request,
		})
	} catch (err) {
		console.error('❌ Ошибка создания заявки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id/approve — Одобрить заявку ============
router.put('/:id/approve', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params
		const { role, id: userId } = req.user

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const request = await SchoolRequest.findById(id)
		if (!request) {
			return res.status(404).json({ error: 'Заявка не найдена' })
		}

		if (request.status !== 'pending') {
			return res.status(400).json({ error: 'Заявка уже обработана' })
		}

		// Проверяем, не зарегистрирована ли уже школа
		const existingSchool = await Teacher.findOne({ school: request.schoolName })
		if (existingSchool) {
			return res.status(400).json({ error: 'Эта школа уже зарегистрирована' })
		}

		// Генерируем пароль
		const tempPassword = generateRandomPassword(12)

		// Создаём администратора школы
		const salt = await bcrypt.genSalt(10)
		const hashedPassword = await bcrypt.hash(tempPassword, salt)

		const admin = new Teacher({
			full_name: request.teacherName,
			username: request.teacherEmail.split('@')[0] + Math.random().toString(36).substring(2, 6),
			email: request.teacherEmail,
			password: hashedPassword,
			school: request.schoolName,
			role: 'school_admin',
			is_active: true,
		})

		await admin.save()

		// Обновляем заявку
		request.status = 'approved'
		request.processedBy = userId
		request.processedAt = new Date()
		request.createdAdminId = admin._id
		await request.save()

		// ✅ ВОЗВРАЩАЕМ ПАРОЛЬ
		res.json({
			message: 'Школа зарегистрирована!',
			admin: {
				id: admin._id,
				email: admin.email,
				password: tempPassword,
				full_name: admin.full_name,
				school: admin.school,
			},
			request: {
				id: request._id,
				schoolName: request.schoolName,
				status: request.status,
			},
		})
	} catch (err) {
		console.error('❌ Ошибка одобрения заявки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============ PUT /:id/reject — Отклонить заявку ============
router.put('/:id/reject', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params
		const { role, id: userId } = req.user
		const { reason } = req.body

		if (role !== 'super_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const request = await SchoolRequest.findById(id)
		if (!request) {
			return res.status(404).json({ error: 'Заявка не найдена' })
		}

		if (request.status !== 'pending') {
			return res.status(400).json({ error: 'Заявка уже обработана' })
		}

		request.status = 'rejected'
		request.rejectionReason = reason || 'Не указана'
		request.processedBy = userId
		request.processedAt = new Date()
		await request.save()

		res.json({
			message: 'Заявка отклонена',
			request,
		})
	} catch (err) {
		console.error('❌ Ошибка отклонения заявки:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
