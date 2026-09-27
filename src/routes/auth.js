const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Teacher = require('../models/Teacher.js')
const { authenticateToken } = require('../middleware/auth.js')
const { createNotification } = require('../utils/notifications.js')

// ============================================
// 🔐 ВХОД (регистр НЕ важен для логина и email)
// ============================================
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body

		// 🔥 Нормализация: без пробелов, в нижний регистр
		const loginInput = String(email || '').trim()
		const loginLower = loginInput.toLowerCase()

		if (!loginLower || !password) {
			return res.status(400).json({ error: 'Введите логин и пароль' })
		}

		let teacher = null

		// Если ввели email (содержит @) — ищем по email (регистр не важен)
		if (loginInput.includes('@')) {
			teacher = await Teacher.findOne({
				email: { $regex: `^${escapeRegex(loginLower)}$`, $options: 'i' },
			})
		} else {
			// Если ввели логин — ищем по username (регистр не важен)
			teacher = await Teacher.findOne({
				username: { $regex: `^${escapeRegex(loginLower)}$`, $options: 'i' },
			})
		}

		if (!teacher) {
			return res.status(401).json({ error: 'Неверные учетные данные' })
		}

		// Пароль — регистрозависимый (не трогаем)
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
		console.error('❌ Ошибка входа:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// 📝 РЕГИСТРАЦИЯ (только для админов)
// ============================================
router.post('/register', authenticateToken, async (req, res) => {
	try {
		let { full_name, username, email, phone, password, school, subject, role } = req.body

		if (req.user.role !== 'super_admin' && req.user.role !== 'school_admin') {
			return res.status(403).json({ error: 'Недостаточно прав' })
		}

		// 🔥 Нормализация email и username
		email = String(email || '')
			.trim()
			.toLowerCase()
		username = String(username || '')
			.trim()
			.toLowerCase()

		if (!email || !username) {
			return res.status(400).json({ error: 'Email и логин обязательны' })
		}

		if (!password || password.length < 4) {
			return res.status(400).json({ error: 'Пароль должен быть минимум 4 символа' })
		}

		// Проверяем существование (регистр не важен)
		const existing = await Teacher.findOne({
			$or: [
				{ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } },
				{ username: { $regex: `^${escapeRegex(username)}$`, $options: 'i' } },
			],
		})

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

		// ✅ Уведомление
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
		console.error('❌ Ошибка регистрации:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// ============================================
// 👤 ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
// ============================================
router.get('/me', authenticateToken, async (req, res) => {
	try {
		const teacher = await Teacher.findById(req.user.id).select('-password')
		if (!teacher) return res.status(404).json({ error: 'Пользователь не найден' })
		res.json(teacher)
	} catch (err) {
		console.error('❌ Ошибка /me:', err)
		res.status(500).json({ error: 'Ошибка сервера' })
	}
})

// 🔥 Экранирование спецсимволов в regex
function escapeRegex(str) {
	return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
