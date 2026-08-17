const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')
const { createNotification } = require('../utils/notifications.js')

// Вход (поддерживает и email, и username)
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body
		let teacher = null

		// Если ввели email (содержит @) — ищем по email
		if (email.includes('@')) {
			teacher = await Teacher.findOne({ email })
		} else {
			// Если ввели логин — ищем по username
			teacher = await Teacher.findOne({ username: email })
		}

		if (!teacher) {
			return res.status(401).json({ error: 'Неверные учетные данные' })
		}

		const valid = await teacher.comparePassword(password)
		if (!valid) {
			return res.status(401).json({ error: 'Неверные учетные данные' })
		}

		if (!teacher.is_active) {
			return res.status(403).json({ error: 'Аккаунт деактивирован' })
		}

		const token = jwt.sign(
			{
				id: teacher._id,
				email: teacher.email,
				role: teacher.role,
				school: teacher.school,
			},
			process.env.JWT_SECRET,
			{ expiresIn: '7d' },
		)

		res.json({
			token,
			user: {
				id: teacher._id,
				full_name: teacher.full_name,
				email: teacher.email,
				role: teacher.role,
				school: teacher.school,
				subject: teacher.subject,
				is_active: teacher.is_active,
			},
		})
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// Регистрация нового учителя (только для администратора)
router.post('/register', authenticateToken, async (req, res) => {
	try {
		const { full_name, username, email, phone, password, school, subject, role } = req.body

		if (req.user.role !== 'super_admin' && req.user.role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		const existing = await Teacher.findOne({ $or: [{ email }, { username }] })
		if (existing) {
			return res
				.status(400)
				.json({ error: 'Пользователь с таким email или логином уже существует' })
		}

		const newTeacher = new Teacher({
			full_name,
			username,
			email,
			phone,
			password,
			school,
			subject: subject || 'Информатика',
			role: role || 'teacher',
			is_active: true,
		})
		await newTeacher.save()

		const teacherData = newTeacher.toObject()
		delete teacherData.password

		// ✅ Уведомление при добавлении учителя
		await createNotification({
			type: 'teacher_add',
			title: '👨‍🏫 Добавлен новый учитель',
			message: `Добавлен учитель: ${full_name} (${email}) в школу "${school}"`,
			details: { userId: newTeacher._id, email, name: full_name, school },
			targetRoles: ['super_admin', 'school_admin'],
			targetSchool: school,
			createdBy: req.user.id,
		})

		res.status(201).json({ message: 'Учитель создан', teacher: teacherData })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// Получить текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
	try {
		const teacher = await Teacher.findById(req.user.id).select('-password')
		if (!teacher) return res.status(404).json({ error: 'Пользователь не найден' })
		res.json(teacher)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

module.exports = router
